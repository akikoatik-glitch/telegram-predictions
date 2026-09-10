'use strict';
// Best-pick selection: every eligible market competes on probability.
// Minimum gates keep weak angles out; the winner is pure math, which is
// why picks vary (favourites, draws, BTTS, totals) instead of repeating.
const config = require('./config');

function band(conf) {
  for (const b of config.bands) {
    if (conf >= b.min) return b;
  }
  return { min: 0, en: 'Low', ar: 'منخفض' };
}

// Candidates: [type, labelEn, labelAr, probability, needs]
// `needs` lets callers require data (e.g. corners) — absent data disqualifies.
function candidates(m, home, away) {
  const H = home.length > 22 ? home.slice(0, 21) + '…' : home;
  const A = away.length > 22 ? away.slice(0, 21) + '…' : away;
  return [
    { type: '1', labelEn: `${H} to Win`, labelAr: `فوز ${H}`, prob: m.p1, min: 45 },
    { type: 'X', labelEn: 'Draw', labelAr: 'تعادل', prob: m.px, min: 30 },
    { type: '2', labelEn: `${A} to Win`, labelAr: `فوز ${A}`, prob: m.p2, min: 45 },
    { type: '1X', labelEn: `${H} or Draw`, labelAr: `${H} أو التعادل`, prob: m.dc1x, min: 60 },
    { type: 'X2', labelEn: `${A} or Draw`, labelAr: `${A} أو التعادل`, prob: m.dcx2, min: 60 },
    { type: 'O25', labelEn: 'Over 2.5 Goals', labelAr: 'أكثر من 2.5 هدف', prob: m.over25, min: 60 },
    { type: 'U35', labelEn: 'Under 3.5 Goals', labelAr: 'أقل من 3.5 هدف', prob: m.under35, min: 65 },
    { type: 'BTTS', labelEn: 'Both Teams To Score', labelAr: 'الفريقان يسجلان', prob: m.bttsYes, min: 60 },
  ];
}

function select(m, home, away) {
  const elig = candidates(m, home, away).filter((c) => c.prob >= c.min);
  if (!elig.length) return null;
  elig.sort((a, b) => b.prob - a.prob);
  const win = elig[0];
  return { ...win, band: band(m.confidence) };
}

module.exports = { select, candidates, band };
