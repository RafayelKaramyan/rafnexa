import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  projectStatusLabels,
  projectStatusSchema,
  type Project,
  type ProjectInput,
} from '@rafnexa/shared';
import { Modal } from './modal';
import { Button, ErrorNotice, Input, Select, Textarea } from './ui';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session-context';
import { useClients, useInvalidateWorkspace } from '../lib/use-workspace-data';

export function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const session = useSession();
  const clients = useClients();
  const invalidate = useInvalidateWorkspace();
  const [form, setForm] = useState<ProjectInput>({
    name: project?.name ?? '',
    description: project?.description ?? '',
    clientId: project?.clientId ?? null,
    status: project?.status ?? 'planned',
    dueDate: project?.dueDate ?? null,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api<Project>(project ? `/projects/${project.id}` : '/projects', {
        method: project ? 'PUT' : 'POST',
        body: form,
        csrfToken: session.csrfToken,
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : {};
  function change<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <Modal
      title={project ? 'Edit project' : 'A new beginning'}
      description={
        project
          ? 'Keep the team aligned with the latest details.'
          : 'Give the next piece of work a place to grow.'
      }
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
          label="Project name"
          value={form.name}
          onChange={(event) => change('name', event.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoFocus
          error={fields.name}
          placeholder="e.g. Customer portal"
        />
        <div className="form-row">
          <Select
            label="Client"
            value={form.clientId ?? ''}
            onChange={(event) => change('clientId', event.target.value || null)}
            disabled={clients.isPending}
            error={fields.clientId}
          >
            <option value="">Internal project</option>
            {clients.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
          <Select
            label="Project status"
            value={form.status}
            onChange={(event) => change('status', projectStatusSchema.parse(event.target.value))}
            error={fields.status}
          >
            {Object.entries(projectStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Due date"
          type="date"
          value={form.dueDate ?? ''}
          onChange={(event) => change('dueDate', event.target.value || null)}
          error={fields.dueDate}
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(event) => change('description', event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="A little context goes a long way."
          error={fields.description}
        />
        {clients.isError ? (
          <ErrorNotice
            error={clients.error}
            retry={() => {
              void clients.refetch();
            }}
          />
        ) : null}
        {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
        <div className="modal-actions">
          <Button variant="secondary" type="button" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={clients.isPending || clients.isError}
          >
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
