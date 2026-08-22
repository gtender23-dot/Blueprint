I'm working on a college football dynasty game called **Blueprint** (working
title — the name is one of the things I want to talk about). It's at
`C:\dev\Blueprint` on my Windows machine, and this session should have access to
that folder.

**Important: I don't speak code.** Explain things in plain language and don't
assume I know git, build tools, or web hosting terms. If something needs a
command typed, give me the exact line to type and tell me what it does first.

**What the game is:** a browser game (a PWA) that builds into one big
self-contained HTML file. Vanilla JavaScript, ~80 source files under `js/`,
bundled by a build script into `dist/index.html`. It's playable, I've played
plenty of full seasons, and I'm aiming at **paid early access**.

I want to cover three things, in whatever order makes sense:

---

**1. The name.**

"Blueprint" is the working title and I'm not sure it's the one. I want to think
through options and land on something.

Some groundwork that's already been checked, so we don't guess at the cost:

- The name appears in very few places: `index.html` (page title and loading
  screen), `js/ui/logo.js` (the logo's label), a comment in `sw.js`, plus the
  GitHub repo name and the deploy zip's filename.
- **Save files are safe.** Everything the game stores in the browser is keyed
  `cfb-*` (`cfb-dynasty-`, `cfb-creator`, `cfb-replays`, `cfb-trees-v`,
  `cfb-coaches-v`, `cfb-seasonmode`). None of it is keyed to the product name,
  so renaming will not break anyone's saves.
- There's already an **inconsistency worth fixing either way**: `manifest.json`
  — the file that names the app when someone installs it to their phone home
  screen — currently says **"Dynasty CFB"**, not "Blueprint." So the game
  already has two different names depending on where you look.
- Elsewhere in the code, "Blueprint" also refers to an internal *feature* (an
  old setup-wizard step). Those are unrelated to the product name and shouldn't
  be swept up in a rename.

I'd like help thinking about the name itself — what it should evoke, whether
it's searchable, whether anything similar already exists — and then a clean
checklist of every place it has to change.

---

**2. How my code and my website are organized. This is the part I understand
least.**

Current setup, as best I understand it:

- One GitHub repo. Two branches: `source` holds all my code, `main` holds the
  live website (GitHub Pages serves the game from there).
- My build produces `blueprint-pages.zip` — seven files — and that zip is what's
  supposed to go onto `main`.
- `dist/` and the zip are gitignored, so built output stays out of my source.

**The problem I hit:** I pointed my `C:\dev\Blueprint` folder at `main` and git
wanted to commit ~2100 files to it. I was told the cause is that switching
branches doesn't remove my source files from the folder, so git offered to add
all of them to the website branch — where they don't belong.

The advice I got was: never point that folder at `main` again, and instead
upload the seven files through the GitHub website in my browser when I want to
deploy. That sounded fine but I don't really understand the shape of any of it,
and I'd like to actually understand it rather than follow steps.

I'd also like to know whether I should split this into two separate repos, or
set it up so GitHub rebuilds and deploys the site by itself when I push. Explain
the trade-offs in plain terms and help me pick.

Also: there's an old folder `C:\dev\blueprint-test` I think I can delete —
worth a sanity check that nothing depends on it.

---

**3. Getting generally better organized.**

Things I know are messy:

- `Ref/` has ~110 design and audit documents, including a `STATUS.md` that's
  over 400KB. I don't know what's still true in there versus what's stale.
- `tools/` has 239 automated checks registered in a gate that runs them. That
  part is in decent shape, but the folder also collects one-off diagnostic
  scripts.
- My repo root has loose screenshots, log files, and old `.bundle` files sitting
  next to real source.
- I have ~100 commits of history and no real release notes.

I'd like a sane structure I can actually maintain, and a plan for what to
archive, what to delete, and what to keep current — sized for one person, not a
team.

---

**Please start by asking me questions rather than assuming.** I'd rather answer
a few things up front than get a plan built on a guess. And if you need to look
at the actual files to answer something, do that instead of speculating.
