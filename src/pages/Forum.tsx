import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useResource } from '../hooks/useResource';
import { getPosts, getMyVotes, createDemand, castVote, myDemandsToday, uploadDemandPhoto, demandPhotoUrl } from '../services/forum';
import { useAuth, isVerifiedResident } from '../context/AuthContext';
import { WORK_TYPES, type WorkType, type ForumPost } from '../lib/types';
import { WORK_LABELS, formatDate } from '../lib/format';
import { SOUTH_CHENNAI_AREAS } from '../lib/geo';
import { toMessage } from '../lib/errors';
import { PageHeading, Loading, ErrorPanel, EmptyState, Button, Field, Modal, Notice } from '../components/UI';
import { Icon } from '../components/Icon';

export default function Forum() {
  const { userId, profile } = useAuth();
  const { t } = useTranslation();
  const verified = isVerifiedResident(profile);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [area, setArea] = useState('');
  const [compose, setCompose] = useState(false);

  const res = useResource(`forum:${sort}:${area}:${userId ?? ''}`, async () => {
    const [posts, myVotes, usedToday] = await Promise.all([
      getPosts({ sort, area }),
      userId ? getMyVotes() : Promise.resolve({} as Record<string, number>),
      userId && verified ? myDemandsToday() : Promise.resolve(0),
    ]);
    return { posts, myVotes, usedToday };
  });
  const used = res.data?.usedToday ?? 0;
  const capReached = verified && used >= 2;

  const vote = async (postId: string, value: -1 | 1) => {
    const current = res.data?.myVotes[postId] ?? 0;
    try { await castVote(postId, current === value ? 0 : value); res.reload(); }
    catch (e) { alert(toMessage(e)); }
  };

  return (
    <>
      <PageHeading eyebrow={t('forum.eyebrow')} title={t('forum.title')}
        description={t('forum.subtitle')}
        actions={<Button onClick={() => setCompose(true)} disabled={capReached}><Icon name="plus" size={17} />{t('forum.raise')}</Button>} />

      {userId && !verified && <Notice tone="warning">Add your name and area (profile prompt, or in Sign in) to post, vote and comment. This keeps the board spam-free.</Notice>}
      {userId && verified && !capReached && <Notice tone="info">{t('forum.capLeft', { n: 2 - used })}</Notice>}
      {capReached && <Notice tone="warning">{t('forum.capReached')}</Notice>}
      {!userId && <Notice tone="info">Browsing as a guest. <Link to="/sign-in">{t('common.signin')}</Link> to raise or upvote demands.</Notice>}

      <div className="filter-bar">
        <div className="toggle-pills" style={{ marginBottom: 0 }}>
          <button className={sort === 'top' ? 'on' : ''} onClick={() => setSort('top')}>{t('forum.mostSupported')}</button>
          <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>{t('forum.newest')}</button>
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area" style={{ width: 'auto' }}>
          <option value="">{t('forum.allAreas')}</option>
          {SOUTH_CHENNAI_AREAS.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select>
      </div>

      {res.loading && <Loading />}
      {res.error && <ErrorPanel message={res.error} retry={res.reload} />}
      {res.data && (res.data.posts.length === 0
        ? <EmptyState icon="reports" title="No demands yet" description="Be the first to raise what your area needs fixed." />
        : res.data.posts.map((p) => (
          <DemandCard key={p.id} post={p} myVote={res.data!.myVotes[p.id] ?? 0} canVote={verified} onVote={vote} />
        )))}

      {compose && <ComposeModal defaultArea={profile?.home_area ?? ''} canPost={verified}
        onClose={() => setCompose(false)} onSaved={() => { setCompose(false); res.reload(); }} />}
    </>
  );
}

function DemandCard({ post, myVote, canVote, onVote }: { post: ForumPost; myVote: number; canVote: boolean; onVote: (id: string, v: -1 | 1) => void }) {
  return (
    <article className="demand-card">
      <div className="vote-col">
        <button className={`vote-btn ${myVote === 1 ? 'up' : ''}`} disabled={!canVote} onClick={() => onVote(post.id, 1)} aria-label="Upvote">▲</button>
        <span className="vote-score">{post.score}</span>
        <button className={`vote-btn ${myVote === -1 ? 'down' : ''}`} disabled={!canVote} onClick={() => onVote(post.id, -1)} aria-label="Downvote">▼</button>
      </div>
      <div className="demand-body">
        <div className="chips">
          <span className="badge status-planned">{post.area}</span>
          {post.work_type && <span className="badge status-ongoing">{WORK_LABELS[post.work_type]}</span>}
          {post.status === 'converted' && <span className="badge report-resolved">✓ Became a project</span>}
        </div>
        <h3><Link to={`/forum/${post.id}`}>{post.title}</Link></h3>
        <p className="demand-goal"><Icon name="arrow" size={13} /> <strong>Goal:</strong> {post.end_goal}</p>
        {post.image_path && <img className="demand-thumb" src={demandPhotoUrl(post.image_path) ?? ''} alt="" loading="lazy" />}
        <div className="conflict-meta">
          <span>{post.upvotes} up · {post.downvotes} down</span>
          <span>{formatDate(post.created_at)}</span>
          {post.converted_project_id && <Link className="text-link" to={`/projects/${post.converted_project_id}`}>View the project →</Link>}
        </div>
      </div>
    </article>
  );
}

function ComposeModal({ defaultArea, canPost, onClose, onSaved }: { defaultArea: string; canPost: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [endGoal, setEndGoal] = useState('');
  const [area, setArea] = useState(defaultArea);
  const [work, setWork] = useState<WorkType | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const image_path = file ? await uploadDemandPhoto(file) : null;
      await createDemand({ title, body, end_goal: endGoal, area, work_type: work || null, image_path });
      onSaved();
    } catch (e) { setError(toMessage(e)); setBusy(false); }
  };

  return (
    <Modal title="Raise a demand" onClose={onClose}>
      {!canPost && <Notice tone="warning">Complete your profile (name + area) first — then you can post.</Notice>}
      <form onSubmit={submit}>
        <Field id="d-title" label="What needs fixing?" hint="A clear, specific headline."><input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={6} placeholder="e.g. Fix potholes on GST Road, Perungalathur" /></Field>
        <Field id="d-goal" label="End goal" hint="The concrete outcome you want."><input id="d-goal" value={endGoal} onChange={(e) => setEndGoal(e.target.value)} required minLength={6} placeholder="e.g. Pothole work done ASAP — heavy commuting, no alternate route" /></Field>
        <Field id="d-body" label="Details"><textarea id="d-body" value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} placeholder="Describe the problem, where exactly, and why it matters." /></Field>
        <div className="row-2">
          <Field id="d-area" label="Area"><select id="d-area" value={area} onChange={(e) => setArea(e.target.value)} required><option value="">Select…</option>{SOUTH_CHENNAI_AREAS.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}<option value="Other South Chennai">Other (South Chennai)</option></select></Field>
          <Field id="d-work" label="Type (optional)"><select id="d-work" value={work} onChange={(e) => setWork(e.target.value as WorkType)}><option value="">—</option>{WORK_TYPES.map((w) => <option key={w} value={w}>{WORK_LABELS[w]}</option>)}</select></Field>
        </div>
        <Field id="d-photo" label="Photo (optional)" hint="A picture of the issue. JPEG/PNG/WebP, up to 5 MB.">
          <input id="d-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        {error && <ErrorPanel message={error} />}
        <p className="field-hint">Your demand is reviewed by an admin before it appears publicly.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !canPost}>{busy ? 'Submitting…' : 'Submit demand'}</Button>
        </div>
      </form>
    </Modal>
  );
}
