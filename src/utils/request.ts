import type { Request } from 'express';
import { unauthorized } from '../errors/app-error.js';

/** Id do usuário autenticado (o middleware authenticate garante que existe). */
export function currentUserId(req: Request): string {
  if (!req.user) throw unauthorized();
  return req.user.id;
}

/** Dados já validados pelo middleware validate(). */
export const body = <T>(req: Request) => req.validated?.body as T;
export const params = <T>(req: Request) => req.validated?.params as T;
export const query = <T>(req: Request) => req.validated?.query as T;
