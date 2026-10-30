import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import { users, type User } from '../../db/schema.js';

/** Dados públicos do usuário (nunca devolvemos o hash da senha). */
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'createdAt'>;

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  createdAt: u.createdAt,
});

export const userRepository = {
  async findByEmail(conn: DbOrTx, email: string): Promise<User | undefined> {
    const [row] = await conn.select().from(users).where(eq(users.email, email)).limit(1);
    return row;
  },

  async findById(conn: DbOrTx, id: string): Promise<User | undefined> {
    const [row] = await conn.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  },

  async create(
    conn: DbOrTx,
    data: { name: string; email: string; passwordHash: string },
  ): Promise<User> {
    const [row] = await conn.insert(users).values(data).returning();
    return row!;
  },
};
