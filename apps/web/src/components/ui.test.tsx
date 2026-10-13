// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Project } from '@rafnexa/shared';
import { Input, ErrorNotice } from './ui';
import { ProjectTable } from './project-table';

afterEach(cleanup);
describe('accessible workspace components', () => {
  it('connects validation feedback to a labeled input', () => {
    render(<Input label="Project name" error="Provide at least two characters." />);
    const input = screen.getByLabelText('Project name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Provide at least two characters.');
    expect(screen.getByRole('alert')).toHaveTextContent('Provide at least two characters.');
  });
  it('offers an actionable retry after a request fails', async () => {
    const retry = vi.fn();
    render(<ErrorNotice error={new Error('The request failed.')} retry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The request failed.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('exposes navigation, table headings and progress without relying on color', () => {
    const project: Project = {
      id: 'project-id',
      name: 'Customer portal',
      description: '',
      clientId: null,
      clientName: null,
      status: 'active',
      dueDate: null,
      ownerId: 'owner-id',
      ownerName: 'Maya Chen',
      taskCount: 4,
      completedTasks: 1,
      progress: 25,
      createdAt: '2026-10-01T00:00:00Z',
    };
    render(
      <MemoryRouter>
        <ProjectTable projects={[project]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('columnheader', { name: 'Project' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Customer portal' })).toHaveAttribute(
      'href',
      '/projects/project-id',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('Active')).toBeVisible();
    expect(screen.getByText('No due date')).toBeVisible();
  });
});
