import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { useDebounced } from '../hooks/useDebounced';
import { getProjects, getDepartments } from '../services/projects';
import { useAuth, isStaff } from '../context/AuthContext';
import { PROJECT_STATUSES, WORK_TYPES, type ProjectStatus, type WorkType } from '../lib/types';
import { STATUS_LABELS, WORK_LABELS, formatDate } from '../lib/format';
import { PageHeading, Loading, ErrorPanel, EmptyState } from '../components/UI';
import { Map } from '../components/Map';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const q = params.get('q') ?? '';
  const search = useDebounced(q);
  const status = (PROJECT_STATUSES.includes(params.get('status') as ProjectStatus) ? params.get('status') : '') as ProjectStatus | '';
  const work = (WORK_TYPES.includes(params.get('work') as WorkType) ? params.get('work') : '') as WorkType | '';
  const dept = params.get('dept') ?? '';
  const mapView = params.get('view') === 'map';

  const set = (k: string, v: string) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n, { replace: k === 'q' }); };

  const res = useResource(`projects:${search}:${status}:${work}:${dept}:${mapView}`, async () => {
    const [projects, departments] = await Promise.all([
      getProjects({ search, status, workType: work, departmentId: dept, limit: mapView ? 400 : 60 }),
      getDepartments(),
    ]);
    return { projects, departments };
  });

  return (
    <>
      <PageHeading eyebrow="Public works" title="Project register"
        description="Find a project, see its official timeline and understand what is happening on your road."
        actions={isStaff(profile) && <Link to="/projects/new" className="btn btn-primary"><Icon name="plus" size={17} />Register project</Link>} />

      <section className="panel">
        <div className="filter-bar">
          <div className="search">
            <Icon name="search" size={16} />
            <input placeholder="Search title, road or area…" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search projects" />
          </div>
          <select value={status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={work} onChange={(e) => set('work', e.target.value)} aria-label="Work type">
            <option value="">All work types</option>
            {WORK_TYPES.map((w) => <option key={w} value={w}>{WORK_LABELS[w]}</option>)}
          </select>
          <select value={dept} onChange={(e) => set('dept', e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {res.data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="view-switch" role="group" aria-label="View">
            <button className={!mapView ? 'on' : ''} onClick={() => set('view', '')} aria-label="List"><Icon name="list" size={16} /></button>
            <button className={mapView ? 'on' : ''} onClick={() => set('view', 'map')} aria-label="Map"><Icon name="map" size={16} /></button>
          </div>
        </div>

        {res.loading && <Loading />}
        {res.error && <ErrorPanel message={res.error} retry={res.reload} />}
        {res.data && (res.data.projects.length === 0
          ? <EmptyState title="No matching projects" description="Change the filters, or check back after new works are registered." />
          : mapView
            ? <Map projects={res.data.projects} height={520} />
            : (
              <table className="table">
                <thead><tr><th>Project</th><th>Road / area</th><th>Type</th><th>Department</th><th>Status</th><th>Window</th></tr></thead>
                <tbody>
                  {res.data.projects.map((p) => (
                    <tr key={p.id}>
                      <td><Link to={`/projects/${p.id}`}>{p.title}</Link></td>
                      <td>{p.road_name}</td>
                      <td>{WORK_LABELS[p.work_type]}</td>
                      <td>{p.department?.name ?? '—'}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>{formatDate(p.start_date)} – {formatDate(p.revised_end_date ?? p.end_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
      </section>
    </>
  );
}
