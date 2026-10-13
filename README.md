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
- Tuner: hears your guitar through the microphone, with Standard, Drop D, half and whole step down, DADGAD, Open G and Open D. Tap a string to hear its note. It shows up where tuning happens: a button on the library (with a dot when you haven't tuned for a few hours), a chip on songs in another tuning, the set page, and the Next up card, which waits instead of starting when the next song needs a different tuning. A song's tuning comes from Edit, or a line like "Tuning: Drop D" in the sheet
- Listen: finds the song on Apple Music (Apple's public catalog search, no account), shows the best match to confirm, and saves the link. If the lookup can't run, it opens Apple Music's search, or you can paste an Apple Music, Spotify or YouTube link
- Metronome (••• menu): a steady click at the song's tempo while it scrolls
- Edit (••• menu) turns the song page into the editor: type the title and artist in place; key, tuning and tempo are chips; tap a word to add or change its chord (this song's chords first, then any chord); the pencil retypes a line; tap a section name to rename it; + adds a line or a section. Every change saves at once with Undo. Text switches the same page to the song as plain text for big jobs (chord lines shown in copper, Clean up and Scan a page on hand); switching either way keeps the line you were on in place, and the text changes can be undone in one step
- Stage mode (Settings, or under Play set): larger, brighter text and nothing extra on screen; while a song plays, stray touches don't scroll and one tap doesn't stop it (tap twice to pause)
- In a set, the next song's title and first line show quietly near the end of each song
- Speed by song length (default): set how long a song takes (3:30 to start) and the scroll fits it; or switch to 1x style in Settings. Each song keeps its own setting
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
- Add songs in a slide-up sheet; delete from Edit (with Undo; deleted songs and sets stay in Recently deleted for 30 days)
- Optional AI help with your own Anthropic API key: Clean up a messy paste into a tidy chord sheet (with title, artist and key), Scan a page from a photo, Make it easier with a capo and simpler chords, or get a Spark amp tone for a song
- First launch adds an original sample song and shows one-time tips on the real controls (Settings > Show tips again)
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

- **Clean up** (paste card and New Song sheet): the pasted text is sent to a small, fast model and comes back as a chord sheet in this app's format. You can compare it with the original before saving, or undo it in the editor.
- **Scan a page** (New Song sheet): a photo of a songbook page or handwritten sheet is resized on the phone and read by a larger model, which handles images more accurately.
- **Make it easier** (song view, next to Chords in this song): the song's chord names and the chords you use most across your library go to a small model, which suggests a capo and up to four simpler substitutes. You see the shapes before and after, then Apply. Your sheet is never changed: the suggestion is stored with the song and can be turned off or tried again. No lyrics are sent.
- **Chord chart with AI** (when a search finds nothing): the song's title and artist go to a larger model with web search, which reads chord sites and returns sections, chords, key, capo, tuning, tempo and a strum pattern, with its sources. Only chord names and section names are kept (each token is checked), so no lyrics are ever copied. Charts can be wrong; check them by ear. Each one uses a few web searches, usually 5 to 15 cents. If your organization has turned web search off, an admin can turn it on in the Console under Settings > Capabilities.
- **What can I play next?** (search, before you type): the chords you play and your song titles go to a small model, which suggests well-known songs that use mostly those chords, with at most one new chord. Each has a Listen link and a Chart button.
- **Spark tone** (chip under the song title): the song's title, artist, key and chord names go to a small model, which suggests a starting tone for a Positive Grid Spark amp: amp style, five knobs, the pedal chain and a guitar tip. Saved with the song; dial it in on the Spark app. No lyrics are sent.

### About the API key

The key is stored in the browser's local storage and sent directly from the phone to `api.anthropic.com`, using Anthropic's header for browser access. That is a reasonable trade for a personal app with no server, but it has limits worth knowing:

- Anyone with the unlocked phone can read the key from Settings.
- Any script that ran on this page could read it. The app loads no third-party scripts and escapes all user text before display, which keeps that risk low, but it is not zero.

So use a key made only for Tabs, and in the Anthropic Console give its workspace a low monthly spend limit. If the phone is lost, revoke the key in the Console. Removing it in Settings only clears it from this phone. The key is not included in backups.

## Development

Open `index.html` through any static server (ES modules need http, not file://). Data lives in `localStorage` under `tabs-v1`. Older tab-only saves are migrated automatically.

Releases: `VERSION` in `core.js` and `CACHE` in `sw.js` must match (a test checks). You don't need to bump them by hand: when app files change on `main` without a bump, the `bump version` workflow raises the patch number in both and commits it. Bump by hand only for a minor or major release. The app opens from its saved copy, so a change only reaches installed apps through a new cache name. On the next launch, or when the app comes back to the foreground, it saves the new release in the background and offers to reload.

Tests: `node --test` (Node 18 or later, no dependencies). They cover chord parsing, transposing, wrapping and fingerings, the library data, the version matching the service worker cache, and that the app script parses. GitHub Actions runs them on every push to `main`.

## License

MIT
