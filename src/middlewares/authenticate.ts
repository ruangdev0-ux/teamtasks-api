import type { RequestHandler } from 'express';
import { unauthorized } from '../errors/app-error.js';
import { verifyToken } from '../lib/jwt.js';

/** Exige o header Authorization: Bearer <token> e coloca o usuário em req.user. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Envie o token no header Authorization: Bearer <token>.');
  }
  try {
    const payload = verifyToken(header.slice('Bearer '.length).trim());
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    throw unauthorized('Token inválido ou expirado.');
  }
};
