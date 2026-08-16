import { flawLv, traitLv, traitMult } from './traits.js';

function driveTo(d, tx, ty, dt) {
  const dx = tx - d.x, dy = ty - d.y;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const dvx = dx / dist * d.top - d.vx;
  const dvy = dy / dist * d.top - d.vy;
  const dv = Math.hypot(dvx, dvy) || 1e-6;
  const k = Math.min(1, d.acc * 2.2 * dt / dv);
  d.vx += dvx * k;
  d.vy += dvy * k;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}
function geoYAC(receiver, coveringDef, pursuitDefs, sep, _trace = null, depthKey = "short") {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const ra = receiver.attributes || {};
  const car = { x: 0, y: 0, top: spdYps(ra.SPD), acc: accel(ra.AGI), vx: 0, vy: 0 };
  const lean = (Math.random() - 0.5) * 0.6;
  car.vx = car.top * 0.45 * lean;
  car.vy = car.top * 0.45;
  // identity stage 3: YAC Monster — the open-field wiggle term is his game
  const wiggle = (((_a = ra.AGI) != null ? _a : 50) * 0.7 + ((_b = ra.TEC) != null ? _b : 50) * 0.3) * traitMult(receiver, "yacMonster", 0.012);
  // ── Fix B (YAC ceiling / un-saturate separation) ──────────────────────────
  // How OPEN the catch was should set how much daylight the runner has in front
  // of him — not just how far behind the beaten corner starts. PFF: a wide-open
  // receiver "spikes" YAC while a tightly-covered one "almost never gets more
  // than three yards." The old model only moved the beaten corner with sep; the
  // rally (who actually make the tackle) spawned at a fixed tight depth, so even
  // a wide-open catch ran into the same swarm and YAC saturated ~3.4 yd. `open`
  // is 0 at a covered catch, ~1 at a wide-open one; it pushes the rally DOWNFIELD
  // (a runway) and widens the swarm's arrival, so openness — and the receiver's
  // burst once he has grass — buys real YAC and a live explosive tail. Low sep is
  // left essentially untouched (the floor + short-band realism hold).
  const open = Math.max(0, ((sep != null ? sep : 0.4) - 0.25)) / 0.75; // 0 at sep<=0.25, ~1 at sep~1
  // ── Fix C (catch depth shapes the pursuit) ────────────────────────────────
  // Next Gen's expected-YAC spec: catch depth matters. A SHALLOW catch happens in
  // front of the defense with blockers ahead and defenders flowing downhill — more
  // room to run. A DEEP catch happens amid converging safeties with help arriving
  // — less. `depthRoom` adds a little runway on short throws and takes it away on
  // deep ones, so the SAME separation yields more YAC underneath than over the top
  // (which the by-band data showed the sim wasn't doing).
  const depthRoom = depthKey === "short" ? 1.6 : depthKey === "medium" ? 0.4 : depthKey === "vdeep" ? -1.4 : -0.8;
  const openY = Math.max(0, open * open * 9.0 + depthRoom); // extra downfield runway (yds)
  const chasers = [];
  if (coveringDef) {
    const da = coveringDef.attributes || {};
    const cd = {
      ref: coveringDef,
      cover: true,
      x: (Math.random() - 0.5) * 1.4,
      y: -(0.4 + (sep != null ? sep : 0.4) * 3.2),
      // the head start sep bought
      top: spdYps(da.SPD),
      acc: accel(da.AGI),
      // He was BEATEN on the route — hips turned, a beat to recover. This is
      // why the rally, not the beaten man, makes most of these tackles (the
      // old model's credit shift, now a physical fact).
      react: 0.08,
      tkl: finishOf(da),
      burned: 0
    };
    const d0 = Math.hypot(cd.x, cd.y) || 1e-6;
    cd.vx = -cd.x / d0 * cd.top * 0.65;
    cd.vy = -cd.y / d0 * cd.top * 0.65;
    chasers.push(cd);
  }
  const rally = (pursuitDefs || []).filter(Boolean);
  const stretched = Math.random() < 0.38;
  const swarm = !stretched && Math.random() < 0.42;
  let first = true;
  for (let i = 0; i < rally.length && chasers.length < 4; i += Math.random() < 0.75 ? 1 : 2) {
    const d = rally[i];
    if (coveringDef && d.id === coveringDef.id) continue;
    const da = d.attributes || {};
    const side = Math.random() < 0.5 ? -1 : 1;
    const far = stretched ? 3.1 : 0;
    const onSpot = swarm && first;
    const rd = onSpot ? {
      ref: d,
      cover: false,
      // On an open catch even the "on the spot" defender is a step late and has
      // to widen — openness pushes him off the spot and downfield.
      x: (Math.random() - 0.5) * (2.2 + open * 2.4),
      y: 0.2 + Math.random() * 1.2 + openY * 0.7,
      top: spdYps(da.SPD) * 0.99,
      acc: accel(da.AGI),
      react: 0.04 + open * 0.06,
      tkl: finishOf(da),
      burned: 0
    } : {
      ref: d,
      cover: false,
      x: side * (0.6 + far + Math.random() * 5),
      y: 0.6 + far * 0.8 + Math.random() * 4.6 + openY,
      top: spdYps(da.SPD) * 0.99,
      acc: accel(da.AGI),
      react: reactS(da.AWR),
      tkl: finishOf(da),
      burned: 0
    };
    first = false;
    const d0 = Math.hypot(rd.x, rd.y) || 1e-6;
    rd.vx = -rd.x / d0 * rd.top * (onSpot ? 0.75 : 0.6);
    rd.vy = -rd.y / d0 * rd.top * (onSpot ? 0.75 : 0.6);
    chasers.push(rd);
  }
  {
    const used = () => new Set(chasers.map((c) => c.ref));
    const pickS = () => rally.find((d) => !used().has(d) && String(d.position || "").includes("S")) || rally.find((d) => !used().has(d));
    for (let bi = 0; bi < 2; bi++) {
      const s = pickS();
      if (!s) break;
      const da = s.attributes || {};
      chasers.push({
        ref: s,
        cover: false,
        backstop: true,
        x: (Math.random() - 0.5) * (5 + bi * 3),
        // The deep backstop sits further off when the catch was clean, so a truly
        // open runner in space can occasionally split them for a chunk (the
        // explosive tail) instead of always meeting a wall at ~8 yards.
        y: 8 + bi * 4 + Math.random() * 3.5 + openY * 0.9,
        top: spdYps(da.SPD),
        acc: accel(da.AGI),
        vx: 0,
        vy: -spdYps(da.SPD) * 0.35,
        react: 0.1,
        tkl: finishOf(da) + 6,
        burned: 0
        // open-field pros
      });
    }
  }
  if (!chasers.length) {
    const yds = Math.min(MAX_Y, Math.round(6 + Math.random() * 10));
    return { yacYds: yds, tacklerId: null, assistId: null };
  }
  // ── Fix B: the breakaway gate (the explosive-YAC tail) ────────────────────
  // The tick-pursuit is a closing net: a fresh "cavalry" wave spawns on top of
  // the runner at t>=1.4s, so however open the catch, he's always corralled and
  // the explosive tail (real ~8-12% of catches gain >10 YAC) flat-lines near 0.
  // Real football's tail comes from the runner WINNING THE EDGE at the catch —
  // open grass + a speed edge on the rally + a runner who can finish = "he's
  // gone." Compute that once from the actual inputs: openness, the runner's
  // speed vs the pursuit's average, and his open-field wiggle. When it fires the
  // immediate wall is a step slow (their reactions lag) and NO cavalry arrives —
  // only a deep safety can still run him down. Gated by globalThis.__noBreakaway
  // for probe isolation.
  const rallyTop = rally.length ? rally.reduce((s, d) => s + spdYps((d.attributes || {}).SPD), 0) / rally.length : 6.4;
  const spdEdge = (car.top - rallyTop) / 2.2;                       // runner faster than the rally?
  // identity stage 3: Home-Run Threat — the explosive tail is his signature
  const breakP = globalThis.__noBreakaway ? 0 : Math.max(0, Math.min(0.34,
    open * (0.22 + Math.max(0, spdEdge) * 0.4 + (wiggle - 55) * 0.004) * traitMult(receiver, "homeRunThreat", 0.05)));
  const breakaway = Math.random() < breakP;
  let noCavalry = false;
  if (breakaway) {
    noCavalry = true;
    // He's beaten the front AND has a runway. The non-backstop wall is a full
    // beat late; the deep help is caught flat and has to flip and run, so it too
    // starts later and deeper. He won't always house it — a rangy safety can
    // still track him down — but this is where the chunk / house plays come from.
    // A CLEAN breakaway (blown deep coverage / no one home) fully removes a
    // backstop: that's the catch-and-house. Cleaner when he's really open + fast.
    const clean = Math.random() < Math.min(0.6, 0.28 + open * 0.3 + Math.max(0, spdEdge) * 0.4);
    let removedBackstop = false;
    // The front wall is BEATEN, not merely late — the two nearest non-backstop
    // defenders are shed at the catch (burned), clearing the runner's runway so
    // he actually reaches the sprung space. Without this the sprung runner kept
    // getting mopped up at ~6-8 yds and the tail never formed.
    const front = chasers.filter((c) => !c.backstop)
      .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    for (let fi = 0; fi < Math.min(2, front.length); fi++) front[fi].burned = 0.7 + Math.random() * 0.5;
    for (const c of chasers) {
      if (c.backstop) {
        if (clean && !removedBackstop) { c.burned = 5; removedBackstop = true; continue; } // he's gone past this man
        c.react += 0.16 + Math.random() * 0.18;
        c.y += 6 + Math.random() * 8;         // safety was flat-footed / wrong leverage
        c.top *= 0.96;
      } else if (!(c.burned > 0)) {
        c.react += 0.28 + Math.random() * 0.24;
        c.y += 2.5 + Math.random() * 3.5;
        c.top *= 0.98;
      }
    }
  }
  let tackler = null, assist = null, cavalry = noCavalry;
  for (let t = 0; t < MAX_T && car.y < MAX_Y && !tackler; t += TICK) {
    if (!cavalry && t >= 1.4) {
      cavalry = true;
      const pool = rally.length ? rally : coveringDef ? [coveringDef] : [];
      for (let ci = 0; ci < 2 && pool.length; ci++) {
        const src = pool[ci % pool.length];
        const da = src.attributes || {};
        chasers.push({
          ref: src,
          cover: false,
          cavalry: true,
          x: car.x + (ci ? -1 : 1) * (4.5 + Math.random() * 3),
          y: car.y + 4 + Math.random() * 3,
          top: spdYps(da.SPD),
          acc: accel(da.AGI),
          vx: 0,
          vy: -spdYps(da.SPD) * 0.5,
          react: 0,
          tkl: finishOf(da),
          burned: 0
        });
      }
    }
    const v = Math.hypot(car.vx, car.vy) || 1e-6;
    const want = Math.min(car.top, v + car.acc * TICK);
    const leanNow = car.vx * 0.88;
    const norm = Math.hypot(leanNow, car.top) || 1e-6;
    car.vx = leanNow / norm * want;
    car.vy = car.top / norm * want;
    const seeR = Math.max(2.4, Math.min(4.6, 3.2 + (((_c = ra.AWR) != null ? _c : 50) - 41) * 0.025));
    let threat = null, td = seeR;
    for (const d of chasers) {
      if (d.burned > 0) continue;
      const dx = d.x - car.x, dy = d.y - car.y;
      if (dy < -0.6) continue;
      const dist = Math.hypot(dx, dy);
      if (dist < td) {
        td = dist;
        threat = d;
      }
    }
    if (threat) {
      const cut = Math.max(0.2, Math.min(
        0.55,
        0.35 + (((_d = ra.AWR) != null ? _d : 50) - 41) * 25e-4 + (((_e = ra.AGI) != null ? _e : 50) - 41) * 15e-4
      ));
      car.vx += (car.x >= threat.x ? 1 : -1) * car.top * cut * TICK * (seeR - td);
      car.vx *= 0.985;
      // ── Fix B: brake only for a threat genuinely IN THE PATH ─────────────
      // The old model bled 6% forward speed EVERY tick any defender sat within
      // the see-radius — and one nearly always does — so the runner perpetually
      // decelerated and YAC saturated. Real open-field running: a man to the
      // SIDE is a cut opportunity you run past, a man squarely in front and
      // closing is who you brake for. Scale the vy bleed by how head-on the
      // threat is (small lateral gap = in the path) and how close he is, and let
      // a shifty runner (AGI/TEC "wiggle") keep more of his speed through it. An
      // open runner who's cleared the wall now actually pulls away.
      const latGap = Math.abs(threat.x - car.x);
      const headOn = Math.max(0, 1 - latGap / 2.2);             // 1 = dead ahead, 0 = well to the side
      const proximity = Math.max(0, (seeR - td) / seeR);        // closer threat brakes harder
      const elude = 1 - Math.min(0.4, (wiggle - 50) * 0.006);   // shifty backs shed speed less
      const brake = 1 - 0.11 * headOn * proximity * elude;
      car.vy *= brake;
    }
    car.x += car.vx * TICK;
    car.y += car.vy * TICK;
    if (_trace) _trace.push({
      t: +t.toFixed(1),
      car: [+car.x.toFixed(1), +car.y.toFixed(1)],
      ch: chasers.map((c) => [+c.x.toFixed(1), +c.y.toFixed(1), c.burned > 0 ? "B" : c.backstop ? "S" : c.cavalry ? "V" : c.cover ? "C" : "R"])
    });
    if (Math.abs(car.x) > 12.5) break;
    for (const d of chasers) {
      if (d.burned > 0) {
        d.burned -= TICK;
        continue;
      }
      if (t < d.react) {
        d.x += d.vx * TICK;
        d.y += d.vy * TICK;
        continue;
      }
      const gx = car.x - d.x, gy = car.y - d.y;
      const gap0 = Math.hypot(gx, gy) || 1e-6;
      // ── Fix B: let a faster runner actually pull away ────────────────────
      // The old floor forced EVERY pursuer to close at >=2 yd/s even when the
      // geometry had the runner pulling away — an artificial corral that
      // guaranteed the catch-up and flat-lined the explosive tail. Real closing
      // speed can be negative (he's gaining ground). A trailing pursuer who's a
      // step slow now genuinely loses the race, which is what a breakaway IS.
      const rawClose = -(((car.vx - d.vx) * gx + (car.vy - d.vy) * gy) / gap0);
      const behind = gy > 0.5; // pursuer is trailing the runner (chasing from behind: smaller y than the +y-moving runner)
      const closing = behind ? Math.max(-3, rawClose) : Math.max(2, rawClose);
      // identity stage 3: Angles — the breakaway dies at his angle (a longer
      // anticipatory lead on the intercept course)
      const lead = Math.min(0.6 + 0.05 * traitLv(d.ref, "angles"), gap0 / Math.max(0.5, closing));
      if (d.backstop && gap0 > 3.5) driveTo(d, car.x + car.vx * 0.15, d.y - 1.2, TICK);
      else driveTo(d, car.x + car.vx * lead, car.y + car.vy * lead, TICK);
      const gap = Math.hypot(d.x - car.x, d.y - car.y);
      const reach = RADIUS + Math.min(0.9, closing * 0.05);
      if (gap < reach) {
        // A sprung runner in the open is a harder tackle — the lone deep man is
        // at full speed/extension and whiffs more often. This (with the breakaway
        // gate) is what fattens the explosive tail toward the real ~8-12% of
        // catches that clear 10 YAC, without touching the healthy body.
        const openTackle = breakaway && d.backstop ? -0.14 : 0;
        // identity stage 3: Open-Field Tackler — the space tackle, this roll
        const pMake = 0.74 + (d.tkl - wiggle) * 5e-3 - (((_f = ra.AWR) != null ? _f : 50) - 41) * 16e-4 + openTackle + 0.02 * traitLv(d.ref, "openField");
        if (_trace) _trace.push({ finish: d.cover ? "C" : d.backstop ? "S" : "R", p: +pMake.toFixed(2), gap: +gap.toFixed(2), reach: +reach.toFixed(2) });
        if (Math.random() < Math.max(0.25, Math.min(0.95, pMake))) {
          tackler = d;
          let best = null, bd = 1e9;
          for (const o of chasers) {
            if (o === d || o.burned > 0) continue;
            const od = Math.hypot(o.x - car.x, o.y - car.y);
            if (od < 2.4 && od < bd) {
              bd = od;
              best = o;
            }
          }
          if (best && Math.random() < 0.55) assist = best;
          break;
        }
        d.burned = 0.9;
        // ── Fix B: a missed tackle IN SPACE is a spring, not a stumble ───────
        // The old model docked 30% of the runner's speed on every broken tackle,
        // so even beating a man never sprang a breakaway — the next defender
        // mopped up and the explosive tail stayed dead. Real football: shed a
        // tackler in traffic and you slow; shed one in open grass and you're
        // GONE. Count nearby defenders (traffic); with a clear field the runner
        // barely loses a step, which is how catch-and-house plays happen.
        let near = 0;
        for (const o of chasers) {
          if (o === d || o.burned > 0) continue;
          if (Math.hypot(o.x - car.x, o.y - car.y) < 4.5) near++;
        }
        const keep = near >= 2 ? 0.7 : near === 1 ? 0.85 : 0.97;
        car.vx *= keep;
        car.vy *= keep;
      }
    }
  }
  const yacYds = Math.max(0, Math.min(MAX_Y, Math.round(car.y)));
  return {
    yacYds,
    tacklerId: (_h = (_g = tackler == null ? void 0 : tackler.ref) == null ? void 0 : _g.id) != null ? _h : null,
    assistId: (_k = (_j = assist == null ? void 0 : assist.ref) == null ? void 0 : _j.id) != null ? _k : null
  };
}
var finishOf, TICK, MAX_T, MAX_Y, RADIUS, spdYps, accel, reactS;

finishOf = (a) => {
  var _a, _b, _c, _d;
  return ((_a = a.STR) != null ? _a : 50) * 0.34 + ((_b = a.PWR) != null ? _b : 50) * 0.28 + ((_c = a.TEC) != null ? _c : 50) * 0.2 + ((_d = a.AWR) != null ? _d : 50) * 0.18;
};
TICK = 0.1;
MAX_T = 5;
MAX_Y = 72;
RADIUS = 1.3;
spdYps = (s) => 6.4 + (s != null ? s : 50) * 0.028;
accel = (a) => 7 + (a != null ? a : 50) * 0.05;
reactS = (awr) => 0.05 + Math.max(0, 80 - (awr != null ? awr : 50)) * 6e-3;

export { geoYAC };
