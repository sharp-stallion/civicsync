import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getConflicts, resolveConflict } from '../services/conflicts';
import { getProjectsByIds, getDepartments } from '../services/projects';
import { useAuth, isStaff } from '../context/AuthContext';
import type { ProjectConflict, ConflictStatus, Project } from '../lib/types';
import { WORK_LABELS, formatDate, formatDateTime, humanize } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { PageHeading, Loading, ErrorPanel, EmptyState, Button, Notice, Modal, Field } from '../components/UI';
import { ConflictBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

const FILTERS: { v: ConflictStatus | ''; label: string }[] = [
  { v: 'open', label: 'Needs review' }, { v: 'coordinating', label: 'Coordinating' },
  { v: 'resolved', label: 'Resolved' }, { v: 'dismissed', label: 'Dismissed' },
  { v: 'cleared', label: 'No longer overlapping' }, { v: '', label: 'All' },
];

export default function Conflicts() {
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const projectId = params.get('project') ?? '';
  const status = (FILTERS.some((f) => f.v === params.get('status')) ? params.get('status') : (projectId ? '' : 'open')) as ConflictStatus | '';
  const [review, setReview] = useState<ProjectConflict | null>(null);

  const res = useResource(`conflicts:${status}:${projectId}`, async () => {
    const list = await getConflicts({ status, projectId: projectId || undefined });
    const [projects, departments] = await Promise.all([
      getProjectsByIds(list.flatMap((c) => [c.project_a_id, c.project_b_id])),
      getDepartments(),
    ]);
    return { list, projects, departments };
  });

  const setStatus = (v: string) => { const n = new URLSearchParams(params); n.set('status', v); setParams(n); };

  return (
    <>
      <PageHeading eyebrow="Dig-Once coordination" title="Resolve overlaps. Dig once."
        description="Before a road is cut twice, the engine flags overlapping and repeat-dig works on the same stretch. Every alert and decision is public." />
      <Notice tone="info">An alert combines schedule, work type and a shared segment or locations within 150 m. It flags a <strong>potential</strong> coordination need — not engineering proof or permission to excavate.</Notice>

      <div className="toggle-pills">
        {FILTERS.map((f) => <button key={f.v} className={f.v === status ? 'on' : ''} onClick={() => setStatus(f.v)}>{f.label}</button>)}
      </div>

      {res.loading && <Loading />}
      {res.error && <ErrorPanel message={res.error} retry={res.reload} />}
      {res.data && (res.data.list.length === 0
        ? <EmptyState icon="check" title="Nothing in this view" description="No conflicts match. Try another filter, or register works to test coordination." />
        : res.data.list.map((c) => {
          const a = res.data!.projects.find((p) => p.id === c.project_a_id);
          const b = res.data!.projects.find((p) => p.id === c.project_b_id);
          const canReview = isStaff(profile) && (
            profile?.role === 'admin' ||
            [a?.department_id, b?.department_id].includes(profile?.department_id ?? '__'));
          const depts = [a, b].map((p) => res.data!.departments.find((d) => d.id === p?.department_id)?.name ?? '—');
          return (
            <article key={c.id} className={`conflict-card ${c.conflict_type === 'lookahead_repeat' ? 'lookahead' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <ConflictBadge type={c.conflict_type} />
                <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-soft)' }}>{humanize(c.status)}{!c.is_current ? ' · not current' : ''}</span>
              </div>
              <div className="conflict-pair">
                <ProjCell p={a} /><span className="vs">×</span><ProjCell p={b} />
              </div>
              <p className="conflict-reason">{c.reason}</p>
              <div className="conflict-meta">
                <span>Departments: {[...new Set(depts)].join(' + ')}</span>
                {c.distance_m != null && <span>{fmtDistance(c.distance_m)} apart</span>}
                <span>Updated {formatDateTime(c.updated_at)}</span>
              </div>
              {c.resolution_note && <Notice tone="success"><strong>Decision:</strong> {c.resolution_note}</Notice>}
              {canReview && (c.status === 'open' || c.status === 'coordinating') && (
                <div style={{ marginTop: 10 }}><Button variant="secondary" onClick={() => setReview(c)}><Icon name="check" size={15} />Record a decision</Button></div>
              )}
            </article>
          );
        }))}

      {review && <ResolveModal conflict={review} onClose={() => setReview(null)} onSaved={() => { setReview(null); res.reload(); }} />}
    </>
  );
}

function ProjCell({ p }: { p?: Project }) {
  if (!p) return <span className="pair-proj">Project unavailable</span>;
  return <Link className="pair-proj" to={`/projects/${p.id}`}>{p.title}<small>{p.road_name} · {WORK_LABELS[p.work_type]} · {formatDate(p.start_date)}–{formatDate(p.revised_end_date ?? p.end_date)}</small></Link>;
}

function ResolveModal({ conflict, onClose, onSaved }: { conflict: ProjectConflict; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<Extract<ConflictStatus, 'coordinating' | 'resolved' | 'dismissed'>>('coordinating');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await resolveConflict(conflict.id, status, note); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setBusy(false); }
  };
  return (
    <Modal title="Record a coordination decision" onClose={onClose}>
      <p style={{ color: 'var(--text-soft)', marginTop: 0 }}>{conflict.reason}</p>
      <form onSubmit={submit}>
        <Field id="cs" label="Decision"><select id="cs" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="coordinating">Coordinating — teams will align schedules</option>
          <option value="resolved">Resolved — a joint plan is agreed</option>
          <option value="dismissed">Dismissed — no coordination needed</option>
        </select></Field>
        <Field id="cn" label="Public note" hint="Explain the coordination — e.g. a single combined dig window."><textarea id="cn" value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} /></Field>
        {error && <ErrorPanel message={error} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save decision'}</Button>
        </div>
      </form>
    </Modal>
  );
}
