// Who wins the nickel job — LB priced at 1 (the defect) vs 0.65 (the fix)?
import { generateWorld } from './js/engine/world.js';
import { resolveDefField } from './js/engine/fieldassign.js';
import { SLOT_ELIGIBILITY } from './js/constants.js';
const price = Number(process.argv[2]);
SLOT_ELIGIBILITY.CB.LB = price === 1 ? undefined : price;
if (price === 1) delete SLOT_ELIGIBILITY.CB.LB;
const w = generateWorld();
const tally = {};
let n = 0;
for (const s of w.schools.slice(0, 60)) {
  if (!s.roster?.length) continue;
  const byId = new Map(s.roster.map(p => [p.id, p]));
  const depth = {};
  for (const p of s.roster) (depth[p.pos] ||= []).push(p.id);
  for (const k in depth) depth[k].sort((a,b)=>(byId.get(b).ovr||0)-(byId.get(a).ovr||0));
  const f = resolveDefField('Nickel', depth, {}, (id)=>byId.get(id)?.ovr||0,
    (id)=>byId.get(id)?.pos, (id)=>byId.get(id));
  const nb = f?.bySlot?.NB;
  if (!nb) continue;
  const pos = byId.get(nb)?.pos || '?';
  tally[pos] = (tally[pos]||0)+1; n++;
}
console.log(`LB price ${price === 1 ? 'UNPRICED (defect, =1)' : price}  n=${n}`,
  Object.fromEntries(Object.entries(tally).sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>[k, (100*v/n).toFixed(0)+'%'])));
