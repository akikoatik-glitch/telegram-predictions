'use strict';
// Bilingual (English + Arabic) Telegram message, HTML parse mode.
// Probabilities only — never promises.

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function kickoff(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

function pickLabel(pick) {
  return pick === '1' ? 'Home win / فوز المضيف'
    : pick === 'X' ? 'Draw / تعادل'
    : 'Away win / فوز الضيف';
}

function format(fx, pred) {
  return [
    `⚽ <b>Match Prediction • توقعات المباراة</b>`,
    `🏆 ${esc(fx.league)} — 🕐 ${kickoff(fx.date)}`,
    ``,
    `🔵 <b>${esc(fx.home)}</b> vs <b>${esc(fx.away)}</b>`,
    ``,
    `1X2: 1️⃣ ${pred.p1}% • ❌ ${pred.px}% • 2️⃣ ${pred.p2}%`,
    `Over 2.5 / أكثر من 2.5: <b>${pred.over25}%</b> (Under: ${pred.under25}%)`,
    `BTTS / الفريقان يسجلان: <b>${pred.bttsYes}%</b>`,
    `Likely score / النتيجة المتوقعة: <b>${esc(pred.score)}</b>`,
    `xG: ${pred.xgH} - ${pred.xgA}`,
    ``,
    `✅ Pick / الاختيار: <b>${pickLabel(pred.pick)} (${pred.pickProb}%)</b>`,
    `📊 Confidence / الثقة: <b>${pred.confidence}/100</b>`,
    ``,
    `<i>Probabilities, not guarantees • احتمالات وليست ضمانات • 18+ Play responsibly</i>`,
  ].join('\n');
}

module.exports = { format };
