function randNorm2(mu, sd) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function resolvePocket(input, D = DIALS) {
  var _a, _b, _c, _d, _e, _f;
  const reps = input.reps || [];
  if (!reps.length) return { sacked: false, hurried: false };
  let numPen = 0;
  for (const rep of reps) if (rep.pen) numPen++;
  if (numPen === 0) return { sacked: false, hurried: false };
  const protectMult = (_a = input.protectMult) != null ? _a : 1;
  const blitzDesign = (_b = input.blitzDesign) != null ? _b : 50;
  const paBite = (_c = input.paBite) != null ? _c : 0;
  const passKey = (_d = input.passKey) != null ? _d : 0;
  const clock = D.CLOCK * (1 + (protectMult - 1) * D.PROT_GAIN) * (1 + paBite * D.PA_CLOCK);
  const collapse = D.COLLAPSE * (numPen - 1);
  const designPull = (blitzDesign - 50) / 100 * D.DESIGN_FREE;
  let minArr = Infinity;
  for (const rep of reps) {
    if (!rep.pen) continue;
    const a = rep.r || {};
    const isEdge = rep.power || rep.speed || /^(DE|OLB|LB-Edge)/.test(rep.pos || "");
    const path = isEdge ? D.PATH_EDGE : D.PATH_INT;
    const closeSpd = D.CLOSE_BASE + (((_e = a.SPD) != null ? _e : 50) * 0.6 + ((_f = a.AGI) != null ? _f : 50) * 0.4 - 55) * D.CLOSE_SLOPE;
    const traverse = path / Math.max(3, closeSpd);
    let shed;
    if (rep.blitzer) {
      shed = D.SHED_FREE - D.SHED_FREE * designPull + randNorm2(0, D.SHED_JIT);
      // PASS 4 (mug): the walked-up A-gap dog is already AT the line with the
      // snap timed — a free one arrives like a won rep, not like borrowed heat.
      if (rep.mug) shed -= D.MUG_SHED;
    } else {
      const margin = rep.b ? rPow(a) - bPow(rep.b) : 12;
      shed = D.SHED_BASE - margin * D.SHED_SLOPE - (rep.power ? D.POWER_FLUSH : 0) + randNorm2(0, D.SHED_JIT);
      // identity stage 3: Motor — pressure persistence; the engaged rusher
      // keeps working and his shed comes a beat sooner (won reps only — a
      // free runner is geometry, not effort)
      if (rep.motor) shed -= 0.03 * rep.motor;
    }
    shed = clamp3(shed, D.SHED_MIN, D.SHED_MAX);
    const arr = shed + traverse - collapse;
    if (arr < minArr) minArr = arr;
  }
  if (minArr < clock) return { sacked: true, hurried: false };
  const reach = clock * D.HURRY_REACH * (1 + passKey * D.KEY_HURRY) * (1 - paBite * D.PA_HURRY);
  return { sacked: false, hurried: minArr < reach };
}
var DIALS, clamp3, rPow, bPow;

DIALS = {
  CLOCK: 2.2,
  // nominal time-to-throw (s) — the master exposure dial
  SHED_BASE: 2.9,
  // a penetrator who BEAT his blocker: base shed time
  SHED_JIT: 0.72,
  // per-rep shed noise (sd) — rep-to-rep variance carries the curve
  SHED_SLOPE: 22e-4,
  // s earlier per pt of (rusher−blocker) rep margin — COMPRESSED hard,
  //   near-flat: the reps already paid the attributes upstream, and the
  //   population front-margin sack slope is ITSELF mostly the penetrator
  //   confound (which the geo inherits from the same reps for free). A
  //   larger slope here double-pays and over-steepens vs the frozen ref.
  SHED_FREE: 3.38,
  // free blitzer: NOT faster per-rusher — the hot throw beats him; his
  //   lift is the extra bodies he brings (measured confound), design pulls him earlier
  SHED_MIN: 0.55,
  SHED_MAX: 5,
  COLLAPSE: 0.12,
  // s earlier per EXTRA penetrator — MILD collective collapse (a strong
  //   gain over-convexifies the k² curve; the population wants ~3× not 100×)
  POWER_FLUSH: 0.22,
  // a power (bull) edge caves the spot faster than he finishes
  CLOSE_BASE: 7.35,
  // rusher closing speed (yd/s) at the population center
  CLOSE_SLOPE: 0.01,
  // yd/s per pt of (SPD·0.6+AGI·0.4 − 55) — COMPRESSED
  PATH_EDGE: 5.35,
  // traverse distance to the launch point: edge alignment
  PATH_INT: 4.45,
  // interior alignment (shorter path, slower body)
  PROT_GAIN: 0.17,
  // damps protectMult's effect on the clock so the geo's
  //   protection sensitivity matches the frozen multiplier (which
  //   scales the PROBABILITY linearly; clock-scaling over-responds raw)
  HURRY_REACH: 1.5,
  // not sacked but min arrival < clock·this ⇒ hurried
  PA_CLOCK: 0.26,
  // play-action deepens the drop: +exposure (frozen ×(1+pa·0.12) on sack)
  PA_HURRY: 0.26,
  // ...but the fake freezes the read: −hurry (frozen ×(1−pa·0.28))
  KEY_HURRY: 0.011,
  // pass-key ears-pinned: +hurry reach (frozen ×(1+passKey·0.012))
  DESIGN_FREE: 0.45,
  // blitz design pulls the free rusher's shed earlier (schemed pressure)
  MUG_SHED: 0.5
  // PASS 4: shed discount for a FREE mugged A-gap dog — he lined up in the
  // gap at the LOS; the pickup dock upstream makes more of them free, this
  // makes the free one dangerous. Gated by mug snaps only (rep.mug).
};
clamp3 = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
rPow = (a) => {
  var _a, _b, _c;
  return ((_a = a.STR) != null ? _a : 50) * 0.4 + ((_b = a.SPD) != null ? _b : 50) * 0.35 + ((_c = a.AGI) != null ? _c : 50) * 0.25;
};
bPow = (a) => {
  var _a, _b, _c;
  return ((_a = a.STR) != null ? _a : 50) * 0.45 + ((_b = a.TEC) != null ? _b : 50) * 0.3 + ((_c = a.AGI) != null ? _c : 50) * 0.25;
};

export { resolvePocket };
