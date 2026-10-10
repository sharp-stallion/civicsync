import type { ProjectStatus, ConflictType, ReportStatus } from '../lib/types';
import { STATUS_LABELS, CONFLICT_TYPE_LABELS, REPORT_STATUS_LABELS } from '../lib/format';

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function ConflictBadge({ type }: { type: ConflictType }) {
  return <span className={`badge conflict-${type}`}>{CONFLICT_TYPE_LABELS[type]}</span>;
}

export function ReportBadge({ status }: { status: ReportStatus }) {
  return <span className={`badge report-${status}`}>{REPORT_STATUS_LABELS[status]}</span>;
}
