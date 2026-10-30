import { db, type DbOrTx } from '../../db/client.js';
import type { TaskStatus } from '../../db/schema.js';
import { notFound } from '../../errors/app-error.js';
import { paginate } from '../../utils/pagination.js';
import { assertProjectIsActive } from '../projects/project-rules.js';
import { projectRepository } from '../projects/project.repository.js';
import { loadProjectForMember } from '../projects/project.service.js';
import { memberRepository } from '../teams/team.repository.js';
import type { CreateTaskInput, UpdateTaskInput } from './task.schemas.js';
import { historyRepository, taskRepository, type TaskFilters } from './task.repository.js';
import { diffTask } from './task-history.js';
import {
  assertAssigneeIsMember,
  assertCanDeleteTask,
  assertCanEditTask,
  assertDueDateNotInPast,
  assertValidTransition,
  completedAtFor,
} from './task-rules.js';

async function assertAssignee(conn: DbOrTx, teamId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  assertAssigneeIsMember(Boolean(await memberRepository.find(conn, teamId, assigneeId)));
}

/** Carrega a tarefa, o projeto e o papel do usuário — ou 404 se ele não for da equipe. */
async function loadTaskForMember(userId: string, taskId: string) {
  const task = await taskRepository.findById(db, taskId);
  const project = task && (await projectRepository.findById(db, task.projectId));
  const membership = project && (await memberRepository.find(db, project.teamId, userId));
  if (!task || !project || !membership) throw notFound('Tarefa');
  return { task, project, role: membership.role };
}

export const taskService = {
  async create(userId: string, projectId: string, input: CreateTaskInput) {
    const { project } = await loadProjectForMember(userId, projectId);
    assertProjectIsActive(project);
    assertDueDateNotInPast(input.dueDate);
    await assertAssignee(db, project.teamId, input.assigneeId);

    return db.transaction(async (tx) => {
      const task = await taskRepository.create(tx, { ...input, projectId, createdById: userId });
      await historyRepository.addMany(tx, task.id, userId, [
        { field: 'created', oldValue: null, newValue: task.title },
      ]);
      return task;
    });
  },

  async list(userId: string, projectId: string, filters: TaskFilters) {
    await loadProjectForMember(userId, projectId);
    const assigneeId = filters.assigneeId === 'me' ? userId : filters.assigneeId;
    const { rows, total } = await taskRepository.listByProject(db, projectId, {
      ...filters,
      assigneeId,
    });
    return paginate(rows, total, filters.page, filters.limit);
  },

  async listMine(userId: string, filters: TaskFilters) {
    const { rows, total } = await taskRepository.listAssignedTo(db, userId, filters);
    return paginate(rows, total, filters.page, filters.limit);
  },

  async get(userId: string, taskId: string) {
    const { task } = await loadTaskForMember(userId, taskId);
    return task;
  },

  /** Atualiza campos (exceto status, que tem rota própria) e registra o histórico. */
  async update(userId: string, taskId: string, input: UpdateTaskInput) {
    const { task, project, role } = await loadTaskForMember(userId, taskId);
    assertProjectIsActive(project);
    assertCanEditTask(role, task, userId);
    if (input.dueDate !== undefined) assertDueDateNotInPast(input.dueDate);
    await assertAssignee(db, project.teamId, input.assigneeId);

    const changes = diffTask(task, input);
    if (!changes.length) return task;

    return db.transaction(async (tx) => {
      const updated = await taskRepository.update(tx, taskId, input);
      await historyRepository.addMany(tx, taskId, userId, changes);
      return updated;
    });
  },

  /** Mudança de status segue a máquina de estados de task-rules.ts. */
  async changeStatus(userId: string, taskId: string, status: TaskStatus) {
    const { task, project, role } = await loadTaskForMember(userId, taskId);
    assertProjectIsActive(project);
    assertCanEditTask(role, task, userId);
    assertValidTransition(task.status, status, role);

    return db.transaction(async (tx) => {
      const updated = await taskRepository.update(tx, taskId, {
        status,
        completedAt: completedAtFor(status),
      });
      await historyRepository.addMany(tx, taskId, userId, [
        { field: 'status', oldValue: task.status, newValue: status },
      ]);
      return updated;
    });
  },

  async delete(userId: string, taskId: string) {
    const { task, project, role } = await loadTaskForMember(userId, taskId);
    assertProjectIsActive(project);
    assertCanDeleteTask(role, task, userId);
    await taskRepository.delete(db, taskId);
  },

  async history(userId: string, taskId: string, page: number, limit: number) {
    await loadTaskForMember(userId, taskId);
    const { rows, total } = await historyRepository.listForTask(db, taskId, page, limit);
    return paginate(rows, total, page, limit);
  },
};
