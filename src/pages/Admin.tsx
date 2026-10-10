import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useResource } from '../hooks/useResource';
import { getDepartments, approveOfficialHelper } from '../services/admin';
import { getForumStats, getPendingPosts, moderatePost } from '../services/forum';
import { getDashboardStats } from '../services/conflicts';
import { useAuth } from '../context/AuthContext';
import type { Profile } from '../lib/types';
import { toMessage } from '../lib/errors';
import { PageHeading, Loading, ErrorPanel, EmptyState, Button, Notice } from '../components/UI';
import { StatCard } from '../components/StatCard';
import { humanize, formatDate } from '../lib/format';
import { Icon } from '../components/Icon';

export default function Admin() {
  const { profile } = useAuth();
  const [msg, setMsg] = useState('');

  const data = useResource('admin', async () => {
    const [{ data: profiles, error }, departments, forum, dash, pending] = await Promise.all([
      supabase.from('profiles').select('*').eq('approval_status', 'pending'),
      getDepartments(),
      getForumStats(),
      getDashboardStats(),
      getPendingPosts(),
    ]);
    if (error) throw error;
    return { pending: (profiles ?? []) as Profile[], departments, forum, dash, pendingPosts: pending };
  });

  if (profile?.role !== 'admin') return <Notice tone="warning">Only an admin can open this page.</Notice>;

  const d = data.data;
  const moderate = async (id: string, s: 'approved' | 'rejected') => {
    try { await moderatePost(id, s); data.reload(); setMsg(`Demand ${s}.`); } catch (e) { setMsg(toMessage(e)); }
  };

  return (
    <>
      <PageHeading eyebrow="Administration" title="Admin console"
        description="Approve officials, moderate the demand board, and see what residents are raising." />
      {msg && <Notice tone="success">{msg}</Notice>}
      {data.loading && <Loading />}
      {data.error && <ErrorPanel message={data.error} retry={data.reload} />}

      {d && (
        <>
          <section className="stats-grid">
            <StatCard label="Reports raised" value={d.dash.open_reports} note="Open / under review" icon="reports" />
            <StatCard label="Open conflicts" value={d.dash.open_conflicts} note="Dig-Once, need coordination" icon="layers" tone="warn" />
            <StatCard label="Demands awaiting review" value={d.forum.pending_demands} note="On the board" icon="clock" tone={d.forum.pending_demands > 0 ? 'warn' : undefined} />
            <StatCard label="Demands → projects" value={d.forum.converted_demands} note="Citizen asks turned into works" icon="check" tone="good" />
          </section>

          <section className="panel">
            <h2 style={{ fontSize: 17, marginBottom: 12 }}>Demands awaiting review ({d.pendingPosts.length})</h2>
            {d.pendingPosts.length === 0
              ? <EmptyState icon="check" title="Nothing to moderate" description="No pending demands right now." />
              : d.pendingPosts.map((p) => (
                <div key={p.id} className="panel" style={{ boxShadow: 'none', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="chips"><span className="badge status-planned">{p.area}</span></div>
                      <h3 style={{ fontSize: 15.5, marginTop: 8 }}><Link to={`/forum/${p.id}`}>{p.title}</Link></h3>
                      <p className="demand-goal" style={{ margin: '4px 0' }}><strong>Goal:</strong> {p.end_goal}</p>
                      <p className="field-hint">{p.body.slice(0, 160)}{p.body.length > 160 ? '…' : ''} · {formatDate(p.created_at)}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Button onClick={() => moderate(p.id, 'approved')}><Icon name="check" size={15} />Approve</Button>
                      <Button variant="secondary" onClick={() => moderate(p.id, 'rejected')}>Reject</Button>
                    </div>
                  </div>
                </div>
              ))}
          </section>

          <section className="panel">
            <h2 style={{ fontSize: 17, marginBottom: 12 }}>Official access requests ({d.pending.length})</h2>
            {d.pending.length === 0
              ? <EmptyState icon="shield" title="No pending requests" description="Everyone who asked for official access has been reviewed." />
              : d.pending.map((p) => <PendingRow key={p.id} profile={p} departments={d.departments} onDone={(t) => { setMsg(t); data.reload(); }} />)}
          </section>
        </>
      )}
    </>
  );
}

function PendingRow({ profile, departments, onDone }: { profile: Profile; departments: { id: string; name: string }[]; onDone: (msg: string) => void }) {
  const [dept, setDept] = useState(profile.department_id ?? '');
  const [busy, setBusy] = useState(false);
  const act = async (approve: boolean) => {
    setBusy(true);
    try { await approveOfficialHelper(profile.id, dept, approve); onDone(approve ? 'Official approved.' : 'Request rejected.'); }
    catch (e) { onDone(toMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="panel" style={{ boxShadow: 'none', marginBottom: 10, display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <strong>{profile.full_name ?? profile.id.slice(0, 8)}</strong>
        <p className="field-hint">{profile.home_area ? `${profile.home_area} · ` : ''}currently {humanize(profile.approval_status)}</p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Assign department…</option>
          {departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
        </select>
        <Button variant="secondary" onClick={() => act(false)} disabled={busy}>Reject</Button>
        <Button onClick={() => act(true)} disabled={busy || !dept}>Approve</Button>
      </div>
    </div>
  );
}
