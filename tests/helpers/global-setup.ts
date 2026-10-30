/**
 * Roda uma vez antes de todos os testes: aplica as migrations no banco de teste.
 * Os testes unitários não usam banco, mas o setup é rápido e mantém tudo simples.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://teamtasks:teamtasks@localhost:5432/teamtasks_test';
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  } finally {
    await pool.end();
  }
}
