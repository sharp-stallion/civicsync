import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getReportsInbox, reviewReport } from '../services/reports';
import { CATEGORY_LABELS, formatDate } from '../lib/format';
import type { CitizenReport, ReportStatus } from '../lib/types';
import { PageHeading, Loading, ErrorPanel, EmptyState, Button, Modal, Field } from '../components/UI';
import { ReportBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

export default function Inbox() {
  const res = useResource('inbox', getReportsInbox);
  const [active, setActive] = useState<CitizenReport | null>(null);
  const open = res.data?.filter((r) => r.status === 'open' || r.status === 'under_review') ?? [];
  const closed = res.data?.filter((r) => r.status === 'resolved' || r.status === 'dismissed') ?? [];

  return (
    <>
      <PageHeading eyebrow="Department workspace" title="Reports inbox"
        description="Resident reports for your department's works, plus unregistered digging anyone flagged. Respond and residents see it." />
      {res.loading && <Loading />}
      {res.error && <ErrorPanel message={res.error} retry={res.reload} />}
      {res.data && res.data.length === 0 && <EmptyState icon="reports" title="Nothing to triage" description="No reports are visible to your account yet." />}

      {open.length > 0 && <h2 style={{ fontSize: 17, margin: '6px 0 12px' }}>Needs attention ({open.length})</h2>}
      {open.map((r) => <Row key={r.id} r={r} onAct={() => setActive(r)} />)}

      {closed.length > 0 && <h2 style={{ fontSize: 17, margin: '22px 0 12px' }}>Closed</h2>}
      {closed.map((r) => <Row key={r.id} r={r} onAct={() => setActive(r)} />)}

      {active && <ReviewModal report={active} onClose={() => setActive(null)} onSaved={() => { setActive(null); res.reload(); }} />}
    </>
  );
}

function Row({ r, onAct }: { r: CitizenReport; onAct: () => void }) {
  return (
    <section className="panel" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="chips"><ReportBadge status={r.status} /><span className="badge status-planned">{CATEGORY_LABELS[r.category]}</span>{r.is_unregistered && <span className="badge conflict-lookahead_repeat">Unregistered</span>}</div>
          <h3 style={{ fontSize: 15.5, marginTop: 10 }}>{r.project ? r.project.title : (r.road_name || 'Unregistered digging')}</h3>
          <p style={{ color: 'var(--text-soft)', margin: '4px 0', fontSize: 14 }}>{r.description}</p>
          {r.official_response && <p className="field-hint">Your response: {r.official_response}</p>}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="field-hint">{formatDate(r.created_at)}</span>
            {r.latitude != null && <span className="field-hint">{r.latitude.toFixed(4)}, {r.longitude?.toFixed(4)}</span>}
            {r.project && <Link className="text-link" to={`/projects/${r.project.id}`} style={{ fontSize: 13 }}>Project</Link>}
          </div>
        </div>
        {(r.status === 'open' || r.status === 'under_review') && <Button variant="secondary" onClick={onAct}>Respond</Button>}
      </div>
    </section>
  );
}

function ReviewModal({ report, onClose, onSaved }: { report: CitizenReport; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<Extract<ReportStatus, 'under_review' | 'resolved' | 'dismissed'>>('under_review');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await reviewReport(report.id, status, response); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setBusy(false); }
  };

  return (
    <Modal title="Respond to report" onClose={onClose}>
      <p style={{ color: 'var(--text-soft)', marginTop: 0 }}>{report.description}</p>
      <form onSubmit={submit}>
        <Field id="rs" label="Set status"><select id="rs" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="under_review">Under review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
        </select></Field>
        <Field id="rr" label="Public response" hint="The resident sees this."><textarea id="rr" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="What will be done, or why this is closed." /></Field>
        {error && <ErrorPanel message={error} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save response'}</Button>
        </div>
      </form>
      <p className="field-hint" style={{ marginTop: 10 }}><Icon name="shield" size={12} /> Review is recorded server-side against your approved department.</p>
    </Modal>
  );
}
