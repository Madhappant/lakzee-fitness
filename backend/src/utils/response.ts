import { Response } from 'express';

export interface ResponseMeta {
  total?: number;
  count?: number;
  sort?: string;
  cached?: boolean;
  [key: string]: unknown;
}

export interface ApiSuccessEnvelope<T = unknown, M extends ResponseMeta = ResponseMeta> {
  success: true;
  status: 'success';
  data: T;
  message?: string;
  meta?: M;
}

/**
 * Builds the canonical JSON response envelope while preserving `status: 'success'`
 * alongside `success: true` for backwards compatibility with legacy consumers.
 */
export function buildSuccessEnvelope<T, M extends ResponseMeta = ResponseMeta>(
  data: T,
  options?: { message?: string; meta?: M }
): ApiSuccessEnvelope<T, M> {
  return {
    success: true,
    status: 'success',
    data,
    ...(options?.message ? { message: options.message } : {}),
    ...(options?.meta ? { meta: options.meta } : {}),
  };
}

export function sendSuccess<T, M extends ResponseMeta = ResponseMeta>(
  res: Response,
  options: {
    data?: T;
    message?: string;
    meta?: M;
    statusCode?: number;
  }
): Response {
  const { data = null as T, message, meta, statusCode = 200 } = options;
  return res.status(statusCode).json(buildSuccessEnvelope(data, { message, meta }));
}
