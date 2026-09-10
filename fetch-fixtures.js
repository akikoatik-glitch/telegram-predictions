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
const apif = require('./src/providers/apifootball');

async function main() {
  let data;
  if (config.apiKey) {
    console.log('source: api-football (key present)');
    data = await apif.load(apif.todayPlus(0), apif.todayPlus(2));
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
