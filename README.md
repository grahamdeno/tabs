# The Road

A guitar app for the phone about making it big: play songs through, light up your Tour Map, and work your way from the Garage to the Festival stage. Chord sheets and tabs, offline, everything on the device, no account.

## Version 3: The Road

Version 3 is The Road (before it, the app was Tabs, versions 1 and 2). It began with 2.50.0 and is numbered 3 from 3.0.0:

- Tonight is home, with Louie the amp, one song up next and a big Play (2.51.0).
- The Tour Map: a real map you can pinch and drag, venues for each ring (2.50.0).
- Your scene: rival players and turf you have to hold (2.52.0).
- A play counts only when a song is played through by auto-scroll, and plays of deleted songs stay in your week and streak (2.48.0).

Live at `https://grahamdeno.github.io/tabs/` (GitHub Pages from `main`). Add it to the home screen to use it as an app.

## What it does

### Library
- The app is called The Road (it was Tabs): making it big, on tour. Your library, backups and links carry over unchanged.
- Tonight (home): one fixed screen that never scrolls. Your streak, Louie (the little amp who cheers you on), Tonight's run: one song with three lamps (Tune, Soundcheck, Play). The button follows your day: Start soundcheck (with a small Skip to the song), then Play, and once you've played, a Practice more link. Louie names the chord switch to warm up for the song. Swiping up from the very bottom edge to change apps no longer moves the Library drawer, and a small picture of your Tour Map with the venue you're at. The header has the neck, Your playing, Tuner and Settings; search and add are at the bottom as in the Library. The Library is a tall drawer along the bottom edge. Shut, it shows only its handle and title; its contents fade and rise into view as it opens. Drag it up (it follows your finger, and a flick finishes the move), or tap the handle; inside is the real Library with its chips, sets and song list. Scroll the list; pull down from its top, drag the handle, tap the dimmed Tonight or press Escape to close. A new library gets Louie waving and the first song ready. A song opened from Tonight goes back to Tonight; from the Library page, back to the Library.
- Practice mode (3.21.0): the Practice chip under a song's title turns it on (a song marked Learning starts with it on). One Practice row sits above the bar, and stays while the song plays: the section to loop (tap to pick one, by line or by a section name), the speed (100% down to 50%, for the recording or the band and the page alike), Build up, and off. Off, the song plays straight through and the section is kept for next time. Practice time counts on the Tour Map. The speed that used to be in the Recording sheet moved here.
- The neck's Learning list (3.21.0): every song marked Learning, with its cover, the one thing to do next (the section and speed you left it at) and plays toward five. A tap opens the song in Practice mode.
- Scales on the neck (3.21.0), their own track, open from the start: A minor pentatonic, G major pentatonic, C major, A natural minor and the A blues scale. Each lesson shows the notes on the neck, plays the scale (Hear it), then listens as you play it up and back down, one note at a time.
- The neck (3.6.0, #/practice): the permanent place to practice. Frets are lessons and inlays are level checks (play a real song through). Open chords (G, C, D, Em, Am, E, A), then Chord switches; Strumming, Picking and Fingerstyle and barre are shown as coming. A chord lesson asks for one string at a time, lowest first (tap a lamp to pick another), and, like the tuner, reads the pitch only near that string, so a note heard an octave low can't light the wrong lamp (3.8.4). A lamp lights when its string rings clean; otherwise it says the string is ringing open, a fret off, or buzzy. A switch lesson plays a short high click (3.8.4: bright enough to hear over the guitar) with two chords taking turns and listens for a strum on each first beat. The hi-hat sits far above the guitar and the microphone listens only below 1.5 kHz, so the beat isn't mistaken for you (3.8.2: the full drums' kick reached the mic as loud as a strum); the count-in bar measures what is left of it, the strum nearest each 1 is the one graded, so a strum pattern around it is fine (3.8.4); a clean round (6 of 8 on the beat) speeds up 10 BPM, and a clean round at the target tempo passes. It hears when you play, not which chord. "I can't hear it, I got it" is always there. Chords you already play in songs count as known.
- What I hear (3.8.0, on the neck): the microphone, live. The level with the line a strum has to cross, the note and how far off it is, and each strum caught, over the last four seconds. Pick a chord to see which of its strings light. Strum with the beat plays a quiet bar to learn how the beat leaks into the mic, as a switch lesson's count-in does, then four bars to strum on the 1, graded like a lesson. The strum line rises only for the moment just after each tick, so a strum between ticks counts as it would with no beat (3.8.3). Copy readings puts a short summary on the clipboard to send, so the listening can be tuned to a real phone and guitar. The lessons and this page share one set of listening numbers (`HEAR` in `core.js`). Since 3.8.1 every line sits a little above the room's own noise, as the tuner's does, so a phone that picks up very little still hears the guitar. Nothing is recorded or sent.
- The Library is a sheet along the bottom of Tonight, under the search bar, in thumb reach. Tap it or swipe it up and the Library slides up over Tonight; swipe down from its top (or tap Back) and it slides away again (3.1.0, a full-width sheet in 3.2.0).
- The icon, favicon and launch screens are a black leather pick with copper piping and "The Road" in cream script, on black leather; the share card carries the pick too (3.2.0, new art in 3.7.0).
- The bottom bar searches, or takes a pasted chord sheet and works out its format, key, sections, title and artist.
- Search moves the bar to the top so results sit above the keyboard. It matches titles and artists first, then lyrics (showing the matching line). When nothing matches, it offers the web, Ultimate Guitar or Chordify, then Get the song.
- Filters for All, Sets, Favorites, Learning and Tabs, each with a lamp lit on your pick. Sort A to Z, by artist (a leading "The" is ignored), recently played or most played. Long lists get a letter index on the right edge.
- Swipe a song left to delete it (a long swipe deletes at once, with Undo), right to toggle Favorite.
- Tour Map (Your playing > Tour Map): every song you play through lights a hexagon (250 m across) on a map. Rings grow with the square root of your plays, and each ring is a venue: Garage, Open mic, Coffeehouse, Club, Theater, Arena, Stadium, Festival headliner. Lit ground glows warm with a piped outline, the newest hexagon has a lamp, and the next ones are dashed. Pinch, drag and the zoom buttons work; the page itself stays still. It is on from the start on plain ground with no location and no map pictures. "Plant your flag" asks for your position once, keeps it to about a kilometre on this phone only (never in a backup), and puts the turf on an OpenStreetMap map; OpenStreetMap sees the area shown, never your plays. A play counts only when a song is played through by auto-scroll, and plays of deleted songs still count toward your week and streak. Practice counts too (3.19.0): every 4 minutes of practice (lessons, drills and What I hear on the neck, or looping a section of a song) counts as a play.
- Your scene, on the Tour Map: the other players are simulated, seeded from your area. A population estimate for each hexagon (Natural Earth populated places, bundled, nothing sent) gives the local guitarists (6% of people, an assumption; [YouGov 2022](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music) found about two in five who learned guitar still play) and how much they practise (an assumed spread around 10 minutes a day). 4 to 12 rival players live around you, each with a habit (most days, weekends, now and then, new and keen, gone quiet, back at it), simulated day by day so their turf grows, shrinks and goes quiet like real players'. Tap a rival's badge to see who they are. Your plays still light hexagons; holding them is the contest: your edge is under pressure from the local bar or a stronger rival next door, and after 7 days in a row with your daily average below it, the edge is lost (never your home hexagon, and not in your first week). At the bottom of the Tour Map (3.5.0): the venue and plays to the next one, and a sheet with the next takeover: the nearest rival corner your turf grows into, how many songs and about how many minutes take it, and a Play button for today's pick. Tap the rival's badge to fly the map there. Pull the sheet up (drag or tap) for the song to start with, what daily average holds the corner, your scene this week ranked by minutes a day (you always shown), how many hexagons you hold and how many guitarists live around you; Forget my spot is there too. Tonight shows your rank, and Louie warns you when your edge is under pressure.
- Today, under the title: a week of dots and your practice streak (a day counts when a song plays to its end), and until you've played, one song to try. The pick can follow the time of day, the weather for a city you set (Open-Meteo, once a day, never your location unless you plant your flag on the Tour Map), a change you rarely play, or a Learning song left too long. Tap the line for Changes: the chord changes you played this week and the ones your songs have that you play least.

### Playing a song
- Chords sit over the words in copper, chord-over-lyric or inline `[G]` style. Lyrics wrap at full size with each chord riding its word; tabs wrap a measure at a time with string names on every row.
- Auto-scroll by song length (default; it fits the scroll to how long the song takes) or by speed. Each song keeps its own, from 1:00 to 15:00 (3.19.0; it was 8:00), to the second. Linking a recording sets the length from the track.
- Tap anywhere to pause. Count-in from the top, a metronome at the song's tempo (a click or a drum beat, with its own volume, in Settings > Playing: Auto picks rock, half time, a ballad with a side-stick, or four on the floor from the song's tempo and style, songs counted in 6 or 12 get a 6/8 feel, Swing lays the off-beats later, and Drop-out practice silences every other bar; Bass adds a synthesized bass guitar that plays the root of each chord at its sounding pitch (capo and slash chords counted), a bar per chord on chord-only rows and by the page's progress over lyrics, in Auto, Root, Root and fifth, Pulse or Walking, with its own volume, a Bass only mode, and a Bass line item in the song menu; each song can have its own drum beat, swing and bass: the AI finds how a song feels the first time it plays with the metronome or bass on (and when you add it), keeps it on the song, and Edit shows it with a Found mark, lets you change any part, and can find it again; a song whose bass is built on a repeating figure can have a Riff, one bar of sixteenth-note steps in chord degrees (root, third, fifth, flat seventh, octave) that the AI suggests as a general shape, never a transcription, and that you draw or change in Edit; it follows Build up, and a song with no tempo gets one looked up), transpose with sharps or flats chosen by the resulting key, text size, practice a section (with Build up from 80% speed), and a song map on the right edge to jump between sections.
- Chord help: Chords in this song (a strip of fingerings under the title), Now and Next diagrams while playing, a diagram over each chord on the line you pause on, and tap any chord for its fingering.
- Focus current line: the current line is heavier and the rest dim, without ever changing how lines wrap.
- Stage mode: larger, brighter text and nothing extra; stray touches don't scroll and one tap doesn't stop a song.
- One-handed controls on a phone held upright: the song bar is one row (3.20.0): Back, Now and Next chords, the song length (and "1 of 9" in a set), More and Play. Favorite is the heart beside the title, and the key is the "Key A" button under it (tap for the key dial; text size for a tab is in More). Press Play and the bar folds into the lower right corner (3.19.0), leaving Play and one button beside it: the next song in a set, otherwise the Library. Pausing brings the bar back. At the top of a paused song, pull down to go back. (The hold-Play ring, the arc, the island and Play following your hand are gone.)
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

### Your playing
- The pick button on the library opens Your playing: hours played, songs played and your streak in a gold plate, then your newest milestones (a first chord, a song you've got).
- Chord passport: every chord you've played, how often, and the day of the first, with barre chords marked and the next common chord to earn.
- Your changes (the switches you make most), when you play (day and time of day, longest streak, best month), keys and tempo (where you live and whether your tempo is rising), repertoire over the last year, go-to songs next to ones worth another try (each opens the song), sets, and which string drifts most when you tune.
- Once a day, after the first song you play to the end, a streak celebration: a flame runs up the G string to the 12th fret, bursts into fireworks and settles as a burning pick that grows with the streak (a white-hot core from 30 days). The count, a week of lamps, the next milestone (7, 30, 100, 365 days) and a share picture. Not on stage, in Play together or mid-set; Settings > Playing turns it off.
- Share my playing makes a picture of the headline and your passport for the share sheet. Everything is worked out on the phone; nothing is sent unless you share it.

### Listening and sharing
- Listen searches Apple Music's public catalog inside the app, plays 30-second previews, and saves the right recording with its album art and length. Spotify or YouTube links can be pasted too.
- Apple Music (optional, off by default; its own row in Settings since 3.17.0): with a subscription, a song with a linked Apple Music track gets the Recording chip under its title: the album cover, and Recording or Band for what Play starts (lit for the recording). Tap it for the Recording sheet (3.16.0): the cover with genre, year and composer on a wash of the album's color; Listen, to hear the recording without the page moving; When you press Play, The recording or The band (your metronome, drums and bass); the recording's Speed, 50 to 100%; and Sync, the spots the page has learned, with Reset. Pressing Play starts the recording with the scroll and pausing pauses it (3.10.0); Play never starts the recording and the band together (3.11.0). While the recording plays the page follows its clock, so a pause, stall or skip in Apple Music moves the page with it, and a big move of the page jumps the recording there (3.12.0). A small nudge is a correction: the place and the recording's time are saved for the song and the page follows them from then on (3.13.0). Practice a section loops the recording with the page, and Build up slows it on early passes; the loop banner shows the cover when the recording is in it (3.14.0). The search screen lists what you played lately in Apple Music; tap one to search for it (3.15.0). Each line is timed to the recording (3.17.0): the song's synced lyrics from LRCLIB (the same recording, length within 3 seconds) are matched to the sheet's lines in order and only the times are kept, so the page follows the recording line by line; your nudges win where they disagree, and the Recording sheet shows how many lines are timed. Chords are timed too (3.22.0): each chord gets the time of the word it sits on (the line's time shared out by syllables, or the lyrics' own word times when LRCLIB has them), on the beat of the recording's measured tempo, so Now and Next changes chord on its beat inside a line. The recording is measured (3.18.0): its 30-second preview gives the tempo, the feel (straight or swung) and the key. The Recording sheet shows them; when the sheet is in another key or tempo it says so, with Match it / Use buttons, and the chip's cover gets a small amber dot. A song with no tempo takes the recording's, and the drums and bass swing as the recording does unless the song has its own groove. Apple's preview files may not be readable from a web page, so the token Worker's `/preview` route passes them along (redeploy the Worker once; see `worker/README.md`). If Apple's player can't change speed, the Speed row says so and the recording plays at full speed. There's no volume control: iPhone only lets the side buttons set it. MusicKit also fetches a certificate bundle from `s.mzstatic.com` and streams from Apple's CDNs, so those hosts are allowed in the page's security policy (3.10.2). It needs a small token Worker (`worker/README.md`). Off, nothing is loaded or sent, and none of this shows.
- Share a song or a set as a link. The song travels inside the link; no server. Opening one offers to add it.
- Play together: pick a start a few minutes ahead and share the link. Both phones count in and scroll together, each by its own clock.

### Help and settings
- Tips appear once, at the moment they're useful, spaced out and never while a song plays. Settings > Help > Tips & gestures lists every gesture with Show me.
- Settings is a short menu (Playing, Chord diagrams, Look, New songs, Today, Keys, Library and backups, Help), with Back up now at the bottom in thumb reach.
- Theme follows the phone, or set Dark or Light. Amp covering (Settings > Look) adds a tolex grain behind everything.

## Look

Dark glass with copper for what you play, and the details of a guitar amp. Every screen draws from the same materials, defined once at the top of the amp theme in `styles.css`:

- **Piping:** a thin bronze edge on bars, lists, cards and sheets.
- **Plate:** brushed gold, like an amp's front panel (the song bar, the editor's bar, the add button's frame, Play next's level switch).
- **Recess:** dark wells set into a plate.
- **Copper:** the main action (Play, Save, add, primary buttons).
- **Chrome:** amp-control buttons (the editor's tool buttons). Light metal in the light theme.
- **Lamp:** the amber jewel lamp, off, warming or lit (the song bar, filter chips, Play next, Get the song).
- **Tolex:** black pebbled covering for result cards.

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
| `profile.js` | Your playing: the profile page and its share card (numbers from `profileOf` in `core.js`) |
| `fold.js` | One-handed: the bar folds into Play's corner while playing; pull down at the top to go back |
| `dial.js` | The corner dial (speed meter, key, set picker) |
| `findai.js` | Play next, chord charts, Get the song |
| `aitools.js` | Make it easier, Spark tone |
| `tuner.js`, `heads.js` | Tuner and headstock drawings |
| `sketch.js`, `strum.js` | Sing it, Strum it (`strum.js` loads `vendor/basic-pitch/`) |
| `german.js` | German practice |
| `crop.js` | Cover photo framing |
| `sw.js` | Offline copy; lists every app file (a test checks the list) |
| `worker/` | The MusicKit token Worker for Apple Music (deployed by hand; see `worker/README.md`) |

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
