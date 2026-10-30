import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

/** Pool de conexões compartilhado por toda a aplicação. */
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
/** Tipo aceito pelos repositórios: a conexão normal ou uma transação. */
export type DbOrTx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
