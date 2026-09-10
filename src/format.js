'use strict';
// Message builders per spec: prediction card, WIN result, MISS result,
// weekly stats. LANG = both | ar | en. Natural Arabic football wording,
// compact for Telegram, probabilities only — never guarantees.
const config = require('./config');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function kickoff(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
function lang() {
  const l = (config.lang || 'both').toLowerCase();
  return l === 'ar' ? 'ar' : l === 'en' ? 'en' : 'both';
}
function block(ar, en) {
  const l = lang();
  if (l === 'ar') return ar;
  if (l === 'en') return en;
  return ar + '\n' + en;
}

function prediction(fx, m, pick) {
  const L = [];
  L.push(block('🇸🇦 <b>توقع المباراة</b>', '🇬🇧 <b>MATCH PREDICTION</b>'));
  L.push(`🏆 ${esc(fx.league)} — 🕐 ${kickoff(fx.date)}`);
  L.push('');
  L.push(block(
    `⚽ المباراة:\n<b>${esc(fx.home)}</b> 🆚 <b>${esc(fx.away)}</b>`,
    `⚽ Match:\n<b>${esc(fx.home)}</b> 🆚 <b>${esc(fx.away)}</b>`
  ));
  L.push('');
  L.push(block(
    `🎯 التوقع الأقوى: <b>${esc(pick.labelAr)}</b>`,
    `🎯 Best Prediction: <b>${esc(pick.labelEn)}</b>`
  ));
  L.push(block(
    `📊 نسبة الثقة: <b>${m.confidence}%</b> (${pick.band.ar})`,
    `📊 Confidence: <b>${m.confidence}%</b> (${pick.band.en})`
  ));
  L.push('');
  L.push(block('📈 الاحتمالات:', '📈 Probabilities:'));
  L.push(`Home Win / فوز المضيف: <b>${m.p1}%</b>`);
  L.push(`Draw / تعادل: <b>${m.px}%</b>`);
  L.push(`Away Win / فوز الضيف: <b>${m.p2}%</b>`);
  L.push(`⚽ BTTS / الفريقان يسجلان: <b>${m.bttsYes}%</b>`);
  L.push(`📊 Over 2.5 / أكثر من 2.5: <b>${m.over25}%</b>`);
  L.push(`🎯 Likely score / النتيجة المتوقعة: <b>${esc(m.topScores[0].score)}</b> (${m.topScores[0].prob}%)`);
  L.push('');
  L.push(`<i>${block(
    'احتمالات إحصائية وليست ضمانات • العب بمسؤولية +18',
    'Statistical probabilities, not guarantees • Play responsibly 18+'
  )}</i>`);
  return L.join('\n');
}

function resultWin(rec) {
  const L = [];
  L.push(block('🇸🇦 ✅ <b>التوقع صحيح!</b>', '🇬🇧 ✅ <b>PREDICTION CORRECT!</b>'));
  L.push(block('🔥 التوقع تحقق بنجاح!', '🔥 The prediction was correct!'));
  L.push(`⚽ <b>${esc(rec.home)} ${esc(rec.score)} ${esc(rec.away)}</b>`);
  L.push(block(
    `🎯 التوقع: ${esc(rec.pickLabelAr)}`,
    `🎯 Prediction: ${esc(rec.pickLabelEn)}`
  ));
  L.push(block(
    `📊 الثقة: ${rec.confidence}%`,
    `📊 Confidence: ${rec.confidence}%`
  ));
  L.push('');
  L.push('💰💰 <b>Prediction WIN</b> 💰💰');
  return L.join('\n');
}

function resultMiss(rec) {
  const L = [];
  L.push(block('🇸🇦 ❌ <b>التوقع لم يكن صحيحاً</b>', '🇬🇧 ❌ <b>PREDICTION MISSED</b>'));
  L.push(`⚽ ${block('النتيجة:', 'Final Score:')} <b>${esc(rec.home)} ${esc(rec.score)} ${esc(rec.away)}</b>`);
  L.push(block(
    `🎯 التوقع: ${esc(rec.pickLabelAr)}`,
    `🎯 Prediction: ${esc(rec.pickLabelEn)}`
  ));
  L.push('');
  L.push(block('نعود أقوى في التوقع القادم 💪', 'We go again in the next prediction 💪'));
  return L.join('\n');
}

function weeklyStats(st) {
  const acc = st.total > 0 ? ((st.correct / st.total) * 100).toFixed(1) : '—';
  const rows = Object.entries(st.byLeague)
    .map(([k, v]) => `• ${esc(k)}: ${v.correct}/${v.total}`)
    .join('\n');
  return [
    block('📊 <b>أداء البوت الأسبوعي</b>', '📊 <b>BOT PERFORMANCE</b>'),
    block(
      `إجمالي التوقعات: <b>${st.total}</b> | صحيحة: <b>${st.correct}</b> | الدقة: <b>${acc}%</b>`,
      `Total Predictions: <b>${st.total}</b> | Correct: <b>${st.correct}</b> | Accuracy: <b>${acc}%</b>`
    ),
    rows,
  ].join('\n');
}

module.exports = { prediction, resultWin, resultMiss, weeklyStats };
