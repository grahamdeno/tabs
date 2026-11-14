# Play along on YouTube (plan)

Written by Opus, 2026-11-14, on 4.95.0. Graham: someone without Apple Music should still be able to play along
with the real recording, with nothing to sign in to. Nothing below is built yet.

## What it gives, and what it doesn't

YouTube plays a song's recording for free, with ads and no sign-in, and its player reports where the song is.
That covers **playing along**: Play starts the recording, and the page follows it line by line and chord by chord,
as it does with Apple Music. It also covers practice speed (YouTube plays from 0.25x to 2x).

It doesn't cover:
- **Measuring the recording.** Tempo, swing and key come from Apple's 30-second previews, which work without a
  subscription and stay as they are. A web page can't read YouTube's sound.
- **Recently played and cover requests.** Those come from Apple Music listening history.
- **A hidden player.** YouTube's rules: the player is visible, at least 200 by 200 px, with nothing covering it or
  its controls, and it never plays in the background. Breaking them gets the app's access cut off, and is a likely
  App Store rejection too.

## Decisions Graham needs to make

1. **Where the player sits.** It must be visible and at least 200 px square while the recording plays. Options:
   - (a) **Recommended:** a 200 px card in the top right of the song page while the recording plays (where the cover
     is now, grown), above the words; it goes back to the cover when paused. In a Gig, the same card sits under the
     crowd and the words start below it.
   - (b) A strip across the top, the full width, 16:9 (about 220 px tall on a phone).
   - (c) The recording plays only on the song page, never in a Gig (the Gig stays words first, with the band).
   Mockups of (a) and (b) on the song page and in a Gig first (CLAUDE.md: mockups, then a go).
2. **Which comes first when both are there.** Recommended: Apple Music when it's turned on in Settings, otherwise
   YouTube. One new Settings row: Play along with: Apple Music, YouTube, or Off (the band only).
3. **Finding a song's video.** Recommended: the booth's kind of server (a Cloudflare Worker, `worker/youtube.js`)
   holds a YouTube Data API key as a secret and does the search, so no key is in the app (CLAUDE.md: no keys in code).
   It caches each song's answer, since a search costs 100 of the 10,000 daily quota units (about 100 searches a day
   across everyone without caching). It prefers the artist's official audio ("Artist - Topic" channels: the album
   recording with no video intro, timed like the synced lyrics). Fallback in the song page: paste a YouTube link.
4. **Ads.** A free video can open with an ad. Recommended: the count-in waits until the player reports the song
   itself is playing, and says "After the ad" on the count-in card meanwhile.

## How it fits the app

`listen.js` already talks to Apple Music through six functions the song page uses: `prepareMusic`, `startMusic`
(where to start, speed), `musicClock` (where the recording is now), `seekMusic`, `pauseMusic`, `setMusicRate`, plus
`musicLead` (how long the recording takes to start sounding) and `hasMusic` (is there a recording to play). A new
`youtube.js` gives the same seven, built on the YouTube IFrame Player API, and `listen.js` hands each call to Apple
Music or YouTube by the Settings choice. The song page, the Gig, the count-in, Practice mode and the line-by-line
follow don't change.

What's saved: `song.listen.yt` `{ id, start?, checked }` (the video, and a start offset in seconds when the video's
recording starts later than the album's). `docs/DATA.md` gets it.

Page rules: `index.html`'s content policy adds `https://www.youtube.com` to `script-src` (the IFrame API) and
`https://www.youtube-nocookie.com` to a new `frame-src` (the player, privacy-enhanced mode); the server's address is
already allowed (`*.workers.dev`). `sw.js` `SHELL` gets `youtube.js`.

Lining up: when the video's length is within 2 seconds of Apple's length for the track (`song.listen.length`), no
offset. Otherwise the song page shows "Line it up": play, tap when the singing starts, and the offset is saved. A
"Topic" video almost never needs it.

## Steps

Each step: one task per commit, `eslint .` and `node tests/quick.mjs`. Ships as one release (4.96.0) after step 6,
unless Graham says otherwise.

- [ ] 1 [Opus] **Mockups** of decision 1's options on the song page and in a Gig, light and dark, at phone size.
      Graham picks; stop for a go.
- [ ] 2 [Sonnet] **The search server**, `worker/youtube.js` with `worker/youtube.toml`: `GET /find?artist=&title=`
      from the app's address only; YouTube Data API `search.list` (`type=video`, `videoCategoryId=10`, music) then
      `videos.list` for lengths; picks a "- Topic" upload first, then official artist channels, then the closest
      length to `len` when given; caches each answer for 30 days in the Cache API. Secret `YOUTUBE_KEY`. Tests in
      `tests/worker.test.mjs` with `fetch` mocked. Deploy steps in `worker/README.md`.
- [ ] 3 [Sonnet] **`youtube.js`**: loads the IFrame API on first use, the player in decision 1's card
      (`youtube-nocookie.com`, `playsinline`, no autoplay before a tap), and the seven functions. The clock is
      `getCurrentTime()` minus `start`; "playing" is the player's PLAYING state, so an ad doesn't count.
- [ ] 4 [Sonnet] **`listen.js` hands off** to Apple Music or YouTube by the Settings row (decision 2). Settings:
      Play along with. Song page: the video found (title and channel), Change (another result, or paste a link),
      and Line it up when needed.
- [ ] 5 [Sonnet] **The count-in waits for the song**, not an ad (decision 4); the Gig's card placement.
- [ ] 6 [Opus] **Check it**: browser tests with the IFrame API mocked (`page.route` serving a stub player that
      reports time); a real song played on Graham's phone; the content policy; YouTube's rules checked against the
      screens (size, nothing over the player, no background play: pausing when the app goes away already happens).
      README, `docs/DATA.md`, `docs/ONBOARDING.md` (the Settings row and Line it up), then ship.
- [ ] 7 [Graham, Grok] **Deploy the search server**: a Google Cloud project with the YouTube Data API v3 on, an API
      key, the Worker `tabs-youtube` with secret `YOUTUBE_KEY`. A Grok prompt comes with step 2.

## Size

About seven commits over two sessions, plus Graham's mockup pick and Grok's deploy. The biggest piece is
`youtube.js` (step 3). Nothing changes for anyone with Apple Music turned on.

## Surprises

(Write here when something doesn't match the plan.)
