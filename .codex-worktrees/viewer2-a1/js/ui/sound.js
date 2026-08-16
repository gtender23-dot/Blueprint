import { state } from '../state.js';

// All game audio is synthesized locally. There are no external samples,
// copyrighted songs, network requests, or changes to simulation randomness.
var ctx = null;
var master = null;
var noise = null;
var stadium = null;
var noiseSeed = 0x51f15e;
var lastCue = /* @__PURE__ */ new Map();

function enabled() {
  var _a;
  return ((_a = state.settings) == null ? void 0 : _a.sound) !== false;
}
function ac() {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.82;
    master.connect(ctx.destination);
  } catch (e) {
    ctx = null;
    master = null;
  }
  return ctx;
}
function ready() {
  if (!enabled()) return null;
  const a = ac();
  if (!a) return null;
  if (a.state === "suspended") {
    try {
      const p = a.resume();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
    }
  }
  return a;
}
function out(a) {
  return master || a.destination;
}
function tone(freq, at, dur, type = "sine", peak = 0.11, endFreq = null) {
  const a = ready();
  if (!a) return;
  const t0 = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  g.gain.setValueAtTime(1e-4, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(1e-4, peak), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
  osc.connect(g).connect(out(a));
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}
function noiseBuffer(a) {
  if (noise && noise.sampleRate === a.sampleRate) return noise;
  const len = Math.max(1, Math.round(a.sampleRate * 2));
  noise = a.createBuffer(1, len, a.sampleRate);
  const d = noise.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < len; i++) {
    noiseSeed = noiseSeed * 1664525 + 1013904223 >>> 0;
    const white = noiseSeed / 4294967296 * 2 - 1;
    brown = (brown + 0.025 * white) / 1.025;
    d[i] = white * 0.42 + brown * 2.4;
  }
  return noise;
}
function burst(at = 0, dur = 0.12, peak = 0.08, low = 90, high = 1100, type = "bandpass") {
  const a = ready();
  if (!a) return;
  const t0 = a.currentTime + at;
  const src = a.createBufferSource();
  const hp = a.createBiquadFilter();
  const lp = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = noiseBuffer(a);
  hp.type = "highpass";
  hp.frequency.value = low;
  lp.type = type;
  lp.frequency.value = high;
  lp.Q.value = type === "bandpass" ? 0.55 : 0.2;
  g.gain.setValueAtTime(1e-4, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(1e-4, peak), t0 + Math.min(0.025, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
  src.connect(hp).connect(lp).connect(g).connect(out(a));
  src.start(t0);
  src.stop(t0 + dur + 0.04);
}
function crowdRise(level = 0.6, dur = 1.1) {
  const peak = 0.025 + Math.max(0, Math.min(1, level)) * 0.075;
  burst(0, dur, peak, 170, 780, "bandpass");
  burst(0.02, dur * 0.78, peak * 0.42, 45, 185, "lowpass");
}
function whistle() {
  tone(2050, 0, 0.18, "sine", 0.035, 2450);
  tone(2380, 0.015, 0.16, "sine", 0.024, 1900);
}
function stadiumGain(level) {
  return 0.008 + Math.max(0, Math.min(1, level)) * 0.035;
}
function stadiumStart(level = 0.2) {
  if (!enabled()) {
    stadiumPause();
    return false;
  }
  const a = ready();
  if (!a) return false;
  if (!stadium) {
    const source = a.createBufferSource();
    const hp = a.createBiquadFilter();
    const crowdBand = a.createBiquadFilter();
    const gain = a.createGain();
    source.buffer = noiseBuffer(a);
    source.loop = true;
    hp.type = "highpass";
    hp.frequency.value = 75;
    crowdBand.type = "bandpass";
    crowdBand.frequency.value = 520;
    crowdBand.Q.value = 0.35;
    gain.gain.value = 1e-4;
    source.connect(hp).connect(crowdBand).connect(gain).connect(out(a));
    source.start();
    stadium = { source, gain, level: 0, decayTimer: null };
  }
  if (stadium.decayTimer) clearTimeout(stadium.decayTimer);
  stadium.level = Math.max(0, Math.min(1, level));
  stadium.gain.gain.cancelScheduledValues(a.currentTime);
  stadium.gain.gain.setTargetAtTime(stadiumGain(stadium.level), a.currentTime, 0.18);
  return true;
}
function stadiumPause() {
  if (!stadium || !ctx) return;
  if (stadium.decayTimer) clearTimeout(stadium.decayTimer);
  stadium.gain.gain.cancelScheduledValues(ctx.currentTime);
  stadium.gain.gain.setTargetAtTime(1e-4, ctx.currentTime, 0.1);
}
function stadiumStop() {
  if (!stadium) return;
  try {
    stadium.source.stop();
  } catch (e) {
  }
  if (stadium.decayTimer) clearTimeout(stadium.decayTimer);
  stadium = null;
}
function stadiumBump(level = 0.65, hold = 900) {
  if (!stadiumStart(level) || !stadium) return;
  stadium.decayTimer = setTimeout(() => {
    stadium.decayTimer = null;
    stadiumStart(0.2);
  }, hold);
}

var CUES = {
  advance: { vib: [15], cooldown: 30, play: () => tone(88, 0, 0.09, "triangle", 0.14) },
  win: { vib: [30, 40, 30], cooldown: 300, play: () => {
    tone(523, 0, 0.14);
    tone(659, 0.09, 0.14);
    tone(784, 0.18, 0.22, "sine", 0.13);
  } },
  loss: { vib: [90], cooldown: 300, play: () => {
    tone(330, 0, 0.18, "sine", 0.09);
    tone(262, 0.14, 0.3, "sine", 0.08);
  } },
  commit: { vib: [20, 30, 20], cooldown: 250, play: () => {
    tone(880, 0, 0.1, "sine", 0.09);
    tone(1175, 0.08, 0.16, "sine", 0.09);
  } },
  banner: { vib: [30, 40, 30, 40, 80], cooldown: 400, play: () => {
    tone(523, 0, 0.12);
    tone(659, 0.1, 0.12);
    tone(784, 0.2, 0.12);
    tone(1047, 0.3, 0.34, "sine", 0.13);
  } },
  tick: { vib: [], cooldown: 25, play: () => tone(600, 0, 0.04, "square", 0.03) },
  snap: { vib: [], cooldown: 180, play: () => {
    burst(0, 0.055, 0.075, 120, 1250, "lowpass");
    tone(82, 0, 0.065, "triangle", 0.045, 58);
  } },
  contact: { vib: [8], cooldown: 95, play: () => {
    burst(0, 0.1, 0.105, 55, 480, "lowpass");
    tone(62, 0, 0.085, "sawtooth", 0.035, 42);
  } },
  catch: { vib: [], cooldown: 120, play: () => burst(0, 0.075, 0.055, 180, 1050, "lowpass") },
  incomplete: { vib: [], cooldown: 250, play: whistle },
  whistle: { vib: [], cooldown: 420, play: whistle },
  firstdown: { vib: [12], cooldown: 450, play: () => {
    crowdRise(0.42, 0.72);
    tone(392, 0, 0.1, "square", 0.025);
    tone(494, 0.08, 0.14, "square", 0.022);
  } },
  sack: { vib: [18], cooldown: 420, play: () => {
    burst(0, 0.16, 0.12, 45, 390, "lowpass");
    crowdRise(0.58, 0.9);
  } },
  turnover: { vib: [25, 25, 45], cooldown: 650, play: () => {
    crowdRise(0.84, 1.35);
    tone(196, 0, 0.22, "sawtooth", 0.045, 147);
    tone(294, 0.08, 0.2, "square", 0.025, 220);
  } },
  touchdown: { vib: [35, 25, 35, 25, 80], cooldown: 900, play: () => {
    crowdRise(1, 1.9);
    tone(196, 0, 0.25, "sawtooth", 0.035);
    tone(247, 0.08, 0.27, "sawtooth", 0.034);
    tone(294, 0.16, 0.34, "sawtooth", 0.04);
    tone(392, 0.29, 0.5, "square", 0.03);
  } },
  fieldgoal: { vib: [20, 20, 40], cooldown: 650, play: () => {
    crowdRise(0.72, 1.2);
    tone(330, 0, 0.13, "triangle", 0.035);
    tone(494, 0.1, 0.22, "triangle", 0.04);
  } },
  kick: { vib: [8], cooldown: 220, play: () => {
    burst(0, 0.09, 0.09, 45, 360, "lowpass");
    tone(72, 0, 0.1, "triangle", 0.04, 48);
  } }
};
function cue(name) {
  if (!enabled()) return false;
  const c = CUES[name];
  if (!c) return false;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const prev = lastCue.get(name) || -1e9;
  if (now - prev < (c.cooldown || 0)) return false;
  lastCue.set(name, now);
  try {
    c.play();
  } catch (e) {
    return false;
  }
  try {
    if (c.vib.length && navigator.vibrate) navigator.vibrate(c.vib);
  } catch (e) {
  }
  return true;
}
function stadiumReact(name) {
  if (!enabled()) return false;
  const played = cue(name);
  const level = name === "touchdown" ? 1 : name === "turnover" ? 0.88 : name === "fieldgoal" ? 0.76 : name === "sack" ? 0.68 : name === "firstdown" ? 0.48 : name === "contact" ? 0.3 : 0.24;
  if (played && level > 0.3) stadiumBump(level, name === "touchdown" ? 1700 : name === "turnover" ? 1250 : 760);
  return played;
}
function soundDebug() {
  return {
    enabled: enabled(),
    context: ctx ? ctx.state : "uncreated",
    stadium: !!stadium,
    stadiumLevel: stadium ? stadium.level : 0,
    cueCount: lastCue.size
  };
}

export { cue, soundDebug, stadiumPause, stadiumReact, stadiumStart, stadiumStop };
