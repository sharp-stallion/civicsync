import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useResource } from '../hooks/useResource';
import { getDashboardStats, getConflicts } from '../services/conflicts';
import { getProjects, getProjectsByIds } from '../services/projects';
import { useAuth, isStaff } from '../context/AuthContext';
import { PageHeading, Loading, ErrorPanel, Button, EmptyState } from '../components/UI';
import { StatCard } from '../components/StatCard';
import { Map } from '../components/Map';
import { StatusBadge, ConflictBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { WORK_LABELS, formatDate } from '../lib/format';
import { CONFLICT_TYPE_LABELS } from '../lib/format';

export default function Dashboard() {
  const { profile, userId } = useAuth();
  const { t } = useTranslation();
  const res = useResource('dashboard', async () => {
    const [stats, mapped, recent, conflicts] = await Promise.all([
      getDashboardStats(),
      getProjects({ limit: 200 }),
      getProjects({ limit: 6 }),
      getConflicts({ status: 'open', currentOnly: true }),
    ]);
    const related = await getProjectsByIds(conflicts.flatMap((c) => [c.project_a_id, c.project_b_id]));
    return { stats, mapped, recent, conflicts: conflicts.slice(0, 4), related };
  }, { pollMs: 60000 });

  const d = res.data;
  const projName = (id: string) => d?.related.find((p) => p.id === id)?.title ?? 'Project';

  return (
    <>
      <PageHeading
        eyebrow={t('dash.eyebrow')}
        title={t('dash.title')}
        description={t('dash.subtitle')}
        actions={
          <>
            <Button variant="secondary" onClick={res.reload} disabled={res.loading}><Icon name="refresh" size={16} />{t('common.refresh')}</Button>
            <Link className="btn btn-primary" to={isStaff(profile) ? '/projects/new' : '/report'}>
              <Icon name="plus" size={17} />{isStaff(profile) ? 'Register project' : 'Report an issue'}
            </Link>
          </>
        }
      />
      {!userId && (
        <div className="guest-hero">
          <div>
            <strong style={{ fontSize: 16 }}>You're browsing as a guest.</strong>
            <p>Anyone can explore works, the map and the demand board. Sign in to report issues, raise demands and vote.</p>
          </div>
          <Link to="/sign-in" className="btn">Sign in / Create account</Link>
        </div>
      )}
      {res.loading && <Loading />}
      {res.error && <ErrorPanel message={res.error} retry={res.reload} />}
      {d && (
        <>
          <section className="stats-grid">
            <StatCard label={t('dash.total')} value={d.stats.total_projects} note="Across South Chennai" icon="projects" />
            <StatCard label={t('dash.active')} value={d.stats.active_projects} note="Planned, ongoing or delayed" icon="clock" />
            <StatCard label={t('dash.reports')} value={d.stats.open_reports} note="From residents, awaiting review" icon="reports" />
            <StatCard label={t('dash.coordination')} value={d.stats.open_conflicts} note="Open Dig-Once overlaps" icon="layers" tone="warn" />
          </section>

          <div className="dash-grid">
            <section className="panel">
              <div className="section-heading">
                <div><h2>Works across South Chennai</h2><p>Up to 200 saved locations — click a marker for details</p></div>
                <Link className="text-link" to="/projects?view=map">Full map <Icon name="arrow" size={14} /></Link>
              </div>
              <Map projects={d.mapped} height={380} />
            </section>

            <div>
              <section className="hero-impact">
                <h2>Repeat digs prevented</h2>
                <div className="big">{d.stats.repeat_digs_prevented}</div>
                <p>Times a resurfaced road was saved from being cut open again, because a look-ahead alert was coordinated. Assumes ≈₹8–12 L of rework avoided each.</p>
              </section>

              <section className="panel" style={{ marginTop: 20 }}>
                <div className="section-heading"><div><h2>Needs coordination</h2></div><Link className="text-link" to="/conflicts">All <Icon name="arrow" size={14} /></Link></div>
                {d.conflicts.length === 0 ? (
                  <EmptyState icon="check" title="No open overlaps" description="Nothing needs coordination right now." />
                ) : (
                  <div>
                    {d.conflicts.map((c) => (
                      <div key={c.id} className={`conflict-card ${c.conflict_type === 'lookahead_repeat' ? 'lookahead' : ''}`} style={{ boxShadow: 'none', marginBottom: 10, padding: 14 }}>
                        <ConflictBadge type={c.conflict_type} />
                        <div className="conflict-pair" style={{ margin: '8px 0 0' }}>
                          <span className="pair-proj">{projName(c.project_a_id)}</span>
                          <span className="vs">×</span>
                          <span className="pair-proj">{projName(c.project_b_id)}</span>
                        </div>
                      </div>
                    ))}
                    <Link className="btn btn-secondary full" to="/conflicts" style={{ marginTop: 6 }}>Review in Dig-Once</Link>
                  </div>
                )}
              </section>
            </div>
          </div>

          <section className="panel" style={{ marginTop: 20 }}>
            <div className="section-heading"><div><h2>Recently registered</h2></div><Link className="text-link" to="/projects">All projects <Icon name="arrow" size={14} /></Link></div>
            <table className="table">
              <thead><tr><th>Project</th><th>Road</th><th>Type</th><th>Status</th><th>Window</th></tr></thead>
              <tbody>
                {d.recent.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/projects/${p.id}`}>{p.title}</Link></td>
                    <td>{p.road_name}</td>
                    <td>{WORK_LABELS[p.work_type]}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{formatDate(p.start_date)} – {formatDate(p.revised_end_date ?? p.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="field-hint" style={{ marginTop: 10 }}>{CONFLICT_TYPE_LABELS.lookahead_repeat} alerts are the heart of Dig-Once: they catch a dig scheduled soon after a resurfacing on the same stretch.</p>
        </>
      )}
    </>
  );
}
