import type { TeamRole } from '../../db/schema.js';
import { businessRule, forbidden } from '../../errors/app-error.js';

/**
 * Regras de papéis dentro de uma equipe (funções puras, sem banco).
 *
 * OWNER  - dono da equipe: faz tudo, inclusive mudar papéis.
 * ADMIN  - gerencia membros comuns e todos os projetos/tarefas.
 * MEMBER - trabalha nas tarefas.
 */
export const isManager = (role: TeamRole) => role === 'OWNER' || role === 'ADMIN';

/** Quem pode adicionar alguém e com qual papel. Só o OWNER cria ADMIN ou OWNER. */
export function assertCanAddMember(actorRole: TeamRole, newRole: TeamRole): void {
  if (!isManager(actorRole)) throw forbidden('Só OWNER ou ADMIN podem adicionar membros.');
  if (newRole !== 'MEMBER' && actorRole !== 'OWNER') {
    throw forbidden('Só o OWNER pode adicionar membros como ADMIN ou OWNER.');
  }
}

/** Só o OWNER muda papéis, e a equipe nunca pode ficar sem OWNER. */
export function assertCanChangeRole(params: {
  actorRole: TeamRole;
  targetCurrentRole: TeamRole;
  newRole: TeamRole;
  ownerCount: number;
}): void {
  const { actorRole, targetCurrentRole, newRole, ownerCount } = params;
  if (actorRole !== 'OWNER') throw forbidden('Só o OWNER pode alterar papéis.');
  if (targetCurrentRole === 'OWNER' && newRole !== 'OWNER' && ownerCount <= 1) {
    throw businessRule('A equipe precisa de pelo menos um OWNER. Promova outro membro antes.');
  }
}

/**
 * Remoção de membro:
 * - qualquer membro pode sair da equipe (remover a si mesmo);
 * - ADMIN remove apenas MEMBER; OWNER remove qualquer um;
 * - o último OWNER não pode ser removido.
 */
export function assertCanRemoveMember(params: {
  actorId: string;
  actorRole: TeamRole;
  targetId: string;
  targetRole: TeamRole;
  ownerCount: number;
}): void {
  const { actorId, actorRole, targetId, targetRole, ownerCount } = params;
  const removingSelf = actorId === targetId;

  if (!removingSelf) {
    if (!isManager(actorRole)) throw forbidden('Só OWNER ou ADMIN podem remover membros.');
    if (actorRole === 'ADMIN' && targetRole !== 'MEMBER') {
      throw forbidden('ADMIN só pode remover membros com papel MEMBER.');
    }
  }
  if (targetRole === 'OWNER' && ownerCount <= 1) {
    throw businessRule('O último OWNER não pode sair nem ser removido da equipe.');
  }
}
