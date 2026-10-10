import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateMyProfile } from '../services/auth';
import { SOUTH_CHENNAI_AREAS } from '../lib/geo';
import { toMessage } from '../lib/errors';
import { Modal, Field, Button, ErrorPanel } from './UI';

// Shown once when a signed-in user has no home area yet (e.g. after Google
// sign-in). Completing it makes them a "verified resident" who can post & vote.
export function ProfileGate() {
  const { userId, profile, loading, refresh } = useAuth();
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const needed = !loading && !!userId && !!profile && (!profile.home_area || profile.home_area.trim() === '');
  if (!needed || dismissed) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await updateMyProfile(name || profile!.full_name || '', area);
      await refresh();
      setDismissed(true);
    } catch (e) { setError(toMessage(e)); setBusy(false); }
  };

  return (
    <Modal title="Complete your resident profile" onClose={() => setDismissed(true)}>
      <p style={{ color: 'var(--text-soft)', marginTop: 0 }}>Tell us your name and area so we can show works near you — and so you can raise and vote on demands.</p>
      <form onSubmit={submit}>
        <Field id="pg-name" label="Full name">
          <input id="pg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={profile?.full_name ?? 'Your name'} required={!profile?.full_name} />
        </Field>
        <Field id="pg-area" label="Area of Chennai">
          <select id="pg-area" value={area} onChange={(e) => setArea(e.target.value)} required>
            <option value="">Select your area…</option>
            {SOUTH_CHENNAI_AREAS.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            <option value="Other South Chennai">Other (South Chennai)</option>
          </select>
        </Field>
        {error && <ErrorPanel message={error} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" onClick={() => setDismissed(true)}>Later</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
        </div>
      </form>
    </Modal>
  );
}
