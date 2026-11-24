# Painted guitarist

The player is one of 24 finished paintings in `genres/`: a man and a woman for each of 12 genres. The app picks the file from `data.me.genre` and `data.me.who` (`genreFile` in `guitarist.js`), and mirrors it for a left-handed player. Each picture is 800 by 800 with a transparent background.

The older layered part folders (hair, face, eyes, hats and the rest) and `manifest.json` were deleted on 2026-11-23 when the character builder was removed. The pilot try-outs are in `docs/guitarist-painted/pilots/`.

Some genres have newer pictures under `-v2` or `-v3` names; `GENRE_V2` in `guitarist.js` maps a genre to the file in use. Older versions of a picture stay in the folder until Grok removes them.
