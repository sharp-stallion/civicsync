import { useResource } from '../hooks/useResource';
import { enrichLocation } from '../services/enrich';
import { getScorecard } from '../services/scorecard';
import { predictDelayRisk } from '../lib/predict';
import type { Project } from '../lib/types';
import { Icon } from './Icon';

// Surfaces the delay-risk prediction on a project. Inputs (weather + the
// department's on-time rate) are cached, so this is cheap to render.
export function PredictionCard({ project }: { project: Project }) {
  const res = useResource(`predict:${project.id}`, async () => {
    const [enr, scores] = await Promise.all([
      enrichLocation(project.latitude, project.longitude),
      getScorecard(),
    ]);
    const dept = scores.find((s) => s.department_id === project.department_id);
    return predictDelayRisk({ project, deptOnTimePct: dept?.on_time_pct ?? null, rainMm3d: enr.weather?.rainMm ?? null });
  });

  if (project.status === 'completed' || project.status === 'cancelled') return null;
  if (res.loading || !res.data) return null;
  const p = res.data;

  return (
    <div className={`predict-card predict-${p.band}`}>
      <div className="predict-head"><Icon name="chart" size={15} /> Predicted delay risk</div>
      <div className="predict-meter"><div className="predict-fill" style={{ width: `${p.score}%` }} /></div>
      <div><span className="predict-band">{p.band.toUpperCase()}</span> · {p.score} / 100</div>
      <ul className="predict-reasons">{p.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      <span className="enrich-src">Heuristic estimate from schedule, department record and live weather — not a guarantee.</span>
    </div>
  );
}
