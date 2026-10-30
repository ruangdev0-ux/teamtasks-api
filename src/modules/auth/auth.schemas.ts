import { z } from '../../docs/zod.js';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100).openapi({ example: 'Ana Souza' }),
    email: z.email().max(255).openapi({ example: 'ana@exemplo.com' }),
    password: z
      .string()
      .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
      .max(72, 'A senha pode ter no máximo 72 caracteres.')
      .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra.')
      .regex(/[0-9]/, 'A senha precisa ter pelo menos um número.')
      .openapi({ example: 'senhaSegura123' }),
  })
  .openapi('RegisterInput');

export const loginSchema = z
  .object({
    email: z.email().openapi({ example: 'ana@exemplo.com' }),
    password: z.string().min(1).openapi({ example: 'senhaSegura123' }),
  })
  .openapi('LoginInput');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
