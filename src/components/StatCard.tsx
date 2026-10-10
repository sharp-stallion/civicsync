import { Icon, type IconName } from './Icon';

export function StatCard({ label, value, note, icon, tone }: { label: string; value: number | string; note?: string; icon: IconName; tone?: 'warn' | 'good' }) {
  return (
    <div className={`stat-card ${tone ?? ''}`}>
      <div className="sc-top">
        <span className="stat-label">{label}</span>
        <span className="sc-icon"><Icon name={icon} size={18} /></span>
      </div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
