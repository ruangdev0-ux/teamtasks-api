/**
 * Modelo de dados da TeamTasks API (Drizzle ORM + PostgreSQL).
 *
 * - users: contas de acesso.
 * - teams / team_members: equipes e o papel de cada membro (OWNER, ADMIN, MEMBER).
 * - projects: pertencem a uma equipe; podem ser arquivados.
 * - tasks: pertencem a um projeto; têm status, prioridade, prazo e responsável.
 * - task_history: registro de cada alteração relevante em uma tarefa.
 *
 * As migrations SQL ficam em /drizzle e são geradas com `npm run db:generate`.
 */
import { relations } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const teamRoleEnum = pgEnum('team_role', ['OWNER', 'ADMIN', 'MEMBER']);
export const projectStatusEnum = pgEnum('project_status', ['ACTIVE', 'ARCHIVED']);
export const taskStatusEnum = pgEnum('task_status', [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
]);
export const taskPriorityEnum = pgEnum('task_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  ...timestamps,
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamRoleEnum('role').notNull().default('MEMBER'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index('team_members_user_idx').on(t.userId),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 1000 }),
    status: projectStatusEnum('status').notNull().default('ACTIVE'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [index('projects_team_idx').on(t.teamId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    description: varchar('description', { length: 2000 }),
    status: taskStatusEnum('status').notNull().default('TODO'),
    priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('tasks_project_status_idx').on(t.projectId, t.status),
    index('tasks_assignee_idx').on(t.assigneeId),
    index('tasks_due_date_idx').on(t.dueDate),
  ],
);

export const taskHistory = pgTable(
  'task_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    field: varchar('field', { length: 40 }).notNull(),
    oldValue: varchar('old_value', { length: 2000 }),
    newValue: varchar('new_value', { length: 2000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('task_history_task_idx').on(t.taskId, t.createdAt)],
);

// Relações usadas nas consultas com `with` (ex.: tarefa + responsável).
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ many, one }) => ({
  members: many(teamMembers),
  projects: many(projects),
  createdBy: one(users, { fields: [teams.createdById], references: [users.id] }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, { fields: [projects.teamId], references: [teams.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  history: many(taskHistory),
}));

export const taskHistoryRelations = relations(taskHistory, ({ one }) => ({
  task: one(tasks, { fields: [taskHistory.taskId], references: [tasks.id] }),
  actor: one(users, { fields: [taskHistory.actorId], references: [users.id] }),
}));

export type TeamRole = (typeof teamRoleEnum.enumValues)[number];
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type TaskPriority = (typeof taskPriorityEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskHistoryEntry = typeof taskHistory.$inferSelect;
