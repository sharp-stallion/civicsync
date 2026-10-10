import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { SOUTH_CHENNAI_AREAS } from '../lib/geo';
import { toMessage } from '../lib/errors';
import { Button, Field, ErrorPanel, Notice } from '../components/UI';
import { Icon } from '../components/Icon';

export default function Auth({ mode }: { mode: 'signin' | 'signup' }) {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentConfirm, setSentConfirm] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'signup') {
        const res = await signUpWithEmail(email, password, fullName, area);
        if (!res.session) { setSentConfirm(true); return; }
      } else {
        await signInWithEmail(email, password);
      }
      await refresh();
      nav('/');
    } catch (e) { setError(toMessage(e)); } finally { setBusy(false); }
  };

  const google = async () => {
    setError('');
    try { await signInWithGoogle(); } catch (e) { setError(toMessage(e)); }
  };

  return (
    <div className="centered">
      <div className="auth-card">
        <div className="panel">
          <span className="brand-mark" style={{ marginBottom: 14 }}><Icon name="layers" size={22} /></span>
          <h1 style={{ fontSize: 22 }}>{mode === 'signup' ? 'Create your CivicSync account' : 'Sign in to CivicSync'}</h1>
          <p className="page-sub" style={{ marginBottom: 18 }}>
            {mode === 'signup' ? 'Residents report issues, raise demands and follow works near them.' : 'Welcome back to South Chennai public works.'}
          </p>

          {sentConfirm ? (
            <Notice tone="success">Check your inbox to confirm your email, then sign in.</Notice>
          ) : (
            <>
              <button className="btn btn-secondary full" onClick={google} type="button" style={{ marginBottom: 14 }}>
                <GoogleMark /> Continue with Google
              </button>
              <div className="or-divider"><span>or</span></div>
              <form onSubmit={submit}>
                {mode === 'signup' && (
                  <>
                    <Field id="name" label="Full name">
                      <input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} autoComplete="name" />
                    </Field>
                    <Field id="area" label="Which area of Chennai are you from?" hint="Lets us show you nearby works and verify you as a resident.">
                      <select id="area" value={area} onChange={(e) => setArea(e.target.value)} required>
                        <option value="">Select your area…</option>
                        {SOUTH_CHENNAI_AREAS.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
                        <option value="Other South Chennai">Other (South Chennai)</option>
                      </select>
                    </Field>
                  </>
                )}
                <Field id="email" label="Email">
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </Field>
                <Field id="password" label="Password">
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                </Field>
                {error && <ErrorPanel message={error} />}
                <Button type="submit" className="full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
              </form>
            </>
          )}

          <p className="auth-switch">
            {mode === 'signup'
              ? <>Already registered? <Link to="/sign-in">Sign in</Link></>
              : <>New here? <Link to="/sign-up">Create an account</Link></>}
          </p>
          <p className="auth-switch" style={{ marginTop: 6 }}><Link to="/">← Browse without signing in</Link></p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.1C12.3 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12.7c-.3 2.1-1.6 5.2-4.7 7.3l7.2 5.6c4.3-4 6.3-9.8 6.3-16.5z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C.9 15.6 0 19.6 0 23.5s.9 7.9 2.5 11.1l7.9-6.3z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.2-5.6c-2 1.4-4.6 2.3-8 2.3-6.4 0-11.7-3.8-13.6-9.3l-7.9 6.3C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
