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
| `durationSet` | boolean | You moved the length slider; the recording's length is then offered, not applied |
| `speed` | number | 1x speed style |
| `bpm` | integer 30 to 260 | Tempo, for the count-in and metronome. Typed, or tapped in Edit |
| `tuning` | key of `TUNINGS` | Missing means standard |
| `favorite` | boolean | |
| `created` | ISO date | |
| `listen` | `{ url, service, title?, artist?, art?, length? }` | `url` and `art` are https only; `length` is the recording's, in seconds |
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

Defaults are in `DEFAULT_SETTINGS` in `core.js`. The tuner keeps `tunerMode` (`"acoustic"`, `"electric"` or `"chromatic"`), `tunerGuided` (boolean), `a4` (pitch reference in Hz) and `lastTuned` (time). `tipsSeen` and `used` record which one-time tips have shown and which features you've used, so tips and menu dots appear only when they help. `theme` is `"auto"` (follow the phone, the default), `"dark"` or `"light"`; `micExplained` notes the tuner has explained the microphone. `v` is the save format version (now 6); `migrate()` in `core.js` upgrades older saves, one step per version.

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
