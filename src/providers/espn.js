'use strict';
// Provider: ESPN unofficial JSON API — free, no key, exact UTC kickoffs.
// Covers the first divisions missing elsewhere (Turkish Super Lig, Saudi
// Pro League; Belgian comes from be1.txt). Polite volume, per-league
// isolation, circuit breaker, teams regressed when thin.
const config = require('../config');

const UA = { 'User-Agent': 'Mozilla/5.0' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Circuit breaker: ESPN throttles per IP. If one call is throttled, the
// rest would be too — skip them instantly instead of burning minutes.
let circuitUntil = 0;

async function scoreboard(league, from, to, attempt = 1) {
  if (Date.now() < circuitUntil) {
    throw new Error(`ESPN circuit open (throttled earlier this run) — skipping ${league}`);
  }
  const ymd = (d) => d.toISOString().slice(0, 10);
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${ymd(from)}-${ymd(to)}`;
  const res = await fetch(url, { headers: UA });
  if ((res.status === 400 || res.status === 429) && attempt === 1) {
    console.log(`espn ${league}: throttled, waiting 180s before one retry`);
    await sleep(180000);
    return scoreboard(league, from, to, 2);
  }
  if (!res.ok) {
    if (res.status === 400 || res.status === 429) circuitUntil = Date.now() + 30 * 60000;
    throw new Error(`ESPN HTTP ${res.status} (${league})`);
  }
  return (await res.json()).events || [];
}

function plusDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function compOf(ev) {
  return ev.competitions && ev.competitions[0];
}
function isFinished(ev) {
  const c = compOf(ev);
  return !!(c && c.status && c.status.type && c.status.type.completed);
}
function teamsOf(ev) {
  const c = compOf(ev);
  const out = {};
  for (const t of (c.competitors || [])) {
    out[t.homeAway === 'home' ? 'h' : 'a'] = {
      name: (t.team.displayName || t.team.name || '').trim(),
      score: t.score != null ? parseInt(t.score, 10) : null,
    };
  }
  return out;
}

async function load() {
  const leagues = config.LEAGUES.filter((l) => l.espn && (!config.apiKey));
  // (With an API key, apifootball covers everything including these three.)
  const fixtures = [];
  const tables = {};
  const fetched = [];
  for (const lg of leagues) {
    try {
      const table = {};
      // Past 30 days -> recent results for team strength (1 call).
      const past = await scoreboard(lg.espn, plusDays(-30), plusDays(-1));
      for (const ev of past) {
        if (!isFinished(ev)) continue;
        const { h, a } = teamsOf(ev);
        if (!h || !a || h.score == null || a.score == null || !h.name || !a.name) continue;
        for (const [nm, gf, ga] of [[h.name, h.score, a.score], [a.name, a.score, h.score]]) {
          table[nm] = table[nm] || { played: 0, gf: 0, ga: 0 };
          table[nm].played++; table[nm].gf += gf; table[nm].ga += ga;
        }
      }
      await sleep(8000);
      // Next 7 days -> upcoming fixtures.
      const upcoming = await scoreboard(lg.espn, plusDays(0), plusDays(7));
      let up = 0;
      for (const ev of upcoming) {
        if (isFinished(ev)) continue;
        const { h, a } = teamsOf(ev);
        const c = compOf(ev);
        if (!h || !a || !h.name || !a.name || !c.date) continue;
        if (new Date(c.date).getTime() < Date.now() - 30 * 60000) continue; // stale
        fixtures.push({
          id: `espn-${ev.id}`,
          date: new Date(c.date).toISOString(),
          leagueId: 0,
          league: lg.name,
          home: h.name,
          away: a.name,
          source: 'espn',
        });
        up++;
      }
      tables[lg.name] = table;
      fetched.push(lg.name);
      console.log(`espn ${lg.name}: ${up} upcoming, ${Object.keys(table).length} teams rated`);
      await sleep(8000);
    } catch (e) {
      console.log(`espn ${lg.name}: SKIPPED (${e.message})`);
    }
  }
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { fixtures, tables, fetched };
}

// Scores for graded matches: {fixtureId: 'H-A'} for finished ones.
async function resultsFor(ids) {
  const mine = ids.filter((i) => i.startsWith('espn-'));
  if (!mine.length) return {};
  const want = new Map(mine.map((id) => [id.replace(/^espn-/, ''), id]));
  const out = {};
  const leagues = config.LEAGUES.filter((l) => l.espn);
  for (const lg of leagues) {
    if (want.size === 0) break;
    try {
      const evs = await scoreboard(lg.espn, plusDays(-4), plusDays(0));
      for (const ev of evs) {
        const full = 'espn-' + ev.id;
        if (!want.has(ev.id) || !isFinished(ev)) continue;
        const { h, a } = teamsOf(ev);
        if (h.score == null || a.score == null) continue;
        out[full] = `${h.score}-${a.score}`;
        want.delete(ev.id);
      }
    } catch (e) {
      console.log(`espn results ${lg.name}: SKIPPED (${e.message})`);
    }
    await sleep(8000);
  }
  return out;
}

module.exports = { load, resultsFor };
