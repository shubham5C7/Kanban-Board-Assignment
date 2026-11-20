import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[Error Handler]', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'validation_error',
      message: 'Invalid request input',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (err.name === 'VersionError') {
    res.status(409).json({
      code: 'version_conflict',
      message: 'This record changed while you were saving. Reload the latest version and retry.',
    });
    return;
  }

  if (err.name === 'CastError' || err.name === 'BSONError' || err.message?.includes('must be a 24 character hex string')) {
    res.status(400).json({
      code: 'invalid_id',
      message: 'Invalid resource ID provided',
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    code: err.code || 'internal_server_error',
    message: err.message || 'An unexpected error occurred',
    details: err.details,
  });
}
