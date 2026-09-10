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
// inside the window that have no DB record yet. Model vote adjusts
// confidence (agreement +3, disagreement capped at 74); anything below
// MIN_CONFIDENCE is skipped, never published weak.
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const signals = require('./src/signals');
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
  const postedToday = Object.values(records).filter((r) => r.day === today && r.status === 'posted').length;

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
    const history = (cache.history && cache.history[fx.league]) || [];
    const sig = signals.analyze(fx, table, history);
    if (!sig.pick) {
      console.log(`skip ${fx.home} vs ${fx.away} (no eligible pick)`);
      records[fx.id] = skippedRecord(fx, sig.model.confidence, today);
      continue;
    }
    // Model vote: agreement lifts slightly, disagreement caps hard.
    let conf = sig.model.confidence;
    if (sig.voteAgree) conf = Math.min(92, conf + 3);
    else conf = Math.min(conf, 74);
    if (conf < config.minConfidence) {
      console.log(`skip ${fx.home} vs ${fx.away} (confidence ${conf}${sig.voteAgree ? '' : ', models disagree'})`);
      records[fx.id] = skippedRecord(fx, conf, today);
      continue;
    }
    const msg = format.prediction(fx, { ...sig.model, confidence: conf }, sig.pick, sig);
    const res = await sender.send(msg);
    records[fx.id] = {
      id: fx.id, league: fx.league, home: fx.home, away: fx.away,
      kickoff: fx.date, day: today,
      pickType: sig.pick.type, pickLabelEn: sig.pick.labelEn, pickLabelAr: sig.pick.labelAr,
      confidence: conf, bandEn: sig.pick.band.en, bandAr: sig.pick.band.ar,
      probs: { p1: sig.model.p1, px: sig.model.px, p2: sig.model.p2, over25: sig.model.over25, bttsYes: sig.model.bttsYes, score: sig.model.topScores[0].score },
      formH: sig.formH, formA: sig.formA,
      posH: sig.posH ? `${sig.posH.pos}/${sig.posH.of}` : null,
      posA: sig.posA ? `${sig.posA.pos}/${sig.posA.of}` : null,
      signals: { voteAgree: sig.voteAgree, formPick: sig.formPickType, sources: sig.sources },
      postedAt: new Date().toISOString(),
      messageId: res.messageId || null, dry: !!res.dry,
      status: 'posted', score: null, won: null,
      gradedAt: null, source: fx.source || 'openfootball', model: config.modelVersion,
    };
    sent++;
    console.log(`${res.dry ? '[dry] ' : ''}posted #${fx.id}: ${fx.home} vs ${fx.away} -> ${sig.pick.type} ${sig.pick.prob}% (conf ${conf}${sig.voteAgree ? '' : ', disagree'})`);
    await sender.sleep(2500);
  }
  db.savePredictions(records);
  console.log(`done: ${sent} posted`);
}

function skippedRecord(fx, conf, today) {
  return {
    id: fx.id, league: fx.league, home: fx.home, away: fx.away,
    kickoff: fx.date, day: today, pickType: 'SKIP', pickLabelEn: 'skipped (low confidence)',
    pickLabelAr: 'تم التخطي (ثقة منخفضة)', confidence: conf,
    bandEn: 'Low', bandAr: 'منخفض', probs: null, formH: null, formA: null,
    posH: null, posA: null, signals: null, postedAt: null,
    messageId: null, dry: false, status: 'skipped', score: null,
    won: null, gradedAt: null, source: fx.source || 'openfootball', model: config.modelVersion,
  };
}

main().catch((e) => { console.error('POST FAILED:', e.message); process.exit(1); });
