'use strict';
// Provider: openfootball/football.json — free, public domain, no key.
// Supplies fixtures (stadium-local times, normalized to UTC) + team
// strength tables built from real played results. Leagues without a file
// (or a missing season file) are skipped loudly, never guessed.
const config = require('../config');
const tz = require('../tz');

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function isPlayed(m) {
  return !!(m.score && Array.isArray(m.score.ft));
}

async function load() {
  const fixtures = [];
  const tables = {};
  const missing = [];
  for (const lg of config.LEAGUES) {
    if (!lg.file) { missing.push(`${lg.name} (needs API key)`); continue; }
    const url = `${config.ofBase}${config.season}/${lg.file}.json`;
    let res;
    try { res = await fetch(url); } catch (e) { missing.push(`${lg.name} (network: ${e.message})`); continue; }
    if (!res.ok) { missing.push(`${lg.name} (HTTP ${res.status} — file not published yet?)`); continue; }
    const json = await res.json();
    const table = {};
    let up = 0, done = 0;
    for (const m of (json.matches || [])) {
      const ht = (m.team1 || '').trim(), at = (m.team2 || '').trim();
      if (!ht || !at || !m.date) continue;
      if (isPlayed(m)) {
        done++;
        const [hg, ag] = m.score.ft;
        for (const [nm, gf, ga] of [[ht, hg, ag], [at, ag, hg]]) {
          table[nm] = table[nm] || { played: 0, gf: 0, ga: 0 };
          table[nm].played++; table[nm].gf += gf; table[nm].ga += ga;
        }
      } else {
        up++;
        fixtures.push({
          id: `of-${lg.file}-${m.date}-${(m.time || '15:00').trim()}-${slug(ht)}-v-${slug(at)}`,
          date: tz.toUTC(m.date, m.time, lg.tz),
          leagueId: 0,
          league: lg.name,
          home: ht,
          away: at,
          source: 'openfootball',
        });
      }
    }
    tables[lg.name] = table;
    console.log(`openfootball ${lg.name}: ${up} upcoming, ${done} played`);
  }
  if (missing.length) console.log('unavailable without API key: ' + missing.join(' | '));
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { fixtures, tables };
}

// Re-read finished scores for grading: returns {fixtureId: 'H-A'} for
// matches in `ids` that now have a real full-time score.
async function resultsFor(ids) {
  const want = new Set(ids);
  const out = {};
  for (const lg of config.LEAGUES) {
    if (!lg.file || want.size === 0) continue;
    let json;
    try {
      const res = await fetch(`${config.ofBase}${config.season}/${lg.file}.json`);
      if (!res.ok) continue;
      json = await res.json();
    } catch { continue; }
    for (const m of (json.matches || [])) {
      if (!isPlayed(m)) continue;
      const id = `of-${lg.file}-${m.date}-${(m.time || '15:00').trim()}-${slug((m.team1 || '').trim())}-v-${slug((m.team2 || '').trim())}`;
      if (want.has(id)) {
        // NOTE: id embeds the file's local time; the cached fixture id was
        // built identically, so they match. Map to canonical cached id below.
        out[id] = `${m.score.ft[0]}-${m.score.ft[1]}`;
        want.delete(id);
      }
    }
  }
  return out;
}

module.exports = { load, resultsFor };
