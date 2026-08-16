import { escapeHtml } from '../../utils.js';

// The Tooltips — compressed reference microcopy.
//
// Same iron rule as the manual: not a single coefficient, threshold, or rate —
// ever. A tip is for the term a newcomer is staring at RIGHT NOW: one or two
// neutral sentences that buy an "oh, that's what that means," then get out of
// the way. Lead with what the thing is or does, then at most one non-obvious
// consequence. No first person, no advice, no scene. If a thing needs more than
// that, it isn't a tip — it's a manual chapter.

function tipTerm(tipId, displayText) {
  var _a;
  const label = displayText != null ? displayText : ((_a = TIPS[tipId]) == null ? void 0 : _a.term) || tipId;
  if (!TIPS[tipId]) return escapeHtml(String(label));
  return `<button type="button" class="tip-term" data-tip="${tipId}" aria-label="What is ${escapeHtml(String(label))}?">${escapeHtml(String(label))}</button>`;
}
var TIPS, tipById;

TIPS = {
  "overall": {
    term: "Overall",
    chapter: "reading-a-player",
    body: `A measure of how well a player fits the job his position asks of him, not of the athlete himself. Stand the same body at a different spot and the number changes, because the job changed.`
  },
  "class-rank": {
    term: "Class Rank",
    chapter: "recruiting",
    body: `Where your recruiting class stands against the other programs in your division. It leans hard on your best signees — a handful of blue-chippers outranks a long list of solid ones — with a smaller nudge for signing a full class. It updates live off current commitments and locks in on Signing Day.`
  },
  "target-share": {
    term: "Target Shares",
    chapter: "calling-a-game",
    body: `How often each receiver is the intended man on a pass. It's a lean, not a script — the quarterback still reads the coverage and takes what's open, so a featured target sees more looks but never all of them. Your standing DEFAULT is set by receiver (WR1, WR2, slot, tight end, back), so a man's share follows him wherever he lines up. On the Depth Chart field view you can override it per FORMATION by position — give the X or the slot a different mix out of a specific set.`
  },
  "rpo": {
    term: "RPO",
    chapter: "calling-a-game",
    body: `Run-Pass Option. One play that's both a run and a pass — the quarterback hands off or pulls it to throw depending on what one defender does after the snap. It puts that defender in a bind: crash the run and the throw is open, sit on the pass and the run has a lane.`
  },
  "base-front": {
    term: "Base Front",
    chapter: "defending-a-game",
    body: `The shape you line up in — how many hands are in the dirt versus standing up. A 4-3 has four down linemen and three linebackers (balanced); a 3-4 trades a lineman for a fourth backer (more blitz disguise); Nickel and Dime swap a linebacker for an extra defensive back against spread teams; the heavier looks pack the middle against the run. The sim auto-subs to the right personnel by down and situation; this sets your starting point.`
  },
  "the-box": {
    term: "The Box",
    chapter: "defending-a-game",
    body: `The defenders stacked near the line of scrimmage, in the area a run has to get through. Loading the box puts more bodies in run lanes — it stuffs the ground game but leaves receivers in tighter one-on-ones and is vulnerable to play-action. Lightening it does the opposite. It's the central run-or-pass gamble of defense.`
  },
  "option-assignment": {
    term: "Option Assignment",
    chapter: "defending-a-game",
    body: `Against an option offense, every defender is given one man to take and told to take only him — the dive, the quarterback, or the pitch. Assignment-sound defense beats the option by making the offense wrong no matter who keeps the ball; guessing gets you blocked out of the play.`
  },
  "edge-discipline": {
    term: "Edge Discipline",
    chapter: "defending-a-game",
    body: `What your outside rushers do at the snap. Contain sets a hard edge and turns everything back inside to your help — safe against outside runs and scrambles. Crash sends them hard upfield — more sacks and better against inside runs, but a quarterback or a jet sweep can get outside the moment they lose the edge.`
  },
  "robber": {
    term: "Robber",
    chapter: "defending-a-game",
    body: `A safety who drops down and sits in the middle of the field underneath the deep coverage, hunting the intermediate throw — the dig, the crosser, the seam. He "robs" the route the quarterback thinks is open. The cost: he's left the deep middle, so the post behind him is live if the quarterback looks him off.`
  },
  "coverage-scheme": {
    term: "Coverage Scheme",
    chapter: "defending-a-game",
    body: `Whether you play the receivers straight up or gang up on their best one. Lock puts your top corner on their top receiver everywhere he goes; Bracket puts two defenders on him, over and under. Doubling a star takes him away — but it means someone else is in single coverage or running free, so it bleeds against a balanced offense.`
  },
  "safety-shell": {
    term: "Safety Shell",
    chapter: "defending-a-game",
    body: `How many safeties you keep deep. Single-high leaves one man back and drops the other into the box — great against the run, but one deep defender means the post and the go ball are live. Two-high keeps two back to take away the deep shots, at the cost of a lighter box. The central bargain of modern defense.`
  },
  "cushion": {
    term: "Cushion",
    chapter: "defending-a-game",
    body: `How much space your corners give receivers in man coverage. Press jams them at the line and wrecks the timing of quick, rhythm routes — but a beaten jam is a step given up deep. Off (soft) coverage keeps everything in front and concedes the underneath throw. Only matters on man calls.`
  },
  "bracket-target": {
    term: "Bracket Target",
    chapter: "defending-a-game",
    body: `When you're doubling a receiver (Lock or Bracket), this is who the double-team keys on — their top threat by default, or you can point it at their tight end, their slot, or whoever's getting the hot ball. Everyone else is in tighter coverage, so aim the bracket where it hurts them most.`
  },
  "option-game": {
    term: "The Option",
    chapter: "calling-a-game",
    body: `Triple-option football: the quarterback reads unblocked defenders instead of blocking them. He can hand to the dive back, keep it himself, or pitch it to a trailing back — deciding each based on what the "read" defender does. It grinds and eats clock, and it makes a fast defense wrong by choice; the trade is it lives or dies on the quarterback's reads and ball security.`
  },
  "option-mix": {
    term: "Option Mix",
    chapter: "calling-a-game",
    body: `When the read is a coin flip, which way you lean — give the dive up the middle, keep it with the quarterback on the edge, or pitch it to the trailing back. Dive-heavy grinds behind your power back; pitch-heavy hunts the edge with your fastest man. It's a lean, not a rule — the quarterback still takes what the defense gives.`
  },
  "pitch-aggressiveness": {
    term: "Pitch Aggressiveness",
    chapter: "calling-a-game",
    body: `How willing the quarterback is to pitch the ball on the option. Loose pitches more often — more explosive edge plays, but more balls on the ground when the pitch is contested. Safe keeps it tighter and protects possession at the cost of some big plays.`
  },
  "chip-help": {
    term: "Chip Help",
    chapter: "calling-a-game",
    body: `A running back, on his way out to his route, throws a quick shot into the edge rusher first — a "chip" — to slow him down and buy the quarterback an extra beat. The cost: a back who's busy chipping is a late, less-available checkdown, so your safety-valve thins exactly when the pressure is heaviest.`
  },
  "protection-style": {
    term: "Protection Style",
    chapter: "calling-a-game",
    body: `How the pocket is built. Quick Game keeps it simple and gets the ball out on rhythm — the rush can't sack what's already thrown. Half-Slide, the modern default, blocks man to one side and zone-slides the other, sound against almost anything. Big-on-big trusts your five linemen one-on-one and lets the backs scan for blitzers. Max Protect keeps a tight end and back in to block — the deep-shot answer to heavy pressure, at the cost of bodies in the route.`
  },
  "qb-aggression": {
    term: "QB Aggression",
    chapter: "calling-a-game",
    body: `The gunslinger dial. Push It hunts throws deeper than your called mix and trusts the quarterback to fit it in — more big plays, more risk. Protect It takes the safe throw and the checkdown. A sharp, high-awareness passer earns the right to push; a shaky one gives it back.`
  },
  "def-aggression": {
    term: "Aggression",
    chapter: "defending-a-game",
    body: `How much you gamble on defense. At the quiet end you rush four and keep everyone home — bend but don't break. At the loud end you bring extra rushers on almost every dropback and man everyone up with no help behind — the max-risk approach that lives on sacks and dies on the one that gets loose. In between you pick your spots, and how well those spots are chosen depends on your coordinator.`
  },
  "pressure-style": {
    term: "Pressure Style",
    chapter: "defending-a-game",
    body: `What your blitz actually looks like. A fire zone shows pressure, drops a lineman into coverage, and brings a linebacker behind him — the same number of rushers from unexpected angles, the low-risk blitz. Bringing linebackers downhill through the gaps gets home fast but empties the middle of the field. Sending a safety or slot corner off the edge is heat from a spot the protection isn't counting; bringing everyone is the all-out gamble with no help behind it.`
  },
  "zone-style": {
    term: "Zone Style",
    chapter: "defending-a-game",
    body: `How your zone defenders are coached to play their areas. Match coverage travels with the routes that enter the zone — it takes away crossers, floods, and high-low combinations that pull spot-droppers out of position. Spot-drop just sinks to a landmark and sits in the throwing lane, simpler and steadier but easier to move with route design.`
  },
  "role-fit": {
    term: "Role Fit",
    chapter: "reading-a-player",
    body: `The same position grades differently depending on how a man is used — a press corner and a zone corner aren't asked for the same things. Fit him to the role you actually play and his number climbs.`
  },
  "archetype": {
    term: "Archetype",
    chapter: "reading-a-player",
    body: `The kind of player he is underneath the position — a burner, a possession guy, a bruiser. It is shorthand for where his gifts lean, and the role he shines in.`
  },
  "potential": {
    term: "Potential",
    chapter: "building-a-player",
    body: `How far a player can still climb, not where he stands today. A high ceiling on a raw player is worth more than a polished one who is nearly finished growing — but only if he is developed toward it.`
  },
  "attributes": {
    term: "Attributes",
    chapter: "reading-a-player",
    body: `The raw tools — Overall reads them through the lens of the position, but the attributes themselves are what every snap is contested on. The shorthand you'll see around the game: SPD speed · AGI agility · PWR power · STR strength · JMP jumping · HND hands · SEC ball security · TEC technique · AWR awareness · CON conditioning · WE work ethic.`
  },
  "awareness": {
    term: "Awareness (AWR)",
    chapter: "reading-a-player",
    body: `The football mind — reading the play, being where he belongs, not getting fooled. It carries more weight the more a spot asks a man to think, and it is close to everything for a quarterback or a middle linebacker.`
  },
  "depth-chart": {
    term: "Depth Chart",
    chapter: "the-depth-chart",
    body: `Your order of preference at every position — who plays when everyone is healthy, and who is next when they are not. The sim fields the top of each spot, so an honest chart matters most after an injury.`
  },
  "field-view": {
    term: "Field View",
    chapter: "the-depth-chart",
    body: `The depth chart laid out where men actually stand rather than as a list. It shows who is really on the field in a given formation, and it is where option pitch men and wing spots get set.`
  },
  "sub-package": {
    term: "Sub Package",
    chapter: "the-depth-chart",
    body: `The bodies you swap in to answer what the offense shows — more defensive backs against spread looks, more beef against heavy ones. Caught in the wrong package, the defense is a step behind before the snap.`
  },
  "development": {
    term: "Development",
    chapter: "building-a-player",
    body: `How a player grows from where he is toward what he could be. It comes fastest early and eases as he matures, so reps spent on a young man go further than the same reps spent late.`
  },
  "practice": {
    term: "Practice",
    chapter: "building-a-player",
    body: `Where development is pointed. Aim it at what a player's role actually needs and it shows up on Saturdays; spread it thin and nobody in particular grows.`
  },
  "redshirt": {
    term: "Redshirt",
    chapter: "building-a-player",
    body: `Sitting a young player for a season to keep a year of his eligibility for later. You give up whatever he offers now to have him longer, and further along, down the road.`
  },
  "prestige": {
    term: "Prestige",
    chapter: "recruiting",
    body: `How much recruiting the program does for you before you say a word. It is earned by winning — bowls, titles — and bled by losing, and it is the first thing to go.`
  },
  "recruit-interest": {
    term: "Interest",
    chapter: "recruiting",
    body: `How warm a recruit is on your program right now. There is no meter to fill — it climbs by out-recruiting the other schools chasing him that same week, and it cools the week you sit out.`
  },
  "recruit-stars": {
    term: "Visibility",
    chapter: "recruiting",
    body: `The raw eyeball read of a recruit — his tools averaged flat, with no credit for whether they are the tools his position needs. True Rating weights them for the job. High visibility with a low true rating is a workout warrior; the reverse is a gem nobody else clocked.`
  },
  "scholarship": {
    term: "Scholarship",
    chapter: "recruiting",
    body: `The offer itself — a seat at your table, and there are a limited number of them. A wasted ride is a hole in next year's roster.`
  },
  "commitment": {
    term: "Commitment",
    chapter: "recruiting",
    body: `A recruit saying yes, which is not always the end of it. Keep after him and it holds; go quiet and he can still be lost late to a school that kept pushing.`
  },
  "transfer-portal": {
    term: "The Portal",
    chapter: "the-portal",
    body: `The open market of players who have left their school and can join yours immediately, with no waiting for them to develop. It cuts both ways: a hole gets patched fast, and a man you were counting on leaves the same way.`
  },
  "roster-limit": {
    term: "Roster Limit",
    chapter: "the-portal",
    body: `The cap on how many players a program can carry. Every seat filled is one nobody else gets, so a roster is a series of choices about who is worth a spot.`
  },
  "attrition": {
    term: "Attrition",
    chapter: "the-portal",
    body: `The players lost every year to graduation, to the pros, to the portal. It is constant, so a program that recruits only for this year is always one offseason from thin.`
  },
  "phase": {
    term: "Regular Season",
    chapter: "the-year",
    body: `The stretch of games that earns a bowl, a conference title and a shot at the playoff. It is one leg of the football year — season, recruiting, offseason — and the leg that decides how good the others get to be.`
  },
  "bowl-game": {
    term: "Bowl Game",
    chapter: "the-year",
    body: `The postseason reward for a good enough season — a stage, a payday, and prestige for winning it. Reaching one is its own recruiting pitch: recruits want to play where January still has football.`
  },
  "formation": {
    term: "Formation",
    chapter: "calling-a-game",
    body: `Who is on the field and where they stand, which sets your personnel before a play is called. One identity is strong but easy to scout; carrying several is harder to read but masters none.`
  },
  "tendency": {
    term: "Tendency",
    chapter: "calling-a-game",
    body: `How run- or pass-heavy you lean by default. It shapes what the other side expects: a believable run threat is what makes play-action worth anything, and leaning too far one way lets a good coordinator sit on it.`
  },
  "play-action": {
    term: "Play Action",
    chapter: "calling-a-game",
    body: `Faking the run to freeze the defense, then throwing behind it. It only works if the run is respected in the first place — sell nothing on the ground and nobody bites on the fake.`
  },
  "blitz": {
    term: "Blitz",
    chapter: "defending-a-game",
    body: `Sending extra rushers to get home faster. It is a trade, not a gift — the men sent are men not covering, and a ready offense throws into the space they left.`
  },
  "coverage": {
    term: "Coverage",
    chapter: "defending-a-game",
    body: `How the back seven guards the pass — man-to-man on bodies, or zones guarding grass. Man travels with receivers but is picked apart by design; zone keeps eyes on the ball but leaves seams.`
  },
  "special-teams": {
    term: "Special Teams",
    chapter: "special-teams",
    body: `Kicks, punts and returns — the third of the game that decides field position and the odd game outright. It steals points the box score never explains, and it is easy to ignore until a shanked punt costs a game.`
  },
  "job-security": {
    term: "Job Security",
    chapter: "your-career",
    body: `The program's patience with you, earned by meeting what it expected when it hired you. Clear the bar and you are trusted with time; fall short long enough and the seat gets warm regardless of your record.`
  },
  "expectations": {
    term: "Expectations",
    chapter: "your-career",
    body: `What the program is counting on from you this year — the bar you are judged against, not a national ranking. Beat it and modest wins look great; miss it and a good-looking record still disappoints.`
  },
  "position-room": {
    term: "Position",
    chapter: "the-position-room",
    body: `Where a man lines up decides which of his tools are graded and which are ignored — the same body is a different player at a different spot. What a position does not care about is as useful to know as what it does.`
  },
  "pre-snap": {
    term: "Motion & the Pre-Snap Read",
    chapter: "the-pre-snap-read",
    body: `Motion before the snap makes the defense declare itself: whether a man travels with the mover or the shell just slides tells the quarterback what he is looking at. Used one way every time, it tips your own hand over a season.`
  },
  "route-duel": {
    term: "Pass Depth",
    chapter: "the-route-duel",
    body: `How far downfield your receivers are asked to work. Short throws are won by hands and timing, deep ones by speed against a corner's leverage — the choice is which duel your men have to win.`
  },
  "run-fit": {
    term: "Run Direction",
    chapter: "the-run-fit",
    body: `Where you attack decides who has to beat whom. Inside runs are won by your interior against theirs; getting outside asks the back to beat a defender to a spot and the receivers to do the dirty work.`
  },
  "role-dial": {
    term: "Role Designation",
    chapter: "reading-a-player",
    body: `Naming the job you want a man doing — this tackle is the left tackle, this tight end is a move guy. Designating him puts him there ahead of a better-graded body who is not that; on Auto, the chart sorts itself.`
  },
  "scheme-lens": {
    term: "Your Scheme’s Number",
    chapter: "reading-a-player",
    body: `The overall you see is graded through your system; the consensus underneath is what the rest of the country thinks. When your number is higher he is a bargain nobody will outbid you for; when it is lower he is the trap.`
  },
  "aggression": {
    term: "Aggression",
    chapter: "defending-a-game",
    body: `How often you send more than four rushers. Sitting back keeps a lid on and lets a quarterback get comfortable; turning it up wins snaps behind the line and pays for it over the top. The middle settings are not a compromise; they pick their spots.`
  },
  "pressure-identity": {
    term: "Pressure Identity",
    chapter: "defending-a-game",
    body: `Who brings the pressure, not how often. Second-level heat sends backers off the edge, secondary heat brings a defensive back, the house brings everybody and leaves nobody deep. On Auto it takes the signature of the front you are lined up in.`
  },
  "protection-identity": {
    term: "Protection",
    chapter: "the-pocket",
    body: `How the pocket gets built. Slide the line and you are strong to a side and thin away from it; block man-on-man and every fight is honest; keep extra bodies in and you are safe with fewer men to throw to.`
  },
  "olb-edge": {
    term: "EDGE",
    chapter: "the-position-room",
    body: `An outside linebacker built for an odd front — the man who wins off the edge with speed and bend. Nothing to do with stopping the run; play him in an even front and you are asking the wrong thing of him.`
  },
  "olb-backer": {
    term: "BACKER",
    chapter: "the-position-room",
    body: `An outside linebacker built for an even front — heavier, comes downhill, arrives on the blitz rather than winning around a tackle. The even-front twin of EDGE, not a lesser version of it.`
  },
  "coach-dna": {
    term: "Coach Identity",
    chapter: "your-career",
    body: `Who you are on the sideline, earned by coaching that way for years rather than chosen from a menu. Each axis buys a small, specific edge in the thing you already do, so playing every style a little earns nothing.`
  },
  "unit-grade": {
    term: "Unit Grades",
    chapter: "your-career",
    body: `What the tape says about a group, graded off the same snaps whether the game was a blowout win or a blowout loss. They are a coordinator's record, and what he carries into a program of his own.`
  },
  "coordinator": {
    term: "Coordinators",
    chapter: "your-career",
    body: `The two men running your sides of the ball. You are paying for judgment — a good one's weekly read is worth following, and a poor one hands you a confident wrong answer without knowing it.`
  },
  "recruit-wants": {
    term: "What He Wants",
    chapter: "recruiting",
    body: `Most recruits carry a hidden want or two, visible only once you scout him: development (reading your developer grade), pedigree (your reputation) or a big program (your prestige against the ceiling). Each reads a receipt your program already earned, so none can be talked into.`
  },
  "coaching-tree": {
    term: "The Tree",
    chapter: "the-coaching-tree",
    body: `One league, up to three chairs inside it — one per division — all yours to steer. You start at the bottom and grow the rest by handing your own coordinators programs. One clock runs it all: nobody's week moves until every program has played or accepted its game.`
  },
  "the-harvest": {
    term: "The Harvest",
    chapter: "the-coaching-tree",
    body: `What a coach leaves behind. While he works his identity is his own and none of it belongs to the tree; retiring is what commits it, permanently, to every man who comes after.`
  },
  "division-memory": {
    term: "League Memory",
    chapter: "the-coaching-tree",
    body: `What the tree learns about a division by working it. A new man seated where the tree has history can read the talent and work the local market; seated somewhere new, he walks in cold. It is a floor under a newcomer, never a bonus on one who already knows more.`
  }
};
tipById = (id) => TIPS[id] || null;

export { tipById, tipTerm };

// additional exports consumed by tools/ probes
export { TIPS };
