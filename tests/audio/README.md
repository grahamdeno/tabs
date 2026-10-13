# Real guitar recordings for the tuner tests

Put WAV files here (16-bit PCM, mono or stereo, any sample rate). Name each after
the string's note, optionally followed by an underscore and anything else:
`E2.wav`, `D2_drop-d.wav`, `B3_slightly-flat.wav`.

`node --test` then checks that the pitch detector names the right note in every
part of the recording after the pick attack, with no octave mistakes, and that
its reading stays steady (within 4 cents) while the string rings.

To record on iPhone: Voice Memos, one string per memo, pluck and let it ring for
about 3 seconds. Send the memos; they're converted to WAV here.
