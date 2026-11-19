# Louie Road plan: tours, Song ladder and skipping ahead

A beginner-to-advanced Road in 13 tours, a Song ladder that turns any Songbook song into one-chord-at-a-time practice without touching the song, and a fair way to skip ahead when your playing shows you're ready.

Written by Grok for Graham, 2026-11-19, from the code on `road-ready` at `1b73f60`. Graham approved the decisions below.

## Contents
1. The short version
2. How the Road works today
3. What other apps do
4. The tours
5. Keeping today's progress
6. The Song ladder
7. Readiness and skipping ahead
8. Data and code sketch
9. Decided
10. Elite finishes
11. Open questions
12. Rollout
13. Sources

## 1. The short version

**The idea in one line:** teach every skill on the song the player picked. The Road says what to learn next; the Song ladder turns their own song into the practice; readiness lets them jump ahead when their playing proves it.

- 13 tours, from Opening night to an advanced Encore, short early and longer later, like Duolingo's sections. Each tour ends at a plain level marker ("you can now...").
- Every existing leg and stop id stays, so nobody loses progress. Strumming, Picking and Fingerstyle, the three legs marked coming, get filled in.
- The Song ladder builds graded versions of any Songbook song at play time: one chord looped on the beat, then two chords, then one more at a time, then the real strum, then the full song at speed. The song itself is never edited.
- Skipping ahead is offered, never forced: song stars and mic-checked lessons add up to a readiness score, a short Prove it show confirms it, and skipped legs show as passed and stay playable.

## 2. How the Road works today

| Part | How it works | Where |
|---|---|---|
| The ladder of lessons | `SKILL_LEVELS`: Open chords (7 chord lessons and a level check), Chord switches (8 switches and a check), Scales (5 scales, open from the start). Strumming, Picking and Fingerstyle are placeholders marked soon. | `core/neck.js` |
| Stop ids | Chord `c:G`, switch `s:G-C`, scale `x:Ampent`, check `k:open`. Finished lessons live in `data.skills.done` (count, best tempo, time). `cleanSkills` keeps at most 200 ids of 12 characters. | `core/neck.js` |
| The Road path | `roadPath` turns each playable level into a leg: its lessons in order, a merch box after every third lesson (`BOX_EVERY`), the level check as the headline show. Only the first open stop on the whole Road is current. | `core/game.js` |
| Guitars | One guitar per leg (Porch, Cornerstone, Club Slab, Hollow Hill, Swing, Koa Arc, Comet). Headlining a leg earns the next. 23 paintings have fret data; each neck holds 17 to 19 stops. | `GUITARS` in `core/game.js`, `docs/guitars/frets.json` |
| Songs move you along | A chord stop is also done after 5 songs with that chord played to the end (`KNOW_PLAYS`). A level check passes with a song that uses only that leg's chords, played after the leg's lessons. | `skillState`, `roadNote` in `core/neck.js` |
| Lessons | Chord lesson: string-by-string check with the mic. Switch drill: change on the beat over a click, from 50 BPM up 10 a round to the target (80), graded by `gradeSwitches` (75% within a quarter beat). Scales: note by note. | `practice.js` |
| Song practice | Practice mode loops a section, slows it to 50%, and Build up starts at 80% and adds 5% a pass. Lesson of the day: warm-up change, the change your songs need most, then that song's section at 70%. | `app.js`, `lessonOfDay` in `core/game.js` |
| Shows (touring) | Since 4.91.0 a show doesn't listen; changes count as the song carries them past the line (honour system). Song stars: Learning, Rehearsed (3 plays), Gig-ready (full speed, no pause), Headliner (Gig-ready on 3 days). | `gig.js`, `starsOf`; `docs/NO-CATCH-PLAN.md` |
| The Songbook | The player's own library. A song is plain chord-sheet text in `body` plus `key`, `transpose`, `bpm`, `capoOff`, `practice`, and `easier` (the Make it easier suggestion, stored beside the sheet). | `docs/DATA.md`, `library.js` |

What the plan can reuse, nearly all of it already tested:

| Piece | Use in the plan | Where |
|---|---|---|
| `chordModel`, `sheetChords`, `songChanges`, `shapesOf` | Read a song's chords in order, per line and section, and how often each change happens | `core.js`, `core/game.js`, `core/playing.js` |
| `transposeChord`, `bodyCapo`, `shapeSteps`, the capo table in Make it easier | Try capo 0 to 7 and pick the easiest shapes, without the AI | `core/chords.js`, `aitools.js` |
| `strumDetector`, `beatTrack`, `gradeSwitches` | Grade a one-chord loop or a two-chord loop against the beat | `core/neck.js`, `audio.js` |
| `strumFit`, `chordLead`, `chordTargets` | Check one held chord, or call A or B on a change (90 to 97% right on Graham's takes) | `core/neck.js`, `docs/NO-CATCH-PLAN.md` |
| Strum line in the chart header ("Strum: D-DU-UDU") | The song's own pattern for the strum rung | `stage.js`, `core.js` |
| Practice mode, Build up, the band | Tempo ramps and loops for every rung | `app.js`, `audio.js` |
| `journal.chords`, `journal.changes`, song stars, `PASSPORT` order | Readiness signals and the easy-to-hard chord order | `core/playing.js`, `core/game.js` |

## 3. What other apps do

| App | What the public sources say | What Louie takes |
|---|---|---|
| Simply Guitar | Basics courses, then a Chords path and a Lead path. A lesson shows the chord shapes, lets you practise the coming changes at your own pace, then plays parts over a drum track, then the song. Too many misses rewinds a bar or two. Songs are fixed to a course and often simplified, re-keyed or cut to a part (Guitar.com: Creep shows up once, transposed, with two of its four chords). Starts with Em, Asus2, Am and C, and uses Fmaj7 before F (LowEndBox, one reviewer). Reviewers say lessons are locked in order; a sign-up questionnaire asks about experience. | Chords first, changes at your own pace, then over a beat, then the song. Easy shapes before hard ones. Where Simply fixes a song at one level, Louie builds every level of the player's own song. |
| Yousician | An unlocked path in 10 levels with themes (chords and rhythm, lead, knowledge); skip to any mission. Song levels match path levels. Some songs offer Simplified and Original versions (that support page is for GuitarTuna, Yousician's sister app). Practice mode slows songs, Wait to play, auto-adjust speed. | Song difficulty tied to Road level; switch between a simple and the real version; slow-down and loops. |
| Fender Play | A path of levels picked from instrument and style. Skip ahead or mark any course or lesson complete, and undo it. Songs rated 1 to 3 picks by rhythm, technique, chords and meter. | Skipping keeps a sense of completion and can be undone; a simple difficulty rating per song. |
| JustinGuitar (for the change-speed number) | One-minute changes: count clean changes between two chords in a minute. Community guides cite about 30 a minute as a goal; how a change is counted varies (not verified on Justin's own site). | Changes a minute as the change-speed signal, already planned as the Switch check. |

**Unverified:** Simply Guitar's exact rung-by-rung order inside a song isn't published. The step order above comes from reviews, not from Simply. The Duolingo numbers come from fan trackers, not Duolingo (English to Spanish: 8 sections plus a review section, roughly 236 to 286 units; early sections are small and later ones grow; each section ends at a clear level marker).

## 4. The tours

Short tours first, so a beginner gets a level marker in the first week, then longer tours as skills deepen. A tour plays on one guitar; each leg is one neck of stops on it. Neck stops count the lessons plus a merch box after every third lesson, as today; the headline show is the badge, not on the neck.

In numbers: 13 tours (Opening night plus 12), 56 legs (49 new, 7 existing or placeholder), about 348 stops counting lessons, boxes and headlines. A neck holds 17 to 19 stops; the longest leg here is 10.

| Tour | Level marker at the end | Legs | Guitar | Existing legs inside |
|---|---|---|---|---|
| 0. Opening night | You know how the app works and played a first song | 1 | None (picks) | `opening` |
| 1. First chords | Beginner 1: you can strum along to a song with two chords | 3 | Porch | `open` |
| 2. Chord changes | Beginner 2: you can play a three or four chord song all the way through, slowly | 3 | Cornerstone | `switch` |
| 3. Strumming | Beginner 3: you can strum the pattern most pop songs use | 4 | Hollow Hill | `strum` |
| 4. First full songs | Elementary 1: you can learn most campfire songs on your own | 4 | Walnut Hall (from the shop concepts) | None |
| 5. Barre and power chords | Elementary 2: you can play barre chords inside songs | 5 | Ghost Spalt (from the shop concepts) | None |
| 6. Rhythm feel | Intermediate 1: the same chords groove in different styles | 5 | Redwood Hollow (from the shop concepts) | None |
| 7. Single notes and riffs | Intermediate 1: you can read tab and play a riff | 5 | Swing | `pick` |
| 8. Fingerstyle | Intermediate 2: you can fingerpick a song | 4 | Koa Arc | `finger` |
| 9. Scales and lead | Intermediate 2: you can play lead lines in box 1 | 6 | Club Slab | `scales` |
| 10. Improvising | Upper intermediate: you can make up a solo over a song | 5 | Velvet Crown (from the shop concepts) | None |
| 11. Theory and ear | Upper intermediate: you can work out a song by ear | 5 | Ziricote Grand (from the shop concepts) | None |
| 12. Encore: advanced | Advanced: you play all over the neck | 6 | Comet | None |

### Tour 0: Opening night

Guitar: None (picks). Level marker: You know how the app works and played a first song.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Opening night (`opening`), exists | Mic, a chord, a verse, pause, first show | Who's playing, Let me hear you, Tap a chord, Play a verse, Pause and pick up | 6 | Your first show |

### Tour 1: First chords

Guitar: Porch. Level marker: Beginner 1: you can strum along to a song with two chords.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| One-chord groove (`groove`) | Hold one chord and strum it on the beat | Em, ring it, Down on every beat, 60 BPM, Down on every beat, 80 BPM, Your song, rung 1 | 5 | Your song with one chord, strums on the beat |
| Two chords (`pair`) | Change between two chords on the bar line | Am, ring it, Em to Am, C, ring it, Am to C, Your song, rung 2 | 6 | Your song with two chords |
| Open chords (`open`), exists | Seven open chords, every string clean | G, C, D, Em, Am, E, A | 9 | Level check: a song with these chords |

### Tour 2: Chord changes

Guitar: Cornerstone. Level marker: Beginner 2: you can play a three or four chord song all the way through, slowly.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Chord switches (`switch`), exists | Land the change on the beat | G to C, C to D, G to D, Em to Am, Am to C, D to A, A to E, Em to C | 10 | Level check: a song with these changes |
| Three and four chord songs (`three`) | Loop the common progressions | G C D loop, A D E loop, G D Em C loop, Your song, add a chord, Your song, add another | 6 | Your song with every chord at 70% |
| Faster changes (`quick`) | Change speed: clean changes a minute | G to C, 20 a minute, C to D, 25 a minute, G to D, 30 a minute, Anchor fingers: G to Em, C to Am, Lift early on the last beat | 6 | Your song at 90%, no pause |

### Tour 3: Strumming

Guitar: Hollow Hill. Level marker: Beginner 3: you can strum the pattern most pop songs use.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Down and up (`strum`), exists | Eighth notes with a steady arm | Down-up at 60, Down-up at 80, Keep the arm moving (ghost strums), D-DU on one chord | 5 | One chord, D-D-U-U-D-U at 70 |
| The pop pattern (`pop`) | D-DU-UDU, then with changes | D-DU-UDU at 60, At 80, At 100, With two chords, With four chords | 6 | Your song's strum rung |
| Accents and feel in three (`feel3`) | Accents, muted chucks, 3/4 and 6/8 | Accent 2 and 4, The muted chuck, Waltz: D-DU-DU, 6/8 rock | 5 | A song in three, or your song with accents |
| Your song, its own strum (`ownstrum`) | The song's real pattern at full speed | Its pattern on one chord, With every chord at 80%, At 90%, At 100% | 5 | Gig-ready star on your song |

### Tour 4: First full songs

Guitar: Walnut Hall (from the shop concepts). Level marker: Elementary 1: you can learn most campfire songs on your own.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| 7th chords (`seventh`) | E7 A7 D7 G7 B7 and the 12-bar | E7, A7, D7, G7, B7, 12-bar in A | 7 | 12-bar blues in A, through |
| Colour chords (`colour`) | Cadd9, Dsus4, Asus2, Fmaj7, Em7 | Cadd9, Dsus4, Asus2, Fmaj7, Em7, G to Cadd9 to Dsus4 | 7 | A song with colour chords |
| Song form and sets (`form`) | Intros, endings, count yourself in, two songs in a row | Intro and ending, Count yourself in, Verse, chorus, bridge, Two songs back to back | 5 | A two-song set, through |
| Capo and keys (`capo`) | Same shapes, new keys | Capo 2, Make it easier, Remove the capo, Shapes in G, C, D, A, E | 5 | A song with a capo, through |

### Tour 5: Barre and power chords

Guitar: Ghost Spalt (from the shop concepts). Level marker: Elementary 2: you can play barre chords inside songs.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Power chords, low E (`power6`) | Two-finger power chords that move | G5, A5, Move the shape, Palm mute, Punk eighths | 6 | A power chord riff, through |
| Power chords, A string (`power5`) | Root on the A, string jumps | C5, D5, E to A string jumps, Your song in power chords | 5 | A song in power chords |
| The F chord (`fchord`) | From Fmaj7 to the full barre | Fmaj7, Mini F (four strings), Full F, C to F, F to G | 6 | A song with F |
| Barre shapes (`barre`) | E shape and A shape barres | Bm, F#m, B, Gm, Cm | 6 | A song with Bm |
| Barre in songs (`barresong`) | Open to barre changes in time | G to Bm, D to F#m, C to F, 20 a minute, Bm to G, 20 a minute | 5 | Gig-ready song with two barre chords |

### Tour 6: Rhythm feel

Guitar: Redwood Hollow (from the shop concepts). Level marker: Intermediate 1: the same chords groove in different styles.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Swing and shuffle (`swing`) | Long-short eighths | Shuffle on one chord, Blues shuffle in E, Light swing, Swing your song | 5 | A shuffle, through |
| Syncopation and pushes (`sync`) | Ties and chords that land early | The skipped down, Push into the bar, Ties across the beat, Your song with pushes | 5 | A syncopated song |
| Palm muting and dynamics (`mute`) | Quiet verse, loud chorus | Palm-muted eighths, Open up for the chorus, Soft and loud, Build a song | 5 | Your song with dynamics |
| Funk sixteenths (`funk`) | Scratches and a loose wrist | Sixteenths on one chord, Muted scratches, Small chord shapes, A funk vamp | 5 | A funk vamp, through |
| Grooves by style (`genre`) | Country, reggae, rock | Boom-chick, Reggae offbeat, Rock eighths, Pick a style for your song | 5 | Your song in a new style |

### Tour 7: Single notes and riffs

Guitar: Swing. Level marker: Intermediate 1: you can read tab and play a riff.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| One string at a time (`pick`), exists | Read tab, alternate picking | Reading tab, Down-up on one string, Two strings, A short melody | 5 | A simple melody, through |
| First riffs (`riffs`) | Riffs on the low strings | Open-string riff, Riff on frets 0 to 3, Riff with a rest, Riff at tempo | 5 | A classic-style riff |
| Melodies across strings (`melody`) | Moving between strings cleanly | String crossing, A folk melody, A pop hook, Melody at tempo | 5 | A melody, through |
| Hammer-ons, pull-offs, slides (`legato`) | Notes without picking every one | Hammer-on, Pull-off, Slide, A riff with all three | 5 | A riff with legato |
| Riffs from your songs (`tabsongs`) | Tab songs from your Songbook | Tab song, slow, Tab song, 80%, Tab song, 100% | 3 | A tab song, through |

### Tour 8: Fingerstyle

Guitar: Koa Arc. Level marker: Intermediate 2: you can fingerpick a song.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Thumb and fingers (`finger`), exists | p, i, m, a on their own strings | Thumb on the bass, Fingers on the treble, p-i-m-a, Pinch | 5 | A pattern over two chords |
| Arpeggios (`arp`) | Chords as rolling notes | Arpeggio on C, On Am, Changing chords, In 3/4 | 5 | An arpeggio song |
| Travis picking (`travis`) | Alternating thumb | Thumb alone, Add one finger, Add the pinch, Across changes | 5 | A Travis pattern, through |
| Fingerstyle your song (`fingersong`) | Your song, picked | Pattern on rung 2 chords, All chords, At full speed | 3 | Your song, fingerpicked |

### Tour 9: Scales and lead

Guitar: Club Slab. Level marker: Intermediate 2: you can play lead lines in box 1.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Scales (`scales`), exists | Up and back down, one note at a time | Am pent, G pent, C major, A minor, A blues | 6 | None today (stays an open side track) |
| Bends and vibrato (`bends`) | Bend in tune, make notes sing | Half-step bend, Whole-step bend, Vibrato, Bend and release | 5 | A lick with a bend |
| Licks in box 1 (`licks`) | Short phrases you can reuse | Lick 1, Lick 2, Lick 3, Licks over a backing | 5 | Three licks over the band |
| Up the neck (`boxes`) | The five pentatonic boxes | Box 2, Box 3, Box 4, Box 5, Connect the boxes | 6 | A run across two boxes |
| Major pentatonic and country (`majpent`) | Bright licks | G major pent, Country lick, Mix major and minor | 3 | A country solo |
| Double stops and slides (`dstops`) | Two notes at once | Thirds, Sixths, Slide into a double stop | 3 | A double-stop lick |

### Tour 10: Improvising

Guitar: Velvet Crown (from the shop concepts). Level marker: Upper intermediate: you can make up a solo over a song.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Call and response (`call`) | Answer Louie's phrase | Copy a phrase, Answer it, Change one note, Four bars of answers | 5 | Eight bars of call and response |
| Solo over a 12-bar (`blues12`) | One box over the changes | Two notes only, Box 1, Leave space, Turnaround lick | 5 | A 12-bar solo |
| Target chord tones (`tones`) | Land on the chord's notes | Land on the root, Land on the third, Follow two chords, Follow four chords | 5 | A solo that follows the chords |
| Phrasing (`phrase`) | Space, repetition, dynamics | Short and long, Repeat and change, Build to a peak | 3 | A shaped solo |
| Solo over your song (`solosong`) | The app finds the key and the scale | Find the key, The scale for it, Solo over the verse, Solo over the chorus | 5 | A solo over your song |

### Tour 11: Theory and ear

Guitar: Ziricote Grand (from the shop concepts). Level marker: Upper intermediate: you can work out a song by ear.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| Notes on the neck (`notes`) | Find any note on the low strings | Low E names, A string names, Octave shapes, Find it fast | 5 | Name 20 notes in a minute |
| Keys and numbers (`keys`) | I, IV, V, vi in any key | The major scale, Chords in a key, Numbers, not names, Change key with numbers | 5 | Play your song in a new key |
| Building chords (`build`) | Triads and sevenths | Major and minor triads, Sevenths, Sus and add, Spell a chord | 5 | Spell and play five chords |
| Hear the change (`hear`) | Tell I, IV and V by ear | I or V?, I, IV or V?, Add vi, Hear a whole progression | 5 | Name a progression by ear |
| Play by ear (`byear`) | Find a song's key and chords | Find the key note, Find the chords, Check with Strum it, Write it in the Songbook | 5 | A song you worked out |

### Tour 12: Encore: advanced

Guitar: Comet. Level marker: Advanced: you play all over the neck.

| Leg (id) | Skill it unlocks | Lesson stops | Neck stops | Headline show |
|---|---|---|---|---|
| CAGED (`caged`) | One chord in five places | C shape, A shape, G shape, E shape, D shape | 6 | One song in two positions |
| Triads up the neck (`triads`) | Small shapes on top strings | Major triads, Minor triads, Inversions, Triads over your song | 5 | A part made of triads |
| Other tunings (`tunings`) | Drop D, DADGAD, open G | Drop D, Open G, DADGAD, A song in a new tuning | 5 | A song in a new tuning |
| Slide (`slide`) | Bottle-Slide's leg | Slide in tune, Open G slide, Slide licks | 3 | A slide blues |
| Speed and hybrid picking (`speed`) | Clean at speed | Alternate picking at 100, At 120, Pick and fingers, A fast riff | 5 | A fast riff at tempo |
| Jazz chords (`jazz`) | maj7, m7, 7 and voice leading | Shell voicings, ii-V-I, Voice leading, A jazz standard form | 5 | A ii-V-I tune, through |

## 5. Keeping today's progress

- **Every existing id stays.** Leg ids `open`, `switch`, `scales`, `strum`, `pick`, `finger` and every stop id (`c:`, `s:`, `x:`, `k:`) keep their meaning. The steps of `open` and `switch` don't change, so box ids like `b:open-3` still point at the same box.
- **New legs before your spot are passed.** A new leg that sits before a leg you've already started counts as passed (for example One-chord groove and Two chords, for anyone with a chord lesson or Opening night done). Your current stop doesn't move.
- **Guitars you own stay yours.** Club Slab moves to Tour 9 with Scales. Anyone who already earned it keeps it. Hollow Hill, Swing and Koa Arc stay with the legs they were set aside for.
- **Shared lessons credit both legs.** A stop that teaches the same thing in two legs uses the same id (Em in One-chord groove and Open chords), so doing it once ticks both.
- **One storage limit to lift.** `cleanSkills` keeps 200 finished ids. The full plan has about 400 lessons, so the cap goes up from 200 to 800 (decided).
- **Scales stays open.** Scales stays a side track you can play from the start, as now, and also counts as Tour 9's first leg.

## 6. The Song ladder

Give it any chord song in the Songbook and it works out a ladder of rungs when you press Learn it step by step. Nothing is written into the song: the rungs come from the sheet each time, and progress lives beside the songs.

1. **Rung 1: one chord on the beat.** You play only the song's first chord, with easy shapes allowed, one downstrum on every beat, at 70% of the song's tempo. The band carries the other bars (early rungs use the band only), which show as rests, so the song still sounds like itself. Done when two loops are clean (75% of strums within a quarter beat, the switch drill's rule).
2. **Rung 2: two chords, change on the bar.** The second chord joins. Changes only on the 1, with a count-in to the change, at 70%. Louie can loop just the two-chord lines first.
3. **Rungs 3 and up: add one chord at a time.** Each rung adds the next chord and shows how much of the song you now play ("you're playing 74% of Harbor Lights"). Tempo rises 5% a rung, up to 80%.
4. **Strum rung: the song's own pattern.** Its pattern from the chart header (or a default by beat and feel) first on one chord, looped, then across the chords you have.
5. **Full song.** Every chord, its pattern, with Build up from 80% to 100%. Then the normal song stars take over: Gig-ready, then Headliner.
6. **Real shapes (optional).** When the Road has taught the full G or the F barre, the ladder offers to swap the easy shape back to the real one.

| Rule | How it decides |
|---|---|
| First chord | The chord that fills the most bars. If it's hard (a barre, or difficulty 6 or more), use its easy shape; if there's none, take the next most common chord. |
| Second chord | The chord the first one changes with most often (`songChanges`), so rung 2 is a real back-and-forth from the song. |
| Next chords | One at a time: the chord that adds the most bars for its difficulty. Chords you already know come first, so a known chord never waits behind a new one. |
| Easy shapes | Easy G (one finger, top strings), easy C (two fingers), Fmaj7 for F, Bm7 for Bm, B7 for B, F#m7 for F#m. These are shown with their real name plus "easy". New voicings needed in `core/chords.js`. |
| Substitutions | A chord that appears once or twice and is hard can be held as the chord before it, or swapped for a near one (Bm to Bm7, or D). Up to four, like Make it easier. |
| Capo and key | Try capo 0 to 7 (the capo table already in `aitools.js`) and pick the lowest total difficulty weighted by bars. With the recording, only a capo is allowed, so it sounds the same. With the band, the key can move instead. |
| Tempo ramp | 70% for rungs 1 and 2, then plus 5% a rung up to 80%, the strum rung at 80%, the full song 80% to 100% with Build up. Never under 50%. |
| Timing | A chord is one bar unless a line has more than four, then two beats each. Song `bpm` when there is one; otherwise looked up as the metronome already does. |
| Which songs | Chord songs only (not tabs). A one-chord song skips rung 2. A song with more than eight chords groups rare chords into the last rung. |

Worked example on the sample song, Harbor Lights (`SAMPLE` in `app.js`; key G, 96 BPM, 35 chord bars: G 11, D 10, C 6, Em 5, Am 2, Bm 1):

| Rung | Chords you play | Share of the song | Tempo | Strum |
|---|---|---|---|---|
| 1 | G (easy G allowed) | 31% | 67 BPM (70%) | Down on each beat |
| 2 | G, D | 60% | 67 BPM (70%) | Down on each beat |
| 3 | G, D, Em | 74% | 72 BPM (75%) | Down on each beat |
| 4 | G, D, Em, C | 91% | 77 BPM (80%) | Down on each beat |
| 5 | Plus Am, and Bm as Bm7 | 100% | 77 BPM (80%) | Down on each beat |
| Strum | All | 100% | 77 BPM (80%) | D-DU-UDU |
| Full | All, real shapes | 100% | 77 to 96 BPM | D-DU-UDU |

Em comes before C because it adds nearly as many bars for much less effort. G starts because it fills the most bars and is the home chord.

How it ties to the Road: legs can hold Your song stops (`y:one`, `y:two`, `y:add`, `y:pattern`, `y:full`). Any song's matching rung finishes them, and the Road suggests the Tonight song. A chord stop also counts as done when you finish a rung with that chord twice, next to today's 5-songs rule. The headline shows of Tours 1 to 3 are rungs of the player's own song.

## 7. Readiness and skipping ahead

| Signal | Trusted how | Comes from | Counts as ready at |
|---|---|---|---|
| A chord | Mic, or many plays | Chord lesson string check, or 5 songs with it played through (exists) | Clean check, or 5 plays |
| A change | Mic | Switch drill best tempo (exists); Switch check changes a minute (planned, NO-CATCH step 6) | Target tempo (80), or 30 clean changes a minute |
| Strum timing | Mic | Ladder loops graded with `gradeSwitches` | Clean loop at 100% of song tempo |
| A whole song | Honour system | Song stars from shows (exists) | Gig-ready |
| Keeping at it | Counts | Streak, play days, rungs finished | Used only to time the offer, never to judge skill |

1. **Score each leg and tour.** For a leg: the share of its chords with chord evidence, its changes with change evidence, and its skill shown in a Gig-ready song. A tour is ready at 80% or more, with at least two Gig-ready songs on two different days in the last 30 days using that tour's chords.
2. **Offer, at a good moment.** After Show complete, or as the Road's callout: "You played Harbor Lights at full speed with G, D, Em, C and Am. That covers most of Tour 2. Want to prove it and skip ahead?" Buttons: Prove it, Not now. Never during a show. After Not now, wait 7 days for that tour.
3. **Prove it show, about 3 minutes.** Three parts from the tour you'd skip: a chord check of its hardest chord, a Switch check of its hardest change at the threshold, and your song at full speed (honour system, like any show).
4. **Pass.** Every leg before the target is marked passed, and you land on the target's first stop. A short celebration names the level marker you reached.
5. **Not yet.** Nothing is lost. It names the one thing to work on and opens the leg that teaches it. You can try again the next day.

- **Passed legs** count as done for unlocking and the next leg, and earn their tour guitar. Their merch box fans wait until you play the leg. Drawn with an amber outline and a skip mark, not a check, so you can tell them apart.
- **Still playable.** Every passed stop can be played. Finishing it turns it into done and pays its fans as normal, so skipping never costs fans you could have earned.
- **Undo.** Like Fender Play's Mark as complete, a passed tour can be put back to not started from its tour card.
- **First launch.** Opening night gets an "I've played before" option that runs the Prove it check for Tour 1.
- **Never backwards.** When someone struggles (three rough loops in a row), Louie offers an easier rung or easy shapes. The Road never moves them back.

## 8. Data and code sketch

For Claude. Pure parts go in a new `core/ladder.js` with unit tests; nothing writes `song.body`.

    // core/ladder.js (new, pure, unit tested)
    export const HARD = { Em: 1, Em7: 1, E: 2, Am: 2, D: 2, Asus2: 2, E7: 2, A7: 2, C: 3, G: 3, A: 3, Dm: 3,
      Cadd9: 3, Dsus4: 3, G7: 3, D7: 3, Fmaj7: 3, Bm7: 3, B7: 4, F: 7, Bm: 7, "F#m": 7, Gm: 7, Cm: 7, B: 8 };
    export const EASY = { G: "G:easy", C: "C:easy", F: "Fmaj7", Bm: "Bm7", B: "B7", "F#m": "F#m7" }; // voicings added to chords.js
    const hard = c => HARD[c] ?? (isBarre(c) ? 7 : 5);
    
    // 1. What the song asks for, as it sounds now (transpose, capoOff, easier respected)
    export function songPlan(song, { withRecording = true } = {}) {
      // bars: from chordModel(song.body): one bar per chord, two beats each when a line has more than 4
      // capo: try 0..7 (the capo table in aitools.js); lowest sum(hard(chord) * bars); capo only if withRecording
      // returns { capo, bpm, strum, bars: [{ sec, chord, beats }], share: { G: 0.31, ... }, changes: songChanges(song) }
    }
    
    // 2. The rungs, in order
    export function ladder(plan, known /* Set of chord names the player has */) {
      // first: most bars (EASY shape if hard >= 6); second: most changes with first;
      // then one at a time by new bars / hard(chord), known chords first
      // [{ id: "one", chords: ["G"], strum: "D D D D", rate: 0.7 },
      //  { id: "two", chords: ["G", "D"], rate: 0.7, change: "bar" },
      //  { id: "add:Em", chords: [...], rate: 0.75 }, ...,
      //  { id: "pattern", strum: plan.strum || defaultStrum(plan), rate: 0.8 },
      //  { id: "full", rate: [0.8, 1] }]
    }
    
    // 3. The chart for a rung: your bars get the chord, the rest are rests the band plays
    export const rungBars = (plan, rung) =>
      plan.bars.map(b => ({ ...b, play: rung.chords?.includes(b.chord) ? b.chord : null }));
    
    // 4. Grading a loop: the switch drill's rule
    //    gradeSwitches(dueTimes, strumOnsets, secondsPerBeat).clean
    
    // 5. Readiness (pure; reads skills, journal, gig.ready and mastery)
    export function readiness(data, tourId) {
      // { score: 0..1, chords: { have, need }, changes: { have, need }, songs: [ids], offer: boolean }
    }
    
    // Stored, beside songs, never inside them (docs/DATA.md gets each)
    data.ladder  = { [songId]: { rung: "two", capo: 0, best: { one: { rate: 0.7, at }, two: { rate: 0.7, at } } } };
    data.mastery = {                       // mic-checked results only; the rest is worked out
      chords:  { G: { clean: at, n: 3 } },
      changes: { "C|G": { cpm: 31, bpm: 80, at } },
      strum:   { "D-DU-UDU": { bpm: 96, at } } };
    data.skills.passed = { groove: at, pair: at };   // legs passed with Prove it; undo deletes the key
    
    // Guitar entry: a base painting plus an optional fixed build (stock guitars have no build)
    // { id: "comet-gold-flame", name: "Comet Gold Flame", base: "comet", build: { paint, flame, guard, wear, metal, long } }
    
    // core/neck.js
    // TOURS = [{ id: "t1", name: "First chords", marker: "...", guitar: "open", legs: ["groove", "pair", "open"] }, ...]
    // SKILL_LEVELS keeps every leg and step id; new legs are added with a tour
    // new step kinds: "strum" (t:), "song" (y: a rung of any song), "riff" (r:); "check" stays the headline
    // skillState: a stop in a passed leg is "passed"; roadPath treats passed like done for unlocking and boxes
    // cleanSkills: cap 200 -> 800

## 9. Decided

Graham approved these on 2026-11-19.

| Decision | Pick | Why |
|---|---|---|
| Guitars | One guitar per tour. Legs earn builder parts: paint, guard, hardware, wear and long strings (`art/guitars/builder`, PR #108). | 12 guitars fit the paintings, and every leg still pays something you can see on the guitar. |
| Tour guitars from the shop | Walnut Hall, Ghost Spalt, Redwood Hollow, Velvet Crown and Ziricote Grand are earned on the Road as the guitars of Tours 4, 5, 6, 10 and 11. | They're already painted with fret data, so no new art is needed. |
| Rung 1 | Play only your chord's bars; the band carries the rest. | The song still sounds like itself while you play one chord. |
| Easy shapes | Count for the chord passport with an "easy" mark; the full shape upgrades the stamp. | Early wins count, and there's still a reason to learn the real shape. |
| Thresholds | 30 clean changes a minute (the switch drill's best tempo until change speed exists), 80% of a tour covered, two Gig-ready songs on two different days. All in one tunable config. | Starting numbers, easy to tune on real players without hunting through code. |
| Ladder storage | Stored beside the songs, keyed by song id (`data.ladder`). Songbook data is never edited. Make it easier keeps storing `song.easier` as it does today. | The songbook stays unchanged, and nothing that works today moves. |
| Lesson cap | `cleanSkills` keeps up to 800 finished ids, up from 200. | The full plan has about 400 lessons. |
| Passed legs | Earn their tour guitar: yes. Box fans: no, until you play the leg. | Skipping gets you the guitar you proved you can play, and fans still come from playing. |
| Early rungs | Band only. | A steady beat makes the loops easy to follow and grade. |
| I've played before | Opening night gets an "I've played before" option that runs the Prove it check for Tour 1. | Players who already strum skip the first steps, on proof, not on a claim. |

## 10. Elite finishes

Graham's idea: more guitars without more paintings. An elite finish is a named, fixed premium build of an existing painting, put together from the builder layers (`art/guitars/builder`, PR #108). Each one counts as its own collectible guitar in the case.

| Example | Base painting | Fixed build |
|---|---|---|
| Comet Gold Flame | Comet | Gold hardware, purple flame top, played wear |
| Club Slab Sparkle | Club Slab | Sparkle burst paint, mirror chrome guard, chrome hardware |
| Hollow Hill Midnight | Hollow Hill | Black metallic paint, gold hardware, long strings |
| Porch Road Worn | Porch | Road worn wear, aged nickel tuners, teardrop tortoise guard |

- **How they're earned:** from later tours, from passing a Prove it show, and from replaying a finished tour at higher stars (for example every headline Gig-ready). Never bought with tips, so they stay a mark of playing.
- **One guitar entry:** a guitar is a base painting plus an optional fixed build: `{ id, name, base: 'comet', build: { paint, flame, guard, wear, metal, long } }`. A stock guitar has no build. The case, the Road and the guitarist all draw from the same entry.
- **Not editable:** an elite finish shows as named. Restyling it in the builder makes your own copy; the elite one stays in the case as earned.
- **The count grows:** each painting can carry several elite finishes, so the case passes 23 guitars with no new paintings.
- **Limits today:** only the 7 Road guitars have builder layers. The 16 shop concepts, including the five tour guitars for Tours 4, 5, 6, 10 and 11, need layers cut before they can take builds or elite finishes. Each guitar keeps its PR #108 limits (acoustics take no colour flame tops, and some have no guard).

## 11. Open questions

- Bars are guessed from chord positions. Songs with line times (`timed`) could place changes better; how much does that matter for rung 2?
- A and Am are hard to tell apart on the mic (A heard right 28% on Graham's first booth takes, because of a muted B string). Chord checks on A need the "your B string isn't ringing" message before readiness leans on them.
- Strum timing in loops uses onsets only, not the chord's identity. Good enough for rungs 1 and 2, or should rung 2 also call A or B?
- Should a Prove it pass jump one tour at a time, or straight to the furthest tour the score supports?
- Tab songs and fingerstyle songs: a separate riff ladder later, or leave them out of the ladder?
- Merch boxes in passed legs: shut until played, or shown open with no fans? (Box fans wait until the leg is played either way.)

## 12. Rollout

| Phase | What ships | Depends on |
|---|---|---|
| 1 | Foundations: the tours and legs data model keeping every current id (no new legs shown yet; a guitar entry is a base painting plus an optional fixed build), the 800-id cap, the Song ladder generator with rungs 1 and 2 and stored progress, the readiness signals and the Prove it offer behind a flag (off by default). | Nothing new |
| 2 | The rest of the ladder (add a chord, strum rung, full song, real shapes) and tours on the Road: banner, level markers, Tour 1's two new legs, the passed rule, Your song stops. | Phase 1 |
| 3 | Readiness and Prove it switched on, starting with Tours 1 to 3; "I've played before" in Opening night. | Switch check (NO-CATCH step 6); until then the switch drill's best tempo |
| 4 | Tour 3, Strumming, fills the `strum` placeholder; Tour 2's two new legs. | Phase 2 |
| 5 | Tours 4 to 6, on Walnut Hall, Ghost Spalt and Redwood Hollow. | Phase 4; builder layers cut for those three guitars, so their legs can pay builder parts |
| 6 | Tours 7 to 9, filling `pick` and `finger`; a riff ladder for tab songs if wanted. | Note-by-note listening (exists for scales) |
| 7 | Tours 10 to 12. | Earlier tours |
| Later | Elite finishes: named fixed builds as collectible guitars, earned from later tours, Prove it and higher-star replays. Builder layers for the 16 shop concepts. | The builder (step 9b); Phase 1's guitar entry already allows a fixed build |

## 13. Sources

- Simply Guitar Help Center, Choose your course path: https://guitar-help.hellosimply.com/en/articles/5834463-choose-your-course-path
- Guitar.com, Simply Guitar review: simple isn't always better: https://guitar.com/reviews/accessories/simply-guitar-review/
- Guitar World, Simply Guitar vs Yousician (2022): https://www.guitarworld.com/features/simply-guitar-vs-yousician
- LowEndBox, How I became Jimi Hendrix in two months: https://lowendbox.com/blog/how-i-became-jimi-hendrix-in-two-months-the-simply-guitar-app/
- Apps UK, Simply Guitar app review: https://apps.uk/simply-guitar-app-review/
- Yousician Support, How the guitar learning path works: https://support.yousician.com/hc/en-us/articles/206930639-How-the-guitar-learning-path-works
- Yousician Support, Song screen (GuitarTuna): https://support.yousician.com/hc/en-us/articles/4419297148817-Song-screen
- Yousician Support, The best way to practice guitar: https://support.yousician.com/hc/en-us/articles/206912609-The-best-way-to-practice-guitar
- Fender Play, How can I mark a course or lesson as complete?: https://play-support.fender.com/hc/en-us/articles/44538918650907-How-can-I-mark-a-course-or-lesson-as-complete
- Fender Play, What do the three picks mean?: https://play-support.fender.com/hc/en-us/articles/44538517184795-What-do-the-three-picks-mean
- JustinGuitar, One Minute Changes (BC-115): https://www.youtube.com/watch?v=qXK_If0QzDM
