import { flawLv, traitLv, traitMult } from './traits.js';

function qinterp(m, x) {
  const dq = m.dq, sq = m.sq;
  if (x <= dq[0]) return sq[0];
  const n = dq.length;
  if (x >= dq[n - 1]) return sq[n - 1];
  let i = 1;
  while (dq[i] < x) i++;
  const w = (x - dq[i - 1]) / (dq[i] - dq[i - 1] || 1e-9);
  return sq[i - 1] + w * (sq[i] - sq[i - 1]);
}
function steer(d, wx, wy, dt) {
  const dvx = wx - d.vx, dvy = wy - d.vy;
  const dv = Math.sqrt(dvx * dvx + dvy * dvy) || 1e-6;
  const k = Math.min(1, d.acc * 2.4 * dt / dv);
  d.vx += dvx * k;
  d.vy += dvy * k;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}
function routeDuel(receiver, defender, passDepth, coverageType, pressHot = false, trace = null, scheme = null) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  if (!defender) return coverageType === "zone" ? 0.84 : 1;
  const ra = receiver.attributes || {}, da = defender.attributes || {};
  const R = ROUTES[passDepth] || ROUTES.medium;
  // ── Fix A (leverage geometry) ──────────────────────────────────────────
  // A defender plays a side: inside leverage (lev=-1) takes away in-breakers
  // and concedes out; outside leverage (lev=+1) the reverse. He aligns to
  // He leans to that side, so his recovery on the BREAK depends on which way
  // the route goes: a break AWAY from his leverage catches him leaning wrong
  // (his reaction to the break is LATE → MORE separation); a break INTO it
  // finds him already sitting on it (reaction EARLY → LESS). We model this as
  // a signed nudge to the break reaction (`levBias`), which scales the exact
  // mechanic that already turns a late break-reaction into separation — so it
  // behaves the same across press/off/man. scheme.attack is the called break
  // vs the leverage: +1 away, -1 into, 0 unknown. When attack is 0 (the live-
  // play default) OR no leverage is supplied OR __noLeverage, levBias is 0 and
  // the duel is behavior-identical to baseline — the frozen sep_probe buckets
  // stay pinned and stat_realism is unmoved. Directional, not a scalar add.
  const lev = scheme && !globalThis.__noLeverage && Number.isFinite(scheme.leverage) ? Math.max(-1, Math.min(1, scheme.leverage)) : 0;
  const attack = lev !== 0 && scheme && Number.isFinite(scheme.attack) ? Math.max(-1, Math.min(1, scheme.attack)) : 0;
  const levBias = attack * 0.05;
  // ── Fix B (route individuation + double moves) ─────────────────────────────
  // A route has a SHAPE, not just a depth. A 90° break (in/out/comeback) sinks
  // the hips: it separates SHARPLY at the cut but bleeds speed out of it. A 45°
  // speed-cut (slant/post/corner) keeps velocity but rounds off, so the window
  // is softer. A DOUBLE move (stutter, stop-go, sluggo) sells a first break; a
  // defender who bites recovers late on the real one — bigger the better the
  // receiver's TEC over the defender's AWR (a disciplined DB doesn't bite).
  // These are keyed on scheme.route.{shape,dbl}; when absent (or __noRoute),
  // every modifier is its neutral identity and the duel is behavior-identical
  // to baseline, so the frozen sep_probe buckets stay pinned. `keepAdj` shifts
  // the break's velocity-retention, `spdAfter` the post-break top speed,
  // `dblLag` the extra defender reaction when he's been double-moved.
  const rt = scheme && !globalThis.__noRoute && scheme.route ? scheme.route : null;
  const shape = rt && typeof rt.shape === "string" ? rt.shape : "";
  // A SHARP plant (90°) is hard to mirror — the defender's reaction to the
  // break is later (breakLag+), which is where separation actually comes from —
  // but the receiver sinks his hips and bleeds downfield speed (spdAfter<1). A
  // SPEED cut (45°) is easy to mirror (no reaction penalty) but the receiver
  // keeps his velocity (keepAdj+). Neutral when no shape supplied.
  let keepAdj = 0, spdAfter = 1, breakLag = 0, dblLag = 0;
  if (shape === "sharp") { breakLag = 0.055; spdAfter = 0.95; }
  else if (shape === "speed") { keepAdj = 0.04; breakLag = -0.05; }
  if (rt && rt.dbl) {
    const rTec = ra.TEC != null ? ra.TEC : 50, dAwr = da.AWR != null ? da.AWR : 50;
    // identity stage 3: Double-Move Artist — the sluggo is HIS play; Bites
    // Hard (flaw) and Gambler's jump-it habit are the victims of the fake
    dblLag = Math.max(0, Math.min(0.26, 0.11 + (rTec - dAwr) * 3e-3 + 0.015 * traitLv(receiver, "doubleMove") + 0.02 * flawLv(defender, "bitesHard") + 0.012 * flawLv(defender, "gambler")));
  }
  const breakDir = Math.random() < 0.5 ? -1 : 1;
  const breakLat = passDepth === "deep" ? breakDir * 0.8 : breakDir * (3 + Math.random() * 0.2);
  // identity stage 3: Route Technician — the cut-quality term is his craft
  const cutQ = (1 + (((_a = ra.TEC) != null ? _a : 50) - 50) * 45e-4 + (((_b = ra.AGI) != null ? _b : 50) - 50) * 32e-4) * traitMult(receiver, "routeTech", 8e-3);
  const rec = { x: 0, y: 0, vx: 0, vy: 0, top: spd(ra.SPD), acc: acc(ra.AGI) };
  const sell = Math.max(-0.2, Math.min(0.2, (((_c = ra.TEC) != null ? _c : 50) - ((_d = da.TEC) != null ? _d : 50)) * 4e-3));
  const def = {
    x: 0.15 * (Math.random() < 0.5 ? -1 : 1),
    y: 0,
    vx: 0,
    vy: 0,
    top: spd(da.SPD),
    acc: acc(da.AGI),
    // identity stage 3: Sticky — the man-mirror reaction, a touch earlier
    react: Math.max(0.02, rctMan(da.AWR) + sell + levBias - 0.012 * traitLv(defender, "sticky")),
    lag: 0
  };
  let recDelay = 0;
  if (coverageType === "press") {
    // identity stage 3: Press Jam (defender) vs Release Artist (receiver) —
    // the two sides of the same line-of-scrimmage contest
    const jam = (((_e = da.STR) != null ? _e : 50) * 0.4 + ((_f = da.TEC) != null ? _f : 50) * 0.35 + ((_g = da.AGI) != null ? _g : 50) * 0.25 + 1) * traitMult(defender, "pressJam", 0.015);
    const release = (((_h = ra.AGI) != null ? _h : 50) * 0.4 + ((_i = ra.TEC) != null ? _i : 50) * 0.35 + ((_j = ra.STR) != null ? _j : 50) * 0.25) * traitMult(receiver, "releaseArtist", 0.015);
    const jamGap = (jam - release) * (pressHot ? 1.08 : 1);
    if (jamGap >= 0) {
      recDelay = Math.min(0.42, 0.14 + jamGap * 75e-4);
      def.lag = recDelay;
      rec.acc *= Math.max(0.55, 1 - jamGap * 85e-4);
    } else {
      def.lag = Math.min(0.38, 0.1 - jamGap * 65e-4);
    }
    def.y = 0.8;
  } else if (coverageType === "offman") {
    def.y = 6.2;
    def.vy = -1.2;
  } else if (coverageType === "zone") {
    def.y = passDepth === "short" ? 4.5 : passDepth === "medium" ? 11 : 17.5;
    def.x = (Math.random() - 0.5) * 1.1;
    def.zone = true;
    def.trigger = Math.max(0.02, rctZone(da.AWR) + levBias);
  } else {
    // Tight-man fallback — only reached for a coverageType that isn't
    // press/offman/zone; callers pass exactly those three today, so this is a
    // guard, not a live branch. Give a "man" type its own key before relying on it.
    def.y = 1.6;
  }
  let broke = false;
  for (let t = 0; t < R.throwT; t += TICK3) {
    if (t >= recDelay) {
      if (!broke && t >= R.breakT) {
        broke = true;
        if (passDepth !== "deep") {
          const v0 = Math.sqrt(rec.vx * rec.vx + rec.vy * rec.vy);
          const keep = Math.max(0.3, Math.min(keepAdj > 0 ? 0.78 : 0.72, 0.42 + (cutQ - 1) * 1.6 + keepAdj));
          const bx = breakLat > 0 ? 1 : -1, by = 0.2;
          const bn = Math.sqrt(1 + by * by);
          rec.vx = bx / bn * v0 * keep;
          rec.vy = by / bn * v0 * keep;
        }
        if (spdAfter !== 1) rec.top *= spdAfter;
      }
      const tx = broke ? breakLat * 2 : 0;
      const ty = broke && passDepth !== "deep" ? R.stemY + 1.5 : R.stemY + 30;
      const dx = tx - rec.x, dy = ty - rec.y;
      const dn = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      steer(rec, dx / dn * rec.top, dy / dn * rec.top, TICK3);
    }
    if (def.zone) {
      if (!def.armed && (broke || passDepth === "deep" && rec.y > def.y - 1.5)) {
        def.armed = true;
        def.lag = Math.max(0.02, def.trigger + dblLag + breakLag);
      }
      if (!def.armed) {
        const shadeX = Math.max(-2.2, Math.min(2.2, rec.x + rec.vx * 0.15 - def.x));
        steer(def, shadeX * 1.4, 0, TICK3);
      }
      if (def.armed) {
        const drive = def.lag >= TICK3 ? 0 : (TICK3 - Math.max(0, def.lag)) / TICK3;
        def.lag -= TICK3;
        if (drive > 0) {
          const dx = rec.x - def.x, dy = rec.y - def.y;
          const dn = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          const thr = Math.min(1, dn / 1.1);
          steer(def, dx / dn * def.top * thr, dy / dn * def.top * thr, TICK3 * drive);
        }
      }
    } else {
      if (broke && !def.reacted) {
        def.reacted = true;
        def.lag += def.react + dblLag + breakLag;
      }
      if (def.lag > 0) {
        const coast = Math.min(def.lag, TICK3);
        def.lag -= TICK3;
        def.x += def.vx * coast;
        def.y += def.vy * coast;
        if (def.lag <= 0 && broke) {
          const v0 = Math.sqrt(def.vx * def.vx + def.vy * def.vy);
          const keep = Math.max(0.3, Math.min(0.7, 0.38 + (((_k = da.AGI) != null ? _k : 50) - 50) * 4e-3));
          const dx0 = rec.x - def.x, dy0 = rec.y - def.y;
          const dn0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1e-6;
          def.vx = dx0 / dn0 * v0 * keep;
          def.vy = dy0 / dn0 * v0 * keep;
        }
      } else {
        const dx = rec.x - def.x, dy = rec.y - def.y;
        const dn = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        steer(def, dx / dn * def.top, dy / dn * def.top, TICK3);
      }
    }
    const rv = Math.sqrt(rec.vx * rec.vx + rec.vy * rec.vy);
    if (rv > rec.top) {
      rec.vx *= rec.top / rv;
      rec.vy *= rec.top / rv;
    }
  }
  const dist = Math.sqrt((rec.x - def.x) ** 2 + (rec.y - def.y) ** 2);
  if (trace) trace.dist = dist;
  const m = QMAP[`${passDepth}/${coverageType}`] || QMAP["medium/zone"];
  let sep = qsep(m, dist);
  // ── DEEP-ZONE AWR (2026-08-14, RESIZED 2026-08-21) ────────────────────────
  // The duel's DEEP arming is positional — the defender triggers when the
  // receiver reaches his depth — which washes his eyes out down the field and
  // leaves raw separation INVERTED in awareness: measured on 40k duels per
  // point, a deep zone defender at AWR 20 gave up 0.161 and at AWR 99 gave up
  // 0.689. A heady deep safety was worse than a raw one, in a straight line.
  // Short and medium zones read AWR correctly through the reaction trigger, so
  // this touches deep only: a direct, MEAN-NEUTRAL awareness term, exactly 0 at
  // AWR 50, so the average defender is unchanged and only the SPREAD moves.
  //
  // The 2026-08-14 coefficient (0.0019) was the right idea at roughly a fifth
  // of the size it needed to be. It bent the curve by about 0.15 across the
  // AWR range against a raw inversion of 0.53, so the net still ran the wrong
  // way — 20→0.218 up to 99→0.596 — and `coverage_monotonicity_check` reported
  // "HELPS THE RECEIVER (INVERTED)" on every run for seven months.
  //
  // 0.0103 is derived, not guessed: it is the value that gives deep zone the
  // SAME awareness slope medium zone already has (-0.00362 vs -0.00365), so
  // the two depths finally price a defender's eyes the same way.
  //
  // HONEST LIMIT: this corrects the direction and the slope, not the mechanism.
  // The positional arming is still what makes deep coverage read awareness
  // badly, and the middle of the curve stays bumpy (AWR 80 sits slightly above
  // AWR 60). Fixing the arming is the real repair; this makes the football
  // right while that waits.
  if (coverageType === "zone" && passDepth === "deep") {
    sep -= (((da.AWR != null ? da.AWR : 50) - 50)) * 0.0103;
  }
  return Math.max(0, Math.min(1, sep));
}
var TICK3, spd, acc, rctMan, rctZone, ROUTES, QMAP, SEP_RECENTER, qsep;

TICK3 = 0.1;
spd = (s) => 6.4 + (s != null ? s : 50) * 0.028;
acc = (a) => 7 + (a != null ? a : 50) * 0.05;
rctMan = (awr) => 0.12 + Math.max(0, 78 - (awr != null ? awr : 50)) * 16e-4;
rctZone = (awr) => 0.07 + Math.max(0, 88 - (awr != null ? awr : 50)) * 15e-4;
ROUTES = {
  short: { stemY: 5, throwT: 1.6, breakT: 1.05 },
  medium: { stemY: 12, throwT: 2.4, breakT: 1.85 },
  deep: { stemY: 26, throwT: 3, breakT: 2.45 }
  // the go: break = subtle stem lean
};
QMAP = {
  "deep/offman": { dq: [2.9332, 3.8729, 4.1689, 4.4015, 4.5029, 4.6803, 4.8036, 4.9172, 5.0029, 5.1084, 5.2433, 5.3499, 5.4433, 5.4898, 5.603, 5.6899, 5.8065, 5.9159, 6.0045, 6.1081, 6.1787, 6.3367, 6.4921, 6.6871, 7.5093], sq: [0.1662, 0.2744, 0.3117, 0.3328, 0.3548, 0.3734, 0.3919, 0.3993, 0.4096, 0.4218, 0.433, 0.4447, 0.4548, 0.4605, 0.4732, 0.4795, 0.4918, 0.5007, 0.5116, 0.5205, 0.5321, 0.5451, 0.5596, 0.6022, 0.6786] },
  "deep/press": { dq: [0.233, 0.4141, 0.6459, 0.7601, 0.8545, 0.9232, 1.0335, 1.1281, 1.2572, 1.3143, 1.4028, 1.4743, 1.5138, 1.6003, 1.7052, 1.7599, 1.8241, 1.8579, 2.007, 2.151, 2.2842, 2.4289, 2.7612, 3.0895, 4.0617], sq: [0.2701, 0.368, 0.4008, 0.4303, 0.4499, 0.4715, 0.4874, 0.4961, 0.5055, 0.5138, 0.5188, 0.5326, 0.5434, 0.5621, 0.5723, 0.5803, 0.5945, 0.6017, 0.6047, 0.6178, 0.6311, 0.6497, 0.6644, 0.6985, 0.8261] },
  "deep/zone": { dq: [0.575, 0.7683, 0.8086, 0.8626, 0.8951, 0.9253, 0.9497, 0.9868, 1.02, 1.0717, 1.1184, 1.1585, 1.1877, 1.2261, 1.25, 1.2892, 1.3102, 1.3249, 1.3633, 1.3886, 1.4048, 1.4366, 1.4694, 1.5312, 1.7162], sq: [0.1165, 0.1926, 0.2134, 0.2423, 0.2652, 0.2766, 0.2848, 0.294, 0.3076, 0.3203, 0.3381, 0.3449, 0.3572, 0.3729, 0.3802, 0.3999, 0.4068, 0.4228, 0.4392, 0.4557, 0.4797, 0.5051, 0.5208, 0.5539, 0.6737] },
  "medium/offman": { dq: [1.8658, 2.2084, 2.3643, 2.4702, 2.5568, 2.6168, 2.6801, 2.7145, 2.7485, 2.7838, 2.8209, 2.8605, 2.8981, 2.9436, 3.0043, 3.0508, 3.1094, 3.1508, 3.1984, 3.2495, 3.3132, 3.3834, 3.4892, 3.6122, 3.8473], sq: [0.2681, 0.3389, 0.3611, 0.3918, 0.4037, 0.4203, 0.4348, 0.4432, 0.4527, 0.4611, 0.4692, 0.4826, 0.4875, 0.497, 0.5078, 0.515, 0.5258, 0.5367, 0.5468, 0.5659, 0.5781, 0.5944, 0.6214, 0.6576, 0.6913] },
  "medium/press": { dq: [0.5126, 0.6821, 0.767, 0.8102, 0.8861, 0.9328, 0.9921, 1.1084, 1.1955, 1.2604, 1.3603, 1.4144, 1.4666, 1.5186, 1.5395, 1.5916, 1.6406, 1.6929, 1.716, 1.7565, 1.786, 1.8481, 1.908, 2.5769, 3.0254], sq: [0.2678, 0.3192, 0.3491, 0.384, 0.393, 0.4168, 0.4303, 0.4383, 0.4478, 0.454, 0.4637, 0.4746, 0.4803, 0.4901, 0.5048, 0.5109, 0.521, 0.5333, 0.5475, 0.5561, 0.5712, 0.5952, 0.6201, 0.6524, 0.7169] },
  "medium/zone": { dq: [1.591, 1.822, 1.9699, 2.0244, 2.0801, 2.1525, 2.2142, 2.2445, 2.2711, 2.3047, 2.328, 2.3508, 2.3794, 2.3977, 2.4495, 2.484, 2.5382, 2.5782, 2.6159, 2.692, 2.7499, 2.777, 2.8813, 2.9333, 3.1961], sq: [0.1805, 0.2578, 0.2755, 0.3009, 0.326, 0.351, 0.3628, 0.3772, 0.3937, 0.4044, 0.4178, 0.4332, 0.4439, 0.4617, 0.4696, 0.4835, 0.4955, 0.5145, 0.538, 0.5542, 0.574, 0.5881, 0.6157, 0.6662, 0.8013] },
  "short/offman": { dq: [1.8692, 2.2656, 2.4016, 2.4933, 2.5593, 2.6029, 2.6642, 2.7139, 2.7557, 2.8043, 2.8508, 2.9145, 2.9648, 3.0094, 3.052, 3.1085, 3.163, 3.2185, 3.2617, 3.3214, 3.3988, 3.4952, 3.6158, 3.811, 4.1854], sq: [0.3247, 0.413, 0.4368, 0.4519, 0.475, 0.4912, 0.5057, 0.5162, 0.5255, 0.5363, 0.5424, 0.5467, 0.5532, 0.5618, 0.5708, 0.5815, 0.5877, 0.5991, 0.6153, 0.6285, 0.6379, 0.6616, 0.6817, 0.7185, 0.7733] },
  "short/press": { dq: [0.4501, 0.7088, 0.7731, 0.8376, 0.8836, 0.9701, 1.0486, 1.1225, 1.1724, 1.2691, 1.366, 1.3951, 1.4484, 1.4875, 1.5373, 1.5953, 1.6222, 1.654, 1.6893, 1.7278, 1.7892, 1.8406, 2.0401, 2.6936, 3.039], sq: [0.1595, 0.2376, 0.2781, 0.2984, 0.3304, 0.3513, 0.3599, 0.3761, 0.3879, 0.3972, 0.4096, 0.4224, 0.4285, 0.4436, 0.455, 0.4651, 0.4752, 0.4848, 0.5008, 0.5159, 0.5415, 0.5779, 0.5878, 0.6263, 0.7114] },
  "short/zone": { dq: [1.734, 2.0786, 2.2013, 2.2528, 2.2927, 2.3262, 2.3555, 2.3884, 2.4276, 2.4607, 2.4899, 2.5235, 2.5636, 2.5933, 2.6226, 2.6551, 2.6877, 2.7189, 2.7483, 2.784, 2.8258, 2.8701, 2.9193, 3.0157, 3.1157], sq: [0.162, 0.2512, 0.2897, 0.3381, 0.3605, 0.3758, 0.3926, 0.4121, 0.4254, 0.4386, 0.449, 0.4587, 0.4753, 0.4893, 0.5043, 0.5107, 0.5244, 0.5375, 0.5525, 0.573, 0.5951, 0.6163, 0.6519, 0.6989, 0.7836] }
};
SEP_RECENTER = 0.015;
qsep = (m, x, extra = 0) => Math.max(0, Math.min(1, qinterp(m, x) + SEP_RECENTER + extra));

export { routeDuel };
