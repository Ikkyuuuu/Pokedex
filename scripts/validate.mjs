import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
const data=JSON.parse(await readFile('dist/data.json','utf8'));
const manifest=JSON.parse(await readFile('scripts/sprite-sources.json','utf8'));
assert.equal(data.length,905);
assert.equal(new Set(data.map(p=>p.name)).size,905);
assert.deepEqual(Array.from({length:8},(_,i)=>data.filter(p=>p.generation===i+1).length),[151,100,135,107,156,72,88,96]);
for(const [index,p] of data.entries()){
  assert.equal(p.id,index+1);
  assert(p.description&&p.types.length&&p.abilities.length,`${p.name} profile incomplete`);
  assert.equal(Object.keys(p.stats).length,6);
  assert(p.evolution.every(e=>data.some(q=>q.id===e.id)),`${p.name} evolution link invalid`);
  for(const animation of p.animations){
    assert(animation.sprite.startsWith('assets/'));
    assert((await stat(`dist/${animation.sprite}`)).size>0,`${p.name} artwork missing`);
  }
}
assert.deepEqual(data[5].weaknesses,[{type:'water',multiplier:2},{type:'electric',multiplier:2},{type:'rock',multiplier:4}]);
assert.equal(Object.values(data[5].stats).reduce((a,b)=>a+b,0),534);
assert.deepEqual(data[132].evolution.map(e=>e.id),[133,134,135,136,196,197,470,471,700]);
assert.equal(manifest.miscellaneous.length,9);
assert.equal(data[801].animations.length,7);
assert.equal(data[904].name,'enamorus');
console.log('Validated 905 profiles, eight generations, all local artwork and evolution links, nine miscellaneous animations, Charizard stats, and Eevee branches.');
