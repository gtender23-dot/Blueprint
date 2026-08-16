import { __spreadProps, __spreadValues } from '../_spread.js';

// Act B / B1: presentation-only analysis of facts already stamped by the sim.
// Raw trace values never reach the UI; the broadcast explains football without
// exposing coefficients or recomputing an outcome.
function buildBroadcastCommentary(p, names = {}) {
  if (!p || typeof p !== "object") return { kicker: "FILM NOTE", title: "Awaiting the snap", detail: "" };
  const type = String(p.type || "");
  const tr = p.trace && typeof p.trace === "object" ? p.trace : {};
  const player = (id, fallback) => id && names[id] && names[id].name ? names[id].name : fallback;
  const concept = p.concept || (type.startsWith("pass") ? "The pass concept" : type.startsWith("run") ? "The run concept" : "The call");
  if (p.sack) return {
    kicker: "PASS RUSH",
    title: `${player(p.sackerId || p.sackerId2, "The rush")} wins the pocket`,
    detail: p.blitzFired ? "Extra pressure gets home before the route can develop." : "The front wins without needing an extra rusher."
  };
  if (type.startsWith("pass")) {
    if (p.turnover && p.turnoverType === "interception") return {
      kicker: tr.rob ? "ROBBER" : tr.dbl ? "BRACKET" : "COVERAGE",
      title: tr.rob ? "The underneath help jumps the throwing lane" : tr.dbl ? "Two defenders squeeze the target" : "The defense closes the window",
      detail: p.fooled && p.shownCoverage ? `The shell showed ${p.shownCoverage}, then changed after the snap.` : `${player(p.intPickerId, "The defender")} finishes the takeaway.`
    };
    if (p.fooled && p.shownCoverage) return {
      kicker: "DISGUISE",
      title: `${p.shownCoverage} was only the pre-snap picture`,
      detail: `${p.coverage || "The coverage"} rotated in after the snap and changed the quarterback's read.`
    };
    if (tr.bust || tr.vd) return { kicker: "COVERAGE VOID", title: `${concept} finds the open grass`, detail: "The recorded coverage assignment leaves a window, and the offense attacks it." };
    if (tr.dbl) return { kicker: "BRACKET", title: "The target draws help over the top", detail: p.complete ? "The throw still beats the squeeze." : "The bracket takes away the clean window." };
    if (tr.rob) return { kicker: "ROBBER", title: "A safety drives underneath the route", detail: p.complete ? "The ball arrives before the help can finish the break." : "The extra defender muddies the throwing lane." };
    if (p.pressure || p.hurry) return { kicker: "PRESSURE", title: "The quarterback has to speed up the clock", detail: p.complete ? "The throw survives a compressed pocket." : "The rush keeps the concept from finishing cleanly." };
    if (p.complete) return {
      kicker: (p.yac || 0) > 5 ? "AFTER THE CATCH" : "THROWING WINDOW",
      title: (p.yac || 0) > 5 ? `${player(p.receiverId, "The receiver")} turns the catch into more` : `${concept} creates a clean answer`,
      detail: tr.sep != null && tr.sep < 0.28 ? "The catch is secured through tight coverage." : "The route and timing create separation at the catch point."
    };
    return {
      kicker: p.contested ? "CONTESTED" : "COVERAGE",
      title: p.contested ? "The defender stays attached through the catch point" : "The window closes before the ball arrives",
      detail: p.pbuId ? `${player(p.pbuId, "The cover man")} gets a hand through at the catch point.` : `${concept} does not find a clean finish.`
    };
  }
  if (type.startsWith("run") || p.isScramble) {
    const gap = p.runGap ? ` through the ${p.runGap}` : "";
    if (p.brokenByCarrier || p.btStyle) return { kicker: "FINISH", title: `${player(p.rusherId, "The runner")} defeats first contact`, detail: `The run${gap} stays alive after the recorded missed tackle.` };
    if ((p.yards || 0) <= 0) return { kicker: "RUN FIT", title: `The defense closes${gap || " the point of attack"}`, detail: "The front and pursuit arrive before the runner can press the crease." };
    return { kicker: p.isScramble ? "SCRAMBLE" : "RUN DESIGN", title: `${concept}${gap} gets downhill`, detail: (p.yards || 0) >= 10 ? "The runner clears the first wave and reaches open field." : "The blocking surface gives the runner a crease." };
  }
  if (["punt", "fg", "pat", "kickoff"].includes(type)) return { kicker: "SPECIAL TEAMS", title: p.blocked ? "The protection breaks down" : p.made === false ? "The kick misses" : "The operation is clean", detail: p.blocked ? "The recorded block is shown at the point of contact." : "The viewer follows the recorded kick and result." };
  return { kicker: "FILM NOTE", title: concept, detail: "The presentation follows the recorded play result." };
}

var STEP = 0.05;
var LOS = 31;
var YPU = 0.85;
var LINGER = 0.5;
var SPD = {
  WR: 7.6,
  RB: 7.2,
  QB: 6.4,
  TE: 6.6,
  OL: 4.2,
  FB: 6.2,
  DL: 3.9,
  LB: 6.4,
  DB: 7.4,
  S: 7
};
var ACCEL = 22;
var LIN_ACCEL = 15;
var DECEL = 30;
var SEP_R = 1.5;
var SEP_PUSH = 0.06;
var SEP_VMAX = 6;
var clamp6 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function seeded(p) {
  let s = (p.clock || 0) * 7919 + (p.fieldPos || 0) * 104729 + ((p.yards || 0) + 40) * 31 + (p.down || 1) * 7 + (p.half || 1) * 13 >>> 0;
  return () => {
    s = s * 1664525 + 1013904223 >>> 0;
    return s / 4294967296;
  };
}

// Viewer Act 2 / A1: choose body language from facts the film already owns.
// These selectors never move an actor and never feed back into the sim. Keeping
// them pure also makes the truth rules directly probeable without a browser.
function selectDuelMove({ outcomeStyle = null, speed = 0, agility = 55, frontness = 0, lateralness = 0, bodyKind = "balanced", roll = 0.5 } = {}) {
  const heavy = bodyKind === "power" || bodyKind === "massive";
  if (outcomeStyle === "truck") return lateralness >= (heavy ? 0.68 : bodyKind === "lean" ? 0.4 : 0.48) ? "stiff" : "truck";
  if (outcomeStyle !== "evade") return null;
  // A hurdle needs a fast, athletic carrier meeting a defender squarely. It is
  // deliberately rare; the viewer must not make ordinary cuts look airborne.
  if (!heavy && speed >= 6.05 && agility >= 62 && frontness >= 0.52 && roll < 0.22) return "hurdle";
  // Side contact creates the two evasive answers: spin through the near hip or
  // fend the tackler away. Better agility leans spin; modest agility leans stiff.
  if (lateralness >= 0.56) {
    const bodySpin = bodyKind === "lean" ? 0.08 : bodyKind === "power" ? -0.06 : bodyKind === "massive" ? -0.12 : 0;
    const spinGate = clamp6(0.42 + (agility - 55) * 0.012 + bodySpin, 0.26, 0.82);
    return roll < spinGate ? "spin" : "stiff";
  }
  return "juke";
}

function selectTackleStyle({ nearGoal = false, speed = 0, openField = false, lateral = false, fromBehind = false, bodyKind = "balanced" } = {}) {
  if (nearGoal) return "goalline";
  if (speed > 5.4 && openField && lateral) return bodyKind === "power" || bodyKind === "massive" ? "big-hit" : "shoestring";
  if (speed > 5.4 && openField) return "big-hit";
  if (fromBehind && speed > 4.6) return "drag-down";
  return "wrap";
}

function selectLandmarkMove({ runLike = false, touchdown = false, boundary = false, finishSpeed = 0, madeMarker = false, nearGoal = false } = {}) {
  if (!runLike) return null;
  if (touchdown && boundary && finishSpeed >= 3.8) return "pylon-dive";
  if (!touchdown && boundary && madeMarker && finishSpeed >= 4.4) return "marker-dive";
  if (touchdown && nearGoal) return "dive";
  return null;
}

// Viewer Act 2 / A2: the throw, catch and trench vocabulary is selected from
// geometry the film already owns. These labels are presentation-only; tracks,
// ball ownership and the recorded result remain the authority.
function selectCatchStyle({ kind = "catch", boundaryDistance = 50, reachDistance = 0, highArrival = false, lowArrival = false, contested = false, bodyKind = "balanced", roll = 0.5 } = {}) {
  if (kind === "int") return "pick";
  if (kind === "inc") return "breakup";
  if (boundaryDistance <= 11) return "toe-tap";
  if (contested) return "battle";
  if (highArrival) return "high-point";
  const oneHandGate = bodyKind === "lean" ? 0.11 : bodyKind === "massive" ? 0.03 : 0.08;
  if (!lowArrival && reachDistance >= 1.05 && reachDistance <= 2.8 && roll < oneHandGate) return "one-hand";
  if (lowArrival || reachDistance > 2.15) return "layout";
  return "secure";
}

function selectThrowStyle({ moving = false, rollout = false, hurried = false, reset = false, playAction = false, roll = 0.5 } = {}) {
  if (moving && hurried) return "off-platform";
  if (moving && (rollout || reset)) return roll < 0.62 ? "sidearm" : "on-run";
  if (hurried || reset) return "off-platform";
  if (playAction) return "pa-carry";
  return "set";
}

function selectTrenchStyle({ pass = true, move = null, edge = false } = {}) {
  if (!pass) return { family: "run", blocker: "drive", rusher: "fit" };
  if (edge || move === "bend" || move === "rip") return { family: "edge", blocker: "kick-slide", rusher: "speed" };
  if (move === "bull") return { family: "power", blocker: "anchor", rusher: "bull" };
  return { family: "counter", blocker: "redirect", rusher: "counter" };
}

function selectSecondaryMotion({ speed = 0, accel = 0, lateralSpeed = 0, locomotion = "still", carrier = false, pursuitDx = 0, pursuitDistance = Infinity } = {}) {
  const moving = locomotion !== "still" && speed >= 0.9;
  const gather = moving && (locomotion === "plant" || locomotion === "brake" || accel <= -5.5);
  const sprint = moving && speed >= 5.35;
  const headSide = carrier && speed >= 3 && pursuitDistance >= 2.2 && pursuitDistance <= 14 && Math.abs(pursuitDx) >= 0.65 ? pursuitDx < 0 ? "left" : "right" : null;
  return {
    weighted: moving,
    gather,
    sprint,
    headSide,
    shadowScale: Math.round(clamp6(1 + speed * 0.035, 1, 1.28) * 100) / 100,
    shadowOpacity: Math.round(clamp6(0.72 + speed * 0.025, 0.72, 0.92) * 100) / 100,
    shadowSkew: Math.round(clamp6(lateralSpeed * 1.4, -9, 9) * 2) / 2
  };
}

// Viewer Act 2 / A5: turn the roster's real frame into bounded puppet
// proportions and motion cadence. Missing stamps stay exactly on the legacy
// silhouette so old recordings degrade gracefully.
function selectBodyExpression({ heightInches = null, weight = null, group = "" } = {}) {
  const stamped = Number.isFinite(heightInches) || Number.isFinite(weight);
  if (!stamped) return { kind: "legacy", scaleX: 1, scaleY: 1, stride: 0.85, leanScale: 1 };
  const line = /^(OL|DL|DT|NT|C|G|T)$/.test(String(group).toUpperCase());
  const h = clamp6(Number.isFinite(heightInches) ? heightInches : line ? 75 : 72, 65, 82);
  const w = clamp6(Number.isFinite(weight) ? weight : line ? 300 : 210, 155, 390);
  const density = w / (h * h) * 703;
  const kind = density >= 37 ? "massive" : density >= 32 ? "power" : density < 27 ? "lean" : "balanced";
  const widthBase = kind === "massive" ? 1.14 : kind === "power" ? 1.07 : kind === "lean" ? 0.94 : 1;
  return {
    kind,
    scaleX: Math.round(clamp6(widthBase + (w - (line ? 290 : 215)) * 2e-4, 0.9, 1.18) * 100) / 100,
    scaleY: Math.round(clamp6(1 + (h - 73) * 0.012, 0.92, 1.1) * 100) / 100,
    stride: Math.round(clamp6(0.78 + (h - 68) * 0.025 + (w - 190) * 6e-4, 0.76, 1.08) * 100) / 100,
    leanScale: kind === "massive" ? 0.72 : kind === "power" ? 0.86 : kind === "lean" ? 1.12 : 1
  };
}

function buildArmSwitchPresentation(p, carryCue, dur) {
  const stamp = p && p.armSwitch;
  if (!stamp || !carryCue || stamp.slot !== carryCue.id || stamp.from === stamp.to) return null;
  if (!["left", "right"].includes(stamp.from) || !["left", "right"].includes(stamp.to)) return null;
  const f = clamp6(Number.isFinite(stamp.f) ? stamp.f : 0.44, 0.25, 0.72);
  const liveEnd = Math.max(carryCue.from + 0.36, dur - LINGER * 0.55);
  const at = carryCue.from + (liveEnd - carryCue.from) * f;
  return { id: carryCue.id, from: stamp.from, to: stamp.to, t: at, end: Math.min(liveEnd, at + 0.28) };
}

function visualRoll(p, salt = 0) {
  return seeded(__spreadProps(__spreadValues({}, p), { clock: (p.clock || 0) + salt * 977 }))();
}

function buildCatchPresentation(actors, fx, p, step, resolvedOwnerId = null) {
  const cf = (fx || []).find((f) => f.kind === "catch" || f.kind === "inc" || f.kind === "int");
  if (!cf) return null;
  const fi = Math.max(0, Math.round(cf.t / step));
  const wantDef = cf.kind === "int";
  let best = null, bd = Infinity;
  const stampedSlot = resolvedOwnerId || (wantDef ? p.ballSlots && p.ballSlots.pick : p.targetSlotId);
  if (stampedSlot) {
    const stamped = actors.find((a) => a.id === stampedSlot || a.slot && a.slot.id === stampedSlot) || null;
    if (stamped && (wantDef ? stamped.team === "def" : stamped.team === "off")) best = stamped;
  }
  // Legacy recordings may not carry the target/pick stamp. Proximity remains
  // their fallback, but a stamped owner always wins over a nearby route runner.
  if (!best) for (const a of actors) {
      const isDef = a.team === "def";
      if (wantDef ? !isDef : isDef) continue;
      if (!wantDef && a.slot && a.slot.pos === "OL") continue;
      const tr = a.track[Math.min(fi, a.track.length - 1)];
      if (!tr) continue;
      const dd = (tr[0] - cf.x) ** 2 + (tr[1] - cf.y) ** 2;
      if (dd < bd) { bd = dd; best = a; }
  }
  if (!best) return null;

  const prev = best.track[Math.max(0, fi - 5)] || best.track[Math.max(0, fi - 1)];
  const reachDistance = prev ? Math.hypot(prev[0] - cf.x, prev[1] - cf.y) : 0;
  const boundaryDistance = Math.min(cf.x, 100 - cf.x);
  let contest = null, contestD = Infinity;
  for (const a of actors) {
    if (a.team === best.team || a.slot && a.slot.pos === "OL") continue;
    const tr = a.track[Math.min(fi, a.track.length - 1)];
    if (!tr) continue;
    const dd = (tr[0] - cf.x) ** 2 + (tr[1] - cf.y) ** 2;
    if (dd < contestD) { contestD = dd; contest = a; }
  }
  const contested = !!contest && (p.contested === true || contestD < 30);
  const highArrival = p.type === "pass_deep" || cf.kind === "int" || p.contested === true;
  const lowArrival = p.type === "pass_short" || Math.max(0, (LOS - cf.y) / YPU) < 3;
  const style = selectCatchStyle({
    kind: cf.kind,
    boundaryDistance,
    reachDistance,
    highArrival,
    lowArrival,
    contested,
    bodyKind: best.body ? best.body.kind : "legacy",
    roll: visualRoll(p, 2)
  });
  const classes = ["wp-catch-style-" + style];
  if (style === "toe-tap") classes.push("wp-catch-toetap");
  if (style === "layout") classes.push("wp-catch-low", "wp-catch-extend", "wp-catch-layout");
  if (style === "high-point") classes.push("wp-catch-hi", "wp-catch-highpoint");
  if (style === "one-hand") classes.push("wp-catch-extend", "wp-catch-onehand");
  if (style === "battle") classes.push("wp-catch-contested", "wp-catch-battle");
  if (style === "breakup") classes.push("wp-catch-breakup");
  if (style === "pick") classes.push("wp-catch-hi", "wp-catch-pick");
  if (contested && !classes.includes("wp-catch-contested")) classes.push("wp-catch-contested");
  return {
    id: best.id,
    contestId: contested ? contest.id : null,
    breakup: cf.kind === "inc",
    style,
    classes,
    impact: cf.t,
    start: cf.t - 0.24,
    end: cf.t + (cf.kind === "inc" ? 0.22 : 0.36),
    basis: { kind: cf.kind, boundaryDistance, reachDistance, highArrival, lowArrival, contested }
  };
}
function makeActor(id, team, label, x, y, speed, opts = {}) {
  var _a, _b;
  return {
    id,
    team,
    label,
    x,
    y,
    vx: 0,
    vy: 0,
    speed,
    accel: (_a = opts.accel) != null ? _a : ACCEL,
    linAccel: (_b = opts.linAccel) != null ? _b : LIN_ACCEL,
    qb: !!opts.qb,
    behave: null,
    track: []
  };
}
function stepAgent(a, tgt, dt) {
  var _a, _b;
  if (!tgt) {
    a.vx *= 0.82;
    a.vy *= 0.82;
  } else {
    const dx = tgt[0] - a.x, dy = tgt[1] - a.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const arrive = Math.min(1, d / 2);
    const spTarget = ((_a = tgt[2]) != null ? _a : a.speed) * arrive;
    const curSp = Math.hypot(a.vx, a.vy);
    const sp = clamp6(spTarget, curSp - DECEL * dt, curSp + a.linAccel * dt);
    let dvx = dx / d * sp - a.vx, dvy = dy / d * sp - a.vy;
    const dv = Math.hypot(dvx, dvy) || 1e-6;
    const k = Math.min(1, a.accel * dt / dv);
    a.vx += dvx * k;
    a.vy += dvy * k;
  }
  a.x = clamp6(a.x + a.vx * dt, 1, 99);
  // [PLAYTEST 2026-08-12 item 9c] The floor used to be a hard 2 while endY is
  // allowed down to -60, so ANY run gaining more than ~34 yards had an endpoint
  // the physics could not reach: the carrier pinned at y=2 and stalled while the
  // scheduler kept asking for more speed, then constrainTrack slid the tail to
  // the real spot. That reads as "stops dead, then teleports". Scripts now pass
  // the play's true back-of-end-zone bound; anything that doesn't keeps the 2.
  a.y = clamp6(a.y + a.vy * dt, (_b = a.yMin) != null ? _b : 2, 60);
}
function constrainTrack(track, iEnd, end, span = null, iFloor = 0) {
  iEnd = Math.min(iEnd, track.length - 1);
  if (span == null) {
    const drift = Math.hypot(end[0] - track[iEnd][0], end[1] - track[iEnd][1]);
    span = Math.max(14, Math.ceil(drift / 0.14));
  }
  const i0 = Math.max(0, iFloor, iEnd - span);
  const dx = end[0] - track[iEnd][0], dy = end[1] - track[iEnd][1];
  for (let i = i0; i <= iEnd; i++) {
    const u = (i - i0) / (iEnd - i0 || 1), w = u * u * (3 - 2 * u);
    track[i][0] += dx * w;
    track[i][1] += dy * w;
  }
  for (let i = iEnd + 1; i < track.length; i++) {
    track[i][0] = end[0];
    track[i][1] = end[1];
  }
}
// M21: pin a MID-track point without freezing the tail — blends frames into
// the pin and back out to the original path (constrainTrack owns endpoints;
// this owns moments like the catch frame).
function pinTrackPoint(track, iPin, pt, span = 10) {
  iPin = Math.min(iPin, track.length - 1);
  if (iPin < 1) return;
  const dx = pt[0] - track[iPin][0], dy = pt[1] - track[iPin][1];
  const i0 = Math.max(0, iPin - span), i1 = Math.min(track.length - 1, iPin + span);
  for (let i = i0; i <= i1; i++) {
    const u = i <= iPin ? (i - i0) / (iPin - i0 || 1) : 1 - (i - iPin) / (i1 - iPin || 1);
    const w = u * u * (3 - 2 * u);
    track[i][0] += dx * w;
    track[i][1] += dy * w;
  }
}
// M21: a loose football — seeded erratic decaying hops off the out point
// that die back AT the out point (run fumbles live inside the outcome law:
// the resting spot cannot move).
function tumbleLoose(track, iEnd, rnd, clampLo = 1.5, clampHi = 60, frames = 11, amp = 2.2) {
  if (iEnd < 0 || iEnd >= track.length - 2) return;
  const base = track[Math.min(iEnd, track.length - 1)];
  const ang = rnd() * Math.PI * 2;
  const dx = Math.cos(ang), dy = Math.sin(ang) * 0.7;
  const j1 = rnd() * Math.PI * 2, j2 = rnd() * Math.PI * 2;
  for (let k = 1; k <= frames && iEnd + k < track.length - 1; k++) {
    const u = k / frames;
    const out = Math.sin(u * Math.PI) * amp;
    const hop = Math.abs(Math.sin(u * Math.PI * 3 + j1)) * 0.6 * (1 - u);
    const wob = Math.sin(u * Math.PI * 5 + j2) * 0.45 * (1 - u);
    track[iEnd + k] = [
      clamp6(base[0] + dx * out - dy * wob, 1, 99),
      clamp6(base[1] + dy * out + dx * wob + hop, clampLo, clampHi)
    ];
  }
}
function capTrackSpeed(track, maxStep) {
  for (let i = track.length - 1; i > 0; i--) {
    const dx = track[i][0] - track[i - 1][0], dy = track[i][1] - track[i - 1][1];
    const d = Math.hypot(dx, dy);
    if (d > maxStep) {
      const k = maxStep / d;
      track[i - 1][0] = track[i][0] - dx * k;
      track[i - 1][1] = track[i][1] - dy * k;
    }
  }
}
function pursuePt(carrier, d, spd2, leadCap = 0.24) {
  const dist = Math.hypot(carrier.x - d.x, carrier.y - d.y);
  const lead = clamp6(dist / (d.speed || 6), 0, leadCap);
  return [carrier.x + (carrier.vx || 0) * lead, carrier.y + (carrier.vy || 0) * lead, spd2];
}
var SHAPES = {
  // Each entry is a stem (straight release upfield) then a crisp break. d = depth
  // in yards, w = horizontal offset (× side). More waypoints = sharper, more
  // recognizable cuts. Depths follow how the route tree is taught.
  go: [{ d: 5, w: 0 }, { d: 16, w: 0.5 }, { d: 30, w: 1.5 }],
  seam: [{ d: 5, w: 2 }, { d: 15, w: 2 }, { d: 26, w: 2.5 }],
  post: [{ d: 6, w: 0 }, { d: 12, w: 0 }, { d: 22, w: 15 }],
  corner: [{ d: 6, w: 0 }, { d: 12, w: 0 }, { d: 20, w: -13 }],
  out: [{ d: 5, w: 0 }, { d: 12, w: 0 }, { d: 12.5, w: -13 }],
  quickout: [{ d: 4, w: 0 }, { d: 5, w: -11 }],
  dig: [{ d: 6, w: 0 }, { d: 12, w: 0 }, { d: 12.5, w: 18 }],
  curl: [{ d: 6, w: 0 }, { d: 12, w: 0 }, { d: 10, w: 3 }],
  comeback: [{ d: 6, w: 0 }, { d: 14, w: 0 }, { d: 11, w: -6 }],
  slant: [{ d: 1.5, w: 0 }, { d: 3, w: 4 }, { d: 9, w: 15 }],
  flat: [{ d: 1, w: -6 }, { d: 2.5, w: -16 }],
  arrow: [{ d: 0.5, w: -4 }, { d: 4, w: -18 }],
  cross: [{ d: 3, w: 5 }, { d: 5, w: 20 }, { d: 6, w: 38 }],
  deepcross: [{ d: 5, w: 3 }, { d: 11, w: 18 }, { d: 15, w: 34 }],
  wheel: [{ d: 1, w: -8 }, { d: 3, w: -11 }, { d: 16, w: -9 }],
  hitch: [{ d: 6, w: 0 }, { d: 7, w: 0 }, { d: 5.5, w: 1 }],
  stick: [{ d: 5, w: 0 }, { d: 5.5, w: -5 }],
  whip: [{ d: 4, w: 5 }, { d: 3.5, w: -9 }],
  pivot: [{ d: 4, w: -4 }, { d: 4.5, w: 7 }],
  // double moves — sell one break, then go
  sluggo: [{ d: 2, w: 0 }, { d: 4, w: 10 }, { d: 6, w: 2 }, { d: 24, w: 3 }],
  postcorner: [{ d: 6, w: 0 }, { d: 13, w: 8 }, { d: 21, w: -11 }],
  outandup: [{ d: 5, w: 0 }, { d: 8, w: -9 }, { d: 22, w: -6 }],
  // screen paths (mid=+1 breaks TOWARD midfield; negative w bellies to the SIDELINE)
  bubble: [{ d: -0.5, w: -3 }, { d: -1, w: -7 }],
  // slot arcs flat/back to the boundary
  tunnel: [{ d: 2, w: 0 }, { d: 1, w: 6 }, { d: 0.5, w: 12 }],
  // sell the jet/outside release, then disappear behind the line to the wall
  slip: [{ d: 1.8, w: -1.5 }, { d: 0.4, w: 4.5 }, { d: -0.8, w: 11 }],
  // fade — a back-shoulder route. Short/med version (red-zone) and the deep
  // version (four verts outside) both use this shape scaled by depth.
  fade: [{ d: 4, w: 0 }, { d: 9, w: -3 }, { d: 14, w: -6 }],
  // stem then drift to the boundary
  deepfade: [{ d: 6, w: 0 }, { d: 16, w: -3 }, { d: 30, w: -6 }]
};
var CONCEPT_ROUTES = {
  // Routes are assigned outside-in (widest receiver first). Each concept reads
  // like the real thing: a high-low or horizontal stretch with an outlet.
  "Mesh": ["cross", "cross", "corner", "arrow"],
  "Slant-Flat": ["slant", "flat", "slant", "arrow"],
  "Stick": ["go", "stick", "seam", "flat"],
  // outside = clearout GO (carries the corner off)
  "Shallow Cross": ["cross", "dig", "post", "flat"],
  "Smash": ["hitch", "corner", "cross", "flat"],
  "Curl-Flat": ["curl", "flat", "dig", "arrow"],
  "Flood": ["go", "out", "flat", "cross"],
  "Y-Cross": ["go", "deepcross", "comeback", "flat"],
  "Dagger": ["seam", "dig", "go", "arrow"],
  "Four Verts": ["deepfade", "seam", "seam", "deepfade"],
  // outside = deep back-shoulder fade; inside = seams
  "Post-Wheel": ["post", "wheel", "cross", "flat"],
  "PA Deep Cross": ["go", "deepcross", "post", "flat"],
  "Mills (Post-Dig)": ["post", "dig", "go", "arrow"],
  "Red-Zone Fade": ["fade", "hitch", "slant", "flat"],
  // outside = short/med back-shoulder fade
  // Promoted to real concepts (Aug 2026) — the art predated the playbook entry
  "Sail": ["go", "corner", "out", "flat"],
  "Levels": ["dig", "slant", "slant", "arrow"],
  "Spot": ["corner", "pivot", "flat", "cross"],
  // snag settles/pivots under the corner
  "Sluggo Seam": ["sluggo", "seam", "outandup", "flat"]
  // the called double move: slant-and-go + seam, out-and-up backside
};
var DEPTH_ROUTES = {
  pass_short: ["slant", "quickout", "hitch", "cross"],
  pass_medium: ["curl", "dig", "out", "comeback"],
  pass_deep: ["go", "post", "corner", "seam"]
};
// Capstone P1: each base shape's double-move twin — used when the trace says
// the chosen throw won on a double move.
var DBL_SHAPE = {
  slant: "sluggo", cross: "sluggo", go: "sluggo", seam: "sluggo", curl: "sluggo", hitch: "sluggo", deepcross: "sluggo",
  post: "postcorner", corner: "postcorner", dig: "postcorner",
  out: "outandup", quickout: "outandup", comeback: "outandup", flat: "outandup", arrow: "outandup", fade: "outandup", deepfade: "outandup", wheel: "outandup",
  stick: "whip"
};
function routeWaypoints(shape, x0, y0, mid) {
  return (SHAPES[shape] || SHAPES.hitch).map((wp) => [clamp6(x0 + wp.w * mid, 2, 98), clamp6(y0 - wp.d * YPU, 2.5, 59)]);
}
// Stage 6 (Playbook-Root): the composer's route-part vocabulary
// (playcompose ROUTE_PARTS + the card's fill/screen ids) → the viewer's SHAPES,
// so an authored part animates as its own recognizable route.
var COMPOSED_SHAPE = {
  go: "go", post: "post", corner: "corner", dig: "dig", out: "out",
  curl: "curl", slant: "slant", drag: "cross", flat: "flat", wheel: "wheel",
  screen: "slip", checkdown: "stick", bubble: "bubble", tunnel: "tunnel"
};
function waypointBehavior(wps, speed, startT = 0) {
  const turn = wps.map((w, i2) => {
    if (i2 === 0 || i2 === wps.length - 1) return 0;
    const ax = w[0] - wps[i2 - 1][0], ay = w[1] - wps[i2 - 1][1];
    const bx = wps[i2 + 1][0] - w[0], by = wps[i2 + 1][1] - w[1];
    const la = Math.hypot(ax, ay) || 1e-6, lb = Math.hypot(bx, by) || 1e-6;
    return clamp6((1 - (ax * bx + ay * by) / (la * lb)) / 2, 0, 1);
  });
  const relSign = wps.length > 1 ? Math.sign(wps[1][0] - wps[0][0]) : 0;
  let i = 0;
  return (t, world, a) => {
    if (t < startT) return null;
    while (i < wps.length - 1 && Math.hypot(a.x - wps[i][0], a.y - wps[i][1]) < 1.6) i++;
    const w = wps[i];
    const d = Math.hypot(a.x - w[0], a.y - w[1]);
    const near = clamp6(1 - d / 2.4, 0, 1);
    const plant = 1 - (turn[i] || 0) * near * 0.5;
    const rel = t < startT + 0.16 ? relSign * 0.6 * (1 - (t - startT) / 0.16) : 0;
    return [w[0] + rel, w[1], speed * plant];
  };
}
var SHELL1 = [[50, 5], [66, 20]];
var SHELL2 = [[30, 6], [70, 6]];
var shellOf = (fam) => ["Cover 2", "Cover 4", "Cover 2-Man"].includes(fam) ? 2 : 1;
var MAN_FAMS = ["Cover 0", "Cover 1", "Cover 2-Man"];
var RUN_SCHEMES = {
  "Inside Zone": { gap: 6, stretch: 0.35, press: 3, wide: false },
  "Power": { gap: 9, pull: "lead", press: 2.2, wide: false },
  "Counter": { gap: 11, pull: "lead", press: 2, wide: true, misdir: true },
  "Trap": { gap: 5, pull: "trap", press: 1.4, wide: false },
  "Iso": { gap: 5, lead: true, press: 1.8, wide: false },
  "Outside Zone": { gap: 16, stretch: 1, press: 2.6, wide: true },
  // Toss: a deeper pitch from the RB's BACKFIELD alignment — tighter than the
  // jet, so pullers/FB can lead through the near edge (not a full-width sweep).
  "Toss": { gap: 14, stretch: 0.7, pitch: true, press: 1.6, wide: true },
  // Jet: full-speed WR motion attacks the widest edge — kept clearly wider.
  "Jet Sweep": { gap: 26, stretch: 1, press: 0.8, wide: true },
  // QB Power: backside guard pulls, QB follows him downhill.
  "QB Power": { gap: 7, pull: "lead", press: 2.2, wide: false },
  // QB Sneak: straight into the center's push — no lateral press at all.
  "QB Sneak": { gap: 2, press: 3.5, wide: false }
};
var RUN_ALIAS = { "Wildcat Power": "Power", "Triple Option": "Inside Zone", "Speed Option": "Outside Zone", "Reverse": "Outside Zone" };
function buildPlayScript(p, offSlotsRaw, defSlotsRaw) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
  const t = String((p == null ? void 0 : p.type) || "");
  const isRun = (t.startsWith("run") || (p == null ? void 0 : p.isScramble)) && t !== "penalty";
  const isPass = t.startsWith("pass") && !(p == null ? void 0 : p.isScramble);
  const isPen = t === "penalty" && !!(p == null ? void 0 : p.offFormation);
  if (!p || !(offSlotsRaw == null ? void 0 : offSlotsRaw.length) || !isRun && !isPass && !isPen) return null;
  const rnd = seeded(p);
  const DEPTH_YDS_PER_Y = 18;
  const yToBoard = (y) => LOS + Math.max(0, y - 0.5) * DEPTH_YDS_PER_Y * YPU;
  const off = offSlotsRaw.map((s) => __spreadProps(__spreadValues({}, s), { bx: s.x * 100, by: yToBoard(s.y) }));
  const defRaw = defSlotsRaw || [];
  // M17: the formation catalog stores a readable schematic, not literal yardage.
  // Translating every row with one scale put corners nearly 26 yards off and
  // stacked linebackers 10-15 yards off the ball.  Use football alignment
  // depths here so the viewer gets a connected box while the formation catalog,
  // simulation result and field-state rules remain untouched.
  const defDepthYds = (s) => {
    const role = String(s.role || "");
    if (s.pos === "DE" || s.pos === "DT") return s.pos === "DT" ? 0.65 : 0.85;
    if (s.pos === "OLB" && /Rush/.test(role) && s.y >= 0.6) return 1.05;
    if (s.pos === "CB") return s.id === "NB" || /Nickel/.test(role) ? 4.25 : 1.45;
    if (s.pos === "S") {
      if (s.mesh === "SPACE" || s.y >= 0.24) return s.y >= 0.34 ? 4.5 : 6;
      return 10.5 + Math.max(0, 0.1 - s.y) * 20;
    }
    if (s.mesh === "OVERHANG") return 3.75;
    return s.mesh === "STACKER" || s.pos === "LB" ? 4.25 : 4.5;
  };
  const def = defRaw.map((s) => __spreadProps(__spreadValues({}, s), {
    bx: s.x * 100,
    by: LOS - defDepthYds(s) * YPU,
    alignDepth: defDepthYds(s)
  }));
  const qbSlot = off.find((s) => s.id === "QB") || { bx: 50, by: LOS + 3 * YPU, id: "QB", label: "QB", pos: "QB" };
  const gain = clamp6(p.yards || 0, -15, 100);
  const endY = clamp6(LOS - (p.td ? Math.min(p.yards || 0, 100) : gain) * YPU, -60, 61);
  const spdFactor = (m) => m ? clamp6(1 + (m.s - 55) / 180, 0.82, 1.2) : 1;
  const agiFactor = (m) => m ? clamp6(1 + (m.a - 55) / 260, 0.82, 1.15) : 1;
  const A = {};
  for (const s of off) {
    const base = (_a = SPD[s.pos]) != null ? _a : s.catch ? SPD.WR : SPD.RB;
    const m = (_b = p.offSpd) == null ? void 0 : _b[s.id];
    A[s.id] = makeActor(s.id, "off", s.label, s.bx, s.by, base * spdFactor(m), { qb: s.id === "QB", accel: ACCEL * agiFactor(m), linAccel: LIN_ACCEL * agiFactor(m) });
    A[s.id].slot = s;
    A[s.id].body = selectBodyExpression({ heightInches: m == null ? void 0 : m.h, weight: m == null ? void 0 : m.w, group: s.pos });
  }
  if (!A.QB) {
    A.QB = makeActor("QB", "off", qbSlot.label || "QB", qbSlot.bx, qbSlot.by, (_d = (_c = SPD.QB) != null ? _c : SPD.RB) != null ? _d : 5.5, { qb: true });
    A.QB.slot = qbSlot;
    const qm = p.offSpd && p.offSpd.QB;
    A.QB.body = selectBodyExpression({ heightInches: qm == null ? void 0 : qm.h, weight: qm == null ? void 0 : qm.w, group: "QB" });
  }
  const D = {};
  for (const s of def) {
    const grp = s.pos === "CB" ? "DB" : s.pos === "S" ? "S" : s.pos === "DE" || s.pos === "DT" ? "DL" : "LB";
    const m = (_e = p.defSpd) == null ? void 0 : _e[s.id];
    D[s.id] = makeActor("D_" + s.id, "def", s.label, s.bx, s.by, SPD[grp] * spdFactor(m), { accel: ACCEL * agiFactor(m), linAccel: LIN_ACCEL * agiFactor(m) });
    D[s.id].slot = s;
    D[s.id].grp = grp;
    D[s.id].body = selectBodyExpression({ heightInches: m == null ? void 0 : m.h, weight: m == null ? void 0 : m.w, group: s.pos });
  }
  const defs = Object.values(D), offs = Object.values(A);
  const fx = [];
  const blocks = [];
  let tackleCue = null, moveCue = null, breakCue = null, stripCue = null;
  const rushCues = [], jamCues = [];
  // M12 exposes the route tree and its real coverage pairing to the pose layer.
  // These are presentation cues only; the authored tracks below still own every
  // location, arrival time and result.
  const routeCues = [], coverageCues = [];
  let pressCue = null, pumpCue = null, celebrateCue = null, qbCue = null;
  let _penWhistle = null;
  const missCues = [];
  const pickMove = (carrier2, break2) => {
    if (p.btStyle === "truck" || p.btStyle === "evade") {
      const i = break2 ? Math.round(break2.t / STEP) : Math.max(2, Math.round(((endInfo == null ? void 0 : endInfo.at) || PRESNAP + 1) * 0.6 / STEP));
      const tr = carrier2 == null ? void 0 : carrier2.track;
      const c0 = tr == null ? void 0 : tr[Math.max(0, Math.min(i - 3, tr.length - 1))];
      const c1 = tr == null ? void 0 : tr[Math.max(0, Math.min(i, tr.length - 1))];
      const dA = break2 ? everyone.find((a2) => a2.id === break2.id) : null;
      const d1 = dA == null ? void 0 : dA.track[Math.max(0, Math.min(i, dA.track.length - 1))];
      const vx = c0 && c1 ? c1[0] - c0[0] : 0, vy = c0 && c1 ? c1[1] - c0[1] : -1;
      const rx = c1 && d1 ? d1[0] - c1[0] : 0, ry = c1 && d1 ? d1[1] - c1[1] : -1;
      const vm = Math.hypot(vx, vy) || 1, rm = Math.hypot(rx, ry) || 1;
      const frontness = clamp6((vx * rx + vy * ry) / (vm * rm), -1, 1);
      const lateralness = clamp6(Math.abs(vx * ry - vy * rx) / (vm * rm), 0, 1);
      const speed = vm / (STEP * 3);
      const agility = (((p.offSpd || {})[carrier2 == null ? void 0 : carrier2.id] || {}).a) || 55;
      const roll = rnd();
      const bodyKind = (carrier2 == null ? void 0 : carrier2.body) ? carrier2.body.kind : "legacy";
      return {
        style: selectDuelMove({ outcomeStyle: p.btStyle, speed, agility, frontness, lateralness, bodyKind, roll }),
        basis: { speed, agility, frontness, lateralness, bodyKind }
      };
    }
    if (p.breakaway && (p.yards || 0) >= 18) return { style: "recover", basis: null };
    return null;
  };
  const PRESNAP = p.optionPhase === "jet" ? 0.95 : 0.55;
  const SNAP_ORIGIN = [50, LOS + 0.6];
  const _qbDepthYds = Math.max(0, (((_g = (_f = off.find((s) => s.id === "QB")) == null ? void 0 : _f.by) != null ? _g : LOS + 3) - LOS) / YPU);
  // M21: the snap window also scales with the taker's LATERAL offset — a
  // wildcat-formation QB split out wide gets a snap flight the ball can
  // actually cover (the fixed window teleported it and the speed cap smeared
  // the pre-snap frames). Normal alignments are numerically unchanged.
  const _snapDestSlot = p.optionPhase === "wildcat" ? off.find((s) => s.pos === "WILDCAT") || qbSlot : qbSlot;
  const _snapLatU = Math.abs((((_snapDestSlot == null ? void 0 : _snapDestSlot.bx) != null ? _snapDestSlot.bx : 50)) - 50);
  const SNAP_T = clamp6(0.12 + _qbDepthYds * 0.028 + _snapLatU * 0.022, 0.12, 1.05);
  const SNAP_END = PRESNAP + SNAP_T;
  const snapFlight = (t2, dest) => {
    if (t2 < PRESNAP) return null;
    if (t2 >= SNAP_END) return null;
    const d = typeof dest === "function" ? dest() : dest;
    const u = (t2 - PRESNAP) / SNAP_T;
    return [SNAP_ORIGIN[0] + (d[0] - SNAP_ORIGIN[0]) * u, SNAP_ORIGIN[1] + (d[1] - SNAP_ORIGIN[1]) * u];
  };
  {
    const actual = p.coverage ? shellOf(p.coverage) : null;
    const shown = p.shownCoverage ? shellOf(p.shownCoverage) : null;
    const safeties = defs.filter((d) => d.slot.pos === "S");
    if (actual != null) safeties.slice(0, 2).forEach((s, i) => {
      const from = shown != null && shown !== actual ? (shown === 2 ? SHELL2 : SHELL1)[i] : (actual === 2 ? SHELL2 : SHELL1)[i];
      const to = (actual === 2 ? SHELL2 : SHELL1)[i];
      s.x = from[0];
      s.y = from[1];
      s.home = to;
    });
  }
  let carrier = null, dur, ballPlan, throwCue = null, _covActorId = null;
  // [PLAYTEST 2026-08-12 item 9c] This is an ARRIVAL GOVERNOR — distance
  // remaining over time remaining — so it does not run an actor at his speed, it
  // runs him at whatever pace lands him on schedule. The 0.55 floor let a
  // ballcarrier sag to 55% of his rating-derived top speed, which for a 7.2 back
  // is a jog. Pacing should TRIM a run, not reshape it, so the carrier gets a
  // much tighter floor while everyone else keeps the old latitude.
  const schedSp = (a, pt, tNow, tDue, base, floorPct = 0.55) => clamp6(
    Math.hypot(pt[0] - a.x, pt[1] - a.y) / Math.max(0.15, tDue - tNow),
    base * floorPct,
    9.6
  );
  const CARRIER_SP_FLOOR = 0.85;
  const wireRush = (blitz) => {
    var _a2;
    const dl = defs.filter((d) => d.grp === "DL");
    const ols = offs.filter((a) => a.slot.pos === "OL");
    const pairOf = (d) => ols.length ? ols.reduce((a, b) => Math.abs(b.slot.bx - d.slot.bx) < Math.abs(a.slot.bx - d.slot.bx) ? b : a) : null;
    const nShed = p.sack ? Math.max(1, [p.sackerId, p.sackerId2].filter(Boolean).length) : p.hurried ? clamp6(Math.round((((_a2 = p.pressureIds) == null ? void 0 : _a2.length) || 1) * 0.6) || 1, 1, 2) : 0;
    const winScore = (d) => -Math.abs(d.slot.bx - qbSlot.bx) + (/^(DE|OLB)/.test(d.slot.pos) ? rnd() * 10 : rnd() * 3);
    const winners = new Set(dl.slice().sort((a, b) => winScore(b) - winScore(a)).slice(0, Math.min(nShed, dl.length)).map((d) => d.id));
    const shedT = PRESNAP + (p.sack ? 0.02 : 0.3);
    const olSorted = ols.slice().sort((a2, b2) => a2.slot.bx - b2.slot.bx);
    dl.forEach((d) => {
      const o = pairOf(d);
      const cx = o ? (d.slot.bx + o.slot.bx) / 2 : d.slot.bx;
      const cy = o ? (d.slot.by + o.slot.by) / 2 : LOS - 0.5;
      const edge2 = cx >= 50 ? 1 : -1;
      const jig = (rnd() - 0.5) * 0.6;
      const win = winners.has(d.id);
      const isEdge = /^(DE|OLB)/.test(d.slot.pos) || Math.abs(d.slot.bx - 50) > 11;
      const move = isEdge ? win ? rnd() < 0.55 ? "bend" : "rip" : rnd() < 0.6 ? "bull" : "rip" : win ? rnd() < 0.45 ? "swim" : rnd() < 0.5 ? "counter" : "bull" : rnd() < 0.6 ? "bull" : "counter";
      const push = (move === "bull" ? 1 : 0.4) * (p.sack ? 1.6 : p.hurried ? 1.2 : 0.7);
      const jabX = cx + edge2 * 1.5;
      d._cx = cx;
      d._cy = cy;
      d._mate = o;
      d._push = push;
      const cyAt = (t2) => cy + Math.min(2.4, Math.max(0, t2 - PRESNAP) * push);
      const trench = selectTrenchStyle({ pass: true, move, edge: isEdge });
      if (win) {
        d.behave = (t2) => {
          if (t2 < PRESNAP) return null;
          if (t2 < shedT) return [move === "counter" && t2 < shedT - 0.1 ? jabX : cx + jig, cyAt(t2), 3];
          if (move === "bend" && d.y < LOS + 0.6)
            return [cx + edge2 * 2.8, LOS + 1.2, p.sack ? 8.8 : 7.2];
          return p.sack ? [A.QB.x, A.QB.y + 0.4, 8.8] : [A.QB.x + edge2 * 3.4, A.QB.y + 1.2, 6.8];
        };
        rushCues.push({ id: d.id, move, t: shedT, blockerId: o ? o.id : null, win: true, family: trench.family, blockerStyle: trench.blocker, rusherStyle: trench.rusher });
      } else {
        d.behave = (t2) => t2 < PRESNAP ? null : [move === "counter" && t2 < PRESNAP + 0.4 ? jabX : cx + jig, cyAt(t2), 3];
        rushCues.push({ id: d.id, move, t: PRESNAP + 0.22, blockerId: o ? o.id : null, win: false, family: trench.family, blockerStyle: trench.blocker, rusherStyle: trench.rusher });
      }
    });
    ols.forEach((o) => {
      const mine = dl.find((d) => d._mate === o);
      const ax = mine ? mine._cx * 0.5 + o.slot.bx * 0.5 : o.slot.bx;
      const ay = mine ? mine._cy + 0.8 : LOS + 0.8;
      const beaten = mine && winners.has(mine.id);
      const isOT = olSorted.length >= 4 && (o === olSorted[0] || o === olSorted[olSorted.length - 1]);
      const setAt = (t2) => Math.max(
        mine ? Math.min(2.4, Math.max(0, t2 - PRESNAP) * mine._push) : 0,
        isOT ? Math.min(1.3, Math.max(0, t2 - PRESNAP) * 2) : 0
      );
      o.behave = (t2) => t2 < PRESNAP ? null : beaten && t2 >= shedT ? [(o.x + A.QB.x) / 2, A.QB.y - 3.5, o.speed] : [ax + (rnd() - 0.5) * 0.5, ay + setAt(t2), o.speed];
    });
    if (blitz) {
      const dog = defs.find((d) => d.grp === "LB");
      if (dog) dog.behave = (t2) => t2 < PRESNAP - 0.35 ? null : t2 < PRESNAP ? [dog.slot.bx, Math.min(29.2, dog.slot.by + 2.2), 2.6] : [A.QB.x, A.QB.y + 0.6, 6.6];
    }
    if (p.fireZone) {
      const fz = defs.filter((d) => d.slot.pos === "OLB").pop();
      if (fz) fz.behave = (t2) => t2 < PRESNAP - 0.1 ? null : [fz.slot.bx, 21, 5.5];
    }
  };
  const wireCoverage = (catchers, breakAt, breakTo, traceOpts = null) => {
    const man = MAN_FAMS.includes(p.coverage);
    const rank = { DB: 0, LB: 1, S: 2 };
    const covPool = defs.filter((d) => !d.behave && d.grp !== "DL").sort((a2, b2) => {
      var _a2, _b2;
      return ((_a2 = rank[a2.grp]) != null ? _a2 : 3) - ((_b2 = rank[b2.grp]) != null ? _b2 : 3);
    });
    const taken = /* @__PURE__ */ new Set();
    const stampedFor = (c) => {
      const pair = (p.covSlots || []).find((cs) => cs.r === c.id && cs.t !== "zone");
      if (!pair) return null;
      const d = D[pair.d];
      return d && !d.behave && d.grp !== "DL" && !taken.has(d.id) ? d : null;
    };
    if (man || (p.covSlots || []).some((cs) => cs.t !== "zone")) {
      for (const c of catchers) {
        let best = stampedFor(c), bd = 1e9;
        if (!best && man) for (const d of covPool) {
          if (taken.has(d.id)) continue;
          const dd = (d.x - c.bx) ** 2 + (d.y - c.by) ** 2;
          if (dd < bd) {
            bd = dd;
            best = d;
          }
        }
        if (!best) continue;
        taken.add(best.id);
        const wr = A[c.id];
        const press = best.grp === "DB" && rnd() < 0.45;
        if (press) {
          best.x = clamp6(c.bx + (c.bx <= 50 ? -0.8 : 0.8), 2, 98);
          best.y = LOS - 1.6;
          jamCues.push({ id: best.id, start: PRESNAP, end: PRESNAP + 0.42 });
        }
        // Capstone P1: on the CHOSEN throw, the recorded separation sets this
        // pair's cushion — a blanket at 0.2 sep, beaten by steps at 0.7. Other
        // pairs keep the stock trail; without a trace so does the target's.
        const _isTgt = traceOpts && c.id === traceOpts.tgtId;
        const _cush = _isTgt ? clamp6(0.5 + traceOpts.sep * 4.2, 0.6, 3.8) : 1.8;
        if (_isTgt) _covActorId = best.id;
        const _route = routeCues.find((cue) => cue.id === c.id) || null;
        if (_route) {
          const turnStart = _route.family === "vertical" ? Math.max(_route.releaseEnd, breakAt - 0.2) : _route.breakStart - 0.08;
          coverageCues.push({
            id: best.id,
            receiverId: c.id,
            target: !!_isTgt,
            press,
            zone: false,
            start: PRESNAP,
            pedalEnd: Math.max(PRESNAP + 0.18, turnStart),
            turnStart,
            turnEnd: turnStart + 0.3,
            end: _route.end
          });
        }
        // The target's cover man doesn't chase the ball in flight — he's on
        // the MAN, so he breaks straight for the catch point (that's the
        // contest/breakup you actually watched). Everyone else rallies to the
        // ball as before.
        const _breakPt = _isTgt && traceOpts.tgtPt ? () => traceOpts.tgtPt : breakTo;
        best.behave = (t2) => t2 < PRESNAP ? null : press && t2 < PRESNAP + 0.35 ? [wr.x, wr.y - 0.5, 4.4] : breakAt != null && t2 >= breakAt ? [_breakPt()[0], _breakPt()[1], best.speed] : [wr.x, wr.y - _cush, best.speed * 0.97];
      }
    }
    for (const d of covPool) {
      if (d.behave || taken.has(d.id)) continue;
      const land = d.slot.pos === "CB" ? p.coverage === "Cover 2" ? [d.slot.bx, 20] : p.coverage === "Cover 4" ? [d.slot.bx, 7] : [d.slot.bx, 9] : d.slot.pos === "S" ? d.home || [d.slot.bx, 8] : [clamp6(d.slot.bx * 0.6 + 20, 20, 80), 21];
      d.behave = (t2) => t2 < PRESNAP ? null : breakAt != null && t2 >= breakAt ? [breakTo()[0], breakTo()[1], d.speed] : [land[0], land[1], d.speed * 0.8];
      if (routeCues.length && breakAt != null) coverageCues.push({
        id: d.id,
        receiverId: null,
        target: false,
        press: false,
        zone: true,
        start: PRESNAP,
        pedalEnd: Math.max(PRESNAP + 0.28, breakAt - 0.2),
        turnStart: Math.max(PRESNAP + 0.28, breakAt - 0.2),
        turnEnd: breakAt + 0.14,
        end: breakAt + 0.55
      });
    }
  };
  if (isPen) {
    const preFoul = p.preSnap !== false;
    const tWhistle = preFoul ? PRESNAP + 0.05 : SNAP_END + 1.15;
    _penWhistle = tWhistle;
    dur = tWhistle + 0.45 + LINGER;
    if (!preFoul) {
      const catchers = off.filter((s) => s.catch && s.pos !== "RB" && s.pos !== "FB");
      const shapes = DEPTH_ROUTES.pass_medium;
      [...catchers].sort((a2, b2) => Math.abs(b2.bx - 50) - Math.abs(a2.bx - 50)).forEach((s, i) => {
        A[s.id].behave = waypointBehavior(routeWaypoints(shapes[i % shapes.length], s.bx, s.by, s.bx <= 50 ? 1 : -1), A[s.id].speed, PRESNAP);
      });
      A.QB.behave = (t2) => t2 < PRESNAP ? null : t2 < SNAP_END ? [qbSlot.bx, qbSlot.by, 3] : [qbSlot.bx, qbSlot.by + 1.4, 4.5];
      for (const s of off) {
        if (A[s.id].behave || s.pos === "OL") continue;
        A[s.id].behave = (t2) => t2 < PRESNAP ? null : [clamp6(s.bx + (s.bx <= 50 ? -8 : 8), 4, 96), LOS + 1.4, 5.5];
      }
      wireRush(false);
      wireCoverage(catchers, null, () => [50, 22]);
      for (const a2 of [...offs, ...defs]) {
        const pv = a2.behave;
        a2.behave = (t2, w2, aa) => t2 >= tWhistle ? null : pv ? pv(t2, w2, aa) : null;
      }
    }
    ballPlan = (t2) => {
      if (preFoul || t2 < PRESNAP) return [50, LOS + 0.6];
      const snap = snapFlight(t2, () => [A.QB.x, A.QB.y - 0.8]);
      return snap || [A.QB.x, A.QB.y - 0.8];
    };
    const pyds = Math.abs(p.yards || 0);
    const verdict = p.penaltySide === "offense" ? `${pyds} YDS \u2014 REPLAY THE DOWN` : `${pyds} YDS${p.autoFirst ? " \u2014 AUTOMATIC 1ST DOWN" : ""}`;
    let flagX = clamp6(50 + ((p.fieldPos || 50) % 5 - 2) * 2.2, 8, 92);
    let flagY = LOS + (preFoul ? 0.6 : 2.4);
    if (p.penaltyPos) {
      const fam = {
        OL: ["OL"],
        TE: ["TE"],
        WR: ["WR", "SLOT"],
        RB: ["RB", "FB"],
        QB: ["QB"],
        DL: ["DE", "DT"],
        LB: ["OLB", "MLB", "ILB", "LB"],
        CB: ["CB"],
        S: ["S"]
      }[p.penaltyPos] || [p.penaltyPos];
      const side = p.penaltySide === "offense" ? offs : defs;
      const cands = side.filter((a2) => fam.includes(a2.slot.pos));
      if (cands.length) {
        const culprit = cands[Math.floor(rnd() * cands.length) % cands.length];
        flagX = clamp6(culprit.x + 1.2, 4, 96);
        flagY = clamp6(culprit.y + 0.8, 3, 59);
        var culpritCue = { id: culprit.id, t: preFoul ? PRESNAP : tWhistle };
      }
    }
    fx.push({
      t: preFoul ? Math.max(0.1, PRESNAP - 0.2) : tWhistle - 0.25,
      kind: "flag",
      x: flagX,
      y: flagY,
      name: String(p.penaltyName || "PENALTY"),
      team: String(p.penaltyOn || ""),
      verdict,
      pre: preFoul
    });
    var ballEnd = { at: dur, pt: null };
    var ballCue = { kind: "penalty", snapStart: preFoul ? null : PRESNAP, snapEnd: preFoul ? null : SNAP_END, holdEnd: preFoul ? null : tWhistle, meshStart: null, meshEnd: null, fakeStart: null, fakeEnd: null, release: null, catch: null };
  } else if (isPass && !p.sack) {
    const catchers = off.filter((s) => s.catch && s.pos !== "RB" && s.pos !== "FB");
    const backs = off.filter((s) => s.catch && (s.pos === "RB" || s.pos === "FB"));
    const seedId = String(p.receiverId || p.targetId || "");
    const side = seedId ? seedId.split("").reduce((s2, c) => s2 + c.charCodeAt(0), 0) % 2 ? 76 : 24 : 50;
    const screen = !!p.isScreen;
    const _throwAway = !!p.throwAway;
    const _cn = String(p.concept || "");
    // ── Capstone P1 (Aug 2026): the REAL play, when the sim recorded one. ──
    // p.targetSlotId names the exact field slot the sim threw to; p.trace
    // carries the chosen throw's separation, route shape/double-move, coverage
    // type, robber, and the cover man's position. When present we render THAT
    // play; when absent (older saves, penalties, edge paths) everything below
    // falls back to the synthesis — the viewer stays decoupled.
    const tr = p.trace || null;
    const _traceTgt = p.targetSlotId ? [...catchers, ...backs].find((s) => s.id === p.targetSlotId) || null : null;
    // Screen flavor follows the REAL receiver when the sim recorded one: a back
    // target is a swing/RB screen no matter what the concept card says, a wideout
    // target is a bubble/tunnel. (Old code compared slot ids to a roster player id
    // — always false — so organic RB screens all animated as WR bubbles.)
    const _traceIsBack = _traceTgt ? backs.includes(_traceTgt) : null;
    const screenKind = !screen ? null : _traceTgt ? (_traceIsBack ? "rb" : /Tunnel/i.test(_cn) ? "tunnel" : /Slip/i.test(_cn) ? "slip" : "bubble") : /Bubble/i.test(_cn) ? "bubble" : /Tunnel/i.test(_cn) ? "tunnel" : /Slip/i.test(_cn) ? "slip" : /RB Screen/i.test(_cn) ? "rb" : backs.length && !catchers.length ? "rb" : backs.some((b) => String(b.id) === String(p.targetSlotId || "")) ? "rb" : "bubble";
    const _slotish = catchers.filter((s) => s.pos === "SLOT");
    const _outside = [...catchers].sort((a, b) => Math.abs(b.bx - 50) - Math.abs(a.bx - 50));
    const _fadeConcept = /Red-Zone Fade/i.test(_cn);
    const tgtSlot = _traceTgt || (!screen ? _fadeConcept && _outside.length ? _outside[0] : catchers.length ? catchers.reduce((a, b) => Math.abs(b.bx - side) < Math.abs(a.bx - side) ? b : a) : backs[0] : screenKind === "rb" ? backs[0] || catchers[0] : screenKind === "tunnel" ? _outside[0] || catchers[0] || backs[0] : _slotish[0] || catchers.find((s) => Math.abs(s.bx - 50) < 35) || catchers[0] || backs[0]);
    const typAir = t === "pass_deep" ? 27 : t === "pass_medium" ? 15 : 6;
    const air = screen ? -1.5 : p.complete && !p.turnover ? clamp6(((_h = p.yards) != null ? _h : 2) * 0.6, 2, typAir) : typAir;
    const _tbx = (_i = tgtSlot == null ? void 0 : tgtSlot.bx) != null ? _i : 50;
    const _toBoundary = _tbx <= 50 ? -1 : 1;
    const catchPt = !screen ? [clamp6(((_j = tgtSlot == null ? void 0 : tgtSlot.bx) != null ? _j : side) + (rnd() - 0.5) * 3, 4, 96), clamp6(LOS - air * YPU, 3, 40)] : screenKind === "tunnel" ? [clamp6(_tbx - _toBoundary * 10, 12, 88), LOS - 0.3] : screenKind === "rb" ? [clamp6(_tbx + (_tbx <= 50 ? -9 : 9), 6, 94), LOS + 1.8] : screenKind === "slip" ? [clamp6(_tbx - _toBoundary * 8, 6, 94), LOS + 0.8] : [clamp6(_tbx + _toBoundary * 6, 4, 96), LOS + 1.2];
    if (_throwAway) {
      // A thrown-away ball sails out toward the boundary — not to a receiver, and
      // nobody catches it. (Fix B: a heads-up QB dumps a covered ball to save the sack.)
      catchPt[0] = rnd() < 0.5 ? 7 : 93;
      catchPt[1] = clamp6(LOS - 5 * YPU, 3, 40);
    }
    // playtest item 9b — the catch point's downfield floor was a fixed y=3, blind
    // to where the play actually is. Near the goal line the back of the end zone
    // sits well above 3, so a deep ball (a pick especially, whose depth is the
    // fixed typical air distance) landed past the end line, in the stands, and the
    // interceptor's return then started from outside the field. Pull the catch
    // point up to the real back-of-end-zone board line for this field position.
    if (p.fieldPos != null && !screen) {
      const _backEZY = LOS - (100 - p.fieldPos) * YPU - 10 * YPU;
      if (catchPt[1] < _backEZY) catchPt[1] = _backEZY;
    }
    const _screenDelay = screenKind === "bubble" ? 0.15 : screenKind === "tunnel" ? 0.55 : screenKind === "slip" ? 0.5 : 0.62;
    const _catchDepthYds = Math.max(0, (LOS - catchPt[1]) / YPU);
    const _routeBreak = SNAP_END + clamp6(0.45 + _catchDepthYds / (SPD.WR * 1.4), 0.5, 2.1) + (p.playAction ? 0.3 : 0);
    const _pocketBreakdown = SNAP_END + (p.hurried ? clamp6(1.15 - (((_k = p.pressureIds) == null ? void 0 : _k.length) || 1) * 0.12, 0.6, 1.15) : 2.4);
    const throwAt = screen ? SNAP_END + _screenDelay : Math.max(SNAP_END + 0.45, Math.min(_routeBreak, _pocketBreakdown));
    const armF = p.qbArm != null ? clamp6(1 + (p.qbArm - 55) / 160, 0.86, 1.16) : 1;
    const _qbStartDepthU = Math.max(0, qbSlot.by - LOS);
    const _quickSet = screen || p.rpo || t === "pass_short" && !p.playAction;
    const _setDepthU = _quickSet ? _qbStartDepthU + 0.4 : t === "pass_deep" ? Math.max(_qbStartDepthU + 1.5, 5.4) : t === "pass_medium" ? Math.max(_qbStartDepthU + 1.1, 4.2) : (
      /* pass_short (3-step) */
      Math.max(_qbStartDepthU + 0.7, 3.2)
    );
    const _setY = LOS + _setDepthU;
    const _hitchU = clamp6((_setDepthU - _qbStartDepthU) * 0.16, 0, 0.9);
    const _fakeDur = p.playAction ? 0.3 : 0;
    const _dropStart = SNAP_END + _fakeDur;
    const _dropDur = clamp6((_setDepthU - _qbStartDepthU) / 6, 0.16, 0.85);
    const _setT = _dropStart + _dropDur;
    const _plantT = Math.max(_setT, throwAt - 0.16);
    const _bpSp = _quickSet ? 6.6 : 5.6;
    // [PLAYTEST 2026-08-12 item 9] THE FLUSHED THROW.
    // sim.js stamps `isScrambleThrow` on an off-schedule throw and nothing in the
    // codebase ever read it, so a QB driven off his spot rendered as a textbook
    // pocket dropback. Give him a lateral escape; the release point below accounts
    // for it, so the flight is solved from where he ACTUALLY lets it go.
    // [Creativity Tools MECHANIC] a designed bootleg rolls the QB toward the flood
    // side (a bigger, one-way move than a scramble flush); a scramble stays random.
    const _isBoot = !screen && /Boot/i.test(_cn);
    const _bootDir = _tbx >= 50 ? 1 : -1;
    const _flushX = _isBoot ? _bootDir * clamp6(5 + rnd() * 2, 5, 7) : p.isScrambleThrow && !screen ? (rnd() < 0.5 ? -1 : 1) * clamp6(3 + rnd() * 3, 3, 6) : 0;
    // The launch point, PREDICTED. This used to be solved from qbSlot — the QB's
    // pre-snap alignment — while the ball actually left his hand from the top of
    // the drop, several units away. The flight time (and the M21 speed floor that
    // depends on it) was therefore computed for a distance the ball never flew.
    const _relX = qbSlot.bx + _flushX;
    const _relY = _setY - _hitchU - (p.hurried ? 1.8 : 0.7) - 0.8;
    const _flightDist = Math.hypot(catchPt[0] - _relX, catchPt[1] - _relY);
    // M21: floor the flight time at the ball's speed cap (47u/s < the 50u/s
    // track cap) — the longest crossfield shots used to overrun the cap and
    // smear the pre-snap frames backward.
    const flight = Math.max(clamp6(_flightDist / (28 * armF), 0.22, 1.05), _flightDist / 47);
    const tCatch = throwAt + flight;
    const _throwStyle = selectThrowStyle({
      moving: Math.abs(_flushX) >= 2.5,
      rollout: _isBoot,
      hurried: !!p.hurried,
      reset: !!p.isScrambleThrow && !_isBoot,
      playAction: !!p.playAction,
      roll: visualRoll(p, 3)
    });
    throwCue = { start: Math.max(SNAP_END, throwAt - 0.34), release: throwAt, end: throwAt + 0.28, arm: (_l = p.qbArm) != null ? _l : null, style: _throwStyle };
    if (p.hurried && !screen) pressCue = { start: Math.max(SNAP_END + 0.25, throwAt - 0.5), end: throwAt + 0.05 };
    if (!screen && t === "pass_deep" && throwAt - SNAP_END > 1.35 && rnd() < 0.4) {
      const pt2 = SNAP_END + (throwAt - SNAP_END) * 0.45;
      pumpCue = { start: pt2 - 0.14, end: pt2 + 0.18 };
    }
    const yac = p.complete && !p.turnover ? clamp6(Math.abs(endY - catchPt[1]) / (SPD.WR * 0.92) + 0.2, 0.25, 3.2) : 0;
    const tEnd = p.turnover ? tCatch + 0.55 : tCatch + (p.complete ? yac : 0.12);
    dur = tEnd + LINGER;
    // M13 surfaces the quarterback timing already used by the track. The cue
    // never owns movement or release time; it only labels each existing phase
    // for the presentation layer.
    qbCue = {
      family: p.playAction ? "playaction" : _quickSet ? "quick" : t === "pass_deep" ? "five" : "three",
      hurried: !!p.hurried,
      start: PRESNAP,
      secureEnd: SNAP_END,
      meshEnd: _dropStart,
      dropStart: _dropStart,
      setStart: _setT,
      plantStart: _plantT,
      releaseStart: throwCue.start,
      release: throwAt,
      releaseEnd: throwCue.end,
      followEnd: Math.min(tCatch, throwAt + 0.48),
      rollout: _isBoot,
      rolloutDirection: _flushX < 0 ? "left" : _flushX > 0 ? "right" : null,
      escape: !!p.isScrambleThrow && !_isBoot,
      throwStyle: _throwStyle,
      playActionCarry: !!p.playAction
    };
    A.QB.behave = (t2) => {
      if (t2 < PRESNAP) return null;
      if (t2 < SNAP_END) return [qbSlot.bx, qbSlot.by, 3];
      if (p.playAction && t2 < _dropStart) return [qbSlot.bx - 1.5, qbSlot.by + 1.2, 4];
      if (_isBoot && t2 < throwAt) {
        const u = clamp6((t2 - _dropStart) / Math.max(0.18, throwAt - _dropStart), 0, 1);
        const ease = u * u * (3 - 2 * u);
        return [
          // Lead the desired launch point slightly so the arrival controller's
          // natural braking lands ON the release spot instead of short of it.
          qbSlot.bx + _flushX + Math.sign(_flushX) * 2.2,
          qbSlot.by + (_setY - _hitchU - 0.7 - qbSlot.by) * ease,
          clamp6(Math.abs(_flushX) / Math.max(0.35, throwAt - _dropStart) * 2, 7.5, 13)
        ];
      }
      if (t2 < _setT) return [qbSlot.bx, _setY, _bpSp];
      if (t2 < _plantT) return [qbSlot.bx, _setY - _hitchU, 2.4];
      if (t2 < throwAt) return [qbSlot.bx + _flushX, _setY - _hitchU - (p.hurried ? 1.8 : 0.7), _flushX ? 6.2 : p.hurried ? 4.6 : 3];
      return [qbSlot.bx + _flushX, _setY - _hitchU - 0.5, 1.8];
    };
    const shapes = CONCEPT_ROUTES[p.concept] || DEPTH_ROUTES[t] || DEPTH_ROUTES.pass_medium;
    const screenShape = screenKind === "bubble" ? "bubble" : screenKind === "tunnel" ? "tunnel" : screenKind === "slip" ? "slip" : null;
    // Stage 6 (Playbook-Root): a composed play ANIMATES AS DRAWN. app.js
    // resolves the recorded book play's authored routes onto the fielded slots
    // (the card's own resolver) and stamps p._composedRoutes — a per-slot
    // {part, flip} plan plus stay-in blockers. A slot with an authored route
    // runs ITS route (flip mirrors the break); a blocked receiver stays in;
    // everyone else keeps the concept/depth synthesis. Absent — every
    // non-composed play, and a composed clip on a machine without the play in
    // its library — nothing below changes.
    const _cRoutes = p._composedRoutes && p._composedRoutes.bySlot ? p._composedRoutes : null;
    const _cBlocks = _cRoutes && Array.isArray(_cRoutes.blocks) ? _cRoutes.blocks : [];
    const ordered = [...catchers].sort((a2, b2) => Math.abs(b2.bx - 50) - Math.abs(a2.bx - 50));
    ordered.forEach((s, i) => {
      if (_cRoutes && _cBlocks.includes(s.id) && s !== tgtSlot) {
        // Drawn as a blocker: he stays in — no route, no cue.
        A[s.id].behave = (t2) => t2 < PRESNAP ? null : [s.bx, LOS + 1, 3.2];
        return;
      }
      const _cr = _cRoutes ? _cRoutes.bySlot[s.id] : null;
      const _crShape = _cr ? COMPOSED_SHAPE[_cr.part] || null : null;
      const mid = (s.bx <= 50 ? 1 : -1) * (_cr && _cr.flip ? -1 : 1);
      const isScreenTgt = screen && s === tgtSlot && screenShape;
      const shape0 = isScreenTgt ? screenShape : _crShape || shapes[i % shapes.length];
      // Capstone P1: if the sim recorded a double move on the chosen throw,
      // the target draws the double-move version of his route — the sluggo
      // that actually beat the man, not a clean stem.
      const shape = s === tgtSlot && tr && tr.dbl && DBL_SHAPE[shape0] ? DBL_SHAPE[shape0] : shape0;
      const wps = routeWaypoints(shape, s.bx, s.by, mid);
      const vertical = ["go", "seam", "fade", "deepfade"].includes(shape);
      const double = ["sluggo", "postcorner", "outandup", "whip", "pivot"].includes(shape);
      const settle = ["curl", "comeback", "hitch", "stick"].includes(shape);
      let turnIdx = Math.min(1, wps.length - 1), turnScore = -1;
      for (let wi = 1; wi < wps.length - 1; wi++) {
        const ax = wps[wi][0] - wps[wi - 1][0], ay = wps[wi][1] - wps[wi - 1][1];
        const bx = wps[wi + 1][0] - wps[wi][0], by = wps[wi + 1][1] - wps[wi][1];
        const score = 1 - (ax * bx + ay * by) / ((Math.hypot(ax, ay) || 1) * (Math.hypot(bx, by) || 1));
        if (score > turnScore) {
          turnScore = score;
          turnIdx = wi;
        }
      }
      const turnPt = wps[turnIdx] || wps[0] || [s.bx, s.by];
      const nextPt = wps[Math.min(turnIdx + 1, wps.length - 1)] || turnPt;
      const turnDist = Math.hypot(turnPt[0] - s.bx, turnPt[1] - s.by);
      const breakAt2 = PRESNAP + clamp6(turnDist / Math.max(3.8, A[s.id].speed), 0.28, Math.max(0.3, throwAt - PRESNAP - 0.1));
      const family = vertical ? "vertical" : double ? "double" : settle ? "settle" : "cut";
      const direction = nextPt[0] < turnPt[0] ? "left" : nextPt[0] > turnPt[0] ? "right" : "straight";
      routeCues.push({
        id: s.id,
        shape,
        family,
        direction,
        target: s === tgtSlot,
        start: PRESNAP,
        releaseEnd: PRESNAP + (shape === "slant" || shape === "quickout" ? 0.16 : 0.24),
        breakStart: breakAt2 - 0.12,
        breakEnd: breakAt2 + (double ? 0.34 : 0.22),
        handsStart: s === tgtSlot && !_throwAway ? throwAt + flight * 0.38 : null,
        end: tCatch
      });
      const base = waypointBehavior(wps, A[s.id].speed, PRESNAP);
      A[s.id].behave = s === tgtSlot && !_throwAway && (!screen || screenShape) ? (t2, w2, a2) => t2 < PRESNAP ? null : t2 >= tCatch && p.complete && !p.turnover ? [catchPt[0], endY, schedSp(a2, [catchPt[0], endY], t2, tEnd, a2.speed)] : t2 >= (isScreenTgt ? throwAt : throwAt * 0.9) ? [catchPt[0], catchPt[1], a2.speed] : base(t2, w2, a2) : base;
    });
    for (const b of backs) {
      // Stage 6: a back given an authored downfield route (wheel, flat, …)
      // runs IT instead of the generic swing — unless the sim made him the
      // target (the recorded catch point always wins) or drew him a
      // screen/checkdown (the existing back handling IS that animation).
      const _crb = _cRoutes && b !== tgtSlot ? _cRoutes.bySlot[b.id] : null;
      if (_crb && _crb.part !== "screen" && _crb.part !== "checkdown" && A[b.id] !== A.QB && !A[b.id].behave) {
        const _shapeB = COMPOSED_SHAPE[_crb.part] || "flat";
        const _midB = (b.bx <= 50 ? 1 : -1) * (_crb.flip ? -1 : 1);
        A[b.id].behave = waypointBehavior(routeWaypoints(_shapeB, b.bx, b.by, _midB), A[b.id].speed, PRESNAP);
        continue;
      }
      if (_cRoutes && _cBlocks.includes(b.id) && b !== tgtSlot && A[b.id] !== A.QB && !A[b.id].behave) {
        A[b.id].behave = (t2) => t2 < PRESNAP ? null : [b.bx, LOS + 1.4, 3.2];
        continue;
      }
      if (screen && b === tgtSlot) {
        A[b.id].behave = (t2, w2, a2) => t2 < PRESNAP ? null : t2 >= tCatch && p.complete && !p.turnover ? [catchPt[0], endY, schedSp(a2, [catchPt[0], endY], t2, tEnd, a2.speed)] : [catchPt[0], catchPt[1], schedSp(a2, catchPt, t2, tCatch, 5.5)];
      } else if (b === tgtSlot && !_throwAway) {
        // Checkdown / swing to the back (Capstone P1 trace target): release to the
        // real catch point so the ball, the catch fx, and the receiver meet. The
        // old fallthrough sent him on the generic 14-unit swing while the ball and
        // fx played out at a phantom spot nobody occupied.
        A[b.id].behave = (t2, w2, a2) => t2 < PRESNAP ? null : t2 >= tCatch && p.complete && !p.turnover ? [catchPt[0], endY, schedSp(a2, [catchPt[0], endY], t2, tEnd, a2.speed)] : p.playAction && t2 < PRESNAP + 0.45 ? [qbSlot.bx, LOS + 1.5, 6] : [catchPt[0], catchPt[1], schedSp(a2, catchPt, t2, tCatch, 5.8)];
      } else if (A[b.id] !== A.QB && !A[b.id].behave) {
        A[b.id].behave = (t2) => t2 < PRESNAP ? null : p.playAction && t2 < PRESNAP + 0.45 ? [qbSlot.bx, LOS + 1.5, 6] : [clamp6(b.bx + (b.bx <= 50 ? -14 : 14), 4, 96), LOS + 1.2, 5.8];
      }
    }
    wireRush(p.blitzFired);
    if (!screen) for (const s of catchers) {
      if (s.pos !== "TE" || s === tgtSlot) continue;
      const edgeD = defs.filter((d) => d.grp === "DL").sort((a2, b2) => Math.abs(a2.slot.bx - s.bx) - Math.abs(b2.slot.bx - s.bx))[0];
      if (!edgeD) break;
      const inner = A[s.id].behave;
      A[s.id].behave = (t2, w2, a2) => t2 < PRESNAP ? null : t2 < PRESNAP + 0.4 ? [edgeD.x, edgeD.y + 0.7, 5.2] : inner ? inner(t2, w2, a2) : null;
      blocks.push({ offId: s.id, defId: edgeD.id, start: PRESNAP + 0.1, end: PRESNAP + 0.4, rep: "chip" });
      break;
    }
    if ((p.rbKeptIn === true || p.rbKeptIn == null && p.blitzFired) && !screen) {
      const dog = defs.find((d) => d.grp === "LB" && d.behave);
      const pb = backs.find((b2) => b2 !== tgtSlot && A[b2.id] && A[b2.id] !== A.QB);
      if (dog && pb) {
        A[pb.id].behave = (t2) => t2 < PRESNAP ? null : [(dog.x + A.QB.x) / 2, Math.min(A.QB.y - 1.2, (dog.y + A.QB.y) / 2), 6.2];
        blocks.push({ offId: pb.id, defId: dog.id, start: PRESNAP + 0.5, end: throwAt + 0.25, rep: "pickup" });
      } else if (pb && p.rbKeptIn === true) {
        A[pb.id].behave = (t2) => t2 < PRESNAP ? null : [A.QB.x + ((pb.bx || 50) <= 50 ? -2.2 : 2.2), A.QB.y - 1.8, 5.5];
      }
    }
    const ballAt = () => bl.x != null ? [bl.x, bl.y] : catchPt;
    wireCoverage(screen ? [] : catchers, screen ? tCatch : throwAt + flight * 0.5, () => ballAt(), tr && tgtSlot && !screen ? { tgtId: tgtSlot.id, sep: tr.sep != null ? tr.sep : 0.45, tgtPt: catchPt } : null);
    // Capstone P1: the recorded cover man for the UI/probe — the stamped
    // man-coverage pair when one exists, else the zone body on the target,
    // who anticipates the catch point instead of chasing the ball in flight.
    if (tr && tgtSlot && !screen && !_covActorId) {
      const _zp = (p.covSlots || []).find((cs) => cs.r === tgtSlot.id);
      if (_zp) {
        const _zd = defs.find((d2) => d2.id === "D_" + _zp.d);
        if (_zd) {
          _covActorId = _zd.id;
          const _prevZ = _zd.behave;
          _zd.behave = (t2, w2, a2) => t2 < throwAt ? _prevZ ? _prevZ(t2, w2, a2) : null : [catchPt[0], catchPt[1], a2.speed];
        }
      }
    }
    // Capstone P1: the robber — the sim recorded a two-high safety jumping
    // this throw. The nearer free safety abandons his zone ON the throw and
    // breaks to the catch point (undercutting the in-breaker), then returns
    // to whatever he was doing.
    if (tr && tr.rob && tgtSlot && !screen) {
      const robD = defs.filter((d2) => d2.grp === "S" && d2.id !== _covActorId).sort((a2, b2) => Math.abs(a2.slot.bx - tgtSlot.bx) - Math.abs(b2.slot.bx - tgtSlot.bx))[0] || null;
      if (robD) {
        const _prevRob = robD.behave;
        robD.behave = (t2, w2, a2) => t2 < throwAt ? _prevRob ? _prevRob(t2, w2, a2) : null : t2 < tCatch + 0.35 ? [catchPt[0], catchPt[1] - 1.2, a2.speed] : _prevRob ? _prevRob(t2, w2, a2) : null;
      }
    }
    if (screen) {
      if (screenKind === "bubble") {
        const sameSide = catchers.filter((s) => s !== tgtSlot && s.bx <= 50 === _tbx <= 50);
        const blocker = sameSide.sort((a, b) => Math.abs(b.bx - 50) - Math.abs(a.bx - 50))[0] || _outside.find((s) => s !== tgtSlot);
        if (blocker) {
          const corner = defs.filter((d) => d.grp === "DB" || d.grp === "S").sort((a, b) => Math.abs(a.x - blocker.bx) - Math.abs(b.x - blocker.bx))[0];
          A[blocker.id].behave = (t2) => {
            if (t2 < PRESNAP) return null;
            const tgt = corner ? [corner.x + _toBoundary * -1.2, corner.y + 0.6] : [blocker.bx + _toBoundary * 4, LOS + 2];
            return [tgt[0], tgt[1], 6];
          };
        }
      } else {
        const climbing = offs.filter((a) => a.slot.pos === "OL").slice(0, 2);
        climbing.forEach((o, i) => {
          o.behave = (t2) => t2 < throwAt - 0.15 ? [o.slot.bx, o.slot.by + 1.2, 3] : [catchPt[0] + (i ? 2 : -2), catchPt[1] - 2 - i, o.speed + 1];
        });
      }
    }
    carrier = p.complete && !p.turnover && tgtSlot ? A[tgtSlot.id] : null;
    // M21 ball-ownership cues (labels + hand-off truth for the render layer;
    // every location and time above still owns the motion).
    var ballCue = { kind: "pass", snapStart: PRESNAP, snapEnd: SNAP_END, holdEnd: throwAt, meshStart: null, meshEnd: null, fakeStart: p.playAction ? SNAP_END : null, fakeEnd: p.playAction ? _dropStart : null, release: throwAt, catch: tCatch };
    var carryCue = carrier ? { id: carrier.id, arm: catchPt[0] >= 50 ? "r" : "l", from: tCatch } : null;
    var _tgtActor = !_throwAway && tgtSlot && !p.turnover ? A[tgtSlot.id] : null;
    var _catchPtV = catchPt;
    if (carrier) {
      const chasers = defs.filter((d) => d.grp !== "DL").slice(0, 4);
      for (const d of chasers) {
        const prev = d.behave;
        d.behave = (t2, w2, a2) => t2 < tCatch ? prev ? prev(t2, w2, a2) : null : pursuePt(carrier, d, d.speed);
      }
    }
    const bl = { x: null, y: null };
    // Latched on the first frame of flight — see the note at the flight branch.
    let _relPt = null;
    ballPlan = (t2) => {
      let pt;
      const snap = snapFlight(t2, () => [A.QB.x, A.QB.y - 0.8]);
      if (t2 < PRESNAP) pt = [50, LOS + 0.6];
      else if (snap) pt = snap;
      else if (t2 < throwAt) {
        pt = [A.QB.x, A.QB.y - 0.8];
        // M21: play-action — the ball extends toward the faking back's belly
        // and withdraws, a real mesh fake instead of a static hold.
        if (p.playAction && _dropStart > SNAP_END && t2 < _dropStart) {
          const uF = clamp6((t2 - SNAP_END) / (_dropStart - SNAP_END), 0, 1);
          pt = [pt[0], pt[1] - Math.sin(uF * Math.PI) * 1.1];
        }
      }
      else if (t2 < tCatch) {
        const u = (t2 - throwAt) / flight;
        // [PLAYTEST 2026-08-12 item 9] LATCH THE RELEASE POINT. `ox/oy` used to be
        // re-read from the live QB every frame, so the already-flown part of the
        // arc rebased onto wherever he had drifted to — a moving passer physically
        // dragged the ball sideways with him. Worse, the bow sign below is decided
        // by `catchPt[0] >= ox`, which could FLIP mid-flight the moment he crossed
        // the catch point's x, snapping the arc to the other side of the throw
        // line. That discontinuity is the "wonky" in the report. A thrown ball has
        // one origin; take it once, on the first frame of flight.
        if (!_relPt) _relPt = [A.QB.x, A.QB.y - 0.8];
        const ox = _relPt[0], oy = _relPt[1];
        const lx = ox + (catchPt[0] - ox) * u;
        const ly = oy + (catchPt[1] - oy) * u;
        const dx = catchPt[0] - ox, dy = catchPt[1] - oy;
        const fd = Math.hypot(dx, dy) || 1;
        const bow = screen ? 0 : clamp6(fd * (t === "pass_deep" ? 0.1 : t === "pass_short" ? 0.045 : 0.07) * (2 - armF), 0, 2);
        const off2 = Math.sin(u * Math.PI) * bow * (catchPt[0] >= ox ? 1 : -1);
        pt = [lx + -dy / fd * off2, ly + dx / fd * off2];
      } else if (carrier) pt = [carrier.x, carrier.y];
      else if (p.turnover) {
        const picker2 = defs.find((d2) => d2.picked);
        pt = picker2 ? [picker2.x, picker2.y] : catchPt;
      } else pt = catchPt;
      bl.x = pt[0];
      bl.y = pt[1];
      return pt;
    };
    if (p.turnover) {
      // M21: the sim's credited interceptor makes the pick when his slot
      // exists in this front (p.ballSlots.pick, recording-only stamp);
      // proximity remains the fallback for pre-stamp saves and cross-front
      // gaps — the M20 tackler-truth pattern applied to the ball.
      let best = p.ballSlots && p.ballSlots.pick ? defs.find((d2) => d2.slot.id === p.ballSlots.pick) || null : null;
      // M25: deep-help truth. The engine's helper/robber legs (Capstone P1)
      // regularly credit the DEEP SAFETY with the pick, and from a static
      // center-field alignment he can never beat the ball to a sideline
      // catch point — the feasibility gate was dumping ~2/3 of stamped
      // picks onto proximity stand-ins (retention diag, 2026-08-11). Real
      // safeties rotate to the passing strength before the snap: shade the
      // credited deep man's ALIGNMENT toward the throw side, bounded so it
      // stays a pre-snap shuffle, not a teleport. Wiring-time only — his
      // track is built from the shaded spot, so no mid-play jump exists.
      if (best && best.y <= LOS - 8 * 0.85) {
        const lat = catchPt[0] - best.x;
        if (Math.abs(lat) > 6) {
          best.x = clamp6(best.x + Math.max(-14, Math.min(14, lat * 0.55)), 2, 98);
        }
      }
      // M25: on a tip-drill the picker's deadline is the CAROM (tip + 0.55s),
      // not the catch — a deep safety who can reach the carom is feasible.
      // And the proximity fallback must never hand the pick to the TIPPER,
      // or the chain collapses back into one man.
      const _tipSlotId = p.tipDrill && p.ballSlots && p.ballSlots.pbu && p.ballSlots.pbu !== p.ballSlots.pick ? p.ballSlots.pbu : null;
      const _pickWindow = tCatch - PRESNAP + (_tipSlotId ? 0.55 : 0);
      // Feasibility gate AT WIRING TIME: a credited man whose alignment can't
      // plausibly cover the ground to the catch point would put the post-
      // catch ball on a far body and let the end constraint drag the whole
      // track (found by the probe: pre-snap frames smeared 4+ units).
      if (best && Math.hypot(best.x - catchPt[0], best.y - catchPt[1]) > _pickWindow * best.speed * 0.75) best = null;
      let bd = 1e9;
      if (!best) for (const d of defs) {
        if (_tipSlotId && d.slot.id === _tipSlotId) continue;
        const dd = (d.x - catchPt[0]) ** 2 + (d.y - catchPt[1]) ** 2;
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      // M25: tip-drill chain — the sim credited BOTH a tipper (ballSlots.pbu)
      // and a picker on one play. Stage the swat at the catch point, a short
      // carom, and the pick ~0.55s later; either man infeasible from this
      // front's alignment → the plain single-event pick below (fallback
      // intact, the M21 rule).
      var _tipCue = null, _tipT = null, _tipPt = null;
      if (p.tipDrill && best && p.ballSlots && p.ballSlots.pbu && p.ballSlots.pbu !== p.ballSlots.pick) {
        const dTip = defs.find((d2) => d2.slot.id === p.ballSlots.pbu) || null;
        if (dTip && dTip !== best && Math.hypot(dTip.x - catchPt[0], dTip.y - catchPt[1]) <= (tCatch - PRESNAP) * dTip.speed * 0.75) {
          _tipT = tCatch + 0.55;
          _tipPt = [clamp6(catchPt[0] + (rnd() - 0.5) * 5, 3, 97), clamp6(catchPt[1] + 1.5 + rnd() * 2.2, 2, 59)];
          _tipCue = { id: dTip.id, t: tCatch };
          const prevT = dTip.behave;
          dTip.behave = (t2, w2, a2) => t2 < throwAt ? prevT ? prevT(t2, w2, a2) : null : t2 < tCatch ? [catchPt[0], catchPt[1], dTip.speed] : [catchPt[0] + (dTip.x >= catchPt[0] ? 4 : -4), catchPt[1] - 2, dTip.speed * 0.7];
        }
      }
      if (best) {
        best.picked = true;
        var _intPicker = best;
        const prev = best.behave;
        const tGrab = _tipT != null ? _tipT : tCatch;
        const grabPt = _tipPt != null ? _tipPt : catchPt;
        // M25: the picker BREAKS ON HIS READ, ~0.9s before the release (the
        // robber mechanism made visible) — with convergence starting at the
        // throw itself, a credited deep man had ~1s of pursuit against a
        // 3s feasibility budget and the ride check dumped him to a
        // stand-in anyway. Break-at-read closes the gate/behavior mismatch.
        const tBreak = Math.max(PRESNAP + 0.35, throwAt - 0.9);
        // playtest item 9b — the sim awards no return on an end-zone pick; it is
        // a touchback. Don't fabricate a 6-unit return that starts from outside
        // the end line — the picker secures it and kneels at the spot.
        const _retFwd = p.intTouchback ? 0 : 6;
        const _retLat = p.intTouchback ? 0 : rnd() < 0.5 ? -6 : 6;
        best.behave = (t2, w2, a2) => t2 < tBreak ? prev ? prev(t2, w2, a2) : null : t2 < tGrab ? [grabPt[0], grabPt[1], best.speed] : [grabPt[0] + _retLat, grabPt[1] + _retFwd, p.intTouchback ? 0 : best.speed];
        for (const s of catchers) {
          const pr = A[s.id].behave;
          A[s.id].behave = (t2, w2, a2) => t2 < tGrab + 0.22 ? pr ? pr(t2, w2, a2) : null : pursuePt(best, a2, a2.speed * 0.95);
        }
      }
      if (_tipT != null) {
        fx.push({ t: _tipT, kind: "int", x: _tipPt[0], y: _tipPt[1] });
      } else {
        _tipCue = null; _tipT = null; _tipPt = null;
        fx.push({ t: tCatch, kind: "int", x: catchPt[0], y: catchPt[1] });
      }
    } else if (!p.complete) {
      fx.push({ t: tCatch, kind: "inc", x: catchPt[0], y: catchPt[1] });
    } else {
      fx.push({ t: tCatch, kind: "catch", x: catchPt[0], y: catchPt[1] });
      fx.push({ t: tEnd, kind: p.td ? "td" : "tackle", x: catchPt[0], y: endY });
      if (!p.td && p.distance != null && (p.yards || 0) >= p.distance)
        fx.push({ t: tEnd + 0.35, kind: "fd", x: catchPt[0], y: endY });
    }
    if (p.complete && !p.turnover && ((_m = p.yards) != null ? _m : 0) >= 15) {
      var beatenAt = tCatch, beatenPt = catchPt;
    }
    var endInfo = carrier ? { actor: carrier, at: tEnd, pt: [catchPt[0], endY] } : null;
    var ballEnd = carrier ? { at: tEnd, pt: [catchPt[0], endY] } : { at: tCatch, pt: catchPt };
    var _catchT = tCatch;
  } else if (isPass && p.sack) {
    const tSack = PRESNAP + 1.45;
    dur = tSack + LINGER;
    const sackPt = [clamp6(qbSlot.bx + (rnd() - 0.5) * 6, 6, 94), endY];
    A.QB.behave = (t2, w2, a2) => t2 < PRESNAP ? null : t2 < PRESNAP + 0.4 ? [qbSlot.bx, qbSlot.by + 3.4, 5.5] : [sackPt[0], sackPt[1], schedSp(a2, sackPt, t2, tSack, 4.4)];
    const catchers = off.filter((s) => s.catch && s.pos !== "RB" && s.pos !== "FB");
    const shapes = CONCEPT_ROUTES[p.concept] || DEPTH_ROUTES[t] || DEPTH_ROUTES.pass_medium;
    [...catchers].sort((a2, b2) => Math.abs(b2.bx - 50) - Math.abs(a2.bx - 50)).forEach((s, i) => {
      A[s.id].behave = waypointBehavior(routeWaypoints(shapes[i % shapes.length], s.bx, s.by, s.bx <= 50 ? 1 : -1), A[s.id].speed, PRESNAP);
    });
    wireRush(p.blitzFired);
    wireCoverage(catchers, null, () => [50, 20]);
    fx.push({ t: tSack, kind: "sack", x: sackPt[0], y: sackPt[1] });
    carrier = A.QB;
    var ballCue = { kind: "sack", snapStart: PRESNAP, snapEnd: SNAP_END, holdEnd: SNAP_END, meshStart: null, meshEnd: null, fakeStart: null, fakeEnd: null, release: null, catch: null };
    var carryCue = { id: "QB", arm: sackPt[0] >= 50 ? "r" : "l", from: SNAP_END };
    ballPlan = (t2) => {
      if (t2 < PRESNAP) return [50, LOS + 0.6];
      const snap = snapFlight(t2, () => [A.QB.x, A.QB.y - 0.8]);
      return snap || [A.QB.x, A.QB.y - 0.8];
    };
    var endInfo = { actor: A.QB, at: tSack, pt: sackPt };
    var ballEnd = { at: tSack, pt: [sackPt[0], sackPt[1] - 0.8] };
  } else {
    const scheme = !p.optionPhase && !p.isScramble ? RUN_SCHEMES[p.concept] || RUN_SCHEMES[RUN_ALIAS[p.concept]] || null : null;
    let dir = p.runDir === "left" ? -1 : p.runDir === "right" ? 1 : rnd() < 0.5 ? -1 : 1;
    let lane = p.optionPhase === "jet" ? p.runDir === "left" ? 8 : 92 : p.isScramble ? seeded(p)() < 0.5 ? 24 : 76 : scheme ? clamp6(50 + dir * scheme.gap, 6, 94) : p.runDir === "left" ? t === "run_outside" ? 13 : 33 : p.runDir === "right" ? t === "run_outside" ? 87 : 67 : 50;
    let endPt = [clamp6(lane + (rnd() - 0.5) * 4, 3, 97), endY];
    const backs = off.filter((s) => s.pos === "RB" || s.pos === "FB" || s.pos === "WING" || s.pos === "ABACK" || s.pos === "WILDCAT");
    const deepBack = backs.length ? backs.reduce((a2, b2) => b2.by > a2.by ? b2 : a2) : null;
    const _jetMan = () => {
      const wrs = off.filter((s) => s.pos === "WR" || s.pos === "SLOT" || s.pos === "JETMAN");
      if (!wrs.length) return off.find((s) => s.id === "RB_2") || deepBack || qbSlot;
      return wrs.sort((a2, b2) => p.runDir === "left" ? a2.bx - b2.bx : b2.bx - a2.bx)[0];
    };
    let carrierSlot = p.carrierSlotId && off.find((s) => s.id === p.carrierSlotId) || (p.optionPhase === "wildcat" ? off.find((s) => s.pos === "WILDCAT") || deepBack || qbSlot : p.optionPhase === "jet" ? _jetMan() : p.optionPhase === "dive" ? off.find((s) => s.pos === "FB") || deepBack || qbSlot : p.optionPhase === "keep" ? qbSlot : p.optionPhase === "pitch" ? off.filter((s) => s.pos === "WING" || s.pos === "ABACK").sort((a2, b2) => a2.bx - b2.bx)[p.runDir === "left" ? 0 : 1] || deepBack || qbSlot : p.isQBDesignedRun || p.isScramble || !deepBack ? qbSlot : deepBack);
    carrier = A[carrierSlot.id];
    const directSnap = p.optionPhase === "wildcat";
    const isJet = p.optionPhase === "jet";
    // Jet sweep runs ACROSS the formation, the way the motion man is already going.
    // Derive the sweep side from HIS alignment (not runDir), so the motion to the
    // mesh and the sweep are one continuous move — otherwise he reaches the mesh and
    // reverses back the way he came.
    const _jetDir = isJet ? (carrierSlot.bx < 50 ? 1 : -1) : dir;
    if (isJet) {
      dir = _jetDir;
      lane = _jetDir > 0 ? 92 : 8;
      endPt = [clamp6(lane + (rnd() - 0.5) * 4, 3, 97), endY];
    }
    const _qbX = qbSlot.bx;
    const jetMeshX = Math.abs(_qbX - 50) < 20 ? _qbX + (_jetDir < 0 ? -2 : 2) : 50 + (_jetDir < 0 ? -2 : 2);
    const jetMeshPt = isJet ? [jetMeshX, LOS + 2.2] : null;
    const meshAt = directSnap ? SNAP_END : isJet ? SNAP_END + 0.18 : SNAP_END + (p.optionPhase === "draw" ? 0.55 : p.isScramble ? 0.85 : 0.28);
    if (isJet) carrier.speed = Math.max(carrier.speed, 8);
    const pitchAt = p.optionPhase === "pitch" ? SNAP_END + 0.85 : null;
    const HANDOFF = 0.14;
    const _backSide = carrierSlot.bx <= qbSlot.bx ? -1 : 1;
    const meshPt = [qbSlot.bx + _backSide * 0.9, qbSlot.by + 0.5];
    const givePt = isJet && jetMeshPt ? jetMeshPt : meshPt;
    const holePt = [lane, LOS + 1.6];
    const runDist = Math.hypot(holePt[0] - carrierSlot.bx, holePt[1] - carrierSlot.by) + Math.hypot(endPt[0] - holePt[0], endPt[1] - holePt[1]) + (p.isScramble ? 7 : p.optionPhase === "pitch" ? 6 : p.optionPhase === "jet" ? 4 : 0);
    // [PLAYTEST 2026-08-12 item 9c] Was `runDist / (speed * 0.92) + 0.35`. The
    // 0.92 derate double-counted a ramp-up that stepAgent's acceleration already
    // models, and 0.35s of dead time dominated short runs — a typical 11-unit
    // inside run scheduled ~76% of the back's top speed before the governor
    // above even got to trim it. The additive is real (the exchange costs a
    // beat), just not that big.
    const tEnd = meshAt + clamp6(runDist / carrier.speed + 0.22, 0.75, 7);
    dur = tEnd + LINGER;
    const hole = holePt;
    const stretchPt = scheme && scheme.stretch ? [clamp6(50 + dir * (10 + scheme.stretch * 22), 6, 94), LOS + 3.4] : null;
    const readAt = scheme ? meshAt + 0.1 + scheme.press * 0.06 : null;
    carrier.behave = (t2) => {
      if (t2 < PRESNAP) return null;
      if (p.isScramble && t2 < meshAt) return [qbSlot.bx, qbSlot.by + 3.2, 5.5];
      if (pitchAt && t2 < pitchAt) return [carrierSlot.bx + (endPt[0] - carrierSlot.bx) * 0.3, carrierSlot.by, carrier.speed * 0.8];
      if (isJet && t2 < meshAt) return [jetMeshPt[0], jetMeshPt[1], 8];
      if (t2 < meshAt + HANDOFF && !p.isScramble && carrierSlot.id !== "QB" && !isJet && !directSnap) return [meshPt[0], meshPt[1], carrier.speed * (t2 < meshAt ? 0.82 : 0.66)];
      if (stretchPt && t2 < readAt) return [stretchPt[0], stretchPt[1], carrier.speed * 0.94];
      const past = carrier.y <= hole[1] + 0.5;
      const floorSp = isJet ? 7.8 : 0;
      return past ? [endPt[0], endPt[1], Math.max(floorSp, schedSp(carrier, endPt, t2, tEnd, carrier.speed, CARRIER_SP_FLOOR))] : [hole[0], hole[1], Math.max(floorSp, carrier.speed)];
    };
    if (isJet) {
      const fromX = carrierSlot.bx, fromY = carrierSlot.by;
      const prev = carrier.behave;
      carrier.behave = (t2, w2, a2) => {
        if (t2 < meshAt) {
          const u = clamp6(t2 / meshAt, 0, 1);
          const e = u * u * (3 - 2 * u);
          a2.x = fromX + (jetMeshPt[0] - fromX) * e;
          a2.y = fromY + (jetMeshPt[1] - fromY) * e;
          a2.vx = 0;
          a2.vy = 0;
          return null;
        }
        return prev(t2, w2, a2);
      };
    }
    if (carrier !== A.QB) {
      const _bootDir = -dir;
      if (directSnap) {
        A.QB.behave = (t2) => t2 < PRESNAP ? null : [clamp6(qbSlot.bx + (qbSlot.bx <= 50 ? -6 : 6), 4, 96), qbSlot.by + 0.8, 4.2];
      } else {
        A.QB.behave = (t2) => t2 < PRESNAP ? null : t2 < SNAP_END ? [qbSlot.bx, qbSlot.by, 3] : t2 < meshAt ? [givePt[0], givePt[1], 4.6] : t2 < meshAt + HANDOFF ? [givePt[0], givePt[1], 2.4] : t2 < meshAt + HANDOFF + 0.55 ? [qbSlot.bx + _bootDir * 5, qbSlot.by + (p.optionPhase === "draw" ? 3 : 1.3), 4.2] : [qbSlot.bx + _bootDir * 7.5, qbSlot.by + 2.2, 3.2];
      }
    }
    if (pitchAt) {
      A.QB.behave = (t2) => t2 < PRESNAP ? null : t2 < pitchAt ? [lane > 50 ? lane - 12 : lane + 12, LOS + 2.5, 6.2] : [A.QB.x, A.QB.y, 2];
      fx.push({ t: pitchAt, kind: "pitch", x: 0, y: 0 });
    }
    const ols = offs.filter((a2) => a2.slot.pos === "OL").sort((a2, b2) => a2.slot.bx - b2.slot.bx);
    const doPull = scheme && scheme.pull || p.pulled;
    const puller = doPull && ols.length >= 4 ? dir > 0 ? ols[1] : ols[ols.length - 2] : null;
    const frontPool = defs.filter((d) => d.grp === "DL");
    const backerPool = defs.filter((d) => d.grp === "LB").sort((a2, b2) => Math.abs(a2.slot.bx - lane) - Math.abs(b2.slot.bx - lane));
    const usedBlockers = /* @__PURE__ */ new Set();
    const runBlocks = /* @__PURE__ */ new Map();
    const blockGain = clamp6(p.yards || 0, -5, 25);
    const sustain = clamp6(0.58 + Math.max(0, blockGain) * 0.06, 0.42, 2.1);
    for (const o of ols) {
      let choices = frontPool.filter((d2) => !usedBlockers.has(d2.id));
      if (!choices.length) choices = backerPool.filter((d2) => !usedBlockers.has(d2.id));
      const targetX = o === puller ? lane : o.slot.bx;
      const d = choices.sort((a2, b2) => Math.abs(a2.slot.bx - targetX) - Math.abs(b2.slot.bx - targetX))[0];
      if (!d) {
        const shade = Math.sign(o.slot.bx - lane) || -dir || 1;
        o.behave = (t2) => t2 < PRESNAP ? null : [clamp6((carrier.x + lane) * 0.5 + shade * 2.2, 4, 96), clamp6(carrier.y - 2, 4, LOS - 0.8), o.speed + 0.35];
        continue;
      }
      usedBlockers.add(d.id);
      const secondLevel = d.grp === "LB";
      const isPuller = o === puller;
      const wash = Math.sign(d.slot.bx - lane) || Math.sign(o.slot.bx - lane) || -dir || 1;
      const meetX = clamp6(isPuller ? lane - dir * 1.5 : secondLevel ? lane + wash * 2 : o.slot.bx * 0.58 + d.slot.bx * 0.42, 4, 96);
      const meetY = isPuller ? LOS - 0.2 : secondLevel ? LOS - 3 : LOS + 0.15;
      const engageAt = isPuller ? meshAt + 0.38 : PRESNAP + (secondLevel ? 0.62 : 0.18) + rnd() * 0.1;
      const releaseAt = Math.min(
        tEnd - 0.12,
        Math.max(engageAt + 0.34, PRESNAP + sustain + (secondLevel ? 0.28 : 0) + rnd() * 0.16)
      );
      const driveX = clamp6(meetX + wash * (1.5 + Math.max(0, blockGain) * 0.035), 3, 97);
      const driveY = secondLevel ? LOS - 4.8 : LOS - 1.35 - Math.max(0, blockGain) * 0.018;
      const phase = rnd() * Math.PI * 2;
      const repType = isPuller ? scheme && scheme.pull === "trap" ? "trap" : "pull" : secondLevel ? "climb" : scheme && scheme.stretch >= 0.6 ? rnd() < 0.18 ? "cut" : "reach" : wash * dir < 0 ? "down" : "drive";
      const rep = { o, d, meetX, meetY, driveX, driveY, wash, engageAt, releaseAt };
      runBlocks.set(d.id, rep);
      blocks.push({ offId: o.id, defId: d.id, start: engageAt, end: releaseAt, rep: repType });
      if (blocks.length <= 3) fx.push({ t: engageAt, kind: "block", x: meetX, y: meetY });
      const comboFrom = secondLevel && scheme && (scheme.lead || scheme.pull) ? [...runBlocks.values()].filter((r) => r.d.grp === "DL").sort((r1, r2) => Math.abs(r1.o.slot.bx - o.slot.bx) - Math.abs(r2.o.slot.bx - o.slot.bx))[0] || null : null;
      o.behave = (t2) => {
        if (t2 < PRESNAP) return null;
        if (isPuller && t2 < meshAt + 0.18) {
          const trap = scheme && scheme.pull === "trap";
          return [clamp6(50 + dir * (trap ? 4 : 9), 4, 96), LOS + 0.9, o.speed + 1.6];
        }
        if (comboFrom && t2 > PRESNAP + 0.12 && t2 < engageAt - 0.08)
          return [comboFrom.meetX + wash * 0.9, comboFrom.meetY + 0.3, o.speed + 0.3];
        if (t2 < engageAt) return [meetX, meetY + 0.75, o.speed + (secondLevel ? 0.45 : 0)];
        if (t2 < releaseAt) {
          const u = clamp6((t2 - engageAt) / Math.max(0.2, releaseAt - engageAt), 0, 1);
          return [
            meetX + (driveX - meetX) * u + Math.sin(t2 * 13 + phase) * 0.18,
            meetY + (driveY - meetY) * u,
            o.speed
          ];
        }
        return [
          clamp6((carrier.x + lane) * 0.5 + wash * 2, 4, 96),
          clamp6(carrier.y - 2.2, 4, LOS - 0.8),
          o.speed + 0.4
        ];
      };
    }
    if (scheme && scheme.lead) {
      const leadBack = backs.filter((s) => A[s.id] !== carrier).sort((a2, b2) => b2.by - a2.by)[0];
      if (leadBack && A[leadBack.id]) {
        A[leadBack.id].behave = (t2) => t2 < PRESNAP ? null : t2 < meshAt + 0.3 ? [qbSlot.bx + dir * 1.5, LOS + 2.5, 6] : [lane, LOS + 0.6, 6.2];
      }
    }
    const isOption = ["dive", "keep", "pitch"].includes(p.optionPhase);
    if (isOption) {
      const optDir = dir || (p.runDir === "left" ? -1 : 1);
      const edgeX = clamp6(50 + optDir * 18, 8, 92);
      const meshBackfield = [qbSlot.bx, LOS + 2.6];
      const isSpeed = String(p.concept || "").includes("Speed") || String(p.type || "") === "run_outside" && !off.find((s) => s.pos === "FB");
      const fbSlot = off.find((s) => s.pos === "FB" || s.id === "FB");
      if (!isSpeed && fbSlot && A[fbSlot.id] && A[fbSlot.id] !== carrier) {
        A[fbSlot.id].behave = (t2) => t2 < PRESNAP ? null : t2 < meshAt + 0.15 ? [qbSlot.bx + optDir * 0.5, LOS + 1.4, 6] : [clamp6(50 + optDir * 5, 8, 92), LOS - 1, 6];
      }
      if (A.QB !== carrier) {
        A.QB.behave = (t2) => t2 < PRESNAP ? null : t2 < meshAt + 0.1 ? [meshBackfield[0], meshBackfield[1], 5.5] : [edgeX, LOS + 2.2, 6.4];
      }
      const pitchManSlot = off.filter((s) => (s.pos === "RB" || s.pos === "WING" || s.pos === "ABACK") && A[s.id] !== carrier && s !== fbSlot).sort((a2, b2) => optDir > 0 ? b2.bx - a2.bx : a2.bx - b2.bx)[0];
      if (pitchManSlot && A[pitchManSlot.id] && A[pitchManSlot.id] !== carrier) {
        A[pitchManSlot.id].behave = (t2) => t2 < PRESNAP ? null : [clamp6(edgeX + optDir * 4, 6, 94), LOS + 4.2, 6.2];
      }
    }
    for (const s of off) {
      if (A[s.id].behave || s.pos === "OL") continue;
      if (s.catch) A[s.id].behave = (t2) => t2 < PRESNAP ? null : [s.bx + (s.bx <= 50 ? 2 : -2), s.by - 5, 5.5];
    }
    const react = { DL: 0.05, LB: 0.28, S: 0.65, DB: 1 };
    const bigRun = p.breakaway || (p.yards || 0) >= 25;
    for (const d of defs) {
      const delay = PRESNAP + ((_n = react[d.grp]) != null ? _n : 0.4);
      const spCap = d.grp === "DL" ? 3.4 : d.speed;
      const block = runBlocks.get(d.id);
      const readStep = (rnd() - 0.5) * 1.6;
      d.behave = (t2) => {
        if (t2 < delay) {
          if (d.grp === "LB" && t2 > PRESNAP) return [d.slot.bx + readStep, d.slot.by + 0.5, 2];
          return d.home ? [d.home[0], d.home[1], d.speed * 0.7] : null;
        }
        if (block && t2 < block.engageAt) return [block.meetX, block.meetY - 0.75, spCap];
        if (block && t2 < block.releaseAt) {
          return [block.o.x + block.wash * 0.55, block.o.y - 0.9, Math.min(spCap, 3.2)];
        }
        if (d.grp === "LB" && carrier.y > LOS - 0.5) {
          const lp = pursuePt(carrier, d, spCap);
          return [lp[0], clamp6(carrier.y - 3.5, 26, 30), spCap];
        }
        if (bigRun && d.y - carrier.y > 7) return pursuePt(carrier, d, spCap * 0.78);
        return pursuePt(carrier, d, spCap);
      };
    }
    const jetHandler = () => Math.abs(A.QB.x - 50) < 20 ? [A.QB.x, A.QB.y - 0.8] : [jetMeshPt[0], jetMeshPt[1]];
    ballPlan = isJet ? (t2) => {
      if (t2 < PRESNAP) return [50, LOS + 0.6];
      const snap = snapFlight(t2, jetHandler);
      if (snap) return snap;
      if (t2 < meshAt) return jetHandler();
      if (t2 < meshAt + HANDOFF) {
        const u = (t2 - meshAt) / HANDOFF, h = jetHandler();
        return [h[0] + (carrier.x - h[0]) * u, h[1] + (carrier.y - h[1]) * u];
      }
      return [carrier.x, carrier.y];
    } : directSnap ? (t2) => {
      if (t2 < PRESNAP) return [50, LOS + 0.6];
      const snap = snapFlight(t2, () => [carrier.x, carrier.y]);
      return snap || [carrier.x, carrier.y];
    } : pitchAt ? (t2) => {
      if (t2 < PRESNAP) return [50, LOS + 0.6];
      const snap = snapFlight(t2, () => [A.QB.x, A.QB.y - 0.8]);
      if (snap) return snap;
      if (t2 < pitchAt) return [A.QB.x, A.QB.y - 0.8];
      // M21: pitch flight scales with the real gap to the pitch man — the
      // fixed 0.18s window outran the ball's speed cap on wide pitches.
      if (_exchT == null) {
        const gap = Math.hypot(carrier.x - A.QB.x, carrier.y - A.QB.y);
        _exchT = Math.max(0.18, Math.min(0.9, gap / 42));
        _exchFrom = [A.QB.x, A.QB.y];
        _exchPitch = true;
      }
      if (t2 < pitchAt + _exchT) {
        const u = (t2 - pitchAt) / _exchT;
        return [_exchFrom[0] + (carrier.x - _exchFrom[0]) * u, _exchFrom[1] + (carrier.y - _exchFrom[1]) * u - Math.sin(u * Math.PI) * 0.9];
      }
      return [carrier.x, carrier.y];
    } : (t2) => {
      if (t2 < PRESNAP) return [50, LOS + 0.6];
      const snap = snapFlight(t2, () => [A.QB.x, A.QB.y - 0.8]);
      if (snap) return snap;
      if (t2 < meshAt) return [A.QB.x, A.QB.y - 0.8];
      // M21: the exchange window scales with the REAL gap at the mesh frame.
      // A back in the QB's hip pocket gets the 0.14s belly handoff; a carrier
      // aligned wide (Flexbone/Power-I wings) gets a pitch-length flight the
      // ball can actually cover — the old fixed window teleported the ball
      // 20+ units in 0.14s and the speed cap smeared it back through the
      // QB's hold.
      if (_exchT == null) {
        const gap = Math.hypot(carrier.x - A.QB.x, carrier.y - (A.QB.y - 0.8));
        _exchT = Math.max(HANDOFF, Math.min(0.9, gap / 40));
        _exchFrom = [A.QB.x, A.QB.y - 0.8];
        _exchPitch = gap > 6;
      }
      if (t2 < meshAt + _exchT) {
        const u = (t2 - meshAt) / _exchT, ox = _exchFrom[0], oy = _exchFrom[1];
        const lift = _exchPitch ? Math.sin(u * Math.PI) * 0.9 : 0;
        return [ox + (carrier.x - ox) * u, oy + (carrier.y - oy) * u - lift];
      }
      return [carrier.x, carrier.y];
    };
    if (p.turnover) fx.push({ t: tEnd, kind: "fum", x: endPt[0], y: endPt[1] });
    else {
      fx.push({ t: tEnd, kind: p.td ? "td" : "tackle", x: endPt[0], y: endPt[1] });
      if (!p.td && p.distance != null && (p.yards || 0) >= p.distance)
        fx.push({ t: tEnd + 0.35, kind: "fd", x: endPt[0], y: endPt[1] });
    }
    var endInfo = { actor: carrier, at: tEnd, pt: endPt };
    var ballEnd = { at: tEnd, pt: endPt };
    var _ballFloorFrame = Math.round(meshAt / STEP);
    // M21 ball-ownership cues: who has it, from when, in which arm (sideline-
    // protection rule — ball in the arm toward the sideline he's attacking).
    var carryCue = {
      id: carrier.id,
      arm: endPt[0] >= 50 ? "r" : "l",
      from: pitchAt ? pitchAt + 0.18 : directSnap ? SNAP_END : carrier === A.QB ? SNAP_END : meshAt + HANDOFF
    };
    // Exchange-window state, resolved at the mesh/pitch frame during assembly
    // (the real gap is only known then); carryCue/ballCue are patched after
    // the assembly loop when the window stretched beyond the stock timing.
    var _exchT = null, _exchFrom = null, _exchPitch = false;
    var ballCue = {
      kind: "run",
      snapStart: PRESNAP,
      snapEnd: SNAP_END,
      holdEnd: pitchAt ? pitchAt : directSnap || carrier === A.QB ? SNAP_END : meshAt,
      meshStart: pitchAt ? pitchAt : directSnap || carrier === A.QB ? null : meshAt,
      meshEnd: pitchAt ? pitchAt + 0.18 : directSnap || carrier === A.QB ? null : meshAt + HANDOFF,
      fakeStart: null,
      fakeEnd: null,
      release: null,
      catch: null
    };
  }
  const everyone = [...offs, ...defs];
  everyone.sort((a2, b2) => a2 === carrier ? -1 : b2 === carrier ? 1 : 0);
  // [PLAYTEST 2026-08-12 item 9c] Hand the physics this play's real back-of-end-
  // zone line so a long gain has an endpoint it can actually reach. Same formula
  // the post-hoc track clamp below uses, minus a hair of slack; without a
  // fieldPos we keep the historic floor of 2.
  if (p.fieldPos != null) {
    const _yFloor = LOS - (100 - p.fieldPos) * YPU - 10 * YPU + 1.2;
    for (const a2 of everyone) a2.yMin = Math.min(2, _yFloor);
  }
  const ball = { track: [] };
  const n = Math.ceil((dur + 1e-9) / STEP);
  for (let i = 0; i <= n; i++) {
    const t2 = i * STEP;
    const world = { t: t2 };
    for (const a2 of everyone) stepAgent(a2, a2.behave ? a2.behave(t2, world, a2) : null, STEP);
    for (let a = 0; a < everyone.length; a++) {
      const A2 = everyone[a];
      if (A2 === carrier) continue;
      if (Math.hypot(A2.vx, A2.vy) > SEP_VMAX) continue;
      for (let b = 0; b < everyone.length; b++) {
        if (b === a) continue;
        const B2 = everyone[b];
        const dx = A2.x - B2.x, dy = A2.y - B2.y;
        const dd = Math.hypot(dx, dy);
        if (dd > 1e-4 && dd < SEP_R) {
          const push = Math.min(SEP_PUSH, (SEP_R - dd) * 0.5);
          A2.x = clamp6(A2.x + dx / dd * push, 1, 99);
          A2.y = clamp6(A2.y + dy / dd * push, 2, 60);
        }
      }
    }
    for (const a2 of everyone) a2.track.push([a2.x, a2.y]);
    const bp = ballPlan(t2);
    // Guard: a degenerate ballPlan point (NaN from a divide-by-zero or a missing
    // field) would sail the ball to a garbage spot — clamp6 passes NaN through. Fall
    // back to the previous ball position so the path stays continuous.
    const _bp0 = bp ? bp[0] : NaN, _bp1 = bp ? bp[1] : NaN;
    const _prevB = ball.track.length ? ball.track[ball.track.length - 1] : [50, LOS + 0.6];
    const _bx = Number.isFinite(_bp0) ? _bp0 : _prevB[0];
    const _by = Number.isFinite(_bp1) ? _bp1 : _prevB[1];
    ball.track.push([clamp6(_bx, 1, 99), clamp6(_by, 1.5, 60)]);
  }
  // M21: if the exchange window stretched beyond the stock timing (wide
  // carrier → pitch-length flight), the ownership cues follow the real window.
  if (typeof _exchT !== "undefined" && _exchT != null && typeof carryCue !== "undefined" && carryCue && typeof ballCue !== "undefined" && ballCue && ballCue.meshStart != null) {
    carryCue.from = ballCue.meshStart + _exchT;
    ballCue.meshEnd = carryCue.from;
  }
  if (typeof beatenAt !== "undefined" && beatenAt != null) {
    let best = p.beatenDefSlot ? defs.find((d) => d.slot.id === p.beatenDefSlot) : null;
    if (!best) {
      const iC = Math.min(Math.round(beatenAt / STEP), n);
      let bd = 1e9;
      for (const d of defs) {
        if (d.grp === "DL") continue;
        const tr = d.track[Math.min(iC, d.track.length - 1)];
        const dd = (tr[0] - beatenPt[0]) ** 2 + (tr[1] - beatenPt[1]) ** 2;
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
    }
    if (best) fx.push({ t: beatenAt, kind: "beaten", actorId: best.id, x: beatenPt[0], y: beatenPt[1] });
  }
  // M21: the receiver's hands meet the ball — pin the target to the catch
  // point at the catch frame (mid-track pin, tail untouched; the outcome
  // law's end constraint below still owns the finish).
  if (typeof _tgtActor !== "undefined" && _tgtActor && typeof _catchT !== "undefined" && _catchT != null) {
    pinTrackPoint(_tgtActor.track, Math.round(_catchT / STEP), _catchPtV, 10);
  }
  if (endInfo) {
    constrainTrack(endInfo.actor.track, Math.round(endInfo.at / STEP), endInfo.pt);
  }
  // M20: resolve contact identities from the sim's truth stamps when present.
  // p.contactSlots carries tackler/assist/ff/brokenBy as SLOT ids (recording
  // only, stamped in sim.js); proximity remains the fallback for plays that
  // predate the stamp or whose slot isn't in this front's layout.
  const _truth = p.contactSlots || null;
  const _truthActor = (sid) => sid ? defs.find((d) => d.slot.id === sid) || null : null;
  if (endInfo && carrier && !p.td && !p.turnover && !(isPass && p.sack) && carrier.team === "off") {
    const iEnd = Math.round(endInfo.at / STEP);
    const [ex, ey] = endInfo.pt;
    let tackler = _truthActor(_truth == null ? void 0 : _truth.tackler);
    // Breakaway with no credited tackler = the fit was broken and nobody is
    // owed the stop — do not fabricate a phantom brace at the end point.
    const _noFit = !tackler && _truth && !_truth.tackler && p.breakaway;
    if (!tackler && !_noFit) {
      let bestD = Infinity;
      for (const d of defs) {
        const tr = d.track[Math.min(iEnd, d.track.length - 1)];
        if (!tr) continue;
        const dd = (tr[0] - ex) ** 2 + (tr[1] - ey) ** 2;
        if (dd < bestD) {
          bestD = dd;
          tackler = d;
        }
      }
    }
    if (tackler) {
      const tTr = tackler.track[Math.min(iEnd, tackler.track.length - 1)] || [ex, ey];
      const side = tTr[0] >= ex ? 1.4 : -1.4;
      const approach = [ex + side, ey + 1.1];
      constrainTrack(tackler.track, iEnd, approach);
      fx.push({ t: endInfo.at, kind: "contact", x: ex, y: ey });
      let assist = _truthActor(_truth == null ? void 0 : _truth.assist);
      if (assist === tackler) assist = null;
      if (assist) {
        constrainTrack(assist.track, Math.min(iEnd + 2, assist.track.length - 1), [ex + 1.6, ey - 0.8]);
      } else if (!(_truth && _truth.tackler) && (p.yards || 0) >= 8) {
        // No truth on this play: keep the old long-gain proximity assist.
        let d2 = null, bd2 = Infinity;
        for (const d of defs) {
          if (d === tackler || d.grp === "DL") continue;
          const tr = d.track[Math.min(iEnd, d.track.length - 1)];
          if (!tr) continue;
          const dd = (tr[0] - ex) ** 2 + (tr[1] - ey) ** 2;
          if (dd < bd2) {
            bd2 = dd;
            d2 = d;
          }
        }
        if (d2) {
          constrainTrack(d2.track, Math.min(iEnd + 2, d2.track.length - 1), [ex + 1.6, ey - 0.8]);
          assist = d2;
        }
      }
      const iApp = Math.max(1, iEnd - 15);
      const a0 = carrier.track[Math.max(0, iApp - 3)] || carrier.track[0];
      const a1 = carrier.track[Math.min(iApp, carrier.track.length - 1)] || a0;
      const appSpd = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / (STEP * 3);
      let nNear = 0;
      for (const d of defs) {
        const tr = d.track[Math.min(iEnd, d.track.length - 1)];
        if (tr && (tr[0] - ex) ** 2 + (tr[1] - ey) ** 2 < 16) nNear++;
      }
      const openField = nNear <= 2;
      const dxT = tTr[0] - ex, dyT = tTr[1] - ey;
      const gain2 = p.yards || 0;
      const nearGoal = p.fieldPos != null && p.fieldPos >= 96;
      const fromBehind = dyT > 0.8;
      const lateral = Math.abs(dxT) > Math.abs(dyT) + 0.3;
      const style = selectTackleStyle({ nearGoal, speed: appSpd, openField, lateral, fromBehind, bodyKind: tackler.body ? tackler.body.kind : "legacy" });
      const joinCues = assist ? [{ id: assist.id, t: endInfo.at + 0.02 }] : [];
      tackleCue = {
        id: tackler.id,
        assistId: assist ? assist.id : null,
        joinCues,
        carrierId: carrier.id,
        style,
        t: endInfo.at,
        x: ex,
        y: ey,
        basis: { speed: appSpd, openField, lateral, fromBehind, nearGoal }
      };
      // M20 pile discipline: at most tackler + assist + ONE late arrival
      // inside the pile radius. Every other converging defender brakes to a
      // ring with real separation — a stop is a fit, not an unreadable mass.
      {
        const pileR = 3.2, ringR = 4.1;
        let extras = 0;
        for (const d of defs) {
          if (d === tackler || d === assist) continue;
          const tr = d.track[Math.min(iEnd, d.track.length - 1)];
          if (!tr) continue;
          const dd = Math.hypot(tr[0] - ex, tr[1] - ey);
          if (dd >= pileR) continue;
          extras++;
          const ang = Math.atan2(tr[1] - ey, tr[0] - ex) || extras * 2.4;
          const rr = extras <= 1 ? 2.5 : ringR + (extras - 2) * 0.7;
          constrainTrack(d.track, iEnd, [clamp6(ex + Math.cos(ang) * rr, 1, 99), clamp6(ey + Math.sin(ang) * rr, -60, 61)]);
          // One truthful late arriver may join the credited tackler + assist.
          // Everybody else stays on the disciplined ring established above.
          if (extras === 1) joinCues.push({ id: d.id, t: endInfo.at + 0.12 });
        }
      }
      const iFrom = Math.max(0, iEnd - 26);
      for (const d of defs) {
        if (d === tackler || d === assist || _truth && _truth.brokenBy && d.slot.id === _truth.brokenBy || missCues.length >= 2) continue;
        for (let i = iFrom; i < iEnd - 8; i += 4) {
          const tr = d.track[Math.min(i, d.track.length - 1)];
          const cr = carrier.track[Math.min(i, carrier.track.length - 1)];
          if (tr && cr && Math.hypot(tr[0] - cr[0], tr[1] - cr[1]) < 2) {
            missCues.push({ id: d.id, t: i * STEP });
            break;
          }
        }
      }
    }
  }
  if (endInfo && isPass && p.sack && carrier === A.QB) {
    const iEnd = Math.round(endInfo.at / STEP);
    const [ex, ey] = endInfo.pt;
    let sacker = _truthActor(_truth == null ? void 0 : _truth.tackler);
    if (sacker) constrainTrack(sacker.track, iEnd, [ex + (sacker.x >= ex ? 1.2 : -1.2), ey + 0.9]);
    if (!sacker) {
      let bestD = Infinity;
      for (const d of defs) {
        const tr = d.track[Math.min(iEnd, d.track.length - 1)];
        if (!tr) continue;
        const dd = (tr[0] - ex) ** 2 + (tr[1] - ey) ** 2;
        if (dd < bestD) {
          bestD = dd;
          sacker = d;
        }
      }
    }
    if (sacker) tackleCue = {
      id: sacker.id,
      assistId: null,
      carrierId: "QB",
      style: "sack",
      t: endInfo.at,
      x: ex,
      y: ey,
      sack: true
    };
  }
  // M20: a sim-credited broken tackle becomes a real collision, not a passing
  // flash. Pin the credited defender to his nearest approach of the carrier,
  // bump the carrier off the contact, ground the defender, and let the move
  // cue (juke/truck/spin) fire AT the collision instead of a scripted 60%.
  if (_truth && _truth.brokenBy && carrier && endInfo && !(isPass && p.sack)) {
    const dB = _truthActor(_truth.brokenBy);
    const iEnd = Math.round(endInfo.at / STEP);
    const iLo = Math.round((PRESNAP + (isPass ? 0.55 : 0.35)) / STEP);
    const iHi = Math.max(iLo + 2, iEnd - Math.round(0.35 / STEP));
    if (dB && (!tackleCue || dB.id !== tackleCue.id) && iHi > iLo) {
      let iBk = -1, best = Infinity;
      for (let i = iLo; i <= iHi; i++) {
        const cr = carrier.track[Math.min(i, carrier.track.length - 1)];
        const tr = dB.track[Math.min(i, dB.track.length - 1)];
        if (!cr || !tr) continue;
        const dd = (tr[0] - cr[0]) ** 2 + (tr[1] - cr[1]) ** 2;
        if (dd < best) {
          best = dd;
          iBk = i;
        }
      }
      if (iBk > 0) {
        const cr = carrier.track[Math.min(iBk, carrier.track.length - 1)];
        const [cx, cy] = cr;
        const side = (dB.track[Math.min(iBk, dB.track.length - 1)] || cr)[0] >= cx ? 1 : -1;
        // Defender meets the carrier at the collision, then falls off behind it.
        constrainTrack(dB.track, iBk, [clamp6(cx + side * 0.85, 1, 99), cy + 0.35]);
        const iGround = Math.min(iBk + 5, dB.track.length - 1);
        constrainTrack(dB.track, iGround, [clamp6(cx + side * 1.5, 1, 99), clamp6(cy + 1.15, -60, 61)], null, iBk);
        for (let i = iGround; i < Math.min(iGround + 12, dB.track.length); i++) dB.track[i] = [...dB.track[iGround]];
        // Carrier takes the hit: a decaying shove away from the defender that
        // never touches the play's fixed end point.
        for (let k = 0; k <= 6; k++) {
          const i = iBk + k;
          if (i >= carrier.track.length - 3 || i >= iEnd - 2) break;
          const decay = 1 - k / 7;
          carrier.track[i][0] = clamp6(carrier.track[i][0] - side * 0.55 * decay, 1, 99);
        }
        breakCue = { id: dB.id, carrierId: carrier.id, t: iBk * STEP, x: cx, y: cy, style: p.btStyle || "evade" };
        fx.push({ t: iBk * STEP, kind: "contact", x: cx, y: cy });
      }
    }
  }
  if (carrier && endInfo && !(isPass && p.sack)) {
    const pickedMove = pickMove(carrier, breakCue);
    let mv = pickedMove == null ? void 0 : pickedMove.style;
    const runLike = String(p.type || "").startsWith("run") || p.isScramble;
    const iEndM = Math.max(2, Math.round(endInfo.at / STEP));
    const m0 = carrier.track[Math.max(0, iEndM - 3)], m1 = carrier.track[Math.min(iEndM, carrier.track.length - 1)];
    const finishSpeed = m0 && m1 ? Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) / (STEP * 3) : 0;
    const boundaryFinish = endInfo.pt[0] <= 9 || endInfo.pt[0] >= 91;
    const madeMarker = p.distance != null && (p.yards || 0) >= p.distance;
    if (!mv) mv = selectLandmarkMove({
      runLike,
      touchdown: !!p.td,
      boundary: boundaryFinish,
      finishSpeed,
      madeMarker,
      nearGoal: p.fieldPos == null || p.fieldPos >= 94
    });
    if (!mv && p.isScramble && !p.td && (p.yards || 0) > 0 && (p.qbSlid === true || p.qbSlid == null && rnd() < 0.55)) mv = "slide";
    if (mv) {
      const isDive = mv === "dive" || mv === "pylon-dive" || mv === "marker-dive";
      let mvT = isDive || mv === "slide" ? Math.max(PRESNAP + 0.1, endInfo.at - 0.3) : PRESNAP + (endInfo.at - PRESNAP) * 0.6;
      // M20: when the sim credited a broken tackle, the move IS the break —
      // fire it at the staged collision, not at a scripted fraction.
      if (breakCue && !isDive && mv !== "slide") mvT = breakCue.t;
      // Pass plays: the carrier can't move before he has the ball. This clamp
      // must be the final timing word — a malformed/legacy break stamp can sit
      // before the catch, but the viewer may never animate that fiction.
      if (typeof _catchT !== "undefined" && _catchT != null) mvT = Math.max(mvT, _catchT + 0.08);
      moveCue = {
        id: carrier.id,
        style: mv,
        t: mvT,
        direction: boundaryFinish ? endInfo.pt[0] <= 9 ? "left" : "right" : null,
        basis: pickedMove == null ? void 0 : pickedMove.basis
      };
    }
  }
  // M24: celebration VARIANTS — picked from the situation + the play's
  // seeded rnd (short-yardage TDs spike or flex, bombs leap or flex), and
  // the two nearest teammates join the moment (render-only class; tracks
  // untouched).
  if (p.td && endInfo && endInfo.actor) {
    const styleRnd = rnd();
    const short = (p.yards || 0) <= 3;
    const deep = (p.yards || 0) >= 25;
    const style = short ? (styleRnd < 0.6 ? "spike" : "flex") : deep ? (styleRnd < 0.55 ? "leap" : "flex") : styleRnd < 0.4 ? "spike" : styleRnd < 0.75 ? "bounce" : "flex";
    const iEndC = Math.round(endInfo.at / STEP);
    const epc = endInfo.pt;
    const mobIds = offs.filter((a2) => a2 !== endInfo.actor).map((a2) => {
      const tr = a2.track[Math.min(iEndC, a2.track.length - 1)];
      return { id: a2.id, d: tr ? Math.hypot(tr[0] - epc[0], tr[1] - epc[1]) : 1e9 };
    }).sort((x, y) => x.d - y.d).slice(0, 2).filter((m) => m.d < 18).map((m) => m.id);
    celebrateCue = { id: endInfo.actor.id, t: endInfo.at + 0.15, style, mobIds };
  }
  // M24: exhaustion — a long play leaves the carrier (and the man who
  // finally got him) bent over and breathing, timed AFTER the grounded /
  // get-up window so the M20 finish laws are untouched.
  var windedCue = null;
  if (endInfo && carrier && !p.td && ((p.yards || 0) >= 25 || endInfo.at >= 5.2)) {
    windedCue = { ids: [carrier.id, tackleCue ? tackleCue.id : null].filter(Boolean), t: endInfo.at + 1.6 };
  }
  var injuryCue = p.qbInjured && endInfo ? { id: "QB", t: endInfo.at + 0.3, x: endInfo.pt[0], y: endInfo.pt[1] } : null;
  if (injuryCue) fx.push({ t: injuryCue.t + 0.25, kind: "hurt", x: injuryCue.x, y: injuryCue.y });
  // M25: turf spray — read the CARRIER'S finished track for hard cuts
  // (real heading change at speed) and kick pellets there; a bigger burst
  // where the tackle lands. Deterministic (track + seeded rnd), render-only,
  // capped so the field stays readable ("effects kept restrained").
  if (carrier && carrier.track && carrier.track.length > 12) {
    let _turfN = 0;
    const iT0 = Math.round(PRESNAP / STEP) + 4;
    const iT1 = endInfo ? Math.min(Math.round(endInfo.at / STEP), carrier.track.length - 4) : carrier.track.length - 4;
    for (let i = iT0; i < iT1 && _turfN < 3; i++) {
      const b1 = carrier.track[i - 3], b2 = carrier.track[i], b3 = carrier.track[i + 3];
      if (!b1 || !b2 || !b3) break;
      const v1x = b2[0] - b1[0], v1y = b2[1] - b1[1], v2x = b3[0] - b2[0], v2y = b3[1] - b2[1];
      const s1 = Math.hypot(v1x, v1y), s2 = Math.hypot(v2x, v2y);
      if (s1 < 0.55 || s2 < 0.4) continue;
      const dot = (v1x * v2x + v1y * v2y) / (s1 * s2 || 1e-6);
      if (dot < 0.78) {
        fx.push({ t: i * STEP, kind: "turf", x: b2[0], y: b2[1], big: 0, seed: Math.floor(rnd() * 997) });
        _turfN++;
        i += 10;
      }
    }
  }
  if (tackleCue && endInfo) fx.push({ t: endInfo.at, kind: "turf", x: endInfo.pt[0], y: endInfo.pt[1], big: 1, seed: Math.floor(rnd() * 997) });
  if (ballEnd.pt) constrainTrack(
    ball.track,
    Math.round(ballEnd.at / STEP),
    ballEnd.pt,
    null,
    typeof _ballFloorFrame !== "undefined" ? _ballFloorFrame : 0
  );
  if (_penWhistle != null && ball.track.length) {
    const iW = Math.min(Math.round(_penWhistle / STEP), ball.track.length - 1);
    for (let i = iW; i < ball.track.length; i++) ball.track[i] = [...ball.track[iW]];
  }
  if (endInfo && carrier) {
    // M21: the ball rides the carrier from the moment he OWNS it (catch /
    // mesh / pitch arrival), not just from the end frame — post-assembly
    // constraint shoves (contact truth, broken tackles, the catch pin) no
    // longer separate the ball from the man holding it.
    const iRide = typeof carryCue !== "undefined" && carryCue && carryCue.id === carrier.id ? Math.round(carryCue.from / STEP) + 1 : Math.round(endInfo.at / STEP);
    for (let i = iRide; i < ball.track.length; i++) ball.track[i] = [...carrier.track[Math.min(i, carrier.track.length - 1)]];
  }
  // Pass interception: ride the ball with the return man. constrainTrack pinned
  // every post-catch frame to the pick spot, so without this the picker sprinted
  // his return while the ball hovered frozen at the catch point.
  if (typeof _intPicker !== "undefined" && _intPicker && !carrier) {
    // M25: on a tip-drill the ball's hand-off point is the CAROM, not the
    // catch — carom frames are written below once the picker is settled.
    const _tipLive = typeof _tipT !== "undefined" && _tipT != null && typeof _tipPt !== "undefined" && _tipPt != null;
    if (_tipLive) {
      ballEnd = { at: _tipT, pt: _tipPt };
    }
    const iC0 = Math.round(ballEnd.at / STEP);
    const _iSnap0 = Math.round(PRESNAP / STEP);
    // M21: if the STAMPED picker couldn't plausibly arrive from this front's
    // alignment, hand the on-screen pick to the nearest body (the pre-stamp
    // behavior) — a credited man teleporting to the ball is worse than the
    // fallback. Whoever picks it gets pinned to the catch so the ball never
    // jumps to him.
    const _pTr0 = _intPicker.track[Math.min(iC0, _intPicker.track.length - 1)];
    let _pDrift = _pTr0 && ballEnd.pt ? Math.hypot(_pTr0[0] - ballEnd.pt[0], _pTr0[1] - ballEnd.pt[1]) : Infinity;
    if (_pDrift > (iC0 - _iSnap0) * 0.28) {
      let nb = null, nd = Infinity;
      for (const d of defs) {
        const tr = d.track[Math.min(iC0, d.track.length - 1)];
        if (!tr || !ballEnd.pt) continue;
        const dd = Math.hypot(tr[0] - ballEnd.pt[0], tr[1] - ballEnd.pt[1]);
        if (dd < nd) {
          nd = dd;
          nb = d;
        }
      }
      if (nb) {
        _intPicker = nb;
        _pDrift = nd;
      }
    }
    if (ballEnd.pt && _pDrift > 0.4 && _pDrift <= (iC0 - _iSnap0) * 0.28 && iC0 - _iSnap0 > 4) {
      pinTrackPoint(_intPicker.track, iC0, ballEnd.pt, iC0 - _iSnap0);
    }
    if (_tipLive && typeof _catchT !== "undefined" && _catchT != null) {
      // The carom itself: catch point → grab point, a short seeded-feeling
      // arc (deterministic from the two pinned endpoints).
      const iTip = Math.min(Math.round(_catchT / STEP), ball.track.length - 1);
      const cp0 = [...ball.track[iTip]];
      const K2 = Math.max(2, iC0 - iTip);
      for (let k = 1; k <= K2 && iTip + k < ball.track.length; k++) {
        const u = k / K2;
        ball.track[iTip + k] = [
          clamp6(cp0[0] + (_tipPt[0] - cp0[0]) * u + Math.sin(u * Math.PI) * 0.5, 1, 99),
          clamp6(cp0[1] + (_tipPt[1] - cp0[1]) * u + Math.sin(u * Math.PI * 2) * 0.25, 1.5, 60)
        ];
      }
    }
    const iC = iC0 + 2;
    for (let i = iC; i < ball.track.length; i++) ball.track[i] = [..._intPicker.track[Math.min(i, _intPicker.track.length - 1)]];
  }
  // M21: a stamped pass breakup BREAKS the trajectory — the credited defender
  // (p.ballSlots.pbu, recording-only) arrives to swat and the ball tumbles
  // off the catch point to the turf. Incompletions are exempt from the
  // resting-spot law, so the scatter is legal; unstamped incompletions keep
  // the old dead-at-the-spot behavior (fallback intact).
  var deflectCue = typeof _tipCue !== "undefined" && _tipCue ? _tipCue : null;
  if (isPass && !p.sack && !p.complete && !p.turnover && p.ballSlots && p.ballSlots.pbu && typeof _catchT !== "undefined" && _catchT != null && !p.throwAway) {
    const dP = defs.find((d) => d.slot.id === p.ballSlots.pbu) || null;
    const iC = Math.min(Math.round(_catchT / STEP), ball.track.length - 1);
    const _iSnap = Math.round(PRESNAP / STEP);
    const _dTr = dP ? dP.track[Math.min(iC, dP.track.length - 1)] : null;
    const _drift = _dTr ? Math.hypot(_dTr[0] - ball.track[iC][0], _dTr[1] - ball.track[iC][1]) : Infinity;
    // The pin reaches back to the snap and its per-frame demand must survive
    // capTrackSpeed (the M20 order lesson). If the credited man cannot
    // plausibly arrive from this front's alignment, do NOT stage the swat —
    // graceful fallback, same rule as a slot missing from the front.
    if (dP && iC - _iSnap > 4 && _drift <= (iC - _iSnap) * 0.28) {
      const cp = ball.track[iC];
      pinTrackPoint(dP.track, iC, [clamp6(cp[0] + (dP.x >= cp[0] ? 0.9 : -0.9), 1, 99), clamp6(cp[1] - 0.4, -60, 61)], iC - _iSnap);
      deflectCue = { id: dP.id, t: _catchT };
      const ang = rnd() * Math.PI * 2;
      const dxD = Math.cos(ang), dyD = Math.sin(ang);
      const K = 12;
      for (let k = 1; k <= K && iC + k < ball.track.length; k++) {
        const u = k / K;
        const dist = 3.4 * (1 - (1 - u) * (1 - u));
        const wob = Math.sin(k * 2.1) * 0.35 * (1 - u);
        ball.track[iC + k] = [
          clamp6(cp[0] + dxD * dist - dyD * wob, 1, 99),
          clamp6(cp[1] + dyD * dist * 0.7 + dxD * wob + Math.abs(Math.sin(k * 1.7)) * 0.3 * (1 - u), 1.5, 60)
        ];
      }
      const iRest = Math.min(iC + K, ball.track.length - 1);
      for (let i = iRest + 1; i < ball.track.length; i++) ball.track[i] = [...ball.track[iRest]];
    }
  }
  if (p.turnover && !isPass && endInfo) {
    const iEnd = Math.round(ballEnd.at / STEP);
    // M21: the fumble BOUNCES — seeded erratic hops that die back at the
    // engine's spot (the sine wiggle never read as a loose football).
    tumbleLoose(ball.track, iEnd, rnd);
    let r1 = null, b1 = Infinity;
    for (const d of defs) {
      const tr = d.track[Math.min(iEnd, d.track.length - 1)];
      if (!tr) continue;
      const dd = (tr[0] - ballEnd.pt[0]) ** 2 + (tr[1] - ballEnd.pt[1]) ** 2;
      if (dd < b1) {
        b1 = dd;
        r1 = d;
      }
    }
    if (r1) constrainTrack(r1.track, Math.min(iEnd + 6, r1.track.length - 1), [ballEnd.pt[0] + 1.1, ballEnd.pt[1] + 0.6]);
    // M20: the sim's credited strip man makes the strip on screen — steer him
    // to the ball-out point and cue the swipe just before the ball comes loose.
    if (_truth && _truth.ff) {
      const fA = _truthActor(_truth.ff);
      if (fA) {
        constrainTrack(fA.track, iEnd, [clamp6(ballEnd.pt[0] - 1.1, 1, 99), clamp6(ballEnd.pt[1] + 0.5, -60, 61)]);
        stripCue = { id: fA.id, carrierId: carrier ? carrier.id : null, t: Math.max(0.1, ballEnd.at - 0.06) };
      }
    }
  }
  if (isPass && p.sack && p.turnover && endInfo) {
    const iEnd = Math.round(ballEnd.at / STEP);
    // M21: strip-sack ball comes out and bounces (same loose-ball physics).
    tumbleLoose(ball.track, iEnd, rnd, 1.5, 60, 9, 1.8);
    fx.push({ t: ballEnd.at + 0.08, kind: "fum", x: ballEnd.pt[0], y: ballEnd.pt[1] });
  }
  // M20: pass-protection engagements become real block pairs, so the
  // engagement glyph, meet point and hands land on pass sets the way they
  // already do on run fits. The pair list comes from the rush wiring itself.
  if (isPass) for (const rc of rushCues) {
    if (!rc.blockerId) continue;
    if (blocks.some((b) => b.offId === rc.blockerId && b.defId === rc.id)) continue;
    blocks.push({
      offId: rc.blockerId,
      defId: rc.id,
      start: PRESNAP + 0.1,
      end: rc.win ? rc.t : throwCue && throwCue.release ? throwCue.release + 0.06 : Math.max(PRESNAP + 0.5, dur - 0.4),
      rep: "passpro"
    });
  }
  const MAX_STEP = 15 * STEP;
  for (const a2 of everyone) capTrackSpeed(a2.track, MAX_STEP);
  capTrackSpeed(ball.track, 50 * STEP);
  // M20 separation sweep — AFTER the speed cap, which can drag constrained
  // endpoints back together. Nobody in or around the stop shares a spot; the
  // shove is applied to every post-whistle frame with a short ease-in.
  if (tackleCue && !tackleCue.sack) {
    const iEnd2 = Math.round(tackleCue.t / STEP);
    for (let sweep = 0; sweep < 2; sweep++) {
      const at = defs.map((d) => ({ d, tr: d.track[Math.min(iEnd2, d.track.length - 1)] })).filter((e) => e.tr && Math.hypot(e.tr[0] - tackleCue.x, e.tr[1] - tackleCue.y) < 4.6);
      for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
        const dx2 = at[j].tr[0] - at[i].tr[0], dy2 = at[j].tr[1] - at[i].tr[1];
        const dd2 = Math.hypot(dx2, dy2);
        if (dd2 >= 0.9) continue;
        const ux = dd2 > 0.01 ? dx2 / dd2 : Math.cos(j * 2.4), uy = dd2 > 0.01 ? dy2 / dd2 : Math.sin(j * 2.4);
        const sx = at[i].tr[0] + ux * 0.95 - at[j].tr[0], sy = at[i].tr[1] + uy * 0.95 - at[j].tr[1];
        const track = at[j].d.track;
        for (let f = Math.max(0, iEnd2 - 3); f < track.length; f++) {
          const ease = f >= iEnd2 ? 1 : (3 - (iEnd2 - f)) / 3;
          track[f][0] = clamp6(track[f][0] + sx * ease, 1, 99);
          track[f][1] = clamp6(track[f][1] + sy * ease, -60, 61);
        }
        at[j].tr = track[Math.min(iEnd2, track.length - 1)];
      }
    }
  }
  // M25: pile discipline, FINAL WORD. The M20 ring runs at staging time, but
  // later constraint shoves — the run-fit ENGAGEMENTS especially — can drag
  // an engaged lineman back inside the pile radius (found 2026-08-11: every
  // probe violation was tackler + assist + the ringed extra at 2.5 + one
  // engaged front-7 body at ~2.7). Re-enforce after every track mutation so
  // the law holds no matter what moved last.
  if (typeof tackleCue !== "undefined" && tackleCue && tackleCue.t != null) {
    const iEndF = Math.round(tackleCue.t / STEP);
    const exF = tackleCue.x, eyF = tackleCue.y;
    let extrasF = 0;
    for (const d of defs) {
      if (d.id === tackleCue.id || tackleCue.assistId && d.id === tackleCue.assistId) continue;
      const tr = d.track[Math.min(iEndF, d.track.length - 1)];
      if (!tr) continue;
      const ddF = Math.hypot(tr[0] - exF, tr[1] - eyF);
      if (ddF >= 3.2) continue;
      extrasF++;
      if (extrasF <= 1 && ddF >= 2.2) continue;
      const angF = Math.atan2(tr[1] - eyF, tr[0] - exF) || extrasF * 2.4;
      const rrF = extrasF <= 1 ? 2.5 : 4.1 + (extrasF - 2) * 0.7;
      // span 8: short enough that earlier staged moments (the break meeting
      // especially) stay untouched, long enough that the added per-frame
      // velocity stays well under the RUNG 7A speed cap (span 6 measured
      // max 15.0 u/s against the 16 hard limit — too close).
      constrainTrack(d.track, iEndF, [clamp6(exF + Math.cos(angF) * rrF, 1, 99), clamp6(eyF + Math.sin(angF) * rrF, -60, 61)], 8);
    }
  }
  if (p.fieldPos != null) {
    let lo = LOS - (100 - p.fieldPos) * YPU - 10 * YPU + 1.2;
    let hi = LOS + p.fieldPos * YPU + 10 * YPU - 1.2;
    lo = Math.min(lo, ballEnd.pt ? ballEnd.pt[1] - 0.5 : lo, endInfo ? endInfo.pt[1] - 0.5 : lo);
    hi = Math.max(hi, ballEnd.pt ? ballEnd.pt[1] + 0.5 : hi, endInfo ? endInfo.pt[1] + 0.5 : hi);
    for (const a2 of everyone) for (const pt of a2.track) pt[1] = clamp6(pt[1], lo, hi);
    for (const pt of ball.track) pt[1] = clamp6(pt[1], lo, hi);
  }
  const _resolvedCatchOwner = typeof _intPicker !== "undefined" && _intPicker ? _intPicker.id : typeof _tgtActor !== "undefined" && _tgtActor ? _tgtActor.id : null;
  const catchCue = buildCatchPresentation(everyone, fx, p, STEP, _resolvedCatchOwner);
  const armSwitchCue = buildArmSwitchPresentation(p, typeof carryCue !== "undefined" ? carryCue : null, dur);
  return {
    dur: dur + 1e-9,
    step: STEP,
    presnap: PRESNAP,
    actors: everyone.map((a2) => {
      var _a2;
      return {
        id: a2.id,
        team: a2.team,
        label: a2.label,
        qb: a2.qb,
        grp: a2.team === "off" ? (_a2 = a2.slot) == null ? void 0 : _a2.pos : a2.grp,
        body: a2.body || selectBodyExpression(),
        track: a2.track
      };
    }),
    ball,
    blocks,
    // Capstone P1: which def actor is the recorded cover man (null when the
    // play had no trace) — lets the UI highlight the real matchup someday and
    // lets the probe verify the cushion against the sim's separation.
    covId: _covActorId,
    // M21: ball-ownership channel — phase labels (ballCue), the carrier's
    // hand-off truth (carryCue: who, from when, which arm), and the stamped
    // deflection (deflectCue). Labels only; the ball track owns every spot.
    ballCue: typeof ballCue !== "undefined" ? ballCue : null,
    carryCue: typeof carryCue !== "undefined" ? carryCue : null,
    armSwitchCue,
    deflectCue: typeof deflectCue !== "undefined" ? deflectCue : null,
    pickId: typeof _intPicker !== "undefined" && _intPicker ? _intPicker.id : null,
    throwCue,
    catchCue,
    tackleCue,
    moveCue,
    breakCue,
    stripCue,
    rushCues,
    jamCues,
    routeCues,
    coverageCues,
    pressCue,
    pumpCue,
    qbCue,
    celebrateCue,
    windedCue: typeof windedCue !== "undefined" ? windedCue : null,
    missCues,
    culpritCue: typeof culpritCue !== "undefined" ? culpritCue : null,
    injuryCue: typeof injuryCue !== "undefined" ? injuryCue : null,
    fx: fx.filter((f) => f.kind !== "pitch")
  };
}
// ── M22: the camera plan ────────────────────────────────────────────────
// Built from the script's own cues, DOM-free and deterministic — the node
// probe asserts on the plan directly, the app's tick consumes it and the
// M20 slew integrator still owns smoothness. World coordinates throughout;
// the app maps anchors through its screen transform.
//  anchorAt(t)  world point the camera frames — pinned pre-snap (M20 law),
//               LEADING the play toward its known destination after.
//  hAt(t, rp)   zoom-height target (same constants the board uses).
//  warpAt(t)    replay time-warp rate: slow (~0.45×) around the contact
//               cues, compensated outside so the TOTAL replay duration is
//               unchanged (the scheduler's wall-time budget holds exactly).
//  settle       turnover window (the app halves pan velocity inside it).
//  hold         TD celebration hold (anchor parks on the celebrant).
function buildCameraPlan(script, p, opts = {}) {
  const WIDE_H = opts.wideH != null ? opts.wideH : 53;
  const CLOSE_H = opts.closeH != null ? opts.closeH : 44;
  const LONG = opts.longitudinal != null ? opts.longitudinal : 1.35;
  const dur = script.dur;
  const S = script.step;
  const bt = script.ball.track;
  const fx = script.fx || [];
  const catchFx = fx.find((f) => f.kind === "catch" || f.kind === "inc" || f.kind === "int") || null;
  const endFx = fx.find((f) => f.kind === "td" || f.kind === "tackle" || f.kind === "sack") || null;
  const toFx = fx.find((f) => f.kind === "int" || f.kind === "fum") || null;
  const tc = script.tackleCue, th = script.throwCue;
  const presnap = script.presnap;
  const ballAt = (t) => sampleTrack(bt, S, t);
  const endPt = tc ? [tc.x, tc.y] : endFx ? [endFx.x, endFx.y] : null;
  const catchPt = catchFx ? [catchFx.x, catchFx.y] : null;
  const catchT = catchFx ? catchFx.t : null;
  const settle = toFx ? { start: toFx.t, end: toFx.t + 0.8 } : null;
  const hold = p && p.td && script.celebrateCue ? { start: script.celebrateCue.t, pt: endPt || ballAt(dur) } : null;
  const cl01 = (v) => Math.max(0, Math.min(1, v));
  const anchorAt = (t) => {
    if (t < presnap) return ballAt(0);
    const b = ballAt(t);
    if (hold && t >= hold.start) return hold.pt;
    if (settle && t >= settle.start && t < settle.start + 0.45) return [toFx.x, toFx.y];
    if (th && catchPt && catchT != null && t >= th.start && t < catchT) {
      // the script knows the catch point before the ball is thrown — lead
      // from the windup, deepening through the flight
      const w = 0.35 + 0.4 * cl01((t - th.start) / Math.max(0.2, catchT - th.start));
      return [b[0] + (catchPt[0] - b[0]) * w, b[1] + (catchPt[1] - b[1]) * w];
    }
    if (endPt && t > presnap + 0.25) {
      const dx = endPt[0] - b[0], dy = endPt[1] - b[1];
      const d = Math.hypot(dx, dy);
      if (d > 0.1) {
        const lead = Math.min(8, d * 0.35);
        return [b[0] + dx / d * lead, b[1] + dy / d * lead];
      }
    }
    return b;
  };
  const goalNear = p && p.fieldPos != null && p.fieldPos >= 92;
  const hAt = (t, replay) => {
    if (t <= presnap + 0.15) return WIDE_H;
    const b = ballAt(t);
    const travel = Math.abs(31 - b[1]) * LONG;
    let h = CLOSE_H + cl01((travel - 13) / 34) * 8;
    if (th && catchPt && catchT != null && t >= th.release && t < catchT) {
      const spread = Math.abs(catchPt[1] - b[1]) * LONG;
      h = Math.max(h, Math.min(56, CLOSE_H + spread * 0.58));
    }
    if (settle && t >= settle.start && t <= settle.end) h = Math.max(h, CLOSE_H + 3);
    if (catchFx && t >= catchFx.t - 0.18 && t <= catchFx.t + 0.36) h = Math.min(h, replay ? 39.5 : 42);
    if (tc && t >= tc.t - 0.24) h = Math.min(h, replay ? 39 : 41.5);
    if (goalNear && t > presnap + 0.4) h = Math.min(h, 42.5);
    if (hold && t >= hold.start) h = Math.min(h, 40);
    return h;
  };
  // Replay time-warp: slow windows around the contact cues, merged, then
  // normalized so ∫ wall-time over the play equals dur (budget-neutral).
  const raw = [];
  const addW = (c, half) => {
    if (c == null) return;
    raw.push([Math.max(0, c - half), Math.min(dur, c + half)]);
  };
  if (catchFx) addW(catchFx.t, 0.28);
  if (tc) addW(tc.t, 0.42);
  if (script.breakCue) addW(script.breakCue.t, 0.32);
  if (script.stripCue) addW(script.stripCue.t, 0.3);
  if (toFx) addW(toFx.t, 0.3);
  raw.sort((a, b) => a[0] - b[0]);
  const warpSegs = [];
  for (const s of raw) {
    const m = warpSegs[warpSegs.length - 1];
    if (m && s[0] <= m[1]) m[1] = Math.max(m[1], s[1]);
    else warpSegs.push([s[0], s[1]]);
  }
  let slowRate = 0.45, baseRate = 1;
  const inW = warpSegs.reduce((s, m) => s + (m[1] - m[0]), 0);
  const outW = dur - inW;
  if (inW > 0.01) {
    baseRate = outW / Math.max(0.05, dur - inW / slowRate);
    if (!(baseRate > 0) || baseRate > 1.35) {
      slowRate = Math.min(0.999, Math.max(0.45, inW / Math.max(0.05, dur - outW / 1.35)));
      baseRate = outW / Math.max(0.05, dur - inW / slowRate);
    }
  }
  const warpAt = (t) => {
    for (const m of warpSegs) if (t >= m[0] && t < m[1]) return slowRate;
    return baseRate;
  };
  return { anchorAt, hAt, warpAt, warpSegs, slowRate, baseRate, settle, hold, dur };
}
// ── M23: the officials plan ─────────────────────────────────────────────
// A 3-man crew derived from the ball track — DOM-free, deterministic, and
// NOT part of script.actors (the 22-actor law is untouched). Each official
// trails the ball with his own lag/offset, a hard stand-off keeps the crew
// out of the play, and the signals list maps the play's fx to the poses
// the render layer fires (td arms / first-down point / incomplete wave /
// sack spot / penalty).
function buildOfficialsPlan(script, p) {
  const S = script.step, bt = script.ball.track, dur = script.dur;
  const ballAt = (t) => sampleTrack(bt, S, t);
  const CREW = [
    { id: "R", lane: 80, trail: 5.5, lag: 0.38 },
    { id: "U", lane: 27, trail: 3.5, lag: 0.5 },
    { id: "LJ", lane: 93.5, trail: 1.5, lag: 0.22 }
  ];
  const STANDOFF = 4.2;
  const MAXS = 0.55;
  // Tracks are precomputed at the script's own step with a per-frame speed
  // cap toward each official's ideal spot, then a HARD stand-off vs the
  // current ball. Target-chasing is capped (no teleports when the ideal spot
  // jumps); the stand-off correction is bounded per frame by the ball's own
  // speed cap, so the crew stays smooth AND never inside the play.
  const tracks = CREW.map(() => []);
  const cur = CREW.map(() => null);
  for (let i = 0; i < bt.length; i++) {
    const bn = bt[i];
    CREW.forEach((o, ci) => {
      const bl = bt[Math.max(0, i - Math.round(o.lag / S))];
      const tx = o.id === "LJ" ? 93.5 : o.lane;
      const ty = bl[1] + o.trail;
      let px, py;
      if (!cur[ci]) {
        px = tx;
        py = ty;
      } else {
        let dx = tx - cur[ci][0], dy = ty - cur[ci][1];
        const d = Math.hypot(dx, dy);
        if (d > MAXS) {
          dx *= MAXS / d;
          dy *= MAXS / d;
        }
        px = cur[ci][0] + dx;
        py = cur[ci][1] + dy;
      }
      if (o.id === "LJ") {
        // the line judge rides the near sideline: his lane is FIXED, so the
        // stand-off slides him ALONG the sideline when the ball comes wide.
        px = 93.5;
        const dxL = px - bn[0];
        if (Math.abs(dxL) < STANDOFF) {
          const need = Math.sqrt(STANDOFF * STANDOFF - dxL * dxL);
          const ddy = py - bn[1];
          if (Math.abs(ddy) < need) py = bn[1] + (ddy >= 0 ? need : -need);
        }
        py = clamp6(py, -59, 60.5);
      } else {
        const ddx = px - bn[0], ddy = py - bn[1];
        const d2 = Math.hypot(ddx, ddy);
        if (d2 < STANDOFF) {
          const k = STANDOFF / Math.max(0.2, d2);
          px = bn[0] + ddx * k;
          py = bn[1] + ddy * k;
        }
        px = clamp6(px, 2, 98);
        py = clamp6(py, -59, 60.5);
        // board clamps can drag him back inside the stand-off at the edges —
        // re-open the gap along the across-field axis when they do.
        const rdx = px - bn[0], rdy = py - bn[1];
        if (Math.hypot(rdx, rdy) < STANDOFF) {
          const need = Math.sqrt(Math.max(0, STANDOFF * STANDOFF - rdy * rdy));
          px = clamp6(bn[0] + (rdx >= 0 ? need : -need), 2, 98);
        }
      }
      cur[ci] = [px, py];
      tracks[ci].push([px, py]);
    });
  }
  const at = (t) => tracks.map((tr) => sampleTrack(tr, S, t));
  const signals = [];
  for (const f of script.fx || []) {
    const kind = f.kind === "td" ? "td" : f.kind === "fd" ? "fd" : f.kind === "inc" ? "inc" : f.kind === "sack" ? "spot" : f.kind === "tackle" ? "spot" : f.kind === "flag" ? "flag" : f.kind === "int" || f.kind === "fum" ? "change" : null;
    if (kind && !signals.some((s) => s.kind === kind)) signals.push({ kind, t: f.t, x: f.x, y: f.y });
  }
  return { at, signals, standoff: STANDOFF, crew: CREW.map((o) => o.id), dur };
}
function sampleTrack(track, step, t) {
  if (!track.length) return [0, 0];
  const f = t / step;
  const i = clamp6(Math.floor(f), 0, track.length - 1);
  const j = Math.min(i + 1, track.length - 1);
  const u = clamp6(f - i, 0, 1);
  return [
    track[i][0] + (track[j][0] - track[i][0]) * u,
    track[i][1] + (track[j][1] - track[i][1]) * u
  ];
}

export { COMPOSED_SHAPE, buildPlayScript, sampleTrack, buildCameraPlan, buildOfficialsPlan, selectDuelMove, selectTackleStyle, selectLandmarkMove, selectCatchStyle, selectThrowStyle, selectTrenchStyle, selectSecondaryMotion, selectBodyExpression, buildArmSwitchPresentation, buildBroadcastCommentary };
