'use strict';
// Local admin: prints performance stats. `npm run stats`.
// With --md it also writes STATS.md (committed by the results job).
const fs = require('fs');
const db = require('./src/db');

function main() {
  const st = db.getStats();
  const acc = st.total > 0 ? ((st.correct / st.total) * 100).toFixed(1) : '—';
  const line = (k, v) => `  ${k}: ${v.correct}/${v.total} (${((v.correct / v.total) * 100).toFixed(1)}%)`;
  const out = [];
  out.push('📊 BOT PERFORMANCE');
  out.push(`Total: ${st.total} | Correct: ${st.correct} | Missed: ${st.incorrect} | Accuracy: ${acc}%`);
  out.push('\n— by league —');
  for (const [k, v] of Object.entries(st.byLeague)) out.push(line(k, v));
  out.push('\n— by pick type —');
  for (const [k, v] of Object.entries(st.byType)) out.push(line(k, v));
  out.push('\n— by confidence band —');
  for (const [k, v] of Object.entries(st.byBand)) out.push(line(k, v));
  out.push('\n— last days —');
  for (const [k, v] of Object.entries(st.byDay).sort().slice(-7)) out.push(line(k, v));
  console.log(out.join('\n'));
  if (process.argv.includes('--md')) {
    fs.writeFileSync(
      require('path').join(__dirname, 'STATS.md'),
      '# 📊 Bot performance\n\n```\n' + out.join('\n') + '\n```\n\n_Updated automatically after every results check._\n'
    );
    console.log('\nSTATS.md written');
  }
}
main();
