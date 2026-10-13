import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderKanban } from 'lucide-react';
import type { Project } from '@rafnexa/shared';
import { Avatar, Progress, Status } from './ui';
import { formatDate } from '../lib/format';

export function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <div className="table-scroll">
      <table className="project-table">
        <caption className="sr-only">Projects, ownership and delivery progress</caption>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Status</th>
            <th scope="col">Progress</th>
            <th scope="col">Owner</th>
            <th scope="col">Due date</th>
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => (
            <tr key={project.id}>
              <td>
                <Link to={`/projects/${project.id}`} className="project-name-link">
                  <span className={`project-icon project-color-${index % 4}`}>
                    <FolderKanban size={17} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.clientName ?? 'Internal project'}</small>
                  </span>
                </Link>
              </td>
              <td>
                <Status status={project.status} />
              </td>
              <td>
                <Progress value={project.progress} />
              </td>
              <td>
                <span className="table-owner">
                  <Avatar name={project.ownerName} small />
                  <span>{project.ownerName.split(' ')[0]}</span>
                </span>
              </td>
              <td className="date-cell">{formatDate(project.dueDate)}</td>
              <td>
                <Link
                  to={`/projects/${project.id}`}
                  className="icon-button"
                  aria-label={`Open ${project.name}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
