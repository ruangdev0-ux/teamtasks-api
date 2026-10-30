/**
 * Erro de aplicação com código HTTP e código legível por máquina.
 * Os services lançam estes erros; o middleware de erro transforma em resposta JSON.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Autenticação necessária.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Você não tem permissão para esta ação.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} não encontrado(a).`);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
/** 422: a requisição é válida, mas viola uma regra de negócio. */
export const businessRule = (message: string, details?: unknown) =>
  new AppError(422, 'BUSINESS_RULE_VIOLATION', message, details);
