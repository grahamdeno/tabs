Fredoka and Nunito from github.com/google/fonts (ofl/), SIL Open Font License 1.1.
Subset to Latin and saved as woff (weights 400 to 700 for Fredoka, 400 to 800 for Nunito).

## Road Ready fonts

Sora (headings) and Inter (text) from github.com/google/fonts (ofl/), SIL Open Font License 1.1.
Sora source file: `ofl/sora/Sora[wght].ttf`. It is a variable font, so SemiBold and Bold were instanced at weight 600 and 700, then subset to Latin and saved as woff2 with fontTools. Headings moved from Space Grotesk to Sora (Graham, 2026-11-24).

Inter source commit of google/fonts: 7af0d90b4d532ffa4b041937b560c6df4e7b1e95. The file there is TTF only, so it was subset to Latin and converted to woff2 with fontTools.

IBM Plex Mono is IBM's own, unmodified woff2 from github.com/IBM/plex (commit bc6a7e4b37634eb79785d59781893db63ee3edcb), SIL Open Font License 1.1. The licence reserves the name "Plex", so it is not subset or changed here.

| File | Family | Source | Weights kept |
|---|---|---|---|
| `sora-600.woff2` | Sora | `ofl/sora/Sora[wght].ttf`, instanced | 600 |
| `sora-700.woff2` | Sora | `ofl/sora/Sora[wght].ttf`, instanced | 700 |
| `inter.woff2` | Inter | `ofl/inter/Inter[opsz,wght].ttf` | variable, 400 to 700, optical size fixed at 14 |
| `ibmplexmono-600.woff2` | IBM Plex Mono | `packages/plex-mono/fonts/split/woff2/IBMPlexMono-SemiBold-Latin1.woff2` in IBM/plex, unmodified (IBM's Latin-1 range) | 600 only |

Licences: `OFL-Sora.txt`, `OFL-Inter.txt`, `OFL-IBMPlexMono.txt`.

Upstream projects: sora-xor/sora-font, rsms/inter, IBM/plex.

Subset (Sora and Inter only): U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF, U+FFFD, all layout features kept.

Fonts are served from here only. The page's Content Security Policy allows `'self'` and nothing else, so never load fonts from a CDN. `sw.js` caches anything under `vendor/` in the `tabs-vendor` cache on first load, so they work offline after that.
