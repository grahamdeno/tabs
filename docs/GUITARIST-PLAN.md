# Your guitarist (4.85.0)

Written by Opus, 2026-10-30, for Sonnet to run. One minor release, 4.85.0 (Graham prefers one big release).
Graham saw the mockups and said go.

The mockups are in `docs/guitarist/`: `tour-dark.jpg` and `tour-light.jpg` (the approved direction: one guitarist
at the Garage, the Club and the Arena, moods that mean something, the three-tap Opening night picker) and
`builder-dark.jpg` (the first round: eight starters, the full maker, the player card, chart and duel). The drawing
code they were made with is `docs/guitarist/mock-guitarist.mjs`: start from it, don't redraw from this text.

## What changes

Louie stays the mascot (the Road's bubble, cheering at the end of a gig, Opening night's guide). Wherever the app
means **you**, it shows your guitarist instead: drawn in Louie's style (flat colour, a soft darker side, Louie's
round eyes with a highlight, mitten hands, the same moods and poses), built from parts.

**Your guitarist is your tour.** The big looks are earned on the Road, not bought:

- **The look follows the venue** you've reached (the highest, so a fade never takes it back).
- **Patches** on the top for what you've done: a patch for each leg headlined (in that guitar's colour) and your
  profile badges (gigs, streak, chords, song written, duel won...). Up to five worn; the newest by default.
- **The guitar in your hands is the Road guitar you're on,** as a small version of the real one.
- **Moods carry meaning:** sleepy when tonight ends your streak, worried in a duel you're losing, horns up after
  a headline. Happy otherwise.

## Decisions (Opus made them; Graham can change any before Step 1)

1. **Looks by venue** (`VENUES` in core/turf.js): Garage and Open mic, a tee; Coffeehouse and Club, the denim vest
   over the tee; Theater and Arena, the leather jacket; Stadium and Festival headliner, the stage jacket (black, gold
   trim, studs). The top's colour stays yours.
2. **Opening night** gets a first step, "Who's playing tonight?": a starter, a skin tone, a hair colour, THAT'S ME
   (bottom, thumb reach). No fans for it. A player past Opening night meets the picker once, as a sheet on the
   Road (Louie introduces it), the same way the new-guitar sheet shows.
3. **Free:** every starter, skin tone, hair style and colour, beard, glasses, and the top's colour. **The Merch
   table** sells hats (beanie, cap, bandana) at 150 tips each, colour free once bought. Stage looks, patches and
   pins can't be bought.
4. **No names on starters.** Once picked, it's you; the eight are quick starting points.
5. **Lefty:** a switch in the maker that mirrors the guitarist (the guitar in the other hands). Off by default.
6. **Rivals get guitarists too:** a computer rival's look comes from its name (seeded), at its tier's venue look,
   so the weekly chart reads as a room of players. Friends you duel keep their initial until a shared link can
   carry a look (Open, below).
7. **Small sizes** (chart rows, the friends board, about 40 px): the head and shoulders only, the newest patch only.

## Steps

### Step 1. The data and the numbers, pure and tested [Sonnet]

- [ ] 1.1 `data.me = { skin, hair, hairCol, beard, extra, extraCol, top, lefty, patches }` (skin 0-5; hair, colours
      and extras by id from the mock's tables; `patches` the ids chosen to wear, optional). `cleanMe(raw)` in
      core/game.js, wired into both save/load sanitizers in core.js the way `cleanGuitars` is. Into the backup.
- [ ] 1.2 core/game.js: `ME_STARTERS` (the mock's eight, without names), `ME_DEFAULT`, `meOf(data)` (data.me or the
      default), `stageLook(data)` ("tee", "vest", "leather", "stage" from the highest ring reached, decision 1),
      `patchesOf(data)` (legs headlined from `roadPath`, then `badgesOf(...).got`, newest first; `data.me.patches`
      picks which, at most five), `meMood(data, now)` ("sleepy" when the streak ends tonight, "cheer" for the day
      after a headline, else "happy"; duels pass "worried" themselves), `rivalMe(name, tier)` (seeded).
- [ ] 1.3 Re-export from core.js (import and export lists). docs/DATA.md: `data.me`.
- [ ] 1.4 Unit tests: cleanMe keeps good fields and drops bad ones; looks change at the right venues and don't
      drop after a fade; patches order and the five cap; rivalMe is stable for a name; a backup keeps `data.me`.

### Step 2. Draw the guitarist [Sonnet]

New file `guitarist.js` at the root (add to `SHELL` in sw.js). Start from `docs/guitarist/mock-guitarist.mjs`.

- [ ] 2.1 `guitarist(me, { mood, pose, size, crop, look, patches, guitar, label })` returns an `<svg>` string,
      like `louie()`. Moods: happy, cheer, worried, sleepy, proud. Poses: play (holding the guitar), hornsUp,
      rest. Crops: full, bust. Unique ids for clip paths (the mock's counter).
- [ ] 2.2 Looks: tee, vest (the mock's "denim"), leather, stage. Hair: the mock's eight plus long, locs, pixie and
      ponytail. Facial hair: none, stubble, moustache, beard.
- [ ] 2.3 The guitar: a small version of each Road guitar (`GUITARS` in core/game.js: its finish, its shape family:
      acoustic with a soundhole, offset, hollow with f-holes, single cut, the headliner with gold edge), not the
      mock's generic shape.
- [ ] 2.4 Lefty mirrors the whole figure; the face's darker side stays on the right.
- [ ] 2.5 Patches: the mock's leg patch, star and pin, plus one patch per badge kind (song, show, streak, chord,
      venue, band, chart) in the badge colours. On the full figure only; the bust shows the newest one.

### Step 3. Where you show up [Sonnet]

- [ ] 3.1 Your profile: the player card and the share card (profile.js) show your guitarist, `meMood`, hornsUp on
      the share card. An "Edit" on the card opens the maker.
- [ ] 3.2 Charts (charts.js): your row's avatar, the rival battle's "You" side; rivals get `rivalMe` busts.
- [ ] 3.3 Duels (duel.js): your side of a duel (worried when you lost), your row on the friends board.
- [ ] 3.4 Leave Louie everywhere else (the Road, gig end, callouts, tips, Opening night's guide, the Band tab).

### Step 4. Making your guitarist [Sonnet]

- [ ] 4.1 Opening night: a first step "Who's playing tonight?" (`OPENING` in core/game.js, opening.js): the preview,
      eight starters (2 rows of 4), skin, hair colour, THAT'S ME at the bottom, the line "Hair, glasses and the rest
      are on Your profile, any time." Counts as the step done; no fans.
- [ ] 4.2 Players past Opening night: the picker once, as a sheet on the Road (`data.me` absent), after the
      headliner and new-guitar sheets; Louie says "Who's playing tonight?". Skip leaves the default.
- [ ] 4.3 The full maker from Your profile: starter, skin, hair, hair colour, facial hair, glasses, hats (owned
      ones, the rest locked with their price), top colour, patches to wear (pick up to five), lefty.

### Step 5. The Merch table [Sonnet]

- [ ] 5.1 `MERCH` items of a new kind "wear": beanie, cap, bandana at 150 tips (decision 3). Bought ones show in
      the maker. Try it on (the Merch table's existing preview) shows your guitarist wearing it.

### Step 6. Tests and release [Sonnet]

- [ ] 6.1 e2e: Opening night's first step picks a starter and saves `data.me`; the Road sheet shows once for a
      player without it; the profile card, a chart row and a duel side show the guitarist (an `svg` with
      `aria-label="Your guitarist"`), Louie still on the Road; the maker saves a change; a hat bought on the Merch
      table appears in the maker. axe must pass (the maker's choices are labelled buttons).
- [ ] 6.2 `VERSION` 4.85.0 and `CACHE`; README (Your profile, Opening night, Merch table), docs/ONBOARDING.md (the
      new Opening night step, the maker, patches), CLAUDE.md (`guitarist.js` in Where things are; Version 4: your
      guitarist where the app means you, Louie the mascot everywhere else).
- [ ] 6.3 One commit per step, `eslint .` and `node tests/quick.mjs`, rebase. **Push only when Graham says ship.**

### Step 7. Feel check [Opus]

- [ ] 7.1 Screenshots in Dark and Light: the guitarist at the Garage, the Club and the Arena; the profile card,
      the chart, a duel; the Opening night step on a phone. Next to the mockups. List fixes for a patch.

## Open (not this release)

- A friend's guitarist on the friends board and in duels: a challenge link carries your look (share.js), so the
  friend sees you, not an initial.
- Your band on stage: your guitarist with Louie's friends behind you on the Gig's backdrop.
- Seasonal looks (a tour shirt for the month's tour quest).

## Surprises

(Write here when something doesn't match the plan.)
