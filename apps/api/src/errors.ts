export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function notFound(): never {
  throw new HttpError(404, 'NOT_FOUND', 'The requested resource is unavailable.');
}
export function forbidden(): never {
  throw new HttpError(403, 'FORBIDDEN', 'You do not have permission for this action.');
}
