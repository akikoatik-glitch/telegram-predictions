'use strict';
// Central configuration. Everything tunable via environment variables.
function num(name, def) {
  const v = parseFloat(process.env[name]);
  return Number.isFinite(v) ? v : def;
}
function str(name, def) {
  const v = (process.env[name] || '').trim();
  return v || def;
}

// Top 10 leagues (API-Football IDs). Covers the matches people care about.
const LEAGUES = [
  { id: 39, name: 'Premier League' },
  { id: 140, name: 'La Liga' },
  { id: 135, name: 'Serie A' },
  { id: 78, name: 'Bundesliga' },
  { id: 61, name: 'Ligue 1' },
  { id: 88, name: 'Eredivisie' },
  { id: 94, name: 'Primeira Liga' },
  { id: 203, name: 'Super Lig' },
  { id: 2, name: 'Champions League' },
  { id: 3, name: 'Europa League' },
];

module.exports = {
  LEAGUES,
  telegramToken: str('TELEGRAM_BOT_TOKEN', ''),
  chatId: str('TELEGRAM_CHAT_ID', ''),
  apiKey: str('API_FOOTBALL_KEY', ''),
  apiBase: 'https://v3.football.api-sports.io',
  season: num('SEASON', 2025),
  leadMin: num('LEAD_MINUTES_MIN', 60),   // post matches kicking off in...
  leadMax: num('LEAD_MINUTES_MAX', 180),  // ...this many minutes from now
  maxPostsPerDay: num('MAX_POSTS_PER_DAY', 15),
  minConfidence: num('MIN_CONFIDENCE', 55),
  dryRun: /^true$/i.test(str('DRY_RUN', 'false')),
};
