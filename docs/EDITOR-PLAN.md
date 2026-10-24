# Chord editor plan: place chords the way Ultimate Guitar does (after 4.62.1, 2026-10-24)

Graham compared Desperately Wanting on Ultimate Guitar (UG) with The Road (2026-10-24, two screenshots). UG is right and The Road is wrong, and he can't fix it in the editor: he can't put several chords right next to one another, and he can't put chords over spaces with no lyrics. Drafted by Opus, run by Opus then Sonnet, one release per step.

Tick a task's box in this file in the same commit that does it.

## What Opus found

- **The page can already draw it.** A probe sheet written the UG way (`F Am G` over a line, then the words indented past them, a chord after the last word, a line of chords alone) draws correctly: the three chords stacked before the words with dashes under them, the trailing F, the spread-out chord-only row. The sheet is not the problem, and typing the text in Edit > Text view works today (but it's a monospace puzzle on a phone, one-handed).
- **The tap-a-word editor can't make it.** In `editor.js` (`paintSheet`, near line 255) each word is one button, and `setChordAt` (`core.js`, near line 1088) replaces the chord at a position. So:
  1. A word with two or three chords shows them joined ("F Am G") in one button, and tapping it edits only the last. There is no "add another chord next to this one".
  2. Nothing exists before the first word or after the last (UG's lead-in `F Am G` and the trailing `F`).
  3. A line of chords alone (a `chords` row: intro, interlude, UG's loose `F Am G`) is shown as plain text (`.ce-other`) and can't be edited. There is no "add a chord line".
- **"The app isn't fixing it" is a second problem.** Get the song and Line them up place one chord per word with a best guess, so a UG-style line like `F Am G` before the words comes out as C on word 1 and Em on word 8. Their chords are right (this song's page shows the capo version, C Em D, which is UG's F Am G five semitones down); the placement is wrong. That one needs the song's text (see "From Graham").

## Decisions (Opus as designer; Graham can change any)

- D1. **Chips, not word buttons.** Every chord on a line is its own tappable chip. Tap a chip: change or remove that chord. A small "+" chip sits after the last chord of a word (and on empty words) to add the next chord right beside it.
- D2. **Three slots per lyric line, always there:** before the first word ("Before the words"), over any word, and after the last word ("After the line"). No lyrics needed under a chord: a lead-in chord lives on the empty space before the first word; the text is indented to make room, as the 4.49.6 lining already does.
- D3. **Chord lines you can edit.** A row of chords alone is a line of chips, each editable, with "+" at the end, and a **Chords** button joins **Line** in the add row of each section so you can add a chord-only line.
- D4. **Thumb reach.** The picker already opens as a bottom panel; keep it. New chips are at least 44 px tall. "Place" stays at the bottom.
- D5. **No new stored fields.** The sheet stays plain text (chords over a line, or `[G]` inline). Nothing to add to docs/DATA.md.

## Rules for whoever runs a step

1. Read CLAUDE.md first. Plain writing with no em dashes, thumb reach, no ring controls.
2. One step per release. Bump `VERSION` in `core.js` and `CACHE` in `sw.js` together (edit only the `const CACHE` line).
3. Tests. `eslint .` and `node tests/quick.mjs` (with `CHROMIUM_PATH`). The quick run only covers files changed since `origin/main`; also run `node --test tests/e2e/editor*.mjs tests/e2e/app*.mjs` for the editor's tests before pushing (CI was red for days in 4.58.0 to 4.61.0 because of this). Then fetch, rebase and push to `main`, and look once at `gh run list -L 1` for this release (Graham's rule to skip it is waived for the editor, because a broken editor loses songs).
4. README and docs/ONBOARDING.md where behaviour changes. Update Undo: every edit goes through `editChange` and must keep Undo.
5. If the code doesn't match this plan, stop and write it under "Surprises".
6. After each step, stop so Graham can try it, and say which model the next step wants.

## Step 1 [Opus] 4.63.0: Placing chords anywhere (pure logic, unit tested)

Where: `core.js` next to `chordModel` and `setChordAt` (near line 1052), `tests/unit` for it (find the file that tests `setChordAt`).

- [x] 1.1 Read how the sheet draws a line (`buildWords`, `parseSheet` in `core/chords.js`) and write down, in a comment, the exact rule that decides which word a chord at a column belongs to, including lead-in chords before the first word and a chord after the last. The editor must use that same rule; do not invent a second one.
- [x] 1.2 `chordModel` returns, for each lyric line, `chords` as before, plus `slots`: the chords in reading order, each with `{ pos, chord, word }` where `word` is the word index it sits on (`-1` before the first word, `words.length` after the last).
- [x] 1.3 New `addChordNear(body, i, after, chord)`: put `chord` right after the chord at `after` (or at the start of the line when `after` is null), on the same word where the word has room and otherwise nudged to the right by one column, never merging two chords into one token. A chord that goes before the first word indents the lyric text by exactly the room it needs (and moves the lyric's other chords with it). Works for chord-line-above and for inline `[G]` lines.
- [x] 1.4 New `setChordLine(body, i, chords)` for rows of chords alone (`kind: "chords"`), and `addChordLine(body, afterLine, chords = ["C"])` which inserts a chord-only row after a line, keeping blank lines and sections as they were.
- [x] 1.5 `setChordAt`: stop using "replace the chord at this position" for the new chip taps; give it a chord index (`setChordNth(body, i, n, chord)` where `n` is the chord's place in the line, `chord = null` removes it). Keep `setChordAt` working for the old callers (the Fit your melody panel).
- [x] 1.6 Unit tests with real text: UG's verse (`F Am G` before the words, then `Passed the road to your house`), a trailing chord, three chords on one word, a chord-only row, inline `[F][Am]word`, removing the middle of three chords, and that each result re-parses to the same chords in the same order (round trip).

## Step 2 [Sonnet] 4.64.0: The editor you can place chords with

Where: `paintSheet` in `editor.js` (near line 255), `pickChord` (near line 549), `styles.css` (`.ce-w`, `.ce-c`, `.ce-line`), `tests/e2e`.

- [x] 2.1 `paintSheet`: draw each lyric line as a row of chips above its words: before-the-words slot, each word with its chord chips and one "+" chip after the last chord of the word, and after-the-line slot. Chords still show over their word, so it reads like the page. Chips are at least 44 px tall and wrap onto a second row only if they must; the line itself never wraps (the 4.51.0 fit applies in the editor too: use the same size).
- [x] 2.2 Tapping a chip opens the picker for that chord (Remove is there); tapping a "+" opens it to add one. The picker's header says what it's doing: "Chord after F" or "Chord before the words". "Place" calls `addChordNear` or `setChordNth` from step 1 through `editChange`, so Undo works.
- [x] 2.3 Chord-only rows (`l.kind === "chords"`): a row of editable chips with "+" at the end, a remove chip when it holds one chord, and a **Chords** button beside **Line** in each section's add row, calling `addChordLine`.
- [x] 2.4 The "Fits your melody" and "Whole line, other ways" panels still work (they use `sketchHelp(song, i, pos)`): pass them the chord's position as before.
- [x] 2.5 Tests (`tests/e2e`, the editor's file): build UG's verse in the editor with taps only (lead-in F, Am next to it, G next to that, then the words), check the saved body equals the UG-style text, then Undo; add a chord-only line; remove the middle chord of three. At 390 wide no chip row scrolls sideways.
- [x] 2.6 Screenshot the editor in Festival and Neon with a throwaway `tests/e2e/zz_*.e2e.mjs`, look at it, delete the file. README (the Edit section) and docs/ONBOARDING.md (a hidden feature: "+ next to a chord adds another", taught by: tip, once, the first time a line has a chord).

## Step 3 [Opus] 4.65.0: Line them up the way UG does

Needs the song's text from Graham (see below). Where: `liningDue`, `placedSheet`, `cleanPlaced`, the lining prompt in `findai.js`.

- [x] 3.1 Diff Graham's current sheet against UG's for this song and write down every kind of difference (chords stacked before the words, chords after the last word, chords with no word under them).
- [x] 3.2 Decide, from the diff, whether the lining prompt or the placement code is to blame (the prompt asks for one position per chord with `word 0` and `after the last word`; check whether the model answered with those and `placedSheet` dropped them, or never used them). Fix the cause, add a test with this song's lines, and write in "Surprises" what was wrong.
- [x] 3.3 Offer, on a sheet the lining changed, the same Undo it has today.

## From Graham

For step 3, open the song, Edit, Text, and copy the whole text into a message (or share the song link). And from UG, the chart text for the same song, if you can copy it.

## Surprises

- Step 1, the drawing rule (1.1, written in the comment above `lineSlots` in core.js): a chord before the first word is a lead when the words are indented 2 or more (LEAD_GAP); a chord inside a word cuts it; a chord over a space rides the next word, except (new in 4.63.0) over a space of 4 or more (WIDE_GAP), where it stands alone. 3 still rides: a 4.49.6 test pins "head   hangs" with C riding hangs. Without the new rule there was no way to keep a chord right after a short word without it jumping onto the next word.
- The API differs from the plan's sketch: `chordSlots(text, chords)` (not a `slots` field on `chordModel`), `addChordNear(body, i, n, chord, at)` where `at = { word, part }` names an empty slot, `setChordNth(body, i, n, chord)`, `setChordLine`, `addChordLine`. All edits only add or remove spaces, so the words never change; an edit that changes nothing returns the sheet byte for byte (tested).
- Step 2: a word's own button stays (`.ce-w`, tapping it adds a chord after the word's last one) so older taps and tests keep working; chords are chips above it. Lines still wrap by words in the editor (the 4.51.0 fit is for playing); nothing runs off the side at 390 wide (tested). A chord added with + beside one on a short word can land on the next word (a chord riding a narrow gap belongs to the word after it, the page's own rule); the chip order shows where it went. The Chords button asks for the first chord instead of adding a blind C. No tip popup: the change is listed in Tips & gestures (a popup per feature was getting heavy).
- Step 3, the diff (3.1). The Road's sheet (pasted 2026-10-24) has two chords a line, the second over the middle word ("Past the road [to] your house"), running the chart's chords in order: F Am, G F, Am G, F Am. That is the old guess (`mergeWords`, `looksGuessed`), not a placing. UG's chart differs in three ways: (a) F Am G stacked before indented words on most verse lines, (b) a second F Am G group after the last word ("pills   F Am G"), and (c) chords alone with no word under them ("F" after "right", a row of F Am G between lines). The page and the slot logic already draw all three (4.63.0).
- Step 3, the cause (3.2). Both, but mainly the prompt's input. Lining up a song you already have sent its whole sheet as "the chord chart" (`placeChords(song.body, ...)` in `relineSong`), so a guessed sheet showed the AI the guessed places, and it could answer with them. `placedSheet` was not to blame: three chords at word 0 and a group after the last word already came out UG's way (now tested). Fixed: `chartOfSheet` sends sections and chords only; the prompt now gives UG's stacked F Am G as an example (never spread over the first words), puts a chord row between lines after the line before, keeps repeated lines, and prefers UG's official or highest-rated version. The song's stored marks couldn't be seen from here, so it may also have been skipped (a failed try waits a week, errors are silent, and any edit marks a sheet as yours, which is never lined up again). That is why Edit now has **Line up from the chord sites** for any song, with Undo. Not tested against the live AI here (no key in the sandbox); the browser test checks what is sent and what is built.
- SPOTS_V stays 2, so songs placed before aren't all lined up again on their own (each costs a search). Use the Edit button on a song that looks wrong.
