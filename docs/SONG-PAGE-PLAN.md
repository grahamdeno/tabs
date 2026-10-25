# The song page plays the show (plan, 2026-10-24)

Graham's ask: no separate Gig screen. Play on the song page hides everything from the chord diagrams up and
shows the count-in (Louie jumping on each beat) and the audience; the bottom buttons become listening and
Pause. One Tools sheet. The drums go. Then the economy, celebrations, a better way to get songs in, a weather
idea, and an accessibility pass.

Nothing here is built until Graham confirms the decisions below.

## Decisions for Graham

- D1. Each Gig capability (list below): keep on the song page, or drop.
- D2. Beat choice: Off (default), Bass drum, Metronome. Where it lives: the Metronome row in Tools becomes
  this three-way choice (the Band row goes). Volume moves to Settings > Playing.
- D3. Beat the drummer still joins your band as a friend, with no drums to play. Or he leaves the roster.
- D4. Fans and tips (see Step 5): yes or no.
- D5. Getting songs in (see Step 6): build Add to The Road, then remove AI Line up and the AI chord chart?
- D6. The weather idea (see Step 7): yes or no.

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

### Step 5 [Opus] 4.70.0: fans and tips (if D4)
- Fans are your reputation and are never spent: practice and lessons earn fans, shows earn fans.
- Tips are money and only shows earn them, more with a bigger crowd and a longer run.
- Merch costs tips. Unspent fans today convert to tips once, so nothing bought or saved is lost.
- XP stays behind the weekly chart only.

### Step 6 [Opus] 4.71.0: Add to The Road (if D5)
- A one-time Shortcut for the iPhone share sheet. In Safari on an Ultimate Guitar (or other chord site)
  song page: Share > Copy for The Road. It reads the chart from the page you are looking at (your own
  browser, so the site doesn't block it) and copies it clean, chords and words exactly as the site has them.
- In The Road: one Paste button (Songbook, and Edit for a song you have) adds it. A web app on the Home
  Screen can't be opened with data by a Shortcut, so the paste is the one extra tap.
- Then remove AI Line up from the chord sites and the AI chord chart; LRCLIB stays for the timed words.

### Step 7 [Sonnet] 4.72.0: the weather (if D6)
- Tonight's venue follows your weather: a clear evening is an open-air show, rain moves it indoors to a club.
  A big swing in humidity or temperature since your last play says to tune up first.

### Step 8 [Opus] 4.73.0: accessibility and v3 leftovers
- axe and a manual check on every page and every sheet in all three palettes; fix what fails (first known:
  the faint bullet text in the search tip).
- Find and remove controls left from version 3 (a navigation button Graham has seen).

## Surprises
