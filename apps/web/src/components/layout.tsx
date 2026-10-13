import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FolderKanban,
  Columns3,
  Building2,
  Users,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { roleLabels } from '@rafnexa/shared';
import { Avatar, Brand, ErrorNotice } from './ui';
import { useAuth, useSession } from '../lib/session-context';
import { formatDate } from '../lib/format';
import { useMediaQuery } from '../lib/use-media-query';

const navigation = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/board', label: 'Task board', icon: Columns3 },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/team', label: 'Team', icon: Users },
];
export function Layout() {
  const session = useSession();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 780px)');
  const toggle = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const mainShell = useRef<HTMLDivElement>(null);
  const logout = useMutation({ mutationFn: auth.logout });
  const ownWorkspace = useMutation({
    mutationFn: async () => {
      await auth.logout();
      navigate('/register', { replace: true });
    },
  });
  const switcher = useMutation({ mutationFn: auth.switchWorkspace });
  useEffect(() => {
    document.title = `${navigation.find((item) => location.pathname.startsWith(item.to))?.label ?? 'Workspace'} — Rafnexa`;
    const heading = document.querySelector('h1');
    if (heading instanceof HTMLElement) heading.focus();
  }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = sidebar.current;
    const main = mainShell.current;
    const toggleButton = toggle.current;
    if (main) main.inert = true;
    panel?.querySelector<HTMLElement>('.mobile-close')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
      if (event.key === 'Tab' && panel) {
        const focusable = [
          ...panel.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),select:not([disabled])',
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = original;
      if (main) main.inert = false;
      toggleButton?.focus();
      window.removeEventListener('keydown', close);
    };
  }, [mobileOpen, isMobile]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <button
        className={`sidebar-scrim ${mobileOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        onClick={() => {
          setMobileOpen(false);
          toggle.current?.focus();
        }}
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside
        ref={sidebar}
        className={`sidebar ${mobileOpen ? 'open' : ''}`}
        aria-label="Workspace navigation"
        inert={isMobile && !mobileOpen}
        aria-hidden={isMobile && !mobileOpen}
        {...(mobileOpen && isMobile ? { role: 'dialog', 'aria-modal': true } : {})}
      >
        <div className="sidebar-brand">
          <Link to="/overview" aria-label="Rafnexa overview" onClick={() => setMobileOpen(false)}>
            <Brand />
          </Link>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => {
              setMobileOpen(false);
              toggle.current?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">{session.workspace.name.slice(0, 1)}</span>
          <div>
            <span>WORKSPACE</span>
            {session.workspaces.length > 1 ? (
              <>
                <label className="sr-only" htmlFor="workspace-selector">
                  Switch workspace
                </label>
                <select
                  id="workspace-selector"
                  value={session.workspace.id}
                  disabled={switcher.isPending}
                  onChange={(event) => switcher.mutate(event.target.value)}
                >
                  {session.workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <strong>{session.workspace.name}</strong>
            )}
          </div>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink to={to} key={to} onClick={() => setMobileOpen(false)}>
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              {to === '/overview' ? <span className="nav-dot" aria-hidden="true" /> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-mark" aria-hidden="true">
            ↗
          </span>
          <h3>
            Make room for
            <br />
            meaningful work.
          </h3>
          <p>A little clarity goes a long way.</p>
          <a href="https://github.com/RafayelKaramyan/rafnexa" target="_blank" rel="noreferrer">
            Explore the source
            <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="sidebar-footer">
          <Avatar name={session.user.name} />
          <div>
            <strong>{session.user.name}</strong>
            <span>{roleLabels[session.workspace.role]}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div ref={mainShell} className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={toggle}
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {navigation.find((item) => location.pathname.startsWith(item.to))?.label ??
                'Project details'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="today-label">{formatDate(new Date().toISOString())}</span>
            <span className="topbar-divider" />
            <Avatar name={session.user.name} small />
          </div>
        </header>
        {session.workspace.isDemo ? (
          <div className="demo-banner">
            <span className="demo-badge">DEMO</span>
            <span>This is your isolated workspace. Sample data expires after 24 hours.</span>
            <button onClick={() => ownWorkspace.mutate()} disabled={ownWorkspace.isPending}>
              Create your own workspace <ArrowUpRight size={13} />
            </button>
          </div>
        ) : null}
        <main id="main-content" className="main-content">
          {logout.isError ? <ErrorNotice error={logout.error} /> : null}
          {ownWorkspace.isError ? <ErrorNotice error={ownWorkspace.error} /> : null}
          {switcher.isError ? <ErrorNotice error={switcher.error} /> : null}
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>Rafnexa · Make work flow.</span>
          <span>
            Rafayel Karamyan <span aria-hidden="true">↗</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
