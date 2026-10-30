import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { authController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export const authRoutes = Router();

authRoutes.post('/register', validate({ body: registerSchema }), authController.register);
authRoutes.post('/login', validate({ body: loginSchema }), authController.login);
authRoutes.get('/me', authenticate, authController.me);
