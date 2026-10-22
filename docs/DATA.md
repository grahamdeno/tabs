# Tabs data

Everything lives on the phone. Backups are the same data as one JSON file.

## Where it is stored

| Store | Key | Holds |
|---|---|---|
| IndexedDB `tabs-library` | store `copy`, key `lib` | **The library** (songs, sets, Recently deleted, settings) as `{ json, at }` |
| localStorage | `tabs-v1` | A copy of the library, written with each save, plus `_savedAt`. Skipped if it no longer fits (about 5 MB) |
| localStorage | `tabs.apikey.v1` | Your Anthropic API key. Never in backups or share links |
| localStorage | `tabs.errors.v1` | The last 20 problems (message, screen, version, time) for Settings > Copy diagnostics. Never sent anywhere, not in backups |
| IndexedDB `tabs-covers` | store `covers`, key = set id | Set cover photos as `data:image/...` URLs |
| IndexedDB `tabs-sketch` | store `clips`, key = song id | The Sing it recording: one audio clip per sung line. Not in backups; removed once the song is deleted for good |
| Cache Storage | `tabs-vX.Y.Z`, `tabs-art` | The offline app, and album art from Apple |

Saves are batched (150 ms) and written at once when the app goes to the background. At start the newer readable of the two is used (`pickLibrary` in `core.js`); a copy without `_savedAt` (from an older Tabs, which kept the library in localStorage) counts as newest, so it moves into the database once. Without IndexedDB, localStorage alone is used. Tabs also asks the browser to keep its storage permanently (`navigator.storage.persist()`); Settings shows whether it did and whether the safety copy is on.

## Library

```js
{
  songs: [Song],
  sets: [Set],
  trash: [{ type: "song" | "set", item: Song | Set, deletedAt: ISO date, ... }], // kept 30 days
  settings: Settings
}
```

### Song

| Field | Type | Notes |
|---|---|---|
| `id` | string | Required, unique |
| `title`, `artist` | string | `"Untitled"` when missing |
| `body` | string | Required. The chord sheet or tab as plain text |
| `format` | `"chords"` or `"tab"` | Worked out from `body` when missing |
| `key` | string | `""` means detect from the chords |
| `transpose` | integer -5 to 6 | Semitones |
| `size` | number 0.6 to 1.6 | Text size |
| `duration` | seconds | Song length speed style. Set from the recording when linked to Apple Music, unless you chose your own |
| `recLength` | seconds | The recording's length, kept when Get the song adds it, so the metronome can slow with the speed dial (2.41.0) |
| `groove` | object | What the drums and bass do for this song: `beat` (`"rock"`, `"half"`, `"ballad"` or `"four"`), `swing` (`"straight"`, `"light"` or `"full"`) and `bass` (`"root"`, `"fifth"`, `"pulse"`, `"walk"` or `"riff"`), each optional (a missing part comes from Settings), and `src`: `"ai"` for what was found, `"you"` once it was changed in Edit. `riff` is one bar of a bass part in sixteenth notes: 16 characters from `.` (no new note), `1` (root), `3` (third), `5` (fifth), `7` (flat seventh) and `8` (the root an octave up), played on whatever chord the song is on; `bass: "riff"` plays it, and the riff is kept if another style is picked (2.47.0). `{ src: "you" }` alone means keep the defaults and don't look it up again. Looked up once, in the background, the first time the song plays with the metronome or bass on, and when Get the song or Play next adds it (2.46.0) |
| `capoOff` | boolean | The chart's own capo is taken off: chords show in the key the song sounds in (2.41.0) |
| `durationSet` | boolean | You moved the length slider; the recording's length is then offered, not applied |
| `speed` | number | 1x speed style |
| `bpm` | integer 30 to 260 | Tempo, for the count-in and metronome. Typed, or tapped in Edit |
| `tuning` | key of `TUNINGS` | Missing means standard |
| `favorite` | boolean | |
| `created` | ISO date | |
| `art` | string | Album art for set covers, found on Apple Music when the title and artist clearly match (https only). A Listen link's own art comes first |
| `backing` | `"band"` | Only set when Play should start the drums and bass instead of the linked Apple Music recording; absent means the recording (when one is linked and Apple Music is on) |
| `recRate` | number | The linked recording's speed for this song, 0.5 to 1; absent means full speed |
| `timed` | `{ h, id?, at?: [[line, seconds], ...], w?: { line: [seconds, ...] }, none? }` | Line times from LRCLIB's synced lyrics for the linked recording: `line` is the sheet line's index, `w` the word times of lines whose lyrics carry them (3.22.0), `h` a fingerprint of the words (looked up again after an edit), `none` when no timing was found. No lyric text is kept |
| `syncs` | `[[where, seconds], ...]` | Marks tying a place on the sheet (0 to 1 down it) to a time in the linked recording, saved when you nudge the page while it plays; up to 12, rising together |
| `listen` | `{ url, service, title?, artist?, art?, length?, genre?, year?, composer?, tint?, det? }` | `url` and `art` are https only; `length` is the recording's, in seconds; `genre`, `year`, `composer` and `tint` (the album's color, six hex digits) come from Apple Music when it is on, and `det` marks that they were asked for; `feel` = `{ bpm?, swing?, key?, sure?, keySure? }` is measured from the recording's preview (3.18.0) |
| `loop` | `{ a, b, build, name? }` | Practice a section, line numbers; `name` is the section's name for the neck's Learning list (3.21.0) |
| `drums` | `{ intro?, verse?, prechorus?, chorus?, bridge?, solo?, outro?, fill?, level?, src }` | Drums that fit the song (3.23.0): written once by the AI. Each part is one bar of 4/4, `{ kick, snare, hat }`, 16 characters each (`.` rest, `x` hit, `X` accent, `o` ghost note, `O` open hi-hat). `level` is -1 simpler or 1 busier, missing for as written. `src` is `"ai"` |
| `practice` | `{ on?, rate? }` | Practice mode (3.21.0): `on` only when it differs from the default (on for a Learning song), `rate` the practice speed 0.5 to 1. An older `recRate` becomes `rate` |
| `easier` | object | Make it easier result: `{ on, capo, subs, note, before, after }` |
| `tone` | object | Spark tone result |
| `sketch` | object | Made with Sing it: `{ v: 1, key, style: "simple" \| "rich", lines: [{ n: [[midi, start, length], ...] }] }`, the sung melody per line (seconds, to 0.01), for restyling and chord suggestions. Older sketches may hold `true` |
| `status` | `"learning"` or `"got"` | Learning status |
| `gotAt` | ISO date | When the song was marked Got it, for Repertoire on Your playing (2.42.0) |
| `playLog` | `{ total, last, days: { "YYYY-MM-DD": n } }` | Last 60 days of counts |

### Journal

`journal` sits beside `songs` and `sets`: the lifetime counts behind Your playing, since the play log keeps only 60 days. It holds counts, never a list of plays, so it stays small. It's worked out once from the songs already played (play totals, the days still in the log, when each song was added) and then updated as you play; `seeded` is that day, and numbers from before it are estimates. A backup carries it; a missing or broken field is put back to empty.

| Field | Type | Notes |
|---|---|---|
| `v` | 1 | Format version |
| `since`, `seeded` | `YYYY-MM-DD` | The first day it covers; the day it was worked out from the library |
| `secs` | number | Seconds of playing: time a song scrolled, finished or not |
| `chords` | `{ [chord]: { n, first } }` | Plays that used the chord (in the shapes played), and the day of the first |
| `changes` | `{ "a\|b": n }` | Switches between two chords |
| `keys` | `{ [key]: n }` | Plays by the key the song sounds in |
| `months` | `{ "YYYY-MM": { plays, secs, bpm, bpmN, psecs? } }` | Per month; `bpm / bpmN` is the average tempo; `psecs` is practice time (3.19.0), every 240 s of it counts as a play on the Tour Map |
| `week` | 168 numbers | Plays per hour of the week, Sunday midnight first |
| `best` | integer | Longest streak in days |
| `firsts` | `[{ kind: "chord" \| "got", name, at }]` | Newest milestones first, 40 kept |
| `tune` | `{ n, checked: [6], drift: [6] }` | Tuner sessions; per string (low E first) how often it was checked and how often it had drifted past 5 cents |

### Set

| Field | Type | Notes |
|---|---|---|
| `id` | string | Required, unique |
| `name` | string | `"Set"` when missing |
| `songIds` | string[] | Order of play. Ids may point at songs in Recently deleted |
| `when` | `YYYY-MM-DDTHH:MM` local time | Optional date of the show |
| `cover` | `{ type: "songs" \| "art" \| "photo", tint? }` | Photo itself is in IndexedDB |
| `runs` | array | Times the set was played through |
| `created` | ISO date | |

### Settings

Defaults are in `DEFAULT_SETTINGS` in `core.js`. `v` is the save format version (now 6); `migrate()` in `core.js` upgrades older saves, one step per version.

#### Playing and the band

| Key | Values | Notes |
|---|---|---|
| `metronome` | boolean | Plays the metronome while a song scrolls |
| `metroSound` | `"drums"` (the default) or `"click"` | (2.40.0) |
| `metroVol` | 0 to 1 | Volume; 0.8 when missing (2.40.0) |
| `metroBeat` | `"auto"` (when missing), `"rock"`, `"half"`, `"ballad"` or `"four"` | The drum beat (2.44.0) |
| `metroSwing` | `"straight"` (when missing), `"light"` or `"full"` | (2.44.0) |
| `metroDrop` | boolean | Silences every other bar (2.44.0) |
| `bass` | boolean | Plays a bass line under chord songs (2.45.0) |
| `bassVol` | 0 to 1 | Volume; 0.7 when missing |
| `bassStyle` | `"auto"` (when missing), `"root"`, `"fifth"`, `"pulse"` or `"walk"` | |
| `bassOnly` | boolean | Mutes the drums or click while the bass plays. Nothing about the bass is stored on a song |
| `bandPlays` | boolean, on unless false | Lets Beat and Bex play drums and bass in gigs (4.7.0) |
| `chartLevel` | `"easy"`, `"mine"` (My level, the default) or `"rec"` (As recorded) | Get the song's last pick (2.41.0) |
| `nextLevel` | `"same"` or `"step"` | What can I play next?'s level (2.12) |

A song with no `bpm` gets one looked up when the metronome plays, and keeps it.

A play counts only when auto-scroll carried the page most of the way (60% of the distance, in at least half the song's time); a sheet that fits one screen goes by time alone.

#### The Gig and the streak

| Key | Values | Notes |
|---|---|---|
| `gigLines` | 4, 5 or 6 (5 when missing), or `"full"` | How many lines of the song the Gig shows (4.1.0); `"full"` is the whole song page under a strip (4.4.0) |
| `gigScore` | boolean, on unless false | A show starts listening for your chord changes (4.2.0) |
| `streakMoment` | boolean, on unless false | Shows the streak celebration once a day (2.43.0) |
| `streakShown` | day | The day the streak celebration last showed (2.43.0) |

`plainPlay` is for the tests only and keeps Play plain.

#### Look, tips and the tuner

| Key | Values | Notes |
|---|---|---|
| `theme` | `"auto"` (follow the phone, the default), `"dark"` or `"light"`; may also be `"green"` | Green Room (4.0.0) |
| `tipsSeen`, `used` | objects | Which one-time tips have shown and which features you've used, so tips and menu dots appear only when they help |
| `micExplained` | boolean | The tuner has explained the microphone |
| `tunerMode` | `"acoustic"`, `"electric"` or `"chromatic"` | |
| `tunerGuided` | boolean | |
| `a4` | Hz | Pitch reference |
| `lastTuned` | time | |
| `deVoiceTip` | boolean | The German word card has said where to get a more natural voice (2.17.1) |

#### Apple Music

| Key | Values | Notes |
|---|---|---|
| `appleMusic` | boolean, off when missing | Plays a song's Apple Music link in the app with MusicKit |
| `appleMusicToken` | https address | The token Worker it asks for a developer token; no MusicKit key or token is stored |

### Data beside the library

These sit next to `songs`, `sets` and `settings` in the saved library. Rival players and the chart's other players are not stored: they are simulated the same way each time from the spot, the week and the tier.

| Key | Shape | Notes |
|---|---|---|
| `data.tour` | `{ lost, below, checked, seen, taken }` (2.52.0; `seen`, `taken` 4.18.0) | Edge hexagons lost on the Tour Map, days in a row below the pressure on your edge, and the day it was last checked. `seen`: how many hexagons you held when the map last looked; `taken`: rival hexagons you've taken since 4.18.0 (corners taken) |
| `data.kept` | `{ days: { "YYYY-MM-DD": count } }` | Last 60 days: plays of songs that were deleted for good, so the weekly count and streak don't change when you tidy up; counts only, no titles |
| `data.skills` | `{ done, last }` (3.6.0) | `done` maps a lesson id (`c:G` a chord, `s:G-C` a switch) to `{ n, best, at }` (times finished, best tempo in BPM for switches, time); `last` is when a lesson last finished. Level checks are worked out from your plays and not stored |
| `data.gig` | `{ shows, fans, best }` (4.1.0) | Shows played as a gig, the bonus fans they earned (counted in your fans), and `best` mapping a song id to its best share of chord changes landed (0 to 100). A show's strums are heard and graded on the phone and never kept |
| `data.quests` | `{ fans, day, got, month, tour, crowd, req }` (4.5.0) | Fans earned from Tour quests (counted in your fans), the day `got` lists the setlist goals already credited (`two`, `crowd`, `mins`, `set`), the month whose tour was credited when `tour` is true, today's best gig crowd `{ day, n }`, and the request line `{ day, id, done }`. The request itself is worked out from the date, not stored, unless `heard` `{ day, id }` names the song you just played in Apple Music (4.10.0) |
| `cover` | `{ title, artist, url?, art?, at, id?, done? }` (4.10.0) | The cover quest: a song you listened to that wasn't in the library, its id once added, and whether its first gig was played |
| `data.quests.fq` | `{ wk, with, claimed? }` (4.13.0) | The Friend quest |
| `data.xp` | `{ days: { "YYYY-MM-DD": n }, life }` (4.6.0; `life` 4.17.0) | `days`: the last 60 days of XP earned outside plays (gigs, setlist goals, battles); plays give their XP from the play log. `life`: the same XP over all time, for your level on Your profile (started from `days` the first time) |
| `data.charts` | `{ tier, week, records, last, battle, fans }` (4.6.0) | Your chart tier (0 Garage to 7), the Monday of the week the chart was last settled, records `[{ tier, week, rank }]` for weeks in the top 5, last week's result `{ week, tier, rank, xp, up, down?, seen? }` (down: 4.11.0), today's battle `{ day, rival, songId, target, result?, pct? }` and fans from battles won |
| `data.band` | `{ seen }` (4.7.0) | The friends you've already met, so a new one is celebrated once; who has joined is worked out from your lifetime plays (`BAND` in `core.js`) |
| `data.duels` | `{ name, list }` (4.12.0) | The name your friends see on your challenges, and up to 100 duels `{ id, title, artist, songId, opp, mine, theirs, started, at }` where `mine` and `theirs` are `{ pct, combo, crowd }` (or null until played) and `started` is `"me"` or `"them"` |
| `friends` | `{ [name]: { xp, wk, at } }` | A friend's XP that week as of their last link (4.13.0) |
| `data.rehearse` | `{ misses, sc }` (4.8.0) | `misses` maps a chord change `"C>F"` to `{ n, days }`, the times you missed it in gigs per day (last 14 days); `sc` is today's soundcheck `{ day, pairs, got, done? }` (the switch lesson ids it's made of, the ones done, and whether its XP was earned); `lesson` (4.21.0) is the neck's lesson of the day `{ day, plan: { warm, learn, play }, done, xp? }`: the warm-up and new change as `{ id, a, b }` (plus `why`, or `song`, `times`, `inSongs`), the song part as `{ songId, title, sec, secName, rate }` (`sec` is the section's order among the song's labels, -1 for the whole song), the parts done (0 to 2), and whether its 40 XP was earned |
| `data.merch` | `{ spent, test, own, has, louie, backdrop, rainDays, told }` (4.14.0; `test` 4.16.0) | `test`: fans added from Settings > Help to try the Merch table; they only add to what you can spend, never to XP, the chart or your venue. Free finishes (Pink, Teal, 4.16.0) can be worn without being in `has`. Fans spent at the Merch table (taken off the fans you've earned to give what you have to spend), gear held `{ rain, double, take }` (Double set counts the gigs left), the finishes and backdrops bought, the ones on (`stock` and `basement` when missing), the days a Rain check covered (last 60; they count for the streak, never as plays or XP), and the items Show complete has already pointed out |

A duel link carries the song and `{ id, from, pct, combo, crowd, xp?, wk?, reply? }` (xp and wk, the sender's XP that week, since 4.13.0).

The journal keeps `days` (`{ "YYYY-MM-DD": seconds }`, last 60 days) and `daysFrom` (when that began) for your daily average.

### Kept outside the library, in browser storage

| Key | Holds |
|---|---|
| `tabs.nextseen.v1` | The last 60 songs Play next suggested (2.13.1) |
| `tabs.spot.v1` | The practice spot `{lat, lon}` rounded to 0.01 degrees (about a kilometre), never in a backup. With a spot set, the Tour Map loads tiles from `tile.openstreetmap.org`; Leaflet (vendor/leaflet-1.9.4) draws it (2.50.0) |

### No longer used

- `playMap` and `playSeen` (2.48.0): the Tour Map is always on (2.50.0) and needs no setting.
- `tabs.heard.v1` (3.24.0, browser storage): cover requests replaced Just heard it in 4.10.0.
- `tolex` (boolean, 2.20.0, Amp covering) and `arcSweep`: `arcSweep` is dropped from saves when they load.
- `stage` (Stage mode), `songMap` (the section rail is always on) and `pauseDiagrams` (diagrams when paused are always on), retired in 4.15.0 and dropped from saves when they load.
- `gigPlay` (4.2.0) and a song's `playAs` (4.3.0).

## Backup file

The library as above, plus `covers: { [setId]: "data:image/png|jpeg|webp;base64,..." }` when sets have cover photos.

Restoring a backup (`Tabs.import` and `cleanImport` in `core.js`) checks every field before it replaces the library:

- Not JSON, or no `songs` array: refused, nothing changes.
- Songs without an id or words, and repeated ids, are skipped and counted.
- Fields of the wrong type are dropped, so the app uses its default. Numbers are kept in range.
- Links and album art must be https. Cover photos must be PNG, JPEG or WebP data for a set in the file, about 3 MB at most.
- Unknown fields are kept, so a backup from a newer version still restores.

## Changing the format

1. Bump `settings.v` in `DEFAULT_SETTINGS` and add a step to `migrate()`.
2. Add the field to the tables above, and to `SONG_TYPES` in `core.js` if it has a fixed type.
3. Add a unit test that an older save migrates.
