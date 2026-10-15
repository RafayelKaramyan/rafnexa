import type { ApiErrorBody } from '@rafnexa/shared';
import { ApiError } from './api-error';
import { isLocalDemo } from './demo-config';
export { ApiError } from './api-error';

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  csrfToken?: string;
  signal?: AbortSignal;
};
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (isLocalDemo) {
    options.signal?.throwIfAborted();
    const { requestLocalDemo } = await import('./local-demo');
    options.signal?.throwIfAborted();
    return requestLocalDemo<T>(path, options);
  }
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.csrfToken ? { 'X-CSRF-Token': options.csrfToken } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unexpected response. Please try again.',
    );
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('rafnexa:session-expired'));
    const error = data && typeof data === 'object' && 'error' in data ? data.error : null;
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      const body = error as ApiErrorBody['error'];
      throw new ApiError(
        response.status,
        body.code,
        body.message,
        body.fields ?? {},
        body.requestId,
      );
    }
    throw new ApiError(response.status, 'REQUEST_FAILED', 'Unable to complete this request.');
  }
  return data as T;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
