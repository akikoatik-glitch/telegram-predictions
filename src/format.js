'use strict';
// Message builders: pro prediction card (§6), WIN/MISS results (reply to
// the original), weekly stats. LANG = both | ar | en. Natural Arabic
// football wording. Probabilities only — never guarantees, no +18 content.
const config = require('./config');
const tz = require('./tz');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
function kickoffLine(iso) {
  const zone = config.displayTz || 'Africa/Algiers';
  return `${tz.displayIn(iso, zone)} ${tz.displayLabel(zone)}`;
}
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Human-like analysis from TRUE signals only. Deterministic phrasing
// variety (hash of fixture id). Short teams names kept as-is.
function analysis(fx, sig, pick, m) {
  const h = hash(fx.id);
  const homeSide = pick.type === '2' || pick.type === 'X2' ? fx.away : fx.home;
  const isHome = homeSide === fx.home;
  const form = isHome ? sig.formH : sig.formA;
  const fp = isHome ? sig.formPtsH : sig.formPtsA;
  const pos = isHome ? sig.posH : sig.posA;
  const venue = isHome ? sig.homeMini : sig.awayMini;
  const venuePPG = venue.games > 0 ? venue.pts / venue.games : null;

  const en = [], ar = [];
  if (form) {
    const wins = (form.match(/W/g) || []).length;
    const losses = (form.match(/L/g) || []).length;
    if (losses === 0 && fp.played >= 3) {
      en.push(`${homeSide} are unbeaten in their last ${fp.played} (${form})`);
      ar.push(`${homeSide} لم يخسر في آخر ${fp.played} مباريات (${form})`);
    } else if (wins >= 3) {
      en.push(`${homeSide} won ${wins} of their last ${fp.played} (${form})`);
      ar.push(`${homeSide} فاز في ${wins} من آخر ${fp.played} مباريات (${form})`);
    } else if (losses >= 4) {
      en.push(`${homeSide} are winless in ${fp.played} — reflected in a cautious pick`);
      ar.push(`${homeSide} بلا فوز في ${fp.played} — لذلك جاء التوقع حذراً`);
    }
  }
  if (pos) {
    en.push(`sitting ${ordinal(pos.pos)} in the league`);
    ar.push(`يحتل المركز ${pos.pos} في الدوري`);
  }
  if (venuePPG !== null && venue.games >= 3) {
    if (isHome && venuePPG >= 2.0) { en.push('strong at home'); ar.push('قوي على ملعبه'); }
    else if (!isHome && venuePPG >= 1.7) { en.push('travel well'); ar.push('نتائج جيدة خارج الديار'); }
  }
  const xgSide = isHome ? parseFloat(m.xgH) : parseFloat(m.xgA);
  if (xgSide >= 1.8) {
    en.push(`averaging ${xgSide.toFixed(1)} expected goals`);
    ar.push(`بمعدل ${xgSide.toFixed(1)} هدف متوقع`);
  }
  if (sig.h2h && sig.h2h.total >= 2) {
    const d = sig.h2h;
    if ((isHome && d.h > d.a) || (!isHome && d.a > d.h)) {
      en.push(`won ${isHome ? d.h : d.a} of the last ${d.total} meetings`);
      ar.push(`فاز في ${isHome ? d.h : d.a} من آخر ${d.total} مواجهات`);
    } else if (d.d === d.total) {
      en.push('recent meetings keep ending level');
      ar.push('المواجهات الأخيرة تنتهي بالتعادل غالباً');
    }
  }
  if (pick.type === 'O25') { en.push('both attacks outscore their defences'); ar.push('هجوم الفريقين أقوى من الدفاع'); }
  if (pick.type === 'U35') { en.push('tight, low-scoring profile on both sides'); ar.push('الفريقان يلعبان بحذر هجومي'); }
  if (pick.type === 'BTTS') { en.push('both sides score and concede regularly'); ar.push('الفريقان يسجلان ويستقبلان باستمرار'); }
  if (pick.type === 'X') { en.push('evenly matched on every signal'); ar.push('تكافؤ واضح في كل المؤشرات'); }

  const pick2 = en.length > 2 ? [en[0], en[2 % en.length]] : en.slice(0, 2);
  const pickA = ar.length > 2 ? [ar[0], ar[2 % ar.length]] : ar.slice(0, 2);
  const joiners = ['. ', ' — ', '. '];
  let enText = pick2.slice(0, 2).join(joiners[h % 3]) + '.';
  let arText = pickA.slice(0, 2).join('، ') + '.';
  if (!enText || enText === '.') {
    enText = 'Model leans on season scoring rates; thin recent history.';
    arText = 'يميل النموذج لمعدلات التسجيل العامة؛ التاريخ الحديث محدود.';
  }
  enText += sig.voteAgree ? ' Models agree.' : ' Mixed signals — stake sized accordingly.';
  arText += sig.voteAgree ? ' النماذج متفقة.' : ' إشارات متضاربة — بحذر مناسب.';
  return { en: enText, ar: arText };
}

function prediction(fx, m, p, sig) {
  const an = analysis(fx, sig, p, m);
  const L = [];
  L.push(block('🇸🇦 <b>توقع المباراة</b>', '🇬🇧 <b>MATCH PREDICTION</b>'));
  L.push('');
  L.push(`⚽ <b>${esc(fx.home.toUpperCase())} vs ${esc(fx.away.toUpperCase())}</b>`);
  L.push(`🏆 ${esc(fx.league)}`);
  L.push(block(`🕐 الانطلاق: ${kickoffLine(fx.date)}`, `🕐 Kickoff: ${kickoffLine(fx.date)}`));
  L.push('');
  L.push(block(
    `🎯 التوقع: <b>${esc(p.labelAr)}</b>`,
    `🎯 Prediction: <b>${esc(p.labelEn)}</b>`
  ));
  L.push(block(
    `📊 الثقة: <b>${m.confidence}% (${p.band.ar})</b>`,
    `📊 Confidence: <b>${m.confidence}% (${p.band.en})</b>`
  ));
  if (sig.formH || sig.formA) {
    L.push(`🔥 Form: ${esc(fx.home)} ${esc(sig.formH || '—')} | ${esc(fx.away)} ${esc(sig.formA || '—')}`);
  }
  L.push(`⚽ Expected Goals: <b>${m.xgH} - ${m.xgA}</b>`);
  L.push('');
  L.push(block(`📌 التحليل: ${esc(an.ar)}`, `📌 Analysis: ${esc(an.en)}`));
  L.push('');
  L.push(block('📈 الاحتمالات:', '📈 Probabilities:'));
  L.push(`1️⃣ ${m.p1}% • ❌ ${m.px}% • 2️⃣ ${m.p2}%`);
  L.push(`🤝 BTTS: <b>${m.bttsYes}%</b> • 📊 Over 2.5: <b>${m.over25}%</b>`);
  L.push(`🎯 Score: <b>${esc(m.topScores[0].score)}</b> (${m.topScores[0].prob}%)`);
  L.push('');
  L.push(`<i>${block(
    'احتمالات إحصائية وليست ضمانات',
    'Statistical probabilities, not guarantees'
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
  L.push('💰🔥 <b>Prediction WIN</b> 💰🔥');
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
  L.push(block('⚠️ نبقى شفافين — القادم أفضل 💪', '⚠️ Transparency first — we go again 💪'));
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

module.exports = { prediction, resultWin, resultMiss, weeklyStats, analysis };
