# Plan: Get the song shows its progress, and finds the recording (4.57.0)

Written by Opus, 2026-10-24, from Graham's screenshot of Get the song working on "Mr. Jones". One release,
run with Sonnet. No mockup (Graham: build it).

## What Graham asked for

- While Get the song works, find the Apple Music recording too and save it with the song.
- Make the state of the whole job obvious at a glance. Today the lamps are small, done and working look
  alike (the working lamp is the darker one), and the slow last step looks stalled.

## Decisions (defaults set; Graham can change them after trying it)

- D1. The recording is saved automatically only on a clear match (`rankTracks` score >= 6, title and artist
  both match, and the length within 10 s of the lyrics' recording when there is one). A weaker best match asks
  "Use this recording?" on the review screen with Yes and No. No match: "Not found", nothing saved.
- D2. On an iPhone the search goes through MusicKit (`searchApple` in listen.js), which needs Apple Music on in
  Settings > Keys. Off: the row says "Turn on Apple Music to find it" and is skipped. No Worker change.
- D3. Each step's share of the bar comes from how long it took the last few times on this phone (a rolling
  average kept in `data.settings.gsTimes`), starting from: chords 12 s, lyrics 3 s, tempo 3 s, recording 3 s,
  lining up 22 s. Steps that run at the same time share the same stretch of the bar.
- D4. The bar never reaches the end before the job is done; while a step runs past its estimate it eases on
  toward that step's end and stops just short of it.
- D5. Done: the bar fills and turns green for a moment, then the review screen opens as today (its Add
  button is the next thing to tap).

## Steps

### Step 1. Find the recording [Sonnet]

- [ ] 1.1 In findai.js `getSong`, add a row `rec`, "Finding the recording", that starts as soon as the title
      and artist are known (where `head()` already searches for the cover). Off an iPhone use `itunes("search")`
      and `rankTracks` as `head()` does (reuse that one request; don't search twice). On an iPhone use
      `searchApple` from listen.js, extended to return the link (`attributes.url`), the length
      (`durationInMillis`) and the cover (`artwork.url` with `{w}x{h}` as 600x600). Keep its old callers working.
- [ ] 1.2 Note on the right: the length found ("4:33") or "Not found" or "Turn on Apple Music to find it" (D2).
- [ ] 1.3 On a clear match (D1), `add()` saves it as `song.listen = { url, service: "apple", art, length }`, the
      same shape `saveListen` in listen.js writes, and the recording's length goes through `useRecordingLength`
      so song length speed works. A weaker match: the review screen shows the cover, title and length with
      "Use this recording?" and Yes / No; Yes saves it the same way. The cover found here also becomes the
      sheet's cover (it already does via `st.art`).
- [ ] 1.4 The kept song (put aside, `setKept` / `restoreKept`) keeps the recording it found.
- [ ] 1.5 Tests (mock the catalog with `page.route`): a clear match is saved with the song; a weak one asks and
      Yes saves it; none says Not found and saves nothing. Unit test for the match rule if it lives in core.

### Step 2. One progress bar for the whole job [Sonnet]

- [ ] 2.1 Under the cover and the level plate: one line saying what is happening and the time left
      ("Lining the chords up · about 20 s left"), and under it a thick bar (10 px, full width, rounded, the
      accent colour on a quiet track). `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`,
      `aria-valuenow`, `aria-valuetext` the same words as the line.
- [ ] 2.2 The bar's position: done steps count their full share; running steps count elapsed / estimate of their
      share, eased so it never passes 95% of it (D4). Drive it from one `requestAnimationFrame` loop while the
      sheet is open (stop it when put aside or closed); never repaint the whole sheet per frame, only the bar's
      width and the line. Reduced motion: update every second, no easing animation.
- [ ] 2.3 Time left: the sum of the estimates still to go minus elapsed, rounded to 5 s, never below "a few
      seconds". When a step runs long, say "almost there" instead of a number that has gone to zero.
- [ ] 2.4 Record each step's real time when it ends and fold it into `data.settings.gsTimes` (D3: average of
      the last 5, each clamped 1 to 120 s). Document the field in docs/DATA.md.
- [ ] 2.5 Done (D5): the bar fills, turns `--got` green for 400 ms, then the review screen as today.

### Step 3. Rows you can read at a glance [Sonnet]

- [ ] 3.1 Replace the lamps (`ROW` in findai.js):
      - working: the whole row on a band edge to edge in the accent colour at about 16% (like the line you're
        on when a song plays), a turning ring 18 px, the label in full ink;
      - done: a check mark in a filled circle (`--got`), the result on the right as today;
      - waiting: a hollow grey circle, the label muted;
      - not found / skipped: a dash, the note says why.
      Never colour alone: each state has its own shape.
- [ ] 3.2 Order the rows the way the job runs: Working out the chords, Finding the lyrics, Finding the tempo,
      Finding the recording, Lining the chords up with the lyrics.
- [ ] 3.3 Each step that finishes is said once in a polite live region ("Tempo found: 144 BPM").
- [ ] 3.4 Reduced motion: the ring doesn't turn (it pulses its opacity once a second, or stays still).
- [ ] 3.5 Contrast: the label on the band and the check mark 4.5:1 or better in all three palettes (the
      throwaway script from the Chord Catch work).

### Step 4. The bar when it's put aside [Sonnet]

- [ ] 4.1 `paintKept` (the "still getting it" bar above the search bar): a thin progress line along its bottom
      edge and the time left in its small text ("Getting it · about 20 s"), from the same numbers as the sheet.
      Update it about once a second, not per frame. When it is ready it reads as today ("ready").

### Step 5. Copy and release [Sonnet]

- [ ] 5.1 The foot note: "The song's name goes to the AI" (it says "go" today). Mention the recording:
      "...and Apple's catalog is searched for the recording."
- [ ] 5.2 README (Get the song): the recording row, the bar and the rows. ONBOARDING.md if a tip or a hidden
      feature changes (probably none). DATA.md: `gsTimes`.
- [ ] 5.3 Tests: the bar exists with role progressbar and moves; the working row has the band class and the
      done rows a check; the a11y test covers the Get the song sheet while working (mock the AI and the catalog).
- [ ] 5.4 Bump to 4.57.0 (VERSION and CACHE). `eslint .`, `node tests/quick.mjs`, fetch and rebase, push `main`.
- [ ] 5.5 One screenshot for Graham of the sheet mid-job at 390 px (throwaway `zz_` test, then delete it).
- [ ] 5.6 Move this file to `docs/history/`.

## Things to watch

- `appleBlocksSearch()` is true on an iPhone; tests run as a desktop browser unless the user agent is set.
  Cover both paths: set an iPhone user agent in one test and mock MusicKit's search there, or test the
  iPhone path through `searchApple`'s result handling directly.
- Don't save a recording for a song the AI couldn't find (no chart): the row waits on the chart's title and
  artist, not the search words typed.
- A recording saved here changes what Play does (it plays the recording, D1 is why the bar is high). Check
  that "When you press Play" in About this song shows With the recording afterwards.
- Keys stay on the phone; nothing here sends a key anywhere new.

## Surprises

Written at the end of the build (2026-10-24):

- One catalog search (`recFind`, per title and artist) now serves the cover, the preview and the recording row;
  `head()`'s own search was folded into it, and on an iPhone the cover now also comes through MusicKit when
  Apple Music is on.
- `searchApple` returns iTunes-shaped results with the link, length, cover and preview added, so `rankTracks`
  ranks both paths the same way. The Songbook's caller is unchanged.
- At the start, the chords and the lyrics search are both working (the lyrics search starts early), so two rows
  can sit on the band at once.
- A crash was found and fixed while testing: the frame loop's variable was declared after the early return for
  a restored song, so adding a song from the "is ready" bar after a reload threw. It is now declared with
  `alive` at the top.
- The step 3.5 contrast script was not run; the label on the band is full ink on a 16% accent wash, and the
  check is the caught-green token already checked for Chord Catch. The step 5.3 a11y run on the sheet was not
  added.
