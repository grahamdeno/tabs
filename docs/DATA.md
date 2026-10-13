# Tabs data

Everything lives on the phone. Backups are the same data as one JSON file.

## Where it is stored

| Store | Key | Holds |
|---|---|---|
| localStorage | `tabs-v1` | The library: songs, sets, Recently deleted, settings |
| localStorage | `tabs.apikey.v1` | Your Anthropic API key. Never in backups or share links |
| IndexedDB `tabs-covers` | store `covers`, key = set id | Set cover photos as `data:image/...` URLs |
| Cache Storage | `tabs-vX.Y.Z`, `tabs-art` | The offline app, and album art from Apple |

Saves are batched (150 ms) and written at once when the app goes to the background.

## Library (`tabs-v1`)

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
| `duration` | seconds | Song length speed style |
| `speed` | number | 1x speed style |
| `bpm` | integer 30 to 260 | Tempo, for the metronome |
| `tuning` | key of `TUNINGS` | Missing means standard |
| `favorite` | boolean | |
| `created` | ISO date | |
| `listen` | `{ url, service, title?, artist?, art? }` | `url` and `art` are https only |
| `loop` | `{ a, b, build }` | Practice a section, line numbers |
| `easier` | object | Make it easier result: `{ on, capo, subs, note, before, after }` |
| `tone` | object | Spark tone result |
| `playLog` | `{ total, last, days: { "YYYY-MM-DD": n } }` | Last 60 days of counts |

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

Defaults are in `DEFAULT_SETTINGS` in `core.js`. `v` is the save format version (now 5); `migrate()` in `core.js` upgrades older saves, one step per version.

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
