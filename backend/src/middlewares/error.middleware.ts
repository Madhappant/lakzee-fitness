import { Request, Response, NextFunction, RequestHandler } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ZodError } from 'zod';
import multer from 'multer';
import { AuthRequest } from './auth.middleware';
import { AppError } from '../utils/errors';
import { errorTracker } from '../utils/error-tracker';
import { logger } from '../utils/logger';

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
      success: false,
      status: 'error',
      ...(err.code ? { code: err.code } : {}),
      message: err.message,
      ...(err.errors !== undefined ? { errors: err.errors } : {}),
    });
  }

  if (err instanceof ZodError || (typeof err === 'object' && err !== null && (err as Error).name === 'ZodError')) {
    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'Validation failed',
      errors: (err as ZodError).issues ?? (err as { errors?: unknown }).errors,
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      status: 'error',
      message: err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds the 5MB limit.' : err.message,
    });
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target as string[] | undefined;
      return res.status(400).json({
        success: false,
        status: 'error',
        message: `A record with this ${target ? target.join(', ') : 'value'} already exists. Please use a unique value.`,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'Requested record was not found.',
      });
    }
  }

  const errObj = err as { status?: number; statusCode?: number; type?: string; message?: string; stack?: string };
  if (errObj?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      status: 'error',
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds allowed size limit.',
    });
  }
  if (errObj?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Malformed JSON request body.',
    });
  }
  if (errObj?.message?.startsWith('CORS blocked for origin:')) {
    return res.status(403).json({ success: false, status: 'error', message: errObj.message });
  }
  if (errObj?.message?.startsWith('Invalid file type.')) {
    return res.status(400).json({ success: false, status: 'error', message: errObj.message });
  }

  const rawStatus = errObj?.statusCode ?? errObj?.status;
  const statusCode = typeof rawStatus === 'number' && rawStatus >= 400 ? rawStatus : 500;
  const authReq = req as AuthRequest;

  logger.error('Unhandled request exception', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    userRole: authReq.user?.role,
    error: err,
  });

  if (statusCode >= 500) {
    errorTracker.captureException(err, {
      source: 'backend',
      method: req.method,
      route: req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path,
      statusCode,
      userRole: authReq.user?.role,
      userId: authReq.user?.id,
      payload: req.body,
    });
  }

  const message =
    statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : errObj?.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && errObj?.stack ? { stack: errObj.stack } : {}),
  });
};
