# Telegram Predictions Poster v2 ⚽ — professional automated service

Posts **before every match** (~8–20 min before kickoff, target 15), top 10
leagues, **Arabic + English**, grades every result (✅ WIN / ❌ MISS),
tracks accuracy weekly. Runs itself on GitHub — PC can stay off.

## Architecture (provider-swappable)

```
openfootball (free, no key) ─┐
                             ├─► data/cache.json ─► Poisson model ─► best pick ─► Telegram
API-Football (free key) ─────┘        ▲                  ▲                ▲
   └─ exact UTC, standings      team strength      confidence bands   AR+EN cards
```

- `src/providers/openfootball.js` / `apifootball.js` — same interface.
  API activates automatically when `API_FOOTBALL_KEY` exists.
- `src/tz.js` — stadium-local times → true UTC (EU DST handled).
- `src/model.js` — Poisson xG → 1X2, DC, O1.5/O2.5, U3.5, BTTS, top scores.
- `src/pick.js` — every eligible market competes; winner is pure math.
- `src/db.js` — `predictions.json` (full record per match) + `stats.json`.
- Runners: `fetch-fixtures.js` (daily) · `post-due.js` (every 10 min) ·
  `check-results.js` (hourly grading + Monday weekly summary) · `stats.js`.

## League table (config/src/config.js — data, not code)

| League | Free source, no key |
|---|---|
| Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga | openfootball schedules + results |
| Belgian Pro League | belgium be1.txt schedule + results |
| Turkish Süper Lig, Saudi Pro League | ESPN scoreboards (exact UTC, polite volume) |

All 10 first divisions work with zero keys. An optional free
api-football.com key switches everything to exact-UTC standings-based data
and unlocks UCL/UEL — the code detects it automatically. Matches without a
published kickoff time are counted and skipped, never guessed.

## Setup

1. `@BotFather` → token. Bot → group/channel **admin**. Group ID via `@userinfobot`.
2. Push this folder to a GitHub repo. **Make the repo PUBLIC**
   (Settings → Danger Zone): the 10-minute schedule needs ~3,900 free
   Actions minutes/month — unlimited on public repos, capped at 2,000 on
   private ones. Code contains zero secrets, so public is safe.
3. Secrets (2): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
4. Optional: `API_FOOTBALL_KEY` (free, unlocks all 10 leagues).
5. Actions → enable → Run workflow → mode `post` to test.

## Admin without a server (no /commands needed on free tier)

- **Pause**: repo → Settings → Variables → new variable `PAUSED=true`
  (delete it to resume). Also `LANG`, timing, `MIN_CONFIDENCE`,
  `MAX_POSTS_PER_DAY` via workflow `env:`.
- **Manual runs**: Actions → Run workflow → mode `post|fetch|results`.
- **Stats**: `npm run stats` locally, `STATS.md` in repo, weekly summary
  auto-posted to the channel every Monday.

## Honesty rules enforced in code

- Below `MIN_CONFIDENCE` (default 60) → match SKIPPED, never published.
- No invented injuries/odds/xG/corners — absent data is omitted.
- Never "100%" or "guaranteed" — every post carries a disclaimer.
- Results graded from real scores; misses posted publicly.
