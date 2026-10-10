import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth, isStaff } from '../context/AuthContext';
import { signOut } from '../services/auth';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from './Icon';
import { ProfileGate } from './ProfileGate';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

const NAV: { to: string; tkey: string; icon: IconName; staff?: boolean; citizen?: boolean; admin?: boolean }[] = [
  { to: '/', tkey: 'dashboard', icon: 'home' },
  { to: '/projects', tkey: 'projects', icon: 'projects' },
  { to: '/conflicts', tkey: 'digonce', icon: 'layers' },
  { to: '/forum', tkey: 'forum', icon: 'reports' },
  { to: '/my-area', tkey: 'myarea', icon: 'pin' },
  { to: '/scoreboard', tkey: 'scoreboard', icon: 'chart' },
  { to: '/report', tkey: 'report', icon: 'reports', citizen: true },
  { to: '/my-reports', tkey: 'myreports', icon: 'list', citizen: true },
  { to: '/inbox', tkey: 'inbox', icon: 'reports', staff: true },
  { to: '/projects/new', tkey: 'register', icon: 'plus', staff: true },
  { to: '/admin', tkey: 'approvals', icon: 'shield', admin: true },
];

export function Layout({ children }: { children: ReactNode }) {
  const { profile, email, userId } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const staff = isStaff(profile);
  const admin = profile?.role === 'admin';

  // Role-segmented navigation: guests browse only; citizens get participation
  // actions; officials/admins get their workspaces. Routes also enforce this.
  const visible = NAV.filter((n) => {
    if (n.admin) return admin;
    if (n.staff) return staff;
    if (n.citizen) return !!userId && !staff; // citizen actions require sign-in
    return true; // public browse pages
  });

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark"><Icon name="layers" size={20} /></span>
          <span><b>CivicSync</b><small>{t('brand.tagline')}</small></span>
        </Link>
        <nav>
          {visible.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <Icon name={n.icon} size={18} />{t(`nav.${n.tkey}`)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <ThemeToggle />
          <LanguageSwitcher />
          {userId ? (
            <>
              <div className="who"><span className="who-name">{profile?.full_name ?? email ?? 'Signed in'}</span>
                <span className="who-role">{profile?.role ?? 'citizen'}{profile?.approval_status === 'pending' ? ` · ${t('common.pending')}` : ''}</span></div>
              <button className="nav-item" onClick={() => signOut()}><Icon name="logout" size={18} />{t('common.signout')}</button>
            </>
          ) : (
            <Link to="/sign-in" className="btn btn-primary full">{t('common.signin')}</Link>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu" onClick={() => setOpen((v) => !v)} aria-label="Menu"><Icon name="menu" size={22} /></button>
          <Link to="/" className="topbar-brand">CivicSync</Link>
          {!userId && <Link to="/sign-in" className="btn btn-secondary sm">Sign in</Link>}
        </header>
        {profile?.approval_status === 'pending' && (
          <div className="banner">Your official account is awaiting admin approval. You can browse, but cannot register works yet.</div>
        )}
        <main className="content" key={loc.pathname}>{children}</main>
        <footer className="foot">
          CivicSync · built for South Chennai · data from residents, city departments and open sources (OpenStreetMap, Open-Meteo, OpenAQ).
        </footer>
      </div>
      <ProfileGate />
    </div>
  );
}
