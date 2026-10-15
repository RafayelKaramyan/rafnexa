import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Copy, Check, Users, X, ShieldCheck } from 'lucide-react';
import {
  canManage,
  roleLabels,
  roleSchema,
  type Invitation,
  type InvitationInput,
  type Member,
  type Role,
} from '@rafnexa/shared';
import { Avatar, Button, ErrorNotice, Input, Loading, PageHeading, Select } from '../components/ui';
import { Modal } from '../components/modal';
import { Confirm } from '../components/confirm';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session-context';
import { useMembers, useInvalidateWorkspace } from '../lib/use-workspace-data';
import { formatDate } from '../lib/format';
import { isLocalDemo } from '../lib/demo-config';

function InviteForm({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const invalidate = useInvalidateWorkspace();
  const [form, setForm] = useState<InvitationInput>({ email: '', role: 'member' });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      api<{ token: string; invitation: Invitation }>('/invitations', {
        method: 'POST',
        body: form,
        csrfToken: session.csrfToken,
      }),
    onSuccess: () => invalidate(),
  });
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : {};
  const link = mutation.data ? `${window.location.origin}/invite#${mutation.data.token}` : '';
  return (
    <Modal
      title={mutation.data ? 'An invitation, ready to share' : 'Bring someone into the loop'}
      description={
        mutation.data
          ? 'Send this link yourself. It expires in 7 days and is tied to the invited email address.'
          : 'Choose a role that matches how they’ll work with the team.'
      }
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      {mutation.data ? (
        <div className="form-stack">
          <Input
            label="Invitation link"
            value={link}
            readOnly
            onFocus={(event) => event.target.select()}
          />
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard
                .writeText(link)
                .then(() => {
                  setCopied(true);
                  setCopyError('');
                })
                .catch(() =>
                  setCopyError('Select and copy the link above. Clipboard access is unavailable.'),
                );
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
            {copied ? 'Copied' : 'Copy invitation link'}
          </Button>
          {copyError ? (
            <p className="field-error" role="alert">
              {copyError}
            </p>
          ) : null}
          <div className="modal-actions">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            autoFocus
            value={form.email}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, email: event.target.value }))
            }
            error={fields.email}
          />
          <Select
            label="Workspace role"
            value={form.role}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                role: roleSchema.exclude(['owner']).parse(event.target.value),
              }))
            }
          >
            {(
              [
                'member',
                'viewer',
                ...(session.workspace.role === 'owner' ? ['admin'] : []),
              ] as Exclude<Role, 'owner'>[]
            ).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </Select>
          <p className="field-hint">
            {form.role === 'viewer'
              ? 'Viewers can read workspace data.'
              : form.role === 'member'
                ? 'Members can update tasks assigned to them.'
                : 'Admins can manage projects, clients, tasks and non-admin members.'}
          </p>
          {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Create invitation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
export default function Team() {
  const session = useSession();
  const members = useMembers();
  const invalidate = useInvalidateWorkspace();
  const [inviting, setInviting] = useState(false);
  const [changing, setChanging] = useState<{ member: Member; role: Exclude<Role, 'owner'> } | null>(
    null,
  );
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const manager = canManage(session.workspace.role);
  const invitations = useQuery({
    queryKey: [session.workspace.id, 'invitations'],
    queryFn: ({ signal }) => api<Invitation[]>('/invitations', { signal }),
    enabled: manager && !session.workspace.isDemo,
  });
  return (
    <>
      <PageHeading
        eyebrow="BETTER WORK, TOGETHER"
        title="A team with clear ownership"
        description="The right access. The right context. Room to contribute."
        action={
          manager && !session.workspace.isDemo ? (
            <Button onClick={() => setInviting(true)}>
              <Plus size={16} />
              Invite member
            </Button>
          ) : undefined
        }
      />
      <div className="team-intro">
        <ShieldCheck size={19} />
        <p>
          Owners and admins manage delivery. Members update their assigned tasks. Viewers stay in
          the loop.
        </p>
        <span>{members.data?.length ?? 0} people</span>
      </div>
      {session.workspace.isDemo ? (
        <p className="demo-team-note">
          {isLocalDemo
            ? 'Fictional teammates. Role changes apply only to this browser demo.'
            : 'The people in this demo are fictional. Create your own workspace to invite real teammates.'}
        </p>
      ) : null}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SHARED PURPOSE</p>
            <h2>Your people.</h2>
          </div>
          <Users size={19} />
        </div>
        {members.isPending ? (
          <Loading label="Loading team…" />
        ) : members.isError ? (
          <ErrorNotice
            error={members.error}
            retry={() => {
              void members.refetch();
            }}
          />
        ) : (
          <div className="table-scroll">
            <table className="team-table">
              <caption className="sr-only">Workspace members and roles</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.map((member) => {
                  const editable =
                    manager &&
                    member.id !== session.user.id &&
                    member.role !== 'owner' &&
                    (session.workspace.role === 'owner' || member.role !== 'admin');
                  return (
                    <tr key={member.id}>
                      <td>
                        <span className="team-person">
                          <Avatar name={member.name} />
                          <strong>
                            {member.name}
                            {member.id === session.user.id ? <small>You</small> : null}
                          </strong>
                        </span>
                      </td>
                      <td>{member.email}</td>
                      <td>
                        {editable ? (
                          <select
                            aria-label={`Role for ${member.name}`}
                            value={member.role}
                            onChange={(event) =>
                              setChanging({
                                member,
                                role: roleSchema.exclude(['owner']).parse(event.target.value),
                              })
                            }
                          >
                            {(
                              [
                                'member',
                                'viewer',
                                ...(session.workspace.role === 'owner' ? ['admin'] : []),
                              ] as Exclude<Role, 'owner'>[]
                            ).map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`role-badge role-${member.role}`}>
                            {roleLabels[member.role]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {manager && !session.workspace.isDemo ? (
        <section className="panel invitations-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">OPEN DOORS</p>
              <h2>Pending invitations.</h2>
            </div>
          </div>
          {invitations.isPending ? (
            <Loading label="Loading invitations…" />
          ) : invitations.isError ? (
            <ErrorNotice
              error={invitations.error}
              retry={() => {
                void invitations.refetch();
              }}
            />
          ) : invitations.data?.length ? (
            <ul className="invitation-list">
              {invitations.data.map((invitation) => (
                <li key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>
                      {roleLabels[invitation.role]} · Expires {formatDate(invitation.expiresAt)}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Revoke invitation for ${invitation.email}`}
                    onClick={() => setRevoking(invitation)}
                  >
                    <X size={17} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty-note">No pending invitations. Everyone’s accounted for.</p>
          )}
        </section>
      ) : null}
      {inviting ? <InviteForm onClose={() => setInviting(false)} /> : null}
      {changing ? (
        <Confirm
          title="Change this member’s role?"
          description={`${changing.member.name} will become a ${roleLabels[changing.role].toLowerCase()}.${changing.role === 'viewer' ? ' Their active tasks will be unassigned.' : ''}`}
          actionLabel="Change role"
          onClose={() => setChanging(null)}
          onConfirm={async () => {
            await api(`/members/${changing.member.id}`, {
              method: 'PATCH',
              body: { role: changing.role },
              csrfToken: session.csrfToken,
            });
            await invalidate();
          }}
        />
      ) : null}
      {revoking ? (
        <Confirm
          title="Revoke this invitation?"
          description="The existing invitation link will stop working."
          actionLabel="Revoke invitation"
          onClose={() => setRevoking(null)}
          onConfirm={async () => {
            await api(`/invitations/${revoking.id}`, {
              method: 'DELETE',
              csrfToken: session.csrfToken,
            });
            await invalidate();
          }}
        />
      ) : null}
    </>
  );
}
