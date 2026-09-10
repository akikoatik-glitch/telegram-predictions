'use strict';
// Local .env loader (git-ignored; GitHub Actions uses Secrets instead).
try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8')
    .split('\n').forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
} catch {}
// PRE-MATCH job (runs every 10 min): post cached matches kicking off
// inside [LEAD_MIN, LEAD_MAX] minutes that have no DB record yet.
// Skips anything below MIN_CONFIDENCE. Full record stored in the DB.
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const model = require('./src/model');
const pick = require('./src/pick');
const format = require('./src/format');
const sender = require('./src/send');
const db = require('./src/db');

const CACHE = path.join(__dirname, 'data', 'cache.json');

async function main() {
  if (config.paused) { console.log('PAUSED=true — posting disabled by admin'); return; }
  if (!fs.existsSync(CACHE)) { console.log('no cache yet — fetch job runs daily'); return; }
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const records = db.getPredictions();
  const today = new Date().toISOString().slice(0, 10);
  const postedToday = Object.values(records).filter((r) => r.day === today).length;

  const now = Date.now();
  const due = cache.fixtures.filter((f) => {
    const mins = (new Date(f.date).getTime() - now) / 60000;
    return mins >= config.leadMin && mins <= config.leadMax && !records[f.id];
  });
  console.log(`${due.length} match(es) in window [${config.leadMin},${config.leadMax}]min`);

  let sent = 0;
  for (const fx of due) {
    if (postedToday + sent >= config.maxPostsPerDay) { console.log('daily cap reached'); break; }
    const table = cache.tables[fx.league] || {};
    const m = model.predict(fx.home, fx.away, table);
    const best = pick.select(m, fx.home, fx.away);
    if (m.confidence < config.minConfidence || !best) {
      console.log(`skip ${fx.home} vs ${fx.away} (confidence ${m.confidence}, no eligible pick)`);
      records[fx.id] = skippedRecord(fx, m, today);
      continue;
    }
    const msg = format.prediction(fx, m, best);
    const res = await sender.send(msg);
    records[fx.id] = {
      id: fx.id, league: fx.league, home: fx.home, away: fx.away,
      kickoff: fx.date, day: today,
      pickType: best.type, pickLabelEn: best.labelEn, pickLabelAr: best.labelAr,
      confidence: m.confidence, bandEn: best.band.en, bandAr: best.band.ar,
      probs: { p1: m.p1, px: m.px, p2: m.p2, over25: m.over25, bttsYes: m.bttsYes, score: m.topScores[0].score },
      postedAt: new Date().toISOString(),
      messageId: res.messageId || null, dry: !!res.dry,
      status: 'posted', score: null, won: null,
      gradedAt: null, source: fx.source || 'openfootball', model: config.modelVersion,
    };
    sent++;
    console.log(`${res.dry ? '[dry] ' : ''}posted #${fx.id}: ${fx.home} vs ${fx.away} -> ${best.type} ${best.prob}% (conf ${m.confidence})`);
    await sender.sleep(2500);
  }
  db.savePredictions(records);
  console.log(`done: ${sent} posted`);
}

function skippedRecord(fx, m, today) {
  return {
    id: fx.id, league: fx.league, home: fx.home, away: fx.away,
    kickoff: fx.date, day: today, pickType: 'SKIP', pickLabelEn: 'skipped (low confidence)',
    pickLabelAr: 'تم التخطي (ثقة منخفضة)', confidence: m.confidence,
    bandEn: 'Low', bandAr: 'منخفض', probs: null, postedAt: null,
    messageId: null, dry: false, status: 'skipped', score: null,
    won: null, gradedAt: null, source: fx.source || 'openfootball', model: config.modelVersion,
  };
}

main().catch((e) => { console.error('POST FAILED:', e.message); process.exit(1); });
