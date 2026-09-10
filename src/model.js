'use strict';
// Honest Poisson goals model. No invented data, no "guaranteed" claims.
// Team strength comes from the real league table; teams with few games
// played are regressed toward the league average.

const AVG_HOME = 1.55; // long-run goals per home game, top leagues
const AVG_AWAY = 1.18;

function teamRates(entry, played, leagueAvgFor, leagueAvgAgainst) {
  const w = Math.min(1, played / 10); // 0..1 trust in observed numbers
  const gf = played > 0 ? entry.gf / played : leagueAvgFor;
  const ga = played > 0 ? entry.ga / played : leagueAvgAgainst;
  return {
    attack: w * (gf / leagueAvgFor) + (1 - w) * 1,
    defence: w * (ga / leagueAvgAgainst) + (1 - w) * 1,
  };
}

function poisson(l, k) {
  return (Math.pow(l, k) * Math.exp(-l)) / fact(k);
}
function fact(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function predict(home, away, table) {
  const names = Object.keys(table);
  let totFor = 0, totAgainst = 0, totPlayed = 0;
  for (const n of names) {
    totFor += table[n].gf; totAgainst += table[n].ga; totPlayed += table[n].played;
  }
  const avgFor = totPlayed > 0 ? totFor / totPlayed : (AVG_HOME + AVG_AWAY) / 2;
  const avgAgainst = avgFor;

  const h = table[home] || { played: 0, gf: 0, ga: 0 };
  const a = table[away] || { played: 0, gf: 0, ga: 0 };
  const hr = teamRates(h, h.played, avgFor, avgAgainst);
  const ar = teamRates(a, a.played, avgFor, avgAgainst);

  const xgH = Math.max(0.15, hr.attack * ar.defence * AVG_HOME);
  const xgA = Math.max(0.1, ar.attack * hr.defence * AVG_AWAY);

  let pH = 0, pD = 0, pA = 0, over25 = 0, btts = 0;
  let bestScore = '1-0', bestP = -1;
  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 7; j++) {
      const p = poisson(xgH, i) * poisson(xgA, j);
      if (i > j) pH += p; else if (i === j) pD += p; else pA += p;
      if (i + j >= 3) over25 += p;
      if (i > 0 && j > 0) btts += p;
      if (p > bestP) { bestP = p; bestScore = i + '-' + j; }
    }
  }
  const probs = [
    { k: '1', p: pH }, { k: 'X', p: pD }, { k: '2', p: pA },
  ].sort((x, y) => y.p - x.p);
  const margin = probs[0].p - probs[1].p;
  const dataQuality = Math.min(1, ((h.played + a.played) / 2 / 10 + (names.length > 0 ? 0.3 : 0)));
  let confidence = Math.round(50 + margin * 90 - (1 - dataQuality) * 12);
  confidence = Math.max(40, Math.min(90, confidence));

  const pct = (x) => Math.round(x * 100);
  return {
    p1: pct(pH), px: pct(pD), p2: pct(pA),
    over25: pct(over25), under25: 100 - pct(over25),
    bttsYes: pct(btts), bttsNo: 100 - pct(btts),
    score: bestScore,
    xgH: xgH.toFixed(2), xgA: xgA.toFixed(2),
    pick: probs[0].k, pickProb: pct(probs[0].p),
    confidence,
  };
}

module.exports = { predict };
