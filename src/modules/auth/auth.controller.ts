import type { Request, Response } from 'express';
import { body, currentUserId } from '../../utils/request.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { authService } from './auth.service.js';

export const authController = {
  async register(req: Request, res: Response) {
    res.status(201).json(await authService.register(body<RegisterInput>(req)));
  },
  async login(req: Request, res: Response) {
    res.json(await authService.login(body<LoginInput>(req)));
  },
  async me(req: Request, res: Response) {
    res.json(await authService.me(currentUserId(req)));
  },
};
