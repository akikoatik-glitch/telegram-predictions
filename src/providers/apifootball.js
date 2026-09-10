'use strict';
// Provider: API-Football (api-sports.io). Exact UTC times, standings,
// H2H, odds. Activates automatically when API_FOOTBALL_KEY is set;
// otherwise the free openfootball provider is used. Same cache shape.
const config = require('../config');

async function call(path) {
  if (!config.apiKey) throw new Error('API_FOOTBALL_KEY is missing');
  const res = await fetch(config.apiBase + path, {
    headers: { 'x-apisports-key': config.apiKey },
  });
  if (res.status === 429) throw new Error('API rate limit hit (429) — backing off');
  if (!res.ok) throw new Error('API error ' + res.status + ' on ' + path);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error('API errors: ' + JSON.stringify(json.errors));
  }
  return json.response || [];
}

function seasonYear() {
  const m = String(config.season).match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : 2025;
}

async function fixtures(from, to) {
  const out = [];
  for (const lg of config.LEAGUES) {
    if (!lg.apiId) continue;
    try {
      for (const date of eachDay(from, to)) {
        const rows = await call(
          `/fixtures?league=${lg.apiId}&season=${seasonYear()}&date=${date}&status=NS`
        );
        for (const f of rows) {
          out.push({
            id: `api-${f.fixture.id}`,
            date: new Date(f.fixture.date).toISOString(),
            leagueId: lg.apiId,
            league: lg.name,
            home: f.teams.home.name,
            away: f.teams.away.name,
            source: 'api-football',
          });
        }
      }
      console.log(`api-football ${lg.name}: fixtures ok`);
    } catch (e) {
      console.log(`api-football ${lg.name}: SKIPPED (${e.message})`);
    }
  }
  out.sort((a, b) => new Date(a.date) - new Date(b.date));
  return out;
}

async function standings() {
  const tables = {};
  for (const lg of config.LEAGUES) {
    if (!lg.apiId) continue;
    try {
      const rows = await call(`/standings?league=${lg.apiId}&season=${seasonYear()}`);
      const table = (rows[0] && rows[0].league && rows[0].league.standings && rows[0].league.standings[0]) || [];
      const teams = {};
      for (const row of table) {
        teams[row.team.name] = {
          played: row.all.played || 0,
          gf: row.all.goals.for || 0,
          ga: row.all.goals.against || 0,
        };
      }
      tables[lg.name] = teams;
    } catch (e) {
      console.log(`api-football standings ${lg.name}: SKIPPED (${e.message})`);
      tables[lg.name] = tables[lg.name] || {};
    }
  }
  return tables;
}

// Scores for graded matches: {fixtureId: 'H-A'} for finished ones.
async function resultsFor(ids) {
  const out = {};
  const apiIds = ids.filter((i) => i.startsWith('api-')).map((i) => i.slice(4));
  for (let k = 0; k < apiIds.length; k += 20) {
    const chunk = apiIds.slice(k, k + 20);
    try {
      const rows = await call(`/fixtures?ids=${chunk.join('-')}`);
      for (const f of rows) {
        const st = f.fixture.status && f.fixture.status.short;
        if (['FT', 'AET', 'PEN'].includes(st) && f.goals.home != null) {
          out[`api-${f.fixture.id}`] = `${f.goals.home}-${f.goals.away}`;
        }
      }
    } catch (e) {
      console.log(`api-football results chunk: SKIPPED (${e.message})`);
    }
  }
  return out;
}

async function load(from, to) {
  return { fixtures: await fixtures(from, to), tables: await standings() };
}

function eachDay(from, to) {
  const days = [];
  const d = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function todayPlus(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { load, resultsFor, todayPlus };
