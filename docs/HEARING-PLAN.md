# Hearing the chord (audit and plan)

Written by Opus, 2026-10-29, after the hearing conversation (4.76.0 to 4.82.1). An audit of how the Gig catches
a chord, then a plan. Nothing here is built yet; one release when Graham says ship, unless he splits it.

## Decisions Graham needs to make

1. **Record the evaluation set** (step 1). Four or five full plays with the click on, one Voice Memo each:
   Zombie, Lillian, one song with a capo, one slow arpeggio or single-strum-per-bar song. Nothing below can be
   measured without it.
2. **Whose clock is the Gig on?** Today the page is the clock and the player follows it, with Wait for me and
   Follow my tempo as patches. The other way round is score following: strum onsets give the beat, caught chords
   give the position, the page follows the player. Options: keep the page as the clock; switch to following;
   or both as two modes (a show in band time, a rehearsal in the player's time). Step 5 waits on this.

## The outcome, as claims a test can check

A catch is right when all of these hold:

1. **Credited when played.** A chord strummed the way a learner strums it (soft up-strums, not every string,
   ringing into the next chord) is credited.
2. **Not credited when not played.** A ringing chord, a repeat strum or a lookalike chord never earns a
   different chord. The game stays honest.
3. **In order.** Playing ahead is fine; a chord skipped is a miss.
4. **Promptly.** Credit lands within about 300 ms of the strum.
5. **Where the song is.** The page and the player stay together whichever one drifts.
6. **Across guitars, rooms, tuning, capo and phone placement.**
7. **Explainable.** A miss can be traced on What I hear.

The Gig scores whether a chord was played, not when (4.54.0). That stays: timing matters for catching (claim 4),
not for the score.

## What the pipeline does today, and what each decision was tuned on

| Stage | Decision | Tuned on |
|---|---|---|
| Front end (`gig.js`, `chromaOf`) | Two 1.5 kHz low-passes, 16384-point FFT every 50 ms, folded to 12 note names, energy-weighted | Synthetic sines, 12 memos |
| Chord fit (`strumFit`, `CHORD_FIT`) | Share of energy in the chord's notes, 0.55 or more | Synthetic sines |
| Tell-apart (`chordLead`, `CHORD_EXTRA`) | Lead on the notes that differ between two chords; the bigger chord's extra note must carry 0.12 | 12 memos (4.82.1) |
| Strum (`gig.js`, `STRUM_RISE`) | Level jumps 1.4x over the last 80 ms, 120 ms apart | Graham's readings |
| One strum, one catch (`CATCH_AFTER`) | A catch only within 0.8 s of a strum that hasn't caught one | Zombie report (4.80.1) |
| Confidence (`need`, `strong`, `CATCH_CLEAR`) | Two reads in a row, or one read with fit 0.75 and lead 0.2 | Zombie report |
| Order (`catchOpen`, `CATCH_AHEAD`) | The next uncaught chord and the one after, up to 4 past the reading line | Graham (4.79.0) |
| Position (`holdFrame`, `keepPace`) | The page's scroll is the clock; 0.7 s grace before a hold; catch-up when 2 ahead; tempo from caught pairs | Graham's reports (4.78.1 to 4.80.1) |

Eight gates, each added for one report, each with a hand-set number, every number set against 12 single-chord
memos and synthetic sines. No full play has ever been measured. Every fix so far was a guess confirmed by Graham
playing Zombie.

## Findings, ranked

1. **No evaluation set.** Nothing in the repo can say "this change caught 5% more chords." Until it exists every
   change is judged by feel.
2. **The capo is ignored.** The show listens for the shape names on the page (`data-ch`). With Make it easier's
   capo, or a chart's own capo with the player using one, the sound is shifted up and no chord can be caught.
   Latent defect, unfixed as of 4.82.1.
3. **Harmonics are treated as wrong notes.** The leaks measured on the memos sit where harmonics land: G# on
   the Am memo is the 5th harmonic of the E string, B on the C memo the 3rd harmonic of E, D on the C memo the
   3rd harmonic of G. `CHORD_EXTRA` is partly compensating for physics the front end doesn't model. A chord whose
   extra note sits on another chord's harmonic is wrong in one direction or the other.
4. **Bass dominates.** Energy weighting lets the low strings decide the fit: a thumb strum lit 2 of 5 strings;
   the low E ringing changed everything.
5. **The gates stack and interact.** The 0.8 s fresh-strum window, the two-read rule and the 0.7 s grace were set
   independently. A slow arpeggio or a single strum held for a bar can fail the fresh-strum gate while being
   played perfectly.
6. **Tempo from chord pairs is a thin signal.** Strum onsets give a beat every half second; chord pairs give one
   every two to four beats, and only when both were caught.
7. **The app already has a polyphonic note transcriber** (Basic Pitch in `strum.js`, used by Strum it on
   recordings) and the show doesn't use it. Its live cost on a phone is unmeasured.

## The option space, outcome first

Hearing the chord (claims 1, 2, 6):
- **A. Harmonic-aware templates.** Each chord's expected pattern includes its strings' harmonics; match by
  similarity rather than note share. Cheap; addresses findings 3 and most of 4; keeps the rest of the pipeline.
- **B. Whitened or log-compressed spectrum**, so each string counts about equally. Addresses 4. Cheap.
- **C. Onset-synchronous analysis**: judge only the 100 to 400 ms after a strum against the sound just before it.
  A crude version did worse in the scratch sims; one proper try, not a bet.
- **D. Basic Pitch live** on a rolling window. Highest ceiling; unknown latency and battery. Measure first.
- **E. Tuning offset from the tuner** feeding the note bins. Small and cheap; the tuner already knows it.
- **F. Listen in the sounding key**: shift the expected notes by the capo. A bug fix (finding 2).

Deciding (claims 2, 3, 4):
- **G. One evidence score instead of the gate stack**: evidence for each open chord accumulated over the window
  after a strum, with the song order as the prior. Ringing, repeat strums and lookalikes fall out of the same
  arithmetic instead of three special cases. About three numbers in place of eight.
- **H. Keep the gates, prune to two** (strum trigger, evidence). Cheaper, less honest.

Timing and position (claim 5):
- **I. The page is the clock** (today).
- **J. The player is the clock**: score following. Wait for me and Follow my tempo become one mechanism.
- **K. Both, as two modes.** Decision 2.

Strumming:
- **L. Onsets from spectral change** rather than level alone, so a soft up-strum over a loud ring registers.
  Pairs with C and J.
- **M. Use the song's strum pattern** (the app stores D-DU-UDU) to expect onsets per bar, sharpening beat and
  position.

## Steps

Not a rewrite. In order; each step measured against the evaluation set before the next.

- [ ] 1 [Graham, then Sonnet] **Evaluation set.** Graham records the plays (decision 1) with the click on; the
      memos go in `tests/audio/songs/` named after the song, with a sidecar listing the chord sequence and the
      BPM (the click is the ground truth for time). A test replays each through the real path (`chromaOf`,
      `catchHear` with the show's options, the strum counter) and prints caught, missed, wrong and latency per
      song, and fails if any number gets worse than the recorded baseline. Baseline recorded on 4.82.1.
- [ ] 2 [Sonnet] **Capo** (F): the show listens for the sounding chord. With Make it easier's capo or a chart's
      capo in use, shift each target's expected notes up by the capo. Test with a capo play from step 1.
- [ ] 3 [Sonnet] **Tuning offset** (E): the tuner's last A4 or cents offset feeds the note bins in `chromaOf`.
- [ ] 4 [Opus] **Harmonic-aware templates and whitening** (A, B): build each chord's expected 12-note pattern
      from its shape's strings and their first few harmonics; whiten the spectrum so strings count alike; match
      by similarity. Keep `strumFit` and `chordLead` as the fallback until the eval shows the new match ahead on
      every song. Decide whether `CHORD_EXTRA` is still needed.
- [ ] 5 [Opus] **One evidence score** (G) and **onsets from spectral change** (L): replace `CHORD_FIT`,
      `CHORD_CLEAR`, `CATCH_AFTER`, `need`/`strong` with evidence accumulated after each onset and the song order
      as the prior. Keep `CATCH_AHEAD`. What I hear reports the same evidence. The judgment-heavy step.
- [ ] 6 [Opus, after decision 2] **Position** (J or K): if the page is to follow the player, build score
      following on step 5 (strum onsets for the beat, catches for the position) and fold Wait for me and Follow
      my tempo into it; if two modes, add the mode switch in Tools. If the page stays the clock, close this step.
- [ ] 7 [Sonnet] **Basic Pitch live** (D): measure latency and battery on a rolling 1 s window on Graham's phone.
      Only if the eval still shows a gap after step 5, and only if the measurement allows it.
- [ ] 8 Patch or minor release per Graham; `eslint .`, quick tests, rebase, push only after he says ship. README
      and docs/ONBOARDING.md updated where behaviour changes.

## Open (not this plan)

- The Em C G D song missing G mostly after C (2026-10-29 screen) has no explanation yet. Step 1's Zombie
  recording should show it; if not, a What I hear reading with G picked, strumming C to G.
- Scoring timing (when, not only whether) stays out unless Graham asks.

## Surprises

(Write here when something doesn't match the plan.)
