# Release Readiness Review — external playtest assessment (as of 2026-08-08)

> Filed 2026-08-10. This is an outside commercial-readiness review of the DEPLOYED build
> (home-screen build `b8c2db1a1b` — one build behind the then-current committed
> `b849355765`). Its technical claims were verified against source on 2026-08-10; see
> `Ref/RELEASE_PUNCH_LIST_2026-08-10.md` for per-claim verdicts (two claims refuted, the
> accessibility and save-gap claims confirmed) and the resulting action list.

---

## Executive verdict

Blueprint is already a substantial game, not a thin prototype. Its simulation depth,
fictional football universe, coaching-tree structure, recruiting, roster management,
tactical planning, and live play-calling support a real commercial product.

Readiness assessment as of August 8, 2026:

| Release standard | Readiness | Verdict |
|---|---|---|
| Free public beta | 80–85% | Ready now |
| Paid web/itch.io Early Access | 60–65% | Close, after critical hardening |
| Steam Early Access | 50–55% | Needs packaging, durable saves, support infrastructure |
| Paid 1.0 | 40–50% | Systems are ready; product operations and proof are not |

The central issue is not a shortage of game content. It is that the commercial shell —
save security, accessibility, long-horizon balance validation, branding, customer
support, and storefront packaging — is less mature than the design.

## What was tested

The live build was exercised through: main menu, exhibition setup and generated teams; a
live defensive snap and animated play presentation; dynasty creation, difficulty and
assistance settings; program selection, staff hiring and football identity; season hub
and reload persistence; recruiting search and scouting structure; roster,
depth-management and game-plan surfaces; settings, save export/import, PWA manifest and
offline-cache implementation; desktop and narrow-layout behavior; runtime warnings and
errors.

The game loaded cleanly, retained the test dynasty after a full reload, and produced no
console warnings or errors during the session.

NOT validated: an entire season, offseason, transfer portal, coaching succession or a
multi-decade universe. Those are consequently the largest remaining unknowns.

## Readiness scorecard

| Area | Score | Assessment |
|---|---|---|
| Core game concept | 9/10 | Distinctive and commercially defensible |
| Simulation breadth | 8.5/10 | Much deeper than the landing page initially suggests |
| Tactical depth | 9/10 | Excellent combination of standing plans and snap-level decisions |
| Onboarding | 7.5/10 | Strong explanations and Simple mode, but still information-heavy |
| UI and visual identity | 7/10 | Coherent, readable desktop presentation; lacks final commercial sheen |
| Stability smoke test | 8/10 | Clean during the tested paths |
| Save durability | 4.5/10 | Browser-local save with manual JSON backup is insufficient for a premium launch |
| Accessibility | 4.5/10 | Several concrete semantic and focus issues |
| Long-term balance proof | 3/10 | Cannot be inferred from first-hour quality |
| Commercial/store readiness | 2.5/10 | No releases, store page, customer support layer or established community funnel |

## Where the game is genuinely unique

The strongest hook is not merely "another college football management sim." It is:
**build a football family, not just one program** — begin in Division III and manage one
living world through three divisional coaching chairs.

That proposition is unusually strong for four reasons:

1. **One world, three chairs.** D1, D2 and D3 are part of the same continuously evolving
   universe. Coordinators can branch into other jobs and divisions, while the player
   chooses which family member to inhabit.
2. **Career inheritance.** Retirement banks a coach's career into the family identity.
   That gives succession mechanical significance rather than making coaching changes a
   cosmetic career menu.
3. **Grassroots institutional storytelling.** Procedural D2/D3 programs arrive with
   towns, stadiums, records, rivalries and traditions. Starting with a 3,000-seat,
   one-star program feels meaningfully different from choosing a generic weak team.
4. **Management and coordinator-level tactics coexist.** Recruiting, budgets, staff,
   development and history are paired with extremely granular live calls: fronts,
   shells, pressure, robber behavior, run fits, formation packages and situational
   plans. Simple and Advanced modes make the same engine approachable at different
   depths.

The writing also carries a consistent football voice. Phrases such as "the line buys a
crease and the back spends it" explain mechanics with more character than the usual
spreadsheet-sim documentation.

## The uniqueness problem is currently the name

"Blueprint" has become a difficult commercial name. EA now prominently markets the
centerpiece of College Football 27's dynasty mode as "Dynasty Blueprint." That feature
covers budgets, staff, facilities and program planning — close enough to this game's
subject that search results and customer recognition will be dominated by EA.

The current build also uses three identities: wordmark **Blueprint**, page/PWA title
**Dynasty CFB**, repository **Blueprint**. This should be resolved before press outreach
or a storefront submission. Even if the name is legally usable, it is now poor for
discovery. A name centered on the unique coaching-family concept would be considerably
stronger.

## Comparable games

| Comparable | Current price | Market position | Implication for Blueprint |
|---|---|---|---|
| Football Coach: College Dynasty | $19.99 | Closest direct comp; 95% positive from ~1,466 reviews | The standard Blueprint must approach for polish, usability and long-term confidence |
| Draft Day Sports: College Football 2026 | $19.99 | Deep playbooks, coordinator careers, adaptive AI; small review base | Blueprint has a stronger web interface and more original world structure, but less proven customization and support |
| College Bowl | $24.99 | Pixel-action football plus dynasty; ~85% positive from 228 reviews | Its on-field presentation and direct player control justify a higher ceiling |
| Bowl Bound College Football | $19.99 | Older, deep management sim; 52% positive from 97 reviews | Depth alone cannot overcome usability, compatibility and support problems |
| Pro Strategy Football 2026 | $24.99 | Pro-football tactical sim with animation, history and customization | Useful upper-price reference once presentation and customer features are complete |
| EA Sports College Football 27 | $69.99 | Licensed AAA presentation and pageantry | Not a direct pricing comp; position as a deeper, fictional grassroots alternative |

Blueprint's mechanics can compete with the $19.99 sims. Its present distribution and
customer protections cannot yet support that price confidently.

## Conditional price targets

**If sold in its current form: $7.99–$9.99 maximum** — reflecting the considerable
content while discounting browser-local saving, no cloud synchronization, no established
support or release channel, no long-term balance evidence, accessibility deficiencies,
and branding uncertainty. Preferred alternative: keep it free and use the current build
as a focused public beta. Charging too early risks reviews that permanently anchor the
game as an unstable browser project.

**Recommended Early Access target: $12.99–$14.99** (preferred entry $14.99), conditional
on: versioned, recoverable save files with multiple slots; automatic backup and
corruption recovery; a clear save-migration policy between builds; Steam Cloud or
equivalent when packaged; at least 25–50 season automated soak tests; public support,
bug-report and changelog channels; brand/name resolution; the accessibility blockers
corrected; a desktop package or exceptionally clear PWA installation experience. A free
exhibition/demo is especially valuable because it already exists and showcases the
tactical engine immediately.

**Sustainable 1.0 target: $17.99–$19.99**, after: full multi-decade balance
verification; proven recruiting, portal and coaching-carousel equilibrium; achievements
and reliable platform integration; cloud saves and multiple careers; a polished
first-hour tutorial; crash reporting and customer support; strong store media and a
comprehensible feature pitch; several months of player feedback and positive review
evidence.

**$24.99 ceiling** only with several of: league/conference/team editors, logo/uniform
customization, custom play creation or extensive playbook tools, workshop/mod support,
more expressive on-field presentation, robust historical exports and universe tools,
cross-platform desktop builds, exceptional post-launch support. At present, $24.99 would
invite direct comparison with College Bowl and mature desktop simulators in areas where
Blueprint is not yet equally equipped.

## Release blockers (as originally stated)

### 1. Save durability

The game explicitly says the dynasty "lives in this browser." Manual JSON export is
useful, but paid players will expect protection from browser clearing, private mode,
storage eviction, device loss and bad migrations. Required minimum: multiple named
saves; rolling automatic backups; a visible last-saved timestamp; save schema versions
and migration tests; recovery from an interrupted write; prominent backup warnings
before destructive actions; cloud synchronization in a desktop release.

### 2. Long-horizon simulation validation

The first hour feels deep, but sports simulations are judged after ten seasons. Create
automated reports for: scoring, yards, sacks, turnovers and penalties by division;
recruiting class strength and geographic distribution; transfer volume and roster
attrition; player progression by position and potential; talent concentration and
competitive parity; staff salaries and program-budget inflation; coaching promotions,
dismissals and vacancy resolution; upset frequency, home advantage and difficulty
effects; championship diversity over 25, 50 and 100 seasons. Publish at least some
tuning methodology — that creates confidence without revealing the coefficients
intentionally hidden from players.

### 3. Accessibility defects

Concrete issues found: the coach-name inputs use placeholders without programmatic
labels; save, home and delete controls expose only symbols such as 💾, ⌂ and 🗑; the
exhibition setup remained in the accessibility tree after kickoff, alongside the
live-game interface; several information-dense tables depend heavily on horizontal
scanning; small secondary text and all-caps type could become tiring during long
sessions. Inactive screens should be removed from the accessibility tree, icon controls
need meaningful names, and the full product needs keyboard-only, focus-order, zoom and
screen-reader passes.

### 4. Branding and discovery

The public repository has 91 commits but no description, README, topics, releases or
visible adoption, and reports zero stars and forks. The deployed game is considerably
more impressive than its public footprint suggests. Before release, create: a distinct,
searchable final title; a one-sentence positioning statement; trailer and gameplay GIFs;
feature page and screenshots; support/contact information; privacy policy and EULA where
applicable; public changelog and known-issues page; store-ready description, capsule art
and demo.

### 5. Build and operational cleanup

The entire game is a 2.58 MB monolithic index.html. [Verified 2026-08-10: this is the
deliberate build artifact of 81 source modules, not tech debt — see punch list.] Also
observed: home screen build ID `b8c2db1a1b` vs service-worker cache
`cfb-dynasty-c219379683`. [Verified 2026-08-10: not a defect — this is the stale-build
diagnostic correctly reporting a device mixing builds mid-deploy; see punch list.]

## Recommended release decision

Do not call this 1.0 yet. Call it a public beta, resolve the brand immediately, and make
the next milestone a $12.99–$14.99 Early Access launch after the critical save,
accessibility and simulation-validation gates.

The product's best eventual position: $14.99 Early Access; $19.99 at 1.0; free
exhibition/demo; no microtransactions; a promise built around the coaching-family world,
not generic "deep dynasty simulation." That pricing places it below the more visually
complete $24.99 games while communicating that it is far more substantial than a $5
browser diversion.
