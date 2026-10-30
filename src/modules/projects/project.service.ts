import { db } from '../../db/client.js';
import type { ProjectStatus } from '../../db/schema.js';
import { businessRule, notFound } from '../../errors/app-error.js';
import { paginate } from '../../utils/pagination.js';
import { memberRepository } from '../teams/team.repository.js';
import { requireMembership } from '../teams/team.service.js';
import type { CreateProjectInput, UpdateProjectInput } from './project.schemas.js';
import { projectRepository } from './project.repository.js';
import { assertCanDeleteProject, assertCanManageProject } from './project-rules.js';

/** Busca o projeto e confere se o usuário é membro da equipe dona dele. */
export async function loadProjectForMember(userId: string, projectId: string) {
  const project = await projectRepository.findById(db, projectId);
  const membership = project && (await memberRepository.find(db, project.teamId, userId));
  // Projeto inexistente ou usuário de fora da equipe: a resposta é a mesma (404).
  if (!project || !membership) throw notFound('Projeto');
  return { project, role: membership.role };
}

export const projectService = {
  /** Qualquer membro da equipe pode criar projetos. */
  async create(userId: string, teamId: string, input: CreateProjectInput) {
    await requireMembership(db, teamId, userId);
    return projectRepository.create(db, { ...input, teamId, createdById: userId });
  },

  async list(
    userId: string,
    teamId: string,
    query: { status?: ProjectStatus; page: number; limit: number },
  ) {
    await requireMembership(db, teamId, userId);
    const { rows, total } = await projectRepository.listByTeam(db, teamId, query);
    return paginate(rows, total, query.page, query.limit);
  },

  async get(userId: string, projectId: string) {
    const { project } = await loadProjectForMember(userId, projectId);
    const summary = await projectRepository.taskSummary(db, projectId);
    return { ...project, taskSummary: Object.fromEntries(summary.map((s) => [s.status, s.total])) };
  },

  async update(userId: string, projectId: string, input: UpdateProjectInput) {
    const { project, role } = await loadProjectForMember(userId, projectId);
    assertCanManageProject(role, project, userId);
    if (project.status === 'ARCHIVED') {
      throw businessRule('Projeto arquivado é somente leitura. Desarquive para alterar.');
    }
    return projectRepository.update(db, projectId, input);
  },

  async setStatus(userId: string, projectId: string, status: ProjectStatus) {
    const { project, role } = await loadProjectForMember(userId, projectId);
    assertCanManageProject(role, project, userId);
    if (project.status === status) {
      throw businessRule(`O projeto já está ${status === 'ARCHIVED' ? 'arquivado' : 'ativo'}.`);
    }
    return projectRepository.update(db, projectId, { status });
  },

  async delete(userId: string, projectId: string) {
    const { project, role } = await loadProjectForMember(userId, projectId);
    assertCanManageProject(role, project, userId);
    assertCanDeleteProject(await projectRepository.countOpenTasks(db, projectId));
    await projectRepository.delete(db, projectId);
  },
};
