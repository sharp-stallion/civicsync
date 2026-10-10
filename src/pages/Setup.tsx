import { Icon } from '../components/Icon';

// Shown when Supabase is not configured. Honest, actionable — never fakes data.
export default function Setup() {
  return (
    <div className="centered">
      <div className="auth-card">
        <div className="panel">
          <span className="brand-mark" style={{ marginBottom: 14 }}><Icon name="layers" size={22} /></span>
          <h1 style={{ fontSize: 22 }}>Connect CivicSync to its backend</h1>
          <p className="page-sub" style={{ marginBottom: 18 }}>
            The app is running, but no Supabase project is configured yet. It will not invent data — set the keys below and reload.
          </p>
          <ol style={{ paddingLeft: 18, lineHeight: 1.9, fontSize: 14.5 }}>
            <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.</li>
            <li>In the SQL editor, run <code>schema.sql</code>, <code>functions.sql</code>, <code>policies.sql</code>, then <code>seed_south_chennai.sql</code>.</li>
            <li>Copy <code>.env.example</code> to <code>.env.local</code> and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (Settings → API).</li>
            <li>Restart the dev server.</li>
          </ol>
          <p className="field-hint" style={{ marginTop: 14 }}>Never put a service-role or secret key in a <code>VITE_</code> variable — those ship to the browser.</p>
        </div>
      </div>
    </div>
  );
}
