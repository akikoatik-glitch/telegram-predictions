'use strict';
// Local .env loader (git-ignored; GitHub Actions uses Secrets instead).
try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8')
    .split('\n').forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
} catch {}
// RESULTS job (runs hourly): for posted predictions whose match should be
// over (kickoff + 130 min ago), fetch the final score, grade the pick,
// post a WIN/MISS message, update stats. Mondays also post weekly summary.
const config = require('./src/config');
const sender = require('./src/send');
const format = require('./src/format');
const db = require('./src/db');
const ofree = require('./src/providers/openfootball');
const otxt = require('./src/providers/opentxt');
const espn = require('./src/providers/espn');
const apif = require('./src/providers/apifootball');

const MATCH_LEN_MIN = 130; // full time + margin before grading

function grade(rec, score) {
  const [hg, ag] = score.split('-').map(Number);
  switch (rec.pickType) {
    case '1': return hg > ag;
    case 'X': return hg === ag;
    case '2': return hg < ag;
    case '1X': return hg >= ag;
    case 'X2': return hg <= ag;
    case 'O25': return hg + ag >= 3;
    case 'U35': return hg + ag <= 3;
    case 'BTTS': return hg > 0 && ag > 0;
    default: return null;
  }
}

async function main() {
  const records = db.getPredictions();
  const ids = Object.keys(records).filter((id) => {
    const r = records[id];
    return r.status === 'posted' &&
      (Date.now() - new Date(r.kickoff).getTime()) / 60000 >= MATCH_LEN_MIN;
  });
  console.log(`${ids.length} posted match(es) ready for grading`);
  if (!ids.length) { await maybeWeekly(records); return; }

  const scores = {};
  // Route each id to its provider by prefix (fixtures keep their origin).
  Object.assign(scores, await ofree.resultsFor(ids));
  Object.assign(scores, await otxt.resultsFor(ids));
  Object.assign(scores, await espn.resultsFor(ids));
  if (config.apiKey) Object.assign(scores, await apif.resultsFor(ids));

  let graded = 0;
  for (const id of ids) {
    const rec = records[id];
    const score = scores[id];
    if (!score) { console.log(`no score yet for ${rec.home} vs ${rec.away}`); continue; }
    const won = grade(rec, score);
    if (won === null) continue;
    rec.score = score; rec.won = won; rec.status = won ? 'won' : 'lost';
    rec.gradedAt = new Date().toISOString();
    const msg = won ? format.resultWin(rec) : format.resultMiss(rec);
    try {
      await sender.send(msg);
      console.log(`${won ? 'WIN' : 'MISS'} ${rec.home} ${score} ${rec.away} (${rec.pickType})`);
    } catch (e) {
      console.log(`result post failed for ${id}: ${e.message} (graded anyway)`);
    }
    db.recordResult(rec, won);
    graded++;
    await sender.sleep(2500);
  }
  db.savePredictions(records);
  console.log(`done: ${graded} graded`);
  await maybeWeekly(records);
}

async function maybeWeekly(records) {
  const stats = db.getStats();
  const today = new Date().toISOString().slice(0, 10);
  const isMonday = new Date().getUTCDay() === 1;
  if (!isMonday || stats.lastWeekly === today || stats.total === 0) return;
  try {
    await sender.send(format.weeklyStats(stats));
    stats.lastWeekly = today;
    db.saveStats(stats);
    console.log('weekly summary posted');
  } catch (e) {
    console.log('weekly summary failed: ' + e.message);
  }
}

main().catch((e) => { console.error('RESULTS FAILED:', e.message); process.exit(1); });
