# Tabs

A personal chord sheet and guitar tab PWA. Offline-first, localStorage only, no accounts.

Paste chord sheets (or ASCII tabs), transpose, auto-scroll, and add to your home screen.

Built in the same style as [threads](https://github.com/grahamdeno/threads) and [scales](https://github.com/grahamdeno/scales).

## Live

Once GitHub Pages is enabled on the `main` branch (root), the app will be at:

`https://grahamdeno.github.io/tabs/`

## Features

- Chord sheets first: chords render in the accent color above the lyrics
- Accepts chords-over-lyrics or inline ChordPro style (`[G]Blackbird [C]singing`)
- Section labels like `[Verse]` or `Chorus:` are styled as headers
- Transpose per song, with sharps or flats chosen by the resulting key
- Key shown on the song page, auto-detected from the first chord if not set
- ASCII tab still supported as a second format, with text size control
- Library with search and favorites filter
- Auto-scroll with adjustable speed; keeps the screen awake while scrolling
- Edit and delete songs
- Settings: default scroll speed, default transpose, dark/light mode
- Export / import JSON backup (uses the share sheet on iOS)
- Fully offline after first load; installable on iOS and Android

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
