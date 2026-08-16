// Viewer Act C: pure field-world -> screen projection contracts.
//
// The play script remains the only source of actor and ball coordinates. A
// camera may change how those coordinates are presented, but never changes a
// track, event time, catch point, tackle point, or final spot.

const WATCH_CAMERA_ORDER = Object.freeze(["broadcast", "all22", "coach", "endzone", "reverse"]);

const WATCH_CAMERA_LABELS = Object.freeze({
  broadcast: "Broadcast",
  all22: "All-22",
  coach: "Coach",
  endzone: "End Zone",
  reverse: "Reverse"
});

function normalizeWatchCamera(mode) {
  return WATCH_CAMERA_ORDER.includes(mode) ? mode : "broadcast";
}

function nextWatchCamera(mode) {
  const current = normalizeWatchCamera(mode);
  return WATCH_CAMERA_ORDER[(WATCH_CAMERA_ORDER.indexOf(current) + 1) % WATCH_CAMERA_ORDER.length];
}

function watchCameraLabel(mode) {
  return WATCH_CAMERA_LABELS[normalizeWatchCamera(mode)];
}

function projectWatchPoint(mode, worldX, worldY, opts = {}) {
  const camera = normalizeWatchCamera(mode);
  const direction = opts.direction < 0 ? -1 : 1;
  const fieldTop = Number.isFinite(opts.fieldTop) ? opts.fieldTop : 8;
  const fieldHeight = Number.isFinite(opts.fieldHeight) ? opts.fieldHeight : 42;
  const longitudinal = Number.isFinite(opts.longitudinal) ? opts.longitudinal : 1.35;
  const z = Math.max(0, Number(opts.z) || 0);
  const sideX = 31 + direction * (31 - worldY) * longitudinal;
  const sideY = fieldTop + worldX * fieldHeight / 100;

  if (camera === "coach") {
    // The original coach-film orientation: offense at the bottom, attacking
    // toward the top. It rotates with possession while field/world positions
    // remain untouched. Height is deliberately subtle from overhead.
    const downfield = direction * (31 - worldY);
    return [8 + worldX * 0.84, 31 - downfield * 0.72 - z * 0.14];
  }
  if (camera === "endzone") {
    // A low end-zone lens: the field narrows with distance and bodies shrink
    // as they run away from the camera. This is projection only; the play's
    // world tracks remain the single source of geometry and outcomes.
    const downfield = direction * (31 - worldY);
    const depth = Math.max(-28, Math.min(48, downfield));
    const perspective = Math.max(0.6, Math.min(1.22, 1 - depth * 0.0105));
    return [50 + (worldX - 50) * 0.84 * perspective, 43 - downfield * 0.62 - z * 0.46];
  }
  if (camera === "reverse") return [sideX, fieldTop + fieldHeight - worldX * fieldHeight / 100 - z];
  return [sideX, sideY - z];
}

function watchProjectionScale(mode, worldX, worldY, opts = {}) {
  const camera = normalizeWatchCamera(mode);
  if (camera === "coach") return 0.82;
  if (camera === "endzone") {
    const direction = opts.direction < 0 ? -1 : 1;
    const depth = Math.max(-28, Math.min(48, direction * (31 - worldY)));
    return Math.max(0.6, Math.min(1.22, 1 - depth * 0.0105));
  }
  if (camera === "all22") return 0.92;
  return 1;
}

function watchProjectionDepth(mode, worldX, worldY, opts = {}) {
  const pt = projectWatchPoint(mode, worldX, worldY, opts);
  return pt[1];
}

function makeWatchDirector(cuts, duration = Infinity) {
  const ordered = cuts
    .filter((cut) => cut && Number.isFinite(cut.t))
    .map((cut) => ({ t: Math.max(0, cut.t), camera: normalizeWatchCamera(cut.camera), reason: cut.reason || "play" }))
    .sort((a, b) => a.t - b.t || a.camera.localeCompare(b.camera));
  const clean = [];
  for (const cut of ordered) {
    const prev = clean[clean.length - 1];
    if (prev && prev.camera === cut.camera) continue;
    if (prev && cut.t - prev.t < 0.16) continue;
    clean.push(cut);
  }
  if (!clean.length || clean[0].t > 0) clean.unshift({ t: 0, camera: "broadcast", reason: "play" });
  return Object.freeze({
    duration,
    cuts: Object.freeze(clean.map((cut) => Object.freeze(cut))),
    at(t) {
      const now = Math.max(0, Number(t) || 0);
      let active = clean[0];
      for (const cut of clean) {
        if (cut.t > now) break;
        active = cut;
      }
      return active;
    }
  });
}

function buildReplayDirectorPlan(script, p = {}) {
  const presnap = Math.max(0, Number(script && script.presnap) || 0);
  const duration = Math.max(presnap, Number(script && script.dur) || 0);
  const fx = script && Array.isArray(script.fx) ? script.fx : [];
  const throwCue = script && script.throwCue || null;
  const tackleCue = script && script.tackleCue || null;
  const catchFx = fx.find((row) => ["catch", "inc", "int"].includes(row.kind)) || null;
  const turnoverFx = fx.find((row) => row.kind === "int" || row.kind === "fum") || null;
  const cuts = [
    { t: 0, camera: "all22", reason: "formation" },
    { t: presnap + 0.05, camera: "broadcast", reason: "snap" }
  ];
  if (throwCue) {
    cuts.push({ t: Math.max(presnap + 0.3, throwCue.release - 0.48), camera: "endzone", reason: "pocket" });
    cuts.push({ t: throwCue.release + 0.08, camera: "broadcast", reason: "flight" });
    if (catchFx && catchFx.kind !== "int") cuts.push({ t: catchFx.t + 0.14, camera: "endzone", reason: catchFx.kind === "inc" ? "result" : "run-after-catch" });
  } else if (tackleCue) {
    cuts.push({ t: Math.max(presnap + 0.42, tackleCue.t - 0.46), camera: "endzone", reason: "contact" });
  }
  if (turnoverFx) cuts.push({ t: turnoverFx.t + 0.18, camera: "reverse", reason: "change-of-possession" });
  if (p && p.td && script && script.celebrateCue) cuts.push({ t: script.celebrateCue.t, camera: "endzone", reason: "score" });
  return makeWatchDirector(cuts, duration);
}

function buildSpecialTeamsDirectorPlan(p = {}, timing = {}) {
  const contact = Number(timing.contact) || 0;
  const landing = Math.max(contact, Number(timing.landing) || contact);
  const duration = Math.max(landing, Number(timing.duration) || landing);
  const isReturn = Number(timing.returnDuration) > 0;
  const cuts = [
    { t: 0, camera: "all22", reason: "alignment" },
    { t: Math.max(0.12, contact - 0.18), camera: "endzone", reason: "kick" },
    { t: landing + 0.08, camera: isReturn ? "reverse" : "broadcast", reason: isReturn ? "return" : "result" }
  ];
  if (p && (p.made || p.touchback) && !isReturn) cuts.push({ t: Math.max(landing + 0.22, duration - 0.22), camera: "endzone", reason: "finish" });
  return makeWatchDirector(cuts, duration);
}

function selectWatchLabels(entries, opts = {}) {
  const camera = normalizeWatchCamera(opts.camera);
  if (camera !== "endzone" && camera !== "coach") return entries.map((row) => row.id);
  const max = Number.isFinite(opts.max) ? opts.max : camera === "endzone" ? 10 : 14;
  const dx = camera === "endzone" ? 7.2 : 5.8;
  const dy = camera === "endzone" ? 3.4 : 2.8;
  const ordered = entries.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.y - b.y || a.x - b.x || String(a.id).localeCompare(String(b.id)));
  const chosen = [];
  for (const row of ordered) {
    const featured = (row.priority || 0) >= 2;
    const blocked = chosen.some((kept) => Math.abs(kept.x - row.x) < dx && Math.abs(kept.y - row.y) < dy);
    if (featured || !blocked && chosen.length < max) chosen.push(row);
  }
  return chosen.map((row) => row.id);
}

const WATCH_DIRECTOR_FOCUS_LABELS = Object.freeze({
  formation: "FORMATION",
  snap: "SNAP",
  pocket: "POCKET",
  flight: "BALL IN FLIGHT",
  result: "RESULT",
  "run-after-catch": "RUN AFTER CATCH",
  contact: "CONTACT",
  "change-of-possession": "CHANGE OF POSSESSION",
  score: "SCORE",
  alignment: "ALIGNMENT",
  kick: "KICK FLIGHT",
  return: "RETURN",
  finish: "FINISH"
});

function watchDirectorFocusLabel(reason) {
  return WATCH_DIRECTOR_FOCUS_LABELS[reason] || String(reason || "play").replace(/-/g, " ").toUpperCase();
}

function replayDirectorFocus(script, p = {}, reason = "play") {
  const actorIds = new Set((script && script.actors || []).map((actor) => actor.id));
  const primary = [], secondary = [];
  const add = (list, id) => {
    if (id && actorIds.has(id) && !primary.includes(id) && !secondary.includes(id)) list.push(id);
  };
  const tackle = script && script.tackleCue || null;
  const carrier = p.carrierSlotId || script && script.carryCue && script.carryCue.id || tackle && tackle.carrierId;
  const target = p.targetSlotId || script && script.carryCue && script.carryCue.id;
  const winningRusher = (script && script.rushCues || []).find((cue) => cue.win) || (script && script.rushCues || [])[0];
  if (reason === "snap") add(primary, "QB");
  else if (reason === "pocket") {
    add(primary, "QB");
    add(secondary, winningRusher && winningRusher.id);
  } else if (reason === "flight" || reason === "result") {
    add(primary, target);
    add(secondary, script && script.covId);
  } else if (reason === "run-after-catch") {
    add(primary, target || carrier);
    add(secondary, tackle && tackle.id);
    add(secondary, tackle && tackle.assistId);
  } else if (reason === "contact") {
    add(primary, carrier);
    add(secondary, tackle && tackle.id);
    add(secondary, tackle && tackle.assistId);
  } else if (reason === "change-of-possession") {
    add(primary, script && script.pickId);
    add(secondary, tackle && tackle.id);
  } else if (reason === "score") {
    add(primary, carrier || target || script && script.pickId);
  }
  return Object.freeze({
    kind: reason || "play",
    label: watchDirectorFocusLabel(reason),
    primary: Object.freeze(primary),
    secondary: Object.freeze(secondary),
    ball: reason === "flight" || reason === "result" || reason === "change-of-possession"
  });
}

function specialTeamsDirectorFocus(actors, reason = "play") {
  const actorIds = new Set((actors || []).map((actor) => actor.id));
  const primary = [], secondary = [];
  const add = (list, id) => {
    if (id && actorIds.has(id) && !primary.includes(id) && !secondary.includes(id)) list.push(id);
  };
  if (reason === "alignment") {
    add(primary, "K");
    add(secondary, "PR");
    add(secondary, "KR2");
  } else if (reason === "kick") {
    add(primary, "K");
    add(secondary, "H");
    add(secondary, "LS");
    add(secondary, "PR");
  } else if (reason === "return") {
    add(primary, "PR");
    add(secondary, "KR2");
  } else {
    add(primary, "K");
    add(secondary, "PR");
  }
  return Object.freeze({
    kind: reason || "play",
    label: watchDirectorFocusLabel(reason),
    primary: Object.freeze(primary),
    secondary: Object.freeze(secondary),
    ball: reason === "kick"
  });
}

export {
  WATCH_CAMERA_ORDER,
  normalizeWatchCamera,
  nextWatchCamera,
  watchCameraLabel,
  projectWatchPoint,
  watchProjectionScale,
  watchProjectionDepth,
  buildReplayDirectorPlan,
  buildSpecialTeamsDirectorPlan,
  selectWatchLabels,
  watchDirectorFocusLabel,
  replayDirectorFocus,
  specialTeamsDirectorFocus
};
