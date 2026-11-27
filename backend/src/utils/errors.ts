export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
    public readonly errors?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST', errors?: unknown) {
    super(message, 400, code, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden, insufficient permissions', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class UpstreamError extends AppError {
  constructor(message: string, statusCode = 502, code = 'UPSTREAM_ERROR') {
    super(message, statusCode, code);
  }
}
