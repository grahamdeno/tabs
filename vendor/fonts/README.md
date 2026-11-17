Fredoka and Nunito from github.com/google/fonts (ofl/), SIL Open Font License 1.1.
Subset to Latin and saved as woff (weights 400 to 700 for Fredoka, 400 to 800 for Nunito).

## Road Ready fonts (added in Road Ready step 01)

Space Grotesk, Inter and IBM Plex Mono from github.com/google/fonts (ofl/), SIL Open Font License 1.1.
Source commit of google/fonts: 7af0d90b4d532ffa4b041937b560c6df4e7b1e95. The files there are TTF only, so each was subset to Latin and converted to woff2 with fontTools.

| File | Family | Source file in google/fonts | Weights kept |
|---|---|---|---|
| `spacegrotesk.woff2` | Space Grotesk | `ofl/spacegrotesk/SpaceGrotesk[wght].ttf` | variable, 500 to 700 |
| `inter.woff2` | Inter | `ofl/inter/Inter[opsz,wght].ttf` | variable, 400 to 700, optical size fixed at 14 |
| `ibmplexmono-600.woff2` | IBM Plex Mono | `ofl/ibmplexmono/IBMPlexMono-SemiBold.ttf` | 600 only |

Licences: `OFL-SpaceGrotesk.txt`, `OFL-Inter.txt`, `OFL-IBMPlexMono.txt`.

Upstream projects: floriankarsten/space-grotesk, rsms/inter, googlefonts/plex.

Subset: U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF, U+FFFD, all layout features kept.

Fonts are served from here only. The page's Content Security Policy allows `'self'` and nothing else, so never load fonts from a CDN. `sw.js` caches anything under `vendor/` in the `tabs-vendor` cache on first load, so they work offline after that.
