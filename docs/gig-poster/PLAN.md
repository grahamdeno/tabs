# Gig poster: the guitarist and the maker, and Start from a selfie

Opus, Louie Product, 2026-11-19. Graham chose the Gig poster style (Grok's comparison) and asked Claude to plan, build, merge and ship this as an exception to the playbook's stage gates. It joins the Road Ready release.

## Standing rule (Graham, 2026-11-19)

Claude never edits, re-exports, resizes, recompresses, traces or cleans up any image under `art/`. Art changes go to Grok, on its own branch, from a note with the file path, what is wrong and what is wanted. Claude writes the code that uses the art.

## Epic

**Goal:** the guitarist and the maker stop reading as Duolingo and match black Louie and the Road Ready plate.

**Context:** today's guitarist has a ball head, googly eyes, blush circles, one expression, flat fills and mitten hands, and the maker is a stack of form rows.

**Out of scope:** new fields in `data.me`, a data migration, changes to how looks, patches or the Road guitar are earned.

## Stories

### 1. The guitarist as a gig poster

As a player, I want my guitarist drawn like a screenprinted show poster so that it looks like it belongs with Louie and the Road.

- Given any guitarist (yours or a rival's), when it is drawn at card size or bigger, then it is cream paper (#F6EEE0) with black ink line, amber ink (#FFB547), one spot ink, halftone shading, slight misregistration and paper grain.
- Given any guitarist, then the head is about one seventh of the figure, with small eyes with lids and brows, a nose, a mouth and no blush; the moods (happy, cheer, proud, sleepy, worried) show through brows, mouth and pose.
- Given the six skin tones, nine hair colours and eight top colours, then each tints its own ink.
- Given a saved `data.me` from before this release, when it loads, then the guitarist draws from it with no change to the stored data.
- Given small sizes (44 px card, 32 px chart row), then a small bust is drawn: no halftone, a heavier line, flat inks, the face filling a cream paper disc.
- Given the venue looks (tee, flannel, vest, leather, stage), patches and the Road guitar, then they are drawn in the same inks.

### 2. The maker

As a player, I want a maker that shows me as a poster while I choose so that making my guitarist is quick and fun.

- Given Opening night's "Who's playing tonight?", when it opens, then the top reads "OPENING NIGHT · 1 OF 6" in amber with Skip on the right, then the title.
- Then a big live preview: the guitarist on a cream "TONIGHT" poster card with an amber stage glow, a Random dice button on one corner and a Lefty flip (a real flip icon) on the other, and black Louie's face badge at a corner with one short line.
- Given the tabs Face (skin, beard, glasses), Hair (style, colour), Fit (top colour, hats, patches) and Guitar (shown, not picked), then each tab has one row of thumbnails drawn as small poster busts of you with that option, and a row of ink-blot swatches for colours.
- Given Opening night, then only Face and Hair show; the maker on Your profile shows all four.
- Then six starters, Random and Start from a selfie sit above the tabs.
- Then THAT'S ME is the cream plate button, with "Change anything later on Your profile" under it.
- Given both looks and the largest text size, then every control is at least 44 pt, labelled for a screen reader, and nothing clips. In Light, the cream poster has a hairline edge so it stands off the cream ground.

### 3. Start from a selfie

As a player, I want to start my guitarist from a photo of me so that it looks like me without picking every part.

- Given the button, when tapped the first time, then the face model loads (not before), the camera or photo picker opens, and one line says "Your photo stays on this phone and is never saved."
- Given a photo with a face, then the app guesses the skin tone (cheeks and forehead, snapped to the six skin inks), the hair colour (above the forehead and the sides, snapped to the nine hair inks) and a beard (the chin compared with the cheeks); it sets the preview and opens the Face tab. Nothing is saved until THAT'S ME.
- Given no face or a model that won't load, then it says "Couldn't read that one. Pick a starter instead." and stays in the maker.
- Then the photo is never stored (no IndexedDB, cache or upload) and is dropped from memory once the guesses are made, and no network call carries it.
- Then the model files are kept out of `SHELL` and cached the first time they load, so they work offline after that.

## Decisions (Claude, on Graham's go-ahead to decide)

- **Face model:** MediaPipe Face Detector (BlazeFace short range) through `@mediapipe/tasks-vision`, vendored in the repo (not under `art/`), loaded on first tap. It finds the face box and six key points, which is enough for skin, hair colour and beard. Face Landmarker is several times bigger and isn't needed for colours.
- **Guessing:** skin tone, hair colour and beard only. Hair style and glasses are not guessed; the player picks them.
- **Hair styles:** all 13 stay, since saved guitarists use them.
- **Light look:** a hairline edge on the cream poster.
- **Share card:** the full poster with the venue and the Road guitar. No name, since none is stored.
- **The 4.85.0 feel check:** folded into Graham's phone check after this ships.

## Steps

1. Grok: the Gig poster art, as ink layers, per `docs/gig-poster/ART-SPEC` in the Grok prompt (Louie Product, 2026-11-19). [Grok]
2. Grok: vendor the MediaPipe Face Detector files. [Grok]
3. Claude: the ink renderer, the small bust, the maker and Start from a selfie, with tests; the CSP allows the model's WebAssembly. [Opus]
4. Review, merge into `road-ready`, then `road-ready` into `next` and `next` into `main` on Graham's exception go (2026-11-19). [Opus]
