import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, isStaff } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Loading } from './components/UI';
import { isConfigured } from './lib/env';
import Setup from './pages/Setup';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const ProjectEditor = lazy(() => import('./pages/ProjectEditor'));
const Report = lazy(() => import('./pages/Report'));
const MyReports = lazy(() => import('./pages/MyReports'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Conflicts = lazy(() => import('./pages/Conflicts'));
const Forum = lazy(() => import('./pages/Forum'));
const ForumPost = lazy(() => import('./pages/ForumPost'));
const MyArea = lazy(() => import('./pages/MyArea'));
const Scoreboard = lazy(() => import('./pages/Scoreboard'));
const Admin = lazy(() => import('./pages/Admin'));
const Auth = lazy(() => import('./pages/Auth'));

function RequireAuth({ children, staff }: { children: React.ReactNode; staff?: boolean }) {
  const { userId, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!userId) return <Navigate to="/sign-in" replace />;
  if (staff && !isStaff(profile)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Shell() {
  return (
    <Layout>
      <Suspense fallback={<Loading label="Opening…" />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/new" element={<RequireAuth staff><ProjectEditor /></RequireAuth>} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/edit" element={<RequireAuth staff><ProjectEditor /></RequireAuth>} />
          <Route path="/report" element={<RequireAuth><Report /></RequireAuth>} />
          <Route path="/my-reports" element={<RequireAuth><MyReports /></RequireAuth>} />
          <Route path="/inbox" element={<RequireAuth staff><Inbox /></RequireAuth>} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/forum/:id" element={<ForumPost />} />
          <Route path="/my-area" element={<MyArea />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/admin" element={<RequireAuth staff><Admin /></RequireAuth>} />
          <Route path="/sign-in" element={<Auth mode="signin" />} />
          <Route path="/sign-up" element={<Auth mode="signup" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  if (!isConfigured()) return <Setup />;
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
