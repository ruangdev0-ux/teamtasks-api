import { db, type DbOrTx } from '../../db/client.js';
import type { TeamRole } from '../../db/schema.js';
import { businessRule, conflict, forbidden, notFound } from '../../errors/app-error.js';
import { historyRepository, taskRepository } from '../tasks/task.repository.js';
import { userRepository } from '../users/user.repository.js';
import type { AddMemberInput, CreateTeamInput, UpdateTeamInput } from './team.schemas.js';
import { memberRepository, teamRepository } from './team.repository.js';
import {
  assertCanAddMember,
  assertCanChangeRole,
  assertCanRemoveMember,
  isManager,
} from './team-rules.js';

/**
 * Garante que o usuário é membro da equipe e devolve o papel dele.
 * Para quem não é membro respondemos 404 (e não 403), para não revelar que a equipe existe.
 */
export async function requireMembership(
  conn: DbOrTx,
  teamId: string,
  userId: string,
): Promise<TeamRole> {
  const membership = await memberRepository.find(conn, teamId, userId);
  if (!membership) throw notFound('Equipe');
  return membership.role;
}

export const teamService = {
  /** Quem cria a equipe vira OWNER automaticamente (na mesma transação). */
  async create(userId: string, input: CreateTeamInput) {
    return db.transaction(async (tx) => {
      const team = await teamRepository.create(tx, { ...input, createdById: userId });
      await memberRepository.add(tx, { teamId: team.id, userId, role: 'OWNER' });
      return { ...team, role: 'OWNER' as const };
    });
  },

  listMine(userId: string) {
    return teamRepository.listForUser(db, userId);
  },

  async get(userId: string, teamId: string) {
    const role = await requireMembership(db, teamId, userId);
    const team = await teamRepository.findById(db, teamId);
    if (!team) throw notFound('Equipe');
    return { ...team, role };
  },

  async update(userId: string, teamId: string, input: UpdateTeamInput) {
    const role = await requireMembership(db, teamId, userId);
    if (!isManager(role)) throw forbidden('Só OWNER ou ADMIN podem editar a equipe.');
    return teamRepository.update(db, teamId, input);
  },

  /** Só o OWNER exclui, e apenas uma equipe sem projetos (evita apagar trabalho por engano). */
  async delete(userId: string, teamId: string) {
    const role = await requireMembership(db, teamId, userId);
    if (role !== 'OWNER') throw forbidden('Só o OWNER pode excluir a equipe.');
    const projectCount = await teamRepository.countProjects(db, teamId);
    if (projectCount > 0) {
      throw businessRule(`A equipe ainda tem ${projectCount} projeto(s). Exclua-os antes.`);
    }
    await teamRepository.delete(db, teamId);
  },

  async listMembers(userId: string, teamId: string) {
    await requireMembership(db, teamId, userId);
    return memberRepository.list(db, teamId);
  },

  async addMember(actorId: string, teamId: string, input: AddMemberInput) {
    const actorRole = await requireMembership(db, teamId, actorId);
    assertCanAddMember(actorRole, input.role);

    const user = await userRepository.findByEmail(db, input.email.toLowerCase());
    if (!user) throw notFound('Usuário com este e-mail');
    if (await memberRepository.find(db, teamId, user.id)) {
      throw conflict('Este usuário já é membro da equipe.');
    }
    const member = await memberRepository.add(db, { teamId, userId: user.id, role: input.role });
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: member.role,
      joinedAt: member.joinedAt,
    };
  },

  async changeRole(actorId: string, teamId: string, targetId: string, newRole: TeamRole) {
    return db.transaction(async (tx) => {
      const actorRole = await requireMembership(tx, teamId, actorId);
      const target = await memberRepository.find(tx, teamId, targetId);
      if (!target) throw notFound('Membro');
      const ownerCount = await memberRepository.countOwners(tx, teamId);
      assertCanChangeRole({ actorRole, targetCurrentRole: target.role, newRole, ownerCount });
      return memberRepository.updateRole(tx, teamId, targetId, newRole);
    });
  },

  /**
   * Remove (ou deixa sair) um membro. As tarefas abertas dele na equipe ficam sem
   * responsável, e cada uma recebe um registro no histórico.
   */
  async removeMember(actorId: string, teamId: string, targetId: string) {
    await db.transaction(async (tx) => {
      const actorRole = await requireMembership(tx, teamId, actorId);
      const target = await memberRepository.find(tx, teamId, targetId);
      if (!target) throw notFound('Membro');
      const ownerCount = await memberRepository.countOwners(tx, teamId);
      assertCanRemoveMember({ actorId, actorRole, targetId, targetRole: target.role, ownerCount });

      const openTasks = await taskRepository.findOpenAssignedInTeam(tx, teamId, targetId);
      await taskRepository.unassignMany(
        tx,
        openTasks.map((t) => t.id),
      );
      for (const task of openTasks) {
        await historyRepository.addMany(tx, task.id, actorId, [
          { field: 'assigneeId', oldValue: targetId, newValue: null },
        ]);
      }
      await memberRepository.remove(tx, teamId, targetId);
    });
  },
};
