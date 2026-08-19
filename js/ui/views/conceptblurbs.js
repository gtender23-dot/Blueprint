// ── Concept blurbs (D4/M2, #21) — one purpose line per play card ───────────
// The def-card subtitle grammar, spoken for offense: WHAT IT IS · WHAT IT
// DOES · WHAT IT RISKS, one line, football words. Help-language rules bind:
// deep enough to coach from, vague about the numbers on purpose — no
// coefficient, weight or threshold ever appears here. Rendered under the big
// card (INFO / Builder), and as the tile tooltip everywhere cards draw.
var CONCEPT_BLURBS = {
  // ── the quick game ───────────────────────────────────────────────────────
  "Mesh": "Two shallow crossers scissor under the coverage · traffic frees a man against tight matchups · zone eyes can sit and rally to the catch.",
  "Slant-Flat": "A slant working inside with a flat under it · makes one defender wrong whichever he takes · a jumped slant is a pick the other way.",
  "Stick": "A tight end settles at the sticks with a flat outside · fast, rhythm yardage against soft zone · a physical flat defender closes both doors.",
  "Shallow Cross": "One shallow drag with a dig behind it · the drag pulls linebackers, the dig works the space they left · it needs a beat longer than pure quick game.",
  "Spot": "A spacing triangle — corner, snag, flat · stretches one zone defender three ways · press coverage can squeeze the snag window shut.",
  "Double Slants": "Both receivers slice inside on slants · quick leverage wins against off coverage · inside help or a lurking backer erases it.",
  "Whip": "A slant that plants and whips back outside · shakes a man defender sitting on the inside break · it takes an extra tick the rush can steal.",
  "Hoss": "Hitches outside, a seam inside · the seam holds the safety while the hitch takes the easy yards · press corners can lean all over the hitch.",
  "Spacing": "Curls and a flat spaced across the short zones · gives the QB a clean either-or read at rhythm depth · it wins underneath or not at all.",
  "Y-Option": "The tight end reads his man and breaks where he isn't · a veteran's answer to any leverage · a young QB and his tight end must see it the same way.",
  // ── screens ──────────────────────────────────────────────────────────────
  "Bubble Screen": "The slot swings flat behind the line · turns a soft corner into free perimeter yards · one missed stalk block and it dies at the catch.",
  "Tunnel Screen": "The wideout comes back under the traffic · uses the rush's own momentum against it · a corner who stays home blows it up in the backfield.",
  "RB Screen": "The back slips out behind the charging rush · punishes pressure with linemen out in front · slow to develop, and a read defender walks it down.",
  "Slip Screen": "A screen off a hard pass set · the line invites the rush, then releases · if the rush stays disciplined the QB is holding a dead ball.",
  // ── the dropback game ────────────────────────────────────────────────────
  "Curl-Flat": "A curl over a flat on the same side · high-lows the flat defender in soft zone · a late sideline throw is the one corners take back.",
  "Stick-Nod": "The stick route fakes the settle and slips behind it · punishes a backer who jumps the sticks · against patient zone it's just a covered double move.",
  "Follow": "A shallow drag with a dig trailing it · the second route follows into the cleared space · man defenders who switch it off kill the timing.",
  "Drive": "A drag underneath with a dig over the top · two in-breakers stress the same hook defender · a robber sitting in the middle reads the QB's eyes.",
  "Levels": "Two in-cuts at different depths · high-lows the middle of the field against man or two-deep · an inside wall or a lurker sits right where they break.",
  "Y-Cross": "The tight end crosses the whole field at depth · man coverage can't carry it through traffic · protection has to live long enough for him to clear.",
  "Sail": "Three routes flood one sideline at three depths · gives the QB a clean high-to-low ladder against three-deep · man coverage carries every rung.",
  "Flood": "A vertical, a deep out, and a flat to one side · one flat defender cannot be right · slow-developing, and the boundary throws get tight.",
  "Deep Out": "A full stem snapped to the sideline · the classic two-deep hole shot outside the numbers · a long throw the QB's arm has to carry.",
  "Comeback": "A deep stem worked back to the boundary · nearly uncoverable when the timing is right · thrown late it's the easiest pick in football.",
  "Bench": "An out with a corner over it · high-lows the sideline against two-deep · the QB must hold the safety with his eyes first.",
  "Smash": "A short hitch with a corner over the top · the corner route climbs behind the flat defender · quarters coverage can squeeze the window shut.",
  "Seam-Read Smash": "Smash with a seam reading the middle · the seam bends wherever the safeties aren't · it asks the QB and the seam man to see it alike.",
  // ── the shot plays ───────────────────────────────────────────────────────
  "Four Verts": "Four receivers up the field · stresses every deep seam a single-high defense owns · long to develop, and pressure gets there first.",
  "Dagger": "A seam clears, a deep dig follows underneath · the vertical empties the space the dig fills · a pressured or late QB hangs the dig out to dry.",
  "Mills (Post-Dig)": "A post over a dig · the dig pulls the safety down and the post goes over his head · quarters safeties who stay deep take the post away.",
  "Yankee": "A deep post with a crosser dragging under it · two men stretch a single-high safety the full width · it lives on max time and a big arm.",
  "Post-Wheel": "A post with a wheel curling up behind it · the post clears the corner for the wheel down the sideline · picked up early, both routes are dead ends.",
  "Corner-Post": "A corner move that bends back to the post · beats a safety who jumps the first break · a patient safety makes it a long, covered route.",
  "Scissors": "A post and a corner crossing deep · the crossing stems rub two-deep safeties off their landmarks · a muddy read if the safeties trade it clean.",
  "Skinny Post": "A post thrown thin, in front of the safety · splits single-high before help arrives · thrown flat it leads the receiver into the hit.",
  "Deep Over": "A crosser carried deep across the field · outruns man coverage and finds the second-level void · needs time, and a rat in the middle reads it.",
  "Sluggo Seam": "A slant-and-go with a seam holding the middle · sells the slant, then goes over the corner's head · a disciplined corner never bites, and the QB holds it.",
  "Red-Zone Fade": "One isolated back-shoulder ball to the boundary · your best jump-ball man against one defender · it's a coin flip you chose to flip.",
  // ── play action & gadgets (pass) ─────────────────────────────────────────
  "Boot": "The QB fakes and rolls the other way · moves the launch point away from the rush and finds the drag · an unblocked edge defender meets him there.",
  "PA Deep Cross": "A run fake under a deep crosser · the fake holds the backers a step past too late · without a run game to sell, nobody bites.",
  "Flea Flicker": "Handoff, pitch back, deep shot · a run look that turns the safeties around · if nobody bites deep the QB is holding it in a collapsing pocket.",
  "HB Pass": "The back takes the toss and throws it · the whole defense chases the sweep while a receiver sneaks deep · a back is throwing — anything can happen.",
  // ── the run game ─────────────────────────────────────────────────────────
  "Inside Zone": "One-cut zone run behind combination blocks · the back reads the front and takes what it gives · a loaded box closes the cut before it appears.",
  "Split-Zone": "Inside zone with a tight end slicing back across · the sift block seals the backside and fakes the boot look · penetration through the exchange spills it.",
  "Outside Zone": "The whole line stretches the front sideways · the back rides the wave and cuts where it breaks · a fast edge strings it out for nothing.",
  "Power": "Down blocks with a guard pulling through the hole · a numbers advantage arriving at the point of attack · penetration can cut the puller off in traffic.",
  "Iso": "A lead back straight at a linebacker · your hat on their hat, downhill now · it wins the collision or it wins nothing.",
  "Trap": "An interior rusher is let through, then trapped · his own aggression opens the lane behind him · a squatting, patient tackle wrecks the angle.",
  "Counter": "A false step, then pullers the other way · punishes a fast-flowing front for over-pursuing · slow to hit, and a crashing edge blows it up.",
  "Wham": "A tight end blindsides the unblocked tackle · frees the line to climb while the wham does the dirty work · if the wham misses, the back meets that man cold.",
  "Toss": "The ball pitched to the edge on the snap · gets your fastest man to the corner before the defense sets · the corner set first turns it back inside for a loss.",
  "Buck Sweep": "Both guards pull around the edge · a convoy to the perimeter with the ball behind it · it asks two big men to beat small men to the spot.",
  "Pin-and-Pull": "Down pins with pullers wrapping outside · the edge is sealed and the lane rolls around it · one missed pin and the whole train derails.",
  "Dart": "A tackle pulls for the backer instead of a guard · a gap-scheme surprise from a spread look · the pulling tackle is a long way from home.",
  "Draw": "A pass set that turns into a handoff · the rush charges itself right out of the play · a backer who smells it is standing in the hole.",
  "QB Sneak": "The QB surges behind the center's wedge · short yardage by the shortest path · bodies on bodies — nothing is promised past a yard.",
  "QB Power": "Power blocking with the QB keeping it · the back's fake adds a hat the box never counted · your quarterback takes interior hits.",
  "Wildcat Power": "The back takes the snap himself and follows power · an extra blocker where the QB used to stand · with no pass threat, everyone plays the run.",
  // ── the authored RPO / QB-run family (M3) ────────────────────────────────
  "Zone Read": "Inside zone with the backside end left unblocked · the QB reads him — crash means keep out the space he left, sit means give · a disciplined edge makes it a plain handoff.",
  "RPO Glance": "Inside zone tied to a quick slant behind the box backer · his first step answers it — bite means throw, hold means give, and a runner can pull it and go · a backer who sits honest takes the easy answer away.",
  "RPO Bubble": "Wide zone tied to a bubble swinging off the slot · the overhang can't defend both the run and the throw · a corner squatting on the bubble turns it into a plain run.",
  "QB Draw": "The line shows pass and the QB slips out late · the rush charges upfield past a runner they forgot · a spy or a patient backer is standing in the lane.",
  "QB Counter": "Down blocks with a puller kicking out — and the QB carrying · the fake to the back holds the pursuit a step · your quarterback is the man taking the hits off tackle.",
  "Reverse": "The sweep hands off backward against the grain · the defense's pursuit becomes the blocking · if the backside stays home it's a huge loss.",
  "Jet Sweep": "A receiver at full sprint takes the snap-second handoff · the edge is attacked before the defense can set it · easy to chase down from behind if the seal slips.",
  "Triple Option": "Dive, keep, or pitch — read men, don't block them · the unblocked defenders are always wrong · every exchange is a fumble waiting on a mistake.",
  "Speed Option": "The QB attacks the edge with a pitch man in tow · one edge defender is made to choose, then punished · a slow decision and the pitch dies on the ground.",
  "Midline Option": "The read moves inside — an interior lineman is left alone and made to pick · the dive hits straight downhill, the keep cuts up behind him · no pitch to bail you out if the read is wrong."
};

// The composer's authored pieces get their line assembled from the design —
// path · scheme · carrier — in the same grammar.
var _RUN_PATH_BLURB = {
  inside: "downhill between the tackles",
  offtackle: "off the tackle's hip",
  outside: "stretched wide to the edge",
  toss: "pitched to the corner",
  draw: "delayed behind a pass look"
};
var _RUN_SCHEME_BLURB = {
  zone: "the line reaches and climbs",
  gap: "a guard pulls through the point",
  trap: "one rusher is invited in and trapped",
  lead: "a back leads through the hole first"
};
function conceptBlurb(name) {
  return CONCEPT_BLURBS[name] || null;
}
// A composed play's one-liner, derived from its own authored design.
function composedBlurb(cp) {
  if (!cp) return null;
  if (cp.kind === "run" && cp.run) {
    const p = _RUN_PATH_BLURB[cp.run.path] || "a designed run";
    const s = _RUN_SCHEME_BLURB[cp.run.scheme] || "the line blocks it up";
    const c = cp.run.carrier === "QB" ? "the quarterback keeps it" : "the back carries it";
    return `Your run — ${p} · ${s} · ${c}.`;
  }
  const n = Array.isArray(cp.parts) ? cp.parts.length : 0;
  const kept = Array.isArray(cp.blocks) ? cp.blocks.length : 0;
  return `Your pass — ${n > 3 ? "a full-field route package" : "a chosen route combination"}${kept ? " with extra bodies kept home to protect" : ""} · graded by the same rulebook every shipped play obeys.`;
}
export { CONCEPT_BLURBS, conceptBlurb, composedBlurb };
