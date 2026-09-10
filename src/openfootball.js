'use strict';
// No-signup data source: openfootball/football.json (public domain).
// Season schedules + results for 8 top leagues. Times are stadium-local,
// so the posting window is intentionally wide — posts still land before
// every match. Needs ZERO api keys.
const BASE = 'https://raw.githubusercontent.com/openfootball/football.json/master/2025-26/';

const FILES = [
  { code: 'en.1', league: 'Premier League' },
  { code: 'es.1', league: 'La Liga' },
  { code: 'it.1', league: 'Serie A' },
  { code: 'de.1', league: 'Bundesliga' },
  { code: 'fr.1', league: 'Ligue 1' },
  { code: 'nl.1', league: 'Eredivisie' },
  { code: 'pt.1', league: 'Primeira Liga' },
  { code: 'tr.1', league: 'Süper Lig' },
];

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function load() {
  const fixtures = [];
  const tables = {};
  for (const f of FILES) {
    const res = await fetch(BASE + f.code + '.json');
    if (!res.ok) { console.log(`openfootball ${f.league}: HTTP ${res.status}, skipped`); continue; }
    const json = await res.json();
    const table = {};
    let up = 0, done = 0;
    for (const m of (json.matches || [])) {
      const ht = (m.team1 || '').trim(), at = (m.team2 || '').trim();
      if (!ht || !at || !m.date) continue;
      const time = (m.time || '15:00').trim();
      if (m.score && Array.isArray(m.score.ft)) {
        done++;
        const [hg, ag] = m.score.ft;
        for (const [nm, gf, ga] of [[ht, hg, ag], [at, ag, hg]]) {
          table[nm] = table[nm] || { played: 0, gf: 0, ga: 0 };
          table[nm].played++; table[nm].gf += gf; table[nm].ga += ga;
        }
      } else {
        up++;
        fixtures.push({
          id: `of-${f.code}-${m.date}-${time}-${slug(ht)}-v-${slug(at)}`,
          date: `${m.date}T${time.length === 5 ? time : '15:00'}:00Z`,
          leagueId: 0,
          league: f.league,
          home: ht,
          away: at,
        });
      }
    }
    tables[f.league] = table;
    console.log(`openfootball ${f.league}: ${up} upcoming, ${done} played`);
  }
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { fixtures, tables };
}

module.exports = { load, FILES };
