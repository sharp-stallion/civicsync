import { Link } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getMyReports } from '../services/reports';
import { CATEGORY_LABELS, formatDate } from '../lib/format';
import { PageHeading, Loading, ErrorPanel, EmptyState, Notice } from '../components/UI';
import { ReportBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

export default function MyReports() {
  const res = useResource('my-reports', getMyReports);
  return (
    <>
      <PageHeading eyebrow="Citizen voice" title="My reports" description="Everything you have reported, and how the department responded." />
      {res.loading && <Loading />}
      {res.error && <ErrorPanel message={res.error} retry={res.reload} />}
      {res.data && (res.data.length === 0
        ? <EmptyState icon="reports" title="No reports yet" description="Spotted something? Report it and track it here." />
        : res.data.map((r) => (
          <section className="panel" key={r.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="chips"><ReportBadge status={r.status} /><span className="badge status-planned">{CATEGORY_LABELS[r.category]}</span>{r.is_unregistered && <span className="badge conflict-lookahead_repeat">Unregistered dig</span>}</div>
                <h3 style={{ fontSize: 16, marginTop: 10 }}>{r.project ? r.project.title : (r.road_name || 'Unregistered digging')}</h3>
                <p style={{ color: 'var(--text-soft)', margin: '4px 0' }}>{r.description}</p>
              </div>
              <span className="field-hint">{formatDate(r.created_at)}</span>
            </div>
            {r.official_response
              ? <Notice tone="success"><strong>Department response:</strong> {r.official_response}</Notice>
              : <p className="field-hint" style={{ marginTop: 8 }}>No official response yet.</p>}
            {r.project && <Link className="text-link" to={`/projects/${r.project.id}`} style={{ fontSize: 13 }}>View the project <Icon name="arrow" size={13} /></Link>}
          </section>
        )))}
    </>
  );
}
