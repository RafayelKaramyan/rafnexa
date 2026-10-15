import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  canManage,
  prioritySchema,
  taskStatusSchema,
  taskStatusLabels,
  type Task,
  type TaskInput,
  type TaskStatus,
} from '@rafnexa/shared';
import { Modal } from './modal';
import { Button, ErrorNotice, Input, Select } from './ui';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session-context';
import { useMembers, useInvalidateWorkspace } from '../lib/use-workspace-data';

export function TaskForm({
  projectId,
  task,
  initialStatus = 'todo',
  onClose,
}: {
  projectId: string;
  task?: Task;
  initialStatus?: TaskStatus;
  onClose: () => void;
}) {
  const session = useSession();
  const members = useMembers();
  const invalidate = useInvalidateWorkspace();
  const formElement = useRef<HTMLFormElement>(null);
  const [version, setVersion] = useState(task?.version);
  const [form, setForm] = useState<TaskInput>({
    projectId,
    title: task?.title ?? '',
    assigneeId: task?.assigneeId ?? null,
    status: task?.status ?? initialStatus,
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? null,
  });
  const mutation = useMutation({
    mutationFn: () => {
      const { projectId: project, ...fields } = form;
      return api<Task>(task ? `/tasks/${task.id}` : '/tasks', {
        method: task ? 'PATCH' : 'POST',
        body: task ? { ...fields, version } : { ...fields, projectId: project },
        csrfToken: session.csrfToken,
      });
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') return invalidate();
    },
  });
  const latest = useMutation({
    mutationFn: async () => {
      const tasks = await api<Task[]>(`/projects/${projectId}/tasks`);
      const current = tasks.find((item) => item.id === task?.id);
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'This task is no longer available.');
      return current;
    },
    onSuccess: (current) => {
      setForm({
        projectId: current.projectId,
        title: current.title,
        status: current.status,
        priority: current.priority,
        assigneeId: current.assigneeId,
        dueDate: current.dueDate,
      });
      setVersion(current.version);
      mutation.reset();
      formElement.current?.querySelector<HTMLInputElement>('input')?.focus();
    },
  });
  const conflict = mutation.error instanceof ApiError && mutation.error.code === 'VERSION_CONFLICT';
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
        if (!mutation.isPending && !latest.isPending) onClose();
      }}
    >
      <form
        ref={formElement}
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!conflict && !latest.isPending && !mutation.isPending) mutation.mutate();
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
        {conflict ? (
          <div className="form-stack">
            <p className="field-hint">
              Your edits are still here. Load the latest saved version to review it before trying
              again. This replaces your unsaved edits.
            </p>
            <Button
              type="button"
              variant="secondary"
              loading={latest.isPending}
              onClick={() => latest.mutate()}
            >
              Load latest task
            </Button>
          </div>
        ) : latest.isSuccess ? (
          <p className="field-hint" role="status">
            Latest version loaded. Review the fields before saving.
          </p>
        ) : null}
        {latest.isError ? <ErrorNotice error={latest.error} /> : null}
        <div className="modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending || latest.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={members.isPending || members.isError || conflict || latest.isPending}
          >
            {task ? 'Save task' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
