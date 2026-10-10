import { useResource } from '../hooks/useResource';
import { getScorecard } from '../services/scorecard';
import type { ScorecardRow } from '../lib/types';
import { PageHeading, Loading, ErrorPanel, EmptyState } from '../components/UI';
import { StatCard } from '../components/StatCard';

function pctClass(v: number | null): string {
  if (v == null) return 'brand';
  return v >= 80 ? 'good' : v >= 50 ? 'mid' : 'bad';
}

function Bar({ label, value, suffix = '%', cls }: { label: string; value: number | null; suffix?: string; cls?: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track"><div className={`bar-fill ${cls ?? pctClass(value)}`} style={{ width: `${pct}%` }} /></div>
      <span className="bar-val">{value == null ? '—' : `${value}${suffix}`}</span>
    </div>
  );
}

export default function Scoreboard() {
  const res = useResource('scorecard', getScorecard);
  const rows = res.data ?? [];
  const active = rows.filter((r) => r.active + r.completed > 0);

  const totalCompleted = rows.reduce((s, r) => s + r.completed, 0);
  const totalActive = rows.reduce((s, r) => s + r.active, 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0);
  const onTimeVals = rows.map((r) => r.on_time_pct).filter((v): v is number => v != null);
  const avgOnTime = onTimeVals.length ? Math.round(onTimeVals.reduce((a, b) => a + b, 0) / onTimeVals.length) : null;
  const maxActive = Math.max(1, ...rows.map((r) => r.active));

  return (
    <>
      <PageHeading eyebrow="Accountability" title="Department scoreboard"
        description="How each department is performing on the works residents can see — on-time delivery, delays and how quickly they respond to reports." />
      {res.loading && <Loading />}
      {res.error && <ErrorPanel message={res.error} retry={res.reload} />}

      {res.data && (active.length === 0
        ? <EmptyState icon="chart" title="No data yet" description="Scores appear once departments register and complete works." />
        : (
          <>
            <section className="score-kpis">
              <StatCard label="Completed works" value={totalCompleted} icon="check" tone="good" />
              <StatCard label="Active works" value={totalActive} icon="clock" />
              <StatCard label="Overdue" value={totalOverdue} icon="alert" tone={totalOverdue > 0 ? 'warn' : undefined} />
              <StatCard label="Avg on-time rate" value={avgOnTime == null ? '—' : `${avgOnTime}%`} icon="chart" />
            </section>

            {active.sort((a, b) => (b.on_time_pct ?? -1) - (a.on_time_pct ?? -1)).map((r: ScorecardRow) => (
              <section className="score-dept" key={r.department_id}>
                <h3>{r.department_name}<span className="count">{r.active} active · {r.completed} completed{r.overdue > 0 ? ` · ${r.overdue} overdue` : ''}</span></h3>
                <Bar label="On-time delivery" value={r.on_time_pct} />
                <Bar label="Report response" value={r.report_response_pct} />
                <Bar label="Workload" value={Math.round((r.active / maxActive) * 100)} suffix="" cls="brand" />
                <div className="bar-row" style={{ gridTemplateColumns: '120px 1fr' }}>
                  <span className="bar-label">Avg delay</span>
                  <span style={{ fontWeight: 600 }}>{r.avg_delay_days != null ? `${r.avg_delay_days} days` : '—'}{r.reports_received ? ` · ${r.reports_received} reports received` : ''}</span>
                </div>
              </section>
            ))}
            <p className="field-hint" style={{ marginTop: 10 }}>On-time = completed on or before the planned end date. Response = share of reports marked resolved or dismissed. Workload = active works relative to the busiest department.</p>
          </>
        ))}
    </>
  );
}
