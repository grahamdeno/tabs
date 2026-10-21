# The Road

A guitar app for the phone that plays like a game: the guitar is how you play. Learn chords on a path, play your songs as scored shows, keep a streak, earn fans, climb a weekly chart and build a band. Chord sheets and tabs, offline, everything on the device, no account.

Live at `https://grahamdeno.github.io/tabs/` (GitHub Pages from `main`). Add it to the home screen to use it as an app. It was called Tabs before version 3; the repo and saved data keep that name.

## What it does

### The Road (home)
- A stat bar on every main page: your venue (tap for the Tour Map), your gig streak (tap for Your playing) and fans to spend (tap for the Merch table).
- The leg you're on and a path of stops built from the neck: lessons, a merch box after every third, and a headline show at the end of each leg (play a real song through). The current stop is ringed with its card open.
- Louie the amp beside the path with one line for the moment and tonight's song to play.
- The Songbook bar above the tab bar: your songs, how many you can play, and search.
- Fans: 10 for every play, 5 for every lesson round, 25 for every merch box.
- The tab bar: Road, Tour, Charts, Band, Rehearse and More (Songbook, Tour Map, Your playing, Tuner, Merch table, Settings).

### The Gig: playing a song
- Play on any song opens the Gig, a scored show over the song as it plays (auto-scroll, the recording or the band).
- On screen: the song map in Stage Gels (a light for each section; the screen washes into the one you're in), your strings, the section and combo, a crowd of 12 fans, Now and Next with the beats to the change, Louie, a timing meter, and 4, 5 or 6 lines of the song, or Full (the whole song page under a thin strip). Lines in a gig is in Tools.
- The microphone hears your strums: a strum within 0.35 s of a chord change lands it. Landed changes build the combo; a miss ends it and snaps a string. Nothing fails. Hearing you turns scoring off for one show; Settings > Playing > Score my plays sets the default.
- Pause holds the show in place: Back a line, Tools, Sheet and a big Resume, in thumb reach. Drag the lines to move the song.
- Show complete: bonus fans, the crowd, changes landed, Encore (double bonus fans) and Challenge a friend.
- Practicing a section or slower, a tab, or Play together plays the plain sheet: chords over the words, the current line stands out and the others dim while it plays, the section rail on the right edge, tap a chord for its fingering, a diagram over each chord on the line you pause on.
- Tools is one sheet from the bottom: text size, Lines in a gig, Play along (speed or song length, metronome, bass line, Play together, tuner, capo, Make it easier, Practice a section, Now and Next) and The song (Edit, Add to set, Share, German, recording link, Spark tone).
- The band: a metronome (click or a drum beat that fits the song, written per section by the AI when there's a key), and a synthesized bass playing each chord's root. Beat and Bex from Your band play drums and bass in gigs once they've joined.
- Practice mode (the Practice chip): loop a section, slow it to 50%, Build up, drums busier or simpler. Practice time counts as plays on the Tour Map.
- Bluetooth page-turner pedals work: left or Space plays and pauses, right goes to the next section.

### Tour, Charts, Band and Rehearse
- **Tour:** the month's tour (20 shows for 100 fans), the request line (a fan asks for one of your songs; double bonus fans as a gig), tonight's setlist (three daily goals), cover requests from what you just played in Apple Music, and the Friend quest (300 XP with a friend in a week).
- **Charts:** XP this week on a chart at your tier with nine computer players who play like people (weekend players, daily players, ones who fade). Top 5 move up on Monday, bottom 3 move down. A daily rival battle on one of your songs. Friends lists everyone you've dueled, ranked by XP.
- **Song duels:** after a scored gig, send a link with the song and your score; your friend plays it and sends theirs back. No server.
- **Band:** Louie's 18 friends join one at a time as you play songs through (Lola after your first, Looper at 140).
- **Rehearse:** Soundcheck (the two changes you dropped most in gigs this week, drilled), Missed changes, the neck (chord lessons that listen to each string, chord switches against a click, scales), Sit in with the band, the tuner and What I hear (the microphone, live).
- **Merch table:** spend fans on gear (Rain check keeps a streak through a missed night, Double set doubles XP for 3 gigs, Second take replays a lost battle), Louie's finishes and gig backdrops. Spending never touches XP.

### Songbook, sets and editing
- Search titles, artists and lyrics; paste a chord sheet into the bar and it works out the format, key, sections, title and artist. Nothing found offers the web, then Get the song.
- Filters (All, Can play, Sets, Favorites, Learning, Tabs), sorts, a letter index, Up next for you (the song one new chord opens). Swipe left to delete (with Undo), right to favorite.
- Sets with a date, place and drawn cover; Play set runs them with a Next up card and remembers each run.
- Add opens a writing pad: Paste, Type, Sing or strum (key and chords found on the phone), and with an AI key, Scan a page or Find the chords. Edit works in place: tap a word to set its chord, every change saves with Undo. Deleted songs and sets stay 30 days in Recently deleted.

### Your playing, the Tour Map and the streak
- Your playing: hours, songs, streak, milestones, a chord passport, your changes, when you play, keys and tempo, and a share picture with Louie.
- The streak celebration, once a day after your first song played through: the screen floods with the streak colour, Louie drops in and throws the horns in front of a flame that grows with the streak, confetti falls, the count rolls up and the week fills in. Share makes a picture of it.
- The Tour Map: every song played through lights a hexagon on a map; rings grow into venues from Garage to Festival headliner, with simulated rival players around you. Your position stays on the phone, never in a backup.

### Tuner
- Acoustic and electric headstocks with each key labelled, a meter that eases into the last few cents, Guided (low to high) and Chromatic with adjustable A4. Standard, Drop D, half and whole step down, DADGAD, Open G and Open D.

### Listening and sharing
- Listen searches Apple Music's public catalog, plays previews and saves a recording with its album art and length.
- Apple Music (optional, its own Settings row): with a subscription, Play can start the recording, and the page follows it line by line (synced lyrics times from LRCLIB) and chord by chord. Its 30-second preview gives the tempo, feel and key. Needs the token Worker (`worker/README.md`).
- Share a song or set as a link (the song travels inside it). Play together starts two phones at the same moment.

### Help and settings
- Tips appear once, when they're useful. Settings > Help > Tips & gestures lists every gesture with Show me.
- Settings: Playing, Look (Auto, Light, Dark, Green), New songs, Today, Apple Music, Keys, Songbook and backups, Help. Back up now sits at the bottom.

## Look

Version 4's design system, at the end of `styles.css`: three palettes (Light is Festival Poster, Dark is Neon Midnight, Green is Green Room), flat colour with no outlines, chunky buttons on a darker lip, Fredoka for titles and Nunito for text (bundled). Game colours: `--streak`, `--fans`, `--strings`; `--accent-ink` is the accent for text, deep enough to read on the light palettes. Louie the amp is the mascot and the app icon. Older amp materials (copper, plate, lamps) are still in the file and redrawn from the palette.

## Chord sheet format

```
[Verse]
G              C        G
Blackbird singing in the dead of night

[Chorus]
[C]Take these [G]broken wings
```

## AI help (optional)

Settings > Keys > paste an Anthropic API key. Without a key the app works the same and the AI options stay hidden.

- **Clean up:** a messy paste comes back as a tidy chord sheet, which you can compare before saving or undo.
- **Scan a page:** a photo of a songbook page or handwritten sheet is read into a chord sheet.
- **Remove the capo:** in the ••• menu of a song whose chart has a capo; the chords move to the key the song sounds in, and one more tap puts the capo back.
- **Make it easier:** suggests a capo and up to four simpler chords. The sheet is never changed; the suggestion is stored alongside and can be turned off. No lyrics are sent.
- **Get the song:** the title and artist go to a larger model with web search, which reads chord sites and returns sections, chords, key, capo, tuning, tempo and strum, with sources. Only chord and section names are kept, each one checked. The lyrics come from LRCLIB, matched by title, artist and length; the tempo from GetSongBPM when you've added that key. Tabs lines the chords up with the lyrics on the phone. Each chart costs a few cents of web searches. A switch on the sheet picks how hard: Easy (the simplified version most sites show), My level (your chords from the library, weighted toward songs you've got, plus real barre chords and the recorded rhythm), or As recorded. The pick is kept; Play next's Add uses My level, or As recorded from A step up, without changing it. Strums show muted strums (x) and held beats (-), or say when a song is fingerpicked.
- **Add the words:** paste lyrics you've copied and Tabs puts a chart's chords over them, section by section.
- **What can I play next?:** suggests well-known songs that use mostly your chords, or with A step up, songs that are clearly harder. Songs already shown aren't repeated.
- **Spark tone:** a starting tone for a Positive Grid Spark amp. No lyrics are sent.
- **German practice:** see below.

**Lyrics rule.** The AI never supplies, finds or completes lyrics.

**Translation exception (German practice):** for a song already in your library, the AI may translate its sung lines into German, only when you turn it on for that song. Translations stay on the phone with the song, are never shared or exported, and are dropped when the song's words change. Tests check this (`tests/core.test.mjs`, `tests/e2e/german.e2e.mjs`). German practice has levels from a few common nouns to fully German, shows each noun's gender, and has a word card with meaning, grammar and a German voice.

### About the API key

The key is stored in the browser's local storage and sent straight from the phone to `api.anthropic.com`. That's a reasonable trade for a personal app with no server, with limits:

- Anyone with the unlocked phone can read it in Settings.
- Any script on the page could read it. The app loads no third-party scripts, escapes all user text, and its content security policy only lets it talk to `api.anthropic.com`, Apple's song search, LRCLIB, GetSongBPM and Open-Meteo.

Use a key made only for Tabs with a low monthly spend limit, and revoke it in the Console if the phone is lost. Keys are never put in backups.

## Development

Open `index.html` through any static server (ES modules need http). Plain ES modules, no build step.

| File | What's in it |
|---|---|
| `index.html` | Page shell and content security policy |
| `styles.css` | All styles; the version 4 look is at the end |
| `core.js`, `core/` | Data and logic with no screen code, unit tested. `core.js` keeps storage, markup, backups and tuner maths and re-exports the topics in `core/` (chords, recording, sketch, playing, groove, turf, neck, game) |
| `app.js` | Song page (auto-scroll, Now and Next, song map, iPad layouts, pedals), Find songs, router |
| `library.js` | The Songbook: search, filters, the song list, swipes, the paste card |
| `audio.js` | Metronome, drums and bass |
| `aihelp.js` | AI help: the request to Anthropic, errors and limits |
| `ui.js` | Icons, toasts, `ask()` questions, `onLeave` and `onScroll` hooks. Depends only on `core.js` |
| `editor.js` | Editing in place, new songs, writing mode, tap tempo, chord picker |
| `settings.js` | Settings menu and pages, Recently deleted |
| `sets.js` | Sets, playing a set, covers |
| `coach.js` | Tips, Show me demos, Tips & gestures |
| `store.js` | Safety copy, backups, storage, problems log |
| `share.js` | Share links, opening a shared link, Play together |
| `listen.js` | Listen: recordings, previews, length from the recording |
| `profile.js` | Your playing: the profile page and its share card (numbers from `profileOf` in `core.js`) |
| `fold.js` | One-handed: the bar folds into Play's corner while playing; pull down at the top to go back |
| `dial.js` | The corner dial (speed meter, key, set picker) |
| `findai.js` | Play next, chord charts, Get the song |
| `aitools.js` | Make it easier, Spark tone |
| `tuner.js`, `heads.js` | Tuner and headstock drawings |
| `sketch.js`, `strum.js` | Sing it, Strum it (`strum.js` loads `vendor/basic-pitch/`) |
| `german.js` | German practice |
| `crop.js` | Cover photo framing |
| `road.js`, `hud.js` | The Road (home): the path, Louie and the Songbook bar; the stat bar, tab bar and More sheet |
| `gig.js` | The Gig (scoring in `core.js`) |
| `tour.js`, `charts.js`, `band.js`, `friends.js`, `duel.js`, `merch.js` | Tour quests, Charts, Your band and Louie's friends, song duels, the Merch table (numbers in `core.js`) |
| `practice.js` | Rehearse and the neck |
| `playmap.js`, `scene.js`, `drawer.js` | The Tour Map, rival players, pull-up drawers |
| `louie.js` | Louie, drawn in the palette's colours |
| `vendor/fonts/` | Fredoka and Nunito (SIL Open Font License) |
| `sw.js` | Offline copy; lists every app file (a test checks the list) |
| `worker/` | The MusicKit token Worker for Apple Music (deployed by hand; see `worker/README.md`) |

`editor.js` and `settings.js` load on first use and are fetched quietly a few seconds after start; the tuner, AI tools, Sing it, Strum it, German practice and cover framing load on first use.

Conventions:
- Build markup with html`` from `core.js`, which escapes every value unless it's safe markup (another html``, an icon, or `raw()`). Older templates use `esc()` on every value. A browser test fills every name with markup and checks none of it runs.
- Shared state lives in the module that owns it; other modules read it through imports and change it only through that module's functions (`setData`, `setOpenEdit`, `setSetCtx`, `setFilter`). ESLint's `no-import-assign` catches a direct write.
- The app never uses the phone's alert boxes; `ask()` shows a short sheet instead. Discarding something happens at once with Undo rather than a question.
- Accessibility: every control has a VoiceOver name, panels are labelled dialogs that take focus and close with Escape, focus is always outlined, text meets contrast in the light and dark palettes (axe runs in CI), and Reduce Motion turns animation off.
- Wide screens: from 700 px text is larger; from 1000 px the song gets a rail with Now and Next; from 1150 px a song list on the left. A phone on its side gets a slim column of controls.

Data: the library lives in IndexedDB with a copy in localStorage written on every save; at start the newer readable one wins. Older saves migrate automatically. [docs/DATA.md](docs/DATA.md) describes every field, the backup file and how a restore is checked.

Problems: the last 20 errors are kept on the phone, and the first in a session shows a note with Copy details. Settings > Help > Copy diagnostics copies the version, device, counts and storage, never song words, titles or keys.

### Releases

`VERSION` in `core.js` and `CACHE` in `sw.js` must match (a test checks). A feature is a minor release (2.30.0); a fix is a patch on the release where the defect was found (2.30.1). If app files change on `main` without a bump, the bump version workflow raises the patch number. The app opens from its saved copy, so a change only reaches installed apps through a new cache name; on the next launch it downloads the release in the background and offers to reload. Parts loaded later are requested as `tuner.js?v=1.2.3` so they always come from the same release as the open app.

### Tests

- `node --test` runs the unit tests (no dependencies): chord parsing, transposing, wrapping, fingerings, library data and backups, pitch detection on synthetic and real recordings (`tests/audio/`), tip pacing, escaping, and the version matching the cache.
- Browser tests run the real app in Chromium: `npm i --no-save playwright axe-core && npx playwright install chromium`, then `node --test --test-concurrency=4 tests/e2e/*.e2e.mjs`. `app`, `app2` and `app3` cover features end to end; `regress` walks the main path at 320, 390 and 1180 wide in both themes; `a11y` checks names and axe findings; `visual` compares screens against `tests/visual/ci/`.
- `node tests/quick.mjs` runs the unit tests plus only the browser tests that cover files changed since `origin/main`.
- GitHub Actions runs everything plus ESLint on every push. Visual references are remade with the update screenshots workflow after an intended change to how screens look.

## Version history

- **4.x, the game (2026):** 4.0.0 the new look, Louie, the stat bar, tab bar and the Road path; 4.1.0 the Gig and Louie as the app icon; 4.2.0 one song screen built from the Gig; 4.4.0 Full; 4.5.0 Tour quests; 4.6.0 Charts; 4.7.0 Your band; 4.8.0 Rehearse; 4.9.0 the Songbook; 4.10.0 cover requests; 4.11.0 livelier charts and moving down; 4.12.0 song duels; 4.13.0 Friends and the Friend quest; 4.14.0 the Merch table; 4.15.0 the streak celebration around Louie, fewer settings.
- **3.x, The Road:** Tonight as home with Louie, the Tour Map with rival players, one-handed playing (the bar folds into Play's corner), Apple Music play-along timed line by line and chord by chord, the neck (lessons that listen), Practice mode, drums that fit the song.
- **1.x and 2.x, Tabs:** chord sheets and tabs with auto-scroll, sets, the tuner, the editor, Sing it and Strum it, AI help, German practice, Your playing.

The git log has every release.

## Credits

- Lyrics: [LRCLIB](https://lrclib.net). Fetched only for Get the song, stored on the phone, never shared by Tabs.
- Tempo data by [GetSongBPM.com](https://getsongbpm.com). Optional free key from [getsongbpm.com/api](https://getsongbpm.com/api), kept on the phone and out of backups.
- Weather data by [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0). Only the chosen city's position is sent, once a day.
- Strum it uses [Basic Pitch](https://github.com/spotify/basic-pitch-ts) by Spotify and TensorFlow.js (both Apache-2.0), bundled into `vendor/basic-pitch/` by `.github/workflows/vendor-bp.yml`.

## License

MIT
