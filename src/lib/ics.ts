import type { NearbyProject } from './types';
import { WORK_LABELS } from './format';

// Build a downloadable .ics calendar so a resident can see upcoming works in
// their own calendar app and plan around disruptions (the brief's last ask).
function icsDate(d: string): string {
  return d.replace(/-/g, '') ; // YYYYMMDD, all-day events
}

export function buildICS(label: string, projects: NearbyProject[]): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CivicSync//South Chennai//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:CivicSync — ${label}`,
  ];
  for (const p of projects) {
    // DTEND is exclusive for all-day events; add a day.
    const end = new Date(p.end_date + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    const dtend = icsDate(end.toISOString().slice(0, 10));
    lines.push(
      'BEGIN:VEVENT',
      `UID:${p.id}@civicsync`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(p.start_date)}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${escapeICS(`${WORK_LABELS[p.work_type]} — ${p.road_name}`)}`,
      `DESCRIPTION:${escapeICS(`${p.title} (${Math.round(p.distance_m)} m from ${label}). Status: ${p.status}.`)}`,
      `LOCATION:${escapeICS(p.road_name)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

const escapeICS = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
