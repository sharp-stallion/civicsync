import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getPost, getComments, addComment, castVote, getMyVotes, moderatePost, linkDemandToProject, demandPhotoUrl } from '../services/forum';
import { getProjects } from '../services/projects';
import { useAuth, isVerifiedResident, isStaff } from '../context/AuthContext';
import { WORK_LABELS, formatDateTime, humanize } from '../lib/format';
import { toMessage } from '../lib/errors';
import { PageHeading, Loading, ErrorPanel, Button, Field, Notice, EmptyState } from '../components/UI';
import { Icon } from '../components/Icon';

export default function ForumPost() {
  const { id = '' } = useParams();
  const { profile, userId } = useAuth();
  const verified = isVerifiedResident(profile);
  const staff = isStaff(profile);
  const [msg, setMsg] = useState('');

  const res = useResource(`post:${id}`, async () => {
    const [post, comments, myVotes] = await Promise.all([getPost(id), getComments(id), userId ? getMyVotes() : Promise.resolve({} as Record<string, number>)]);
    return { post, comments, myVote: myVotes[id] ?? 0 };
  });

  const post = res.data?.post;
  const vote = async (v: -1 | 1) => {
    const cur = res.data?.myVote ?? 0;
    try { await castVote(id, cur === v ? 0 : v); res.reload(); } catch (e) { setMsg(toMessage(e)); }
  };
  const moderate = async (s: 'approved' | 'rejected') => {
    try { await moderatePost(id, s); res.reload(); setMsg(`Demand ${s}.`); } catch (e) { setMsg(toMessage(e)); }
  };

  return (
    <>
      <Link to="/forum" className="text-link" style={{ marginBottom: 14, display: 'inline-flex' }}>← Demand board</Link>
      {res.loading && <Loading />}
      {res.error && <ErrorPanel message={res.error} retry={res.reload} />}
      {res.data && !post && <EmptyState title="Demand not found" />}
      {post && (
        <>
          <PageHeading eyebrow={`${post.area}${post.work_type ? ' · ' + WORK_LABELS[post.work_type] : ''}`} title={post.title} />
          {msg && <Notice tone="info">{msg}</Notice>}
          {post.status !== 'approved' && post.status !== 'converted' && <Notice tone="warning">This demand is <strong>{humanize(post.status)}</strong>{post.status === 'pending' ? ' — awaiting admin review.' : '.'}</Notice>}

          <div className="detail-grid">
            <div>
              <section className="panel">
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="vote-col">
                    <button className={`vote-btn ${res.data!.myVote === 1 ? 'up' : ''}`} disabled={!verified} onClick={() => vote(1)} aria-label="Upvote">▲</button>
                    <span className="vote-score">{post.score}</span>
                    <button className={`vote-btn ${res.data!.myVote === -1 ? 'down' : ''}`} disabled={!verified} onClick={() => vote(-1)} aria-label="Downvote">▼</button>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="demand-goal-box"><strong>End goal</strong><p>{post.end_goal}</p></div>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>
                    {post.image_path && <img className="demand-img" src={demandPhotoUrl(post.image_path) ?? ''} alt="Reported issue" loading="lazy" />}
                    <p className="field-hint">{post.upvotes} up · {post.downvotes} down · raised {formatDateTime(post.created_at)}{post.author?.full_name ? ` by ${post.author.full_name}` : ''}</p>
                    {post.converted_project_id && <Notice tone="success">This demand became a registered project. <Link to={`/projects/${post.converted_project_id}`}>View it →</Link></Notice>}
                  </div>
                </div>
              </section>

              <section className="panel">
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Discussion</h2>
                {res.data!.comments.length === 0 && <p className="field-hint">No comments yet.</p>}
                {res.data!.comments.map((c) => (
                  <div key={c.id} className="comment">
                    <div className="comment-head"><strong>{c.author?.full_name ?? 'Resident'}</strong><time>{formatDateTime(c.created_at)}</time></div>
                    <p>{c.body}</p>
                  </div>
                ))}
                {verified
                  ? <CommentForm postId={id} onAdded={() => res.reload()} />
                  : <Notice tone="info">Complete your profile to join the discussion.</Notice>}
              </section>
            </div>

            <div>
              {staff && (
                <section className="panel">
                  <h2 style={{ fontSize: 16, marginBottom: 10 }}>Moderation</h2>
                  {post.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      <Button onClick={() => moderate('approved')}><Icon name="check" size={15} />Approve</Button>
                      <Button variant="secondary" onClick={() => moderate('rejected')}>Reject</Button>
                    </div>
                  )}
                  <ConvertPanel postId={id} onDone={() => { res.reload(); setMsg('Linked to a project.'); }} />
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function CommentForm({ postId, onAdded }: { postId: string; onAdded: () => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!body.trim()) return; setBusy(true); setError('');
    try { await addComment(postId, body); setBody(''); onAdded(); } catch (e) { setError(toMessage(e)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} style={{ marginTop: 12 }}>
      <Field id="c-body" label="Add a comment"><textarea id="c-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add context, support or a correction." /></Field>
      {error && <ErrorPanel message={error} />}
      <Button type="submit" disabled={busy}>{busy ? 'Posting…' : 'Comment'}</Button>
    </form>
  );
}

// Officials link a demand to one of their department's projects.
function ConvertPanel({ postId, onDone }: { postId: string; onDone: () => void }) {
  const projects = useResource('my-projects-brief', () => getProjects({ limit: 100 }));
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const link = async () => {
    if (!sel) return; setBusy(true); setError('');
    try { await linkDemandToProject(postId, sel); onDone(); } catch (e) { setError(toMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div>
      <p className="field-hint">Turn this demand into action: link it to a project your department owns.</p>
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Select a project…</option>
        {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      {error && <ErrorPanel message={error} />}
      <Button variant="secondary" onClick={link} disabled={busy || !sel} style={{ marginTop: 10 }}><Icon name="layers" size={15} />Link to project</Button>
    </div>
  );
}
