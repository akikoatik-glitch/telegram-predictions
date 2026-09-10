'use strict';
// Poisson goals model over real results. Returns every supported market;
// markets without data are null (callers omit them, never invent).
// Correct scores come from the joint distribution — variety emerges from
// the math, never forced, never defaulted to 1-1.
const AVG_HOME = 1.55;
const AVG_AWAY = 1.18;
const MAXG = 8;

function rates(entry, played, avg) {
  const w = Math.min(1, played / 10);
  const gf = played > 0 ? entry.gf / played : avg;
  const ga = played > 0 ? entry.ga / played : avg;
  return {
    attack: w * (gf / avg) + (1 - w) * 1,
    defence: w * (ga / avg) + (1 - w) * 1,
  };
}
function poisson(l, k) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.pow(l, k) * Math.exp(-l)) / f;
}

function predict(home, away, table) {
  const names = Object.keys(table);
  let f = 0, p = 0;
  for (const n of names) { f += table[n].gf; p += table[n].played; }
  const avg = p > 0 ? f / p : (AVG_HOME + AVG_AWAY) / 2;

  const h = table[home] || { played: 0, gf: 0, ga: 0 };
  const a = table[away] || { played: 0, gf: 0, ga: 0 };
  const hr = rates(h, h.played, avg);
  const ar = rates(a, a.played, avg);

  const xgH = Math.max(0.15, hr.attack * ar.defence * AVG_HOME);
  const xgA = Math.max(0.1, ar.attack * hr.defence * AVG_AWAY);

  let p1 = 0, px = 0, p2 = 0;
  let o15 = 0, o25 = 0, u35 = 0, btts = 0;
  const scores = [];
  for (let i = 0; i <= MAXG; i++) {
    for (let j = 0; j <= MAXG; j++) {
      const pr = poisson(xgH, i) * poisson(xgA, j);
      if (i > j) p1 += pr; else if (i === j) px += pr; else p2 += pr;
      if (i + j >= 2) o15 += pr;
      if (i + j >= 3) o25 += pr;
      if (i + j <= 3) u35 += pr;
      if (i > 0 && j > 0) btts += pr;
      scores.push({ s: `${i}-${j}`, p: pr });
    }
  }
  scores.sort((x, y) => y.p - x.p);
  const pct = (x) => Math.round(x * 100);
  const dataQ = Math.min(1, ((h.played + a.played) / 2 / 10) + (names.length > 0 ? 0.3 : 0));
  const probs = [
    { k: '1', p: p1 }, { k: 'X', p: px }, { k: '2', p: p2 },
  ].sort((x, y) => y.p - x.p);
  const margin = probs[0].p - probs[1].p;
  let confidence = Math.round(52 + margin * 95 - (1 - dataQ) * 12);
  confidence = Math.max(40, Math.min(95, confidence));

  return {
    p1: pct(p1), px: pct(px), p2: pct(p2),
    dc1x: pct(p1 + px), dcx2: pct(px + p2), dc12: pct(p1 + p2),
    over15: pct(o15), over25: pct(o25), under35: pct(u35),
    bttsYes: pct(btts), bttsNo: 100 - pct(btts),
    topScores: scores.slice(0, 3).map((s) => ({ score: s.s, prob: pct(s.p) })),
    xgH: xgH.toFixed(2), xgA: xgA.toFixed(2),
    confidence, dataQuality: Math.round(dataQ * 100),
    corners: null, cards: null, // not provided by current sources: omitted
  };
}

module.exports = { predict };
