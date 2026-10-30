import { db } from '../../db/client.js';
import { conflict, notFound, unauthorized } from '../../errors/app-error.js';
import { signToken } from '../../lib/jwt.js';
import { comparePassword, hashPassword } from '../../lib/password.js';
import { toPublicUser, userRepository } from '../users/user.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export const authService = {
  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();
    if (await userRepository.findByEmail(db, email)) {
      throw conflict('Já existe uma conta com este e-mail.');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create(db, { name: input.name, email, passwordHash });
    return { user: toPublicUser(user), token: signToken({ sub: user.id, email: user.email }) };
  },

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(db, input.email.toLowerCase());
    // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails existem.
    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      throw unauthorized('E-mail ou senha inválidos.');
    }
    return { user: toPublicUser(user), token: signToken({ sub: user.id, email: user.email }) };
  },

  async me(userId: string) {
    const user = await userRepository.findById(db, userId);
    if (!user) throw notFound('Usuário');
    return toPublicUser(user);
  },
};
