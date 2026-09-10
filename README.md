# Telegram Predictions Poster ⚽

Posts **before every match** of the **top 10 leagues**, every day, in
**Arabic + English**, to your Telegram group. Runs itself on GitHub —
your PC can stay off. No dependencies, no server, free forever.

Leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie,
Primeira Liga, Süper Lig. (Champions/Europa League unlock if you later add a
free api-football.com key — the code switches automatically.)

## How it works

1. **Daily 06:00 UTC** — `fetch-fixtures.js` caches fixtures + team strength
   from the free openfootball dataset — **no signup, no api key**
   (`data/cache.json`).
2. **Every hour** — `post-due.js` finds cached matches kicking off in
   45–240 minutes, computes Poisson probabilities from real results,
   posts once per match, and records it in `data/posted.json` (never double-posts).
3. Caps: max 15 posts/day, skips anything under 55 confidence.

## Setup (you do this once, ~10 minutes)

1. **Bot token**: Telegram → `@BotFather` → `/newbot` → copy the token.
2. **Group**: add the bot to your group as **admin**. Add `@userinfobot`
   to the group too — it replies with the group ID (looks like `-100...`).
3. **Data key: NOTHING NEEDED** - the bot uses a free public dataset
   automatically. (Optional later: free api-football.com key for UCL/UEL.)
4. **Repo**: create an empty PRIVATE GitHub repo, upload these files
   (or push this folder).
5. **Secrets** (repo → Settings → Secrets and variables → Actions → New secret,
   only 2 needed):
   - `TELEGRAM_BOT_TOKEN` = token from step 1
   - `TELEGRAM_CHAT_ID` = group ID from step 2
6. **Actions** tab → enable workflows → press **Run workflow** once to test.
   Check your group: predictions for matches starting in 1–3 hours appear.

## Local test (no secrets needed)

```bash
node test-dry.js
```

## Tune behaviour

Edit the `env:` block in `.github/workflows/predictions.yml`:
`LEAD_MINUTES_MIN/MAX` (how early before kickoff), `MAX_POSTS_PER_DAY`,
`MIN_CONFIDENCE`. Seasons: change `SEASON` each August.

## Safety

- Probabilities only, never "guaranteed" — every post carries a disclaimer.
- Secrets live in GitHub Secrets, never in code. `.env` is git-ignored.
