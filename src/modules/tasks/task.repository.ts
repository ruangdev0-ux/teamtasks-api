import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import {
  projects,
  taskHistory,
  tasks,
  users,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../db/schema.js';
import type { HistoryChange } from './task-history.js';
import { OPEN_STATUSES } from './task-rules.js';

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  /** id de um usuário, ou "none" para tarefas sem responsável */
  assigneeId?: string;
  dueFrom?: Date;
  dueTo?: Date;
  /** só tarefas abertas com prazo vencido */
  overdue?: boolean;
  /** busca no título (sem diferenciar maiúsculas) */
  q?: string;
  sort: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}

type TaskInsert = typeof tasks.$inferInsert;

const sortColumns = {
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  dueDate: tasks.dueDate,
  priority: tasks.priority,
} as const;

/** Monta o WHERE a partir dos filtros. Cada filtro é opcional. */
function buildFilters(f: TaskFilters): SQL[] {
  const conditions: SQL[] = [];
  if (f.status?.length) conditions.push(inArray(tasks.status, f.status));
  if (f.priority?.length) conditions.push(inArray(tasks.priority, f.priority));
  if (f.assigneeId === 'none') conditions.push(isNull(tasks.assigneeId));
  else if (f.assigneeId) conditions.push(eq(tasks.assigneeId, f.assigneeId));
  if (f.dueFrom) conditions.push(gte(tasks.dueDate, f.dueFrom));
  if (f.dueTo) conditions.push(lte(tasks.dueDate, f.dueTo));
  if (f.overdue) {
    conditions.push(lt(tasks.dueDate, new Date()));
    conditions.push(inArray(tasks.status, [...OPEN_STATUSES]));
  }
  if (f.q) conditions.push(ilike(tasks.title, `%${f.q.replace(/[%_\\]/g, '\\$&')}%`));
  return conditions;
}

/** Campos devolvidos na listagem, incluindo o nome do responsável. */
const taskListSelection = {
  id: tasks.id,
  projectId: tasks.projectId,
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  assigneeId: tasks.assigneeId,
  assigneeName: users.name,
  createdById: tasks.createdById,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
};

async function listWhere(conn: DbOrTx, base: SQL[], f: TaskFilters) {
  const where = and(...base, ...buildFilters(f));
  const sortCol = sortColumns[f.sort];
  // Tarefas sem prazo vão para o fim quando ordenamos por prazo.
  const orderBy =
    f.sort === 'dueDate'
      ? [sql`${tasks.dueDate} ${sql.raw(f.order)} nulls last`, desc(tasks.createdAt)]
      : [f.order === 'asc' ? asc(sortCol) : desc(sortCol), desc(tasks.createdAt)];

  const [rows, [total]] = await Promise.all([
    conn
      .select(taskListSelection)
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(where)
      .orderBy(...orderBy)
      .limit(f.limit)
      .offset((f.page - 1) * f.limit),
    conn.select({ value: count() }).from(tasks).where(where),
  ]);
  return { rows, total: total?.value ?? 0 };
}

export const taskRepository = {
  async create(conn: DbOrTx, data: TaskInsert): Promise<Task> {
    const [row] = await conn.insert(tasks).values(data).returning();
    return row!;
  },

  async findById(conn: DbOrTx, id: string): Promise<Task | undefined> {
    const [row] = await conn.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return row;
  },

  async update(conn: DbOrTx, id: string, data: Partial<TaskInsert>): Promise<Task> {
    const [row] = await conn.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return row!;
  },

  async delete(conn: DbOrTx, id: string) {
    await conn.delete(tasks).where(eq(tasks.id, id));
  },

  listByProject(conn: DbOrTx, projectId: string, filters: TaskFilters) {
    return listWhere(conn, [eq(tasks.projectId, projectId)], filters);
  },

  /** "Minhas tarefas": atribuídas ao usuário em qualquer equipe. */
  listAssignedTo(conn: DbOrTx, userId: string, filters: TaskFilters) {
    return listWhere(conn, [eq(tasks.assigneeId, userId)], { ...filters, assigneeId: undefined });
  },

  /** Tarefas abertas de um usuário em todos os projetos de uma equipe. */
  async findOpenAssignedInTeam(conn: DbOrTx, teamId: string, userId: string) {
    return conn
      .select({ id: tasks.id })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(
          eq(projects.teamId, teamId),
          eq(tasks.assigneeId, userId),
          inArray(tasks.status, [...OPEN_STATUSES]),
        ),
      );
  },

  async unassignMany(conn: DbOrTx, taskIds: string[]) {
    if (!taskIds.length) return;
    await conn.update(tasks).set({ assigneeId: null }).where(inArray(tasks.id, taskIds));
  },
};

export const historyRepository = {
  async addMany(conn: DbOrTx, taskId: string, actorId: string, changes: HistoryChange[]) {
    if (!changes.length) return;
    await conn.insert(taskHistory).values(changes.map((c) => ({ ...c, taskId, actorId })));
  },

  async listForTask(conn: DbOrTx, taskId: string, page: number, limit: number) {
    const where = eq(taskHistory.taskId, taskId);
    const [rows, [total]] = await Promise.all([
      conn
        .select({
          id: taskHistory.id,
          field: taskHistory.field,
          oldValue: taskHistory.oldValue,
          newValue: taskHistory.newValue,
          createdAt: taskHistory.createdAt,
          actorId: taskHistory.actorId,
          actorName: users.name,
        })
        .from(taskHistory)
        .innerJoin(users, eq(users.id, taskHistory.actorId))
        .where(where)
        .orderBy(desc(taskHistory.createdAt), desc(taskHistory.id))
        .limit(limit)
        .offset((page - 1) * limit),
      conn.select({ value: count() }).from(taskHistory).where(where),
    ]);
    return { rows, total: total?.value ?? 0 };
  },
};
