import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Layers3, ShieldCheck, Workflow } from 'lucide-react';
import type { Session, InvitationDetails } from '@rafnexa/shared';
import { roleLabels } from '@rafnexa/shared';
import { Brand, Button, Input, ErrorNotice, Loading } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/session-context';

function useInvitation() {
  const [token] = useState(() => window.location.hash.slice(1));
  const query = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api<InvitationDetails>('/auth/invitation', { method: 'POST', body: { token } }),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });
  return { token, ...query };
}
export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const invite = useInvitation();
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const login = useMutation({
    mutationFn: async () => {
      const body = register
        ? {
            name: form.name,
            email: invite.data?.email ?? form.email.trim(),
            password: form.password,
            ...(invite.token
              ? { invitationToken: invite.token }
              : { workspaceName: form.workspaceName }),
          }
        : { email: invite.data?.email ?? form.email.trim(), password: form.password };
      const session = await api<Session>(register ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body,
      });
      if (invite.token && !register)
        return api<Session>('/auth/accept-invitation', {
          method: 'POST',
          body: { token: invite.token },
          csrfToken: session.csrfToken,
        });
      return session;
    },
    onSuccess: (session) => {
      auth.establish(session);
      navigate('/overview', { replace: true });
    },
  });
  const demo = useMutation({
    mutationFn: () => api<Session>('/auth/demo', { method: 'POST', body: {} }),
    onSuccess: (session) => {
      auth.establish(session);
      navigate('/overview', { replace: true });
    },
  });
  if (auth.loading) return <Loading />;
  if (auth.session)
    return <Navigate to={invite.token ? `/invite#${invite.token}` : '/overview'} replace />;
  const fields = login.error instanceof ApiError ? login.error.fields : {};
  function change(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <main className="auth-page">
      <section className="auth-content">
        <Link to="/login" className="brand-link" aria-label="Rafnexa home">
          <Brand />
        </Link>
        <div className="auth-form-wrap">
          <p className="eyebrow">A calmer way to deliver</p>
          <h1>{register ? 'Your next chapter.' : 'Good work starts here.'}</h1>
          <p className="auth-description">
            {invite.data
              ? `Join ${invite.data.workspaceName} as ${roleLabels[invite.data.role].toLowerCase()}.`
              : register
                ? 'Bring your projects, people and priorities into one workspace.'
                : 'Less chasing updates. More moving things forward.'}
          </p>
          {auth.error ? <ErrorNotice error={auth.error} retry={auth.retry} /> : null}
          {invite.isError ? <ErrorNotice error={invite.error} /> : null}
          {invite.token && invite.isPending ? (
            <Loading label="Checking invitation…" />
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                login.mutate();
              }}
              className="form-stack"
            >
              {register ? (
                <Input
                  label="Full name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => change('name', event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  error={fields.name}
                />
              ) : null}
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                value={invite.data?.email ?? form.email}
                readOnly={Boolean(invite.data)}
                onChange={(event) => change('email', event.target.value)}
                required
                maxLength={254}
                error={fields.email}
              />
              <Input
                label="Password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={(event) => change('password', event.target.value)}
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                {...(register ? { hint: 'Use at least 12 characters.' } : {})}
                error={fields.password}
              />
              {register && !invite.token ? (
                <Input
                  label="Workspace name"
                  autoComplete="organization"
                  value={form.workspaceName}
                  onChange={(event) => change('workspaceName', event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Your team or studio"
                  error={fields.workspaceName}
                />
              ) : null}
              {login.isError ? <ErrorNotice error={login.error} /> : null}
              <Button
                type="submit"
                loading={login.isPending}
                disabled={Boolean(invite.token && !invite.data) || demo.isPending}
              >
                {login.isPending ? 'Opening workspace…' : register ? 'Create workspace' : 'Sign in'}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to Rafnexa?'}{' '}
            <Link
              to={`${register ? '/login' : '/register'}${invite.token ? `#${invite.token}` : ''}`}
            >
              {register ? 'Sign in' : 'Create a workspace'}
            </Link>
          </p>
          {!invite.token ? (
            <>
              <div className="auth-divider">
                <span>Or take a look around</span>
              </div>
              <Button
                variant="secondary"
                className="demo-button"
                loading={demo.isPending}
                disabled={login.isPending}
                onClick={() => demo.mutate()}
              >
                Enter demo workspace
                <ArrowRight size={16} />
              </Button>
              <p className="demo-explanation">
                Fictional sample data. Your own isolated workspace, available for 24 hours. No
                account needed.
              </p>
              {demo.isError ? <ErrorNotice error={demo.error} /> : null}
            </>
          ) : null}
        </div>
        <footer className="auth-footer">
          <span>Designed & engineered by Rafayel Karamyan</span>
          <a href="https://github.com/RafayelKaramyan/rafnexa" target="_blank" rel="noreferrer">
            View source ↗
          </a>
        </footer>
      </section>
      <section className="auth-visual" aria-label="Workspace preview">
        <div className="visual-grid" aria-hidden="true" />
        <div className="visual-copy">
          <span className="visual-pill">
            <span />
            PROJECT OPERATIONS, RECONSIDERED
          </span>
          <h2>
            Clarity is a<br />
            competitive advantage<span>.</span>
          </h2>
          <p>
            One place for the work.
            <br />
            More space for the thinking.
          </p>
        </div>
        <div className="visual-window" aria-hidden="true">
          <div className="visual-window-top">
            <span>
              <Layers3 size={16} />
              Customer portal
            </span>
            <span className="visual-active">Active</span>
          </div>
          <div className="visual-task">
            <span className="visual-checkbox checked">
              <Check size={13} />
            </span>
            <span>Build workspace navigation</span>
            <span className="visual-avatar">MC</span>
          </div>
          <div className="visual-task">
            <span className="visual-checkbox" />
            <span>Review accessibility</span>
            <span className="visual-avatar blue">DR</span>
          </div>
          <div className="visual-task">
            <span className="visual-checkbox" />
            <span>Ship account overview</span>
            <span className="visual-avatar pink">NB</span>
          </div>
          <div className="visual-progress">
            <span>Delivery progress</span>
            <strong>68%</strong>
            <div>
              <span />
            </div>
          </div>
        </div>
        <div className="visual-floating">
          <Workflow size={18} />
          <div>
            <strong>Everything in motion.</strong>
            <span>Without the noise.</span>
          </div>
        </div>
        <div className="visual-bottom">
          <ShieldCheck size={16} />
          <span>Workspace roles. Clear ownership. Shared context.</span>
        </div>
      </section>
    </main>
  );
}
export function InvitePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const invite = useInvitation();
  const accept = useMutation({
    mutationFn: () =>
      api<Session>('/auth/accept-invitation', {
        method: 'POST',
        body: { token: invite.token },
        csrfToken: auth.session?.csrfToken ?? '',
      }),
    onSuccess: (session) => {
      auth.establish(session);
      navigate('/overview', { replace: true });
    },
  });
  const logout = useMutation({ mutationFn: auth.logout });
  return (
    <main className="invite-page">
      <Brand />
      <div className="invite-card">
        <p className="eyebrow">You’re invited</p>
        {invite.isPending && invite.token ? (
          <Loading label="Checking invitation…" />
        ) : invite.data ? (
          <>
            <h1>Join {invite.data.workspaceName}.</h1>
            <p>
              This invitation is for <strong>{invite.data.email}</strong>, with the{' '}
              <strong>{roleLabels[invite.data.role]}</strong> role.
            </p>
            {auth.session ? (
              <>
                <p>Signed in as {auth.session.user.email}.</p>
                <Button loading={accept.isPending} onClick={() => accept.mutate()}>
                  Accept invitation
                </Button>
                <Button variant="ghost" loading={logout.isPending} onClick={() => logout.mutate()}>
                  Sign in with another account
                </Button>
              </>
            ) : (
              <div className="invite-actions">
                <Link className="button button-primary" to={`/register#${invite.token}`}>
                  Create an account
                </Link>
                <Link className="button button-secondary" to={`/login#${invite.token}`}>
                  Sign in
                </Link>
              </div>
            )}
          </>
        ) : (
          <ErrorNotice error={invite.error ?? new Error('This invitation is unavailable.')} />
        )}
        {accept.isError ? <ErrorNotice error={accept.error} /> : null}
        {logout.isError ? <ErrorNotice error={logout.error} /> : null}
        <Link className="text-link" to="/overview">
          Back to workspace
        </Link>
      </div>
    </main>
  );
}
