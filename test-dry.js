'use strict';
// Offline self-test: model sanity + bilingual formatting, zero secrets.
const model = require('./src/model');
const format = require('./src/format');

const table = {
  'Arsenal': { played: 10, gf: 24, ga: 9 },
  'Chelsea': { played: 10, gf: 19, ga: 14 },
  'Napoli': { played: 10, gf: 21, ga: 11 },
  'Inter': { played: 10, gf: 23, ga: 8 },
};
const assert = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; };

const p = model.predict('Arsenal', 'Chelsea', table);
assert('1X2 sums to ~100', Math.abs(p.p1 + p.px + p.p2 - 100) <= 2);
assert('confidence 40..90', p.confidence >= 40 && p.confidence <= 90);
assert('favourite is a team', ['1', 'X', '2'].includes(p.pick));
assert('score looks like N-N', /^\d+-\d+$/.test(p.score));

const fx = { id: 1, date: new Date(Date.now() + 2 * 3600e3).toISOString(), league: 'Premier League', home: 'Arsenal', away: 'Chelsea' };
const msg = format.format(fx, p);
assert('has English header', msg.includes('Match Prediction'));
assert('has Arabic header', msg.includes('توقعات المباراة'));
assert('has disclaimer', msg.includes('18+'));
assert('no guarantee language', !/100%|guaranteed/i.test(msg));
console.log('\n--- sample message (tags stripped) ---\n' + msg.replace(/<[^>]+>/g, ''));
