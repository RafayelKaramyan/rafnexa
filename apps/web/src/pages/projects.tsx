import { useState, useDeferredValue } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { canManage, projectStatusLabels, type Page, type Project } from '@rafnexa/shared';
import { Button, EmptyState, ErrorNotice, Loading, PageHeading } from '../components/ui';
import { ProjectForm } from '../components/project-form';
import { ProjectTable } from '../components/project-table';
import { api } from '../lib/api';
import { useSession } from '../lib/session-context';

export default function Projects() {
  const session = useSession();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const params = new URLSearchParams({
    q: deferredSearch,
    page: String(page),
    pageSize: '10',
    ...(status ? { status } : {}),
  });
  const query = useQuery({
    queryKey: [session.workspace.id, 'projects', deferredSearch, status, page],
    queryFn: ({ signal }) => api<Page<Project>>(`/projects?${params}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <>
      <PageHeading
        eyebrow="MAKE ROOM FOR THE WORK"
        title="Every project. One place"
        description="From the first idea to the final handoff."
        action={
          canManage(session.workspace.role) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              New project
            </Button>
          ) : undefined
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor="project-search">
              Search projects
            </label>
            <input
              id="project-search"
              placeholder="Search projects or clients…"
              value={search}
              maxLength={100}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="toolbar-right">
            <label className="sr-only" htmlFor="project-status-filter">
              Filter by status
            </label>
            <select
              id="project-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(projectStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="result-count">{total} projects</span>
          </div>
        </div>
        {query.isPending ? (
          <Loading label="Loading projects…" />
        ) : query.isError ? (
          <ErrorNotice
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : query.data?.items.length ? (
          <div
            aria-busy={query.isFetching}
            className={query.isPlaceholderData ? 'table-updating' : ''}
          >
            <ProjectTable projects={query.data.items} />
          </div>
        ) : (
          <EmptyState
            title={search || status ? 'No projects match' : 'Your next project starts here'}
            description={
              search || status
                ? 'Try a different search or status.'
                : 'Give your team a clear starting point.'
            }
            action={
              search || status ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setStatus('');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : canManage(session.workspace.role) ? (
                <Button onClick={() => setCreating(true)}>Create project</Button>
              ) : undefined
            }
          />
        )}
        <div className="pagination">
          <span>
            {total
              ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} of ${total}`
              : '0 projects'}
          </span>
          <div>
            <Button
              variant="ghost"
              aria-label="Previous page"
              disabled={page <= 1 || query.isPlaceholderData}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              variant="ghost"
              aria-label="Next page"
              disabled={page >= pages || query.isPlaceholderData}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      {creating ? <ProjectForm onClose={() => setCreating(false)} /> : null}
    </>
  );
}
