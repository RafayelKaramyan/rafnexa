import {
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, LoaderCircle, Plus, ArrowUpRight } from 'lucide-react';
import {
  projectStatusLabels,
  taskStatusLabels,
  type ProjectStatus,
  type TaskStatus,
} from '@rafnexa/shared';
import { errorMessage } from '../lib/api';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="10" fill="currentColor" />
        <path d="M10 23V9h6.2a6 6 0 0 1 5.8 6h-4a2 2 0 0 0-2-2h-2v10Z" fill="#fff" />
        <circle cx="20" cy="21" r="2.3" fill="#fff" />
      </svg>
      {!compact && (
        <span>
          Rafnexa<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Button({
  children,
  className = '',
  variant = 'primary',
  loading = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  hint,
  children,
  id,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
export function Input({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  hint?: string;
}) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <Field label={label} id={id} error={error} {...(hint ? { hint } : {})}>
      <input
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
    </Field>
  );
}
export function Select({
  label,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string | undefined }) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <Field label={label} id={id} error={error}>
      <select
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {children}
      </select>
    </Field>
  );
}
export function Textarea({
  label,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string | undefined }) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <Field label={label} id={id} error={error}>
      <textarea
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
    </Field>
  );
}
export function Status({ status }: { status: ProjectStatus | TaskStatus }) {
  const label =
    status in projectStatusLabels
      ? projectStatusLabels[status as ProjectStatus]
      : taskStatusLabels[status as TaskStatus];
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <span className={`avatar ${small ? 'avatar-small' : ''}`} aria-label={name}>
      {letters}
    </span>
  );
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{errorMessage(error)}</span>
      {retry ? (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
export function Loading({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol" aria-hidden="true">
        <Plus size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 tabIndex={-1}>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <span className="progress">
      <span
        className="progress-track"
        role="progressbar"
        aria-label="Completed tasks"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </span>
      <span>{value}%</span>
    </span>
  );
}
export function ArrowLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
    </button>
  );
}
