import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import { projects, tasks, type ProjectStatus } from '../../db/schema.js';
import { OPEN_STATUSES } from '../tasks/task-rules.js';

export const projectRepository = {
  async create(
    conn: DbOrTx,
    data: { teamId: string; name: string; description?: string; createdById: string },
  ) {
    const [row] = await conn.insert(projects).values(data).returning();
    return row!;
  },

  async findById(conn: DbOrTx, id: string) {
    const [row] = await conn.select().from(projects).where(eq(projects.id, id)).limit(1);
    return row;
  },

  async listByTeam(
    conn: DbOrTx,
    teamId: string,
    opts: { status?: ProjectStatus; page: number; limit: number },
  ) {
    const where = and(
      eq(projects.teamId, teamId),
      opts.status ? eq(projects.status, opts.status) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      conn
        .select()
        .from(projects)
        .where(where)
        .orderBy(desc(projects.createdAt))
        .limit(opts.limit)
        .offset((opts.page - 1) * opts.limit),
      conn.select({ value: count() }).from(projects).where(where),
    ]);
    return { rows, total: total?.value ?? 0 };
  },

  async update(
    conn: DbOrTx,
    id: string,
    data: { name?: string; description?: string | null; status?: ProjectStatus },
  ) {
    const [row] = await conn.update(projects).set(data).where(eq(projects.id, id)).returning();
    return row!;
  },

  async delete(conn: DbOrTx, id: string) {
    await conn.delete(projects).where(eq(projects.id, id));
  },

  async countOpenTasks(conn: DbOrTx, projectId: string) {
    const [row] = await conn
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), inArray(tasks.status, [...OPEN_STATUSES])));
    return row?.value ?? 0;
  },

  /** Resumo de tarefas por status, usado no detalhe do projeto. */
  async taskSummary(conn: DbOrTx, projectId: string) {
    return conn
      .select({ status: tasks.status, total: count() })
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .groupBy(tasks.status);
  },
};
