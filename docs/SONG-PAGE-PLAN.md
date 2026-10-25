# The song page plays the show (plan, 2026-10-24)

Graham's ask: no separate Gig screen. Play on the song page hides everything from the chord diagrams up and
shows the count-in (Louie jumping on each beat) and the audience; the bottom buttons become listening and
Pause. One Tools sheet. The drums go. Then the economy, celebrations, a better way to get songs in, a weather
idea, and an accessibility pass.

Order and models agreed 2026-10-24: Graham wants as many releases as can be done well, one after another.

## Decisions (Graham, 2026-10-24)

- D1. Capabilities: keep 1 to 7, 9 to 12, 14 to 17. Drop 8 (Louie's moments) and 13 (the backdrop behind the
  show). 18: the page's own Back, already there.
- D2. The Metronome row in Tools becomes Off / Bass drum / Metronome, Off by default. The Band row goes.
- D3. Beat stays in the band, not playing for now (he may come back with a part).
- D4. Tips: yes. Fans fade when you neither practice nor play (rate in Step 5).
- D5. Not the Shortcut: getting songs in has to happen inside the app. Step 6 is open, see below.
- D6. Weather: both ideas yes; mockups first.
- D7. Backdrops move to the Show complete sheet: the one you wear is the banner behind Louie and the band, with Change.
- D8. Getting songs in, inside the app: search finds the song on Apple Music and links to the chords for your level; coming back, The Road offers Paste at once and confirms what it added. Also Scan a page (camera) and Sing it (redesigned). Timed scrolling to the recording stays.
- D11. Get the song's chord placing and Line up from the chord sites stay until paste has been used for two weeks; then Graham decides on removing them. Tempo lookup stays (GetSongBPM first, the AI only as fallback). The AI groove and drums code stays for Beat's return.
- D12. Losing a venue is in: fans that fade can take you back a venue (Step 5).
- D13. Reuse what exists: the Songbook's paste card is the paste flow to build on.
- D10. Graham (2026-10-24): never remove a feature or an AI capability without asking him first. Keep the AI wherever it's needed, and make it better. Each AI feature's fate is his call (list in Step 6).
- D9. Weather: Tune up first on the song page only (the venue ideas are out).

## The Gig's capabilities, where each goes

1. Section name at the top (Stage Gel colour, COUNT IN during the count): a small pill on the page's top edge.
2. Chords in a row ("12 in a row"; "9 of 11" in Wait for me): beside the section pill.
3. The crowd (12 fans that stand up): the audience row in the space the header leaves.
4. Hearing you (mic on/off, level bars, no-mic state): the left bottom button while playing.
5. Pause: the right bottom button while playing (Play while paused).
6. Wait for me: the pill, the Waiting for G card with its shape, and Skip this chord.
7. NOW/NEXT shape for a chord you haven't learned: small card at the side, as now.
8. Moments: Louie pops in at 5, 10, 15... in a row and when the whole crowd is up.
9. COMBO x10/x25/x50/x100 bursts.
10. Chord Catch on the sheet (green caught, missed marked): stays, it already lives on the page (stage.js).
11. Dragging the song doesn't count chords.
12. Controls fade after 3 s without a touch.
13. The merch backdrop behind the show.
14. Paused: Louie's line above Play (Opening night uses it).
15. Show complete: fans, crowd and chords tiles; the song you played; missed most with Practice it; rival
    battle; band joins; duel reply and Challenge a friend; Double set; cover and request quests; Opening
    night; quest fans; songs you can play; streak; something you can now buy; Encore (2x bonus fans);
    Continue (back to the Road, Tour or Charts when you came from there). Becomes a sheet over the page.
16. Screen-reader announcements (waiting for a chord, crowd count).
17. Score my plays (Settings) and Opening night's hooks into the show.
18. X to leave the show: replaced by the page's own Back.

## Steps (one release each, stop after each for Graham)

### Step 1 [Opus] 4.66.0: the song page is the show
- Play hides the header, meta row and chord diagrams (they slide up) and shows the audience row; Pause
  brings them back. The dock swaps Tools/Play for Hearing you/Pause while playing.
- Move each confirmed capability from gig.js onto the page; gig.js keeps the scoring and Show complete,
  without its own screen. Tools opens from the page only; nothing in Tools depends on "in a gig".
- Opening night, Tour, Charts and duels start a play on the song page instead of opening a Gig.
- Tests: gig.e2e.mjs rewritten for the page; axe on the playing page.

### Step 2 [Sonnet] 4.67.0: the count-in
- Louie jumps on each beat, horns up and a small headbang on the last; the beat number pops with him.
- The recording is queued when the page opens (it already is). Play is called early by the measured start
  delay so the first note lands as beat 4 ends, not half a second after. The metronome starts on the same
  beat.

### Step 3 [Sonnet] 4.68.0: no drums
- Beat choice Off / Bass drum / Metronome, Off by default (D2). Remove the drum kit, AI-written drums,
  grooves, the Band sheet and the Band row. Beat as D3. Old settings map: drums becomes Bass drum.

### Step 4 [Sonnet] 4.69.0: celebrations
- A comic-book POW burst for what was earned (fans, tips, streak, a band join), with Louie's speaker
  pumping to the beat, at Show complete and on the Road when a reward lands. Short, skippable, respects
  Reduce motion.

### Step 5 [Opus] 4.70.0: fans and tips (D4)
- Fans are your reputation and are never spent: practice and lessons earn fans, shows earn fans.
- Fans fade when you neither practice nor play: none for 2 days, then 1% a day. Fans below a venue's line
  take you back to the venue before, with a warning a day ahead on the Road. Bought things stay. A Rain
  check covers a day.
- Tips are money and only shows earn them, more with a bigger crowd and a longer run.
- Merch costs tips. Unspent fans today convert to tips once, so nothing bought or saved is lost.
- XP stays behind the weekly chart only.

### Step 6 [Opus] 4.71.0: adding a song, the AI picking the chart (D8, D10)
- Search: the Apple Music match, a level choice (Beginner, Intermediate, Advanced) and Get the chords. The
  AI's web search (`findChart` already takes a level) picks the best-rated chart for that level and returns
  its link, so Get the chords opens that chart, not a results page.
- Coming back: if the last thing you did was Get the chords, a sheet offers Paste right away (iOS asks once
  more with its own Paste button). The AI's Clean up tidies what was pasted; the song is added and the sheet
  says what it added.
- Scan a page (camera, AI) stays. Sing it gets a design pass (mockups first).
- Every other AI feature stays as it is unless Graham decides otherwise: the AI chord chart, Get the song's
  chord placing, Line up from the chord sites, Play next, tempo lookup, Make it easier, Spark tone, language
  practice. The groove and AI-written drums go with the drums only if he confirms.

### Step 7 [Sonnet] 4.72.0: Tune up first (D9)
- On the song page, when humidity or temperature has swung a lot since your last play: Louie, the two
  changes, Not now and Tune up (opens the tuner). Once a day at most.

### Step 8 [Opus] 4.73.0: accessibility and v3 leftovers
- axe and a manual check on every page and every sheet in all three palettes; fix what fails (first known:
  the faint bullet text in the search tip; on Show complete the New chord card covers the title and a band
  member covers the Crowd tile).
- Find and remove controls left from version 3 (a navigation button Graham has seen).

## Surprises
- Steps 1 and 6 were built together and shipped as 4.67.0 (4.66.0 is the song page part, in the same commit): they touch the same files.
- Step 1: the Gig was already see-through over the song page (4.51.0), so the friction was the second set of controls: its own X, Tools hiding Practice and the Song tab in a show, most Tools rows ending the show, and Continue on Show complete leaving for the Road. All four are gone; the page's Back returns to where the show started (Road, Tour, Charts). Louie's moments and the backdrop over the show are out (D1); the backdrop is the Show complete banner (D7).
- Step 6: the paste-back sheet already existed (`pendingFind`, a small banner on the Songbook only). It is now a bottom sheet on any page but Edit or a show, and adds a chord sheet straight away. The AI names a chart page and its rating from its search results; a link that isn't on a known chord site is not opened. The catalog row's old action (Get the song, or Start a sheet without a key) is kept inside the sheet.
- Step 2 (4.68.0): Louie had never jumped: the CSS looked for `.beat` inside `.so-lou`, but the class is on `.so-lou` itself. The recording's start delay is measured from play() to its clock moving; it starts at 300 ms until measured.
- 4.69.0 to 4.71.0 shipped as planned (beat, fans and tips, POW). Surprise in 4.71.0: the Gig's callouts and the app's ran in two copies of callout.js (one loaded with ?v=, one without), so two could show at once; the Gig now uses the app's.
