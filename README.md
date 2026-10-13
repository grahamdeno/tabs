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
- Learning status per song (Learning / Got it, tap the chip under the title); a play is counted when a song is played through, and the library quietly shows plays this week
- Slim playback bar: auto-scroll, transpose (or text size for tabs)
- Speed by song length (default): set how long a song takes (3:30 to start) and the scroll fits it; or switch to 1x style in Settings. Each song keeps its own setting
- Count-in: one bar of soft clicks at the song's tempo (set in Edit; 90 if unset) before scrolling starts
- Transpose per song, with sharps or flats chosen by the resulting key
- Lyrics wrap to the screen at full size, with each chord riding on its word; words never split
- Tabs wrap a measure at a time, all strings together, with string names on every row
- Chord diagrams: while playing, a fixed Now and Next panel above the controls shows the chord at the reading line and the next ones (off by default; toggle it from the player or Settings); when paused, the line you're on shows a diagram over each chord, and you can tap any chord for its fingering
- Focus current line (Always, While playing, or Off): the current line stays bright and the rest dim; when paused, tap a line to focus it and play starts from there
- Chords in this song: a strip under the title shows each chord's fingering once, in order of first use; tap a card to mark everywhere that chord is played
- Text size per song (Aa in the song header), lyrics and chords together
- Setlists: group songs into sets (Sets in the library), reorder, and Play set; at the end of each song a Next up card plays the next one after 5 seconds. Add a song to sets from its header
- Add and edit in a slide-up sheet; delete from edit (with Undo; deleted songs and sets stay in Recently deleted for 30 days)
- Optional AI help with your own Anthropic API key: Clean up a messy paste into a tidy chord sheet (with title, artist and key), Scan a page from a photo, Make it easier with a capo and simpler chords, or get a Spark amp tone for a song
- First launch adds an original sample song and shows one-time tips on the real controls (Settings > Show tips again)
- Settings (gear, top right): starting speed, default transpose, dark/light mode, backup
- While playing, the header, title and chord strip dim and turn grey, and the player controls fade after 3 idle seconds (play/pause stays bright; any touch brings them back)
- Keeps the screen awake while scrolling; offline after first load; installable on iOS and Android

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
- **Spark tone** (chip under the song title): the song's title, artist, key and chord names go to a small model, which suggests a starting tone for a Positive Grid Spark amp: amp style, five knobs, the pedal chain and a guitar tip. Saved with the song; dial it in on the Spark app. No lyrics are sent.

### About the API key

The key is stored in the browser's local storage and sent directly from the phone to `api.anthropic.com`, using Anthropic's header for browser access. That is a reasonable trade for a personal app with no server, but it has limits worth knowing:

- Anyone with the unlocked phone can read the key from Settings.
- Any script that ran on this page could read it. The app loads no third-party scripts and escapes all user text before display, which keeps that risk low, but it is not zero.

So use a key made only for Tabs, and in the Anthropic Console give its workspace a low monthly spend limit. If the phone is lost, revoke the key in the Console. Removing it in Settings only clears it from this phone. The key is not included in backups.

## Development

Open `index.html` through any static server (ES modules need http, not file://). Data lives in `localStorage` under `tabs-v1`. Older tab-only saves are migrated automatically.

## License

MIT
