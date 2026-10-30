import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      validated?: { body?: unknown; params?: unknown; query?: unknown };
    }
  }
}

export {};
