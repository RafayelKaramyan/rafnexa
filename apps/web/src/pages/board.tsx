import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical, Archive, CalendarDays, Columns3, Check } from 'lucide-react';
import {
  canManage,
  canEditTask,
  taskStatusSchema,
  taskStatusLabels,
  type Task,
  type TaskStatus,
} from '@rafnexa/shared';
import { Avatar, Button, EmptyState, ErrorNotice, Loading, PageHeading } from '../components/ui';
import { TaskForm } from '../components/task-form';
import { Confirm } from '../components/confirm';
import { api } from '../lib/api';
import { useSession } from '../lib/session-context';
import { useInvalidateWorkspace, useProjectOptions } from '../lib/use-workspace-data';
import { formatDate } from '../lib/format';

type Move = { task: Task; status: TaskStatus };
export default function Board() {
  const session = useSession();
  const projects = useProjectOptions();
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') || projects.data?.[0]?.id || '';
  const selected = projects.data?.find((project) => project.id === projectId);
  const unavailable = projects.isSuccess && Boolean(projectId) && !selected;
  const [editing, setEditing] = useState<Task | true | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<TaskStatus>('todo');
  const [archiving, setArchiving] = useState<Task | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const client = useQueryClient();
  const invalidate = useInvalidateWorkspace();
  const key = [session.workspace.id, 'tasks', projectId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<Task[]>(`/projects/${projectId}/tasks`, { signal }),
    enabled: Boolean(selected),
    refetchInterval: 15_000,
  });
  const move = useMutation({
    mutationFn: ({ task, status }: Move) =>
      api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: { status, version: task.version },
        csrfToken: session.csrfToken,
      }),
    onMutate: async ({ task, status }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Task[]>(key);
      client.setQueryData<Task[]>(key, (current) =>
        current?.map((item) =>
          item.id === task.id ? { ...item, status, version: item.version + 1 } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      setAnnouncement('The task could not be moved. The board has been refreshed.');
    },
    onSuccess: (task) => {
      setAnnouncement(`${task.title} moved to ${taskStatusLabels[task.status]}.`);
    },
    onSettled: () => invalidate(),
  });
  function moveTask(task: Task, status: TaskStatus) {
    if (
      status !== task.status &&
      !move.isPending &&
      canEditTask(session.workspace.role, session.user.id, task.assigneeId)
    )
      move.mutate({ task, status });
  }
  return (
    <>
      <PageHeading
        eyebrow="LESS FRICTION. MORE FLOW."
        title="The next move is clear"
        description="Small steps, shared context, visible progress."
        action={
          canManage(session.workspace.role) && selected ? (
            <Button
              onClick={() => {
                setCreatingStatus('todo');
                setEditing(true);
              }}
            >
              <Plus size={16} />
              New task
            </Button>
          ) : undefined
        }
      />
      <div className="board-toolbar">
        <div className="board-project">
          <Columns3 size={18} />
          <label className="sr-only" htmlFor="board-project-select">
            Board project
          </label>
          <select
            id="board-project-select"
            value={projectId}
            disabled={projects.isPending || move.isPending}
            onChange={(event) => {
              setParams({ project: event.target.value }, { replace: true });
              setDragged(null);
              move.reset();
            }}
          >
            {unavailable ? <option value={projectId}>Unavailable project</option> : null}
            {projects.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {selected ? (
            <span className="board-task-count">{query.data?.length ?? 0} tasks</span>
          ) : null}
        </div>
        <span className="board-hint">Drag a card or use its Move control.</span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {projects.isError ? (
        <ErrorNotice
          error={projects.error}
          retry={() => {
            void projects.refetch();
          }}
        />
      ) : null}
      {move.isError ? (
        <ErrorNotice
          error={move.error}
          retry={() => {
            move.reset();
            void query.refetch();
          }}
        />
      ) : null}
      {projects.isError ? null : projects.isPending || Boolean(selected && query.isPending) ? (
        <Loading label="Loading board…" />
      ) : unavailable ? (
        <EmptyState
          title="This project is unavailable"
          description="It may have been archived. Choose another project above or explore your projects."
          action={
            <Link className="button button-secondary" to="/projects">
              Explore projects
            </Link>
          }
        />
      ) : !projectId ? (
        <EmptyState
          title="A board begins with a project"
          description="Create a project, then break the work into clear steps."
          action={
            <Link className="button button-primary" to="/projects">
              Explore projects
            </Link>
          }
        />
      ) : query.isError ? (
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <section className="board-grid" aria-label={`${selected?.name ?? 'Project'} task board`}>
          {taskStatusSchema.options.map((status) => {
            const tasks = query.data?.filter((task) => task.status === status) ?? [];
            return (
              <section
                key={status}
                className={`board-column column-${status} ${dropTarget === status ? 'drop-target' : ''}`}
                aria-label={`${taskStatusLabels[status]} column`}
                onDragOver={(event) => {
                  if (dragged && !move.isPending) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDropTarget(status);
                  }
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    setDropTarget(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData('application/x-rafnexa-task');
                  const task = query.data?.find((task) => task.id === id);
                  setDragged(null);
                  setDropTarget(null);
                  if (task) moveTask(task, status);
                }}
              >
                <header className="column-heading">
                  <span className="column-status-dot" />
                  <h2>{taskStatusLabels[status]}</h2>
                  <span className="column-count">{tasks.length}</span>
                  {canManage(session.workspace.role) ? (
                    <button
                      className="icon-button"
                      aria-label={`Add task to ${taskStatusLabels[status]}`}
                      onClick={() => {
                        setCreatingStatus(status);
                        setEditing(true);
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  ) : null}
                </header>
                <div className="column-body">
                  {tasks.map((task) => {
                    const editable = canEditTask(
                      session.workspace.role,
                      session.user.id,
                      task.assigneeId,
                    );
                    return (
                      <article
                        key={task.id}
                        className={`task-card ${dragged === task.id ? 'dragging' : ''} ${task.status === 'done' ? 'completed-task' : ''}`}
                        draggable={editable && !move.isPending}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('application/x-rafnexa-task', task.id);
                          event.dataTransfer.effectAllowed = 'move';
                          setDragged(task.id);
                        }}
                        onDragEnd={() => {
                          setDragged(null);
                          setDropTarget(null);
                        }}
                      >
                        <div className="task-card-top">
                          <span className={`priority priority-${task.priority}`}>
                            <span />
                            {task.priority}
                          </span>
                          {editable ? (
                            <GripVertical size={15} className="drag-handle" aria-hidden="true" />
                          ) : null}
                        </div>
                        {editable ? (
                          <button
                            className="task-title"
                            onClick={() => setEditing(task)}
                            aria-label={`Edit ${task.title}`}
                          >
                            {task.title}
                          </button>
                        ) : (
                          <h3 className="task-title">{task.title}</h3>
                        )}
                        <div className="task-meta">
                          <span>
                            <CalendarDays size={12} />
                            {formatDate(task.dueDate)}
                          </span>
                          {task.assigneeName ? (
                            <Avatar name={task.assigneeName} small />
                          ) : (
                            <span className="unassigned">Unassigned</span>
                          )}
                        </div>
                        <div className="task-card-footer">
                          {editable ? (
                            <select
                              aria-label={`Move ${task.title}`}
                              value={task.status}
                              disabled={move.isPending}
                              onChange={(event) =>
                                moveTask(task, taskStatusSchema.parse(event.target.value))
                              }
                            >
                              {taskStatusSchema.options.map((value) => (
                                <option key={value} value={value}>
                                  {taskStatusLabels[value]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="read-only-label">Read only</span>
                          )}
                          {canManage(session.workspace.role) ? (
                            <button
                              className="icon-button"
                              aria-label={`Archive ${task.title}`}
                              onClick={() => setArchiving(task)}
                              disabled={move.isPending}
                            >
                              <Archive size={13} />
                            </button>
                          ) : task.status === 'done' ? (
                            <Check size={14} aria-hidden="true" />
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                  {!tasks.length ? (
                    <div className="column-empty">A little space for what’s next.</div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </section>
      )}
      {editing ? (
        <TaskForm
          projectId={projectId}
          initialStatus={creatingStatus}
          {...(editing === true ? {} : { task: editing })}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {archiving ? (
        <Confirm
          title="Archive this task?"
          description={`“${archiving.title}” will disappear from the active board.`}
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            await api(`/tasks/${archiving.id}`, {
              method: 'DELETE',
              body: { version: archiving.version },
              csrfToken: session.csrfToken,
            });
            await invalidate();
          }}
        />
      ) : null}
    </>
  );
}
