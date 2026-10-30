import type { Project, TeamRole } from '../../db/schema.js';
import { businessRule, forbidden } from '../../errors/app-error.js';
import { isManager } from '../teams/team-rules.js';

/** Editar, arquivar ou excluir: OWNER/ADMIN da equipe ou quem criou o projeto. */
export function assertCanManageProject(role: TeamRole, project: Project, userId: string): void {
  if (!isManager(role) && project.createdById !== userId) {
    throw forbidden('Só OWNER, ADMIN ou quem criou o projeto pode fazer isso.');
  }
}

/** Projeto arquivado é somente leitura. */
export function assertProjectIsActive(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw businessRule('Projeto arquivado é somente leitura. Desarquive para alterar.');
  }
}

/** Não dá para excluir projeto com tarefas em aberto: arquive ou conclua as tarefas antes. */
export function assertCanDeleteProject(openTaskCount: number): void {
  if (openTaskCount > 0) {
    throw businessRule(
      `O projeto tem ${openTaskCount} tarefa(s) em aberto. Conclua, cancele ou arquive o projeto.`,
      { openTasks: openTaskCount },
    );
  }
}
