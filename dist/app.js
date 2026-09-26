const $ = (selector) => document.querySelector(selector);
const scrollbarProbe = document.createElement('div');
scrollbarProbe.style.cssText='position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
scrollbarProbe.innerHTML='<div style="width:100%;height:1px"></div>';
document.body.append(scrollbarProbe);
const scrollbarWidth = scrollbarProbe.getBoundingClientRect().width-scrollbarProbe.firstElementChild.getBoundingClientRect().width;
scrollbarProbe.remove();
function reserveScrollbarSpace(){
  const layoutWidth=window.innerWidth-scrollbarWidth;
  const rootStyle=document.documentElement.style;
  rootStyle.setProperty('--layout-width',`${layoutWidth}px`);
  rootStyle.setProperty('--layout-gutter',`${Math.max(layoutWidth*(window.innerWidth<=700?.06:.055),(layoutWidth-1290)/2)}px`);
  rootStyle.setProperty('--scrollbar-compensation',`${Math.max(0,scrollbarWidth-(window.innerWidth-document.documentElement.getBoundingClientRect().width))}px`);
}
new ResizeObserver(reserveScrollbarSpace).observe(document.body);
window.addEventListener('resize',reserveScrollbarSpace);
reserveScrollbarSpace();
const heart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M20.5 4.8a5.3 5.3 0 0 0-7.5 0L12 5.9l-1.1-1.1a5.3 5.3 0 0 0-7.5 7.5L12 21l8.5-8.7a5.3 5.3 0 0 0 0-7.5Z"/></svg>';
const catalogBatchSize = () => matchMedia('(min-width:1001px)').matches ? 50 : 24;
let pokemon = [], limit = catalogBatchSize(), onlyFavorites = false, catalogScroll = 0, lastPokemonId = null, selectedAnimation = 0;
const selectedTypes = new Set();
let typeMatchMode = 'or';
let catalogResultKey = null, catalogRenderedView = null;
let catalogView = 'grid', tableSortKey = 'id', tableSortDirection = 1;
try { catalogView = localStorage.getItem('pokedex-view') === 'table' ? 'table' : 'grid'; } catch {}
const tableColumns = [['id','#'],['name','Name'],['type','Type'],['total','Total'],['hp','HP'],['attack','Attack'],['defense','Defense'],['special-attack','Sp. Atk'],['special-defense','Sp. Def'],['speed','Speed']];
const statTotal = p => Object.values(p.stats).reduce((a,b)=>a+b,0);
function tableHeader() {
  return '<table class="pokemon-table"><caption class="sr-only">Pokémon types and base stats</caption><colgroup><col style="width:12%"><col style="width:18%"><col style="width:10%"><col style="width:8%"><col span="6" style="width:7.666667%"><col style="width:6%"></colgroup><thead><tr>'+tableColumns.map(([key,label])=>key==='type'?'<th scope="col">Type</th>':`<th scope="col" data-sort-heading="${key}" aria-sort="${tableSortKey===key?(tableSortDirection===1?'ascending':'descending'):'none'}"><button type="button" data-sort="${key}">${label}<span class="sort-indicator" aria-hidden="true">${tableSortKey===key?(tableSortDirection===1?'↑':'↓'):'↕'}</span></button></th>`).join('')+'<th scope="col"><span class="sr-only">Favorite</span></th></tr></thead><tbody id="pokemon-table-body"></tbody></table>';
}
function tableRow(p,index) {
  return `<tr data-pokemon-id="${p.id}"><td><div class="table-number"><img src="${sprite(p)}" alt="" width="40" height="40" ${index>7?'loading="lazy"':''}><span>${number(p.id)}</span></div></td><th scope="row"><a class="card-link" href="#pokemon/${p.id}" aria-label="Explore ${escape(p.displayName)}, number ${number(p.id)}">${escape(p.displayName)}</a></th><td><div class="type-badges">${p.types.map(t=>badge(t)).join('')}</div></td><td class="table-total">${statTotal(p)}</td>${['hp','attack','defense','special-attack','special-defense','speed'].map(key=>`<td>${p.stats[key]}</td>`).join('')}<td>${favoriteButton(p)}</td></tr>`;
}
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem('kanto-favorites') || '[]').filter(Number.isInteger)); } catch {}
const number = id => String(id).padStart(3,'0');
const title = text => text.charAt(0).toUpperCase()+text.slice(1);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sprite = p => p.sprite || `assets/${p.name}.${p.name==='scyther'?'png':'gif'}`;
// Compress real-world height differences so tiny species remain visible and giants fit.
const artworkScale = p => Math.min(1, Math.max(0.42, Math.sqrt(p.height / 2))).toFixed(3);
const badge = (type, extra='') => `<span class="type-badge" data-type="${type}" title="${title(type)}"><img src="assets/types/${type}.svg" alt="${title(type)}" width="36" height="36">${extra}</span>`;
function favoriteButton(p) { return `<button class="favorite-button" data-favorite="${p.id}" aria-label="${favorites.has(p.id)?'Remove':'Add'} ${escape(p.displayName)} ${favorites.has(p.id)?'from':'to'} favorites" aria-pressed="${favorites.has(p.id)}">${heart}</button>`; }
function updateFavorites() {
  $('#favorite-count').textContent = favorites.size;
  document.querySelectorAll('[data-favorite]').forEach(button => {
    const p = pokemon.find(p=>p.id===Number(button.dataset.favorite));
    button.setAttribute('aria-pressed',favorites.has(p.id));
    button.setAttribute('aria-label',`${favorites.has(p.id)?'Remove':'Add'} ${p.displayName} ${favorites.has(p.id)?'from':'to'} favorites`);
  });
}
function renderCatalog({ append = false } = {}) {
  $('#clear-search').hidden = !$('#search').value;
  const query = $('#search').value.trim().toLowerCase().replace(/^#/, '');
  const type = selectedTypes.size > 0;
  syncTypeMenu();
  const matches = pokemon.filter(p=>(!onlyFavorites||favorites.has(p.id))&&(!type||(typeMatchMode==='all'?[...selectedTypes].every(t=>p.types.includes(t)):p.types.some(t=>selectedTypes.has(t))))&&(!query||p.name.includes(query)||p.displayName.toLowerCase().includes(query)||number(p.id)===query||String(p.id)===query));
  if(catalogView==='table') matches.sort((a,b)=>{
    const value=p=>tableSortKey==='id'?p.id:tableSortKey==='name'?p.displayName:tableSortKey==='total'?statTotal(p):p.stats[tableSortKey];
    const av=value(a),bv=value(b);
    return (typeof av==='string'?av.localeCompare(bv):av-bv)*tableSortDirection || a.id-b.id;
  });
  $('#results-count').innerHTML = `<strong>${matches.length}</strong> ${onlyFavorites?'favorites':'Pokémon'}${query||type?' found':' to discover'}`;
  const container = $('#pokemon-grid');
  const sameView = catalogRenderedView === catalogView;
  if(!sameView){container.classList.toggle('table-view',catalogView==='table');container.innerHTML=catalogView==='table'?tableHeader():'';append=false;}
  const grid = catalogView==='table' ? $('#pokemon-table-body') : container;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.view===catalogView));
  document.querySelectorAll('[data-sort-heading]').forEach(heading=>{
    const selected=heading.dataset.sortHeading===tableSortKey;
    heading.setAttribute('aria-sort',selected?(tableSortDirection===1?'ascending':'descending'):'none');
    heading.querySelector('.sort-indicator').textContent=selected?(tableSortDirection===1?'↑':'↓'):'↕';
  });
  const resultKey = matches.map(p=>p.id).join(',');
  const sameResults = sameView && resultKey === catalogResultKey;
  if(sameResults) limit=Math.max(limit,grid.children.length);
  const unchanged = !append && sameResults && grid.children.length === Math.min(limit,matches.length);
  const start = append ? grid.children.length : 0;
  const cards = matches.slice(start,limit).map((p,i)=>catalogView==='table'?tableRow(p,start+i):`<article class="pokemon-card" data-type="${p.types[0]}">${favoriteButton(p)}<a class="card-link" href="#pokemon/${p.id}" aria-label="Explore ${escape(p.displayName)}, number ${number(p.id)}"><div class="card-art"><span class="card-number">${number(p.id)}</span><span class="art-ring" aria-hidden="true"></span><img class="pokemon-image" style="--pokemon-scale:${artworkScale(p)}" src="${sprite(p)}" alt="${escape(p.displayName)}" width="180" height="160" ${start+i>7?'loading="lazy"':'fetchpriority="high"'}></div><div class="card-info"><div class="card-title-row"><h2>${escape(p.displayName)}</h2></div><div class="type-badges">${p.types.map(t=>badge(t)).join('')}</div></div></a></article>`).join('');
  if (append) grid.insertAdjacentHTML('beforeend', cards);
  else if(!unchanged) grid.innerHTML = cards;
  catalogResultKey = resultKey;
  catalogRenderedView = catalogView;
  container.setAttribute('aria-busy','false');
  $('#empty-state').hidden = matches.length > 0;
  $('#empty-message').textContent = onlyFavorites && favorites.size===0 ? 'Tap a heart to keep your favorites close.' : 'Try another name, number, or type.';
  const sentinel = $('#catalog-sentinel');
  sentinel.hidden = matches.length <= limit;
  catalogObserver.unobserve(sentinel);
  if (!sentinel.hidden) catalogObserver.observe(sentinel);
  $('#catalog-status').textContent = `Showing ${Math.min(limit, matches.length)} of ${matches.length} Pokémon.`;
  $('#favorites-nav').classList.toggle('active',onlyFavorites);
  $('.site-header a.nav-link').classList.toggle('active',!onlyFavorites);
  updateFavorites();
}
function renderDetail(p) {
  $('#detail').dataset.type = p.types[0];
  $('#detail').style.setProperty('--pokemon-scale', artworkScale(p));
  $('#detail').innerHTML = `<div class="detail-topbar"><a class="back-link" href="#">← <span>Back to the collection</span></a></div><div class="profile-layout"><div><div class="profile-art"><span class="profile-watermark" aria-hidden="true">${number(p.id)}</span><span class="art-ring" aria-hidden="true"></span>${favoriteButton(p)}<img class="profile-image" src="${sprite(p)}" alt="${escape(p.displayName)}" width="400" height="400"><div class="art-caption"><span>${escape(p.category).toUpperCase()} POKÉMON</span><span>GENERATION ${String(p.generation || 1).padStart(2,'0')}</span></div>${p.animations?.length>1?`<div class="animation-controls" aria-label="Pokémon animations"><button type="button" data-animation-step="-1" aria-label="Previous animation">←</button><span id="animation-label" aria-live="polite">Default</span><button type="button" data-animation-step="1" aria-label="Next animation">→</button></div>`:''}</div><section class="profile-evolution" aria-labelledby="evolution-heading"><h2 class="section-label" id="evolution-heading">Evolution</h2>${detailContent(p,'evolution')}</section></div><div class="profile-info"><div class="profile-title"><div><div class="profile-category">THE ${escape(p.category)} POKÉMON</div><div class="profile-name-row"><h1 tabindex="-1">${escape(p.displayName)}</h1><div class="type-badges">${p.types.map(t=>badge(t)).join('')}</div></div></div></div><p class="profile-description">${escape(p.description)}</p><dl class="profile-facts"><div><dt class="fact-label">Weight</dt><dd class="fact-value">${p.weight} <span>kg</span></dd></div><div><dt class="fact-label">Height</dt><dd class="fact-value">${p.height} <span>m</span></dd></div><div><dt class="fact-label">Category</dt><dd class="fact-value">${escape(p.category)}</dd></div><div><dt class="fact-label">Abilities</dt><dd class="fact-value">${p.abilities.map(escape).join(' / ')}</dd></div></dl><div class="profile-sections"><section class="profile-about" aria-label="Weaknesses and gender">${detailContent(p,'about')}</section><section class="profile-stats" aria-labelledby="stats-heading"><h2 class="section-label" id="stats-heading">Base stats</h2>${detailContent(p,'stats')}</section></div></div></div>`;
  updateFavorites();
}
function detailContent(p, panel) {
  if(panel==='about') {
    const female = p.genderRate<0?0:p.genderRate*12.5;
    return `<div class="profile-weaknesses"><h2 class="section-label">Weaknesses</h2><div class="weaknesses">${p.weaknesses.map(w=>badge(w.type,`<small>${w.multiplier}×</small>`)).join('')||'<span>No type weaknesses</span>'}</div></div><div class="gender"><h2 class="section-label">Gender</h2>${p.genderRate<0?'<p class="gender-labels">Gender unknown</p>':`<div class="gender-bar" role="img" aria-label="${100-female}% male, ${female}% female"><span class="gender-male" style="width:${100-female}%"></span><span class="gender-female" style="width:${female}%"></span></div><div class="gender-labels"><span>♂ ${100-female}% male</span><span>♀ ${female}% female</span></div>`}</div>`;
  } else if(panel==='stats') {
    const labels = {'hp':'HP','attack':'Attack','defense':'Defense','special-attack':'Sp. Attack','special-defense':'Sp. Defense','speed':'Speed'};
    return Object.entries(p.stats).map(([key,value])=>`<div class="stat-row"><span>${labels[key]}</span><strong>${value}</strong><div class="stat-track" aria-hidden="true"><div class="stat-fill" style="width:${value/255*100}%"></div></div></div>`).join('')+`<div class="stat-total"><span>Total</span><strong>${Object.values(p.stats).reduce((a,b)=>a+b,0)}</strong></div>`;
  } else {
    return `<div class="evolution-list">${p.evolution.map(stage=>{const member=pokemon.find(x=>x.id===stage.id);return `<a href="#pokemon/${member.id}" class="evolution-item ${member.id===p.id?'current':''}" ${member.id===p.id?'aria-current="page"':''}><img src="${sprite(member)}" alt="" width="55" height="55"><div><strong>${escape(member.displayName)}</strong><small>${number(member.id)}</small></div><span class="evolution-condition">${stage.condition?escape(stage.condition):'First form'}${member.id===p.id?' · Current':''}</span></a>`;}).join('')}</div>${p.evolution.length===1?'<p class="gender-labels">This Pokémon does not evolve within Generations I–VIII.</p>':''}`;
  }
}
function route() {
  const match = location.hash.match(/^#pokemon\/(\d+)$/);
  const p = match && pokemon.find(p=>p.id===Number(match[1]));
  $('footer').hidden = Boolean(p);
  const wasDetail = !$('#detail').hidden;
  if(p) {
    if(!wasDetail) catalogScroll = scrollY;
    lastPokemonId = p.id;
    closeTypeMenu();
    $('#navigation-search').hidden=true;
    $('#catalog').hidden=true;$('#detail').hidden=false;selectedAnimation=0;renderDetail(p);
    document.title='Pokédex';
    window.scrollTo({top:0,behavior:'instant'});
    $('#detail h1').focus({preventScroll:true});
  } else {
    $('#navigation-search').hidden=false;
    if(wasDetail) onlyFavorites=false;
    $('#catalog').hidden=false;$('#detail').hidden=true;document.title='Pokédex';renderCatalog();
    if(wasDetail) {window.scrollTo({top:catalogScroll,behavior:'instant'});(document.querySelector(`.card-link[href="#pokemon/${lastPokemonId}"]`)||document.querySelector('.card-link'))?.focus({preventScroll:true});}
  }
}
document.addEventListener('click',event=>{
  const viewButton=event.target.closest('[data-view]');
  if(viewButton){
    if(catalogView!==viewButton.dataset.view){catalogView=viewButton.dataset.view;try{localStorage.setItem('pokedex-view',catalogView);}catch{}renderCatalog();}
    return;
  }
  const sortButton=event.target.closest('[data-sort]');
  if(sortButton){
    if(tableSortKey===sortButton.dataset.sort) tableSortDirection*=-1;
    else {tableSortKey=sortButton.dataset.sort;tableSortDirection=['id','name'].includes(tableSortKey)?1:-1;}
    limit=catalogBatchSize();renderCatalog();return;
  }
  const evolutionLink=event.target.closest('.evolution-item');
  if(evolutionLink&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){
    event.preventDefault();
    const target=evolutionLink.getAttribute('href');
    if(location.hash!==target){history.replaceState(history.state,'',target);route();}
    return;
  }
  const backLink=event.target.closest('.back-link');
  if(backLink&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){
    event.preventDefault();onlyFavorites=false;history.replaceState(history.state,'','#');route();return;
  }
  const animationStep = event.target.closest('[data-animation-step]');
  if (animationStep) {
    const p = pokemon.find(p => p.id === Number(location.hash.split('/')[1]));
    selectedAnimation = (selectedAnimation + Number(animationStep.dataset.animationStep) + p.animations.length) % p.animations.length;
    $('#detail .profile-image').src = p.animations[selectedAnimation].sprite;
    $('#animation-label').textContent = p.animations[selectedAnimation].label;
  }
  const favorite = event.target.closest('[data-favorite]');
  if(favorite) {const id=Number(favorite.dataset.favorite);favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('kanto-favorites',JSON.stringify([...favorites]));}catch{}updateFavorites();if(!matchMedia('(prefers-reduced-motion: reduce)').matches){favorite.getAnimations().forEach(animation=>animation.cancel());favorite.animate([{transform:'scale(1)'},{transform:'scale(.9)',offset:.5},{transform:'scale(1)'}],{duration:200,easing:'ease-in-out'});}if(onlyFavorites&&!$('#catalog').hidden)renderCatalog();}
});
document.addEventListener('keydown',event=>{
  if(event.key==='/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('#catalog').hidden){event.preventDefault();$('#search').focus();}

});
$('#search').addEventListener('input',()=>{limit=catalogBatchSize();renderCatalog();});
$('.search').addEventListener('click',event=>{if(!event.target.closest('#clear-search'))$('#search').focus();});
$('#clear-search').addEventListener('click',()=>{$('#search').value='';limit=catalogBatchSize();renderCatalog();$('#search').focus();});


function syncTypeMenu() {
  const modeToggle=$('[data-type-mode-toggle]');
  if(modeToggle){modeToggle.setAttribute('aria-checked',typeMatchMode==='all');modeToggle.title=typeMatchMode==='all'?'Match every selected type':'Match any selected type';}
  const values = [...selectedTypes];
  const value = values.length === 1 ? values[0] : null;
  $('#type-value').innerHTML = value ? `<img src="assets/types/${value}.svg" alt="" width="24" height="24">${title(value)}` : values.length ? `${values.length} types` : '<img class="all-types-logo" src="assets/types/all.svg" alt="" width="24" height="24">All types';
  document.querySelectorAll('[data-type-option]').forEach(option => {
    const selected = option.dataset.typeOption ? selectedTypes.has(option.dataset.typeOption) : selectedTypes.size === 0;
    option.setAttribute('aria-checked', selected);
    option.tabIndex = 0;
  });
}
function closeTypeMenu(returnFocus = false) {
  $('#type-menu').hidden = true;
  $('#type-trigger').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('#type-trigger').focus({ preventScroll: true });
}
function openTypeMenu(edge) {
  $('#type-menu').hidden = false;
  $('#type-trigger').setAttribute('aria-expanded', 'true');
  const options = [...document.querySelectorAll('[data-type-option]')];
  const option = edge === 'first' ? options[0] : edge === 'last' ? options.at(-1) : options.find(option => option.getAttribute('aria-checked') === 'true');
  option?.focus({ preventScroll: true });
  option?.scrollIntoView({ block: 'nearest' });
}
$('#type-trigger').addEventListener('click', () => {
  $('#type-menu').hidden ? openTypeMenu() : closeTypeMenu();
});
$('#type-trigger').addEventListener('keydown', event => {
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    openTypeMenu(event.key === 'ArrowDown' ? 'first' : 'last');
  }
});
$('#type-menu').addEventListener('click', event => {
  const mode = event.target.closest('[data-type-mode-toggle]');
  if(mode){typeMatchMode=typeMatchMode==='or'?'all':'or';limit=catalogBatchSize();renderCatalog();return;}
  const option = event.target.closest('[data-type-option]');
  if (!option) return;
  const type = option.dataset.typeOption;
  if (!type) selectedTypes.clear();
  else if (selectedTypes.has(type)) selectedTypes.delete(type);
  else selectedTypes.add(type);
  limit=catalogBatchSize();renderCatalog();
});
let typeAhead = '', typeAheadTime = 0;
$('#type-menu').addEventListener('keydown', event => {
  const options = [...document.querySelectorAll('[data-type-option]')];
  let index = options.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
    options[index].focus({ preventScroll: true });
    options[index].scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Escape') {
    event.preventDefault(); closeTypeMenu(true);
  } else if (event.key.length === 1 && /[a-z]/i.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    typeAhead = Date.now() - typeAheadTime > 600 ? event.key : typeAhead + event.key;
    typeAheadTime = Date.now();
    const match = options.find(option => option.textContent.trim().toLowerCase().startsWith(typeAhead.toLowerCase()));
    match?.focus({ preventScroll: true });
    match?.scrollIntoView({ block: 'nearest' });
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.type-select')) closeTypeMenu();
});
document.addEventListener('focusin', event => {
  if (!event.target.closest('.type-select')) closeTypeMenu();
});

// Append near the bottom without replacing existing cards or moving keyboard focus.
const catalogObserver = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting) || $('#catalog').hidden || $('#catalog-sentinel').hidden) return;
  limit += catalogBatchSize();
  renderCatalog({ append: true });
}, { rootMargin: '0px 0px 500px 0px' });
function reset(){onlyFavorites=false;$('#search').value='';selectedTypes.clear();limit=catalogBatchSize();location.hash='';renderCatalog();}
$('#reset-filters').addEventListener('click',reset);
$('.site-header a.nav-link').addEventListener('click',reset);
$('.wordmark').addEventListener('click',reset);
$('#favorites-nav').addEventListener('click',()=>{onlyFavorites=true;limit=catalogBatchSize();$('#search').value='';selectedTypes.clear();if(location.hash)location.hash='';else renderCatalog();});
window.addEventListener('hashchange',()=>{if(pokemon.length)route();});
async function init(){try{const response=await fetch('data.json');if(!response.ok)throw Error('Data unavailable');pokemon=await response.json();const types=[...new Set(pokemon.flatMap(p=>p.types))].sort();$('#type-menu').innerHTML='<div class="type-match-mode" role="group" aria-label="Type matching mode"><span>Match types</span><button type="button" class="type-match-toggle" data-type-mode-toggle role="switch" aria-checked="false" aria-label="Match all selected types" title="Match any selected type"><span aria-hidden="true">All</span><span aria-hidden="true">Or</span></button></div>'+['',...types].map(t=>`<button type="button" class="type-option" role="checkbox" data-type-option="${t}" data-type="${t}" aria-checked="${t==='' ? 'true' : 'false'}" tabindex="0">${t ? `<img class="type-option-icon" src="assets/types/${t}.svg" alt="" width="24" height="24">` : `<img class="all-types-logo" src="assets/types/all.svg" alt="" width="24" height="24">`}<span>${t ? title(t) : 'All types'}</span><span class="option-check" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3.5 8 3 3 6-6"/></svg></span></button>`).join('');route();}catch{$('#pokemon-grid').setAttribute('aria-busy','false');$('#pokemon-grid').innerHTML='<div class="error-state"><h2>The field guide could not open.</h2><p>Please refresh to try again.</p><button class="load-more" id="retry">Try again ↗</button></div>';$('#retry').addEventListener('click',init);}}
init();
