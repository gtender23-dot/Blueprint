import { routeDuel } from '../js/engine/sepgeo.js';
const P = a => ({ attributes: { SPD:50,AGI:50,AWR:50,TEC:50,STR:50,JMP:50,HND:50, ...a }, compositeRating:50 });
const REPS = Number(process.argv[2] || 40000);
const run = (attr, cov, depth, vals) => {
  const out = vals.map(v => {
    let s=0; const rec=P({}), def=P({[attr]:v});
    for(let i=0;i<REPS;i++) s += routeDuel(rec, def, depth, cov, cov==='press');
    return s/REPS;
  });
  const dir = out[out.length-1] < out[0] ? 'helps defense (GOOD)' : 'HELPS THE RECEIVER (INVERTED)';
  console.log(`  ${cov}/${depth}  ${attr}: ` + vals.map((v,i)=>`${v}→${out[i].toFixed(3)}`).join('  ') + `   ${dir}`);
  return out;
};
const VALS = [20,40,60,80,99];
console.log(`sweeps, ${REPS} duels per point\n`);
console.log('PRESS — the jam attributes:');
for (const a of ['STR','TEC','AGI']) run(a,'press','medium',VALS);
console.log('\nMAN — the reaction attribute:');
run('AWR','man','medium',VALS);
run('AWR','man','short',VALS);
console.log('\nMAN — controls that should clearly help:');
run('SPD','man','medium',VALS);
console.log('\nZONE — the read:');
run('AWR','zone','medium',VALS);
run('AWR','zone','deep',VALS);
