# Tabs

A personal chord sheet and guitar tab app for the phone. It works offline, keeps everything on the device, and needs no account.

Live at `https://grahamdeno.github.io/tabs/` (GitHub Pages from `main`). Add it to the home screen to use it as an app.

## What it does

### Library
- The library is home. The bottom bar searches, or takes a pasted chord sheet and works out its format, key, sections, title and artist.
- Search moves the bar to the top so results sit above the keyboard. It matches titles and artists first, then lyrics (showing the matching line). When nothing matches, it offers the web, Ultimate Guitar or Chordify, then Get the song.
- Filters for All, Sets, Favorites, Learning and Tabs, each with a lamp lit on your pick. Sort A to Z, by artist (a leading "The" is ignored), recently played or most played. Long lists get a letter index on the right edge.
- Swipe a song left to delete it (a long swipe deletes at once, with Undo), right to toggle Favorite.
- Today, under the title: a week of dots and your practice streak (a day counts when a song plays to its end), and until you've played, one song to try. The pick can follow the time of day, the weather for a city you set (Open-Meteo, once a day, never your location), a change you rarely play, or a Learning song left too long. Tap the line for Changes: the chord changes you played this week and the ones your songs have that you play least.

### Playing a song
- Chords sit over the words in copper, chord-over-lyric or inline `[G]` style. Lyrics wrap at full size with each chord riding its word; tabs wrap a measure at a time with string names on every row.
- Auto-scroll by song length (default; it fits the scroll to how long the song takes) or by speed. Each song keeps its own. Linking a recording sets the length from the track.
- Tap anywhere to pause. Count-in from the top, a metronome at the song's tempo (a click or a drum beat with kick, snare and hi-hat, with its own volume, in Settings > Playing; it follows Build up, and a song with no tempo gets one looked up), transpose with sharps or flats chosen by the resulting key, text size, practice a section (with Build up from 80% speed), and a song map on the right edge to jump between sections.
- Chord help: Chords in this song (a strip of fingerings under the title), Now and Next diagrams while playing, a diagram over each chord on the line you pause on, and tap any chord for its fingering.
- Focus current line: the current line is heavier and the rest dim, without ever changing how lines wrap.
- Stage mode: larger, brighter text and nothing extra; stray touches don't scroll and one tap doesn't stop a song.
- One-handed controls on a phone held upright: the song bar is a gold plate with Back, the speed dial and Play. Play rises to the thumb on an arc; sweep the arc, or slide Play along it, to move through the song. Hold Play for a ring of controls (Tempo, Key, Chords, Tuner, Favorite, More, and Set in a set). The speed dial is a backlit meter in the corner.
- Bluetooth page-turner pedals work: left or Space plays and pauses, right goes to the next section, holding right goes back one.

### Sets
- Group songs into sets with a date and place. The next one shows at the top of the library with one-tap play.
- Every set gets a drawn cover (a ring per song, colored by key), or album art, a photo or the camera.
- Play set opens with a title card; at the end of each song a Next up card plays the next after 5 seconds and waits if the next song needs a different tuning. A finished set remembers when it was played, how long it ran, and a note for next time.

### Adding and editing songs
- The add button opens a new song on a writing pad, with ways to start under it: Paste, Type, Sing or strum, and with an AI key, Scan a page and Find the chords with AI. Key, Tuning and Tempo fold into one line showing what was found.
- Edit turns the song page into the editor: title and artist in place, tap a word to set its chord, the pencil retypes a line, tap a section name to rename it, + adds a line or section. Every change saves at once with Undo. Edit / Preview switches between the text and the finished sheet. While typing, a strip above the pad keeps the title, artist and key in view.
- Tap tempo, tunings (from Edit or a "Tuning: Drop D" line), and Delete with Undo. Deleted songs and sets stay in Recently deleted for 30 days.
- Sing it: hold the pad and sing a line; Tabs finds the key and chords that hold your melody and places them over your words. Strum it does the same from the guitar, using Basic Pitch on the phone to hear what you played. Nothing is sent anywhere.

### Tuner
- Looks like the front of an amp: tolex behind it, the instrument tiles as channel buttons with a lamp on the one in use, and a pilot lamp that lights while it hears a note.
- Acoustic and Electric show the headstock with each note printed on its key, so the keys follow the tuning you pick. The key to turn lights up and one line says what to do ("Loosen the E string"). Below it, a meter window shows how far off you are, with a marker that is green in tune, amber when close and red when well off, and the cents underneath. The meter's middle is stretched, so the last few cents are easy to see, and the marker glides instead of twitching. Guided walks the strings low to high. Chromatic reads any note, with an adjustable A4 (430 to 450 Hz).
- Hears a string at playing distance: it learns how loud the room is and listens just above that, and keeps the reading while the string fades. Once it knows which string you are tuning, it listens closely around that note, which keeps a quiet high e or a boomy low E from being misread. A shaky reading or a short dropout no longer starts the in-tune count over.
- Standard, Drop D, half and whole step down, DADGAD, Open G and Open D. It shows up where tuning happens: the library, songs in another tuning, sets and Next up.

### Listening and sharing
- Listen searches Apple Music's public catalog inside the app, plays 30-second previews, and saves the right recording with its album art and length. Spotify or YouTube links can be pasted too.
- Share a song or a set as a link. The song travels inside the link; no server. Opening one offers to add it.
- Play together: pick a start a few minutes ahead and share the link. Both phones count in and scroll together, each by its own clock.

### Help and settings
- Tips appear once, at the moment they're useful, spaced out and never while a song plays. Settings > Help > Tips & gestures lists every gesture with Show me.
- Settings is a short menu (Playing, Chord diagrams, Look, New songs, Today, Keys, Library and backups, Help), with Back up now at the bottom in thumb reach.
- Theme follows the phone, or set Dark or Light. Amp covering (Settings > Look) adds a tolex grain behind everything.

## Look

Dark glass with copper for what you play, and the details of a guitar amp. Every screen draws from the same materials, defined once at the top of the amp theme in `styles.css`:

- **Piping:** a thin bronze edge on bars, lists, cards, sheets and the ring.
- **Plate:** brushed gold, like an amp's front panel (the song bar, the editor's bar, the add button's frame, Play next's level switch).
- **Recess:** dark wells set into a plate.
- **Copper:** the main action (Play, Save, add, primary buttons).
- **Chrome:** amp-control buttons (the ring, the editor's tool buttons). Light metal in the light theme; the ring always stays dark.
- **Lamp:** the amber jewel lamp, off, warming or lit (the song bar, filter chips, ring buttons, Play next, Get the song).
- **Tolex:** black pebbled covering for the ring and result cards.

Liquid Glass is used only on bars that float over content (the search bar, the full player bar). Sheets are frosted; plates are solid. The app icon and iPhone launch screens are the Fret pick on black leather.

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
| `styles.css` | All styles; the amp theme materials are at the end |
| `core.js` | Data, parsing, chords, transposing, Changes, tuner math. No screen code; unit tested |
| `app.js` | Library, song page (auto-scroll, Now and Next, song map, iPad layouts, pedals), Find songs, router |
| `ui.js` | Icons, toasts, `ask()` questions, `onLeave` and `onScroll` hooks. Depends only on `core.js` |
| `editor.js` | Editing in place, new songs, writing mode, tap tempo, chord picker |
| `settings.js` | Settings menu and pages, Recently deleted |
| `sets.js` | Sets, playing a set, covers |
| `coach.js` | Tips, Show me demos, Tips & gestures |
| `store.js` | Safety copy, backups, storage, problems log |
| `share.js` | Share links, opening a shared link, Play together |
| `listen.js` | Listen: recordings, previews, length from the recording |
| `ring.js` | One-handed controls: the island, the arc, the hold-Play ring, Play following the hand |
| `dial.js` | The corner dial (speed meter, key, set picker) |
| `findai.js` | Play next, chord charts, Get the song |
| `aitools.js` | Make it easier, Spark tone |
| `tuner.js`, `heads.js` | Tuner and headstock drawings |
| `sketch.js`, `strum.js` | Sing it, Strum it (`strum.js` loads `vendor/basic-pitch/`) |
| `german.js` | German practice |
| `crop.js` | Cover photo framing |
| `sw.js` | Offline copy; lists every app file (a test checks the list) |

`editor.js` and `settings.js` load on first use and are fetched quietly a few seconds after start; the tuner, AI tools, Sing it, Strum it, German practice and cover framing load on first use.

Conventions:
- Build markup with html`` from `core.js`, which escapes every value unless it's safe markup (another html``, an icon, or `raw()`). Older templates use `esc()` on every value. A browser test fills every name with markup and checks none of it runs.
- Shared state lives in the module that owns it; other modules read it through imports and change it only through that module's functions (`setData`, `setOpenEdit`, `setSetCtx`, `setFilter`). ESLint's `no-import-assign` catches a direct write.
- The app never uses the phone's alert boxes; `ask()` shows a short sheet instead. Discarding something happens at once with Undo rather than a question.
- Accessibility: every control has a VoiceOver name, panels are labelled dialogs that take focus and close with Escape, focus is always outlined, red text meets contrast in both themes, and Reduce Motion turns animation off.
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

## Credits

- Lyrics: [LRCLIB](https://lrclib.net). Fetched only for Get the song, stored on the phone, never shared by Tabs.
- Tempo data by [GetSongBPM.com](https://getsongbpm.com). Optional free key from [getsongbpm.com/api](https://getsongbpm.com/api), kept on the phone and out of backups.
- Weather data by [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0). Only the chosen city's position is sent, once a day.
- Strum it uses [Basic Pitch](https://github.com/spotify/basic-pitch-ts) by Spotify and TensorFlow.js (both Apache-2.0), bundled into `vendor/basic-pitch/` by `.github/workflows/vendor-bp.yml`.

## License

MIT
