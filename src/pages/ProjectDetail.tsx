import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getProject, getDepartments, getProjectsByIds, recheckConflicts } from '../services/projects';
import { getProjectUpdates, publishUpdate } from '../services/updates';
import { getConflicts } from '../services/conflicts';
import { useAuth, canManageDept } from '../context/AuthContext';
import { PROJECT_STATUSES, type ProjectStatus } from '../lib/types';
import { WORK_LABELS, STATUS_LABELS, formatDate, formatDateTime, formatINR, daysLate } from '../lib/format';
import { PageHeading, Loading, ErrorPanel, Button, Notice, Field, Modal, ProgressBar, EmptyState } from '../components/UI';
import { StatusBadge, ConflictBadge } from '../components/StatusBadge';
import { Map } from '../components/Map';
import { EnrichmentPanel } from '../components/EnrichmentPanel';
import { PredictionCard } from '../components/PredictionCard';
import { Icon } from '../components/Icon';

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const [showUpdate, setShowUpdate] = useState(false);
  const [msg, setMsg] = useState('');

  const base = useResource(`project:${id}`, async () => {
    const [project, departments] = await Promise.all([getProject(id), getDepartments()]);
    return { project, departments };
  });
  const updates = useResource(`updates:${id}`, () => getProjectUpdates(id));
  const conflicts = useResource(`pc:${id}`, async () => {
    const list = await getConflicts({ projectId: id });
    const related = await getProjectsByIds(list.flatMap((c) => [c.project_a_id, c.project_b_id]));
    return { list, related };
  });

  const project = base.data?.project;
  const dept = base.data?.departments.find((d) => d.id === project?.department_id);
  const manage = project ? canManageDept(profile, project.department_id) : false;
  const late = project && project.status !== 'completed' && project.status !== 'cancelled' ? daysLate(project.revised_end_date ?? project.end_date) : 0;

  const recheck = async () => {
    setMsg('');
    try { const n = await recheckConflicts(id); conflicts.reload(); setMsg(`Re-checked: ${n} potential conflict(s) current.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Re-check failed.'); }
  };

  return (
    <>
      <Link to="/projects" className="text-link" style={{ marginBottom: 14, display: 'inline-flex' }}>← All projects</Link>
      {base.loading && <Loading />}
      {base.error && <ErrorPanel message={base.error} retry={base.reload} />}
      {base.data && !project && <EmptyState title="Project not found" />}
      {project && (
        <>
          <PageHeading eyebrow={WORK_LABELS[project.work_type]} title={project.title}
            description={[project.road_name, project.location_description].filter(Boolean).join(' · ')}
            actions={
              <>
                <Link className="btn btn-secondary" to={`/report?project=${project.id}`}><Icon name="reports" size={16} />Report an issue</Link>
                {manage && <>
                  <Link className="btn btn-secondary" to={`/projects/${id}/edit`}><Icon name="edit" size={15} />Edit</Link>
                  <Button onClick={() => setShowUpdate(true)}><Icon name="plus" size={16} />Publish update</Button>
                </>}
              </>
            } />
          <div className="meta-line">
            <StatusBadge status={project.status} />
            <span>{project.progress_percent}% complete</span>
            <span>Dept: <strong>{dept?.name ?? '—'}</strong></span>
            {project.contractor_name && <span>Contractor: {project.contractor_name}</span>}
            <span>Ref <code>{project.id.slice(0, 8)}</code></span>
          </div>
          <div style={{ maxWidth: 420, marginBottom: 18 }}><ProgressBar value={project.progress_percent} /></div>
          {msg && <Notice tone="info">{msg}</Notice>}
          {late > 0 && <Notice tone="warning">The scheduled end date is {late} day(s) past. Official status is still <strong>{STATUS_LABELS[project.status]}</strong> — an update should explain the delay.</Notice>}

          <div className="detail-grid">
            <div>
              <section className="panel">
                <h2 style={{ fontSize: 17, marginBottom: 10 }}>Purpose &amp; schedule</h2>
                <p style={{ color: 'var(--text-soft)', marginTop: 0 }}>{project.description || 'No description was provided for this work.'}</p>
                <dl className="kv" style={{ marginTop: 14 }}>
                  <dt>Start</dt><dd>{formatDate(project.start_date)}</dd>
                  <dt>Planned end</dt><dd>{formatDate(project.end_date)}</dd>
                  {project.revised_end_date && <><dt>Revised end</dt><dd>{formatDate(project.revised_end_date)}</dd></>}
                  {project.actual_end_date && <><dt>Completed</dt><dd>{formatDate(project.actual_end_date)}</dd></>}
                  {project.estimated_cost_inr != null && <><dt>Est. cost</dt><dd>{formatINR(project.estimated_cost_inr)}</dd></>}
                  {project.road_segment_id && <><dt>Segment ID</dt><dd><code>{project.road_segment_id}</code></dd></>}
                </dl>
                <EnrichmentPanel lat={project.latitude} lng={project.longitude} />
                <PredictionCard project={project} />
              </section>

              <section className="panel">
                <h2 style={{ fontSize: 17, marginBottom: 12 }}>Official timeline</h2>
                {updates.loading && <Loading />}
                {updates.data && updates.data.length === 0 && <EmptyState icon="clock" title="No updates yet" description="The department has not posted progress on this work." />}
                {updates.data && updates.data.length > 0 && (
                  <ul className="timeline">
                    {updates.data.map((u) => (
                      <li key={u.id}>
                        <div className="tl-head"><StatusBadge status={u.status} /><time>{formatDateTime(u.created_at)}</time></div>
                        <p>{u.progress_note} <span style={{ color: 'var(--text-faint)' }}>({u.progress_percent}%)</span></p>
                        {u.delay_reason && <p className="tl-delay">Delay: {u.delay_reason}</p>}
                        {u.revised_end_date && <p className="field-hint">New end date: {formatDate(u.revised_end_date)}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div>
              <section className="panel" style={{ padding: 12 }}>
                <Map projects={[project]} height={260} fit />
              </section>
              <section className="panel">
                <div className="section-heading"><div><h2 style={{ fontSize: 16 }}>Dig-Once</h2></div>
                  {manage && <Button variant="ghost" onClick={recheck}><Icon name="refresh" size={14} />Re-check</Button>}</div>
                {conflicts.loading && <Loading />}
                {conflicts.data && conflicts.data.list.length === 0 && <p className="field-hint">No overlaps detected with other active works.</p>}
                {conflicts.data?.list.map((c) => {
                  const other = c.project_a_id === id ? c.project_b_id : c.project_a_id;
                  const op = conflicts.data!.related.find((p) => p.id === other);
                  return (
                    <div key={c.id} className={`conflict-card ${c.conflict_type === 'lookahead_repeat' ? 'lookahead' : ''}`} style={{ boxShadow: 'none', padding: 13 }}>
                      <ConflictBadge type={c.conflict_type} />
                      <p className="conflict-reason" style={{ fontSize: 13 }}>{c.reason}</p>
                      {op && <Link className="text-link" to={`/projects/${op.id}`} style={{ fontSize: 13 }}>{op.title} <Icon name="arrow" size={13} /></Link>}
                    </div>
                  );
                })}
                <Link className="text-link" to={`/conflicts?project=${id}`} style={{ fontSize: 13 }}>Open in Dig-Once board <Icon name="arrow" size={13} /></Link>
              </section>
            </div>
          </div>

          {showUpdate && manage && <UpdateModal projectId={id} status={project.status} progress={project.progress_percent}
            onClose={() => setShowUpdate(false)} onSaved={() => { setShowUpdate(false); updates.reload(); base.reload(); conflicts.reload(); setMsg('Update published — the public timeline now reflects it.'); }} />}
        </>
      )}
    </>
  );
}

function UpdateModal({ projectId, status, progress, onClose, onSaved }: { projectId: string; status: ProjectStatus; progress: number; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<ProjectStatus>(status);
  const [pct, setPct] = useState(progress);
  const [note, setNote] = useState('');
  const [delay, setDelay] = useState('');
  const [revised, setRevised] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await publishUpdate({ projectId, status: s, progressPercent: s === 'completed' ? 100 : pct, progressNote: note, delayReason: s === 'delayed' ? delay : null, revisedEndDate: revised || null });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not publish.'); setBusy(false); }
  };

  return (
    <Modal title="Publish a progress update" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="row-2">
          <Field id="u-status" label="Status"><select id="u-status" value={s} onChange={(e) => setS(e.target.value as ProjectStatus)}>{PROJECT_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABELS[x]}</option>)}</select></Field>
          <Field id="u-pct" label="Progress %"><input id="u-pct" type="number" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} disabled={s === 'completed'} /></Field>
        </div>
        <Field id="u-note" label="What changed?" hint="Residents read this. Be specific."><textarea id="u-note" value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} /></Field>
        {s === 'delayed' && <Field id="u-delay" label="Reason for delay" hint="Required for a delay."><textarea id="u-delay" value={delay} onChange={(e) => setDelay(e.target.value)} required /></Field>}
        <Field id="u-rev" label="Revised end date (optional)"><input id="u-rev" type="date" value={revised} onChange={(e) => setRevised(e.target.value)} /></Field>
        {error && <ErrorPanel message={error} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish update'}</Button>
        </div>
      </form>
    </Modal>
  );
}
