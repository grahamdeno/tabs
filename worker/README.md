# Tabs MusicKit token

A Cloudflare Worker that does what the app can't do on its own: it signs the MusicKit developer token that Apple Music in The Road needs. Signing takes the MusicKit private key, and that key must never be in the app or in this repo, so it lives only in this Worker as a secret. It's free on Cloudflare's plan at this size, has no accounts, keeps no data, and only answers the app's address.

Nothing is deployed from this repo automatically. These are the steps.

## Deploy with Wrangler (about five minutes)

Needs Node 20 and a free Cloudflare account. The key file is `AuthKey_KABHU54QBS.p8`; keep it outside any git folder.

```
cd worker
npx wrangler login
npx wrangler secret put MUSICKIT_KEY < /path/outside/git/AuthKey_KABHU54QBS.p8
npx wrangler deploy
```

`secret put` reads the key from the file, so it never shows on screen or in your shell history. (The first `secret put` may offer to create the Worker; say yes.)

Wrangler prints the Worker's address, for example `https://tabs-musickit.yourname.workers.dev`. The token address is that plus `/token`.

Then in The Road, open Settings, Keys, turn on **Apple Music**, paste `https://tabs-musickit.yourname.workers.dev/token` into **Token address**, and select **Save**.

## Deploy from the dashboard (no tools)

1. dash.cloudflare.com, **Workers & Pages**, **Create**, **Create Worker**, name it `tabs-musickit`, **Deploy**.
2. **Edit code**, replace everything with `musickit-token.js`, **Deploy**.
3. The Worker's **Settings**, **Variables and Secrets**: add a secret `MUSICKIT_KEY` and paste the whole `.p8` file (including the BEGIN and END lines). Add plain variables `TEAM_ID` = `7MHDTK68M2` and `KEY_ID` = `KABHU54QBS` (these are also the defaults in the code).
4. Paste the Worker's address plus `/token` into The Road, Settings, Keys, Token address.

## Notes

- **The private key is secret.** Keep it in the Worker secret and in its file outside git, never in this repo.
- **What the token is:** an ES256 JWT with `iss` = Team ID, `kid` = Key ID, valid for 30 days (`DAYS`), and an `origin` claim of `https://grahamdeno.github.io`, so Apple accepts it only from the app's address. The Worker signs a new one when less than a day is left.
- **Allowed app address:** `ALLOWED_ORIGINS` in `musickit-token.js` (and `http://localhost` for testing). If The Road moves (a custom domain), change it, and add the Worker's address to `connect-src` in `index.html` if it isn't on `workers.dev`.
- **Updating:** after this file changes, run `npx wrangler deploy` again (or paste it into Edit code). The address stays the same.
- **Data kept:** none.
- **Tests:** `node --test tests/worker.test.mjs` signs with a throwaway key made by the test.
