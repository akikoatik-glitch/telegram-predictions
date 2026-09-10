'use strict';
// Analyst signals derived from REAL played results — form, home/away
// splits, league position, head-to-head, and a vote between the
// full-season model and a recent-form model. Nothing invented: thin data
// yields empty strings, and callers omit empty lines.
const model = require('./model');
const pick = require('./pick');

function teamGames(history, team) {
  return (history || [])
    .filter((m) => m.h === team || m.a === team)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}
function letterOf(m, team) {
  const mine = m.h === team ? m.hg : m.ag;
  const theirs = m.h === team ? m.ag : m.hg;
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
}
// Last-n table in model.predict format, optionally venue-filtered.
function miniTable(history, team, n, venue) {
  const games = teamGames(history, team)
    .filter((m) => !venue || (venue === 'h' ? m.h === team : m.a === team))
    .slice(-n);
  const t = { played: 0, gf: 0, ga: 0 };
  let pts = 0;
  for (const m of games) {
    const gf = m.h === team ? m.hg : m.ag;
    const ga = m.h === team ? m.ag : m.hg;
    t.played++; t.gf += gf; t.ga += ga;
    pts += gf > ga ? 3 : gf === ga ? 1 : 0;
  }
  return { table: t, games: games.length, pts };
}
function formString(history, team, n = 5) {
  return teamGames(history, team).slice(-n).map((m) => letterOf(m, team)).join('-') || '';
}
function formPoints(history, team, n = 5) {
  let pts = 0, n2 = 0;
  for (const m of teamGames(history, team).slice(-n)) {
    n2++;
    const l = letterOf(m, team);
    pts += l === 'W' ? 3 : l === 'D' ? 1 : 0;
  }
  return { pts, played: n2 };
}
function fullTable(history) {
  const t = {};
  for (const m of (history || [])) {
    for (const [nm, gf, ga] of [[m.h, m.hg, m.ag], [m.a, m.ag, m.hg]]) {
      t[nm] = t[nm] || { played: 0, gf: 0, ga: 0 };
      t[nm].played++; t[nm].gf += gf; t[nm].ga += ga;
    }
  }
  return t;
}
function position(history, team) {
  const t = fullTable(history);
  if (!t[team]) return null;
  // Points need W/D/L: recompute from history.
  const pts = {};
  for (const m of (history || [])) {
    pts[m.h] = pts[m.h] || 0; pts[m.a] = pts[m.a] || 0;
    if (m.hg > m.ag) pts[m.h] += 3;
    else if (m.hg < m.ag) pts[m.a] += 3;
    else { pts[m.h] += 1; pts[m.a] += 1; }
  }
  const order = Object.keys(t).sort((a, b) =>
    (pts[b] - pts[a]) || ((t[b].gf - t[b].ga) - (t[a].gf - t[a].ga)) || (t[b].gf - t[a].gf)
  );
  const rank = order.indexOf(team);
  return rank >= 0 ? { pos: rank + 1, of: order.length, pts: pts[team] } : null;
}
function h2h(history, home, away, n = 5) {
  const meets = (history || [])
    .filter((m) => (m.h === home && m.a === away) || (m.h === away && m.a === home))
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .slice(-n);
  if (!meets.length) return null;
  let h = 0, d = 0, a = 0;
  for (const m of meets) {
    const hw = m.hg > m.ag ? m.h : m.hg < m.ag ? m.a : null;
    if (!hw) d++;
    else if (hw === home) h++;
    else a++;
  }
  const last = meets[meets.length - 1];
  return { h, d, a, total: meets.length, last: `${last.h} ${last.hg}-${last.ag} ${last.a}` };
}

// Full analysis for one fixture. Returns display strings + vote result.
function analyze(fx, table, history) {
  const hist = history || [];
  const formH = formString(hist, fx.home);
  const formA = formString(hist, fx.away);
  const fpH = formPoints(hist, fx.home);
  const fpA = formPoints(hist, fx.away);
  const homeMini = miniTable(hist, fx.home, 99, 'h');
  const awayMini = miniTable(hist, fx.away, 99, 'a');
  const posH = position(hist, fx.home);
  const posA = position(hist, fx.away);
  const duel = h2h(hist, fx.home, fx.away);

  // Vote: full-season model vs recent-form model (last 5 each).
  const formTable = {};
  for (const nm of [fx.home, fx.away]) {
    const mt = miniTable(hist, nm, 5);
    formTable[nm] = mt.table.played ? mt.table : (table[nm] || { played: 0, gf: 0, ga: 0 });
  }
  const mFull = model.predict(fx.home, fx.away, table);
  const mForm = model.predict(fx.home, fx.away, formTable);
  const pFull = pick.select(mFull, fx.home, fx.away);
  const pForm = pick.select(mForm, fx.home, fx.away);
  const agree = !!(pFull && pForm && pFull.type === pForm.type);

  return {
    model: mFull, pick: pFull,
    formH, formA, formPtsH: fpH, formPtsA: fpA,
    homeMini, awayMini, posH, posA, h2h: duel,
    voteAgree: agree,
    formPickType: pForm ? pForm.type : null,
    sources: ['season-table', 'recent-form', 'home-away-split', duel ? 'head-to-head' : null].filter(Boolean),
  };
}

module.exports = { analyze, formString, formPoints, miniTable, fullTable, position, h2h, teamGames };
