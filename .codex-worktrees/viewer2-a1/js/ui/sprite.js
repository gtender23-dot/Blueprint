// Watch-viewer player sprites — directional bodies + motion-driven posing.
//
// Three bodies per player, one visible at a time by facing class on the actor
// node (wsp-face-e/w/n/s): a front view (facemask), a back view (helmet
// stripe, back number), and a side profile (mirrored for west). The facing,
// leg cadence and body lean are driven per-frame by spriteMotionTick() from
// the actor's REAL on-screen velocity — legs stop when the man stops, stride
// matches ground actually covered, and the body pitches into the run.
//
// Screen frame (watchSidePoint): +x = downfield for the offense, so the
// offense's "combat" facing is east and the defense's is west. A man only
// turns his back on the line when he's truly turned and running (v > TURN_V):
// a QB dropping, an OL pass-setting, or a DB backpedaling all keep their
// combat facing — which is exactly how football looks from the sideline.

import { escapeHtml } from '../utils.js';

// The watch trace identifies assignments (QB, X, CB1), not roster jersey
// numbers. Preserve an explicit number when a future trace supplies one;
// otherwise create a stable, position-legal college number from the actor id.
// This keeps the useful assignment tag outside the body while preventing role
// abbreviations such as CB or SIT from being painted across the uniform.
function uniformNumber(room, id, supplied) {
  const explicit = String(supplied ?? "").match(/^\d{1,2}$/);
  if (explicit) return Number(explicit[0]);
  const key = `${room}:${id}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
  const pick = (lo, hi, salt = 0) => lo + ((hash + salt) % (hi - lo + 1));
  if (/^(OL|C|G|T)$/.test(room)) return pick(50, 79);
  if (room === "LS") return pick(40, 59);
  if (/^(DL|DE|DT|NT)$/.test(room)) return pick(50, 99);
  if (/^(LB|ILB|OLB)$/.test(room)) return hash % 4 ? pick(0, 59) : pick(90, 99, 11);
  if (room === "QB") return pick(0, 19);
  if (/^(WR|PR|KR)$/.test(room)) return hash % 3 ? pick(0, 19) : pick(80, 89, 7);
  if (room === "TE") return hash % 2 ? pick(0, 49) : pick(80, 89, 5);
  if (/^(RB|FB|CB|S|FS|SS|K|P)$/.test(room)) return pick(0, 49);
  return pick(0, 99);
}

function spriteMarkup(a, face) {
  const off = a.team === "off";
  const c = off ? "wsp-off" : "wsp-def";
  const hl = off ? "wsp-off-hl" : "wsp-def-hl";
  let gh = 0;
  for (let i = 0; i < String(a.id).length; i++) gh = (gh + String(a.id).charCodeAt(i)) % 97;
  const room = String(a.grp || a.pos || a.label || "").toUpperCase();
  const rbPrototype = room === "RB";
  const profile = /^(OL|DL|DT|NT|C|G|T)$/.test(room) ? "line"
    : /^(FB|TE|DE|LB|ILB|OLB)$/.test(room) ? "power"
      : room === "QB" ? "quarterback"
        : room === "RB" ? "runner" : "skill";
  const taperedBody = /^(QB|RB|WR|CB|S|FS|SS|K|P|PR|KR)$/.test(room);
  const gloveClass = gh % 3 === 0 ? " wsp-gear-gloves" : "";
  const visorClass = gh % 4 === 0 && profile !== "line" ? " wsp-gear-visor" : "";
  const armSleeveClass = gh % 4 === 1 ? " wsp-gear-arm-sleeves" : "";
  const kneeBraceClass = gh % 5 === 2 && profile !== "skill" ? " wsp-gear-knee-brace" : "";
  const cageMask = profile === "line" || profile === "power";
  const build = /^(OL|DL|DT|NT)$/.test(room) ? "line"
    : /^(WR|CB|S|K|P)$/.test(room) ? "skill"
      : /^(QB|RB|FB|TE|DE|LB|ILB|OLB)$/.test(room) ? "balanced" : "balanced";
  const skinTones = [
    ["#f1c39a", "#c8885e"],
    ["#d9a06f", "#a86642"],
    ["#aa6b43", "#724126"],
    ["#74452d", "#482819"],
    ["#4b2b1d", "#2c1812"]
  ];
  const [skin, skinShadow] = skinTones[gh % skinTones.length];
  const gait = (-(gh % 8 * 0.045)).toFixed(3);
  const jersey = uniformNumber(room, a.id, a.jerseyNumber ?? a.jersey ?? a.number);
  const jerseyText = escapeHtml(String(jersey));
  const num = `<text class="wsp-number" x="0" y="-2.43">${jerseyText}</text>`;
  const sideNumberTransform = face === "w" ? ` transform="translate(.25 0) scale(-1 1) translate(-.25 0)"` : "";
  const sideNum = `<text class="wsp-number wsp-side-number" x=".25" y="-2.55"${sideNumberTransform}>${jerseyText}</text>`;

  /* ── front/back bodies (shared frame art) ─────────────────────────── */
  // Anatomical two-joint legs: tapered thigh, visible knee, calf, sock and
  // planted cleat. Keeping those landmarks separate makes the stride read as
  // an athlete running instead of two blocks hinging beneath a round torso.
  const legsA = `<g class="wsp-leg-chain"><path class="wsp-leg wsp-thigh" d="M-1.01-2.02h.72l.05.55-.17.47-.58-.02-.15-.5z"/><ellipse class="wsp-knee" cx="-.69" cy="-1" rx=".31" ry=".24"/><path class="wsp-leg wsp-calf" d="M-.96-.94l.55-.02-.03.5-.18.33h-.48l.12-.42z"/><path class="wsp-sock" d="M-1.1-.38h.49l-.03.26h-.52z"/><path class="wsp-shoe" d="M-1.18-.18h.59l.31.18h-1.06z"/></g><g class="wsp-leg-chain"><path class="wsp-leg wsp-thigh" d="M.29-2.02h.72l.13.52-.12.5-.58.02-.19-.46z"/><ellipse class="wsp-knee" cx=".73" cy="-1" rx=".31" ry=".24"/><path class="wsp-leg wsp-calf" d="M.45-.96H1l.12.42-.04.42H.56L.49-.5z"/><path class="wsp-sock" d="M.56-.38h.52l.06.26H.6z"/><path class="wsp-shoe" d="M.58-.18h.59l.35.18H.48z"/></g>`;
  const legsB = `<g class="wsp-leg-chain"><path class="wsp-leg wsp-thigh" d="M-1.01-2.02h.72l-.1.53-.31.42-.55-.14.08-.5z"/><ellipse class="wsp-knee" cx="-.96" cy="-1.1" rx=".31" ry=".24" transform="rotate(20 -.96 -1.1)"/><path class="wsp-leg wsp-calf" d="M-1.18-1.06l.52.15-.22.42-.34.28-.45-.2.3-.35z"/><path class="wsp-sock" d="M-1.55-.54l.45.2-.13.22-.48-.2z"/><path class="wsp-shoe" d="M-1.7-.38l.53.22.29.25-1.05-.31z"/></g><g class="wsp-leg-chain"><path class="wsp-leg wsp-thigh" d="M.29-2.02h.72l.13.52-.12.5-.58.02-.19-.46z"/><ellipse class="wsp-knee" cx=".73" cy="-1" rx=".31" ry=".24"/><path class="wsp-leg wsp-calf" d="M.45-.96H1l.12.42-.04.42H.56L.49-.5z"/><path class="wsp-sock" d="M.56-.38h.52l.06.26H.6z"/><path class="wsp-shoe" d="M.58-.18h.59l.35.18H.48z"/></g>`;
  // Reference-driven RB lower body: the cleaned master is long through the
  // femur and calf, with a narrow knee and a cleat that does not balloon into
  // the silhouette. These remain separate chains so the gait scrub still owns
  // every joint instead of baking animation into a bitmap frame.
  const rbLegsA = `<g class="wsp-leg-chain wsp-reference-leg-chain"><path class="wsp-leg wsp-thigh" d="M-.86-2.18h.56l.03.63-.17.5-.45-.03-.1-.57z"/><ellipse class="wsp-knee" cx="-.66" cy="-1.02" rx=".25" ry=".19"/><path class="wsp-leg wsp-calf" d="M-.86-.96l.42-.02.02.55-.17.31h-.39l.11-.45z"/><path class="wsp-sock" d="M-.98-.38h.4l-.02.26h-.43z"/><path class="wsp-shoe" d="M-1.04-.18h.48l.3.18h-.94z"/></g><g class="wsp-leg-chain wsp-reference-leg-chain"><path class="wsp-leg wsp-thigh" d="M.3-2.18h.56l.1.6-.1.53-.45.03-.14-.54z"/><ellipse class="wsp-knee" cx=".65" cy="-1.02" rx=".25" ry=".19"/><path class="wsp-leg wsp-calf" d="M.43-.98h.43l.1.47-.04.39H.52l-.07-.47z"/><path class="wsp-sock" d="M.52-.38h.4l.04.26H.54z"/><path class="wsp-shoe" d="M.54-.18h.48l.31.18H.47z"/></g>`;
  const rbLegsB = `<g class="wsp-leg-chain wsp-reference-leg-chain"><path class="wsp-leg wsp-thigh" d="M-.86-2.18h.56l-.08.62-.27.48-.44-.13.06-.56z"/><ellipse class="wsp-knee" cx="-.88" cy="-1.1" rx=".25" ry=".19" transform="rotate(18 -.88 -1.1)"/><path class="wsp-leg wsp-calf" d="M-1.07-1.05l.41.13-.19.46-.29.28-.37-.18.25-.39z"/><path class="wsp-sock" d="M-1.4-.5l.37.18-.11.21-.4-.18z"/><path class="wsp-shoe" d="M-1.54-.34l.44.19.28.23-.91-.27z"/></g><g class="wsp-leg-chain wsp-reference-leg-chain"><path class="wsp-leg wsp-thigh" d="M.3-2.18h.56l.1.6-.1.53-.45.03-.14-.54z"/><ellipse class="wsp-knee" cx=".65" cy="-1.02" rx=".25" ry=".19"/><path class="wsp-leg wsp-calf" d="M.43-.98h.43l.1.47-.04.39H.52l-.07-.47z"/><path class="wsp-sock" d="M.52-.38h.4l.04.26H.54z"/><path class="wsp-shoe" d="M.54-.18h.48l.31.18H.47z"/></g>`;
  const frontLegsA = rbLegsA;
  const frontLegsB = rbLegsB;
  const runPose = `<g class="wsp-pose-run"><g class="wsp-limb wsp-run-arm-l"><path class="wsp-arm ${c}" d="M-1.45-3.2l-.62.42.34.86.5.68.53-.3-.36-.77.18-.65z"/><circle class="wsp-skin" cx="-1.16" cy="-1.44" r=".31"/></g><g class="wsp-limb wsp-run-arm-r"><path class="wsp-arm ${c}" d="M1.45-3.2l.58.48-.38.72-.56.52-.49-.34.44-.66-.2-.54z"/><circle class="wsp-skin" cx="1.02" cy="-1.45" r=".31"/></g></g>`;
  const carryPose = `<g class="wsp-pose-carry"><g class="wsp-limb wsp-carry-arm-l"><path class="wsp-arm ${c}" d="M-1.42-3.15l-.44.54.64.66.94.39.24-.48-.78-.5-.12-.5z"/><circle class="wsp-skin" cx="-.17" cy="-1.65" r=".3"/></g><g class="wsp-limb wsp-carry-arm-r"><path class="wsp-arm ${c}" d="M1.42-3.12l.38.6-.64.66-.98.36-.2-.5.8-.48.1-.5z"/><circle class="wsp-skin" cx=".2" cy="-1.62" r=".28"/></g></g>`;
  const blockPose = `<g class="wsp-pose-block"><g class="wsp-limb wsp-block-arm-l"><path class="wsp-arm ${c}" d="M-1.42-3.16l-.5.34.56.76.86.37.24-.47-.7-.48-.1-.4z"/><circle class="wsp-skin" cx="-.38" cy="-1.79" r=".32"/></g><g class="wsp-limb wsp-block-arm-r"><path class="wsp-arm ${c}" d="M1.42-3.16l.5.34-.56.76-.86.37-.24-.47.7-.48.1-.4z"/><circle class="wsp-skin" cx=".38" cy="-1.79" r=".32"/></g></g>`;
  const catchPose = `<g class="wsp-pose-catch"><g class="wsp-limb wsp-catch-arm-l"><path class="wsp-arm ${c}" d="M-1.28-3.30l-.64-.62.30-.72.90.30.12.62-.48.48z"/><circle class="wsp-skin" cx="-1.54" cy="-4.30" r=".33"/></g><g class="wsp-limb wsp-catch-arm-r"><path class="wsp-arm ${c}" d="M1.28-3.30l.64-.62-.30-.72-.90.30-.12.62.48.48z"/><circle class="wsp-skin" cx="1.54" cy="-4.30" r=".33"/></g></g>`;
  const throwPose = `<g class="wsp-pose-throw"><g class="wsp-limb wsp-throw-guide"><path class="wsp-arm ${c}" d="M-1.4-3.16l-.48.39.55.7.9.27.2-.47-.72-.4-.08-.38z"/><circle class="wsp-skin" cx="-.34" cy="-1.83" r=".3"/></g><g class="wsp-limb wsp-throw-arm"><path class="wsp-arm ${c}" d="M1.4-3.18l.43-.15.25-.72-.35-.55-.43.18.12.58-.36.54z"/><circle class="wsp-skin" cx="1.82" cy="-4.1" r=".3"/></g></g>`;
  const tacklePose = `<g class="wsp-pose-tackle"><g class="wsp-limb wsp-tkl-arm-l"><path class="wsp-arm ${c}" d="M-1.44-3.05l-.72.10.02.86.74.6.44-.42-.34-.6.06-.56z"/><circle class="wsp-skin" cx="-1.86" cy="-1.86" r=".32"/></g><g class="wsp-limb wsp-tkl-arm-r"><path class="wsp-arm ${c}" d="M1.44-3.05l.72.10-.02.86-.74.6-.44-.42.34-.6-.06-.56z"/><circle class="wsp-skin" cx="1.86" cy="-1.86" r=".32"/></g></g>`;
  const stiffPose = `<g class="wsp-pose-stiff"><g class="wsp-limb wsp-stiff-arm"><path class="wsp-arm ${c}" d="M1.35-3.15l1.05-.02.30.58-.38.5-1.02.06-.30-.5z"/><circle class="wsp-skin" cx="2.62" cy="-3.0" r=".34"/></g><g class="wsp-limb wsp-carry-arm-l"><path class="wsp-arm ${c}" d="M-1.42-3.15l-.44.54.64.66.94.39.24-.48-.78-.5-.12-.5z"/><circle class="wsp-skin" cx="-.17" cy="-1.65" r=".3"/></g></g>`;
  const idlePose = `<g class="wsp-pose-idle"><path class="wsp-arm ${c}" d="M-1.5-3.35l-.5.28.06.9.22.72.5-.08-.12-.82.14-.66z"/><circle class="wsp-skin" cx="-1.32" cy="-1.58" r=".3"/><path class="wsp-arm ${c}" d="M1.5-3.35l.5.28-.06.9-.22.72-.5-.08.12-.82-.14-.66z"/><circle class="wsp-skin" cx="1.32" cy="-1.58" r=".3"/></g>`;
  // The turnaround's arms are visibly two-joint limbs, not solid columns.
  // RB-only pose art keeps the established pose class names so every existing
  // cue animation continues to drive the same shoulder-level group.
  const rbRunPose = `<g class="wsp-pose-run"><g class="wsp-limb wsp-run-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.08-3.43l-.31.05-.12.72.18.28.29-.12-.08-.58.18-.25z"/><ellipse class="wsp-elbow" cx="-1.24" cy="-2.55" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.32-2.52l.27-.08.34.58-.06.25-.28.02-.24-.5z"/><circle class="wsp-skin" cx="-.69" cy="-1.76" r=".22"/></g><g class="wsp-limb wsp-run-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.08-3.43l.31.05.12.72-.18.28-.29-.12.08-.58-.18-.25z"/><ellipse class="wsp-elbow" cx="1.24" cy="-2.55" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M1.32-2.52l-.27-.08-.34.58.06.25.28.02.24-.5z"/><circle class="wsp-skin" cx=".69" cy="-1.76" r=".22"/></g></g>`;
  const rbCarryPose = `<g class="wsp-pose-carry"><g class="wsp-limb wsp-carry-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.08-3.4l-.3.08.08.67.25.25.26-.17-.18-.52.1-.26z"/><ellipse class="wsp-elbow" cx="-.92" cy="-2.47" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-1-2.42l.26-.12.57.48.02.26-.24.12-.52-.37z"/><circle class="wsp-skin" cx="-.12" cy="-1.72" r=".21"/></g><g class="wsp-limb wsp-carry-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.08-3.4l.3.08-.08.67-.25.25-.26-.17.18-.52-.1-.26z"/><ellipse class="wsp-elbow" cx=".92" cy="-2.47" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M1-2.42l-.26-.12-.57.48-.02.26.24.12.52-.37z"/><circle class="wsp-skin" cx=".12" cy="-1.72" r=".21"/></g></g>`;
  const rbBlockPose = `<g class="wsp-pose-block"><g class="wsp-limb wsp-block-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.08-3.4l-.3.08.13.61.25.2.24-.18-.2-.45.09-.25z"/><ellipse class="wsp-elbow" cx="-.85" cy="-2.52" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-.92-2.48l.25-.11.54.43.02.24-.23.12-.49-.33z"/><circle class="wsp-skin" cx="-.08" cy="-1.78" r=".22"/></g><g class="wsp-limb wsp-block-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.08-3.4l.3.08-.13.61-.25.2-.24-.18.2-.45-.09-.25z"/><ellipse class="wsp-elbow" cx=".85" cy="-2.52" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.92-2.48l-.25-.11-.54.43-.02.24.23.12.49-.33z"/><circle class="wsp-skin" cx=".08" cy="-1.78" r=".22"/></g></g>`;
  const rbCatchPose = `<g class="wsp-pose-catch"><g class="wsp-limb wsp-catch-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.06-3.45l-.28-.1-.3-.58.11-.24.28.02.23.5-.1.25z"/><ellipse class="wsp-elbow" cx="-1.52" cy="-4.17" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.6-4.13l.26-.1.48-.37.22.08.04.24-.44.42z"/><circle class="wsp-skin" cx="-.55" cy="-4.48" r=".22"/></g><g class="wsp-limb wsp-catch-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.06-3.45l.28-.1.3-.58-.11-.24-.28.02-.23.5.1.25z"/><ellipse class="wsp-elbow" cx="1.52" cy="-4.17" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M1.6-4.13l-.26-.1-.48-.37-.22.08-.04.24.44.42z"/><circle class="wsp-skin" cx=".55" cy="-4.48" r=".22"/></g></g>`;
  const referenceThrowPose = `<g class="wsp-pose-throw"><g class="wsp-limb wsp-throw-guide"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.08-3.4l-.29.08.1.61.24.22.25-.17-.19-.47.1-.25z"/><ellipse class="wsp-elbow" cx="-.87" cy="-2.53" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-.94-2.49l.25-.1.57.36.03.24-.22.13-.52-.27z"/><circle class="wsp-skin" cx="-.05" cy="-1.91" r=".22"/></g><g class="wsp-limb wsp-throw-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.06-3.44l.28-.1.17-.59-.13-.22-.28.04-.12.51.11.23z"/><ellipse class="wsp-elbow" cx="1.48" cy="-4.2" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M1.43-4.25l.27.02.35.47-.03.24-.24.07-.4-.39z"/><circle class="wsp-skin" cx="2.05" cy="-3.43" r=".22"/></g></g>`;
  const referenceTacklePose = `<g class="wsp-pose-tackle"><g class="wsp-limb wsp-tkl-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.06-3.34l-.28.1-.05.61.18.25.27-.11-.08-.49.14-.26z"/><ellipse class="wsp-elbow" cx="-1.25" cy="-2.48" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.32-2.45l.26-.05.43.49-.02.24-.24.08-.4-.39z"/><circle class="wsp-skin" cx="-.56" cy="-1.7" r=".22"/></g><g class="wsp-limb wsp-tkl-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.06-3.34l.28.1.05.61-.18.25-.27-.11.08-.49-.14-.26z"/><ellipse class="wsp-elbow" cx="1.25" cy="-2.48" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M1.32-2.45l-.26-.05-.43.49.02.24.24.08.4-.39z"/><circle class="wsp-skin" cx=".56" cy="-1.7" r=".22"/></g></g>`;
  const rbStiffPose = `<g class="wsp-pose-stiff"><g class="wsp-limb wsp-stiff-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.05-3.4l.12-.28.69-.04.16.19-.1.25-.59.08-.2-.13z"/><ellipse class="wsp-elbow" cx="1.98" cy="-3.5" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M2-3.58l.03.27.63.04.18-.16-.08-.24-.56-.1z"/><circle class="wsp-skin" cx="2.85" cy="-3.48" r=".23"/></g><g class="wsp-limb wsp-carry-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.08-3.4l-.3.08.08.67.25.25.26-.17-.18-.52.1-.26z"/><ellipse class="wsp-elbow" cx="-.92" cy="-2.47" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-1-2.42l.26-.12.57.48.02.26-.24.12-.52-.37z"/><circle class="wsp-skin" cx="-.12" cy="-1.72" r=".21"/></g></g>`;
  const rbIdlePose = `<g class="wsp-pose-idle"><g class="wsp-rb-arm-chain"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.08-3.46l-.31.05-.05.73.17.27.28-.1-.08-.6.15-.26z"/><ellipse class="wsp-elbow" cx="-1.24" cy="-2.53" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.32-2.5l.28-.04.08.66-.12.44-.27-.03-.02-.58z"/><circle class="wsp-skin" cx="-1.15" cy="-1.42" r=".22"/></g><g class="wsp-rb-arm-chain"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.08-3.46l.31.05.05.73-.17.27-.28-.1.08-.6-.15-.26z"/><ellipse class="wsp-elbow" cx="1.24" cy="-2.53" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M1.32-2.5l-.28-.04-.08.66.12.44.27-.03.02-.58z"/><circle class="wsp-skin" cx="1.15" cy="-1.42" r=".22"/></g></g>`;
  // M8 authored set positions. They only display while the board carries the
  // explicit watch-presnap class, so low velocity after the whistle cannot put
  // an actor back into a stance. Line bodies alternate two- and three-point
  // hand placement; the other families carry ready hands at football height.
  const setStyle = profile === "line" && gh % 3 === 0 ? "three" : profile;
  const frontSetPose = profile === "line"
    ? `<g class="wsp-pose-set wsp-set-${setStyle}"><g class="wsp-limb wsp-set-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.08-3.4l-.3.1.13.62.25.2.24-.18-.19-.46.08-.25z"/><ellipse class="wsp-elbow" cx="-.84" cy="-2.5" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-.92-2.46l.25-.11.43.54-.03.25-.24.08-.36-.45z"/><circle class="wsp-skin" cx="-.18" cy="-1.62" r=".22"/></g><g class="wsp-limb wsp-set-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.08-3.4l.3.1-.13.62-.25.2-.24-.18.19-.46-.08-.25z"/><ellipse class="wsp-elbow" cx=".84" cy="-2.5" rx=".16" ry=".13"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.92-2.46l-.25-.11-.43.54.03.25.24.08.36-.45z"/><circle class="wsp-skin" cx=".18" cy="-1.62" r=".22"/></g></g>`
    : profile === "quarterback"
      ? `<g class="wsp-pose-set wsp-set-quarterback"><g class="wsp-limb wsp-set-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.06-3.42l-.28.11.13.58.24.19.23-.17-.18-.42.08-.24z"/><ellipse class="wsp-elbow" cx="-.82" cy="-2.59" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-.88-2.55l.24-.1.48.33.03.23-.21.13-.45-.23z"/><circle class="wsp-skin" cx="-.08" cy="-2.02" r=".21"/></g><g class="wsp-limb wsp-set-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.06-3.42l.28.11-.13.58-.24.19-.23-.17.18-.42-.08-.24z"/><ellipse class="wsp-elbow" cx=".82" cy="-2.59" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.88-2.55l-.24-.1-.48.33-.03.23.21.13.45-.23z"/><circle class="wsp-skin" cx=".08" cy="-2.02" r=".21"/></g></g>`
      : `<g class="wsp-pose-set wsp-set-ready"><g class="wsp-limb wsp-set-arm-l"><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.06-3.43l-.29.08.03.64.2.24.26-.13-.1-.49.12-.25z"/><ellipse class="wsp-elbow" cx="-1.05" cy="-2.53" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-1.12-2.49l.25-.06.34.48-.02.24-.23.09-.31-.38z"/><circle class="wsp-skin" cx="-.47" cy="-1.71" r=".21"/></g><g class="wsp-limb wsp-set-arm-r"><path class="wsp-arm wsp-rb-arm ${c}" d="M1.06-3.43l.29.08-.03.64-.2.24-.26-.13.1-.49-.12-.25z"/><ellipse class="wsp-elbow" cx="1.05" cy="-2.53" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M1.12-2.49l-.25-.06-.34.48.02.24.23.09.31-.38z"/><circle class="wsp-skin" cx=".47" cy="-1.71" r=".21"/></g></g>`;
  const torso = `<path class="wsp-pants" d="M-1.12-2.24Q0-2.43 1.12-2.24l-.12.68-.72-.02L0-1.8l-.28.22-1-.02z"/><path class="wsp-pants-shadow" d="M.08-2.31q.58-.03 1.04.07L1-1.56l-.72-.02L0-1.8z"/><path class="wsp-pants-panel" d="M-.83-2.12l.32.02-.04.47-.36-.02zM.51-2.1l.32-.02.08.47-.36.02z"/><path class="wsp-jersey ${c}" d="M-1.13-3.72Q0-3.92 1.13-3.72l.31.62-.33.9-.16.08H-.95l-.16-.08-.33-.9z"/><path class="wsp-fabric-shadow" d="M.18-3.75q.5-.06.93.03l.31.62-.33.86-.16.08H.28z"/><path class="wsp-shoulder ${c}" d="M-1.58-3.36q.13-.47.55-.65l.72-.22h.62l.72.22q.42.18.55.65l-.24.48-1-.24h-.68l-1 .24z"/><path class="wsp-pad-seam" d="M-.95-3.84q.22.44.16.82M.95-3.84q-.22.44-.16.82"/><path class="wsp-sleeve-trim ${hl}" d="M-1.52-3.32l.5-.18.15.31-.53.2zM1.52-3.32l-.5-.18-.15.31.53.2z"/><path class="wsp-band ${hl}" d="M-1.16-2.74h2.32l-.14.38h-2.04z"/><path class="wsp-belt" d="M-1.04-2.24H1.04v.2h-2.08z"/><rect class="wsp-buckle" x="-.16" y="-2.28" width=".32" height=".28" rx=".05"/><rect class="wsp-neck" x="-.34" y="-4.02" width=".68" height=".42" rx=".17"/>`;
  const rbTorso = `<path class="wsp-pants" d="M-.86-2.3Q0-2.42.86-2.3l-.08.68-.57-.02L0-1.84l-.21.2-.65-.02z"/><path class="wsp-pants-shadow" d="M.08-2.36q.42-.02.78.06l-.08.68-.57-.02L0-1.84z"/><path class="wsp-pants-panel" d="M-.62-2.18l.22.02-.02.48-.25-.02zM.4-2.16l.22-.02.05.48-.25.02z"/><path class="wsp-jersey ${c}" d="M-1.04-3.76Q0-3.94 1.04-3.76l.23.55-.2.58-.22.28-.1.12H-.75l-.1-.12-.22-.28-.2-.58z"/><path class="wsp-fabric-shadow" d="M.14-3.8q.45-.04.9.04l.23.55-.2.56-.22.28-.1.1H.22z"/><path class="wsp-shoulder ${c}" d="M-1.36-3.4q.11-.42.48-.59l.64-.19h.48l.64.19q.37.17.48.59l-.2.39-.86-.2h-.6l-.86.2z"/><path class="wsp-pad-seam" d="M-.82-3.84q.18.38.13.72M.82-3.84q-.18.38-.13.72"/><path class="wsp-waist-seam" d="M-.75-2.35Q0-2.24.75-2.35"/><path class="wsp-sleeve-trim ${hl}" d="M-1.3-3.36l.42-.15.12.27-.44.17zM1.3-3.36l-.42-.15-.12.27.44.17z"/><path class="wsp-band ${hl}" d="M-.92-2.72h1.84l-.1.31H-.82z"/><path class="wsp-belt" d="M-.78-2.3H.78v.17H-.78z"/><rect class="wsp-buckle" x="-.12" y="-2.33" width=".24" height=".23" rx=".04"/><rect class="wsp-neck" x="-.28" y="-4.03" width=".56" height=".39" rx=".15"/>`;
  const torsoArt = taperedBody ? rbTorso : torso;
  const dome = `<path class="wsp-helmet ${hl}" d="M-.88-3.82l-.06-.43q.06-.67.45-.98Q0-5.55.49-5.23q.39.31.45.98l-.06.43-.36.31H-.52z"/><path class="wsp-helmet-shadow" d="M.13-5.43q.65.16.79 1.11l-.06.45-.34.3H.18z"/><path class="wsp-helmet-hi" d="M-.55-5.03q.28-.32.65-.31l-.17.25q-.29.05-.48.28z"/>`;
  const rbDome = `<path class="wsp-helmet ${hl}" d="M-.68-3.91l-.04-.32q.04-.59.35-.88Q0-5.39.37-5.11q.31.29.35.88l-.04.32-.27.24h-.82z"/><path class="wsp-helmet-shadow" d="M.11-5.29q.47.14.59 1.01l-.04.33-.25.23H.16z"/><path class="wsp-helmet-hi" d="M-.42-4.93q.22-.27.51-.27l-.13.21q-.23.04-.38.22z"/><path class="wsp-shell-ridge" d="M-.5-4.62Q0-4.85.5-4.62"/>`;
  const helmetDome = rbDome;
  const frontMaskExtra = cageMask
    ? `<path class="wsp-facemask wsp-modern-mask wsp-cage-mask" d="M-.48-4.03h.96M-.37-3.84h.74M-.48-4.03l.11.19M.48-4.03l-.11.19"/>`
    : "";
  const frontHelmet = `<g class="wsp-head">${helmetDome}<path class="wsp-stripe-line" d="M0-5.2v.62"/><path class="wsp-face-opening" d="M-.49-4.42q.49-.17.98 0l-.07.47q-.42.22-.84 0z"/><circle class="wsp-earhole" cx=".52" cy="-4.08" r=".11"/><path class="wsp-visor" d="M-.5-4.4q.5-.17 1 0l-.09.25q-.41.13-.82 0z"/><path class="wsp-facemask wsp-modern-mask" d="M-.53-4.14h1.06M-.42-3.93h.84M-.35-4.15v.29M.35-4.15v.29"/>${frontMaskExtra}<path class="wsp-chinstrap" d="M-.34-3.88q.34.27.68 0"/></g>`;
  const backHelmet = `<g class="wsp-head">${helmetDome}<path class="wsp-stripe-line" d="M0-5.22v1.5"/><path class="wsp-neck-pad" d="M-.48-3.7q.48.25.96 0v.28H-.48z"/></g>`;
  const poses = rbRunPose + rbCarryPose + rbBlockPose + rbCatchPose + (a.qb ? referenceThrowPose : "") + (off ? rbStiffPose : referenceTacklePose) + rbIdlePose + frontSetPose;
  const vf = `<g class="wsp-vf"><g class="wsp-fA">${frontLegsA}</g><g class="wsp-fB">${frontLegsB}</g><g class="wsp-torso">${torsoArt}</g>${poses}${num}${frontHelmet}</g>`;
  const vb = `<g class="wsp-vb"><g class="wsp-fA">${frontLegsA}</g><g class="wsp-fB">${frontLegsB}</g><g class="wsp-torso">${torsoArt}</g>${poses}${num}${backHelmet}</g>`;

  /* ── side profile (authored facing east; mirrored for west) ───────── */
  // Tier-3 skeleton: each leg is a kinematic chain — thigh (origin at the
  // hip, top of its bbox) with a nested shin+foot (origin at the knee).
  // CSS scrubs a 1s gait cycle by --ph (set from the ground odometer), so
  // limbs swing continuously and exactly in step with distance covered.
  // Far-side limbs render first (behind the torso) and carry wsp-sd-far
  // for a slight shade so depth reads.
  const sLeg = (side) => `<g class="wsp-sd-thigh wsp-reference-leg-chain wsp-sd-thigh-${side}${side === "b" ? " wsp-sd-far" : ""}"><path class="wsp-leg wsp-thigh" d="M-.2-2.3h.4l.11.9-.1.3h-.34l-.12-.88z"/><ellipse class="wsp-knee" cx=".04" cy="-1.08" rx=".2" ry=".16"/><g class="wsp-sd-shin wsp-sd-shin-${side}"><path class="wsp-leg wsp-calf" d="M-.12-1.05h.32l.1.7-.08.23h-.32l-.08-.67z"/><path class="wsp-sock" d="M-.09-.38h.35l.02.23h-.36z"/><path class="wsp-shoe" d="M-.11-.17h.4l.37.17h-.82z"/></g></g>`;
  const sLegs = sLeg("b") + sLeg("f");
  const sTorso = `<path class="wsp-pants" d="M-.44-2.27q.66-.12 1.25.02l-.1.66-1.05-.02z"/><path class="wsp-pants-shadow" d="M.2-2.3q.31-.03.61.05l-.1.66-.5-.01z"/><path class="wsp-pants-panel" d="M-.23-2.18l.22-.01-.02.52-.24-.01z"/><path class="wsp-jersey ${c}" d="M-.63-3.72l1.36-.1.36.58-.18.98-1.18.05-.48-.75z"/><path class="wsp-fabric-shadow" d="M.18-3.78l.53-.04.36.58-.17.95-.5.02z"/><path class="wsp-shoulder ${c}" d="M-.82-3.57q.08-.45.48-.61l.82-.08q.44.11.56.53l-.13.42-1.73.09z"/><path class="wsp-pad-seam" d="M.54-4.09q-.12.38-.02.69"/><path class="wsp-sleeve-trim ${hl}" d="M.7-3.76l.31.12-.1.34-.33-.12z"/><path class="wsp-band ${hl}" d="M-.51-2.6l1.39-.05-.08.34-1.22.05z"/><path class="wsp-belt" d="M-.42-2.28l1.22-.03-.01.19-1.2.03z"/><rect class="wsp-neck" x="-.08" y="-4.04" width=".44" height=".39" rx=".15"/>`;
  const rbSideTorso = `<path class="wsp-pants" d="M-.3-2.32q.48-.09.94 0l-.07.65-.78.01z"/><path class="wsp-pants-shadow" d="M.17-2.35q.24-.02.47.03l-.07.65-.37.01z"/><path class="wsp-pants-panel" d="M-.16-2.22l.16-.01-.01.49-.18.01z"/><path class="wsp-jersey ${c}" d="M-.5-3.76l1.1-.08.28.52-.14.7-.13.25-.88.04-.33-.66z"/><path class="wsp-fabric-shadow" d="M.16-3.81l.42-.03.28.52-.13.68-.13.23-.36.02z"/><path class="wsp-shoulder ${c}" d="M-.66-3.61q.07-.4.38-.55l.66-.07q.36.1.46.47l-.1.36-1.4.08z"/><path class="wsp-pad-seam" d="M.43-4.08q-.1.32-.02.59"/><path class="wsp-waist-seam" d="M-.27-2.42q.41.07.82-.02"/><path class="wsp-sleeve-trim ${hl}" d="M.55-3.78l.25.1-.08.28-.26-.1z"/><path class="wsp-band ${hl}" d="M-.4-2.65l1.1-.04-.06.29-.97.04z"/><path class="wsp-belt" d="M-.28-2.34l.92-.03-.01.16-.9.03z"/><rect class="wsp-neck" x="-.04" y="-4.05" width=".35" height=".36" rx=".13"/>`;
  const sideTorsoArt = taperedBody ? rbSideTorso : sTorso;
  const sHelmet = `<g class="wsp-head"><path class="wsp-helmet ${hl}" d="M-.6-4.06q-.04-.77.43-1.18.43-.35 1-.12.48.24.58.86l-.08.53-.36.3-.91.04z"/><path class="wsp-helmet-shadow" d="M.48-5.36q.68.2.82.86l-.07.49-.34.29-.36.02z"/><path class="wsp-helmet-hi" d="M-.28-5.05q.36-.35.78-.27"/><path class="wsp-stripe-line" d="M-.3-5.23q.63-.33 1.2-.04"/><circle class="wsp-earhole" cx=".45" cy="-4.36" r=".14"/><path class="wsp-face-opening" d="M.69-4.74q.42.14.55.43l-.24.23-.39-.25z"/><path class="wsp-visor" d="M.67-4.73q.38.12.53.38l-.22.18-.38-.23z"/><path class="wsp-facemask" d="M.92-4.42h.63M.88-4.16h.7M1.48-4.52v.48"/><path class="wsp-chinstrap" d="M.5-3.91q.37.17.66-.08"/></g>`;
  const rbSideHelmet = `<g class="wsp-head"><path class="wsp-helmet ${hl}" d="M-.48-4.08q-.03-.67.37-1.03.38-.31.88-.11.42.2.5.74l-.06.44-.31.26-.79.03z"/><path class="wsp-helmet-shadow" d="M.42-5.22q.58.18.7.74l-.06.4-.29.25-.3.02z"/><path class="wsp-helmet-hi" d="M-.2-4.96q.31-.3.67-.23"/><path class="wsp-stripe-line" d="M-.13-5.18q.53-.25 1.01 0"/><circle class="wsp-earhole" cx=".38" cy="-4.37" r=".11"/><path class="wsp-face-opening" d="M.63-4.69q.35.12.47.36l-.2.19-.34-.2z"/><path class="wsp-visor" d="M.62-4.68q.33.1.45.32l-.19.15-.32-.19z"/><path class="wsp-facemask wsp-modern-mask" d="M.82-4.4h.54M.79-4.18h.59M1.3-4.48v.41"/><path class="wsp-chinstrap" d="M.43-3.93q.32.15.56-.07"/></g>`;
  const sideMaskExtra = cageMask
    ? `<path class="wsp-facemask wsp-modern-mask wsp-cage-mask" d="M.82-4.27h.5M.85-4.14h.48M1.26-4.42v.36"/>`
    : "";
  const sideHelmetArt = rbSideHelmet.replace("</g>", `${sideMaskExtra}</g>`);
  const sArm = (side) => `<g class="wsp-sd-uarm wsp-sd-uarm-${side}${side === "b" ? " wsp-sd-far" : ""}"><path class="wsp-arm ${c}" d="M-.08-3.55h.4l.09.67-.1.2h-.36l-.12-.64z"/><ellipse class="wsp-elbow" cx=".17" cy="-2.68" rx=".21" ry=".17"/><g class="wsp-sd-farm wsp-sd-farm-${side}"><path class="wsp-arm ${c}" d="M-.04-2.65h.35l.1.51-.08.19H0l-.1-.48z"/><circle class="wsp-skin" cx=".2" cy="-1.84" r=".23"/></g></g>`;
  const sRunFar = `<g class="wsp-pose-run">${sArm("b")}</g>`;
  const sRun = `<g class="wsp-pose-run">${sArm("f")}</g>`;
  const sCarryArm = `<g class="wsp-limb wsp-sd-carry-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.05-3.43l.32-.04.25.61-.11.24-.28-.02-.18-.51z"/><ellipse class="wsp-elbow" cx=".55" cy="-2.62" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.48-2.59l.23-.13.48.34.03.23-.21.13-.44-.25z"/><circle class="wsp-skin" cx="1.25" cy="-2.16" r=".21"/></g>`;
  const sCarry = `<g class="wsp-pose-carry">${sCarryArm}</g>`;
  const sBlock = `<g class="wsp-pose-block"><g class="wsp-limb wsp-sd-block-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.04-3.42l.3-.08.44.4.02.24-.23.13-.4-.3z"/><ellipse class="wsp-elbow" cx=".82" cy="-2.92" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.76-2.89l.21-.14.5.2.08.21-.17.17-.48-.12z"/><circle class="wsp-skin" cx="1.62" cy="-2.5" r=".22"/></g><g class="wsp-limb wsp-sd-block-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.03-3.15l.31-.05.43.36.02.24-.22.14-.4-.27z"/><ellipse class="wsp-elbow" cx=".8" cy="-2.69" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.74-2.66l.21-.14.48.19.08.21-.17.17-.46-.11z"/><circle class="wsp-skin" cx="1.58" cy="-2.29" r=".22"/></g></g>`;
  const sCatch = `<g class="wsp-pose-catch"><g class="wsp-limb wsp-sd-catch-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.05-3.52l.23-.16.37-.49.25.02.1.22-.32.47-.27.21z"/><ellipse class="wsp-elbow" cx=".84" cy="-4.18" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.78-4.15l.2-.16.51-.2.2.11-.01.23-.48.25-.24.04z"/><circle class="wsp-skin" cx="1.72" cy="-4.37" r=".22"/></g></g>`;
  const sThrow = `<g class="wsp-pose-throw"><g class="wsp-limb wsp-sd-guide-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.04-3.4l.3-.06.43.38v.24l-.23.13-.39-.29z"/><ellipse class="wsp-elbow" cx=".8" cy="-2.9" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.74-2.88l.21-.13.5.19.08.21-.17.17-.48-.11z"/><circle class="wsp-skin" cx="1.6" cy="-2.5" r=".22"/></g><g class="wsp-limb wsp-sd-throw-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.02-3.5l-.25-.16-.22-.54.12-.22.27.04.16.47-.11.24z"/><ellipse class="wsp-elbow" cx="-.43" cy="-4.27" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M-.48-4.31l-.2.17-.27.48.07.23.23.03.34-.43z"/><circle class="wsp-skin" cx="-1.02" cy="-3.3" r=".22"/></g></g>`;
  const sTackle = `<g class="wsp-pose-tackle"><g class="wsp-limb wsp-sd-tkl-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.05-3.3l.29-.09.45.36.02.24-.22.14-.42-.27z"/><ellipse class="wsp-elbow" cx=".82" cy="-2.84" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.76-2.81l.21-.14.5.18.08.21-.17.17-.48-.1z"/><circle class="wsp-skin" cx="1.62" cy="-2.45" r=".22"/></g><g class="wsp-limb wsp-sd-tkl-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.04-3.05l.3-.07.43.34.02.23-.22.14-.4-.25z"/><ellipse class="wsp-elbow" cx=".8" cy="-2.62" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.74-2.59l.21-.14.48.17.08.21-.17.17-.46-.09z"/><circle class="wsp-skin" cx="1.58" cy="-2.24" r=".22"/></g></g>`;
  const sStiff = `<g class="wsp-pose-stiff"><g class="wsp-limb wsp-sd-stiff-arm"><path class="wsp-arm wsp-rb-arm ${c}" d="M.05-3.35l.28-.1.48.28.05.23-.2.16-.45-.19z"/><ellipse class="wsp-elbow" cx=".9" cy="-3.02" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.85-2.99l.2-.16.58.09.11.2-.15.19-.55-.02z"/><circle class="wsp-skin" cx="1.82" cy="-2.73" r=".22"/></g>${sCarryArm}</g>`;
  const sIdle = `<g class="wsp-pose-idle"><g class="wsp-rb-arm-chain"><path class="wsp-arm wsp-rb-arm ${c}" d="M.03-3.45l.31-.02.13.75-.11.25-.28-.04-.06-.62z"/><ellipse class="wsp-elbow" cx=".3" cy="-2.48" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.23-2.45l.25-.04.1.68-.1.4-.26-.02-.03-.57z"/><circle class="wsp-skin" cx=".47" cy="-1.34" r=".21"/></g></g>`;
  const sideSetPose = profile === "line"
    ? `<g class="wsp-pose-set wsp-set-${setStyle}"><g class="wsp-limb wsp-set-side-far"><path class="wsp-arm wsp-rb-arm ${c}" d="M.02-3.42l.3-.07.38.43-.02.24-.24.1-.34-.34z"/><ellipse class="wsp-elbow" cx=".73" cy="-2.89" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.68-2.85l.22-.12.35.55-.04.24-.23.08-.28-.46z"/><circle class="wsp-skin" cx="1.2" cy="-1.94" r=".21"/></g><g class="wsp-limb wsp-set-side-near"><path class="wsp-arm wsp-rb-arm ${c}" d="M.03-3.23l.31-.05.29.53-.06.24-.25.05-.24-.44z"/><ellipse class="wsp-elbow" cx=".6" cy="-2.55" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.55-2.51l.23-.1.22.82-.09.23-.24.02-.16-.69z"/><circle class="wsp-skin" cx=".86" cy="-1.34" r=".22"/></g></g>`
    : profile === "quarterback"
      ? `<g class="wsp-pose-set wsp-set-quarterback"><g class="wsp-limb wsp-set-side-far"><path class="wsp-arm wsp-rb-arm ${c}" d="M.03-3.43l.29-.08.36.44-.03.24-.23.1-.33-.35z"/><ellipse class="wsp-elbow" cx=".7" cy="-2.89" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.65-2.86l.22-.12.38.3.03.22-.2.13-.35-.21z"/><circle class="wsp-skin" cx="1.28" cy="-2.38" r=".21"/></g><g class="wsp-limb wsp-set-side-near"><path class="wsp-arm wsp-rb-arm ${c}" d="M.02-3.26l.3-.06.4.39-.02.24-.23.11-.36-.3z"/><ellipse class="wsp-elbow" cx=".73" cy="-2.77" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.68-2.74l.22-.12.36.27.03.22-.2.13-.34-.18z"/><circle class="wsp-skin" cx="1.28" cy="-2.31" r=".21"/></g></g>`
      : `<g class="wsp-pose-set wsp-set-ready"><g class="wsp-limb wsp-set-side-near"><path class="wsp-arm wsp-rb-arm ${c}" d="M.02-3.42l.3-.05.19.65-.1.23-.27-.02-.12-.54z"/><ellipse class="wsp-elbow" cx=".43" cy="-2.59" rx=".15" ry=".12"/><path class="wsp-arm wsp-rb-arm ${c}" d="M.38-2.55l.23-.11.38.42.01.23-.22.11-.34-.33z"/><circle class="wsp-skin" cx="1.04" cy="-1.89" r=".21"/></g></g>`;
  const sPoses = sRun + sCarry + sBlock + sCatch + (a.qb ? sThrow : "") + (off ? sStiff : sTackle) + sIdle + sideSetPose;
  const vs = `<g class="wsp-vs"><g class="wsp-sd-legs">${sLegs}</g>${sRunFar}<g class="wsp-torso">${sideTorsoArt}</g>${sideNum}${sPoses}${sideHelmetArt}</g>`;

  const flip = `<g class="wsp-flip"${face === "w" ? ' transform="scale(-1,1)"' : ""}>${vf}${vb}${vs}</g>`;
  const body = `<ellipse class="wsp-shadow" cx="0" cy="-.12" rx="1.38" ry=".3"/><g class="wsp-shell">${flip}</g>`;
  const bodyExpr = a.body || { kind: "legacy", scaleX: 1, scaleY: 1, stride: 0.85, leanScale: 1 };
  const bodyKind = ["lean", "balanced", "power", "massive"].includes(bodyExpr.kind) ? bodyExpr.kind : "legacy";
  const bodyX = Number.isFinite(bodyExpr.scaleX) ? bodyExpr.scaleX : 1;
  const bodyY = Number.isFinite(bodyExpr.scaleY) ? bodyExpr.scaleY : 1;
  const stride = Number.isFinite(bodyExpr.stride) ? bodyExpr.stride : 0.85;
  const leanScale = Number.isFinite(bodyExpr.leanScale) ? bodyExpr.leanScale : 1;
  const tag = `<text class="${off ? "wo-lbl" : "wd-lbl"} wsp-tag" x="0" y="${off ? "2.1" : "-7.35"}">${escapeHtml(String(a.label ?? ""))}</text>`;
  // NOTE: --wsp-lean must NOT be declared inline here — an element's own inline
  // custom property beats the inherited value, and spriteMotionTick sets the lean
  // on the .wp-actor ancestor. (An inline 0deg here kept every sprite bolt upright.)
  return `<g class="wsp wsp-build-${build} wsp-frame-${bodyKind} wsp-modern-athlete wsp-reference-athlete wsp-uniform-authentic wsp-profile-${profile} wsp-stance-${setStyle}${rbPrototype ? " wsp-prototype-rb" : ""}${a.qb ? " wsp-qb" : ""}${gloveClass}${visorClass}${armSleeveClass}${kneeBraceClass}" data-jersey="${jerseyText}" data-wsp-stride="${stride}" data-wsp-lean-scale="${leanScale}" style="--gait:${gait}s;--wsp-skin:${skin};--wsp-skin-shadow:${skinShadow};--wsp-body-x:${bodyX};--wsp-body-y:${bodyY}"><g class="wsp-athlete"><g class="wsp-identity-body">${body}</g></g></g>${tag}`;
}

function ballMarkup(x, y) {
  return `<g id="wp-ball" class="wa-ballg" transform="translate(${x},${y})"><ellipse class="wab-shadow" cx="0" cy=".48" rx=".78" ry=".2"/><g class="wab-lift"><g class="wab-aim"><g class="wab-spin"><g class="wab-model"><path class="wab-core" d="M-1.7 0Q-1.18-.82 0-.82T1.7 0Q1.18.82 0 .82T-1.7 0Z"/><path class="wab-panel" d="M-1.18-.45Q0-.82 1.18-.45Q.72-.66 0-.66T-1.18-.45Z"/><path class="wab-end" d="M-1.7 0q.24-.4.58-.6l.2.24q-.25.17-.43.36.18.2.43.36l-.2.24q-.34-.2-.58-.6ZM1.7 0q-.24-.4-.58-.6l-.2.24q.25.17.43.36-.18.2-.43.36l.2.24q.34-.2.58-.6Z"/><path class="wab-college-stripe" d="M-1.14-.52q-.18.52 0 1.04M1.14-.52q.18.52 0 1.04"/><path class="wab-seam" d="M-.76-.08Q0-.3.76-.08"/><path class="wab-lace" d="M-.58-.1Q0-.25.58-.1M-.36-.28l.08.35M-.12-.33l.04.36M.12-.33l-.04.36M.36-.28l-.08.35"/><path class="wab-highlight" d="M-.92-.42Q-.3-.68.28-.62"/></g></g></g></g></g>`;
}

// ── per-frame motion state ────────────────────────────────────────────
// Tunables, screen units (1 unit ≈ 0.87 yd downfield): a sprint reads
// ~5.5-7 u/s here.
const WSP_TURN_V = 4.6;    // faster than this away from his combat side = turned and running
const WSP_VERT_V = 1.6;    // min speed to face up/down screen
const WSP_STRIDE = 0.85;   // ground covered per half-step (u)
const WSP_FACES = ["e", "w", "n", "s"];
const WSP_LOCO_CLASSES = ["wsp-loco-still", "wsp-loco-start", "wsp-loco-walk", "wsp-loco-jog", "wsp-loco-sprint", "wsp-loco-brake", "wsp-loco-plant"];
const WSP_ENTER_MOVE_V = 1.35;
const WSP_ENTER_STILL_V = 0.72;

function setLocoClass(node, m, next) {
  if (m.loco === next) return;
  for (const cls of WSP_LOCO_CLASSES) node.classList.remove(cls);
  node.classList.add(`wsp-loco-${next}`);
  m.loco = next;
  if (node.dataset) node.dataset.locomotion = next;
}

function setPlantFoot(node, m, plantB) {
  m.plantB = !!plantB;
  node.classList.toggle("wsp-plant-a", !m.plantB);
  node.classList.toggle("wsp-plant-b", m.plantB);
}

function spriteMotionTick(node, x, y, sampleNow = performance.now()) {
  if (!node) return;
  let m = node._wsm;
  if (!m) {
    const face = WSP_FACES.find((f) => node.classList.contains("wsp-face-" + f)) || "e";
    const puppet = node.querySelector(".wsp");
    const stride = Number.parseFloat(puppet == null ? void 0 : puppet.dataset.wspStride);
    const leanScale = Number.parseFloat(puppet == null ? void 0 : puppet.dataset.wspLeanScale);
    node._wsm = { x, y, t: sampleNow, face, fwd: face, faceCandidate: face, faceAt: sampleNow, odo: 0, step: false, ph: 0, lean: 0, q: 0, vx: 0, vy: 0, accel: 0, rawDirX: 0, rawDirY: 0, movingAt: sampleNow, plantUntil: 0, cut: "", backpedal: false, shuffle: false, plantB: false, loco: "still", flip: node.querySelector(".wsp-flip"), still: true, stride: Number.isFinite(stride) ? Math.max(0.7, Math.min(1.15, stride)) : WSP_STRIDE, leanScale: Number.isFinite(leanScale) ? Math.max(0.65, Math.min(1.2, leanScale)) : 1 };
    node.classList.add("wsp-face-" + face, "wsp-still", "wsp-loco-still", "wsp-plant-a");
    if (node.dataset) node.dataset.locomotion = "still";
    return;
  }
  const now = sampleNow;
  const dt = (now - m.t) / 1e3;
  if (dt <= 0) return;
  m.t = now;
  const idt = Math.min(dt, 0.08);
  const dx = x - m.x, dy = y - m.y;
  m.x = x;
  m.y = y;
  const k = Math.min(1, idt * 9);
  const prevV = Math.hypot(m.vx, m.vy);
  const rawV = Math.hypot(dx, dy) / dt;
  // Instantaneous velocity uses the REAL dt (dx spans all of it); only the
  // smoothing constant k uses the clamped idt. Dividing dx by the clamp made
  // any frame hitch >80ms read as a v spike (dt/0.08×), whipping held facings.
  m.vx += (dx / dt - m.vx) * k;
  m.vy += (dy / dt - m.vy) * k;
  const v = Math.hypot(m.vx, m.vy);
  const instAccel = (v - prevV) / Math.max(0.001, dt);
  m.accel += (instAccel - m.accel) * Math.min(1, idt * 8);
  const wasStill = m.still;
  // Separate enter/exit thresholds stop slow route settles and contact jitter
  // from flashing between idle and run poses on adjacent frames.
  const still = wasStill ? v < WSP_ENTER_MOVE_V : v < WSP_ENTER_STILL_V;
  if (still !== m.still) {
    m.still = still;
    node.classList.toggle("wsp-still", still);
    if (!still) m.movingAt = now;
    else {
      const plantB = m.ph >= 0.25 && m.ph < 0.75;
      setPlantFoot(node, m, plantB);
    }
  }
  let cut = "";
  if (!still && rawV > 1.8) {
    const rdx = dx / Math.max(0.0001, Math.hypot(dx, dy));
    const rdy = dy / Math.max(0.0001, Math.hypot(dx, dy));
    if (m.rawDirX || m.rawDirY) {
      const dot = m.rawDirX * rdx + m.rawDirY * rdy;
      const cross = m.rawDirX * rdy - m.rawDirY * rdx;
      // A meaningful redirect plants for a short authored window. Tiny track
      // corrections remain a normal stride and never create a visual stutter.
      if ((dot < 0.58 || Math.abs(cross) > 0.7) && now >= m.plantUntil) {
        m.plantUntil = now + 165;
        cut = cross >= 0 ? "right" : "left";
        m.cut = cut;
        setPlantFoot(node, m, m.ph >= 0.25 && m.ph < 0.75);
      }
    }
    m.rawDirX = rdx;
    m.rawDirY = rdy;
  }
  if (now >= m.plantUntil) m.cut = "";
  node.classList.toggle("wsp-cut-left", m.cut === "left");
  node.classList.toggle("wsp-cut-right", m.cut === "right");
  if (!still) {
    // Facing. Hold the combat side unless he's truly turned and running.
    const ax = Math.abs(m.vx), ay = Math.abs(m.vy);
    let nf = m.face;
    if (ax >= ay) {
      const f = m.vx > 0 ? "e" : "w";
      nf = f === m.fwd || v > WSP_TURN_V ? f : m.fwd;
    } else if (ay > ax * 1.35 && v > WSP_VERT_V) nf = m.vy > 0 ? "s" : "n";
    // Require a direction to persist briefly before changing the rendered
    // body. This removes one-frame helmet/body flips at route and pursuit bends.
    if (nf !== m.face) {
      if (m.faceCandidate !== nf) {
        m.faceCandidate = nf;
        m.faceAt = now;
      }
      const faceHold = v > 5.5 ? 42 : 82;
      if (now - m.faceAt >= faceHold) {
        node.classList.remove("wsp-face-" + m.face);
        node.classList.add("wsp-face-" + nf);
        m.face = nf;
        if (m.flip) {
          if (nf === "w") m.flip.setAttribute("transform", "scale(-1,1)");
          else m.flip.removeAttribute("transform");
        }
      }
    } else {
      m.faceCandidate = nf;
      m.faceAt = now;
    }
    // Legs: an odometer, not a clock — stride is ground actually covered.
    m.odo += Math.hypot(dx, dy);
    const stride = m.stride || WSP_STRIDE;
    const cycle = stride * 2;
    const step = Math.floor(m.odo / stride) % 2 === 1;
    if (step !== m.step) {
      m.step = step;
      node.classList.toggle("wsp-stepB", step);
    }
    // Skeleton scrub: --ph in [0,1) positions every jointed limb along a
    // paused 1s gait-cycle animation (negative animation-delay trick).
    const ph = Math.round(m.odo % cycle / cycle * 100) / 100;
    if (ph !== m.ph) {
      m.ph = ph;
      node.style.setProperty("--ph", ph);
    }
  }
  // M20 engagement facing: a contact section (block fit, tackle attempt) may
  // lock this sprite's facing toward his opponent. The lock wins over velocity
  // — an engaged blocker giving ground must NOT turn his back on the man —
  // and applies even while still, which velocity-driven facing never touches.
  const lock = node._faceLock;
  if (lock && lock !== m.face && WSP_FACES.includes(lock)) {
    node.classList.remove("wsp-face-" + m.face);
    node.classList.add("wsp-face-" + lock);
    m.face = lock;
    m.faceCandidate = lock;
    m.faceAt = now;
    if (m.flip) {
      if (lock === "w") m.flip.setAttribute("transform", "scale(-1,1)");
      else m.flip.removeAttribute("transform");
    }
  }
  const ax = Math.abs(m.vx), ay = Math.abs(m.vy);
  const travelFace = m.vx >= 0 ? "e" : "w";
  const backpedal = !still && ax >= ay * 0.72 && travelFace !== m.fwd && m.face === m.fwd;
  const shuffle = !still && !backpedal && m.face === m.fwd && ay > ax * 0.72;
  if (backpedal !== m.backpedal) {
    m.backpedal = backpedal;
    node.classList.toggle("wsp-backpedal", backpedal);
  }
  if (shuffle !== m.shuffle) {
    m.shuffle = shuffle;
    node.classList.toggle("wsp-shuffle", shuffle);
  }
  const planting = !still && now < m.plantUntil;
  const movingFor = (now - m.movingAt) / 1e3;
  const loco = still ? "still" : planting ? "plant" : m.accel < -4.8 ? "brake" : movingFor < 0.2 || m.accel > 6.5 && v < 5.2 ? "start" : v >= 5.35 ? "sprint" : v >= 2.65 ? "jog" : "walk";
  setLocoClass(node, m, loco);
  const sq = Math.round(v * 10) / 10;
  const aq = Math.round(Math.max(-16, Math.min(16, m.accel)) * 10) / 10;
  node.style.setProperty("--wsp-speed", sq);
  node.style.setProperty("--wsp-accel", aq);
  // Lean: pitch into the run in profile, lateral shimmy front/back.
  let tgt = still ? 0 : m.face === "e" ? Math.min(11, v * 1.55) : m.face === "w" ? -Math.min(11, v * 1.55) : Math.max(-7, Math.min(7, m.vx * 1.2));
  if (backpedal) tgt *= 0.48;
  if (loco === "brake") tgt *= -0.28;
  if (planting) tgt += m.cut === "right" ? 3.5 : m.cut === "left" ? -3.5 : 0;
  tgt *= m.leanScale || 1;
  m.lean += (tgt - m.lean) * Math.min(1, idt * 10);
  const q = Math.round(m.lean * 2) / 2;
  if (q !== m.q) {
    m.q = q;
    node.style.setProperty("--wsp-lean", q + "deg");
  }
}

function wspPlace(node, x, y) {
  if (!node) return;
  node.setAttribute("transform", `translate(${x.toFixed(2)},${y.toFixed(2)})`);
  spriteMotionTick(node, x, y);
}

export { spriteMarkup, ballMarkup, spriteMotionTick, wspPlace, uniformNumber };
