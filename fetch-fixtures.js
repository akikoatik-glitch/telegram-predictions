'use strict';
// Local .env loader (ignored by git; GitHub Actions uses Secrets instead).
try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8')
    .split('\n').forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
} catch {}
// DAILY job: cache fixtures (next 2 days window is implicit — openfootball
// ships full seasons; API path fetches a 3-day window) + team strength tables.
// Source is automatic: API-Football when a key exists, otherwise the free
// no-signup openfootball dataset. Writes data/cache.json.
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const api = require('./src/api');
const ofree = require('./src/openfootball');

async function viaApiFootball() {
  const from = api.todayPlus(0);
  const to = api.todayPlus(2);
  const fixtures = [];
  const tables = {};
  for (const lg of config.LEAGUES) {
    try {
      const fx = await api.fixtures(lg.id, from, to);
      for (const f of fx) fixtures.push(f);
      tables[lg.name] = await api.standings(lg.id);
      console.log(`api-football ${lg.name}: ${fx.length} upcoming fixtures`);
    } catch (e) {
      console.log(`api-football ${lg.name}: SKIPPED (${e.message})`);
    }
  }
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { fixtures, tables };
}

async function main() {
  let data;
  if (config.apiKey) {
    console.log('source: api-football (key present)');
    data = await viaApiFootball();
  } else {
    console.log('source: openfootball (no key needed)');
    data = await ofree.load();
  }
  const cache = { fetchedAt: new Date().toISOString(), season: config.season, ...data };
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'data', 'cache.json'), JSON.stringify(cache));
  console.log(`cached ${data.fixtures.length} fixtures across ${Object.keys(data.tables).length} leagues`);
}

main().catch((e) => { console.error('FETCH FAILED:', e.message); process.exit(1); });
