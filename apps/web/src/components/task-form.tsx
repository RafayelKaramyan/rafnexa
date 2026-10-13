import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  canManage,
  prioritySchema,
  taskStatusSchema,
  taskStatusLabels,
  type Task,
  type TaskInput,
} from '@rafnexa/shared';
import { Modal } from './modal';
import { Button, ErrorNotice, Input, Select } from './ui';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session-context';
import { useMembers, useInvalidateWorkspace } from '../lib/use-workspace-data';

export function TaskForm({
  projectId,
  task,
  onClose,
}: {
  projectId: string;
  task?: Task;
  onClose: () => void;
}) {
  const session = useSession();
  const members = useMembers();
  const invalidate = useInvalidateWorkspace();
  const [form, setForm] = useState<TaskInput>({
    projectId,
    title: task?.title ?? '',
    assigneeId: task?.assigneeId ?? null,
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? null,
  });
  const mutation = useMutation({
    mutationFn: () => {
      const { projectId: project, ...fields } = form;
      return api<Task>(task ? `/tasks/${task.id}` : '/tasks', {
        method: task ? 'PATCH' : 'POST',
        body: task ? { ...fields, version: task.version } : { ...fields, projectId: project },
        csrfToken: session.csrfToken,
      });
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : {};
  function change<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <Modal
      title={task ? 'Edit task' : 'Make the next step clear'}
      description={
        task
          ? 'Changes are saved only if nobody else has edited this task.'
          : 'A small, specific task is a good place to start.'
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
          label="Task title"
          value={form.title}
          onChange={(event) => change('title', event.target.value)}
          required
          minLength={2}
          maxLength={160}
          autoFocus
          error={fields.title}
        />
        <div className="form-row">
          <Select
            label="Task status"
            value={form.status}
            onChange={(event) => change('status', taskStatusSchema.parse(event.target.value))}
            error={fields.status}
          >
            {Object.entries(taskStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) => change('priority', prioritySchema.parse(event.target.value))}
            error={fields.priority}
          >
            {prioritySchema.options.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0]!.toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <Select
          label="Assignee"
          value={form.assigneeId ?? ''}
          disabled={members.isPending || !canManage(session.workspace.role)}
          onChange={(event) => change('assigneeId', event.target.value || null)}
          error={fields.assigneeId}
        >
          <option value="">Unassigned</option>
          {members.data
            ?.filter((member) => member.role !== 'viewer')
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
        </Select>
        <Input
          label="Due date"
          type="date"
          value={form.dueDate ?? ''}
          onChange={(event) => change('dueDate', event.target.value || null)}
          error={fields.dueDate}
        />
        {members.isError ? (
          <ErrorNotice
            error={members.error}
            retry={() => {
              void members.refetch();
            }}
          />
        ) : null}
        {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={members.isPending || members.isError}
          >
            {task ? 'Save task' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
