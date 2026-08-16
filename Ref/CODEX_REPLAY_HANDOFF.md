# Codex — replay-clip home for Act B (2026-08-13)

Act A merged cleanly with the Creator/Season work — the two lines auto-merged with
**zero conflicts** (app.js / style.css / manifest edits sat in different regions).
Both sides' probes are green together on the merged tip.

## First: fast-forward to the converged line

Your `codex/viewer2-a1` (`747aa45`, Act A) is an ANCESTOR of the merged
`source`, so this is a clean fast-forward, no cherry-pick:

- Bundle: **`C:\dev\Blueprint\blueprint-source-converged-actA-creator.bundle`**
  (complete history; SHA-checkable).
- `git fetch <bundle> source:source-converged` then fast-forward
  `codex/viewer2-a1` to it. Tip = the merge commit; it contains your full Act A
  **plus** the Season-Mode engine, all four Creator editors, the Film Room, and
  the CSS fix.

Base Act B off this converged tip.

## The replay-clip home (what Act B saves to)

Saved clips have a real home now — a **dedicated store**, `js/engine/replays.js`,
kept separate from the config library (`cfb-creator`) so big clips can't crowd out
playbooks/teams. It has the same tolerant-read + two-generation backup ring as
saves. **The store never inspects the clip data — the shape is yours.**

API:

```
saveReplay(name, data, { id?, info? }) -> { ok, id } | { ok:false, reason }
listReplays()                          -> [{ id, name, saved, info, v }]  (newest first)
getReplay(id) / loadReplayData(id)     -> the entry / a DEEP CLONE of .data
renameReplay(id, name) / deleteReplay(id)
```

- `data` = your clip payload (frames / whatever the viewer needs to replay it).
- `info` = optional display metadata the Film Room shows: `{ matchup, score, week }`.
- `loadReplayData` returns a deep clone, so playback can't mutate the stored copy.
- Cap is 60 clips; `{ ok:false, reason:'full' }` past that.

## Playing a clip — the one hook you register

The **Film Room** (Workshop → Film Room, `js/ui/views/creatorreplay.js`) lists
clips with a ▶ Play button. Playback is YOURS: when the user clicks Play, the
Film Room loads the clip and calls

```
window.__playReplayClip(clipData)
```

Register that function from the viewer to start playback (navigate to your replay
surface, feed it `clipData`, etc.). Until it's registered, Play shows a friendly
"lands with the next viewer update" notice — so the home works today and lights up
when you wire the hook.

## Storage note

Clips can be large; the store is on `localStorage` for now. If clips outgrow the
quota, the backend swaps to IndexedDB **behind the same API** — none of your
`saveReplay`/`listReplays` calls change. Keep individual clips reasonably compact
and we're fine for a good while.

## Coordinate files (unchanged rules)

`app.js`, `style.css`, `tools/_gate_manifest.mjs` are shared. They merged cleanly
this round because both of us kept edits additive and regional — keep doing that.
Claude owns the Creator/Season screens + `js/engine/replays.js`; you own the
viewer + the playback hook + your clip format.
