import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Plus,
  FolderKanban,
  CheckCheck,
  CalendarDays,
  Flag,
  ArrowRight,
} from 'lucide-react';
import { canManage, type Dashboard } from '@rafnexa/shared';
import { Button, EmptyState, ErrorNotice, Loading, PageHeading, Progress } from '../components/ui';
import { ProjectTable } from '../components/project-table';
import { ProjectForm } from '../components/project-form';
import { useSession } from '../lib/session-context';
import { api } from '../lib/api';
import { formatDate, relativeTime } from '../lib/format';

export default function Overview() {
  const session = useSession();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: [session.workspace.id, 'dashboard'],
    queryFn: ({ signal }) => api<Dashboard>('/dashboard', { signal }),
  });
  const data = query.data;
  const name = session.user.name.split(' ')[0];
  const max = Math.max(1, ...(data?.throughput.map((week) => week.completed) ?? []));
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORK, IN FOCUS"
        title={`A clear view, ${name}`}
        description="Everything moving. Nothing slipping through."
        action={
          canManage(session.workspace.role) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              New project
            </Button>
          ) : undefined
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : data ? (
        <>
          <section className="metric-grid" aria-label="Workspace metrics">
            {[
              {
                label: 'Active projects',
                value: data.activeProjects,
                detail: 'Currently in delivery',
                icon: FolderKanban,
                color: 'blue',
              },
              {
                label: 'Open tasks',
                value: data.openTasks,
                detail: 'Across your workspace',
                icon: CheckCheck,
                color: 'purple',
              },
              {
                label: 'Due this week',
                value: data.dueThisWeek,
                detail: 'Next 7 days · UTC',
                icon: CalendarDays,
                color: 'amber',
              },
              {
                label: 'Projects at risk',
                value: data.atRisk,
                detail: 'Need a closer look',
                icon: Flag,
                color: 'rose',
              },
            ].map(({ label, value, detail, icon: Icon, color }, i) => (
              <article
                className={`metric-card metric-${color}`}
                key={label}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="metric-top">
                  <span>{label}</span>
                  <span className="metric-icon">
                    <Icon size={17} />
                  </span>
                </div>
                <strong className="metric-value">{value.toString().padStart(2, '0')}</strong>
                <span className="metric-detail">
                  <span className="metric-dot" />
                  {detail}
                </span>
              </article>
            ))}
          </section>
          <div className="overview-panels">
            <section className="panel throughput-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">CONSISTENCY COMPOUNDS</p>
                  <h2>Small wins. Steady momentum.</h2>
                </div>
                <span className="panel-tag">8 weeks</span>
              </div>
              <div className="chart-legend">
                <span />
                <span>Completed tasks</span>
                <strong>
                  {data.throughput.reduce((sum, week) => sum + week.completed, 0)}{' '}
                  <small>total</small>
                </strong>
              </div>
              <div
                className="bar-chart"
                role="img"
                aria-label={`Completed tasks over eight weeks. ${data.throughput.map((week) => `${formatDate(week.week)}: ${week.completed}`).join('. ')}`}
              >
                <div className="chart-grid" aria-hidden="true">
                  <span>{max}</span>
                  <span>{Math.round(max / 2)}</span>
                  <span>0</span>
                </div>
                <div className="chart-bars">
                  {data.throughput.map((week, index) => (
                    <div className="bar-column" key={week.week}>
                      <div className="bar-region">
                        <span
                          className={`chart-bar ${index === 7 ? 'current' : ''}`}
                          style={{ height: `${(week.completed / max) * 100}%` }}
                        >
                          <span className="bar-value">{week.completed}</span>
                        </span>
                      </div>
                      <span className="bar-label">{formatDate(week.week)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="chart-note">
                One task completed is one less thing to keep in your head.
              </p>
            </section>
            <section className="panel milestones-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">WHAT’S NEXT</p>
                  <h2>On the horizon.</h2>
                </div>
                <span className="horizon-icon">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              {data.milestones.length ? (
                <div className="milestone-list">
                  {data.milestones.map((project, index) => (
                    <button
                      className="milestone"
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <span className={`milestone-dot project-color-${index % 4}`} />
                      <span className="milestone-body">
                        <span>
                          <strong>{project.name}</strong>
                          <small>{formatDate(project.dueDate)}</small>
                        </span>
                        <span className="milestone-client">
                          {project.clientName ?? 'Internal project'}
                        </span>
                        <Progress value={project.progress} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="A little breathing room"
                  description="Set a project due date to see upcoming milestones here."
                />
              )}
            </section>
          </div>
          <section className="panel projects-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">THE BIG PICTURE</p>
                <h2>Work in motion.</h2>
              </div>
              <button className="text-link" onClick={() => navigate('/projects')}>
                All projects
                <ArrowRight size={15} />
              </button>
            </div>
            {data.projects.length ? (
              <ProjectTable projects={data.projects} />
            ) : (
              <EmptyState
                title="Start with one project"
                description="Define the outcome, add your tasks and build from there."
                action={
                  canManage(session.workspace.role) ? (
                    <Button onClick={() => setCreating(true)}>Create your first project</Button>
                  ) : undefined
                }
              />
            )}
          </section>
          {data.activity.length ? (
            <section className="activity-strip" aria-label="Recent activity">
              <span className="activity-label">
                <span />
                LATEST ACTIVITY
              </span>
              <span>
                <strong>{data.activity[0]?.actorName}</strong>{' '}
                {data.activity[0]?.message.toLowerCase()}
              </span>
              <small>{data.activity[0] ? relativeTime(data.activity[0].createdAt) : ''}</small>
            </section>
          ) : null}
        </>
      ) : null}
      {creating ? <ProjectForm onClose={() => setCreating(false)} /> : null}
    </>
  );
}
