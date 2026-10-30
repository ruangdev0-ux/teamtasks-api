import { and, asc, count, eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import { projects, teamMembers, teams, users, type TeamRole } from '../../db/schema.js';

export const teamRepository = {
  async create(conn: DbOrTx, data: { name: string; description?: string; createdById: string }) {
    const [row] = await conn.insert(teams).values(data).returning();
    return row!;
  },

  async findById(conn: DbOrTx, id: string) {
    const [row] = await conn.select().from(teams).where(eq(teams.id, id)).limit(1);
    return row;
  },

  async update(conn: DbOrTx, id: string, data: { name?: string; description?: string | null }) {
    const [row] = await conn.update(teams).set(data).where(eq(teams.id, id)).returning();
    return row!;
  },

  async delete(conn: DbOrTx, id: string) {
    await conn.delete(teams).where(eq(teams.id, id));
  },

  /** Equipes das quais o usuário participa, com o papel dele em cada uma. */
  async listForUser(conn: DbOrTx, userId: string) {
    return conn
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        role: teamMembers.role,
        createdAt: teams.createdAt,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId))
      .orderBy(asc(teams.name));
  },

  async countProjects(conn: DbOrTx, teamId: string) {
    const [row] = await conn
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.teamId, teamId));
    return row?.value ?? 0;
  },
};

export const memberRepository = {
  async add(conn: DbOrTx, data: { teamId: string; userId: string; role: TeamRole }) {
    const [row] = await conn.insert(teamMembers).values(data).returning();
    return row!;
  },

  async find(conn: DbOrTx, teamId: string, userId: string) {
    const [row] = await conn
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);
    return row;
  },

  async list(conn: DbOrTx, teamId: string) {
    return conn
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(users.name));
  },

  async updateRole(conn: DbOrTx, teamId: string, userId: string, role: TeamRole) {
    const [row] = await conn
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .returning();
    return row!;
  },

  async remove(conn: DbOrTx, teamId: string, userId: string) {
    await conn
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  },

  async countOwners(conn: DbOrTx, teamId: string) {
    const [row] = await conn
      .select({ value: count() })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'OWNER')));
    return row?.value ?? 0;
  },
};
