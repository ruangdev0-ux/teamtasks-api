/**
 * Aplica as migrations SQL da pasta /drizzle no banco de DATABASE_URL.
 * Uso: npm run db:migrate
 */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.info('Migrations aplicadas com sucesso.');
}

main()
  .catch((error) => {
    console.error('Falha ao aplicar migrations:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
