# Real guitar recordings for the tuner tests

Put WAV files here (16-bit PCM, mono or stereo, any sample rate). Name each after
the string's note, optionally followed by an underscore and anything else:
`E2.wav`, `D2_drop-d.wav`, `B3_slightly-flat.wav`.

`node --test` then checks that the pitch detector names the right note in every
part of the recording after the pick attack, with no octave mistakes, and that
its reading stays steady (within 4 cents) while the string rings.

To record on iPhone: Voice Memos, one string per memo, pluck and let it ring for
about 3 seconds. Send the memos; they're converted to WAV here.

## Chords and riffs for Strum it (`chords/`)

WAV files in `tests/audio/chords/`, named after what's played, optionally followed
by an underscore and a note: `G.wav`, `Am_phone-on-stand.wav`, `F_barre.wav`.
Each must be heard as exactly that chord. A riff is named with its MIDI notes:
`riff_55-59-62-64.wav` (G3 B3 D4 E4) must give those notes in order.

To record on iPhone: Voice Memos, one chord per memo, strum it four times at an
easy pace and let it ring; the phone where it would sit while you play.
