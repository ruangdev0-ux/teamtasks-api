import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Os testes de integração usam um banco PostgreSQL próprio (teamtasks_test).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://teamtasks:teamtasks@localhost:5432/teamtasks_test',
      JWT_SECRET: 'segredo-apenas-para-testes-com-mais-de-32-caracteres',
      JWT_EXPIRES_IN: '1h',
      BCRYPT_ROUNDS: '4',
    },
    globalSetup: ['tests/helpers/global-setup.ts'],
    // Integração compartilha o mesmo banco: rodar os arquivos em sequência evita conflito.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/db/seed.ts', 'src/server.ts'],
    },
  },
});
