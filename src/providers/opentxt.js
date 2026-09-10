'use strict';
// Provider: openfootball per-country .txt schedules (e.g. Belgium be1.txt).
// Free, public domain, no key. Only matches with an explicit date AND
// kickoff time are used — timeless fixtures are counted and skipped
// (posting at an invented time would be worse than skipping).
const config = require('../config');
const tz = require('../tz');

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Parses classic openfootball text format into {fixtures, table}.
// Fixture ids embed local date+time+teams (stable across re-fetches);
// kickoffs normalized to UTC via the league tz.
function parse(text, lg) {
  const baseYear = parseInt((text.match(/=\s*[^\n]*?(\d{4})\/\d{2}/) || [])[1] || '2026', 10);
  const fixtures = [];
  const table = {};
  const history = [];
  const results = {}; // fixtureId -> 'H-A' for played matches
  const idOf = (dateStr, time, ht, at) =>
    `txt-${lg.key}-${dateStr}-${time}-${slug(ht)}-v-${slug(at)}`;
  let skippedTimeless = 0;
  let cur = null; // {y,m,d}
  const bump = (nm, gf, ga) => {
    table[nm] = table[nm] || { played: 0, gf: 0, ga: 0 };
    table[nm].played++; table[nm].gf += gf; table[nm].ga += ga;
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#') || line.trim().startsWith('=')) continue;
    const dm = line.match(/^\s{2,4}(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Za-z]{3})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/);
    if (dm) {
      const mon = MONTHS[dm[2]];
      if (mon === undefined) { cur = null; continue; }
      const year = dm[4] ? parseInt(dm[4], 10) : (mon < 7 ? baseYear + 1 : baseYear);
      cur = { y: year, m: mon, d: parseInt(dm[3], 10) };
      continue;
    }
    const mm = line.match(/^\s{4,}(?:(\d{1,2}[:.]\d{2})\s+)?(.+?)\s+v\s+(.+?)\s*$/);
    if (mm && cur) {
      const time = mm[1] ? mm[1].replace('.', ':') : null;
      let rest = mm[3];
      let score = null;
      const sm = rest.match(/^(.*?)\s+(\d{1,2})-(\d{1,2})\s*$/);
      if (sm) { rest = sm[1]; score = [parseInt(sm[2], 10), parseInt(sm[3], 10)]; }
      const ht = mm[2].trim(), at = rest.trim();
      if (!ht || !at) continue;
      const p = (n) => String(n).padStart(2, '0');
      const dateStr = `${cur.y}-${p(cur.m + 1)}-${p(cur.d)}`;
      if (score) {
        bump(ht, score[0], score[1]);
        bump(at, score[1], score[0]);
        history.push({ d: dateStr, h: ht, a: at, hg: score[0], ag: score[1] });
        results[idOf(dateStr, time || '15:00', ht, at)] = `${score[0]}-${score[1]}`;
      } else if (time) {
        fixtures.push({
          id: idOf(dateStr, time, ht, at),
          date: tz.toUTC(dateStr, time, lg.tz),
          leagueId: 0,
          league: lg.name,
          home: ht,
          away: at,
          source: 'opentxt',
        });
      } else {
        skippedTimeless++;
      }
    }
  }
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { fixtures, table, results, history, skippedTimeless };
}

async function load() {
  const leagues = config.LEAGUES.filter((l) => l.txt && (!config.apiKey || !l.apiId));
  const fixtures = [];
  const tables = {};
  const history = {};
  for (const lg of leagues) {
    try {
      const url = `https://raw.githubusercontent.com/${lg.txt.repo}/master/${config.season}/${lg.txt.file}`;
      const res = await fetch(url);
      if (!res.ok) { console.log(`opentxt ${lg.name}: HTTP ${res.status} (not published yet?)`); continue; }
      const { fixtures: fx, table, history: hist, skippedTimeless } = parse(await res.text(), lg);
      fixtures.push(...fx);
      tables[lg.name] = table;
      history[lg.name] = hist;
      console.log(`opentxt ${lg.name}: ${fx.length} upcoming, timeless skipped: ${skippedTimeless}`);
    } catch (e) {
      console.log(`opentxt ${lg.name}: SKIPPED (${e.message})`);
    }
  }
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { fixtures, tables, history };
}

// Scores for graded matches by re-reading the file: played lines carry
// the same stable id as the upcoming fixture had, so they join exactly.
async function resultsFor(ids) {
  const mine = ids.filter((i) => i.startsWith('txt-'));
  if (!mine.length) return {};
  const want = new Set(mine);
  const out = {};
  const leagues = config.LEAGUES.filter((l) => l.txt);
  for (const lg of leagues) {
    const relevant = mine.filter((id) => id.startsWith(`txt-${lg.key}-`));
    if (!relevant.length) continue;
    try {
      const url = `https://raw.githubusercontent.com/${lg.txt.repo}/master/${config.season}/${lg.txt.file}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const { results } = parse(await res.text(), lg);
      for (const id of relevant) {
        if (results[id]) { out[id] = results[id]; want.delete(id); }
      }
    } catch { /* skip league this round */ }
    if (want.size === 0) break;
  }
  return out;
}

module.exports = { load, resultsFor, parse };
