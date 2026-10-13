# Tabs

A personal chord sheet and guitar tab PWA. Offline-first, localStorage only, no accounts.

Paste chord sheets (or ASCII tabs), transpose, auto-scroll, and add to your home screen.

Built in the same style as [threads](https://github.com/grahamdeno/threads) and [scales](https://github.com/grahamdeno/scales).

## Live

Once GitHub Pages is enabled on the `main` branch (root), the app will be at:

`https://grahamdeno.github.io/tabs/`

## Features

- No tab bar: the library is home, with a bottom bar that searches or takes a pasted song
- Paste a chord sheet into the bar and Tabs detects format, key, sections, title and artist, then offers to save it
- Chord sheets first: chords in the accent color over the lyrics, chords-over-lyrics or inline `[G]` style
- Recent songs, favorites, Learning and Tabs filters on the library
- When a search finds nothing, Tabs offers to look for it: Search the web, Ultimate Guitar or Chordify. Copy the chord sheet there and come back; Tabs offers to paste what you copied
- Tapping the search bar moves it to the top and folds the library away, so results sit between the bar and the keyboard (before you type, it shows recently played songs; Cancel returns to the library). Search finds titles and artists first, then songs with those words in the lyrics, showing the matching line (chords are ignored)
- Sort the library A–Z, by recently played, most played, or key (remembered)
- When a song plays through, a quiet note at the end says so ("Played through · 3rd time this week"). No badges or streaks
- Learning status per song (Learning / Got it, tap the chip under the title); a play is counted when a song is played through, and the library quietly shows plays this week
- Slim playback bar: auto-scroll, transpose (or text size for tabs)
- Tap anywhere on the song to pause while it plays (no button to aim for)
- Song map: a thin rail on the right edge with a dot per section; touch it to see the section names, slide to one and let go to jump
- Large libraries: with 12 or more songs, Key and Tuning chips join the filters (only when there's more than one to pick), so "everything in Drop D" is one tap. Sorted A to Z with 25 or more songs, an index on the right edge jumps to a letter as you touch or drag it, with a light tick on each letter
- Theme: Automatic (the default) follows the phone's light or dark appearance; Dark and Light override it (Settings > Appearance)
- The first time the tuner opens, it says why it needs the microphone (and that nothing is recorded or sent) before the phone asks; if it's been turned off, it says how to turn it back on
- Tuner: three ways to tune, chosen with tiles at the top. **Acoustic** (the default) and **Electric** show the guitar's headstock: the key to turn lights copper, its string lights down to the nut, and the words say Tighten or Loosen. **Guided** (on by default) walks the strings low to high and moves on once a string has held in tune for a second, with a soft chime; turn it off and it follows whichever string you play. Near the note (within 5 cents) the meter becomes a strobe whose stripes stand still when the string is right. Tap a key to hear its note. **Chromatic** reads any note on any instrument, with an adjustable pitch reference (A4, 430 to 450 Hz). Tunings: Standard, Drop D, half and whole step down, DADGAD, Open G and Open D. The tuner shows up where tuning happens: a button on the library (with a dot when you haven't tuned for a few hours), a chip on songs in another tuning, the set page, and the Next up card, which waits instead of starting when the next song needs a different tuning. A song's tuning comes from Edit, or a line like "Tuning: Drop D" in the sheet
- Listen: finds the song on Apple Music (Apple's public catalog search, no account), shows the best match to confirm, and saves the link. If the lookup can't run, it opens Apple Music's search, or you can paste an Apple Music, Spotify or YouTube link
- Metronome (••• menu): a steady click at the song's tempo while it scrolls
- Edit (••• menu) turns the song page into the editor: type the title and artist in place; key, tuning and tempo are chips; tap a word to add or change its chord (this song's chords first, then any chord); the pencil retypes a line; tap a section name to rename it; + adds a line or a section. Every change saves at once with Undo. Text switches the same page to the song as plain text for big jobs (chord lines shown in copper, Clean up and Scan a page on hand); switching either way keeps the line you were on in place, and the text changes can be undone in one step
- Stage mode (Settings, or under Play set): larger, brighter text and nothing extra on screen; while a song plays, stray touches don't scroll and one tap doesn't stop it (tap twice to pause)
- In a set, the next song's title and first line show quietly near the end of each song
- Speed by song length (default): set how long a song takes (3:30 to start) and the scroll fits it; or switch to 1x style in Settings. Each song keeps its own setting
- Song length from the recording: linking a song to Apple Music (Listen) sets its length from the track, so song length speed starts close. If you've already set your own length it's offered instead ("Use 3:52"); songs linked earlier pick it up the next time they open
- Tap tempo: in Edit, tap the Tap chip along with the beat; after four taps it settles a moment after the last one, with Undo
- Count-in: one bar of soft clicks at the song's tempo (set in Edit; 90 if unset) before scrolling starts, only when starting from the top (the first line is on screen); starting partway through scrolls right away
- Transpose per song, with sharps or flats chosen by the resulting key
- Lyrics wrap to the screen at full size, with each chord riding on its word; words never split
- Tabs wrap a measure at a time, all strings together, with string names on every row
- Chord diagrams: while playing, a fixed Now and Next panel above the controls shows the chord at the reading line and the next ones (off by default; toggle it from the player or Settings); when paused, the line you're on shows a diagram over each chord, and you can tap any chord for its fingering
- Focus current line (Always, While playing, or Off): the current line is heavier and slightly larger, and the rest dim. It never changes how lines wrap, so nothing below jumps; when paused, tap a line to focus it and play starts from there
- Chords in this song: a strip under the title shows each chord's fingering once, in order of first use; tap a card to mark everywhere that chord is played
- Song header keeps just back and favorite; everything else is in the ••• menu: text size (lyrics and chords together), add to set, practice a section, share, edit, and Make it easier and Spark tone with an API key
- Practice a section (••• menu): tap a section name, or a first and last line, and play repeats it, with a copper bracket in the margin. Build up starts at 80% speed and adds 5% each pass until full speed
- Share a song (••• menu) or a set (share button on the set): the song travels inside the link itself, with no server or account. Opening the link offers to add it; nothing is added without a tap. Your plays, favorites and AI suggestions stay with you. On iPhone, a Home Screen app keeps its own library, so paste the link into Tabs' search bar to add it there
- Set covers: every set gets a cover drawn from what's in it (one ring per song, colored by its key, with the set name in the title font)
- Up next: give a set a date and place, and the library opens with it on top ("Up next · Fri 8:00 PM · in 3 days") with one-tap play; your other sets sit on a shelf of covers below
- New set: a sheet where the cover takes shape as you type the name, with optional When and Where, and Start from Favorites, Learning or Played this week. Tap a set's title later to change its details
- Add songs to a set: the cover at the top grows a ring for each song you pick, the length adds up, and songs go in the order you tap them
- Set page: the cover is the hero and the page takes its color. Change cover: from songs, the songs' album art (from Listen links), a photo, or the camera, framed with drag and pinch. Photos are kept on the phone and included in backups
- Play set opens with a short title card (the cover, the set, what's first; tap to skip)
- After a set is played through, it remembers: a Played stamp on the cover, times played, last run time, songs played, a note for next time, and Play again
- Setlists: group songs into sets (Sets in the library), reorder, and Play set; at the end of each song a Next up card plays the next one after 5 seconds. Add a song to sets from its header
- Smooth screen changes: the song title glides between the library and the song, and sheets settle with a light spring (instant with Reduce Motion)
- + opens a blank song in the same editor as Edit, in the Text view: paste or type, and the key (or Format: Tab) is detected as you go. Save keeps it; Cancel removes it (asking first if you typed anything). Tab songs edit in the same page, in the Text view. Delete from Edit (with Undo; deleted songs and sets stay in Recently deleted for 30 days)
- Optional AI help with your own Anthropic API key: Clean up a messy paste into a tidy chord sheet (with title, artist and key), Scan a page from a photo, Make it easier with a capo and simpler chords, or get a Spark amp tone for a song
- Help that stays out of the way. The first song asks you to try one thing, tapping a chord (if you don't, its diagram appears to show you), then points at Play. Everything else is shown once, at the moment it's most useful, with a brief spotlight and the real feature doing its thing: the pause badge on your first play, a line mid-screen in the real focus look on your first pause, Now and Next fading in on a later pause, the section names on the song map, the strobe in the tuner, and Tap tempo tapping out 92 BPM in your first Edit (with a haptic tick where the phone allows; your real taps tick too). After your first song, search invites a tap and then shows everything it can do. Tips are spaced at least 30 seconds apart unless one leads into the next, never appear while a song plays (except how to pause), and skip anything you already use. Menu items you haven't tried carry a small dot. Settings > Tips & gestures lists every gesture, with Show me to replay a tip where it happens, and Reset tips
- Settings (gear, top right), grouped as Playing, Chord diagrams, Defaults for new songs, Appearance, AI help and Library
- While playing, the header, title and chord strip dim and turn grey, and the player controls fade after 3 idle seconds (play/pause stays bright; any touch brings them back)
- Keeps the screen awake while scrolling; offline after first load; installable on iOS and Android, with a proper launch screen on iPhone
- Lyrics follow the phone's own text size setting; light mode colors meet contrast guidelines for daylight reading

## Chord sheet format

```
[Verse]
G              C        G
Blackbird singing in the dead of night

[Chorus]
[C]Take these [G]broken wings
```

## AI help (optional)

Settings > AI help > paste an Anthropic API key > Save key. Without a key the app works the same and the AI options stay hidden.

- **Clean up** (paste card and the editor's Text view): the pasted text is sent to a small, fast model and comes back as a chord sheet in this app's format. You can compare it with the original before saving, or undo it in the editor.
- **Scan a page** (the editor's Text view): a photo of a songbook page or handwritten sheet is resized on the phone and read by a larger model, which handles images more accurately.
- **Make it easier** (song view, next to Chords in this song): the song's chord names and the chords you use most across your library go to a small model, which suggests a capo and up to four simpler substitutes. You see the shapes before and after, then Apply. Your sheet is never changed: the suggestion is stored with the song and can be turned off or tried again. No lyrics are sent.
- **Chord chart with AI** (when a search finds nothing): the song's title and artist go to a larger model with web search, which reads chord sites and returns sections, chords, key, capo, tuning, tempo and a strum pattern, with its sources. Only chord names and section names are kept (each token is checked), so no lyrics are ever copied. Charts can be wrong; check them by ear. Each one uses a few web searches, usually 5 to 15 cents. If your organization has turned web search off, an admin can turn it on in the Console under Settings > Capabilities.
- **What can I play next?** (search, before you type): the chords you play and your song titles go to a small model, which suggests well-known songs that use mostly those chords, with at most one new chord. Each has a Listen link and a Chart button.
- **Spark tone** (chip under the song title): the song's title, artist, key and chord names go to a small model, which suggests a starting tone for a Positive Grid Spark amp: amp style, five knobs, the pedal chain and a guitar tip. Saved with the song; dial it in on the Spark app. No lyrics are sent.

### About the API key

The key is stored in the browser's local storage and sent directly from the phone to `api.anthropic.com`, using Anthropic's header for browser access. That is a reasonable trade for a personal app with no server, but it has limits worth knowing:

- Anyone with the unlocked phone can read the key from Settings.
- Any script that ran on this page could read it. The app loads no third-party scripts, escapes all user text before display, and sets a content security policy: only the app's own scripts run, the page can only talk to `api.anthropic.com` and Apple's song search, and images only come from the app, your photos and Apple's album art. That keeps the risk low, but it is not zero.

So use a key made only for Tabs, and in the Anthropic Console give its workspace a low monthly spend limit. If the phone is lost, revoke the key in the Console. Removing it in Settings only clears it from this phone. The key is not included in backups.

## Development

Open `index.html` through any static server (ES modules need http, not file://). Data lives in `localStorage` under `tabs-v1`; [docs/DATA.md](docs/DATA.md) describes every field, the backup file and how restoring checks it. Older saves are migrated automatically.

Layout, with no build step:

- `index.html`: the page shell and content security policy.
- `styles.css`: all styles.
- `core.js`: data, parsing, transposing and other logic with no screen code (unit tested).
- `app.js`: the screens. Features register their own tidy-up for leaving a screen (`onLeave`) and their scroll work (`onScroll`, one listener, once per frame).
- Loaded on first use: `tuner.js` (with `heads.js`, the headstock drawings), `findai.js` (find songs, chord charts, what to learn next), `aitools.js` (Make it easier, Spark tone), `crop.js` (cover photo framing).
- `sw.js`: the offline copy; it lists every app file, and a test checks the list.

Releases: `VERSION` in `core.js` and `CACHE` in `sw.js` must match (a test checks). You don't need to bump them by hand: when app files change on `main` without a bump, the `bump version` workflow raises the patch number in both and commits it. Bump by hand only for a minor or major release. The app opens from its saved copy, so a change only reaches installed apps through a new cache name. On the next launch, or when the app comes back to the foreground, it saves the new release in the background and offers to reload. Until you reload, the open app keeps loading its remaining parts (the tuner, AI tools) from its own release: they're requested as `tuner.js?v=1.2.3`, and the service worker keeps the previous release's cache for this.

Wide screens: from 700px wide (iPad), text is larger and the page wider. From 1000px, the song gets a rail on the right with Now and Next and its chords; from 1150px, a list of songs (or the set being played) on the left switches songs without going back. A phone on its side gets a slim column of controls on the right, with the speed slider upright. Editing on a wide screen uses a centered column. Rotating moves everything back.

Accessibility: every control has a name for VoiceOver; panels are labelled dialogs that take focus and close with Escape; the song menu works with arrow keys; keyboard focus is always outlined; red text meets contrast in both themes (`--bad`); the tuner announces its advice, not every note; Reduce Motion turns animation off.

Pedals and keyboards: a Bluetooth page-turner pedal pairs as a keyboard. On a song, the left pedal (Page Up, ← or ↑) or Space plays and pauses; the right pedal (Page Down, → or ↓) goes to the next section, and holding it goes back one. Keys are ignored while typing, editing or with a panel open.

Questions: the app never uses the phone's alert boxes. `ask()` in app.js shows a short sheet (a field with quick picks and a live chord diagram, or a yes/no with a red button). Discarding a new song happens at once with Undo instead of a question.

Storage: the library is saved to localStorage and, on every save, to a safety copy in IndexedDB. At launch, a missing or unreadable save, or one whose last write failed because storage was full, is restored from the copy. See docs/DATA.md.

Problems: errors are kept on the phone (last 20) and the first in a session shows a note with Copy details. A screen that fails to draw shows a way back instead of a blank page. Settings > Copy diagnostics copies the version, device, library counts, storage and problems, never song words, titles or the API key.

Tests: `node --test` (Node 18 or later, no dependencies) runs the unit tests. Browser tests run the real app in a phone-sized Chromium: `npm i --no-save playwright && npx playwright install chromium`, then `node --test tests/e2e/app.e2e.mjs`. They cover chord parsing, transposing, wrapping and fingerings, the library data, the version matching the service worker cache, and that the app script parses. GitHub Actions runs both on every push to `main`, plus ESLint (`npx eslint .`) for undefined or unused names.

## License

MIT
