import type { ProjectStatus, WorkType, ReportCategory, ReportStatus, ConflictType } from './types';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  ongoing: 'In progress',
  delayed: 'Delayed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const WORK_LABELS: Record<WorkType, string> = {
  road_repair: 'Road / resurfacing',
  water_pipeline: 'Water pipeline',
  sewer_drainage: 'Sewer / drainage',
  electricity: 'Electricity',
  telecom: 'Telecom / fibre',
  gas: 'Gas',
  stormwater: 'Stormwater drain',
  other: 'Other',
};

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  quality: 'Poor quality of work',
  safety: 'Safety hazard',
  delay: 'Delay / no progress',
  damage: 'Damage to property',
  unregistered_work: 'Unregistered digging',
  other: 'Other',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  schedule_overlap: 'Overlapping schedules',
  lookahead_repeat: 'Repeat-dig risk',
  proximity: 'Nearby works',
};

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function daysLate(endDate: string): number {
  const end = new Date(endDate + 'T00:00:00').getTime();
  return Math.floor((Date.now() - end) / 86_400_000);
}

export function formatINR(n: number | null): string {
  if (n == null) return '—';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export const humanize = (s: string): string =>
  s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
