import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Valida body, params e/ou query com Zod antes de chegar ao controller.
 * Os dados validados (já convertidos, ex.: "10" -> 10) ficam em req.validated.
 */
export interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    req.validated = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
    };
    next();
  };
