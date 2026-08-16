import { DEF_DROP_ELIGIBLE, DEF_FIELD_LAYOUTS, OFF_FIELD_LAYOUTS } from '../constants_field.js';
import { FORMATIONS, SLOT_ELIGIBILITY } from '../constants.js';
import { bridgeCoversSlot, sizeFitForSlot } from './traits.js';

// playerById (identity stage 2, optional): id → player OBJECT, so bridge
// traits and size windows can reach the resolver. Callers that don't thread
// it get the pre-identity behaviour unchanged.
function resolveSlots(slots, assignments, activeDepth, ratingById = null, playerPos = null, playerById = null) {
  var _a, _b;
  const bySlot = {};
  const byPos = {};
  const used = /* @__PURE__ */ new Set();
  const allActive = new Set(Object.values(activeDepth).flat());
  const posSlots = {};
  for (const s of slots) (posSlots[_a = s.pos] || (posSlots[_a] = [])).push(s);
  const slotClaimed = slots.some((s) => s.pos === "SLOT" && (assignments == null ? void 0 : assignments[s.id]));
  const hasJoker = !!((_b = activeDepth.SLOT) == null ? void 0 : _b.length) || slotClaimed;
  const namedFb = (activeDepth.FB || []).some((id) => allActive.has(id));
  const rank = (p) => p === "SLOT" ? hasJoker ? -2 : 1 : p === "RB" && namedFb ? -1 : 0;
  const posOrder = Object.keys(posSlots).sort((a, b) => rank(a) - rank(b));
  // Hand-picks are reserved GLOBALLY before any auto-fill (identity Stage 0,
  // Aug 2026). They used to be claimed per position group, so an earlier
  // group's auto-fill could consume a body hand-picked at a later group's
  // slot and silently drop the pin — the offense dodged this only by rank()
  // special-cases (a named joker/FB pulls his group to the front); the Dime's
  // three S slots ahead of the CB group's NB exposed it generally. A pin the
  // old code honoured resolves identically; a pin it dropped now sticks and
  // the auto takes the next man.
  for (const s of slots) {
    const want = assignments == null ? void 0 : assignments[s.id];
    if (!want || used.has(want) || !allActive.has(want)) continue;
    // Defensive job mesh (identity Stage 0): a slot may carry a mesh key
    // (NB / OVERHANG / STACKER / SPACE) that widens who a coach may hand-pick
    // here beyond the slot's native roster position — the resolver accepts
    // exactly what the picker offers (three-places law).
    const eligKey = s.mesh || s.pos;
    if (SLOT_ELIGIBLE_POS[eligKey]) {
      const p = playerPos == null ? void 0 : playerPos(want);
      // Identity stage 2: a bridge trait that covers this job waives the
      // eligibility gate — the picker listed him, the resolver accepts him
      // (three-places law holds because both read the same bridge).
      const bridged = playerById && bridgeCoversSlot(playerById(want), s);
      if (p && !bridged && !SLOT_ELIGIBLE_POS[eligKey].includes(p)) continue;
    }
    bySlot[s.id] = want;
    used.add(want);
  }
  for (const pos of posOrder) {
    const isFbSlot = (s) => s.role === "FB-Lead" || s.label === "FB" || s.label === "B";
    const fbRank = namedFb ? -1 : 1;
    const group = posSlots[pos].slice().sort((a, b) => (isFbSlot(a) ? fbRank : 0) - (isFbSlot(b) ? fbRank : 0));
    let pool = (MESH_AUTO_POOL[pos] ? MESH_AUTO_POOL[pos](activeDepth) : activeDepth[pos] || []).slice();
    if (ratingById && MESH_AUTO_POOL[pos]) {
      const override = activeDepth[pos] || [];
      const oSet = new Set(override);
      const seen = /* @__PURE__ */ new Set();
      pool = pool.filter((id) => seen.has(id) ? false : (seen.add(id), true));
      const head = pool.filter((id) => oSet.has(id));
      const tail = pool.filter((id) => !oSet.has(id)).sort((a, b) => (ratingById[b] || 0) - (ratingById[a] || 0));
      pool = [...head, ...tail];
    }
    byPos[pos] = [];
    let cursor = 0;
    const fbOverride = pos === "RB" && Array.isArray(activeDepth.FB) ? activeDepth.FB : null;
    for (const s of group) {
      if (bySlot[s.id]) {
        byPos[pos].push(bySlot[s.id]);
        continue;
      }
      let pick2 = null;
      if (fbOverride && isFbSlot(s)) {
        pick2 = fbOverride.find((id) => !used.has(id) && allActive.has(id)) || null;
      }
      if (!pick2 && isFbSlot(s)) {
        const fbPool = [...activeDepth.FB || [], ...activeDepth.RB || [], ...activeDepth.TE || []].filter((id, i, arr) => arr.indexOf(id) === i).filter((id) => !used.has(id) && allActive.has(id));
        pick2 = fbPool[0] || null;
      }
      if (!pick2) {
        while (cursor < pool.length && used.has(pool[cursor])) cursor++;
        pick2 = cursor < pool.length ? pool[cursor] : null;
        if (pick2) cursor++;
      }
      // Defensive mesh tail (identity Stage 0): auto-fill stays NATIVE-
      // POSITION-FIRST (the pool above is the slot's own room, so untouched
      // plans and AI defenses resolve as before) — only when the native room
      // runs dry does the job's mesh pool supply a body, ranked by the
      // existing SLOT_ELIGIBILITY-discounted rating. This replaces the
      // anyone-goes emergency fallback with an in-pool body for mesh jobs.
      if (!pick2 && s.mesh && MESH_AUTO_POOL[s.mesh]) {
        const seen2 = /* @__PURE__ */ new Set();
        let tail = MESH_AUTO_POOL[s.mesh](activeDepth).filter((id) => seen2.has(id) ? false : (seen2.add(id), true)).filter((id) => !used.has(id) && allActive.has(id));
        if (playerPos && SLOT_ELIGIBLE_POS[s.mesh]) tail = tail.filter((id) => {
          const p = playerPos(id);
          // bridge holders pass the mesh filter (identity stage 2)
          if (playerById && bridgeCoversSlot(playerById(id), s)) return true;
          return !p || SLOT_ELIGIBLE_POS[s.mesh].includes(p);
        });
        if (ratingById) {
          const multOf = (id) => {
            var _m;
            const pl = playerById == null ? void 0 : playerById(id);
            // bridge covering the job: full rate (waives discount AND window)
            if (pl && bridgeCoversSlot(pl, s)) return 1;
            const p = playerPos == null ? void 0 : playerPos(id);
            const elig = p ? (_m = (SLOT_ELIGIBILITY[s.pos] || {})[p]) != null ? _m : 1 : 1;
            // identity stage 1: the job's size window prices the tail too
            return elig * (pl ? sizeFitForSlot(pl, s) : 1);
          };
          tail.sort((a, b) => (ratingById[b] || 0) * multOf(b) - (ratingById[a] || 0) * multOf(a));
        }
        pick2 = tail[0] || null;
      }
      if (pick2) used.add(pick2);
      bySlot[s.id] = pick2 || null;
      if (pick2) byPos[pos].push(pick2);
    }
  }
  const stillEmpty = slots.filter((s) => !bySlot[s.id]);
  if (stillEmpty.length) {
    const excludeIds = /* @__PURE__ */ new Set([
      ...activeDepth.QB || [],
      ...activeDepth.K || [],
      ...activeDepth.P || []
    ]);
    const avail = Object.values(activeDepth).flat().filter((id) => !used.has(id) && !excludeIds.has(id));
    const uniqueAvail = [...new Set(avail)];
    if (ratingById) uniqueAvail.sort((a, b) => {
      var _a2, _b2;
      return ((_a2 = ratingById[b]) != null ? _a2 : 0) - ((_b2 = ratingById[a]) != null ? _b2 : 0);
    });
    let i = 0;
    for (const s of stillEmpty) {
      while (i < uniqueAvail.length && used.has(uniqueAvail[i])) i++;
      const pick2 = i < uniqueAvail.length ? uniqueAvail[i] : null;
      if (pick2) {
        used.add(pick2);
        i++;
        bySlot[s.id] = pick2;
        byPos[s.pos].push(pick2);
      }
    }
  }
  return { bySlot, byPos };
}
function resolveOffField(formationId, assignments, shares, activeDepth, ratingById = null, playerPos = null, playerById = null) {
  const layout = OFF_FIELD_LAYOUTS[formationId];
  if (!layout) return null;
  const { bySlot, byPos } = resolveSlots(layout.slots, assignments, activeDepth, ratingById, playerPos, playerById);
  const fbSlotIds = new Set(layout.slots.filter((s) => s.role === "FB-Lead").map((s) => s.id));
  const fbFromSlots = [];
  for (const s of layout.slots) {
    if (fbSlotIds.has(s.id) && bySlot[s.id]) fbFromSlots.push(bySlot[s.id]);
  }
  const personnel = {
    OL: byPos.OL || [],
    QB: byPos.QB || [],
    RB: (byPos.RB || []).filter((id) => !fbFromSlots.includes(id)),
    FB: fbFromSlots,
    WR: byPos.WR || [],
    TE: byPos.TE || []
  };
  for (const pid of byPos.SLOT || []) {
    const p = playerPos && playerPos(pid) || "WR";
    (personnel[p] || (personnel[p] = [])).push(pid);
  }
  for (const meshPos of ["ABACK", "WING", "WILDCAT", "JETMAN"]) {
    for (const pid of byPos[meshPos] || []) {
      const p = playerPos && playerPos(pid) || "RB";
      (personnel[p] || (personnel[p] = [])).push(pid);
    }
  }
  const shareByPlayerId = {};
  for (const s of layout.slots) {
    if (!s.catch) continue;
    const pid = bySlot[s.id];
    if (!pid) continue;
    const w = shares == null ? void 0 : shares[s.id];
    if (w != null) shareByPlayerId[pid] = w;
  }
  const roleBySlotPlayer = {};
  for (const s of layout.slots) {
    const pid = bySlot[s.id];
    if (pid && s.role) roleBySlotPlayer[pid] = s.role;
  }
  // PASS 7 (Fix D, job snaps): offense personnel buckets redistribute mesh
  // bodies back to their NATIVE position, so out-of-native fieldings are
  // invisible downstream. Record them here, where the slot layout still
  // knows: pid → the slot key he was actually fielded at (SLOT / WING /
  // WILDCAT / FB / …) whenever it differs from his roster position. The
  // earnable-bridge mapping (stage 4a) decides which keys mean anything.
  const oopByPlayer = {};
  if (playerPos) {
    for (const s of layout.slots) {
      const pid = bySlot[s.id];
      if (!pid) continue;
      const nat = playerPos(pid);
      if (nat && s.pos !== nat) oopByPlayer[pid] = s.pos;
    }
  }
  return { personnel, shareByPlayerId, bySlot, roleBySlotPlayer, oopByPlayer };
}
function resolveDefField(frontId, assignments, blitzShares, activeDepth, ratingById = null, playerPos = null, playerById = null) {
  const layout = DEF_FIELD_LAYOUTS[frontId];
  if (!layout) return null;
  const { bySlot, byPos } = resolveSlots(layout.slots, assignments, activeDepth, ratingById, playerPos, playerById);
  const DE = byPos.DE || [], DT = byPos.DT || [], OLB = byPos.OLB || [], LB = byPos.LB || [], CB = byPos.CB || [], S = byPos.S || [];
  const olbRush = frontId === "3-4" || frontId === "Penny";
  const blitzShareByPlayerId = {};
  const dropShareByPlayerId = {};
  const dropSlots = new Set(DEF_DROP_ELIGIBLE[frontId] || []);
  const bySlotId = {};
  for (const s of layout.slots) bySlotId[s.id] = { playerId: bySlot[s.id], pos: s.pos };
  for (const [slotId, share] of Object.entries(blitzShares || {})) {
    const e = bySlotId[slotId];
    if (!(e == null ? void 0 : e.playerId)) continue;
    if (dropSlots.has(slotId)) dropShareByPlayerId[e.playerId] = share;
    else if (share) blitzShareByPlayerId[e.playerId] = share;
  }
  return {
    personnel: {
      DE,
      DT,
      OLB,
      ILB: LB,
      CB,
      S,
      // LB = coverage backers (historical semantic; see resolveDefPersonnel)
      LB: olbRush ? LB : [...LB, ...OLB],
      DL: olbRush ? [...DE, ...DT, ...OLB] : [...DE, ...DT],
      DB: [...CB, ...S]
    },
    blitzShareByPlayerId,
    dropShareByPlayerId,
    bySlot
  };
}
function ensureFieldAssignments(gp) {
  if (!gp.fieldAssignments) gp.fieldAssignments = { offense: {}, defense: {} };
  const fa = gp.fieldAssignments;
  if (!fa.offense) fa.offense = {};
  if (!fa.defense) fa.defense = {};
  for (const fid of Object.keys(OFF_FIELD_LAYOUTS).filter((_fid) => FORMATIONS[_fid])) {
    const layout = OFF_FIELD_LAYOUTS[fid];
    if (!fa.offense[fid]) fa.offense[fid] = { slots: {}, shares: {} };
    const entry = fa.offense[fid];
    if (!entry.slots) entry.slots = {};
    if (!entry.shares) entry.shares = {};
    const legacy = gp.targetShares || {};
    const defaults = gp.defaultShares || null;
    for (const s of layout.slots) {
      if (!s.catch) continue;
      if (entry.shares[s.id] == null) entry.shares[s.id] = defaultShareFor(s, legacy, defaults);
    }
  }
  for (const fid of Object.keys(DEF_FIELD_LAYOUTS)) {
    if (!fa.defense[fid]) fa.defense[fid] = { slots: {}, blitzShares: {} };
    const defEntry = fa.defense[fid];
    if (!defEntry.slots) defEntry.slots = {};
    if (!defEntry.blitzShares) {
      defEntry.blitzShares = {};
      if (Array.isArray(defEntry.blitzers)) {
        for (const slotId of defEntry.blitzers) defEntry.blitzShares[slotId] = 100;
      }
      delete defEntry.blitzers;
    }
  }
  return fa;
}
function defaultShareFor(slot, legacy, defaults) {
  var _a, _b, _c, _d, _e, _f, _g;
  // A formation slot's default share maps to the RECEIVER default (targetShares,
  // keyed WR1/WR2/WR3/TE1/RB1) — the default follows the man, the per-formation
  // override on the field view is what ties to the position. (`defaults` param
  // retained for call-site compatibility; the slot-label store is no longer used.)
  const byLabel = {
    X: (_a = legacy.WR1) != null ? _a : 24,
    Z: (_b = legacy.WR2) != null ? _b : 20,
    SL: (_c = legacy.WR3) != null ? _c : 16,
    FL: (_d = legacy.WR3) != null ? _d : 14,
    Y: (_e = legacy.TE1) != null ? _e : 18,
    U: 10,
    HB: (_f = legacy.RB1) != null ? _f : 12,
    FB: 4
  };
  return (_g = byLabel[slot.label]) != null ? _g : slot.pos === "WR" ? 16 : slot.pos === "TE" ? 14 : 10;
}
var SLOT_ELIGIBLE_POS, MESH_AUTO_POOL;

SLOT_ELIGIBLE_POS = {
  WR: ["WR"],
  // X and Z: split end / flanker — receivers only
  SLOT: ["WR", "TE", "RB"],
  // the joker: your best inside weapon, whatever he is
  FADE: ["WR", "TE"],
  // the back-shoulder / red-zone jump-ball target — a tall, sure-handed body
  ABACK: ["RB", "WR", "TE"],
  // flexbone wing: any skill body who can motion and block (RB includes fullback types)
  WING: ["RB", "TE"],
  // wishbone halfback: a power body — back (incl. fullback archetype) or TE
  WILDCAT: ["RB", "WR", "QB"],
  // the direct-snap taker — anyone who can catch a snap
  JETMAN: ["WR", "RB"],
  // the jet-motion man — pure speed, either listing
  OL: ["OL", "TE"],
  // a sixth lineman is real; a corner at guard is not
  QB: ["QB"],
  // ── Defensive job mesh (identity Stage 0, Aug 2026) ──────────────────────
  // Keyed by the slot's MESH key (slot.mesh in DEF_FIELD_LAYOUTS), never by a
  // roster position — base 4-3 and 3-4 slots carry no mesh key and stay
  // hard-typed to their positions. Native position first in every list.
  NB: ["CB", "S"],
  // the nickel: a corner's job that a star safety can own (2010 Woodson)
  OVERHANG: ["OLB", "DE", "LB"],
  // JACK / JOKER / CHAR / SPUR / BANDIT / EDGE — stand-up edge bodies
  STACKER: ["LB", "OLB"],
  // stack / inside-backer jobs outside the two base fronts
  SPACE: ["S", "LB", "CB"]
  // WAR / ROVER / Dime DB — the space-safety hybrid jobs
};
MESH_AUTO_POOL = {
  SLOT: (d) => [...d.SLOT || [], ...d.WR || [], ...d.TE || []],
  // FADE meshes WR/TE — a hand-picked jump-ball target floats up, then the rest by fit
  FADE: (d) => [...d.FADE || [], ...d.WR || [], ...d.TE || []],
  // For the exotic mesh spots, a user OVERRIDE (d[pos], seeded from depthOrder[pos])
  // takes precedence — his hand-picked man plays it everywhere — then the rest of the
  // eligible pool falls in behind, de-duped.
  ABACK: (d) => [...d.ABACK || [], ...d.RB || [], ...d.WR || [], ...d.TE || []],
  WING: (d) => [...d.WING || [], ...d.RB || [], ...d.TE || []],
  WILDCAT: (d) => [...d.WILDCAT || [], ...d.RB || [], ...d.WR || []],
  // QBs by hand only — never auto-drafted out wide
  JETMAN: (d) => [...d.JETMAN || [], ...d.RB || [], ...d.WR || []],
  // ── Defensive job mesh (identity Stage 0) ────────────────────────────────
  // Consulted ONLY as the auto-fill TAIL for mesh-keyed defensive slots (the
  // native room is always drained first via the slot's own pos pool), so
  // untouched plans and AI defenses resolve near-identically.
  NB: (d) => [...d.CB || [], ...d.S || []],
  OVERHANG: (d) => [...d.OLB || [], ...d.DE || [], ...d.LB || []],
  STACKER: (d) => [...d.LB || [], ...d.OLB || []],
  SPACE: (d) => [...d.S || [], ...d.LB || [], ...d.CB || []]
};

export { defaultShareFor, ensureFieldAssignments, resolveDefField, resolveOffField };

// additional exports consumed by tools/ probes and the depth-chart picker —
// the picker, the resolver and the probe all read the SAME eligibility table
// (three-places law).
export { resolveSlots, SLOT_ELIGIBLE_POS, MESH_AUTO_POOL };
