function parts(iso, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

export function localDate(iso, tz) {
  const p = parts(iso, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localTime(iso, tz) {
  const p = parts(iso, tz);
  return `${p.hour}:${p.minute}`;
}

// Whole calendar days from `today` to `date`, both 'YYYY-MM-DD'.
export function daysUntil(date, today) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

export function addDays(iso, days) {
  return new Date(Date.parse(iso) + days * 86400000).toISOString();
}

export function addMinutes(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}
