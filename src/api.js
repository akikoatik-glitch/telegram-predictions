'use strict';
// Minimal API-Football client (native fetch, zero dependencies).
const config = require('./config');

async function call(path) {
  if (!config.apiKey) throw new Error('API_FOOTBALL_KEY is missing');
  const res = await fetch(config.apiBase + path, {
    headers: { 'x-apisports-key': config.apiKey },
  });
  if (res.status === 429) throw new Error('API rate limit hit (429) — will retry next run');
  if (!res.ok) throw new Error('API error ' + res.status + ' on ' + path);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error('API errors: ' + JSON.stringify(json.errors));
  }
  return json.response || [];
}

// Upcoming (not started) fixtures for one league in a date window.
async function fixtures(leagueId, from, to) {
  const out = [];
  for (const date of eachDay(from, to)) {
    const rows = await call(
      `/fixtures?league=${leagueId}&season=${config.season}&date=${date}&status=NS`
    );
    for (const f of rows) {
      out.push({
        id: f.fixture.id,
        date: f.fixture.date, // ISO with timezone
        leagueId,
        league: f.league.name,
        home: f.teams.home.name,
        away: f.teams.away.name,
      });
    }
  }
  return out;
}

// League table -> per-team attack/defence form. Missing teams regress to average.
async function standings(leagueId) {
  const rows = await call(`/standings?league=${leagueId}&season=${config.season}`);
  const table = (rows[0] && rows[0].league && rows[0].league.standings && rows[0].league.standings[0]) || [];
  const teams = {};
  for (const row of table) {
    const played = row.all.played || 0;
    teams[row.team.name] = {
      played,
      gf: row.all.goals.for || 0,
      ga: row.all.goals.against || 0,
    };
  }
  return teams;
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

module.exports = { fixtures, standings, todayPlus };
