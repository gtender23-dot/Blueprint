// M19 deterministic locomotion-controller gate.
// Usage: node tools/locomotion_probe.mjs
import { spriteMotionTick } from "../js/ui/sprite.js";

class FakeClassList {
  constructor(...items) { this.items = new Set(items); }
  add(...items) { items.forEach(item => this.items.add(item)); }
  remove(...items) { items.forEach(item => this.items.delete(item)); }
  contains(item) { return this.items.has(item); }
  toggle(item, force) {
    const on = force === undefined ? !this.items.has(item) : !!force;
    if (on) this.items.add(item); else this.items.delete(item);
    return on;
  }
}

const makeNode = (face = "e") => {
  const flip = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  return {
    classList: new FakeClassList(`wsp-face-${face}`),
    dataset: {},
    style: { props: {}, setProperty(k, v) { this.props[k] = String(v); } },
    querySelector(sel) { return sel === ".wsp-flip" ? flip : null; },
    flip
  };
};

const rig = (face = "e") => {
  const node = makeNode(face);
  let x = 0, y = 0, now = 1_000;
  spriteMotionTick(node, x, y, now);
  return {
    node,
    step(dx, dy, ms = 50) {
      x += dx; y += dy; now += ms;
      spriteMotionTick(node, x, y, now);
      return node._wsm;
    },
    repeat(n, dx, dy, ms = 50) { for (let i = 0; i < n; i++) this.step(dx, dy, ms); return node._wsm; }
  };
};

let pass = true;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  [${detail}]` : ""}`);
  if (!ok) pass = false;
};

const runner = rig("e");
runner.repeat(4, 0.11, 0, 50);
check("movement exits still state through hysteresis", !runner.node.classList.contains("wsp-still"), runner.node.dataset.locomotion);
check("first steps receive acceleration body language", ["start", "walk", "jog"].includes(runner.node.dataset.locomotion), runner.node.dataset.locomotion);
runner.repeat(18, 0.36, 0, 50);
check("sustained football speed reaches sprint", runner.node.dataset.locomotion === "sprint", runner.node.dataset.locomotion);
check("ground odometer drives gait phase", Number(runner.node.style.props["--ph"]) >= 0 && Number(runner.node.style.props["--ph"]) < 1, runner.node.style.props["--ph"]);
const heldPhase = runner.node.style.props["--ph"];
runner.step(0, 0, 16);
check("zero ground travel cannot advance the stride", runner.node.style.props["--ph"] === heldPhase, `${heldPhase}->${runner.node.style.props["--ph"]}`);
check("hard deceleration receives brake state", runner.node.dataset.locomotion === "brake", runner.node.dataset.locomotion);

// Restore eastward velocity, then redirect sharply. The first turn frame must
// plant but must not flip the complete body for a one-frame track correction.
runner.repeat(8, 0.34, 0, 50);
const faceBefore = runner.node._wsm.face;
runner.step(0, 0.34, 50);
check("sharp redirect creates a planted cut", runner.node.dataset.locomotion === "plant" && (runner.node.classList.contains("wsp-cut-left") || runner.node.classList.contains("wsp-cut-right")), runner.node.dataset.locomotion);
check("facing has temporal hysteresis", runner.node._wsm.face === faceBefore, `${faceBefore}->${runner.node._wsm.face}`);
check("plant chooses one support foot", runner.node.classList.contains("wsp-plant-a") !== runner.node.classList.contains("wsp-plant-b"));

const pedal = rig("e");
pedal.repeat(24, -0.16, 0, 50);
check("controlled retreat reads as backpedal", pedal.node.classList.contains("wsp-backpedal"), `face=${pedal.node._wsm.face} v=${Math.hypot(pedal.node._wsm.vx, pedal.node._wsm.vy).toFixed(2)}`);
check("backpedal preserves combat facing", pedal.node._wsm.face === "e", pedal.node._wsm.face);

const stopper = rig("e");
stopper.repeat(12, 0.22, 0, 50);
stopper.repeat(28, 0, 0, 50);
check("deceleration settles into still without oscillation", stopper.node.dataset.locomotion === "still" && stopper.node.classList.contains("wsp-still"), stopper.node.dataset.locomotion);
check("stopped athlete retains a planted stance", stopper.node.classList.contains("wsp-plant-a") !== stopper.node.classList.contains("wsp-plant-b"));
stopper.repeat(12, 0.015, 0, 50);
check("sub-threshold track noise remains still", stopper.node.dataset.locomotion === "still", stopper.node.dataset.locomotion);

const states = ["still", "start", "walk", "jog", "sprint", "brake", "plant"];
const active = states.filter(state => runner.node.classList.contains(`wsp-loco-${state}`));
check("locomotion states are mutually exclusive", active.length === 1, active.join(","));
process.exit(pass ? 0 : 1);
