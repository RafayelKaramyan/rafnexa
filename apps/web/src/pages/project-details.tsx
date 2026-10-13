import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Archive, CalendarDays, Edit3 } from 'lucide-react';
import { canManage, type Project, type Task } from '@rafnexa/shared';
import {
  Button,
  ErrorNotice,
  Loading,
  PageHeading,
  Avatar,
  Progress,
  Status,
  EmptyState,
} from '../components/ui';
import { ProjectForm } from '../components/project-form';
import { Confirm } from '../components/confirm';
import { useSession } from '../lib/session-context';
import { useInvalidateWorkspace } from '../lib/use-workspace-data';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

export default function ProjectDetails() {
  const { id } = useParams();
  const session = useSession();
  const navigate = useNavigate();
  const invalidate = useInvalidateWorkspace();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const query = useQuery({
    queryKey: [session.workspace.id, 'project', id],
    queryFn: ({ signal }) => api<Project>(`/projects/${id}`, { signal }),
    enabled: Boolean(id),
  });
  const tasks = useQuery({
    queryKey: [session.workspace.id, 'tasks', id],
    queryFn: ({ signal }) => api<Task[]>(`/projects/${id}/tasks`, { signal }),
    enabled: Boolean(id),
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const project = query.data;
  return (
    <>
      <Link to="/projects" className="back-link">
        <ArrowLeft size={16} />
        All projects
      </Link>
      <PageHeading
        eyebrow={project.clientName ?? 'INTERNAL PROJECT'}
        title={project.name}
        description={project.description || 'A shared space for the next piece of work.'}
        action={
          canManage(session.workspace.role) ? (
            <div className="heading-actions">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Edit3 size={15} />
                Edit project
              </Button>
              <Button
                variant="ghost"
                aria-label="Archive project"
                onClick={() => setArchiving(true)}
              >
                <Archive size={17} />
              </Button>
            </div>
          ) : undefined
        }
      />
      <section className="project-summary-grid">
        <div className="panel summary-item">
          <span>Status</span>
          <Status status={project.status} />
        </div>
        <div className="panel summary-item">
          <span>Delivery progress</span>
          <Progress value={project.progress} />
          <small>
            {project.completedTasks} of {project.taskCount} tasks completed
          </small>
        </div>
        <div className="panel summary-item">
          <span>Project owner</span>
          <strong className="table-owner">
            <Avatar name={project.ownerName} small />
            {project.ownerName}
          </strong>
        </div>
        <div className="panel summary-item">
          <span>Due date</span>
          <strong>
            <CalendarDays size={17} />
            {formatDate(project.dueDate)}
          </strong>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">NEXT STEPS, MADE CLEAR</p>
            <h2>The work behind the outcome.</h2>
          </div>
          <Link to={`/board?project=${project.id}`} className="button button-secondary">
            Open task board
            <ArrowRight size={16} />
          </Link>
        </div>
        {tasks.isPending ? (
          <Loading label="Loading tasks…" />
        ) : tasks.isError ? (
          <ErrorNotice
            error={tasks.error}
            retry={() => {
              void tasks.refetch();
            }}
          />
        ) : tasks.data?.length ? (
          <ul className="detail-task-list">
            {tasks.data.map((task) => (
              <li key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {task.assigneeName ?? 'Unassigned'} · {formatDate(task.dueDate)}
                  </small>
                </div>
                <Status status={task.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Turn plans into steps"
            description="Add the first task from the project board."
            action={
              <Link to={`/board?project=${project.id}`} className="button button-primary">
                Open board
              </Link>
            }
          />
        )}
      </section>
      {editing ? <ProjectForm project={project} onClose={() => setEditing(false)} /> : null}
      {archiving ? (
        <Confirm
          title="Archive this project?"
          description="This project and its tasks will disappear from active workspace views."
          onClose={() => setArchiving(false)}
          onConfirm={async () => {
            await api(`/projects/${project.id}`, {
              method: 'DELETE',
              csrfToken: session.csrfToken,
            });
            await invalidate();
            navigate('/projects', { replace: true });
          }}
        />
      ) : null}
    </>
  );
}
