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
    case 'CET': return euSummer(probe) ? 120 : 60;   // ES IT DE FR NL (+BE)
    case 'WET': return euSummer(probe) ? 60 : 0;     // PT
    case 'TRT': return 180;                          // TR, no DST
    case 'AST': return 180;                          // SA, no DST
    default: return 0;
  }
}
// 'YYYY-MM-DD' + 'HH:MM' local -> ISO UTC string.
function toUTC(dateStr, timeStr, tz) {
  const t = (timeStr || '15:00').trim().slice(0, 5);
  const off = offsetMinutes(tz, dateStr);
  const ms = Date.parse(`${dateStr}T${t}:00Z`) - off * 60000;
  return new Date(ms).toISOString();
}

module.exports = { toUTC, offsetMinutes, euSummer };
