'use strict';
// Local .env loader (git-ignored; GitHub Actions uses Secrets instead).
try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8')
    .split('\n').forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
} catch {}
// DAILY job: refresh fixtures + team-strength tables via the active
// provider (API-Football when a key exists, else free openfootball).
// Writes data/cache.json (committed).
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const ofree = require('./src/providers/openfootball');
const otxt = require('./src/providers/opentxt');
const espn = require('./src/providers/espn');
const apif = require('./src/providers/apifootball');

async function main() {
  const cachePath = path.join(__dirname, 'data', 'cache.json');
  let old = { fixtures: [], tables: {} };
  try { old = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
  let data;
  if (config.apiKey) {
    console.log('source: api-football (key present, all 10 leagues)');
    data = await apif.load(apif.todayPlus(0), apif.todayPlus(2));
  } else {
    console.log('source: openfootball (7) + opentxt Belgian + espn Turkish/Saudi');
    const [of, tx, es] = [await ofree.load(), await otxt.load(), await espn.load()];
    data = {
      fixtures: [...of.fixtures, ...tx.fixtures, ...es.fixtures].sort((a, b) => new Date(a.date) - new Date(b.date)),
      tables: { ...of.tables, ...tx.tables, ...es.tables },
      history: { ...of.history, ...tx.history, ...es.history },
    };
  }
  // Merge per league: refreshed leagues replace old data; skipped leagues
  // keep yesterday's fixtures (future ones only) and tables. A hiccup in
  // one provider never blanks another league's matches.
  const now = Date.now();
  const refreshed = new Set(Object.keys(data.tables));
  const keptFixtures = (old.fixtures || []).filter(
    (f) => !refreshed.has(f.league) && new Date(f.date).getTime() > now
  );
  const keptTables = {};
  const keptHistory = {};
  for (const [lg, tb] of Object.entries(old.tables || {})) {
    if (!refreshed.has(lg)) keptTables[lg] = tb;
  }
  for (const [lg, h] of Object.entries(old.history || {})) {
    if (!refreshed.has(lg)) keptHistory[lg] = h;
  }
  const keptLeagues = [...new Set([...keptFixtures.map((f) => f.league), ...Object.keys(keptTables)])];
  if (keptLeagues.length) console.log('kept previous data for: ' + keptLeagues.join(', '));
  const cache = {
    fetchedAt: new Date().toISOString(),
    season: config.season,
    fixtures: [...keptFixtures, ...data.fixtures].sort((a, b) => new Date(a.date) - new Date(b.date)),
    tables: { ...keptTables, ...data.tables },
    history: { ...(data.history || {}), ...keptHistory },
  };
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'data', 'cache.json'), JSON.stringify(cache));
  console.log(`cached ${data.fixtures.length} fixtures across ${Object.keys(data.tables).length} leagues`);
}

main().catch((e) => { console.error('FETCH FAILED:', e.message); process.exit(1); });
