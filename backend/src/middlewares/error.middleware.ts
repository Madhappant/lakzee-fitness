import { Request, Response, NextFunction, RequestHandler } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../utils/errors';

/**
 * Wraps async Express handlers so rejected promises always route to global error middleware.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  void _next;

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      ...(err.code ? { code: err.code } : {}),
      message: err.message,
      ...(err.errors !== undefined ? { errors: err.errors } : {}),
    });
  }

  if (err instanceof ZodError || (typeof err === 'object' && err !== null && (err as Error).name === 'ZodError')) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: (err as ZodError).issues ?? (err as { errors?: unknown }).errors,
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      status: 'error',
      message: err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds the 5MB limit.' : err.message,
    });
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target as string[] | undefined;
      return res.status(400).json({
        status: 'error',
        message: `A record with this ${target ? target.join(', ') : 'value'} already exists. Please use a unique value.`,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        status: 'error',
        message: 'Requested record was not found.',
      });
    }
  }

  const errObj = err as { status?: number; message?: string; stack?: string };
  if (errObj?.message?.startsWith('CORS blocked for origin:')) {
    return res.status(403).json({ status: 'error', message: errObj.message });
  }
  if (errObj?.message?.startsWith('Invalid file type.')) {
    return res.status(400).json({ status: 'error', message: errObj.message });
  }

  const statusCode = typeof errObj?.status === 'number' && errObj.status >= 400 ? errObj.status : 500;
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, errObj?.stack || err);

  const message =
    statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : errObj?.message || 'Internal Server Error';

  return res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && errObj?.stack ? { stack: errObj.stack } : {}),
  });
};
