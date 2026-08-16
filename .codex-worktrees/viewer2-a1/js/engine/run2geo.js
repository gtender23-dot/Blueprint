import { flawLv, flawMult, traitLv, traitMult } from './traits.js';

function driveTo2(d, tx, ty, dt) {
  const dx = tx - d.x, dy = ty - d.y;
  const dist = hyp(dx, dy) || 1e-6;
  const dvx = dx / dist * d.top - d.vx;
  const dvy = dy / dist * d.top - d.vy;
  const dv = hyp(dvx, dvy) || 1e-6;
  const k = Math.min(1, d.acc * 2.2 * dt / dv);
  d.vx += dvx * k;
  d.vy += dvy * k;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}
function steerTo(d, wx, wy, dt) {
  const dvx = wx - d.vx, dvy = wy - d.vy;
  const dv = hyp(dvx, dvy) || 1e-6;
  const k = Math.min(1, d.acc * 2.2 * dt / dv);
  d.vx += dvx * k;
  d.vy += dvy * k;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}
function defaultFinish(carrier, defender) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  const c = carrier.attributes || {}, d = defender.attributes || {};
  const evade = ((_a = c.AGI) != null ? _a : 50) * 0.6 + ((_b = c.SPD) != null ? _b : 50) * 0.4 - (((_c = d.AGI) != null ? _c : 50) * 0.5 + ((_d = d.SPD) != null ? _d : 50) * 0.25 + ((_e = d.AWR) != null ? _e : 50) * 0.25 + 8);
  const truck = ((_g = (_f = c.PWR) != null ? _f : c.STR) != null ? _g : 50) * 0.6 + ((_h = c.STR) != null ? _h : 50) * 0.4 - (((_i = d.STR) != null ? _i : 50) * 0.45 + ((_j = d.PWR) != null ? _j : 50) * 0.35 + ((_k = d.TEC) != null ? _k : 50) * 0.2 + 6);
  const gap = Math.max(evade, truck) - 8;
  const weightOver = Math.max(0, ((_l = carrier.weight) != null ? _l : 210) - 210);
  const broke = Math.random() < Math.max(0, Math.min(0.4, 0.03 + gap * 0.016 + weightOver * 75e-5));
  return { broke, style: broke ? truck > evade ? "truck" : "evade" : null };
}
function runFit(carrier, opts = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const { lane = 0.5, penetrator = null, vision = 0, trace = null } = opts;
  // Subsystem-3 scheme identity, precomputed in sim.js runOutcome (run2geo stays
  // C-free): read = signed LOS-bend sharpener (zone dive/bounce/cutback quality by
  // vision), climb = zone combo-climb boost to blockedP, spillEdge = signed edge
  // leverage (crash spills outside / contain boxes inside), poaClean = gap-scheme
  // POA tighten. All default 0 → identical to pre-fix behavior.
  const scheme = opts.scheme || {};
  const readBend = scheme.read || 0;
  const climbBoost = scheme.climb || 0;
  const spillEdge = scheme.spillEdge || 0;
  const poaClean = scheme.poaClean || 0;
  if (scheme.spillTflShare == null) scheme.spillTflShare = 0.55;
  const secondLevel = (opts.secondLevel || []).filter(Boolean);
  const deepLevel = (opts.deepLevel || []).filter(Boolean);
  const dlPursuit = (opts.dlPursuit || []).filter(Boolean);
  const finish = opts.finish || defaultFinish;
  const ra = carrier.attributes || {};
  const laneX = (Math.random() - 0.5) * 9;
  const laneShift = (lane - 0.6) * (lane < 0.6 ? 0.26 : 0.19);
  const car = { x: laneX * 0.35, y: -3.92 - LANE_RECENTER + laneShift, top: spdYps2(ra.SPD), acc: accel2(ra.AGI), vx: 0, vy: 0 };
  // identity stage 3: Patient Runner — the lane-commit timing term; he lets
  // the hole open instead of pressing it (tiny entry-speed trim)
  const entry = (0.712 + (lane - 0.6) * 0.028 + (Math.random() - 0.5) * 0.18 + Math.min(0.12, Math.max(-0.12, vision * 0.05))) * traitMult(carrier, "patientRunner", -8e-3);
  car.vx = (laneX - car.x) * 0.3;
  car.vy = car.top * entry;
  const chasers = [];
  const add = (c) => {
    chasers.push(c);
    return c;
  };
  if (penetrator) {
    const da = penetrator.attributes || {};
    // Fix C — force/spill. spillEdge > 0 (a CRASHING edge) sets the penetrator to
    // the OUTSIDE of the back with a shorter (spill) angle: he wrong-arms the block
    // and forces the ball to bounce. That is a TRADEOFF — SPILL_TFL_SHARE of these
    // arrive as a stuff-for-loss (sound spill), the rest leak the back outside
    // clean (blown fit → perimeter). spillEdge < 0 (CONTAIN) boxes him inside.
    // Zero (balanced) keeps the original random side, so the mean is unchanged.
    let side;
    let spilled = false;
    if (spillEdge > 0) {
      side = 1;
      spilled = true;
    } else if (spillEdge < 0) {
      side = -1;
    } else {
      side = Math.random() < 0.5 ? -1 : 1;
    }
    const spillLev = Math.abs(spillEdge);
    const soundSpill = spilled && Math.random() < scheme.spillTflShare;
    const blownSpill = spilled && !soundSpill;
    // A SOUND spill: the penetrator knifes flat across the back's face at the mesh
    // — tight to the ball, in front, fast, reacting early → a stop for loss. A
    // BLOWN spill: he over-pursues UPFIELD to the outside and the back cuts back
    // clean behind him → the alley is his. Balanced/contain keep the base setup.
    const pd = add({
      ref: penetrator,
      grp: "PEN",
      x: laneX + side * (2.2 + Math.random() * 3) * (blownSpill ? 1.6 + spillLev * 3 : 1),
      y: -0.6 - Math.random() * 1.8 + (soundSpill ? spillLev * 6 : 0) + (blownSpill ? spillLev * 9 : 0),
      top: dSpd(da.SPD) * 0.95 * (soundSpill ? 1.12 : 1),
      acc: dAcc(da.AGI),
      react: soundSpill ? 0.0 : blownSpill ? 0.5 : 0.08,
      tkl: finishOf2(da),
      burned: 0
    });
    const d0 = hyp(pd.x - car.x, pd.y - car.y) || 1e-6;
    pd.vx = (car.x - pd.x) / d0 * pd.top * 0.68;
    pd.vy = (car.y - pd.y) / d0 * pd.top * 0.68;
  } else if (Math.random() < 0.5 - poaClean) {
    // Fix B (gap identity) — a pulled concept's down-block wall tightens the POA,
    // so the free 2nd-level filler is LESS likely to shoot the point clean
    // (poaClean lowers this probability). Offsets the extra edge exposure the
    // spill creates, keeping the zone-vs-gap pair mean-neutral.
    const src = secondLevel[0] || dlPursuit[0];
    if (src) {
      const da = src.attributes || {};
      add({
        ref: src,
        grp: "PEN",
        x: laneX + (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 2),
        y: -0.2 - Math.random() * 0.9,
        top: dSpd(da.SPD) * 0.93,
        acc: dAcc(da.AGI),
        // identity stage 3: Gap Shooter — shoots the point quicker
        react: 0.15 * traitMult(src, "gapShooter", -0.08),
        tkl: finishOf2(da),
        burned: 0,
        vx: 0,
        vy: -dSpd(da.SPD) * 0.35
      });
    }
  }
  const blockedP = Math.max(0.15, Math.min(0.92, 0.67 + (lane - 0.6) * 0.12 + vision * 0.1));
  let li = 0;
  for (const lb of secondLevel.slice(0, 3)) {
    const da = lb.attributes || {};
    const blocked = Math.random() < (li === 0 ? blockedP - 0.16 : blockedP);
    const spread = li === 0 ? 1.2 : 3;
    // Fix B — zone combo-climb, applied to the PLAYSIDE filler (li===0) as a
    // REPOSITION, not an extra block: a climbed (blocked) LB is driven deeper (the
    // back is already past the first level → benefit) but a free one triggers
    // FASTER because the climbing lineman tipped the fit (→ cost). The blocked/free
    // split is untouched, so the two tails offset and the mean holds.
    const climbHere = li === 0 ? climbBoost : 0;
    add({
      ref: lb,
      grp: "LB",
      x: laneX + (Math.random() - 0.5) * 2 * spread + (blocked ? (Math.random() < 0.5 ? -1 : 1) * 1.8 : 0),
      y: 2.8 + Math.random() * 4.2 + (blocked ? 1.5 + climbHere * 26 : 0),
      top: dSpd(da.SPD) * (blocked ? 0.92 : 0.99),
      acc: dAcc(da.AGI),
      // A free filler still has to READ it through the trash — the run-fit
      // trigger is ~a third of a second even for instinct players (this is
      // where 3-5 yard runs come from; an instant fill would stuff the sport).
      // Wide react/depth variance is the point — the fit is never the same
      // twice, and that spread IS the 1-7 yard band's texture.
      // identity stage 3: Trigger — the downhill fill fires a beat sooner
      react: (blocked ? 0.85 + Math.random() * 0.85 : Math.max(0.05, 0.18 + Math.random() * 0.7 + reactS2(da.AWR) - climbHere * 0.6)) * traitMult(lb, "trigger", -0.03),
      shed: blocked,
      tkl: finishOf2(da),
      burned: 0,
      vx: 0,
      vy: blocked ? 0 : -dSpd(da.SPD) * 0.3
    });
    li++;
  }
  const safeties = deepLevel.filter((d) => String(d.position || "").includes("S"));
  const corners = deepLevel.filter((d) => !safeties.includes(d));
  let bi = 0;
  const stacked = Math.random() < 0.12;
  const thinDeep = Math.random() < 0.02;
  let stackSide = Math.random() - 0.5;
  for (const s of [...safeties, ...corners].slice(0, thinDeep ? 1 : 2)) {
    const da = s.attributes || {};
    add({
      ref: s,
      grp: "DB",
      backstop: !thinDeep,
      // On the blown fit the lone deep man is RECOVERING — displaced to a
      // flank, chasing the man instead of squaring the alley.
      badAngle: thinDeep,
      x: thinDeep ? (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 5) : stacked ? stackSide * (3 + bi * 1.5) : (Math.random() - 0.5) * (6 + bi * 4),
      y: (thinDeep ? 12 : 9.8) + bi * 3.5 + Math.random() * 4.5,
      top: dSpd(da.SPD),
      acc: dAcc(da.AGI),
      vx: 0,
      vy: -dSpd(da.SPD) * 0.3,
      react: 0.3,
      tkl: finishOf2(da) + 6,
      burned: 0
      // open-field pros
    });
    bi++;
  }
  for (const dl of dlPursuit.slice(0, 1)) {
    if (chasers.some((ch) => ch.ref === dl)) continue;
    const da = dl.attributes || {};
    add({
      ref: dl,
      grp: "DL",
      x: (Math.random() - 0.5) * 7,
      y: -0.5 + Math.random() * 1.2,
      top: dSpd(da.SPD) * 0.85,
      acc: dAcc(da.AGI) * 0.85,
      vx: 0,
      vy: 0,
      react: 1.3 + Math.random() * 0.9,
      tkl: finishOf2(da),
      burned: 0
    });
  }
  if (!chasers.length) {
    return {
      yards: Math.min(MAX_Y2, Math.round(8 + Math.random() * 14)),
      tacklerId: null,
      assistId: null,
      tflId: null,
      brokenById: null,
      btStyle: null,
      breakaway: true
    };
  }
  let tackler = null, assist = null, cavalry = false;
  let brokenById = null, btStyle = null, contactY = null, brokenCount = 0;
  let clearedDeep = false;
  for (let t = 0; t < MAX_T2 && car.y < MAX_Y2 && !tackler; t += TICK2) {
    if (t >= 1.2 && car.y > 9) {
      const threats = chasers.filter((c) => !(c.burned > 0 || c.y < car.y - 0.5 && (c.top < car.top - 0.15 || c.y < car.y - 7)));
      if (threats.length <= 1) {
        clearedDeep = true;
        const clear = threats.length === 0;
        car.y = Math.min(MAX_Y2, car.y + (clear ? 26 + Math.random() * 42 : 14 + Math.random() * 24));
        break;
      }
    }
    if (!cavalry && t >= (thinDeep ? 2.3 : 1.5)) {
      cavalry = true;
      const dbs = deepLevel.filter((d) => !chasers.some((ch) => ch.ref === d));
      const lbs = secondLevel.filter((d) => !chasers.some((ch) => ch.ref === d));
      const pool = [dbs[0], lbs[0], dbs[1], lbs[1]].filter(Boolean);
      for (let ci = 0; ci < 2 && ci < pool.length; ci++) {
        const da = pool[ci].attributes || {};
        add({
          ref: pool[ci],
          grp: "CAV",
          cavalry: true,
          // Deep pursuit rallies from the DEFENSE'S SPINE, not from wherever
          // the carrier happens to be — a back who bounced to the sideline
          // has earned the long angle, and long angles are where the house
          // calls live.
          x: (ci ? -1 : 1) * (2 + Math.random() * 6),
          y: clearedDeep ? car.y - 1 - Math.random() * 2 : 15 + Math.random() * 8,
          // real depth — a man already past it has won the race
          top: dSpd(da.SPD) * 0.95,
          acc: dAcc(da.AGI),
          // been running all play
          badAngle: Math.random() < 0.14,
          // the film's long-TD reel
          vx: 0,
          vy: -dSpd(da.SPD) * 0.4,
          react: 0.12,
          tkl: finishOf2(da),
          burned: 0
        });
      }
    }
    if (cavalry !== "done" && cavalry && t >= 2.6) {
      cavalry = "done";
      const used = new Set(chasers.map((c) => c.ref));
      const src = [...deepLevel, ...secondLevel, ...dlPursuit].find((d) => !used.has(d)) || deepLevel[0];
      if (src) {
        const da = src.attributes || {};
        add({
          ref: src,
          grp: "CAV",
          cavalry: true,
          x: car.x + (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4),
          y: car.y - 2 - Math.random() * 3,
          // a true tail chase — the last angle is behind him
          top: dSpd(da.SPD) * 1.02,
          acc: dAcc(da.AGI),
          vx: 0,
          vy: -dSpd(da.SPD) * 0.45,
          react: 0,
          tkl: finishOf2(da),
          burned: 0
        });
      }
    }
    const v = hyp(car.vx, car.vy) || 1e-6;
    // identity stage 3: Home-Run Threat / Dancer — once he clears the traffic
    // the breakaway gear is a shade higher (Dancer's house-call tail rides
    // the same term: the bounce that works goes the distance)
    const cap = clearedDeep ? car.top * (1 + 6e-3 * Math.max(traitLv(carrier, "homeRunThreat"), flawLv(carrier, "dancer"))) : Math.min(car.top, 8.05);
    const want = Math.min(cap, v + car.acc * TICK2);
    if (car.y < 0.5) {
      let tx = laneX;
      const seeR = Math.max(3.6, Math.min(6.5, 4.5 + (((_a = ra.AWR) != null ? _a : 50) - 41) * 0.03));
      let nearest = null, nd = seeR;
      for (const d of chasers) {
        if (d.burned > 0 || d.backstop || d.y < 0.3) continue;
        const dist = hyp(d.x - laneX, d.y - 1.5);
        if (dist < nd) {
          nd = dist;
          nearest = d;
        }
      }
      if (nearest) {
        // Fix A — the dive/bounce/cutback read. readBend (signed, precomputed in
        // sim.js from carrier vision relative to the pool mean, zero for an
        // average back) sharpens the cut for a back who reads the front and dulls
        // it for one who doesn't. Applied as a multiplier on the existing bend, so
        // the mean back is unchanged — pure YPC variance by vision, not a lift.
        // identity stage 3: One-Cut plants-and-goes (sharper cut); Dancer is
        // the same term reversed — he bounces everything (two-sided: worse
        // cut here, but see the breakaway note below for his house-call tail)
        const readMult = 1 + readBend + 0.015 * traitLv(carrier, "oneCut") - 0.02 * flawLv(carrier, "dancer");
        const bend = Math.max(0.5, Math.min(
          1.4,
          0.7 + (((_b = ra.AWR) != null ? _b : 50) - 41) * 4e-3 + (((_c = ra.AGI) != null ? _c : 50) - 50) * 4e-3
        )) * (seeR - nd) / seeR * readMult;
        tx += (laneX >= nearest.x ? 1 : -1) * bend * 1.4;
      }
      const ty = 2.5;
      const dx = tx - car.x, dy = ty - car.y;
      const dn = hyp(dx, dy) || 1e-6;
      car.vx = dx / dn * want;
      car.vy = dy / dn * want;
    } else {
      const leanNow = car.vx * 0.88;
      const norm = hyp(leanNow, cap) || 1e-6;
      car.vx = leanNow / norm * want;
      car.vy = cap / norm * want;
    }
    let threat = null, td = 3.2;
    for (const d of chasers) {
      if (d.burned > 0) continue;
      if (car.y < 0.5 && d.grp === "PEN") continue;
      const dx = d.x - car.x, dy = d.y - car.y;
      if (dy < -0.6) continue;
      const dist = hyp(dx, dy);
      if (dist < td) {
        td = dist;
        threat = d;
      }
    }
    if (threat && car.y > -1) {
      car.vx += (car.x >= threat.x ? 1 : -1) * car.top * 0.35 * TICK2 * (3.2 - td);
      car.vx *= 0.985;
      car.vy *= 0.94;
    }
    car.x += car.vx * TICK2;
    car.y += car.vy * TICK2;
    if (trace) trace.push({
      t: +t.toFixed(1),
      car: [+car.x.toFixed(1), +car.y.toFixed(1)],
      ch: chasers.map((c) => [+c.x.toFixed(1), +c.y.toFixed(1), c.burned > 0 ? "B" : c.grp])
    });
    if (Math.abs(car.x) > 12.5) break;
    if (!clearedDeep && car.y > 6 && (Math.round(t * 10) & 1) === 0 && !chasers.some((c) => c.burned <= 0 && c.y > car.y - 1 && (c.x - car.x) * (c.x - car.x) + (c.y - car.y) * (c.y - car.y) < 64)) clearedDeep = true;
    if (cavalry === "done" && car.y > 4 && chasers.every((c) => c.burned > 0 || c.y < car.y - 2.5 && c.top < car.top + 0.2)) {
      clearedDeep = true;
      car.y = Math.min(MAX_Y2, car.y + 22 + Math.random() * 26);
      break;
    }
    for (const d of chasers) {
      if (d.burned > 0) {
        d.burned -= TICK2;
        continue;
      }
      if (t < d.react) {
        d.x += d.vx * TICK2;
        d.y += d.vy * TICK2;
        continue;
      }
      if (d.shed && car.y > 9) continue;
      const gx = car.x - d.x, gy = car.y - d.y;
      const gap0 = hyp(gx, gy) || 1e-6;
      const closing = Math.max(2, -(((car.vx - d.vx) * gx + (car.vy - d.vy) * gy) / gap0));
      const lead = Math.min(0.6, gap0 / closing);
      if (d.backstop && gap0 > 3.5) {
        const cush = 3.15 + Math.max(0, car.top - 7) * 1;
        const wy = d.y > car.y + cush ? -d.top * 0.28 : Math.min(0, car.vy) * 0.9;
        const wx = Math.max(-d.top * 0.85, Math.min(d.top * 0.85, (car.x + car.vx * 0.3 - d.x) * 1.6));
        steerTo(d, wx, wy, TICK2);
      } else if (d.badAngle) driveTo2(d, car.x, car.y, TICK2);
      else driveTo2(d, car.x + car.vx * lead, car.y + car.vy * lead, TICK2);
      const gap = hyp(d.x - car.x, d.y - car.y);
      const reach = RADIUS2 + Math.min(0.9, closing * 0.05);
      if (gap < reach) {
        const cs = hyp(car.vx, car.vy) || 1e-6;
        const ds = hyp(d.vx, d.vy) || 1e-6;
        const cross = Math.abs(car.vx * d.vy - car.vy * d.vx) / (cs * ds);
        const qFloor = d.backstop || d.cavalry ? 0.7 : d.grp === "PEN" ? 0.4 : 0.55;
        const qCap = d.grp === "PEN" ? 0.6 : 1;
        const attemptQ = Math.max(qFloor, Math.min(qCap, 1.05 - cross * (cs / car.top) * 0.75));
        if (Math.random() > attemptQ) {
          if (trace) trace.push({ dive: d.grp, gap: +gap.toFixed(2), q: +attemptQ.toFixed(2) });
          d.burned = 0.55;
          car.vx *= 0.94;
          car.vy *= 0.94;
          continue;
        }
        const res = brokenCount >= 2 ? { broke: false, style: null } : finish(carrier, d.ref);
        if (trace) trace.push({ finish: d.grp, broke: !!res.broke, gap: +gap.toFixed(2) });
        if (!res.broke) {
          tackler = d;
          contactY = car.y;
          if (car.y > 1.2) {
            const drag = Math.random() < 0.42 ? 0.12 : 0.6 + Math.random() * 1;
            car.y += Math.min(2.6, Math.max(0, car.vy - 1.6) * 0.155 * drag) * Math.max(0.35, Math.min(1, car.y / 2.5));
          }
          let best = null, bd = 1e9;
          for (const o of chasers) {
            if (o === d || o.burned > 0) continue;
            const od = hyp(o.x - car.x, o.y - car.y);
            if (od < 2.4 && od < bd) {
              bd = od;
              best = o;
            }
          }
          if (best && Math.random() < 0.5) assist = best;
          break;
        }
        if (!brokenById) {
          brokenById = d.ref.id;
          btStyle = res.style || null;
        }
        brokenCount++;
        d.burned = 1.2;
        car.vx *= 0.4;
        car.vy *= 0.4;
      }
    }
  }
  const yards = Math.max(MIN_Y, Math.min(MAX_Y2, Math.round(car.y)));
  const isTFL = tackler != null && (yards < 0 || yards === 0 && (contactY != null ? contactY : 1) < 0.5 && Math.random() < 0.35);
  return {
    yards,
    tacklerId: (_e = (_d = tackler == null ? void 0 : tackler.ref) == null ? void 0 : _d.id) != null ? _e : null,
    assistId: (_g = (_f = assist == null ? void 0 : assist.ref) == null ? void 0 : _f.id) != null ? _g : null,
    tflId: isTFL ? tackler.ref.id : null,
    brokenById,
    btStyle,
    breakaway: !tackler && clearedDeep && yards >= 18
  };
}
var finishOf2, TICK2, MAX_T2, MAX_Y2, MIN_Y, RADIUS2, LANE_RECENTER, hyp, spdYps2, accel2, dSpd, dAcc, reactS2;

finishOf2 = (a) => {
  var _a, _b, _c, _d;
  return ((_a = a.STR) != null ? _a : 50) * 0.34 + ((_b = a.PWR) != null ? _b : 50) * 0.28 + ((_c = a.TEC) != null ? _c : 50) * 0.2 + ((_d = a.AWR) != null ? _d : 50) * 0.18;
};
TICK2 = 0.1;
MAX_T2 = 7;
MAX_Y2 = 100;
MIN_Y = -6;
RADIUS2 = 1.25;
LANE_RECENTER = 0.16;
hyp = (x, y) => Math.sqrt(x * x + y * y);
spdYps2 = (s) => 6.4 + (s != null ? s : 50) * 0.028;
accel2 = (a) => 7 + (a != null ? a : 50) * 0.05;
dSpd = (s) => spdYps2(50 + ((s != null ? s : 50) - 50) * 0.35);
dAcc = (a) => accel2(50 + ((a != null ? a : 50) - 50) * 0.35);
reactS2 = (awr) => 0.06 + Math.max(0, 74 - (awr != null ? awr : 50)) * 18e-4;

export { runFit };
