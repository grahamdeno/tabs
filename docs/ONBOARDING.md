# Onboarding: hidden features and how people find them

Started 2026-10-22 (4.39.1) as an audit for Graham. Keep it current: a release that adds, moves or
removes something with no visible button (a tap on a plain-looking thing, a hold, a swipe, a drag, a
setting that changes a screen) updates its row here, and a release that adds a tip or Show me marks it.

## How to read it

- **Hidden** means a person can use the app for weeks and never learn it is there: no button says it, or
  the button doesn't look tappable.
- **Coverage** is what teaches it today:
  - **Tip**: shown once, by itself, when it's useful (`coachTip` in `coach.js`, or the swipe hint in `library.js`).
  - **Show me**: replays from Settings > Help > Tips & gestures.
  - **Listed**: on Tips & gestures as text only, no Show me.
  - **Dot**: the "new" dot on a Tools row until it's used.
  - **None**.
- **Order** under each page is the order I'd teach them: the most useful in the first week first, then
  the ones people need only after they've played a while. A feature is taught on the page and at the
  moment it pays off, not in a tour up front.

## What stands out

1. **The Gig has no tips at all.** Play opens the Gig for almost every song (4.1.0), but the pause,
   line, Now and Next and song map tips only fire in the plain sheet (practice, tabs, Play together).
   A new player's first show teaches nothing about the microphone, dragging the lines or pausing.
2. **The stat bar is three hidden doors.** Venue opens the Tour Map, fans open the Merch table, the streak
   opens Your profile. Nothing says they're buttons, and they're the only way into two of those pages.
3. **Tips & gestures is out of date in four places** (fix these whatever else we decide):
   - "Key: − and + in the bar": the key moved to About this song's Key tile and its dial (4.31.0).
   - "Now and Next ... turn it on with the fretboard below": it's a switch in Tools > Play now (4.32.0).
   - "Drag the song map (Settings > Chord diagrams > Song map)": there's no such setting.
   - "Tools, then Speed: sweep around the corner": Speed is a − / + stepper now; only tapping the value opens the dial.
4. **The new pages since version 4 have no tips**: the Road's picks, Tour, Charts, Band, Merch, Profile,
   Rehearse and language practice. Several have a hidden tap that matters (below).
5. **Covered well**: tap a chord, press Play, the Songbook swipe, the search invite, tap tempo, the tuner
   meter, the Tools dots.

## By page, in the order to teach them

### The Road (home) and the stat bar

| # | Hidden feature | How you do it | Coverage | Why here in the order |
|---|---|---|---|---|
| 1 | Tap a pick for its card (Start, Play again) | Tap a pick; tap again or elsewhere to close | None (the halo and wiggle invite it) | The first thing a new player must do. If the halo isn't enough on a phone, a one-time "Tap the glowing pick" from Louie |
| 2 | The streak opens Your profile | Tap the guitar in the stat bar | None | Right after the first song played through, when the streak first lights |
| 3 | Fans open the Merch table | Tap the fans count | None | When fans first reach the price of the cheapest thing (Rain check) |
| 4 | The venue opens the Tour Map | Tap the venue | None | After the first few songs, when there are hexagons to see |
| 5 | Other songs that fit (headline) | Tap a headline pick, then Other songs that fit | None (it's on the card) | Visible once the card is open; no tip needed |

### Song page (paused)

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Tap a chord to see how it's played | Tap any chord | Tip, Show me | First song, first minute. Keep as is |
| 2 | Press Play | The Play button | Tip | Right after the chord. Keep |
| 3 | The title opens About this song (cover, preview, key, recording) | Tap the cover or "about this song" | None | Big value (key dial, recording, With the band) and it doesn't look like a button. First time a song has a cover |
| 4 | Tap a line to start from it | Tap a line while paused | Tip, Show me (plain sheet only) | After the first pause |
| 5 | Tap the title bar to go back to the top | Tap the title bar | Listed | Low value; leave it listed |
| 6 | Pull down at the top to go back to the Songbook | Pull past "Release for Songbook" | Show me (one hand) | A habit people form only after the back button; teach after a few songs |
| 7 | Set dial: hold "4 of 9" | Hold and sweep | Show me | Only in a set; teach on the first song opened from a set |
| 8 | Bluetooth pedals and Space | Left plays/pauses, right goes to the next section | Listed | Only for pedal owners; leave listed, maybe a toast the first time a key or pedal press is seen |

### The Gig (Play)

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | The microphone hears your strums and scores the changes | Just strum on the change | None (the permission prompt is the only hint) | The heart of the game. Before the first show: "Strum on each chord change. I'm listening" from Louie |
| 2 | Tap to pause (twice on stage) | Tap the screen | None in the Gig (the tip is plain-sheet only) | First show, a few seconds in, as the pause tip already does elsewhere |
| 3 | Drag the lines to move the song | Drag | None | First pause in a Gig |
| 4 | Now and Next counts the beats to the change | Watch it | None | Second show, once they've seen the screen |
| 5 | Lines in a gig (4, 5, 6, All) | Tools > Play | None | After a few shows, as a toast at the end: "More lines? Tools > Lines in a gig" |
| 6 | Encore doubles the bonus fans | The Encore button at the end | Visible | No tip needed |
| 7 | Challenge a friend (a duel) | The button at the end | Visible | No tip needed; Charts explains the record |

### Plain sheet (practice, tabs, Play together)

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Tap anywhere to pause; scroll by hand and it carries on | Tap | Tip, Show me | Keep |
| 2 | Tap a line to start from it | Tap while paused | Tip, Show me | Keep |
| 3 | Drag the song map to jump sections | Drag the rail on the right | Tip, Show me | Keep (fix the stale Settings path in its text) |
| 4 | Practice a section: tap the first and last line | Two taps | Listed | The first time Practice a section is chosen, say it there |
| 5 | Now and Next | Tools > Play switch | Tip, Show me | Keep (fix the text) |
| 6 | Count-in only from the top | Automatic | Listed | Leave listed |

### Tools sheet

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Three tabs at the foot, last one remembered | Tap Play / Practice / Song | None | First open; the tabs are visible but people may not look down. A one-time point at the tabs |
| 2 | Speed: tap the value for the dial | Tap the number between − and + | Show me (stale text) | After the first few songs |
| 3 | Make it easier, Spark tone, Share, Tuner, Practice, Metronome | Rows | Dot | Keep the dots |
| 4 | Practice mode switch (a learning song opens in it) | Tools > Practice | None | When a song is first marked Learning |

### Songbook and search

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Search does more: a lyric, paste a sheet, paste a link | Tap the search bar | Tip (invite and list), Show me | Keep |
| 2 | Swipe left to delete, long swipe deletes, Undo | Swipe | Tip (a row slides once) | Keep |
| 3 | Swipe right to favorite | Swipe | None | Add to the swipe hint: slide one way, then the other |
| 4 | The Today strip pages sideways | Swipe it or tap a dot | None (the dots hint) | When it first has two or more cards |
| 5 | Paste a song reads the clipboard | The big button when search opens | Visible | No tip |
| 6 | The letter index | Drag down the right edge | None | Only with a long list (30+ songs); a one-time tip then |
| 7 | Return opens the top match | Keyboard Return | Listed | Leave listed |
| 8 | Tabs only lives in the sort menu | Sort menu | None | Only for tab users; leave it |
| 9 | Recently deleted keeps 30 days | Settings | Listed (Undo toast says Undo) | Leave listed |

### Adding and editing a song

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Paste or type, chords turn copper | The pad | Tip | Keep |
| 2 | Tap a word to place its chord | Tap a word | Listed | First edit of an existing song; this is the main way to fix a chart |
| 3 | Tap tempo | Tap along | Tip, Show me | Keep |
| 4 | Sing it: hold the pad to sing a line | Hold | Listed (and the pad says it) | The pad's own text covers it |

### Rehearse and lessons

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Today's lesson takes about four minutes, 40 XP for all three | The card | Visible | No tip |
| 2 | Drill a change; Drill all | Buttons in Your changes | Visible | No tip |
| 3 | A lesson listens to each string | Start listening | The lesson says it | Keep |
| 4 | What I hear | Tile | None | The tile name doesn't say what it does; a line under it would do |

### Tuner

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | The meter: green and centred | Watch | Tip, Show me | Keep |
| 2 | Tap a key to hear that string | Tap a tuning key | Listed | First open, after the meter tip |
| 3 | Instrument, tuning, Guided and Chromatic in the top menu | Tap the pill | None | Visible enough; leave it |

### Tour, Tour Map, Charts, Band, Merch, Profile

| # | Page | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|---|
| 1 | Tour Map | Pull the sheet up for your scene this week | Drag the sheet up | None | The sheet's handle is the only hint; first visit |
| 2 | Profile | Tap a passport stamp for its diagram | Tap | None | First visit to the passport |
| 3 | Band | Tap a friend to hear them say something | Tap a card | None | When the second friend joins |
| 4 | Merch | Try it on before buying a finish | The Try it on button | Visible | No tip |
| 5 | Charts | Who moves up and down on Monday | Read the chart | Visible | No tip |
| 6 | Tour Map | Rivals are simulated; Forget my spot | Info button | Visible | No tip |

### Language practice

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Tap a word for its card (meaning, gender, voice) | Tap a translated word | None | The first time a translation shows; this is the main way to learn from it |
| 2 | Levels from a few nouns to fluent | The level control | Visible | No tip |

## Suggested next steps (for Graham to choose)

1. **Fix the four stale Tips & gestures lines** (a patch).
2. **Tips for the Gig**: Louie's "I'm listening" before the first show, tap to pause, drag the lines. This
   is the gap most new players hit.
3. **The stat bar's three doors**: one tip each, at the moment each pays off (first streak, enough fans
   to buy, first hexagons).
4. **About this song** from the title, the **Tools tabs**, **swipe right to favorite**, **tap a word** in
   the editor and in language practice.
5. Leave the rest listed on Tips & gestures.
