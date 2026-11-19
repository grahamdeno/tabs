# Louie design spec (round 10)

The guitar-learning app with a touring map called The Road. This spec covers the visual system, the components, the Merch catalog, how to use Louie, and SwiftUI notes. It targets iOS 17+ and SwiftUI.

Reference images are in `docs/road-ready/images/`: `r10-00` (Louie sheet), `r10-01` to `r10-10` (screens), and `r10-11` to `r10-19` (guitars, finishes, builder).

---

## 1. Principles

- **A real gig bag, not a game board.** Use tolex, grille cloth, chrome, pearl inlays and cream engraved plates. No coin paths and no cartoon UI chrome.
- **Encouraging, never guilt.** No streak-loss warnings, no sad faces, no "you missed a day". Progress only ever goes up.
- **Lyrics first while playing.** The playing screen is immersive. Controls hide on their own and come back with a tap.
- **Accessible by default.** Dynamic Type up to AX5, 44 pt targets, WCAG AA 4.5:1 for text (3:1 for large text and icons), Reduce Motion, VoiceOver, light and dark.

---

## 2. Colour tokens

Ratios are WCAG 2.x contrast ratios, computed against the surface named in the right-hand column.

### Dark (default)

| Token | Hex | Used for | Contrast |
|---|---|---|---|
| `surface.base` | #141210 | Behind tolex, playing background | n/a |
| `surface.card` | #1A1918 | Cards, list groups | n/a |
| `surface.mesh` | #2A2724 | Grille-cloth tab bar (average tone) | n/a |
| `line.hairline` | #46423C | Dividers | n/a (decorative) |
| `text.primary` | #F6EEE0 | Body text, titles | 16.2:1 on base, 15.2:1 on card |
| `text.secondary` | #BEB4A4 | Captions, artist names | 8.6:1 on card |
| `lyric.current` | #F6EEE0 | Current line, larger size | 16.2:1 on base |
| `lyric.upcoming` | #C9C0B2 | Next lines | 10.4:1 on base |
| `lyric.sung` | #8F877C | Lines already sung (dimmed, still AA) | 5.3:1 on base |
| `chord` | #FFC46B | Chord names above lyrics | 11.9:1 on base |
| `accent.amber` | #FFB547 | Active tab, current inlay glow, progress | 10.0:1 on card |
| `on.amber` | #1E160C | Text on amber fills | 10.2:1 on amber |
| `plate.cream` | #F6EAD2 to #D6C4A4 | Engraved primary button gradient | n/a |
| `plate.text` | #281E14 | Text on cream plates | 13.7:1 on cream |
| `tab.inactive` | #D6CCBC | Inactive tab icon and label on mesh | 9.4:1 on mesh |

### Light

| Token | Hex | Used for | Contrast |
|---|---|---|---|
| `surface.base` | #F6EFE2 | Cream tolex | n/a |
| `surface.card` | #FBF7EF | Cards | n/a |
| `surface.mesh` | #E7E0D4 | Light grille-cloth tab bar | n/a |
| `text.primary` | #1E1914 | Body, titles | 15.3:1 on base |
| `text.secondary` | #5C5248 | Captions | 6.7:1 on base |
| `lyric.sung` | #6E655B | Sung lines | 5.4:1 on card |
| `accent.amberText` | #763A00 | Amber text and active tab label in light mode | 7.7:1 on base |
| `accent.amber` | #FFB547 | Fills only (never small text on cream) | n/a |
| `on.amber` | #1E160C | Text on amber fills | 10.2:1 |
| `tab.inactive` | #4A4239 | Inactive tab on light mesh | 7.5:1 on mesh |

### Rules

- Never dim text with opacity. Use the `lyric.sung` or `text.secondary` token so the contrast stays known.
- Amber text in light mode is always `accent.amberText`.
- Wood and fretboard art sits under a 0 to 8 percent scrim, so inlay numbers keep 4.5:1. Engraved numbers on pearl use #5C3A16 on #FCCE80 (about 5.8:1).

---

## 3. Type

Fonts: **Space Grotesk** for display and headings, **Inter** for UI and lyrics, **IBM Plex Mono** for tuner and tempo readouts. Register them as custom fonts and scale with `Font.custom(_:size:relativeTo:)` so Dynamic Type works.

| Role | Font, weight | Default size (pt) | `relativeTo:` | Notes |
|---|---|---|---|---|
| Display | Space Grotesk 700 | 34 | `.largeTitle` | Show Complete title |
| Title | Space Grotesk 700 | 28 | `.title` | Screen titles |
| Title 2 | Space Grotesk 700 | 22 | `.title2` | Venue name in header |
| Headline | Inter 600 | 17 | `.headline` | Row titles, button labels |
| Body | Inter 450 | 17 | `.body` | General copy |
| Callout | Inter 500 | 16 | `.callout` | Inlay callout bubble |
| Subhead | Inter 500 | 15 | `.subheadline` | Artist names |
| Footnote | Inter 500 | 13 | `.footnote` | Tab labels (minimum) |
| Caption | Inter 600 | 12 | `.caption` | Overlines like SHOW COMPLETE |
| Lyric current | Inter 700 | 34 | `.largeTitle` | Wraps; never truncates |
| Lyric upcoming | Inter 600 | 26 | `.title` | |
| Lyric sung | Inter 600 | 22 | `.title2` | |
| Chord | Inter 700 | 17 | `.headline` | Sits above its syllable |
| Mono readout | IBM Plex Mono 600 | 20 | `.title3` | Tuner, tempo |

At accessibility sizes (AX1 and up):

- The Road header turns into two rows: the venue plate, then Tonight plus play. The tuner and tips move into the second row (`r8-03` shows the reflow).
- The playing screen shows fewer lines at a larger size, and lines wrap at word boundaries (`r10-10`).
- Tab labels hide at AX3+. The icons keep their accessibility labels, and the Large Content Viewer is turned on for the tab bar.

---

## 4. Spacing and radii

- **Grid:** 4 pt base. Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40.
- **Screen margins:** 16 pt (compact), 20 pt (regular). The playing screen uses 20 pt side margins and almost no top or bottom margin.
- **Radii:** chips 999 (capsule), small controls 10, cards 16, header strip and tab bar 18, sheets 24, the showcase frame 0 with chrome corner brackets.
- **Hit targets:** at least 44 by 44 pt. Inlay markers get a 44 pt invisible hit area even though the art is 26 to 52 pt.
- **Safe areas:** the tab bar floats 8 pt above the home indicator. Lists get a bottom content inset equal to the tab bar height plus 16 pt.

---

## 5. Components

### 5.1 Tolex surfaces

- Dark tolex: a seamless tiling texture (`tolex-dark`, 512 px tile at @2x) under a 45 percent black wash. Light tolex is cream (`tolex-cream`).
- Build it as an `Image` with `.resizable(resizingMode: .tile)` behind content. Don't stretch it.
- Edges of raised panels get a 1 pt top highlight (white at 8 percent) and a 1 pt bottom shadow (black at 30 percent).

### 5.2 Grille-cloth tab bar

- A floating rounded rect (radius 18) filled with a woven mesh tile (`mesh-dark` or `mesh-light`), a 3 pt chrome piping stroke, and a soft drop shadow.
- Five tabs: **Road, Songbook, Rehearse, Tour, Me.**
- Active tab: amber icon and label, plus a 3 by 24 pt amber underline. In light mode the active label uses `accent.amberText`.
- Icons are custom 28 pt line icons (1.9 pt stroke), shipped as SF Symbol-style custom symbols or as `Shape` paths:
  - **Road:** a fretboard segment with a bending road.
  - **Songbook:** an open book with a note.
  - **Rehearse:** a metronome.
  - **Tour:** a tour van.
  - **Me:** a backstage pass on a U-shaped lanyard.
- No lamps, no VU gauge.

### 5.3 Inlay markers (Road)

These are drawn in code: flush pearl set into the rosewood, with a thin dark cut edge and a soft inner top shadow, never a drop shadow.

| State | Shape | Fill | Mark | Light |
|---|---|---|---|---|
| Done | Dot, 26 pt | Amber-tinted pearl #FCCE80 with soft shimmer | Engraved check #5C3A16 | Faint amber halo (20 percent) |
| Current | Trapezoid block, 52 by 38 pt | Bright warm pearl #FFD68C | Engraved show number | Glows from within: amber radial glow 88 pt, 60 percent |
| Locked | Dot, 26 pt | Matte pearl #D6D0C4, no shimmer | Engraved number #46423C | None |
| 12th fret (leg finale) | Double dot, 24 pt each | Matte pearl | Left: engraved number. Right: engraved lock | None until unlocked; then both dots become Done |

- Placement is staggered across strings and frets. The callout bubble ("C to D, opens 3 songs") points at the current inlay.
- VoiceOver label example: "Show 4 of 6, Kettle Hums, current. Double tap to play."

### 5.4 Curved amber connector

- A cubic Bezier from each done inlay to the next, with vertical tangents. It leaves along one string and bends smoothly onto the next stop's string.
- Drawn only between done stops and up to the current stop. Nothing is drawn ahead.
- Two layers: a 12 pt amber glow (#FFAA3C at 60 percent, blurred 7 pt), then a 2.2 pt core line (#FFDCA0).
- An alternate with no connector is allowed (round 9 `r9-03`). Inlay numbers carry the order on their own.

### 5.5 Header strip (Road)

- One compact strip (radius 18, dark tolex with chrome piping):
  - **Row 1:** cream venue plate (venue name, "Show 4 of 6", a pip row of 6, "Club next"), the tuner button labelled "Tune", and the tips pill ("$411", labelled "Tips").
  - **Row 2:** "TONIGHT" overline, the song title, and an amber play button.
- Every control is at least 44 pt. At AX sizes it reflows into stacked rows (see section 3).

### 5.6 Buttons

- **Primary:** a cream engraved plate (gradient #F6EAD2 to #D6C4A4, 2 pt #8C7858 stroke, four tiny screws, radius 12), label in Space Grotesk 700 using `plate.text`. Example: "Head to the Club".
- **Secondary:** a quiet capsule outline (1.5 pt #8C847A) with a `text.primary` label. Example: "Play it again".
- **Text button:** an underlined label for low-emphasis actions.
- **Pressed state:** the plate darkens 6 percent and moves down 1 pt. No bounce.

### 5.7 Reward tiles

- Two equal tiles: "+120 fans" (fans icon) and "+$30 tips" (coin icon), in the format "+N fans, +$N tips" everywhere.
- On Show Complete they're outlined cards. On the Headline Show sheet they're flat (no outline) so they don't look tappable.
- VoiceOver reads them combined: "Reward: 120 fans and 30 dollars in tips."

### 5.8 Showcase and case

- The new guitar sits in an open hard case with glowing orange plush, inside a frame with chrome L-corner brackets (Show Complete, the Merch reveal, the builder).
- The glow version: the guitar stands alone with an amber outline glow and sparks.

---

## 6. Playing screen (immersive)

- Full-bleed lyrics over `surface.base`. No fretboard and no gauge.
- Lines fill nearly the whole height: the current line at the Lyric current size, the next two to three lines at Lyric upcoming, and sung lines at Lyric sung in `lyric.sung` colour.
- Chords sit above their syllables in `chord` amber.
- A hairline progress bar (2 pt amber) runs along the bottom edge and is always visible.
- **Auto-hide controls** (close, title, speed, play or pause, loop):
  - They appear on tap, then fade out after **3 s** without interaction. Any interaction restarts the timer.
  - Auto-hide is **off when VoiceOver or Switch Control is running** (`UIAccessibility.isVoiceOverRunning`, `isSwitchControlRunning`). Controls stay visible and focusable.
  - With **Reduce Motion** on, the controls use a plain 0.2 s opacity fade with no slide or scale.
  - Under Full Keyboard Access, any key press shows the controls. Space toggles play.
- **First run only:** a hint frame says "Tap anywhere for controls", with a small listening Louie. It's dismissed on the first tap and never shown again (`@AppStorage("seenPlayHint")`).
- Lyric scrolling follows the song position. With Reduce Motion, it snaps line by line instead of scrolling smoothly.

---

## 7. Motion

| Moment | Default | Reduce Motion |
|---|---|---|
| Controls show and hide | 0.25 s ease-out fade plus 8 pt slide | 0.2 s fade only |
| Current inlay | Slow glow breathe, 2.4 s loop, 85 to 100 percent | Static glow |
| Connector reveal after a show | Line draws along its path, 0.6 s | Appears at once |
| Show Complete | Sparks drift, guitar glow pulses once, Louie cheers (one 0.4 s hop) | Static sparks, no hop |
| Leg transition | Case lid opens, 0.5 s | Cross-fade |
| Tab switch | System default | System default |

- Haptics: a light impact on show complete, and a selection tick on builder swatches. Respect the system haptics setting.

---

## 8. Merch catalog

Tips are earned only by playing (about $30 a show). Nothing in Merch costs real money. The tip jar on Me is optional and separate.

| Tier | Items | Tips | Unlocks |
|---|---|---|---|
| Stock | Chrome hardware, Factory new, Black, Pearloid, Tortoise and Mint guards, 4 solid paints | Free | With each body |
| Shop | Seafoam, Burgundy mist, Tobacco burst, Honey burst, Played-in wear ($40), Aged nickel ($45) | $25 to $45 | Corner Pub onward |
| Custom | Metallic and flake paints, Mirror chrome and Marble guards, Gold hardware ($60), Road worn ($90) | $60 to $90 | Club onward |
| Print guards | Leopard, Tiger, Cow, Checkerboard, Paisley | $35 each | Club onward |
| Flame top | Teal burst, Violet burst, Purple flame, Figured koa | $120 each | Theater onward (koa needs the Koa Arc body) |
| Extra bodies | Big Sky, Tin Roof, Low Road, Pocket, Wingtip, Koa Arc | $150 to $250 | After the matching venue |
| Easter egg | Sunflower guard | Hidden | Finish a sunflower-themed song |
| Toggle | **Leave strings long** (on or off) | Free | Any guitar, any time |

- **Bodies by venue:** Porch parlor (Coffeehouse), Cornerstone dreadnought (Corner Pub), Club Slab (Club), Hollow Hill semi-hollow (Theater), Swing offset (Arena), Comet (Stadium). Every guitar uses our rounded 3+3 headstock, with no logos.
- **Builder** (`r10-19`):
  - The guitar sits in the case showcase.
  - Category chips: Body, Flame top, Guard, Wear, Hardware.
  - Swatch rows use 44 pt circles. Locked swatches show a lock and read "Locked, opens at Club" to VoiceOver.
  - Wear uses a segmented control (New, Played, Road worn), and metal is three dots.
  - **"Leave strings long"** is a `Toggle`. When on, the headstock shows neat coiled string ends.
  - The Save button shows the running total ("Save to case, $35 tips").
- A full Custom build costs about $305 tips, roughly 10 shows.

---

## 9. Louie usage

Louie is **Road Ready**: a blue 1x12 combo amp with a yellow control-panel face (`r10-00`).

- **Exactly one mouth, always on the yellow panel**, between the eyes and the four cream knobs.
- **The grille is never a face.** It's plain navy woven cloth with at most a faint speaker circle. No mouth, smile line or features on the grille, in any pose, size or frame.
- Hands with fingers, blue Tolex like his arms (Graham, 2026-11-17). No hand ever shows one finger standing straight up: it reads as the middle finger. Short blue Tolex legs, brown leather handle, nickel corners.
- **Stock Louie is bright-blue Tolex (Graham chose bright B on Nov 18, 2026).** Body #3A86FF, shade #2C6FE0, highlight #6BA4FF, with a visible pebble grain and light wear. The hands are the same blue Tolex as the arms (not yellow), with fingers and bold ink outlines. The panel, grille, knobs, corners and handle keep their colours. Grok's painted art in art/louie/v2 is the source of truth; don't redraw him.
- **Locked palette:**

| Part | Hex |
|---|---|
| Tolex blue | #3A86FF |
| Tolex shadow | #2C6FE0 |
| Tolex highlight | #6BA4FF |
| Panel yellow | #F0B23A |
| Panel shade | #D9982A |
| Grille navy | #182D47 |
| Grille weave | #2A4466 |
| Corner nickel | #948573 |
| Handle leather | #55331B |
| Knob cream | #E8D5B3 |
| Ink line | #0B0F14 |

- **Expressions:** idle, cheering, listening, proud, oops, sleepy, nervous, celebrating. No tears, frowns or guilt faces. Oops is sheepish, never sad.
- **On dark surfaces,** add a 3 px warm rim (#FFE2B4 at 35 percent) so his outline reads. The painted dark pictures (`-dark.webp`) bake in a wider, stronger rim (Nov 18, 2026): #FFE2B4 at 60 percent, 12 px on the 600 px art (solid for 9 px, fading over the last 3), so it is about 3 px at 120 pt and still 1.5 px at 60 pt on #141210. The dark files are 12 px bigger on each side than the light ones. The blue on #141210 is 5.4:1, but the dark ink outline melts into the ground without the rim. On light surfaces, no rim is needed (3.0:1 for the blue on #F6EFE2, with the ink outline carrying the edge).
- **Placement:**
  - Road: peeking from the left edge, one hand on the guitar body, away from inlays. The peek art (art/louie/louie-peek-*.webp) is bright B with his right hand resting on a maple guitar body, both eyes and the mouth visible.
  - Show Complete: cheering beside the guitar.
  - Lists: only as a fixed badge (Songbook hint banner, Me tip jar row). Never over rows.
  - Playing: only in the first-run hint.
- **Sizes:** 120 pt hero, 60 pt inline, 44 pt minimum full body, and a 44 pt face badge (panel crop in a circle) for rows.
- **Voice:** he cheers the player on. He is a character, never described as an AI assistant. No blush or cheek spots, no guitar pick, no amp brand logos.
- **Accessibility:** decorative Louie images are `.accessibilityHidden(true)`. When he carries a message, the message text is the label.

---

## 10. SwiftUI implementation notes

**Shapes and Canvas (code-drawn, crisp at every size)**

- Inlay markers: `Shape` paths (circle, trapezoid). The pearl look is a `MeshGradient` (iOS 18) or layered `RadialGradient`s plus a small shimmer noise image masked to the shape. Engraved marks are `Text` or `Image(systemName:)` with a 1 pt offset highlight.
- Curved connector: a `Path` with `addCurve`, stroked twice (blurred glow, then core). Draw-on animation uses `.trim(from:to:)`.
- The fretboard map is an image asset (rosewood, frets, strings), with inlays and the connector in a `Canvas` overlay or a `ZStack` of shapes positioned from a layout table (string index, fret index).
- Header strip, reward tiles, buttons, chips, the builder swatch rings and toggles: standard views with `RoundedRectangle` and `Capsule`. Chrome piping is a `strokeBorder` with an `AngularGradient`.
- Showcase chrome corners: a small `Shape`. Spark particles: `Canvas` with `TimelineView(.animation)`, paused under Reduce Motion.
- The hairline progress bar is a `GeometryReader`-sized `Rectangle`.

**Image assets**

- Tolex and mesh tiles (light and dark).
- Guitar renders per body plus finish layers. Ship each finish as a separate layer (body paint, guard, hardware, wear overlay, long-string overlay) so the builder composites them instead of shipping every combination.
- The open case and plush, the glow backdrop.
- Louie poses as PNG or PDF with transparency: idle, cheering, listening, peek, proud, oops, sleepy, nervous, celebrating. Samples are in `assets/`. The final art should be redrawn as vectors in the locked palette from the generated drafts.
- Tab icons as custom SF Symbols (`.svg` templates) so they follow Dynamic Type and Bold Text.

**State and accessibility**

- Auto-hide: a `@State var controlsVisible` plus a cancellable `Task` sleeping 3 s. Skip it when `accessibilityVoiceOverEnabled` or `accessibilitySwitchControlEnabled` (from `@Environment`) is true. Animation is `reduceMotion ? .easeOut(duration: 0.2) : .easeOut(duration: 0.25)` with a matching transition.
- Dynamic Type: `@Environment(\.dynamicTypeSize)`. Switch layouts with `ViewThatFits` or `if size.isAccessibilitySize`.
- Light and dark: an asset catalog colour set for every token in section 2.
- Mastery marks (3 inlay dots) have the labels "Learning", "Solid" and "Nailed it".

---

## 11. Copy rules

- Plain writing, no em dashes. Plain venue names: Coffeehouse, Corner Pub, Club, Theater, Arena, Stadium.
- Rewards: "+120 fans, +$30 tips". Primary button: "Head to the Club". Secondary: "Play it again".
- Lyrics in mockups are made up. Never use real song lyrics.
