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
- Recent songs, favorites and a Tabs filter on the library
- Slim playback bar: auto-scroll with speed, transpose (or text size for tabs)
- Transpose per song, with sharps or flats chosen by the resulting key
- Chord sheets auto-fit to screen width so chords stay over the right words
- Add and edit in a slide-up sheet; delete from edit
- Settings (gear, top right): scroll speed, default transpose, dark/light mode, backup
- Keeps the screen awake while scrolling; offline after first load; installable on iOS and Android

## Chord sheet format

```
[Verse]
G              C        G
Blackbird singing in the dead of night

[Chorus]
[C]Take these [G]broken wings
```

## Development

Open `index.html` through any static server (ES modules need http, not file://). Data lives in `localStorage` under `tabs-v1`. Older tab-only saves are migrated automatically.

## License

MIT
