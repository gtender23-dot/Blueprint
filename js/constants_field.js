var OL_SLOTS, OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS, DEF_BLITZ_ELIGIBLE, DEF_DROP_ELIGIBLE;

OL_SLOTS = [
  { id: "OL_LT", pos: "OL", label: "LT", x: 0.3, y: 0.5, role: "OL-T" },
  { id: "OL_LG", pos: "OL", label: "LG", x: 0.4, y: 0.5, role: "OL-IOL" },
  { id: "OL_C", pos: "OL", label: "C", x: 0.5, y: 0.5, role: "OL-C" },
  { id: "OL_RG", pos: "OL", label: "RG", x: 0.6, y: 0.5, role: "OL-IOL" },
  { id: "OL_RT", pos: "OL", label: "RT", x: 0.7, y: 0.5, role: "OL-T" }
];
OFF_FIELD_LAYOUTS = {
  "Pro Set": {
    // 2 RB, 1 TE, 2 WR
    // Alignment note (Jul 2026): y 0.50 IS the line of scrimmage (the OL row).
    // Receivers used to float at y<0.50 — the defense's side, i.e. offsides.
    // Split ends (X) and inline TEs sit ON the line; flankers/slots sit just
    // BEHIND it (y>0.50) — 7 on the line, everywhere.
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.08, y: 0.5, role: "WR-Deep", catch: true },
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.79, y: 0.5, role: "TE-Receiving", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.92, y: 0.56, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.62 },
      { id: "RB_F", pos: "RB", label: "FB", x: 0.5, y: 0.74, role: "RB-Power", catch: true },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.5, y: 0.87, role: "RB-Power", catch: true }
    ]
  },
  "Power-I": {
    // 1 RB, 1 FB, 2 TE, 1 WR
    slots: [
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.22, y: 0.5, role: "TE-Blocking", catch: true },
      ...OL_SLOTS,
      { id: "TE_U", pos: "TE", label: "U", x: 0.79, y: 0.5, role: "TE-Receiving", catch: true },
      { id: "WR_X", pos: "WR", label: "X", x: 0.92, y: 0.56, role: "WR-Poss", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.64 },
      { id: "FB", pos: "RB", label: "FB", x: 0.5, y: 0.77, role: "FB-Lead", catch: true },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.5, y: 0.9, role: "RB-Power", catch: true }
    ]
  },
  "Jumbo": {
    // 1 RB, 1 FB, 3 TE, 0 WR — goal-line/short-yardage heavy (Aug 2026).
    // Y and U are inline (on the line); W is the wing just off U's hip.
    slots: [
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.22, y: 0.5, role: "TE-Blocking", catch: true },
      ...OL_SLOTS,
      { id: "TE_U", pos: "TE", label: "U", x: 0.78, y: 0.5, role: "TE-Blocking", catch: true },
      { id: "TE_W", pos: "TE", label: "W", x: 0.86, y: 0.56, role: "TE-Receiving", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.62 },
      { id: "FB", pos: "RB", label: "FB", x: 0.5, y: 0.74, role: "FB-Lead", catch: true },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.5, y: 0.87, role: "RB-Power", catch: true }
    ]
  },
  "Spread": {
    // 1 RB, 1 TE, 3 WR
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.06, y: 0.5, role: "WR-Deep", catch: true },
      { id: "WR_S", pos: "SLOT", label: "SL", x: 0.2, y: 0.56, role: "WR-Slot", catch: true },
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.79, y: 0.5, role: "TE-Receiving", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.94, y: 0.56, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.7 },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.62, y: 0.72, role: "RB-Scat", catch: true }
    ]
  },
  "Air Raid": {
    // 1 RB, 0 TE, 4 WR
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.05, y: 0.5, role: "WR-Deep", catch: true },
      { id: "WR_S", pos: "SLOT", label: "SL", x: 0.2, y: 0.56, role: "WR-Slot", catch: true },
      ...OL_SLOTS,
      { id: "WR_F", pos: "SLOT", label: "FL", x: 0.8, y: 0.56, role: "WR-Slot", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.95, y: 0.5, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.7 },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.62, y: 0.72, role: "RB-Scat", catch: true }
    ]
  },
  "Pistol/RPO": {
    // 1 RB, 1 TE, 3 WR
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.06, y: 0.5, role: "WR-Deep", catch: true },
      { id: "WR_S", pos: "SLOT", label: "SL", x: 0.2, y: 0.56, role: "WR-Slot", catch: true },
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.79, y: 0.5, role: "TE-Receiving", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.94, y: 0.56, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.68 },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.5, y: 0.82, role: "RB-Scat", catch: true }
    ]
  },
  "Trips/Bunch": {
    // 1 RB, 1 TE, 3 WR (trips to one side)
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.05, y: 0.5, role: "WR-Poss", catch: true },
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.8, y: 0.5, role: "TE-Receiving", catch: true },
      { id: "WR_S", pos: "SLOT", label: "SL", x: 0.88, y: 0.56, role: "WR-Slot", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.96, y: 0.62, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.7 },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.4, y: 0.72, role: "RB-Scat", catch: true }
    ]
  },
  // ── Expansion five (Jul 2026) ───────────────────────────────────────────
  "Single Back": {
    // 1 RB, 2 TE, 2 WR (Ace)
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.06, y: 0.5, role: "WR-Deep", catch: true },
      { id: "TE_U", pos: "TE", label: "U", x: 0.22, y: 0.56, role: "TE-Blocking", catch: true },
      // wing, off the line
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.79, y: 0.5, role: "TE-Receiving", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.93, y: 0.56, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.64 },
      { id: "RB_H", pos: "RB", label: "HB", x: 0.5, y: 0.82, role: "RB-Power", catch: true }
    ]
  },
  "Empty": {
    // 0 backs, 1 TE, 4 WR — trips left, TE + Z right
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.05, y: 0.5, role: "WR-Deep", catch: true },
      { id: "WR_S", pos: "SLOT", label: "SL", x: 0.17, y: 0.56, role: "WR-Slot", catch: true },
      { id: "WR_F", pos: "SLOT", label: "FL", x: 0.28, y: 0.56, role: "WR-Slot", catch: true },
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.79, y: 0.5, role: "TE-Receiving", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.94, y: 0.56, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.7 }
    ]
  },
  "Wishbone": {
    // 2 wing HBs (WING mesh: RB/FB), 1 FB, 1 TE, 1 WR — the full house
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.08, y: 0.5, role: "WR-Deep", catch: true },
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.79, y: 0.5, role: "TE-Blocking", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.6 },
      { id: "FB", pos: "RB", label: "FB", x: 0.5, y: 0.72, role: "FB-Lead", catch: true },
      // WING is a mesh position (RB/FB eligible), SLOT-style — the pitch men.
      { id: "RB_H", pos: "WING", label: "LH", x: 0.38, y: 0.84, role: "RB-Power", catch: true },
      { id: "RB_2", pos: "WING", label: "RH", x: 0.62, y: 0.84, role: "RB-Power", catch: true }
    ]
  },
  "Flexbone": {
    // 2 A-backs on the wings (ABACK mesh: RB/WR), B-back deep, 2 WR split
    slots: [
      { id: "WR_X", pos: "WR", label: "X", x: 0.06, y: 0.5, role: "WR-Deep", catch: true },
      // ABACK is a mesh position (RB/WR eligible), SLOT-style — your space
      // players play the wings regardless of listed position.
      { id: "RB_H", pos: "ABACK", label: "A", x: 0.24, y: 0.58, role: "RB-Scat", catch: true },
      ...OL_SLOTS,
      { id: "RB_2", pos: "ABACK", label: "A", x: 0.76, y: 0.58, role: "RB-Scat", catch: true },
      { id: "WR_Z", pos: "WR", label: "Z", x: 0.94, y: 0.5, role: "WR-Deep", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.5, y: 0.6 },
      { id: "FB", pos: "RB", label: "B", x: 0.5, y: 0.74, role: "FB-Lead", catch: true }
    ]
  },
  "Wildcat": {
    // 2 RB, 1 FB, 2 TE — direct snap; the QB is split wide as a decoy
    slots: [
      { id: "TE_U", pos: "TE", label: "U", x: 0.22, y: 0.5, role: "TE-Blocking", catch: true },
      ...OL_SLOTS,
      { id: "TE_Y", pos: "TE", label: "Y", x: 0.79, y: 0.5, role: "TE-Blocking", catch: true },
      { id: "QB", pos: "QB", label: "QB", x: 0.94, y: 0.56 },
      // split wide — decoy
      // WILDCAT is a mesh position (RB/WR/QB) — whoever you trust to catch a
      // snap. JETMAN meshes WR/RB — the full-speed motion man.
      { id: "RB_H", pos: "WILDCAT", label: "WC", x: 0.5, y: 0.7, role: "RB-Power", catch: true },
      { id: "RB_2", pos: "JETMAN", label: "JET", x: 0.34, y: 0.62, role: "RB-Scat", catch: true },
      { id: "FB", pos: "RB", label: "FB", x: 0.6, y: 0.76, role: "FB-Lead", catch: true }
    ]
  }
};
DEF_FIELD_LAYOUTS = {
  "4-3": {
    // 2 DE, 2 DT, 2 OLB (SAM/WILL), 1 LB (MIKE), 2 CB, 2 S
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.38, y: 0.06, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.62, y: 0.1, role: "S-Strong" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "OLB_W", pos: "OLB", label: "WILL", x: 0.28, y: 0.42, role: "OLB-Cover" },
      { id: "LB_M", pos: "LB", label: "MIKE", x: 0.5, y: 0.42, role: "LB-Thumper" },
      { id: "OLB_S", pos: "OLB", label: "SAM", x: 0.72, y: 0.42, role: "OLB-Blitz" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.22, y: 0.72, role: "DE-Speed" },
      { id: "DT_1", pos: "DT", label: "DT", x: 0.42, y: 0.74, role: "DT-3tech" },
      { id: "DT_2", pos: "DT", label: "DT", x: 0.58, y: 0.74, role: "DT-NT" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.78, y: 0.72, role: "DE-Power" }
    ]
  },
  "3-4": {
    // 2 DE (5-techs), 1 DT (NT), 2 OLB (edge rushers), 2 LB (ILB), 2 CB, 2 S
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.38, y: 0.06, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.62, y: 0.1, role: "S-Strong" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "OLB_L", pos: "OLB", label: "LOLB", x: 0.16, y: 0.52, role: "OLB-Rush" },
      { id: "LB_I1", pos: "LB", label: "ILB", x: 0.4, y: 0.44, role: "LB-Thumper" },
      { id: "LB_I2", pos: "LB", label: "ILB", x: 0.6, y: 0.44, role: "LB-Cover" },
      { id: "OLB_R", pos: "OLB", label: "ROLB", x: 0.84, y: 0.52, role: "OLB-Rush" },
      // #31: end labels are side-explicit (LE/RE) on EVERY front — the 4-3
      // family already was; the odd fronts said "DE"/"4i" and the Defensive
      // Playbook diagrams read inconsistent card to card.
      { id: "DE_L", pos: "DE", label: "LE", x: 0.34, y: 0.74, role: "DE-Power" },
      { id: "DT_N", pos: "DT", label: "NT", x: 0.5, y: 0.76, role: "DT-NT" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.66, y: 0.74, role: "DE-Power" }
    ]
  },
  // ── Sub packages + heavy fronts (Aug 2026, realistic-fronts wave) ─────────
  // Before this, only the two base fronts had layouts — every recorded Nickel,
  // Dime or 46 snap DREW as a 4-3 (watch-mode fallback) and a sub package
  // could never be inspected on the depth chart. Each front now lines up as
  // itself. Alignments follow the techniques: x positions put the 5-2's nose
  // at 0-tech, its tackles at 3-tech, its ends at 5-tech; the 46 walks the SS
  // down into an 8-man box with the FS as the lone deep centerfielder; the
  // nickelback (NB) apexes the slot to the passing strength.
  "Nickel": {
    // 4-2-5: 4 DL, 2 LB, 5 DB — the NB is his own job, not a 3rd corner
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.36, y: 0.06, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.64, y: 0.1, role: "S-Strong" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "NB", pos: "CB", label: "NB", x: 0.76, y: 0.28, role: "CB-Nickel", mesh: "NB" },
      { id: "OLB_W", pos: "OLB", label: "WILL", x: 0.38, y: 0.44, role: "OLB-Cover", mesh: "STACKER" },
      { id: "LB_M", pos: "LB", label: "MIKE", x: 0.56, y: 0.44, role: "LB-Cover", mesh: "STACKER" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.22, y: 0.72, role: "DE-Speed" },
      { id: "DT_1", pos: "DT", label: "DT", x: 0.42, y: 0.74, role: "DT-3tech" },
      { id: "DT_2", pos: "DT", label: "DT", x: 0.58, y: 0.74, role: "DT-Quick" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.78, y: 0.72, role: "DE-Power" }
    ]
  },
  "Dime": {
    // 4-1-6: one backer, six DBs, speed ends pinned back to rush
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.3, y: 0.05, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.7, y: 0.05, role: "S-Strong" },
      { id: "S_D", pos: "S", label: "DB", x: 0.5, y: 0.12, role: "S-Ball", mesh: "SPACE" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "NB", pos: "CB", label: "NB", x: 0.74, y: 0.28, role: "CB-Nickel", mesh: "NB" },
      { id: "LB_M", pos: "LB", label: "MIKE", x: 0.5, y: 0.44, role: "LB-Cover", mesh: "STACKER" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.22, y: 0.72, role: "DE-Speed" },
      { id: "DT_1", pos: "DT", label: "DT", x: 0.42, y: 0.74, role: "DT-Quick" },
      { id: "DT_2", pos: "DT", label: "DT", x: 0.58, y: 0.74, role: "DT-Quick" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.78, y: 0.72, role: "DE-Speed" }
    ]
  },
  "46/Bear": {
    // Buddy Ryan's 46: 8-man box, SS walked down, FS lone deep
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.4, y: 0.05, role: "S-Free" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.22, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.22, role: "CB-Press" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.7, y: 0.38, role: "S-Strong" },
      { id: "OLB_J", pos: "OLB", label: "JACK", x: 0.16, y: 0.5, role: "OLB-Blitz", mesh: "OVERHANG" },
      { id: "LB_M", pos: "LB", label: "MIKE", x: 0.46, y: 0.42, role: "LB-Thumper", mesh: "STACKER" },
      { id: "OLB_C", pos: "OLB", label: "CHAR", x: 0.84, y: 0.55, role: "OLB-Blitz", mesh: "OVERHANG" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.3, y: 0.73, role: "DE-Power" },
      { id: "DT_N", pos: "DT", label: "NT", x: 0.5, y: 0.75, role: "DT-NT" },
      { id: "DT_3", pos: "DT", label: "DT", x: 0.6, y: 0.74, role: "DT-3tech" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.72, y: 0.73, role: "DE-Power" }
    ]
  },
  "5-2": {
    // true five-man line: 5-tech DEs, 3-tech DTs, 0-tech NT, two ILBs
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.38, y: 0.06, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.62, y: 0.1, role: "S-Strong" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "LB_I1", pos: "LB", label: "ILB", x: 0.42, y: 0.46, role: "LB-Thumper", mesh: "STACKER" },
      { id: "LB_I2", pos: "LB", label: "ILB", x: 0.58, y: 0.46, role: "LB-Hybrid", mesh: "STACKER" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.24, y: 0.72, role: "DE-Power" },
      { id: "DT_L", pos: "DT", label: "DT", x: 0.4, y: 0.74, role: "DT-3tech" },
      { id: "DT_N", pos: "DT", label: "NT", x: 0.5, y: 0.755, role: "DT-NT" },
      { id: "DT_R", pos: "DT", label: "DT", x: 0.6, y: 0.74, role: "DT-3tech" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.76, y: 0.72, role: "DE-Power" }
    ]
  }
,
  "3-3-5": {
    // The odd stack (Aug 2026): NT at 0-tech, 4i ends over the B-gaps, the
    // three backers STACKED directly behind the three down bodies (that
    // mirroring is the disguise), corners outside, two high safeties and the
    // hybrid third safety (the Warrior) floating over the passing strength.
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.36, y: 0.05, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.64, y: 0.05, role: "S-Strong" },
      { id: "S_W", pos: "S", label: "WAR", x: 0.74, y: 0.26, role: "S-Hybrid", mesh: "SPACE" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "OLB_L", pos: "OLB", label: "STK", x: 0.32, y: 0.46, role: "OLB-Cover", mesh: "STACKER" },
      { id: "LB_M", pos: "LB", label: "MIKE", x: 0.5, y: 0.48, role: "LB-Thumper", mesh: "STACKER" },
      { id: "OLB_R", pos: "OLB", label: "STK", x: 0.68, y: 0.46, role: "OLB-Blitz", mesh: "STACKER" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.34, y: 0.73, role: "DE-Power" },
      { id: "DT_N", pos: "DT", label: "NT", x: 0.5, y: 0.755, role: "DT-NT" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.66, y: 0.73, role: "DE-Power" }
    ]
  }
,
  "Tite": {
    // 4i-0-4i: ends pinch the B-gaps, JACK/JOKER overhangs hold the edges in
    // space, twin ILBs run free behind a closed front.
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.36, y: 0.05, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.64, y: 0.08, role: "S-Strong" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "OLB_J", pos: "OLB", label: "JOKER", x: 0.16, y: 0.45, role: "OLB-Cover", mesh: "OVERHANG" },
      { id: "LB_I1", pos: "LB", label: "MIKE", x: 0.42, y: 0.46, role: "LB-Thumper", mesh: "STACKER" },
      { id: "LB_I2", pos: "LB", label: "WILL", x: 0.58, y: 0.46, role: "LB-Cover", mesh: "STACKER" },
      { id: "OLB_K", pos: "OLB", label: "JACK", x: 0.84, y: 0.45, role: "OLB-Blitz", mesh: "OVERHANG" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.4, y: 0.73, role: "DE-Power" },
      { id: "DT_N", pos: "DT", label: "NT", x: 0.5, y: 0.755, role: "DT-NT" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.6, y: 0.73, role: "DE-Power" }
    ]
  },
  "4-4": {
    // The eight-man front: SPUR/BANDIT walked up outside, twin ILBs stacked,
    // one lone centerfielder living dangerously.
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.5, y: 0.06, role: "S-Free" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.22, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.22, role: "CB-Press" },
      { id: "OLB_S", pos: "OLB", label: "SPUR", x: 0.2, y: 0.48, role: "OLB-Blitz", mesh: "OVERHANG" },
      { id: "LB_I1", pos: "LB", label: "MIKE", x: 0.42, y: 0.45, role: "LB-Thumper", mesh: "STACKER" },
      { id: "LB_I2", pos: "LB", label: "WILL", x: 0.58, y: 0.45, role: "LB-Hybrid", mesh: "STACKER" },
      { id: "OLB_B", pos: "OLB", label: "BNDT", x: 0.8, y: 0.48, role: "OLB-Cover", mesh: "OVERHANG" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.24, y: 0.72, role: "DE-Speed" },
      { id: "DT_1", pos: "DT", label: "DT", x: 0.42, y: 0.74, role: "DT-3tech" },
      { id: "DT_2", pos: "DT", label: "NT", x: 0.58, y: 0.74, role: "DT-NT" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.76, y: 0.72, role: "DE-Power" }
    ]
  },
  "Big Nickel": {
    // 4-2-5 with a ROVER: the third safety walks down over the slot/TE and
    // tackles like a backer — the 12-personnel answer.
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.34, y: 0.05, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.66, y: 0.07, role: "S-Strong" },
      { id: "S_R", pos: "S", label: "ROV", x: 0.74, y: 0.28, role: "S-Hybrid", mesh: "SPACE" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "OLB_W", pos: "OLB", label: "WILL", x: 0.38, y: 0.44, role: "OLB-Cover", mesh: "STACKER" },
      { id: "LB_M", pos: "LB", label: "MIKE", x: 0.56, y: 0.44, role: "LB-Cover", mesh: "STACKER" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.22, y: 0.72, role: "DE-Speed" },
      { id: "DT_1", pos: "DT", label: "DT", x: 0.42, y: 0.74, role: "DT-3tech" },
      { id: "DT_2", pos: "DT", label: "DT", x: 0.58, y: 0.74, role: "DT-Quick" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.78, y: 0.72, role: "DE-Power" }
    ]
  },
  "Penny": {
    // The 5-1 light box: stand-up EDGEs flank the three down bodies (five on
    // the LOS), one MIKE behind, nickel shell over the top.
    slots: [
      { id: "S_FS", pos: "S", label: "FS", x: 0.36, y: 0.06, role: "S-Free" },
      { id: "S_SS", pos: "S", label: "SS", x: 0.64, y: 0.08, role: "S-Strong" },
      { id: "CB_L", pos: "CB", label: "CB", x: 0.06, y: 0.2, role: "CB-Press" },
      { id: "CB_R", pos: "CB", label: "CB", x: 0.94, y: 0.2, role: "CB-Press" },
      { id: "NB", pos: "CB", label: "NB", x: 0.76, y: 0.28, role: "CB-Nickel", mesh: "NB" },
      { id: "LB_M", pos: "LB", label: "MIKE", x: 0.5, y: 0.46, role: "LB-Thumper", mesh: "STACKER" },
      { id: "OLB_L", pos: "OLB", label: "EDGE", x: 0.2, y: 0.68, role: "OLB-Rush", mesh: "OVERHANG" },
      { id: "OLB_R", pos: "OLB", label: "EDGE", x: 0.8, y: 0.68, role: "OLB-Rush", mesh: "OVERHANG" },
      { id: "DE_L", pos: "DE", label: "LE", x: 0.36, y: 0.72, role: "DE-Power" },
      { id: "DT_N", pos: "DT", label: "NT", x: 0.5, y: 0.755, role: "DT-NT" },
      { id: "DE_R", pos: "DE", label: "RE", x: 0.64, y: 0.72, role: "DE-Power" }
    ]
  }
};
DEF_BLITZ_ELIGIBLE = {
  "4-3": ["OLB_W", "LB_M", "OLB_S", "S_SS", "S_FS", "CB_L", "CB_R"],
  // [Fire zones, Jul 2026] 3-4 OLBs are RUSHERS — a blitz dial on them was a
  // silent no-op (already rushing). Their dial is now the DROP share below.
  // 2026-08-19: the OLB slots join the blitz-eligible set. Only ONE outside
  // backer now rushes (the Jack); the other is a COVERAGE player, and a
  // coverage player who can come is the definition of a blitzer. Naming the
  // Jack is a harmless no-op — he is already rushing.
  "3-4": ["OLB_L", "OLB_R", "LB_I1", "LB_I2", "S_SS", "S_FS", "CB_L", "CB_R"],
  // Sub packages + heavy fronts (Aug 2026): the nickelback is the modern
  // blitz weapon (the slot pressure nobody picks up); the 46's whole identity
  // is that JACK/CHARLIE and the walked-down SS all threaten.
  "Nickel": ["OLB_W", "LB_M", "NB", "S_SS", "S_FS", "CB_L", "CB_R"],
  "Dime": ["LB_M", "NB", "S_D", "S_SS", "S_FS", "CB_L", "CB_R"],
  "46/Bear": ["OLB_J", "LB_M", "OLB_C", "S_SS", "S_FS", "CB_L", "CB_R"],
  "5-2": ["LB_I1", "LB_I2", "S_SS", "S_FS", "CB_L", "CB_R"],
  // 3-3-5: any of the six second-level hats can come — that's the point.
  "3-3-5": ["OLB_L", "LB_M", "OLB_R", "S_W", "S_SS", "S_FS", "CB_L", "CB_R"],
  "Tite": ["OLB_J", "LB_I1", "LB_I2", "OLB_K", "S_SS", "S_FS", "CB_L", "CB_R"],
  "4-4": ["OLB_S", "LB_I1", "LB_I2", "OLB_B", "S_FS", "CB_L", "CB_R"],
  "Big Nickel": ["OLB_W", "LB_M", "S_R", "S_SS", "S_FS", "CB_L", "CB_R"],
  // Penny EDGEs already rush — their dial is the DROP share below.
  "Penny": ["OLB_L", "OLB_R", "LB_M", "NB", "S_SS", "S_FS", "CB_L", "CB_R"]
};
DEF_DROP_ELIGIBLE = {
  "4-3": [],
  "3-4": ["OLB_L", "OLB_R"],
  "Nickel": [],
  "Dime": [],
  "46/Bear": [],
  "5-2": [],
  "3-3-5": [],
  "Tite": [],
  "4-4": [],
  "Big Nickel": [],
  "Penny": ["OLB_L", "OLB_R"]
};

// ── Stage 6 (Playbook-Root): AUTHORED variation alignments ──────────────────
// The FORMATION_VARIATIONS `layout:` pointers (constants.js) resolve HERE — the
// dangling pointers CREATOR_FIDELITY called "the smoking gun" now name real
// rows. Each row is a SPARSE moveset over the base formation's slots: the SAME
// slot IDs, moved to the look's pre-snap placement. x is 0..1 across the
// width; y 0.50 IS the line of scrimmage (on-line), 0.56 is the flanker/wing
// depth, deeper is backfield — same conventions as OFF_FIELD_LAYOUTS above.
// One table, now read by BOTH sides of the house: the live watch board
// (app.js) and the play/formation diagrams (routeart.js) draw it, and since
// M2 (owner decisions a+b, 2026-08-17) resolveOffField FIELDS it — the
// variation pkg always wins when fielding personnel, so the eleven the sim
// plays is the eleven the card draws.
var VARIATION_LAYOUTS = {
  // M0 CARD LINTER (2026-08-16): a move may also RE-DRESS the body it moves —
  // pos/label/role — so the drawn look matches the variation's personnel
  // package (FORMATION_VARIATIONS pkg). The Diamond's left wing DRAWS as the
  // FB he is in that look, not as a slot receiver squatting in the backfield
  // (owner catch #20); Ace's tightened slot draws as the second TE its pkg
  // names. Slot IDS never change (every recorded carrier/target stamp still
  // resolves), catch eligibility never changes, OL/QB are never re-dressed —
  // and since M2 the re-dress is ENGINE truth: resolveOffField fields these
  // rows, so a re-dressed pos changes which room supplies the body.
  // tools/card_lint_probe.mjs walks every row against the pkg; draw_up_probe
  // pins the id law.
  // Power-I — Big: the split man tightens onto the 3-TE surface (wing right).
  power_big: { moves: { WR_X: { x: 0.86, y: 0.56, pos: "TE", label: "W", role: "TE-Blocking" } } },
  // Power-I — Twins: U flexes out; twins surface right (U slot, X split end).
  power_twins: { moves: { TE_U: { x: 0.84, y: 0.56, pos: "SLOT", label: "SL", role: "WR-Slot" }, WR_X: { x: 0.94, y: 0.5 } } },
  // Spread — Trips: the slot crosses the formation; three-man surface right.
  spread_trips: { moves: { WR_S: { x: 0.72, y: 0.56 } } },
  // Spread — Ace: 12 personnel, one back — the slot tightens to a second
  // inline tight surface left, the QB goes UNDER CENTER and the back squares
  // up at tailback depth. (Was #18: the old row kept the gun QB with the back
  // stacked directly behind him — a pistol alignment wearing an Ace label.)
  spread_ace: { moves: { WR_S: { x: 0.26, y: 0.5, pos: "TE", label: "U", role: "TE-Blocking" }, QB: { x: 0.5, y: 0.62 }, RB_H: { x: 0.5, y: 0.84 } } },
  // Air Raid — Empty: five across, and per the pkg (M2 owner decision b —
  // RB: 0, WR: 5) the fifth man IS a receiver: the back's spot re-dresses as
  // a third slot, so the engine fields a real empty backfield, not a back
  // split wide.
  air_empty: { moves: { RB_H: { x: 0.68, y: 0.58, pos: "SLOT", label: "SL", role: "WR-Slot" } } },
  // Air Raid — Tight: condensed splits, everyone inside the numbers.
  air_tight: { moves: { WR_X: { x: 0.16, y: 0.5 }, WR_S: { x: 0.3, y: 0.56 }, WR_F: { x: 0.7, y: 0.56 }, WR_Z: { x: 0.84, y: 0.5 } } },
  // Pistol — Diamond: a REAL diamond (pkg: FB + TE wings, HB deep) — the slot
  // folds in as the left wing and draws as the FB the pkg names, the TE is
  // the right wing (an H-back, football-legal), the back is the deep point,
  // and Z steps ONTO the line so the formation keeps its lawful 7. (Was #20:
  // a body drawn as a slot WR squatting in the FB spot, and only 6 on the
  // line once the TE left it.)
  pistol_diamond: { moves: { WR_S: { x: 0.42, y: 0.74, pos: "RB", label: "FB", role: "FB-Lead" }, TE_Y: { x: 0.58, y: 0.74 }, WR_Z: { x: 0.94, y: 0.5 }, RB_H: { x: 0.5, y: 0.84 } } },
  // Pistol — Trips: 10 personnel per its pkg — the TE flexes out as the third
  // receiver in the trips surface and DRAWS as one; Z holds the line so the
  // look keeps 7 on it.
  pistol_trips: { moves: { WR_S: { x: 0.72, y: 0.56 }, TE_Y: { x: 0.83, y: 0.62, pos: "SLOT", label: "FL", role: "WR-Slot" }, WR_Z: { x: 0.94, y: 0.5 } } },
  // Trips/Bunch — Closed: the bunch condenses onto the tackle; per the pkg
  // (12 personnel) the point man of the bunch is a second TE wing.
  trips_closed: { moves: { WR_S: { x: 0.85, y: 0.56, pos: "TE", label: "U", role: "TE-Receiving" }, WR_Z: { x: 0.9, y: 0.62 } } },
  // Trips/Bunch — Open: max splits, the bunch spreads.
  trips_open: { moves: { WR_X: { x: 0.03, y: 0.5 }, WR_S: { x: 0.89, y: 0.56 }, WR_Z: { x: 0.97, y: 0.62 } } },
  // Single Back — Twins: U flexes wide left as a true slot (pkg 11 personnel),
  // twins with X.
  sb_twins: { moves: { TE_U: { x: 0.16, y: 0.56, pos: "SLOT", label: "SL", role: "WR-Slot" } } },
  // Single Back — Heavy: U tightens inline; Z tightens to the wing as the
  // third TE the pkg names (13 personnel).
  sb_heavy: { moves: { TE_U: { x: 0.24, y: 0.5 }, WR_Z: { x: 0.86, y: 0.56, pos: "TE", label: "W", role: "TE-Receiving" } } },
  // Empty — Trey: the third slot crosses; TE-anchored three-man surface right.
  empty_trey: { moves: { WR_F: { x: 0.7, y: 0.56 } } },
  // Empty — Wide: everyone stretched to the numbers.
  empty_wide: { moves: { WR_X: { x: 0.03, y: 0.5 }, WR_S: { x: 0.13, y: 0.56 }, WR_F: { x: 0.3, y: 0.56 }, WR_Z: { x: 0.97, y: 0.56 } } },
  // Wishbone — Heavy: the split end tightens INLINE as the second TE the pkg
  // names (a wing off the line left the look with only 6 on it).
  bone_heavy: { moves: { WR_X: { x: 0.21, y: 0.5, pos: "TE", label: "U", role: "TE-Blocking" } } },
  // Wishbone — Split: the TE splits out wide right as a true receiver (pkg
  // WR:2 TE:0) and draws as one.
  bone_split: { moves: { TE_Y: { x: 0.92, y: 0.5, pos: "WR", label: "Z", role: "WR-Deep" }, WR_X: { x: 0.06, y: 0.5 } } },
  // Flexbone — Twirl: the A-backs cheat wide for the twirl motion look.
  flex_twirl: { moves: { RB_H: { x: 0.18, y: 0.6 }, RB_2: { x: 0.82, y: 0.6 } } },
  // Flexbone — Trips: the left A-back flexes to the slot (pkg RB:1 WR:3) and
  // draws as the slot receiver he is in that look; trips right.
  // FLEXBONE TRIPS — re-authored 2026-08-18 from Throw Deep Publishing, "The
  // Flexbone Offense: An In-Depth Guide" (read under the owner's 2026-08-18
  // standing approval). The source is explicit on both alignments:
  //   base  — "two A-backs positioned 2x4 yards outside and behind tackles"
  //   trips — "takes one of the A backs from one side, and moves him to the
  //            opposite side lined up in space as a receiver off the line of
  //            scrimmage"
  // ONE A-back travels; the other stays where he was. The old row did neither
  // cleanly: it moved the traveller to x0.70 — tucked behind the right tackle
  // rather than "in space" — AND shoved the staying A-back out to x0.84, which
  // is what made the remaining ball-carrier look split out when he took a
  // handoff (owner report). Now the traveller goes wide as a receiver and the
  // staying A-back keeps his base 2x4 alignment, so inside runs are handed to a
  // man standing where a flexbone A-back actually stands.
  flex_trips: { moves: { RB_H: { x: 0.85, y: 0.54, pos: "SLOT", label: "SL", role: "WR-Slot" } } },
  // Wildcat — Unbalanced: both tight ends onto the right side.
  wc_unbal: { moves: { TE_U: { x: 0.86, y: 0.5 } } },
  // Wildcat — Slash: the U flexes away left as a split end (pkg TE:1 WR:1),
  // ON the line so the look keeps its lawful 7; the slash threat spreads the
  // field.
  wc_slash: { moves: { TE_U: { x: 0.14, y: 0.5, pos: "WR", label: "X", role: "WR-Deep" } } },
  // Jumbo — Goal Line: everything condenses onto the ball.
  jumbo_gl: { moves: { TE_Y: { x: 0.26, y: 0.5 }, TE_U: { x: 0.74, y: 0.5 }, TE_W: { x: 0.82, y: 0.56 }, FB: { x: 0.5, y: 0.72 }, RB_H: { x: 0.5, y: 0.84 } } },
  // Jumbo — Tackle Over: the strength (Y + wing) shifts over to the right.
  jumbo_to: { moves: { TE_Y: { x: 0.92, y: 0.5 } } }
};
// Resolve a formation's slots for a LOOK: the base row with the variation's
// authored moves applied (new objects — the base table is never mutated).
// layoutKey comes from FORMATION_VARIATIONS[fid][varKey].layout; callers pass
// it directly so this module stays independent of constants.js. Returns null
// when nothing is authored — callers fall back to the base slots.
function variationLayoutSlots(baseSlots, layoutKey) {
  const row = layoutKey ? VARIATION_LAYOUTS[layoutKey] : null;
  if (!row || !row.moves || !Array.isArray(baseSlots)) return null;
  let moved = false;
  const out = baseSlots.map((s) => {
    const m = row.moves[s.id];
    if (!m) return s;
    moved = true;
    const next = { ...s, x: m.x != null ? m.x : s.x, y: m.y != null ? m.y : s.y };
    // M0 card linter: an authored move may re-dress the body it moves (pos/
    // label/role) so the look draws its pkg's personnel. IDs and catch
    // eligibility never change; OL/QB are never re-dressed (probe-pinned).
    if (m.pos && s.pos !== "OL" && s.pos !== "QB") next.pos = m.pos;
    if (m.label) next.label = m.label;
    if (m.role) next.role = m.role;
    return next;
  });
  return moved ? out : null;
}

export { DEF_BLITZ_ELIGIBLE, DEF_DROP_ELIGIBLE, DEF_FIELD_LAYOUTS, OFF_FIELD_LAYOUTS, OL_SLOTS, VARIATION_LAYOUTS, variationLayoutSlots };
