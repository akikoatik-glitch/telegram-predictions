'use strict';
// Stadium-local kickoff times -> true UTC. openfootball times are local;
// without this, posts would land up to 2h off the 10-15 minute target.
// EU DST rule: last Sunday of March -> last Sunday of October.
function lastSunday(year, month) {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}
function euSummer(dateUTC) {
  const y = dateUTC.getUTCFullYear();
  return dateUTC >= lastSunday(y, 2) && dateUTC < lastSunday(y, 9);
}
// Offset in minutes EAST of UTC for a tz key on a given date.
function offsetMinutes(tz, ymd) {
  const probe = new Date(ymd + 'T12:00:00Z');
  switch (tz) {
    case 'Europe/London': return euSummer(probe) ? 60 : 0;
    case 'CET': return euSummer(probe) ? 120 : 60;   // ES IT DE FR NL (+BE, GR)
    case 'WET': return euSummer(probe) ? 60 : 0;     // PT
    case 'TRT': return 180;                          // TR, no DST
    case 'AST': return 180;                          // SA, no DST
    case 'Africa/Algiers': return 60;                // DZ, no DST
    case 'US-Eastern': return usSummer(probe) ? -240 : -300;
    case 'US-Central': return usSummer(probe) ? -300 : -360;
    case 'Brazil': return -180;                      // BRT, no DST
    case 'Argentina': return -180;                   // ART, no DST
    default: return 0;
  }
}
// US DST: second Sunday of March -> first Sunday of November.
function usSummer(dateUTC) {
  const y = dateUTC.getUTCFullYear();
  const secondSunMar = nthWeekday(y, 2, 0, 2);
  const firstSunNov = nthWeekday(y, 10, 0, 1);
  return dateUTC >= secondSunMar && dateUTC < firstSunNov;
}
function nthWeekday(year, month, dow, n) {
  const d = new Date(Date.UTC(year, month, 1));
  const shift = (dow - d.getUTCDay() + 7) % 7;
  d.setUTCDate(1 + shift + (n - 1) * 7);
  return d;
}
// Short label for display, e.g. 'Algiers'.
function displayLabel(tzKey) {
  const m = {
    'Africa/Algiers': 'Algiers', 'Europe/London': 'London', CET: 'CET',
    WET: 'WET', TRT: 'Istanbul', AST: 'Riyadh', 'US-Eastern': 'ET',
    'US-Central': 'CT', Brazil: 'BRT', Argentina: 'ART',
  };
  return m[tzKey] || 'UTC';
}
// 'YYYY-MM-DD' + 'HH:MM' local -> ISO UTC string.
function toUTC(dateStr, timeStr, tz) {
  const t = (timeStr || '15:00').trim().slice(0, 5);
  const off = offsetMinutes(tz, dateStr);
  const ms = Date.parse(`${dateStr}T${t}:00Z`) - off * 60000;
  return new Date(ms).toISOString();
}

// Display a UTC ISO time in another zone: 'YYYY-MM-DD HH:MM'.
function displayIn(isoUtc, tzKey) {
  const off = offsetMinutes(tzKey, isoUtc.slice(0, 10));
  const d = new Date(new Date(isoUtc).getTime() + off * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

module.exports = { toUTC, offsetMinutes, euSummer, displayLabel, displayIn };
