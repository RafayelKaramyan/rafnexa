import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Building2, Plus, Mail, Edit3, Archive } from 'lucide-react';
import { canManage, type Client, type ClientInput } from '@rafnexa/shared';
import {
  Button,
  EmptyState,
  ErrorNotice,
  Input,
  Loading,
  PageHeading,
  Textarea,
} from '../components/ui';
import { Modal } from '../components/modal';
import { Confirm } from '../components/confirm';
import { useSession } from '../lib/session-context';
import { useClients, useInvalidateWorkspace } from '../lib/use-workspace-data';
import { api, ApiError } from '../lib/api';

function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const session = useSession();
  const invalidate = useInvalidateWorkspace();
  const [form, setForm] = useState<ClientInput>({
    name: client?.name ?? '',
    contactEmail: client?.contactEmail ?? null,
    description: client?.description ?? '',
  });
  const mutation = useMutation({
    mutationFn: () =>
      api<Client>(client ? `/clients/${client.id}` : '/clients', {
        method: client ? 'PUT' : 'POST',
        body: form,
        csrfToken: session.csrfToken,
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : {};
  return (
    <Modal
      title={client ? 'Edit client' : 'A new working relationship'}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Input
          label="Client name"
          value={form.name}
          required
          minLength={2}
          maxLength={80}
          autoFocus
          onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
          error={fields.name}
        />
        <Input
          label="Contact email (optional)"
          type="email"
          value={form.contactEmail ?? ''}
          maxLength={254}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, contactEmail: event.target.value || null }))
          }
          error={fields.contactEmail}
        />
        <Textarea
          label="Notes"
          value={form.description}
          maxLength={500}
          rows={3}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, description: event.target.value }))
          }
          error={fields.description}
        />
        {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {client ? 'Save client' : 'Add client'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function Clients() {
  const session = useSession();
  const query = useClients();
  const invalidate = useInvalidateWorkspace();
  const [editing, setEditing] = useState<Client | true | null>(null);
  const [archiving, setArchiving] = useState<Client | null>(null);
  return (
    <>
      <PageHeading
        eyebrow="GOOD WORK IS BUILT TOGETHER"
        title="The people behind the projects"
        description="Keep every working relationship in view."
        action={
          canManage(session.workspace.role) ? (
            <Button onClick={() => setEditing(true)}>
              <Plus size={16} />
              Add client
            </Button>
          ) : undefined
        }
      />
      {query.isPending ? (
        <Loading label="Loading clients…" />
      ) : query.isError ? (
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : !query.data?.length ? (
        <EmptyState
          title="Your first client belongs here"
          description="Add clients to keep project context connected."
        />
      ) : (
        <div className="client-grid">
          {query.data.map((client, index) => (
            <article className="panel client-card" key={client.id}>
              <div className="client-card-top">
                <span className={`client-icon project-color-${index % 4}`}>
                  <Building2 size={23} />
                </span>
                {canManage(session.workspace.role) ? (
                  <div>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${client.name}`}
                      onClick={() => setEditing(client)}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Archive ${client.name}`}
                      onClick={() => setArchiving(client)}
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                ) : null}
              </div>
              <h2>{client.name}</h2>
              <p>{client.description || 'A little context makes collaboration easier.'}</p>
              <span className="client-email">
                <Mail size={14} />
                {client.contactEmail ?? 'No contact email added'}
              </span>
            </article>
          ))}
        </div>
      )}
      {editing ? (
        <ClientForm
          {...(editing === true ? {} : { client: editing })}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {archiving ? (
        <Confirm
          title="Archive this client?"
          description="Clients with active projects need to be reassigned before they can be archived."
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            await api(`/clients/${archiving.id}`, {
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
