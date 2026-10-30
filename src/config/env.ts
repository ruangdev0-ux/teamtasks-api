import { z } from '../docs/zod.js';

/**
 * Variáveis de ambiente validadas na inicialização.
 * Se algo estiver faltando ou inválido, a aplicação nem sobe — o erro aparece logo.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', z.flattenError(parsed.error).fieldErrors);
  throw new Error('Configuração de ambiente inválida. Veja o arquivo .env.example.');
}

export const env: Env = parsed.data;
