'use strict';
// SHORT Arabic-first messages. One match = one pick + confidence, nothing
// else. No flags, no +18, no English unless LANG says otherwise.
// Darija-flavored, varied success reactions (deterministic by fixture id,
// so restarts never repeat or skew the mix).
const config = require('./config');
const tz = require('./tz');
const { arName } = require('./arnames');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function lang() {
  const l = (config.lang || 'ar').toLowerCase();
  return l === 'en' ? 'en' : l === 'both' ? 'both' : 'ar';
}
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Arabic pick label from market type (team names localized).
function arPick(type, home, away) {
  const H = arName(home), A = arName(away);
  switch (type) {
    case '1': return `فوز ${H}`;
    case 'X': return 'تعادل';
    case '2': return `فوز ${A}`;
    case '1X': return `${H} أو التعادل`;
    case 'X2': return `${A} أو التعادل`;
    case 'O25': return 'أكثر من 2.5 هدف';
    case 'U35': return 'أقل من 3.5 هدف';
    case 'BTTS': return 'الفريقان يسجلان';
    default: return 'الأقوى إحصائياً';
  }
}
function enPick(type, home, away) {
  switch (type) {
    case '1': return `${home} to Win`;
    case 'X': return 'Draw';
    case '2': return `${away} to Win`;
    case '1X': return `${home} or Draw`;
    case 'X2': return `${away} or Draw`;
    case 'O25': return 'Over 2.5 Goals';
    case 'U35': return 'Under 3.5 Goals';
    case 'BTTS': return 'Both Teams To Score';
    default: return 'Best available';
  }
}

function prediction(fx, m, p) {
  const H = arName(fx.home), A = arName(fx.away);
  const l = lang();
  if (l === 'en') {
    return [
      `⚽ <b>${esc(fx.home.toUpperCase())} vs ${esc(fx.away.toUpperCase())}</b>`,
      `🎯 Prediction: <b>${esc(enPick(p.type, fx.home, fx.away))}</b>`,
      `🔥 Confidence: <b>${m.confidence}%</b>`,
    ].join('\n');
  }
  const card = [
    `⚽ <b>${esc(H)} × ${esc(A)}</b>`,
    `🎯 التوقع: <b>${esc(arPick(p.type, fx.home, fx.away))}</b>`,
    `🔥 الثقة: <b>${m.confidence}%</b>`,
  ].join('\n');
  if (l === 'both') {
    return card + '\n—\n' + [
      `⚽ <b>${esc(fx.home.toUpperCase())} vs ${esc(fx.away.toUpperCase())}</b>`,
      `🎯 Prediction: <b>${esc(enPick(p.type, fx.home, fx.away))}</b>`,
      `🔥 Confidence: <b>${m.confidence}%</b>`,
    ].join('\n');
  }
  return card;
}

const WIN_REACTIONS = [
  '💰🔥 مبروك للناس لي لعبت معانا!',
  '🔥 رووووووح تخلص!',
  '🎯 جات في بلاصتها! ✅',
  '💰 التوقع ضرب يا ناس!',
  '🔥 هاذي هي الخدمة!',
  '✅ التوقع صحيح.. مبروك!',
  '🎯 دخلت في الجيب! 💰',
  '🔥 قلتلكم عليها.. وها هي جات!',
];

function resultWin(rec) {
  const H = arName(rec.home), A = arName(rec.away);
  const l = lang();
  if (l === 'en') {
    return `✅ <b>PREDICTION CORRECT!</b>\n⚽ <b>${esc(rec.home)} ${esc(rec.score)} ${esc(rec.away)}</b>\n🎯 ${esc(rec.pickLabelEn)} ✅`;
  }
  const reaction = WIN_REACTIONS[hash(rec.id) % WIN_REACTIONS.length];
  return `${reaction}\n⚽ ${esc(H)} ${esc(rec.score)} ${esc(A)} ✅`;
}

function resultMiss(rec) {
  const H = arName(rec.home), A = arName(rec.away);
  const l = lang();
  if (l === 'en') {
    return `❌ <b>PREDICTION MISSED</b>\n⚽ Final Score: <b>${esc(rec.home)} ${esc(rec.score)} ${esc(rec.away)}</b>\nBetter luck next time 🤝`;
  }
  return `❌ التوقع ما دخلش اليوم.\nالنتيجة: <b>${esc(H)} ${esc(rec.score)} ${esc(A)}</b>\nالمرة الجاية إن شاء الله 🤝`;
}

function weeklyStats(st) {
  const acc = st.total > 0 ? ((st.correct / st.total) * 100).toFixed(1) : '—';
  const rows = Object.entries(st.byLeague)
    .map(([k, v]) => `• ${esc(k)}: ${v.correct}/${v.total}`)
    .join('\n');
  const l = lang();
  if (l === 'en') {
    return `📊 <b>BOT PERFORMANCE</b>\nTotal: <b>${st.total}</b> | Correct: <b>${st.correct}</b> | Accuracy: <b>${acc}%</b>\n${rows}`;
  }
  return `📊 <b>أداء البوت الأسبوعي</b>\nالتوقعات: <b>${st.total}</b> | صحيحة: <b>${st.correct}</b> | الدقة: <b>${acc}%</b>\n${rows}`;
}

module.exports = { prediction, resultWin, resultMiss, weeklyStats, arPick, enPick, WIN_REACTIONS };
