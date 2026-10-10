# Google sign-in setup

Google sign-in is **optional** — email/password works without it.

## 1. Create a Google OAuth client
Google Cloud Console → **APIs & Services → Credentials → Create Credentials →
OAuth client ID → Web application**.

- **Authorized JavaScript origins** (no path, no trailing slash):
  ```
  https://<your-production-domain>.vercel.app
  http://localhost:5173
  ```
- **Authorized redirect URIs** — the Supabase callback (NOT your app URL):
  ```
  https://<your-project-ref>.supabase.co/auth/v1/callback
  ```
Copy the **Client ID** and **Client Secret**.

## 2. Enable it in Supabase
Supabase → **Authentication → Providers → Google** → paste the Client ID +
Secret → Enable → Save.

## 3. Set the redirect configuration (fixes "localhost refused to connect")
Supabase → **Authentication → URL Configuration**:
- **Site URL** = your **stable** production domain (no deployment hash), e.g.
  `https://<project>.vercel.app`
- **Redirect URLs**:
  ```
  https://<project>.vercel.app/**
  http://localhost:5173/**
  ```

## Notes
- Google origins do **not** support wildcards or paths, so Google sign-in only
  works on domains you list explicitly — always use the stable production URL,
  never a per-deployment hash URL.
- While the OAuth consent screen is in **Testing**, only emails added under
  **Test users** can sign in. Publish the consent screen (basic email/profile
  scopes need no verification) to open it to everyone.
