"""Bundle Generation I–VIII profiles, artwork, and miscellaneous animations."""
import concurrent.futures, hashlib, html, json, pathlib, re, time, urllib.parse, urllib.request
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.sites-runtime' / 'api-cache'
PAGES = ROOT / '.sites-runtime' / 'source-pages'
CACHE.mkdir(parents=True, exist_ok=True)
PAGES.mkdir(parents=True, exist_ok=True)
MAX_ID = 905
REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar']
GENERATIONS = ['i','ii','iii','iv','v','vi','vii','viii']
TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']
SOURCE_PAGES = {i:f'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-{i}-pok%C3%A9mon-r{89+i if i<8 else 123}/' for i in range(1,9)}
SOURCE_PAGES[9] = 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-miscellaneous-animations-r147/'

def request(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=60) as response: return response.read()
        except Exception:
            if attempt==3: raise
            time.sleep(attempt+1)

def fetch(path):
    url = path if path.startswith('https:') else 'https://pokeapi.co/api/v2/'+path
    file = CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
    if not file.exists(): file.write_bytes(request(url))
    return json.loads(file.read_bytes())

def source_page(item):
    generation,url=item
    file=PAGES/f'{generation}.html'
    if not file.exists(): file.write_bytes(request(url))
    urls=list(dict.fromkeys(html.unescape(u) for u in re.findall(r'(?:src|data-src|href)=["\']([^"\']+(?:\.gif|\.png)(?:\?[^"\']*)?)["\']',file.read_text(encoding='utf-8'))))
    return generation,dict(sourcePage=url,assets=urls)

def parallel(items,function,label,workers=12):
    output=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures={pool.submit(function,item):item for item in items}
        for count,future in enumerate(concurrent.futures.as_completed(futures),1):
            try: output.append(future.result())
            except Exception as error: raise RuntimeError(f'{label}: {futures[future]}: {error}') from error
            if count%100==0 or count==len(futures): print(f'{label}: {count}/{len(futures)}',flush=True)
    return output

def pokemon(i):
    p,s=fetch(f'pokemon/{i}'),fetch(f'pokemon-species/{i}')
    english=[x for x in s['flavor_text_entries'] if x['language']['name']=='en']
    flavor=next((x['flavor_text'] for x in english if x['version']['name']=='firered'),english[-1]['flavor_text'] if english else '')
    generation=GENERATIONS.index(s['generation']['name'].split('-')[-1])+1
    art=p['sprites']['other']['official-artwork']['front_default'] or p['sprites']['other']['home']['front_default'] or p['sprites']['front_default']
    return dict(id=i,name=s['name'],apiName=p['name'],displayName=next(x['name'] for x in s['names'] if x['language']['name']=='en'),generation=generation,region='Hisui' if i>=899 else REGIONS[generation-1],types=[x['type']['name'] for x in p['types']],height=p['height']/10,weight=p['weight']/10,abilities=[x['ability']['name'].replace('-',' ').title() for x in p['abilities'] if not x['is_hidden']],category=next(x['genus'] for x in s['genera'] if x['language']['name']=='en').replace(' Pokémon',''),description=' '.join(flavor.replace('\f',' ').split()).replace('POKéMON','Pokémon').replace('POKÉMON','Pokémon'),genderRate=s['gender_rate'],stats={x['stat']['name']:x['base_stat'] for x in p['stats']},chainUrl=s['evolution_chain']['url'] if s['evolution_chain'] else None,artwork=art)

def condition(detail):
    parts=[]
    trigger=(detail.get('trigger') or {}).get('name')
    if trigger=='trade':parts.append('Trade')
    if detail.get('min_level'):parts.append('Level '+str(detail['min_level']))
    if detail.get('item'):parts.append(detail['item']['name'].replace('-',' ').title())
    if detail.get('held_item'):parts.append('Holding '+detail['held_item']['name'].replace('-',' ').title())
    if detail.get('min_happiness'):parts.append('High friendship')
    if detail.get('min_affection'):parts.append('High affection')
    if detail.get('min_beauty'):parts.append('High beauty')
    if detail.get('known_move'):parts.append('Knows '+detail['known_move']['name'].replace('-',' ').title())
    if detail.get('known_move_type'):parts.append('Knows a '+detail['known_move_type']['name'].title()+' move')
    if detail.get('time_of_day'):parts.append(detail['time_of_day'].title())
    if detail.get('location'):parts.append('At '+detail['location']['name'].replace('-',' ').title())
    if detail.get('needs_overworld_rain'):parts.append('In rain')
    if detail.get('turn_upside_down'):parts.append('Device upside down')
    if detail.get('gender') in [1,2]:parts.append('Female' if detail['gender']==1 else 'Male')
    if trigger=='shed':parts.append('Empty party slot + Poké Ball')
    if trigger=='other':parts.append('Special condition')
    return ' · '.join(parts) or (trigger or 'Special condition').replace('-',' ').title()

def walk(node,parent=None):
    i=int(node['species']['url'].rstrip('/').split('/')[-1])
    conditions=list(dict.fromkeys(condition(d) for d in node['evolution_details']))
    rows=[dict(id=i,parent=parent,condition=' / '.join(conditions) if parent else None)] if i<=MAX_ID else []
    for child in node['evolves_to']:rows.extend(walk(child,i))
    return rows

def save_image(url,stem,reuse=None):
    if reuse and (ROOT/'dist/assets'/reuse).exists():file=ROOT/'dist/assets'/reuse
    else:
        content=request(url)
        extension='.gif' if content.startswith(b'GIF8') else '.png' if content.startswith(b'\x89PNG') else '.jpg' if content.startswith(b'\xff\xd8') else None
        if not extension:raise ValueError(f'Not an image: {url}')
        file=ROOT/'dist/assets'/(stem+extension)
        file.write_bytes(content)
    with Image.open(file) as image:
        metadata=dict(filename=file.name,width=image.width,height=image.height,frames=getattr(image,'n_frames',1),animated=getattr(image,'n_frames',1)>1,bytes=file.stat().st_size)
        image.verify()
    return metadata

if __name__=='__main__':
    inventory=dict(parallel(list(SOURCE_PAGES.items()),source_page,'Source pages',workers=5))
    candidates={}
    for generation,page in sorted(inventory.items()):
        for url in page['assets']:
            if '/normal-sprite/' in url or '/swsh-normal-sprites/' in url:
                key=urllib.parse.unquote(url.split('/')[-1][:-4]).lower()
                candidates.setdefault(key,[]).append(dict(assetUrl=url,sourcePage=page['sourcePage'],generation=generation))
    aliases={'nidoran-f':'nidoran_f','nidoran-m':'nidoran_m','mr-mime':'mr.mime','mime-jr':'mime_jr','mr-rime':'mr.-rime','tapu-koko':'tapukoko','tapu-lele':'tapulele','tapu-bulu':'tapubulu','tapu-fini':'tapufini'}
    old=json.loads((ROOT/'scripts/sprite-sources.json').read_text(encoding='utf-8'))['pokemon']
    data=sorted(parallel(list(range(1,MAX_ID+1)),pokemon,'Profiles'),key=lambda p:p['id'])
    urls=sorted(set(p['chainUrl'] for p in data if p['chainUrl']))
    chains=dict(parallel(urls,lambda u:(u,fetch(u)),'Evolution chains'))
    types=dict(parallel(TYPES,lambda t:(t,fetch('type/'+t)),'Type matchups'))
    for p in data:
        url=p.pop('chainUrl')
        p['evolution']=walk(chains[url]['chain']) if url else [dict(id=p['id'],parent=None,condition=None)]
        multipliers={t:1 for t in TYPES}
        for t in p['types']:
            for relation,factor in [('double_damage_from',2),('half_damage_from',.5),('no_damage_from',0)]:
                for attacker in types[t]['damage_relations'][relation]:multipliers[attacker['name']]*=factor
        p['weaknesses']=[dict(type=t,multiplier=m) for t,m in multipliers.items() if m>1]
    def artwork(p):
        options=candidates.get(aliases.get(p['name'],p['name']),[])
        source=next((x for x in options if x['generation']==p['generation']),options[0] if options else None)
        previous=old.get(p['name'])
        if previous and not previous.get('fallback'):source=dict(assetUrl=previous['assetUrl'],sourcePage=previous['sourcePage'])
        if not source:source=dict(assetUrl=p['artwork'],sourcePage='https://pokeapi.co/',fallback=True)
        reuse=previous['filename'] if previous and previous['assetUrl']==source['assetUrl'] else None
        try:meta=save_image(source['assetUrl'],p['name'],reuse)
        except Exception:
            if source.get('fallback'):raise
            source=dict(assetUrl=p['artwork'],sourcePage='https://pokeapi.co/',fallback=True)
            meta=save_image(source['assetUrl'],p['name'])
        p['sprite']='assets/'+meta['filename']
        p['animated']=meta['animated']
        p.pop('artwork')
        p['animations']=[dict(label='Default',sprite=p['sprite'],animated=p['animated'])]
        return p['name'],dict(id=p['id'],**source,**meta)
    assets=dict(parallel(data,artwork,'Local artwork'))
    by_name={p['name']:p for p in data}
    misc=[]
    for url in inventory[9]['assets']:
        if '/3d-misc/' not in url:continue
        stem=urllib.parse.unquote(url.split('/')[-1][:-4])
        name,label=stem.split('-',1)
        if name not in by_name:continue
        meta=save_image(url,'misc-'+stem)
        by_name[name]['animations'].append(dict(label=label.replace('-',' ').title(),sprite='assets/'+meta['filename'],animated=meta['animated']))
        misc.append(dict(pokemon=name,assetUrl=url,sourcePage=SOURCE_PAGES[9],**meta))
    manifest=dict(sourcePages=list(SOURCE_PAGES.values()),count=len(assets),pokemon=assets,miscellaneous=misc)
    (ROOT/'scripts/sprite-sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'dist/data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    fallback=[name for name,asset in assets.items() if asset.get('fallback')]
    print(json.dumps(dict(species=len(data),animations=sum(p['animated'] for p in data),miscellaneous=len(misc),fallback=fallback)),flush=True)
