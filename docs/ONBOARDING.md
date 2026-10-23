# Onboarding: hidden features and how people find them

Started 2026-10-22 (4.39.1) as an audit for Graham; a fresh-install walkthrough was added the same
evening. Keep it current: a release that adds, moves or removes something with no visible button (a tap
on a plain-looking thing, a hold, a swipe, a drag, a setting that changes a screen) updates its row here,
and a release that adds a tip or Show me marks it.

## How to read it

- **Hidden** means a person can use the app for weeks and never learn it is there: no button says it, or
  the button doesn't look tappable.
- **Coverage** is what teaches it today:
  - **Tip**: shown once, by itself, when it's useful (`coachTip` in `coach.js`, or the swipe hint in `library.js`).
  - **Show me**: replays from Settings > Help > Tips & gestures.
  - **Listed**: on Tips & gestures as text only, no Show me.
  - **Dot**: the "new" dot on a Tools row until it's used.
  - **On screen**: a line of text on the page itself says it (Louie's bubble, a hint under a sheet).
  - **None**.
- **Order** under each page is the order to teach them. Across pages, the time-based list below decides
  which comes first: a feature is taught on its page at the moment it pays off, not in a tour up front.

## Built so far

- 4.39.2: the four stale Tips & gestures lines, "1 SONGS".
- 4.40.0: Opening night (the first five steps of the first session below: mic, chord, verse, pause, first show), Skip (asks first), Replay in Tips & gestures, and the stat bar's VENUE, STREAK and FANS labels until each is tapped once. Not now on the microphone plays Opening night unscored and says so; it never asks again by itself.

## The fresh-install walkthrough (2026-10-22, 4.39.1)

Empty storage, an iPhone-sized screen, Dark, the microphone allowed. Screens in order, what a new person
sees, and what teaches them anything.

| Screen | What a new person sees | What teaches them | Problem |
|---|---|---|---|
| The Road, first launch | Leg 1 "Open chords", the pink G chord pick glowing, Louie's bubble "Let's play your first song" with a Gig: Harbor Lights button | The halo and wiggle | **Two first steps compete**: Louie says play a song, the glowing pick says learn the G chord |
| | "You can play 0 of your 1 song" | | Starts the player on a zero |
| | Stat bar: a shield with 1, a guitar with 0, a ticket with 0 | Nothing | No labels; nothing says what they are or that they open pages |
| | A pink dot on More on every screen | Nothing | It means "not tuned in the last few hours", but it looks like "something new". It never clears unless you tune |
| Tap the pick | A card: The G chord, Start +5 fans | The card | Fine |
| Songbook | The sample song, "Back up your library" with Later and Back up | | **A backup nag on day one** with one sample song |
| Harbor Lights | Chord tip, then "Tap any chord", then "Press play when you're ready" | Tip, Tip, Tip | Works as intended. About this song under the title is never pointed out |
| Play (the Gig) | Count-in, "Listening is off", then "Hearing you · tap to turn off" | The mic pill says it is listening | Nothing says *why* (strum on the changes to score). On a real iPhone the microphone prompt arrives cold, with no reason given first |
| Tap the Gig | Pauses: "You stopped here", Louie "Take a breath", Back a line, Tools, Sheet, Resume | Found by accident | Tap to pause and drag the lines are never taught |
| Tools | Play, Practice and Song tabs at the foot, dots on Practice and Song | Dots | Fine |
| Tour | October Tour, a request line asking for Harbor Lights, tonight's setlist | On screen | Good. A lot at once on day one |
| Charts | Nine computer players already scoring, a Battle on day one | On screen | **Day one shows a full league and a rival battle before one song is played** |
| Band | 0 of 27, silhouettes | On screen | The first silhouette read "1 SONGS" (fixed in 4.39.2) |
| Rehearse | Today's lesson and Your changes from a song never played | On screen | Fine, if a little early |
| More | Settings, Tuner, Songbook, Support | | The Songbook's own page lives here; the Road's bar is the other way in |
| Your profile | Garage, level 1, 0 of 25 badges | On screen | Fine |
| Merch table | Louie: "Play a few shows and come back. The fans pay for all of this." | On screen | **Good model**: Louie explains the page in one line. Every new page should have this |
| Tour Map | Rivals' corners, "Plant your flag on a real map", "Pull up for your scene" | On screen | Fine |
| Settings | Keys: AI off, Apple Music off, Language practice not picked | | Nothing anywhere tells a new person what the AI key or Apple Music would add |
| Search | The search list tip | Tip | Works |

## Setup steps nobody is walked through

These come before any feature, and they matter more than any gesture.

| # | Step | Why it matters | Today | Suggest |
|---|---|---|---|---|
| 1 | Add to Home Screen | On an iPhone, Safari can clear a website's saved data after about a week without a visit. Installed to the Home Screen, it keeps it. Songs, streak and fans are at stake | Nothing (`road.js` knows when it's installed) | In the browser only: one card from Louie on the Road on the second visit, with the three taps for Safari. Never shown once installed |
| 2 | The microphone | The Gig, the tuner, lessons, Play together and Sing it all need it | The system prompt arrives cold | Louie asks first, once, before the first Gig or lesson: "I listen for your strums to score the show. Nothing is recorded or sent." Then the system prompt |
| 3 | Backups | Everything is on the phone only | A Songbook card from day one | Wait until there are a few songs of your own or a week of play, then ask once with the reason |
| 4 | The AI key | About a third of the app is hidden without it (Get the song, Play next, Make it easier, Scan a page, language practice, Spark tone) | Nothing outside Settings > Keys | One line where the gap shows: "Nothing found" in search, and an empty Play next: "With an AI key, The Road can find songs and chords for you. Settings > Keys" |
| 5 | Apple Music | Play with the recording, follow along line by line, cover requests | Settings row | Mention once on About this song when a recording is linked |

## Across the app: first session, first week, first month

One order for the whole app. Each line names where it is taught and what triggers it. Nothing more than
one new tip in a session after the first; the app already records what's been used (`settings.used`), so
anything a person found on their own is skipped.

### First session (the tutorial leg, minutes 0 to 10)

1. Tap the glowing pick (the halo already invites it).
2. Tap a chord to see its shape (Harbor Lights, existing tip).
3. The microphone, asked by Louie first.
4. Press Play; strum on the changes (Louie, before the count-in).
5. Tap to pause; tap a line to start from it.
6. Finish the song: the first streak night, first fans.
7. The stat bar: tap the streak (it rocks) to see Your profile.

### First week

1. Add to Home Screen (second visit, browser only).
2. Add your own song: Paste a song, search, Get the song (with a key).
3. About this song from the title (first song with a cover).
4. The Tools tabs (first open).
5. Swipe left to delete, right to favorite (Songbook, existing swipe hint plus the right side).
6. Fans open the Merch table (first time fans reach 100, the price of Second take).
7. Tune up (first lesson that listens, or the tuner from More).
8. Today's lesson in Rehearse (after the first leg).
9. Backups (a few songs of your own, or day 7).

### First month

1. The venue opens the Tour Map (after about 5 songs played through).
2. Tour's request line and tonight's setlist (first visit to Tour after the tutorial leg).
3. Charts and the rival battle (after the first scored Gig).
4. Song duels (the Challenge button after a good show; Charts' Friends list).
5. Practice mode, Practice a section, Build up (when a song is first marked Learning).
6. Sets and Play set (when there are 8 songs).
7. Play together (the Song tab; when a friend's link first opens).
8. The pedal and Space (the first key or pedal press).
9. The pull down to go back, the set dial, the letter index (Show me only).
10. Language practice, Spark tone, Make it easier (their dots in Tools).
11. Score the timing (4.46.0: Settings > Playing, listed only; the default of the right chord anytime in the next second needs no teaching).

## What stands out

1. **The first screen has two first steps.** Louie says play Harbor Lights; the glowing pick says learn G.
   The tutorial leg fixes this: the first pick *is* playing the sample song.
2. **The Gig has no tips at all.** Play opens the Gig for almost every song (4.1.0), but the pause,
   line, Now and Next and song map tips only fire in the plain sheet (practice, tabs, Play together).
   The mic pill says it is listening, but not why.
3. **Everything opens on day one.** Tour, a full chart of rivals with a battle, 27 band silhouettes, the
   Merch table. Each page is good; all six at once before a single song is a lot.
4. **The stat bar is three hidden doors.** Venue opens the Tour Map, fans open the Merch table, the streak
   opens Your profile. No labels and nothing says they're buttons; two of those pages have no other door
   from the Road.
5. **The setup steps** (Home Screen, microphone, backups, AI key) aren't explained anywhere.
6. **Two dots that mean different things.** The pink dot on More means "tune up", the Tools dots mean
   "new". The More dot is lit most of the time, so people learn to ignore dots.
7. **Tips & gestures was out of date in four places** (fixed in 4.39.2):
   - "Key: − and + in the bar": the key moved to About this song's Key tile and its dial (4.31.0).
   - "Now and Next ... turn it on with the fretboard below": it's a switch in Tools > Play now (4.32.0).
   - "Drag the song map (Settings > Chord diagrams > Song map)": there's no such setting.
   - "Tools, then Speed: sweep around the corner": Speed is a − / + stepper now; only tapping the value opens the dial.
8. **Covered well**: tap a chord, press Play, the Songbook swipe, the search invite, tap tempo, the tuner
   meter, the Tools dots, and Louie's one-line explanation on the Merch table.

## Better than tips

- **The tutorial leg.** The first leg of the Road teaches by doing; each pick is one thing, Louie says
  one line, and finishing it is the reward. Mockup: Design canvas, row "Onboarding: the tutorial leg" (seven boards, 2026-10-22).
- **Look tappable before teaching.** A small arrow on the stat bar's three items, a play badge on the
  song cover. A permanent cue beats a tip people dismiss.
- **Louie explains every page once.** The Merch table already does it: one bubble on a first visit
  says what the page is for. Tour, Charts, Band and Rehearse should do the same.
- **Pages light up as they're earned (an option for Graham).** Tour after the tutorial leg, Charts after
  the first scored Gig, Band when Lola joins. The tab shows locked with one line ("Plays after your first
  show") instead of a full page of zeros.
- **One meaning per dot.** "New" stays a dot; "tune up" becomes the tuner's own mark inside More, not
  on the More tab.

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
| 6b | Back from anywhere in a song (4.42.2) | Scroll up a little: the slim bar with Back and the title shows | None (it appears by itself) | Visible as soon as you scroll up; no tip needed |
| 6c | The band while a song plays (4.43.0): on or off, drums or click, volume up to 150% | The band button above Play in the corner, or Tools > Play > The band | None (it shows by itself while playing) | Visible while playing; a tip the first time the band plays would help |
| 7 | Set dial: hold "4 of 9" | Hold and sweep | Show me | Only in a set; teach on the first song opened from a set |
| 8 | Bluetooth pedals and Space | Left plays/pauses, right goes to the next section | Listed | Only for pedal owners; leave listed, maybe a toast the first time a key or pedal press is seen |

### The Gig (Play)

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | The microphone hears your strums and scores the changes | Just strum on the change | On screen: "Hearing you · tap to turn off" says it listens, not why | The heart of the game. Before the first show: "Strum on each chord change. I'm listening" from Louie |
| 2 | Tap to pause (twice on stage) | Tap the screen | None in the Gig (the tip is plain-sheet only) | First show, a few seconds in, as the pause tip already does elsewhere |
| 3 | Drag the lines to move the song | Drag | None | First pause in a Gig |
| 4 | Now and Next counts the beats to the change | Watch it | None | Second show, once they've seen the screen |
| 6 | Encore doubles the bonus fans | The Encore button at the end | Visible | No tip needed |
| 7 | Challenge a friend (a duel) | The button at the end | Visible | No tip needed; Charts explains the record |

Achievement callouts (4.44.0) teach themselves: they appear when something is earned and point to nothing hidden, so they need no tip.

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
| 0 | One search finds and adds (4.46.0): tap the magnifier; Browse, Played lately and the ways to add are on the screen before you type | The magnifier or Add | On screen | Visible; no tip needed |
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
| 1 | Tour Map | Pull the sheet up for your scene this week | Drag the sheet up | On screen ("Pull up for your scene") | Fine as is |
| 2 | Profile | Tap a passport stamp for its diagram | Tap | None | First visit to the passport |
| 3 | Band | Tap a friend to hear them say something | Tap a card | None | When the second friend joins |
| 4 | Merch | Try it on before buying a finish | The Try it on button | Visible; Louie explains the page | No tip |
| 5 | Charts | Who moves up and down on Monday | Read the chart | Visible | No tip |
| 6 | Tour Map | Rivals are simulated; Forget my spot | Info button | Visible | No tip |

### Language practice

| # | Hidden feature | How you do it | Coverage | Why here |
|---|---|---|---|---|
| 1 | Tap a word for its card (meaning, gender, voice) | Tap a translated word | None | The first time a translation shows; this is the main way to learn from it |
| 2 | Levels from a few nouns to fluent | The level control | Visible | No tip |

### Pages the first audit skipped

| # | Page | Hidden feature | How you do it | Coverage | When to teach |
|---|---|---|---|---|---|
| 1 | About this song | With the band or With the recording, saved per song | The When you press Play rows | None | First song with a linked recording |
| 2 | About this song | Match it, Timing, Change recording | Rows in the sheet | Shown only when the recording doesn't match | Fine as is |
| 3 | Get the song | Swiping it away keeps it; the "is ready" bar brings it back | Swipe down, tap the bar | None | The first time it's put aside: a toast "Kept. Tap the bar to bring it back" |
| 4 | Play next | The cover plays a 30-second preview; Learn opens the new chord's lesson | Tap the cover, Learn | None | First open |
| 5 | Sets | Play set; Next up waits for a tuning change | Sets button, Play set | Listed | When there are 8 songs |
| 6 | Play together | Both phones listen for one clap | Song tab > Play together | The sheet says it | Fine as is |
| 7 | Merch | Rain check works on its own when you miss a night | Buy it | The buy toast says it | Fine as is |
| 8 | Profile | Share your card makes a picture | The button | Visible | No tip |
| 9 | More | The Songbook page lives in More (the Road's bar is the other way in) | More > Songbook | Visible | No tip |

## Suggested releases (for Graham to choose)

1. **Patch (4.39.2, done):** the four stale Tips & gestures lines, "1 SONGS" on the Band page.
2. **The tutorial leg (4.40.0, done as Opening night)**: the first leg of the Road as onboarding, with
   Louie asking for the microphone and explaining the Gig; the stat bar's labels came with it.
3. **Setup steps:** Add to Home Screen card, backup timing, the AI key line where its gap shows.
4. **Louie's one line on each page** and the stat bar arrows.
5. **Pages light up as earned**, if Graham wants it.
6. The rest stays on Tips & gestures.
