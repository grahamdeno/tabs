# The Road

A guitar app for the phone that plays like a game: the guitar is how you play. Learn chords on a path, play your songs as scored shows, keep a streak, earn fans, climb a weekly chart and build a band. Chord sheets and tabs, offline, everything on the device, no account.

Live at `https://grahamdeno.github.io/tabs/` (GitHub Pages from `main`). Add it to the home screen to use it as an app. It was called Tabs before version 3; the repo and saved data keep that name.

## What it does

### The Road (home)
- A stat bar on every main page: your venue (tap for the Tour Map), your gig streak, fans to spend (tap for the Merch table). The streak (tap for Your profile) is a guitar that rocks once you've played tonight and sits grey and upright until you do; tapping it rocks it, taps the phone and opens your profile.
- The leg you're on and its stops as rounded guitar picks (4.34.0): lessons, a merch box after every third, and a headline show at the end of each leg (play a real song through). Done picks carry a check; the next pick is bigger, its halo pulses and it gives a small wiggle every few seconds (4.35.0; both stop with Reduce Motion). Nothing is open on arrival: tap a pick for its card (Start on the next one, Play again on a done lesson); tap it again or anywhere else to close. A headline's card names the song you last played that uses only that leg's chords, and Other songs that fit lists the rest; with none, Find a song that fits opens What can I play next.
- **Opening night (4.40.0):** a new player starts on a short pink leg before Leg 1 that teaches by doing, on the sample song: Let me hear you (Louie says why the app listens, then the phone asks for the microphone; Not now plays unscored), Tap a chord (a strip above Play says which), Play a verse (the Gig waits for Count me in and says to strum on each change), Pause and pick up (tap, then Resume) and Your first show. A show played through finishes the steps it skipped. +5 fans a step. Skip on the banner asks first; Settings > Help > Tips & gestures replays it. Anyone who had a play or a lesson before it never sees it. Afterwards the stat bar names Venue, Streak and Fans with a › until each is tapped once.
- Louie the amp beside the path with one line for the moment and tonight's song to play.
- The Songbook bar above the tab bar: your songs, how many you can play, and search.
- Fans: 10 for every play, 5 for every lesson round, 25 for every merch box.
- The tab bar: Road, Tour, Charts, Band, Rehearse and More (Settings, Tuner, Songbook and Support The Road; Your profile opens from the streak in the stat bar, the most used nearest the thumb; the Merch table opens from your fans and the Tour Map from your venue, in the stat bar or on Your profile).

### Playing a song
- The song page (4.31.0): beside the title, the song's cover (Apple Music art, or its letter on a colour) and "about this song" under the artist; both open About this song. Under the title, Mark as learning. At the bottom just Tools and Play, and Play's second line says what it plays with. About this song: the cover with a preview, Tempo, Length and Key tiles (Key opens the key dial), a word when the recording doesn't match the sheet with Match it, When you press Play (With the recording or With the band, saved per song), Timing and Change recording, and Done at the bottom. With no recording linked it offers Find a recording.
- Anywhere in a song, a short scroll up shows a slim bar with Back and the title (4.42.2); tap the title to go back to the top.
- The text size fits the song (4.51.0): the largest size, from 14 to 22 px, that puts the song's longest line on one line, so a line of the song is a line on screen; Text size in Tools scales it up or down. A row of chords with no words (an intro, a solo) spreads across the width and is timed evenly along it.
- Play on any song is one page (4.51.0 to 4.53.0): the song page is the stage. With the microphone on it is a scored show, "the Gig" (auto-scroll, the recording or the band); otherwise (practice, a tab, Play together) it is the same page unscored.
- While it plays the title, chips, Tools and Play step back and the song fills the screen:
  - **The line you are on** sits on a band in the section's colour that runs edge to edge (4.49.14), so time after the words reads as space. The next line is nearly full, lines ahead stay readable, lines behind fade. Every chord takes the section's colour, and a quiet stage light in that colour sits behind the words and fades out above the band.
  - **Chord Catch** (4.54.0): the show scores the chord you play, not when you play it. Each chord in the song is a target. The microphone hears the notes; when the chord you are on (or the next) is played, it turns green with a bar under it and stays green. A chord that goes by unplayed stays plain. No beat dots, no lit chord, no EARLY or LATE. A chord repeated in a row is one target, shown once. A chord you have not learned gets a small shape card, low on the right (NOW for the one you are on, else NEXT).
  - **The sections** are the page's own rail (the row of coloured section chips on the song page went in 4.55.0): tap a section there to go to it; the jump is not graded, and a recording playing goes with it. There is no bar over the stage.
  - **In a show only:** the section and the combo ("14 in a row", with a check) at the top, and a bigger crowd of 12 fans on its own row (those on their feet stand and throw their hands up). Louie and the crowd pop in for a combo milestone or a full crowd. The stage light is one cone from the lamp down in the section's colour.
  - **Reading and moving:** the text size fits the song (the largest of 14 to 22 px that keeps its longest line on one line; Text size in Tools scales it). Drag the song itself to move it. A row of chords with no words spreads across the width and is timed evenly. No Lines setting, no Full, no timing bar.
  - **The band:** the Metronome switch in Tools is the band's switch in a show (4.49.12): off silences Beat too, and it reads on whenever drums play. After a stall the band skips the beats that passed on the same grid, and the count-in is timed from its first beat.
- The microphone hears which chord you play (4.46.0, Chord Catch 4.54.0): it reads the notes and checks them against the chord the song is on and the next one only, so changes close together are picked up fast. Two readings in a row that fit the chord catch it, and a ringing chord can't catch the next one. A chord and its relative (C and Am) must fit better than each other. A sheet with no shape for a chord counts as caught if anything was heard. Combos count chords caught in a row; a miss ends the run. Nothing fails, and a chord you skip never costs fans. A sheet whose chords are a guess never counts misses. Playing along with the recording through the speaker confuses the chord check; headphones or the band work cleanly. Hearing you turns scoring off for one show; Settings > Playing > Score my plays sets the default.
- **Wait for me** (4.54.0): Tools > Play, saved per song, on for a song marked learning. With the band or the scroll (not a recording) and the microphone on, the song stops on a chord until you play it: a soft ring on the chord, a card "Waiting for G" with its shape, and Skip this chord beside Pause (counts as missed). The top shows "6 of 9". A Wait for me show is practice: it gives fans for chords caught, but no Charts XP, rival battle, duel or best score.
- **Louie's count-in** (4.56.0, was the opening card of 4.55.0): with a count-in on, the empty space above the first line holds Louie and a big number stepping 1 to 4, Louie bouncing on each beat and throwing horns up on the last, with one small line under it: the chord you start on and the strum ("First: F · Strum: D-DU-UDU"). It fades as soon as the song moves. With count-in off, or starting mid-song, there is no card. With less room Louie and the number shrink; with reduced motion he stays still and only the number changes.
- **Bold words that fade by distance** (4.58.0): on the stage every line is bold and the line you're on is boldest and white. The next line's words are at 80%, the ones after at 66%, the ones played at 54% (90, 78 and 70% in the light palettes, so every word keeps 4.5:1); chord letters stay brighter than the words around them so the next change is easy to see. The text size is measured at the boldest weight, so it is about 5% smaller and no line runs past the edge.
- **The album cover is the song's room** (4.59.0 the show, 4.61.0 the whole song screen): a song whose recording has a cover shows it blown up and blurred behind the song screen, paused, in plain Play and in the Gig, under a dark layer, and the screen reads as dark in every palette: white words, dark title bar, Tools and dock, a soft white band, no stage light (the section name keeps its colour). It fades in once the picture has loaded, and goes when you leave the song. A bought Merch backdrop is hidden while a cover is up (4.62.1); on a song with no cover it shows as before. The words are bold on the page and the stage alike (the line you're on boldest in the show). A song with no cover looks as before. Nothing new is stored.
- **Controls that hide in the show** (4.60.0): while the song plays, the X, the mic button and Pause fade after 3 seconds without a touch. Any touch shows them again, and that first touch only wakes them: it doesn't pause or press anything. The crowd, the combo, the section name and Skip this chord stay. Paused, during the count-in, while the show waits for a chord, with a sheet open and on the end card they are always shown. With reduced motion they simply appear and disappear.
- **The chord row fits, and the title scrolls** (4.62.0): "Chords · 6" is a label above the chord shapes. When every chord fits at a readable size (about six on a phone) all the tiles show and the row doesn't scroll, so nothing is hidden; with more, the tiles stop at their smallest size, snap as you scroll, and the edge fades while more are off screen. A tile names its chord once. A long song title first steps down from 26 to 20 px; if it still doesn't fit it scrolls across as a banner: one loop after two seconds, a rest, up to three loops, then still. Tap the title to play it again. With reduced motion it keeps an ellipsis.
- **Lined up the UG way** (4.65.0): lining a song up sends the AI only its sections and their chords, not the sheet, so a guessed sheet (two chords a line, the second over the middle word) can't be handed back as the answer. The AI is told that chords played before the words stay stacked before them (UG's F Am G over an indented line), that a row of chords between lines goes after the line before, that a line repeating the chords before it still lists them, and to follow Ultimate Guitar's official or highest-rated version when sites disagree. With an AI key, Edit has **Line up from the chord sites** for any song, your own edits too, with Undo.
- **Chord chips in Edit** (4.64.0): every chord on a line is its own chip, at least 44 px, so you can put several chords right next to one another, before the first word (stacked, the way UG writes F Am G over an indented line), after the last word, and over a wide space. Tap a chip to change or remove it; the + beside it adds the next chord next to it; the picker says what it is doing ("Chord after F", "Chord before the words"). A row of chords alone (intro, interlude) is a row of chips too, and the **Chords** button next to **Line** adds one. Every edit keeps Undo and only adds or removes spaces, so the words never change.
- **Chords over spaces** (4.63.0): a chord written over a wide space between two words (4 spaces or more) stands on its own over the space instead of riding the next word, as a chart means it. Chords before the words (an indented line) and after the last word already did. This is the groundwork for placing chords anywhere in the editor (4.64.0).
- **Even bands** (4.56.0): a row of chords with no words (an intro, a solo) is as tall as a sung line, paused and playing, so its band is the same height: the chords on top and an empty line below. A chart's header note ("Capo 2", "Strum: D-DU-UDU") is read, not played: the band and Chord Catch start on the first chord line.
- **Leaving the app pauses** (4.55.0): swipe to another app and the song pauses, back where it was just before the swipe (the page only learns the app went away a moment after the swipe begins, so it steps back 0.7 s). A show pauses the same way.
- Pause (4.52.0) hands the song page back as it always is: title, chips, Tools and Play in thumb reach, Play reading Resume, and a quiet band on the line you stopped on. Louie's line sits above Play when he has one. Play picks it up where you left it; the page's Back, or Tools for anything but its switches, ends the show. Unscored play pauses by folding Play into its corner. Paused, tap a chord in the song or in the chord tiles (a small shape under each name, 4.54.0) and its shape shows in a card just above Play (4.50.0).
- Show complete: bonus fans, the crowd, the chords caught ("34 of 40 chords"), the song you played (every chord by section, green if caught, outlined if it went by), the pair you missed most with Practice it, Encore (double bonus fans) and Challenge a friend.
- Tools (4.32.0) is one sheet from the bottom with three tabs at its foot, in thumb reach; the last tab is remembered. Play: song length or speed (− and + step it, the value opens the dial), Metronome as a switch (4.50.0 retired Now and Next, the panel of chord cards while you play, and its switch), The band (4.43.0: on or off, drums or click and a volume up to 150%, through one limiter; while the song plays the same sheet opens from the band button above Play, and the song keeps going), Lines in a gig (4, 5, 6 or All), Text size. Practice: Practice mode, Practice a section, Make it easier, Capo, Tuner, Play together. Song: Edit, Add to a set, Share, German, Spark tone, Add the words. Rows, not tiles: a switch toggles in place, a row with an arrow opens its sheet. From a show, the Song tab and Practice mode are left out.
- The band: a metronome (click or a drum beat that fits the song, written per section by the AI when there's a key). Beat from Your band plays the drums in gigs once he's joined. The synthesized bass line was taken out in 4.42.0 (it never sounded like the song).
- Practice mode (the switch in Tools; a learning song opens in it): loop a section, slow it to 50%, Build up, drums busier or simpler. Practice time counts as plays on the Tour Map.
- Bluetooth page-turner pedals work: left or Space plays and pauses, right goes to the next section.

### Tour, Charts, Band and Rehearse
- **Tour:** the month's tour (20 shows for 100 fans), the request line (a fan asks for one of your songs; double bonus fans as a gig), tonight's setlist (three daily goals), cover requests from what you just played in Apple Music, and the Friend quest (300 XP with a friend in a week).
- **Charts:** XP this week on a chart at your tier with nine computer players who play like people (weekend players, daily players, ones who fade). Top 5 move up on Monday, bottom 3 move down. A daily rival battle on one of your songs. Friends lists everyone you've dueled, ranked by XP.
- **Song duels:** after a scored gig, send a link with the song and your score; your friend plays it and sends theirs back. No server.
- **Support The Road (4.39.0):** a page from More with a thank-you from Louie, Support on Ko-fi (ko-fi.com/theroadapp, opened outside the app) and Tell a friend. Nothing unlocks and nothing changes; the app stays free. At App Store launch the Ko-fi link gives way to an in-app tip jar (`SUPPORT_URL` in `support.js`).
- **Band:** Louie's 27 friends join one at a time as you play songs through (Lola after your first, Looper at 140, then Pick-Clip, Vial the vacuum tube and Bottle-Slide at 160, 180 and 200 (4.37.0), and Gig-Bag, Kazo the kazoo, Tuk the ukulele, Capo, Spool the string spool and Peg the tuning peg from 225 to 360 (4.38.0)).
- **The lesson of the day:** about four minutes built from your songs: warm up on a change you already have, learn the change your songs need most (with the song it comes from), then play that song's section at 70%, looped in Practice mode (twice through counts). 40 XP when all three are done. Your skills sit under it as three bars, and All lessons has every fret.
- **Rehearse (4.33.0, one page):** today's lesson first (three parts as a bar, Start or Go on); then Your changes in one card: today's soundcheck changes first while it's on (the ones you dropped most in gigs this week, marked, +20 XP for both), then the changes your songs need most that you land least, each with why, a landed bar and Drill, one you have down, other changes you dropped, and Drill all; then Your skills (three bars, All lessons); then three tiles: Sit in with the band, Tuner, What I hear. The old neck address opens Rehearse. All lessons holds every lesson (chord lessons that listen to each string, chord switches against a click, scales) and the songs you're Learning.
- **Merch table:** spend fans on gear (Rain check keeps a streak through a missed night, Double set doubles XP for 3 gigs, Second take replays a lost battle), Louie's finishes (Stock blue, plus Pink and Teal free) and gig backdrops. Spending never touches XP. Settings > Help can add test fans to try it.

### Songbook, sets and editing
- Search titles, artists and lyrics. Tapping the bar clears the screen to two big buttons (Paste a song, which reads the clipboard, and What can I play next? when the AI is on) and your last three songs as cards with a Play button; the list stops above the keyboard. Paste a chord sheet into the bar and it works out the format, key, sections, title and artist. Nothing found offers the web, then Get the song.
- One slim Today strip at the top (4.26.0) that pages sideways with a dot for each: the song that keeps your streak (first), the next dated set, a song one new chord opens, tonight's request, a song worth another try (one you played once or twice and left three weeks ago), or one for today's weather or a change to work on. The streak itself is in the stat bar, and your week's changes are in Your profile. Sets are behind the Sets button; under the filters a line says how many songs there are, with the sort menu on its right.
- Filters in one row that always fits (All, Can play, Learning, a heart for Favorites), the chosen one filled. Sets is a button in the header and Tabs only is in the sort menu. Sorts, a letter index. Swipe left to delete (with Undo), right to favorite.
- Sets with a date, place and drawn cover; Play set runs them with a Next up card and remembers each run.
- Add opens a writing pad: Paste, Type, Sing or strum (key and chords found on the phone), and with an AI key, Scan a page or Find the chords. Edit works in place: every chord is a chip (tap it to change or remove it, + beside it adds another, a word puts one over it, + before the first word and after the last place chords the way a chart does, Chords adds a row of chords alone), every change saves with Undo. Deleted songs and sets stay 30 days in Recently deleted.

### Your profile, the Tour Map and the streak
- Your profile (4.17.0, a player card): opened from the streak in the stat bar or from More. The card has Louie in your finish, your venue (tap for the Tour Map), your chart and your level (XP from every play and gig; each level takes a little longer). Below it: your streak with its amp knob, fans to spend, shows played and songs you can play; 25 badges to collect; your band; the chord passport (4.19.0: a page per family, open, 7th, colour and barre chords, with every chord to collect, earned ones stamped, tap a stamp for its diagram, and Learn it for the next one); your song duels; and Your stats folded away: time played with the last seven days, when you play, your top changes (each with Drill it) and keys and tempo. Share your card makes a picture.
- Achievement callouts (4.44.0): a big word bursts over the screen for a moment and clears itself, without stopping the song or taking a tap. A combo of 10, 25, 50 or 100 in a gig, a new chord, a level, a new badge, a friend joining the band and the lesson of the day each get one. Each kind has a few looks (a lightning bolt, light rays, a burst, a stamp, a stage light, a flip) and never the same look twice in a row. Louie brings one of your band who has joined (Beat for combos, Lola for chords, Metro for levels, Tilly for lessons, otherwise someone different each time). One at a time, at most three after a song; Reduce Motion shows them still.
- The streak celebration, once a day after your first song played through: the screen floods with the streak colour, Louie drops in and throws the horns under a stage light that flickers on (on a milestone night, 7, 30, 100 or 365, the horns pop up too, and the phone taps along where it can), confetti falls, the count rolls up and the week fills in. Share makes a picture of it.
- The Tour Map: every song played through lights a hexagon on a map; rings grow into venues from Garage to Festival headliner, with simulated rival players around you (no two share a word in their names). Its sheet gives one goal: the next rival corner, about how many minutes of playing take it, how far along you are, and a song to start with and Play. Pull it up for your scene this week (minutes a day, the next corner's owner marked), hexagons you hold and corners taken. The venue, the note that rivals are simulated and Forget my spot are behind the info button. Your position stays on the phone, never in a backup.

### Tuner
- Acoustic and electric headstocks in colour (acoustic is wood; electric matches Louie's finish) with each key labelled, the note big at the top with what to do beside it, a bolder meter that eases into the last few cents, the instrument and tuning in one menu at the top, Guided (low to high) and Chromatic with adjustable A4. Standard, Drop D, half and whole step down, DADGAD, Open G and Open D.
- The tuner opens from Rehearse and every lesson (4.24.0). Each string you tune ticks (Android vibrates; iPhone gets the system tick from iOS 18) and chimes, reaching the in-tune zone gives a light tick, and the whole guitar gets three ticks, a louder chime and a small party with Louie. The chimes are loud enough to hear over the guitar, each string a little louder than the last, and the finish rings out as a chord (4.42.7). In a lesson, Start listening turns into "Listening · tap to stop" and comes back by itself if the microphone stops.

### Listening and sharing
- Listen searches Apple Music's public catalog, plays previews and saves a recording with its album art and length.
- Apple Music (optional, its own Settings row): with a subscription, Play can start the recording, and the page follows it line by line (synced lyrics times from LRCLIB) and chord by chord. Its 30-second preview gives the tempo, feel and key. Needs the token Worker (`worker/README.md`).
- Share a song or set as a link (the song travels inside it). Play together (4.29.0, clap to start): pick your part when the song has a sung melody (Chords, or Melody: the words with the notes you sang), Send song shares it to your friend, then both phones Listen for clap and one clap in the room starts the one-bar count-in on both. No server and no start time. A link opens the song and Play together on your friend's phone (an older link with a start time opens the same way).

### Help and settings
- Tips appear once, when they're useful. Settings > Help > Tips & gestures lists every gesture with Show me.
- Settings: Playing, Look (Auto, Light, Dark, Green), New songs, Today, Apple Music, Keys, Songbook and backups, Help. Back up now sits at the bottom.

## Look

Version 4's design system, at the end of `styles.css`: three palettes (Light is Festival Poster, Dark is Neon Midnight, Green is Green Room), flat colour with no outlines, chunky buttons on a darker lip, Fredoka for titles and Nunito for text (bundled). Game colours: `--streak`, `--fans`, `--strings`; `--accent-ink` is the accent for text, deep enough to read on the light palettes. Louie the amp is the mascot and the app icon. One control system (4.30.0): main buttons are 56 tall, row actions 42, chips 32; every segmented control is the Songbook filter's look (a track, the chosen part filled on its lip); chips and small cards are flat colour on a lip with no thin outline; lists of places to go are 56 tall rows. Older amp materials (copper, plate, lamps) are still in the file and redrawn from the palette.

## Chord sheet format

```
[Verse]
G              C        G
Blackbird singing in the dead of night

[Chorus]
[C]Take these [G]broken wings

[Verse 2]
Em            C
  Down the river   slowly
```

A chord over the indent before the first word (two spaces or more) is played before the singing starts (4.49.6): it stands ahead of the words with a short rest mark under it, and in time with the recording it comes a bar before the first word. A chord over a gap between words still lands on the next word.

## AI help (optional)

Settings > Keys > paste an Anthropic API key. Without a key the app works the same and the AI options stay hidden.

- **Clean up:** a messy paste comes back as a tidy chord sheet, which you can compare before saving or undo.
- **Scan a page:** a photo of a songbook page or handwritten sheet is read into a chord sheet.
- **Remove the capo:** in the ••• menu of a song whose chart has a capo; the chords move to the key the song sounds in, and one more tap puts the capo back.
- **Make it easier:** suggests a capo and up to four simpler chords. The sheet is never changed; the suggestion is stored alongside and can be turned off. No lyrics are sent.
- **One search for finding and adding (4.48.0):** the Road has two labelled buttons at the bottom, Songbook (straight to the list) and Search or add a song. The Songbook page has one bar, "Search or add a song", with + in it. Before you type, search shows "Not in your Songbook yet?" (4.49.2: no recent songs there; the Songbook has those): Paste, Scan (AI key), Sing it, Ideas (AI key), From Apple Music (4.49.0; 4.49.1 moved it to the top of the screen, which holds still until you type. When Apple Music is on: one row with how many songs you listened to lately and don't have; it opens a sheet where each song has Get the chords or Start a sheet, and ones you already have say In your Songbook) and Write one from scratch; opened from the Road it also starts with Open your Songbook. Typing shows "In your Songbook" first, then "Not in your Songbook": recordings from Apple's public catalog (4.49.8: on an iPhone Apple closes that search to web pages, so it goes through Apple Music instead, and is skipped when Apple Music is off), each with a button that says what it does (Get the chords with an AI key, Start a sheet without), then links to Ultimate Guitar and Chordify, then Write the title myself. Pasting a whole sheet or a share link into the bar goes to the paste card or the import sheet.
- **Get the song:** the title and artist go to a larger model with web search, which reads chord sites and returns sections, chords, key, capo, tuning, tempo and strum, with sources. Only chord and section names are kept, each one checked. The lyrics come from LRCLIB, matched by title, artist and length; the tempo from GetSongBPM when you've added that key. Then (4.41.0) the AI gets the chart and the lyrics as numbered lines with numbered words, reads the chord sites, and answers with positions only (line 12: G on word 1, D on word 6); the phone puts each chord over its word. Since 4.49.6 it also marks where nobody sings: word 0 is a chord played before the singing on that line (the words are indented past it) and the word after the last is a chord played after the line; it can cut one stanza into a Pre-Chorus and a Chorus; an intro played four times is written out four times; and it keeps the chart's chord names (a D/F# it adds goes back to D). The chart writes the plain chord where most sites do. A song placed before 4.49.6 is lined up once more the next time it opens, with Undo. When it can't tell, the chords are spread over the lines as a best guess, and the Gig never counts a missed change on such a sheet. A song whose chords were guessed (older Get the song songs, pasted words) is lined up once, in the background, the next time it's opened with an AI key, with Undo; a sheet you've edited is never touched. Each chart costs a few cents of web searches. A switch on the sheet picks how hard: Easy (the simplified version most sites show), My level (your chords from the library, weighted toward songs you've got, plus real barre chords and the recorded rhythm), or As recorded. The pick is kept; Play next's Add uses My level, or As recorded from A step up, without changing it. Strums show muted strums (x) and held beats (-), or say when a song is fingerpicked. While it works (4.57.0), one bar under the cover shows the whole job with a line saying what is happening and the time left ("Lining the chords up · about 20 s left"); each step's share comes from how long it took the last few times on this phone. The rows run in order: the one working sits on a band with a turning ring, a done one has a check, a waiting one a hollow circle, a skipped one a dash. It also finds the recording in Apple's catalog (on an iPhone through Apple Music, which needs Apple Music on in Settings > Keys): a clear match (title and artist exact, length within 10 s of the lyrics') is saved with the song, with its cover and length; a weaker one asks Use this recording?; none says Not found. Put aside, its bar above the search bar shows the same progress.
- **Get the song keeps what it found (4.27.0):** a tap outside, a swipe down or the arrow at the top puts the song aside instead of losing it, and a "Hurt is ready" bar above the search bar (Songbook and Road) brings it back as it was, or adds it. It survives a reload; only Not this one lets it go. The sheet says whether you can play it ("You know all 4 chords" or "1 new chord: Dsus2"), has a 30-second preview by the title, one Recording row, the first lines with Show the whole sheet, and Add to my songs at the bottom in thumb reach. Which recording shows each one as a card, the closest length first and marked Best match.
- **Add the words:** paste lyrics you've copied and Tabs puts a chart's chords over them, section by section.
- **What can I play next?:** suggests well-known songs that use mostly your chords, or with A step up, songs that are clearly harder. Songs already shown aren't repeated. Only Close shuts the sheet (a tap outside doesn't), and reopening it within the hour shows the same list without asking again; Show different songs asks for more. The level switch is on top and the songs come fewest new chords first, as cards (4.28.0): the cover plays the 30-second preview, Learn gets the song and then opens the new chord's lesson, and a strip shows the new chord's shape, the chords you know and how many more of your songs it opens. If the fetched sheet doesn't use the chord Play next named, it says so instead of teaching it. While it looks, Louie digs through a crate of records, one for each of your chords.
- **Spark tone:** a starting tone for a Positive Grid Spark amp. No lyrics are sent.
- **Language practice (4.36.0):** German, Spanish or Russian, one for every song. See below.

**Lyrics and the AI (4.41.0).** The words come from LRCLIB or your own sheet, never from the AI. The AI may read them to do its job (place chords over the right words, translate for language practice), and it answers with positions or translations, never with the lyrics themselves; the phone puts the sheet together.

**Translation exception (language practice):** for a song already in your library, the AI may translate its sung lines into the language you picked (German, Spanish or Russian; one for every song, chosen the first time and changed in Settings > Language practice, which deletes the old translations after asking), only when you turn it on for that song. Translations stay on the phone with the song, are never shared or exported, and are dropped when the song's words change. Tests check this (`tests/core.test.mjs`, `tests/e2e/german.e2e.mjs`). German practice has levels from a few common nouns to fully German, shows each noun's gender, and has a word card with meaning, grammar and a voice in that language. Spanish shows el or la; Russian marks the stress on every word and, at Fluent, puts the sound in Latin letters under each line (a switch in Settings turns that off).

### About the API key

The key is stored in the browser's local storage and sent straight from the phone to `api.anthropic.com`. That's a reasonable trade for a personal app with no server, with limits:

- Anyone with the unlocked phone can read it in Settings.
- Any script on the page could read it. The app loads no third-party scripts, escapes all user text, and its content security policy only lets it talk to `api.anthropic.com`, Apple's song search, LRCLIB, GetSongBPM and Open-Meteo.

Use a key made only for Tabs with a low monthly spend limit, and revoke it in the Console if the phone is lost. Keys are never put in backups.

## Development

Open `index.html` through any static server (ES modules need http). Plain ES modules, no build step.

| File | What's in it |
|---|---|
| `index.html` | Page shell and content security policy |
| `styles.css` | All styles; the version 4 look is at the end |
| `core.js`, `core/` | Data and logic with no screen code, unit tested. `core.js` keeps storage, markup, backups and tuner maths and re-exports the topics in `core/` (chords, recording, sketch, playing, groove, turf, neck, game) |
| `app.js` | Song page (auto-scroll, chord shape card, song map, iPad layouts, pedals), Find songs, router |
| `library.js` | The Songbook: search, filters, the song list, swipes, the paste card |
| `audio.js` | Metronome and drums |
| `aihelp.js` | AI help: the request to Anthropic, errors and limits |
| `ui.js` | Icons, toasts, `ask()` questions, `onLeave` and `onScroll` hooks. Depends only on `core.js` |
| `editor.js` | Editing in place, new songs, writing mode, tap tempo, chord picker |
| `settings.js` | Settings menu and pages, Recently deleted |
| `sets.js` | Sets, playing a set, covers |
| `coach.js` | Tips, Show me demos, Tips & gestures |
| `store.js` | Safety copy, backups, storage, problems log |
| `share.js` | Share links, opening a shared link, Play together |
| `listen.js` | Listen: recordings, previews, length from the recording |
| `profile.js` | Your profile: the profile page and its share card (numbers from `profileOf` in `core.js`) |
| `fold.js` | One-handed: the bar folds into Play's corner while playing; pull down at the top to go back |
| `dial.js` | The corner dial (speed meter, key, set picker) |
| `findai.js` | Play next, chord charts, Get the song |
| `aitools.js` | Make it easier, Spark tone |
| `tuner.js`, `heads.js` | Tuner and headstock drawings |
| `sketch.js`, `strum.js` | Sing it, Strum it (`strum.js` loads `vendor/basic-pitch/`) |
| `german.js` | Language practice (German, Spanish or Russian) |
| `crop.js` | Cover photo framing |
| `road.js`, `hud.js` | The Road (home): the path, Louie and the Songbook bar; the stat bar, tab bar and More sheet |
| `gig.js` | The Gig (scoring in `core.js`) |
| `tour.js`, `charts.js`, `band.js`, `friends.js`, `duel.js`, `merch.js` | Tour quests, Charts, Your band and Louie's friends, song duels, the Merch table (numbers in `core.js`) |
| `practice.js` | Rehearse (one page with today's lesson), All lessons, the lessons |
| `playmap.js`, `scene.js`, `drawer.js` | The Tour Map, rival players, pull-up drawers |
| `louie.js` | Louie, drawn in the palette's colours |
| `vendor/fonts/` | Fredoka and Nunito (SIL Open Font License) |
| `sw.js` | Offline copy; lists every app file (a test checks the list) |
| `worker/` | The MusicKit token Worker for Apple Music (deployed by hand; see `worker/README.md`) |

`editor.js` and `settings.js` load on first use and are fetched quietly a few seconds after start; the tuner, AI tools, Sing it, Strum it, German practice and cover framing load on first use.

Conventions:
- Build markup with html`` from `core.js`, which escapes every value unless it's safe markup (another html``, an icon, or `raw()`). Older templates use `esc()` on every value. A browser test fills every name with markup and checks none of it runs.
- Shared state lives in the module that owns it; other modules read it through imports and change it only through that module's functions (`setData`, `setOpenEdit`, `setSetCtx`, `setFilter`). ESLint's `no-import-assign` catches a direct write.
- The app never uses the phone's alert boxes; `ask()` shows a short sheet instead. Discarding something happens at once with Undo rather than a question.
- Accessibility: every control has a VoiceOver name, panels are labelled dialogs that take focus and close with Escape, focus is always outlined, text meets contrast in the light and dark palettes (axe runs in CI), and Reduce Motion turns animation off.
- Wide screens: from 700 px text is larger; from 1000 px the song gets a rail with the chord chips; from 1150 px a song list on the left. A phone on its side gets a slim column of controls.

Data: the library lives in IndexedDB with a copy in localStorage written on every save; at start the newer readable one wins. Older saves migrate automatically. [docs/DATA.md](docs/DATA.md) describes every field, the backup file and how a restore is checked.

Problems: the last 20 errors are kept on the phone (4.42.8: problems from an older version are listed under "Before" and drop off after 30 days), and the first in a session shows a note with Copy details. Settings > Help > Copy diagnostics copies the version, device, counts and storage, never song words, titles or keys.

### Releases

`VERSION` in `core.js` and `CACHE` in `sw.js` must match (a test checks). A feature is a minor release (2.30.0); a fix is a patch on the release where the defect was found (2.30.1). If app files change on `main` without a bump, the bump version workflow raises the patch number. The app opens from its saved copy, so a change only reaches installed apps through a new cache name; on the next launch it downloads the release in the background and offers to reload. Parts loaded later are requested as `tuner.js?v=1.2.3` so they always come from the same release as the open app.

### Tests

- `node --test` runs the unit tests (no dependencies): chord parsing, transposing, wrapping, fingerings, library data and backups, pitch detection on synthetic and real recordings (`tests/audio/`), tip pacing, escaping, and the version matching the cache.
- Browser tests run the real app in Chromium: `npm i --no-save playwright axe-core && npx playwright install chromium`, then `node --test --test-concurrency=4 tests/e2e/*.e2e.mjs`. `app`, `app2` and `app3` cover features end to end (with Play set to plain scrolling); `gig` covers the Gig, the main Play path; `regress` walks the main path at 320, 390 and 1180 wide in both themes; `a11y` checks names and axe findings; `visual` compares screens against `tests/visual/ci/`.
- `node tests/quick.mjs` runs the unit tests plus only the browser tests that cover files changed since `origin/main`.
- GitHub Actions runs everything plus ESLint on every push. Visual references are remade with the update screenshots workflow after an intended change to how screens look.

## Version history

- **4.x, the game (2026):** 4.0.0 the new look, Louie, the stat bar, tab bar and the Road path; 4.1.0 the Gig and Louie as the app icon; 4.2.0 one song screen built from the Gig; 4.4.0 Full; 4.5.0 Tour quests; 4.6.0 Charts; 4.7.0 Your band; 4.8.0 Rehearse; 4.9.0 the Songbook; 4.10.0 cover requests; 4.11.0 livelier charts and moving down; 4.12.0 song duels; 4.13.0 Friends and the Friend quest; 4.14.0 the Merch table; 4.15.0 the streak celebration around Louie, fewer settings; 4.16.0 the rocking guitar streak, stage light, horns and knob, Louie in the stat bar, free Pink and Teal finishes, test fans; 4.17.0 Your profile as a player card, with levels and badges; 4.18.0 a simpler Tour Map sheet; 4.19.0 the chord passport as pages to collect, four stat cards, Worth another try in the Songbook, the string that drifts most in the tuner.
- **3.x, The Road:** Tonight as home with Louie, the Tour Map with rival players, one-handed playing (the bar folds into Play's corner), Apple Music play-along timed line by line and chord by chord, the neck (lessons that listen), Practice mode, drums that fit the song.
- **1.x and 2.x, Tabs:** chord sheets and tabs with auto-scroll, sets, the tuner, the editor, Sing it and Strum it, AI help, German practice, Your playing.

The git log has every release.

## Credits

- Lyrics: [LRCLIB](https://lrclib.net). Fetched only for Get the song, stored on the phone, never shared by Tabs.
- Tempo data by [GetSongBPM.com](https://getsongbpm.com). Optional free key from [getsongbpm.com/api](https://getsongbpm.com/api), kept on the phone and out of backups.
- Weather data by [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0). Only the chosen city's position is sent, once a day.
- Strum it uses [Basic Pitch](https://github.com/spotify/basic-pitch-ts) by Spotify and TensorFlow.js (both Apache-2.0), bundled into `vendor/basic-pitch/` by `.github/workflows/vendor-bp.yml`.

## License

MIT
