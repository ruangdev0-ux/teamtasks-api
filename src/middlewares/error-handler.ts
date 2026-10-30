import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';

/**
 * Formato padrão de erro de toda a API:
 * { "error": { "code": "...", "message": "...", "details": ... } }
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: z.flattenError(err).fieldErrors,
      },
    });
    return;
  }

  // JSON malformado no corpo da requisição
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'JSON inválido no corpo da requisição.' },
    });
    return;
  }

  if (env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' },
  });
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não encontrada.` },
  });
};
