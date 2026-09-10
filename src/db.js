'use strict';
// JSON-file database (fits serverless runners: committed back to the repo,
// so restarts lose nothing). predictions.json holds the full record per
// match; stats.json holds rolling aggregates.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'data');
const PRED = path.join(DIR, 'predictions.json');
const STATS = path.join(DIR, 'stats.json');

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function write(file, obj) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 1));
}

const getPredictions = () => read(PRED, {});
const savePredictions = (o) => write(PRED, o);
const freshStats = () => ({
  total: 0, correct: 0, incorrect: 0, pending: 0,
  byLeague: {}, byType: {}, byBand: {}, byDay: {},
});
const getStats = () => ({ ...freshStats(), ...read(STATS, {}) });
const saveStats = (o) => write(STATS, o);

function bump(bucket, key, won) {
  bucket[key] = bucket[key] || { total: 0, correct: 0 };
  bucket[key].total++;
  if (won) bucket[key].correct++;
}

function recordResult(rec, won) {
  const st = getStats();
  st.total++;
  if (won) st.correct++; else st.incorrect++;
  bump(st.byLeague, rec.league, won);
  bump(st.byType, rec.pickType, won);
  bump(st.byBand, rec.bandEn, won);
  bump(st.byDay, rec.day, won);
  saveStats(st);
}

function accuracyLine(label, total, correct) {
  const pct = total > 0 ? ((correct / total) * 100).toFixed(1) : '—';
  return `${label}: ${correct}/${total} (${pct}%)`;
}

module.exports = {
  getPredictions, savePredictions, getStats, saveStats, recordResult,
  accuracyLine, PRED, STATS,
};
