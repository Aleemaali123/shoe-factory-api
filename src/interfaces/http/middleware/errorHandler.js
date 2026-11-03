import { AppError } from '../../../domain/errors.js';

export function errorHandler(error, _req, res, _next) {
  const status = error instanceof AppError ? error.status : 500;
  const message = error instanceof AppError ? error.message : 'Something went wrong. Try again.';
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
}
