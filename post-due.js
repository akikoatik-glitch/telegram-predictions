'use strict';
// Local .env loader (ignored by git; GitHub Actions uses Secrets instead).
try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8')
    .split('\n').forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
} catch {}
// HOURLY job: post every cached match kicking off within the lead window
// that hasn't been posted yet. Updates data/posted.json (committed back).
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const model = require('./src/model');
const format = require('./src/format');
const sender = require('./src/send');

const CACHE = path.join(__dirname, 'data', 'cache.json');
const POSTED = path.join(__dirname, 'data', 'posted.json');

function loadPosted() {
  try { return JSON.parse(fs.readFileSync(POSTED, 'utf8')); }
  catch { return { day: '', ids: [] }; }
}

async function main() {
  if (!fs.existsSync(CACHE)) {
    console.log('no cache yet — run "npm run fetch" (or wait for the daily fetch job)');
    return;
  }
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const posted = loadPosted();
  if (posted.day !== today) { posted.day = today; posted.ids = []; } // fresh cap each day

  const now = Date.now();
  const due = cache.fixtures.filter((f) => {
    const mins = (new Date(f.date).getTime() - now) / 60000;
    return mins >= config.leadMin && mins <= config.leadMax && !posted.ids.includes(f.id);
  });
  console.log(`${due.length} match(es) due for posting`);

  let sent = 0;
  const postedToday = posted.ids.length;
  for (const fx of due) {
    if (postedToday + sent >= config.maxPostsPerDay) {
      console.log('daily cap reached, rest will wait for tomorrow');
      break;
    }
    const table = cache.tables[fx.league] || {};
    const pred = model.predict(fx.home, fx.away, table);
    if (pred.confidence < config.minConfidence) {
      console.log(`skip ${fx.home} vs ${fx.away} (confidence ${pred.confidence})`);
      posted.ids.push(fx.id); // don't retry all day
      continue;
    }
    const msg = format.format(fx, pred);
    const res = await sender.send(msg);
    posted.ids.push(fx.id);
    sent++;
    console.log(`${res.dry ? '[dry] ' : ''}posted #${fx.id}: ${fx.home} vs ${fx.away} (${fx.league})`);
    await sender.sleep(2500); // stay far under Telegram limits
  }
  fs.writeFileSync(POSTED, JSON.stringify(posted, null, 1));
  console.log(`done: ${sent} posted, ${posted.ids.length} marked for today`);
}

main().catch((e) => { console.error('POST FAILED:', e.message); process.exit(1); });
