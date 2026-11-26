# Song tours (5.9.0)

**Epic, approved by Graham 2026-11-26.** Shaped by Opus in the Louie Product chat. Build: Sonnet. Review: Opus.

## Goal

You learn a real song you'd probably like, one new chord at a time, until you can play all of it.

## Context

Simply Guitar builds its course from songs and unlocks new songs that reuse the chords you've learned. Louie already
has the pieces: Play next (`nextSongs` in findai.js), Get the song (`getSong`: words from LRCLIB, the AI places chords
only), chord lessons (`kind: "chord"`), switch drills (`kind: "switch"`), and necks with stops (`roadPath` in
core/game.js, levels in core/neck.js). What's new is a tour built from one song, plus an easy version that plays the
song with stand-in chords.

## Decisions (2026-11-26)

- **Where:** on the Tour. A song tour comes after each skill tour that has chord steps (Open chords, Chord switches).
  Starting one from the Songbook is a later version.
- **Who picks:** Louie picks one song; the player can tap Swap.
- **No AI key:** Louie picks from the player's Songbook with the same chord rule, or skips the song tour if no song fits.
- **Never blocks:** the next skill tour opens when the skill tour before it is done, whether or not the song tour is
  finished.
- **Monthly challenge:** song tour stops count the same as any other stop.

## Stories

### 1. The song tour appears

As a player, I want a song tour after each skill tour so that I use my new chords on real music.

- Given I finish a skill tour, when the Tour opens, then the next neck is "Song tour" with the picked song's title
  and its stops.
- Given a song tour is in progress, when I leave and come back, then it resumes at the same stop.
- Given a song tour is not finished, then the next skill tour is still open.

### 2. Louie picks the song

As a player, I want Louie to pick a song I'd probably like so that I don't have to search.

- Given I have a key, when the song tour is built, then the song is not already in my Songbook, needs 2 to 4 chords I
  don't know (`knownChords`), and is aimed at my genre (`meOf(data).genre`), my favourites and my Songbook artists.
- Given I tap Swap, when a new pick loads, then the same rules apply and earlier picks are not offered again.
- Given I have no key, then Louie picks from my Songbook using the same chord rule, or the song tour is skipped if no
  song fits.
- Given I'm offline or the AI fails, then the song tour card says it needs a connection and offers Try again. Nothing
  else on the Tour is held up.

### 3. Get the song

As a player, I want the song fetched for me so that the tour can start.

- Given a pick, when I tap Get it on the first stop, then the existing Get the song flow runs with the title and
  artist filled in, and the song is saved to my Songbook as Learning.
- Given the words can't be found, then Louie moves to the next pick and says so in one plain line.
- The AI returns chords and placements only, never lyrics.

### 4. First stop: play it now

As a player, I want to play the song on day one so that I get a win right away.

- Given the song has chords I don't know, when I open the easy version, then each one is played as a stand-in I
  know, and each stand-in is marked on the sheet (shape and a VoiceOver label "played as D").
- Stand-in rules, in order: drop extensions to the plain chord (D7, Dsus4, Dadd9 to D; Gmaj7 to G; Am7 to Am); drop a
  slash bass (G/B to G); a minor I don't know becomes its relative major if I know it (Bm to D, F#m to A); a major I
  don't know becomes its relative minor if I know it; otherwise the bars repeat the chord before them.
- The saved song is never changed. Stand-ins exist only while playing a song tour stop.
- The stop is done when the easy version is played to the end.

### 5. One new chord at a time

As a player, I want each new chord taught in order so that the song builds up.

- Given the new chords in the order they first appear in the song, then each gets three stops: a chord lesson, a
  switch drill from the chord before it in the song, and a replay where that chord is now real (later new chords
  still use stand-ins).
- A chord lesson or switch drill already done on the Tour counts as done here.

### 6. The headline

As a player, I want to play the full song so that I know I've learned it.

- Given all chord stops are done, when I open the headline, then every chord is real, with the recording if Apple
  Music or YouTube has it.
- The headline is done when the song is played to the end.

### 7. Finishing

As a player, I want my progress kept so that the song stays mine.

- Given I finish the headline, then the song's status is Solid, its chords count as known, and the Tour says what's
  next.

## Edge cases to check

Big text and 50% text, 320 px phone, iPad, Light and Dark, VoiceOver (every stop has a spoken name and state), empty
Songbook, no key, offline, a song with more than 4 new chords after a Swap (rejected), a song deleted mid-tour (the
song tour resets to a new pick), restoring a backup from before 5.9.0, and from after.

## Data

A new library field for song tour progress (pick, song id, skipped picks, stops done). It must be cleaned on load,
included in backups and restores, and documented in docs/DATA.md. Always reviewed in full.

## Out of scope

Starting a song tour from the Songbook, choosing from several picks, strumming patterns, riffs or tab parts, and
bundled songs (song words can't ship with the app).

## Steps

1. [Opus] Shape and read back the epic. Done 2026-11-26.
2. [Sonnet] Build stories 1 to 7 on branch `song-tour` from `next`, one PR into `next`, a test for each criterion.
   Bump `VERSION` and `CACHE` to 5.9.0 in its own commit. Update README, docs/DATA.md and docs/ONBOARDING.md.
3. [Opus] Review the PR, with the data part in full.
4. [Graham] Merge go into `next`, try it on the phone, then the ship go.

## Surprises

Found while building (Sonnet, 2026-11-26). None stopped the build; each is a call Opus or Graham should confirm.

1. **The word "easy".** The plan calls the first stop the easy version. The playbook (rule 17) bans "easy" in product words, so the stop is named "Play it now" and the replays "Play with Bm".
2. **Stand-in plays credit no chords.** A play with stand-ins still counts as a play, but `logPlay` gives the journal a copy of the song with no chords. Otherwise five stand-in plays would have made Bm count as known without it being played.
3. **The next skill tour is drawn open beside the song tour.** The Tour draws the leg after the current one grayed and locked (Grok, 5.3.0). When the song tour is the current one, the next skill tour is drawn in full and open instead, so the song tour never holds it back. Opus may want Grok to look at how that reads.
4. **Swap is only offered on the first stop, before Get it.** Later it would throw away stops already done. The plan does not say.
5. **A fetched sheet can disagree with the pick.** After Get it, the new chords are worked out again from the sheet that came back. If it has fewer than 2 or more than 4, the song stays in the Songbook (the player added it) and Louie picks another for the tour, with a line saying so.
6. **`practice.js` needed no change.** It already opens a chord lesson (`c:<chord>`) and a switch drill (`s:<a>-<b>`) for any chord that has a shape; a test covers it.
7. **`knownChords` also reads finished chord lessons that are not on the neck** (`c:Bm` in `data.skills.done`), so a song tour's chords count as known.
8. **`CLAUDE.md` is not updated** (outside the Touch list). Its "Where things are" table needs a row for `core/songtour.js`.
9. **No key:** the Songbook pick needs a song whose chords are 2 to 4 unknown plus at least one you play. A Songbook song is never offered to two tours.
