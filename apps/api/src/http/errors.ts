import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import type { ApiErrorBody } from '@vidcraft/shared';

/** Throw this from anywhere in a request; the error handler turns it into a JSON response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Validates untrusted input, throwing a 400 with field-level details on failure. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(400, 'validation_error', 'Invalid request', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'not_found', 'Route not found'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    res.status(err.status).json(body);
    return;
  }
  // express.json() rejects bad bodies with a status on the error object.
  if (typeof err?.status === 'number' && err.status < 500) {
    res.status(err.status).json({ error: { code: 'bad_request', message: err.message } } satisfies ApiErrorBody);
    return;
  }
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } } satisfies ApiErrorBody);
};
