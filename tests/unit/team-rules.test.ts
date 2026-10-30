import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors/app-error.js';
import {
  assertCanAddMember,
  assertCanChangeRole,
  assertCanRemoveMember,
} from '../../src/modules/teams/team-rules.js';

const status = (fn: () => void) => {
  try {
    fn();
    return 'ok';
  } catch (e) {
    return e instanceof AppError ? e.statusCode : 'erro inesperado';
  }
};

describe('adicionar membros', () => {
  it('MEMBER não adiciona ninguém', () => {
    expect(status(() => assertCanAddMember('MEMBER', 'MEMBER'))).toBe(403);
  });
  it('ADMIN adiciona MEMBER, mas não ADMIN', () => {
    expect(status(() => assertCanAddMember('ADMIN', 'MEMBER'))).toBe('ok');
    expect(status(() => assertCanAddMember('ADMIN', 'ADMIN'))).toBe(403);
  });
  it('OWNER adiciona qualquer papel', () => {
    expect(status(() => assertCanAddMember('OWNER', 'OWNER'))).toBe('ok');
  });
});

describe('alterar papéis', () => {
  it('só o OWNER altera papéis', () => {
    expect(
      status(() =>
        assertCanChangeRole({
          actorRole: 'ADMIN',
          targetCurrentRole: 'MEMBER',
          newRole: 'ADMIN',
          ownerCount: 1,
        }),
      ),
    ).toBe(403);
  });
  it('não rebaixa o último OWNER', () => {
    expect(
      status(() =>
        assertCanChangeRole({
          actorRole: 'OWNER',
          targetCurrentRole: 'OWNER',
          newRole: 'ADMIN',
          ownerCount: 1,
        }),
      ),
    ).toBe(422);
  });
  it('rebaixa um OWNER quando existe outro', () => {
    expect(
      status(() =>
        assertCanChangeRole({
          actorRole: 'OWNER',
          targetCurrentRole: 'OWNER',
          newRole: 'ADMIN',
          ownerCount: 2,
        }),
      ),
    ).toBe('ok');
  });
});

describe('remover membros', () => {
  const base = { actorId: 'a', targetId: 'b', ownerCount: 1 };
  it('qualquer membro pode sair da equipe', () => {
    expect(
      status(() =>
        assertCanRemoveMember({
          ...base,
          targetId: 'a',
          actorRole: 'MEMBER',
          targetRole: 'MEMBER',
        }),
      ),
    ).toBe('ok');
  });
  it('MEMBER não remove outra pessoa', () => {
    expect(
      status(() => assertCanRemoveMember({ ...base, actorRole: 'MEMBER', targetRole: 'MEMBER' })),
    ).toBe(403);
  });
  it('ADMIN não remove outro ADMIN', () => {
    expect(
      status(() => assertCanRemoveMember({ ...base, actorRole: 'ADMIN', targetRole: 'ADMIN' })),
    ).toBe(403);
  });
  it('o último OWNER não sai da equipe', () => {
    expect(
      status(() =>
        assertCanRemoveMember({ ...base, targetId: 'a', actorRole: 'OWNER', targetRole: 'OWNER' }),
      ),
    ).toBe(422);
  });
});
