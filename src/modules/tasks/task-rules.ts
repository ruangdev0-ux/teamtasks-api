import type { Task, TaskStatus, TeamRole } from '../../db/schema.js';
import { badRequest, businessRule, forbidden } from '../../errors/app-error.js';
import { isManager } from '../teams/team-rules.js';

/**
 * Fluxo de status permitido (máquina de estados):
 *
 *   TODO ──► IN_PROGRESS ──► IN_REVIEW ──► DONE
 *    ▲  ◄──     │   ▲  ◄──────   │          │
 *    │          ▼   └──── reabrir (DONE ► IN_PROGRESS)
 *    └──── CANCELLED (só OWNER/ADMIN reabrem para TODO)
 *
 * DONE nunca volta direto para TODO: precisa ser reaberta para IN_PROGRESS.
 */
export const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW', 'CANCELLED'],
  IN_REVIEW: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: ['IN_PROGRESS'],
  CANCELLED: ['TODO'],
};

export const OPEN_STATUSES: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'];

export function assertValidTransition(from: TaskStatus, to: TaskStatus, role: TeamRole): void {
  if (from === to) throw businessRule(`A tarefa já está com status ${to}.`);
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw businessRule(`Não é permitido mudar o status de ${from} para ${to}.`, {
      allowed: ALLOWED_TRANSITIONS[from],
    });
  }
  if (from === 'CANCELLED' && !isManager(role)) {
    throw forbidden('Só OWNER ou ADMIN podem reabrir uma tarefa cancelada.');
  }
}

/** completedAt é preenchido ao concluir e limpo ao reabrir. */
export function completedAtFor(status: TaskStatus, now = new Date()): Date | null {
  return status === 'DONE' ? now : null;
}

/** MEMBER só altera tarefas que criou ou que estão com ele; OWNER/ADMIN alteram qualquer uma. */
export function assertCanEditTask(role: TeamRole, task: Task, userId: string): void {
  if (isManager(role)) return;
  if (task.createdById !== userId && task.assigneeId !== userId) {
    throw forbidden('Você só pode alterar tarefas que criou ou que estão atribuídas a você.');
  }
}

/** Excluir tarefa: OWNER/ADMIN ou quem criou. */
export function assertCanDeleteTask(role: TeamRole, task: Task, userId: string): void {
  if (!isManager(role) && task.createdById !== userId) {
    throw forbidden('Só OWNER, ADMIN ou quem criou a tarefa pode excluí-la.');
  }
}

/** Prazo não pode estar no passado ao criar ou alterar (comparação por dia, em UTC). */
export function assertDueDateNotInPast(dueDate: Date | null | undefined, now = new Date()): void {
  if (!dueDate) return;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (dueDate.getTime() < startOfToday) {
    throw badRequest('O prazo não pode estar no passado.', { dueDate: ['Data no passado.'] });
  }
}

/** Responsável precisa ser membro da equipe dona do projeto. */
export function assertAssigneeIsMember(isMember: boolean): void {
  if (!isMember) {
    throw businessRule('O responsável precisa ser membro da equipe do projeto.');
  }
}
