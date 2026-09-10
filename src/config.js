'use strict';
// ALL tunables live here (env overrides). Leagues are data, not code:
// add / remove / disable entries freely. `file` = openfootball code
// (no key needed), `apiId` = API-Football id (needs free key).
function num(name, def) {
  const v = parseFloat(process.env[name]);
  return Number.isFinite(v) ? v : def;
}
function str(name, def) {
  const v = (process.env[name] || '').trim();
  return v || def;
}

const LEAGUES = [
  { key: 'pl',  name: 'Premier League',    file: 'en.1', apiId: 39,  tz: 'Europe/London', enabled: true },
  { key: 'ch',  name: 'Championship',      file: 'en.2', apiId: 40,  tz: 'Europe/London', enabled: true },
  { key: 'lal', name: 'La Liga',           file: 'es.1', apiId: 140, tz: 'CET',           enabled: true },
  { key: 'sa',  name: 'Serie A',           file: 'it.1', apiId: 135, tz: 'CET',           enabled: true },
  { key: 'bl',  name: 'Bundesliga',        file: 'de.1', apiId: 78,  tz: 'CET',           enabled: true },
  { key: 'l1',  name: 'Ligue 1',           file: 'fr.1', apiId: 61,  tz: 'CET',           enabled: true },
  { key: 'ered',name: 'Eredivisie',        file: 'nl.1', apiId: 88,  tz: 'CET',           enabled: true },
  { key: 'pliga',name:'Primeira Liga',     file: 'pt.1', apiId: 94,  tz: 'WET',           enabled: true },
  { key: 'bel', name: 'Belgian Pro League',file: null,   apiId: 144, tz: 'CET', espn: null, txt: { repo: 'openfootball/belgium', file: 'be1.txt' }, enabled: true },
  { key: 'tur', name: 'Turkish Super Lig', file: null,   apiId: 203, tz: 'TRT', espn: 'tur.1', enabled: true },
  { key: 'sau', name: 'Saudi Pro League',  file: null,   apiId: 307, tz: 'AST', espn: 'ksa.1', enabled: true },
  { key: 'mls', name: 'MLS',               file: null,   apiId: null, tz: 'US-Eastern', espn: 'usa.1', enabled: true },
  { key: 'mx',  name: 'Liga MX',           file: null,   apiId: null, tz: 'US-Central', espn: 'mex.1', enabled: true },
  { key: 'bra', name: 'Brasileirao',       file: null,   apiId: null, tz: 'Brazil', espn: 'bra.1', enabled: true },
  { key: 'arg', name: 'Liga Profesional',  file: null,   apiId: null, tz: 'Argentina', espn: 'arg.1', enabled: true },
  { key: 'gre', name: 'Super League Greece', file: null, apiId: null, tz: 'CET', espn: 'gre.1', enabled: true },
];

// Posting window derived from one knob: PREDICTION_MINUTES_BEFORE_KICKOFF.
// Window = [max(2, N-7), N+5]; with the 10-minute checker this tiles every
// match exactly once (window length 12 >= 10-minute interval).
const target = num('PREDICTION_MINUTES_BEFORE_KICKOFF', 15);
const spread = num('WINDOW_SPREAD', 7);

module.exports = {
  LEAGUES: LEAGUES.filter((l) => l.enabled),
  ALL_LEAGUES: LEAGUES,
  telegramToken: str('TELEGRAM_BOT_TOKEN', ''),
  chatId: str('TELEGRAM_CHAT_ID', ''),
  apiKey: str('API_FOOTBALL_KEY', ''),
  apiBase: 'https://v3.football.api-sports.io',
  ofBase: 'https://raw.githubusercontent.com/openfootball/football.json/master/',
  season: str('SEASON', '2026-27'),
  lang: str('LANG', 'both'), // both | ar | en
  displayTz: str('DISPLAY_TZ', 'Africa/Algiers'), // kickoff shown in this zone
  leadMin: num('LEAD_MINUTES_MIN', Math.max(2, target - spread)),
  leadMax: num('LEAD_MINUTES_MAX', target + 5),
  targetKickoffLead: target,
  minConfidence: num('MIN_CONFIDENCE', 60), // below this: SKIP, never publish
  maxPostsPerDay: num('MAX_POSTS_PER_DAY', 15),
  dryRun: /^true$/i.test(str('DRY_RUN', 'false')),
  paused: /^true$/i.test(str('PAUSED', 'false')),
  modelVersion: 'poisson-v2',
  // Confidence bands -> human labels (spec section 4).
  bands: [
    { min: 90, en: 'Extremely High', ar: 'مرتفع جداً جداً' },
    { min: 80, en: 'Very High', ar: 'مرتفع جداً' },
    { min: 70, en: 'High', ar: 'مرتفع' },
    { min: 60, en: 'Medium', ar: 'متوسط' },
  ],
};
