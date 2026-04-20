import { Request, Response, NextFunction } from 'express';

// Express identifies error-handling middleware by the 4-argument signature.
// If any parameter is removed, Express treats it as regular middleware and
// the function will never receive errors passed via next(err).
//
// The underscore prefix (_req, _next) suppresses TypeScript's "unused variable"
// warning without disabling strict mode. This is a common TypeScript convention.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  console.error('[Error]', err.stack);

  res.status(500).json({
    error: err.message || 'Internal server error',
  });
}
