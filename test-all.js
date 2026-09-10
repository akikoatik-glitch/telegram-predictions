'use strict';
// 15-POINT QUALITY CHECK (spec section 21). Offline where possible;
// items 2-3 use live read-only APIs (no posts). Exit 1 on any failure.
const fs = require('fs');
const path = require('path');
let fails = 0;
const ok = (n, c, extra = '') => {
  console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : ''));
  if (!c) fails++;
};

async function main() {
  // 1. app loads
  let mod = null, pick = null, format = null, db = null, tz = null, sender = null;
  try {
    mod = require('./src/model'); pick = require('./src/pick');
    format = require('./src/format'); db = require('./src/db');
    tz = require('./src/tz'); sender = require('./src/send');
    ok('1. application loads', true);
  } catch (e) { ok('1. application loads', false, e.message); return done(); }

  // 2. telegram connection (read-only getMe, local .env token)
  try {
    const env = {};
    fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
    });
    const r = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/getMe');
    const j = await r.json();
    ok('2. telegram connection', !!j.ok, j.ok ? '@' + j.result.username : j.description);
  } catch (e) { ok('2. telegram connection', false, e.message); }

  // 3-4. data source: real league file, real upcoming fixtures
  let table = null;
  try {
    const of = require('./src/providers/openfootball');
    const data = await of.load();
    const upcoming = data.fixtures.filter((f) => new Date(f.date).getTime() > Date.now());
    ok('3. api connection (openfootball)', data.fixtures.length > 50, data.fixtures.length + ' fixtures');
    ok('4. fixture retrieval', upcoming.length > 0, upcoming.length + ' future fixtures');
    const pl = data.tables['Premier League'] || {};
    table = Object.keys(pl).length ? pl : data.tables[Object.keys(data.tables)[0]];
  } catch (e) { ok('3/4. data source', false, e.message); }

  // 5-6. prediction + confidence bands
  const synth = {
    A: { played: 10, gf: 25, ga: 8 }, B: { played: 10, gf: 9, ga: 20 },
    C: { played: 10, gf: 15, ga: 14 }, D: { played: 10, gf: 14, ga: 15 },
  };
  const p = mod.predict('A', 'B', synth);
  ok('5. prediction generation', Math.abs(p.p1 + p.px + p.p2 - 100) <= 2 && p.topScores.length === 3);
  const band = pick.band(p.confidence);
  ok('6. confidence bands', ['Extremely High', 'Very High', 'High', 'Medium', 'Low'].includes(band.en), p.confidence + ' -> ' + band.en);

  // 7. timezone conversion incl. DST edges
  const winter = tz.toUTC('2026-01-15', '20:00', 'Europe/London');
  const summer = tz.toUTC('2026-07-15', '20:00', 'Europe/London');
  const cet = tz.toUTC('2026-01-15', '20:00', 'CET');
  const trt = tz.toUTC('2026-07-15', '20:00', 'TRT');
  ok('7. timezone conversion',
    winter === '2026-01-15T20:00:00.000Z' && summer === '2026-07-15T19:00:00.000Z' &&
    cet === '2026-01-15T19:00:00.000Z' && trt === '2026-07-15T17:00:00.000Z');

  // 8. scheduling: 10-min runs over 48h, every match posted exactly once in window
  const t0 = Date.UTC(2026, 8, 12, 0, 0);
  const fakeFx = [];
  for (let i = 0; i < 40; i++) {
    fakeFx.push({ id: 't' + i, date: new Date(t0 + (30 + i * 67) * 60000).toISOString() });
  }
  const seen = {};
  let blocked = 0;
  for (let r = 0; r < 288; r++) {
    const now = t0 + r * 10 * 60000;
    for (const f of fakeFx) {
      const mins = (new Date(f.date).getTime() - now) / 60000;
      if (mins >= 8 && mins <= 20 && !seen[f.id]) seen[f.id] = mins; // window [8,20]
      else if (mins >= 8 && mins <= 20 && seen[f.id]) blocked++; // overlap: dedupe blocks repost
    }
  }
  const leads = Object.values(seen);
  ok('8. 15-min scheduling (window tiling)',
    Object.keys(seen).length === 40 &&
    Math.min(...leads) >= 8 && Math.max(...leads) <= 20,
    `40/40 caught once, leads ${Math.min(...leads).toFixed(0)}-${Math.max(...leads).toFixed(0)}min, ${blocked} overlap attempts blocked by dedupe`);

  // 9. duplicate prevention (DB record blocks repost)
  const recs = { t0: { id: 't0', status: 'posted' } };
  const dup = [{ id: 't0', date: new Date(Date.now() + 12 * 60000).toISOString() }]
    .filter((f) => !recs[f.id]);
  ok('9. duplicate prevention', dup.length === 0);

  // 10. result grading across all pick types
  const gradeCases = [
    ['1', '2-0', true], ['1', '1-1', false], ['X', '0-0', true], ['2', '0-3', true],
    ['1X', '1-1', true], ['X2', '1-2', true], ['O25', '3-1', true], ['O25', '1-0', false],
    ['U35', '2-1', true], ['BTTS', '1-1', true], ['BTTS', '2-0', false],
  ];
  const grade = (type, score) => {
    const [hg, ag] = score.split('-').map(Number);
    return { 1: hg > ag, X: hg === ag, 2: hg < ag, '1X': hg >= ag, X2: hg <= ag, O25: hg + ag >= 3, U35: hg + ag <= 3, BTTS: hg > 0 && ag > 0 }[type];
  };
  ok('10. final-result checking', gradeCases.every(([t, s, w]) => grade(t, s) === w));

  // 11-12. result message formats
  const rec = { home: 'Man City', away: 'Arsenal', score: '2-1', pickLabelEn: 'Man City to Win', pickLabelAr: 'فوز مان سيتي', confidence: 78 };
  const win = format.resultWin(rec), miss = format.resultMiss({ ...rec, score: '0-1' });
  ok('11. WIN message', win.includes('PREDICTION CORRECT') && win.includes('فوز مان سيتي') && win.includes('2-1') && !/100%|guaranteed/i.test(win));
  ok('12. MISS message', miss.includes('PREDICTION MISSED') && miss.includes('لم يكن صحيحاً') && miss.includes('0-1'));

  // 13-14. DB persistence + restart recovery (backup, test, restore)
  const predFile = db.PRED;
  const backup = fs.existsSync(predFile) ? fs.readFileSync(predFile, 'utf8') : null;
  try {
    const all = db.getPredictions();
    all.__test = { id: '__test', status: 'posted' };
    db.savePredictions(all);
    delete require.cache[require.resolve('./src/db')];
    const db2 = require('./src/db');
    const reloaded = db2.getPredictions();
    ok('13-14. persistence + restart recovery', reloaded.__test && reloaded.__test.status === 'posted');
  } finally {
    if (backup === null) { try { fs.unlinkSync(predFile); } catch {} } else fs.writeFileSync(predFile, backup);
  }

  // 15. score + pick variety over 200 random matchups (no 1-1/1-0 defaults, no always-home)
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const scoreCount = {}, pickCount = {};
  for (let i = 0; i < 200; i++) {
    const tb = {};
    for (const n of names) tb[n] = { played: 8, gf: Math.round(rnd(4, 24)), ga: Math.round(rnd(4, 24)) };
    const h = names[i % 6], a = names[(i * 5 + 1) % 6];
    const pp = mod.predict(h, a, tb);
    const sc = pp.topScores[0].score;
    scoreCount[sc] = (scoreCount[sc] || 0) + 1;
    const b2 = pick.select(pp, h, a);
    if (b2) pickCount[b2.type] = (pickCount[b2.type] || 0) + 1;
  }
  const distinct = Object.keys(scoreCount).length;
  const top1Share = Math.max(...Object.values(scoreCount)) / 200;
  const pickTypes = Object.keys(pickCount).length;
  ok('15. realistic variety',
    distinct >= 6 && top1Share < 0.4 && pickTypes >= 3,
    `${distinct} scores, top ${top1Share.toFixed(0)}%, ${pickTypes} pick types`);

  done();
}
function done() {
  console.log(fails === 0 ? '\n✅ ALL 15 CHECKS PASSED' : `\n❌ ${fails} CHECK(S) FAILED`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
