import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Runs Zod validation before controllers execute.
 * Stores sanitized query/params on `req.validated` because Express 5 exposes `req.query` as a getter.
 */
export const validateRequest = (schemas: ValidationSchemas): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const validated = req.validated ?? {};

      if (schemas.body) {
        const parsedBody = schemas.body.parse(req.body);
        req.body = parsedBody;
        validated.body = parsedBody;
      }

      if (schemas.query) {
        validated.query = schemas.query.parse(req.query);
      }

      if (schemas.params) {
        validated.params = schemas.params.parse(req.params);
      }

      req.validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};
