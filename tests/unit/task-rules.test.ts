import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/db/schema.js';
import { AppError } from '../../src/errors/app-error.js';
import {
  ALLOWED_TRANSITIONS,
  assertCanDeleteTask,
  assertCanEditTask,
  assertDueDateNotInPast,
  assertValidTransition,
  completedAtFor,
} from '../../src/modules/tasks/task-rules.js';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  projectId: 'p1',
  title: 'Tarefa',
  description: null,
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: null,
  assigneeId: null,
  createdById: 'creator',
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/** Executa a função e devolve o AppError lançado (ou falha o teste). */
function errorOf(fn: () => void): AppError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('Era esperado um erro.');
}

describe('fluxo de status da tarefa', () => {
  it.each([
    ['TODO', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'IN_REVIEW'],
    ['IN_REVIEW', 'DONE'],
    ['DONE', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'TODO'],
    ['TODO', 'CANCELLED'],
  ] as const)('permite %s → %s', (from, to) => {
    expect(() => assertValidTransition(from, to, 'MEMBER')).not.toThrow();
  });

  it('não deixa tarefa concluída voltar direto para TODO', () => {
    const err = errorOf(() => assertValidTransition('DONE', 'TODO', 'OWNER'));
    expect(err.statusCode).toBe(422);
    expect(err.details).toEqual({ allowed: ['IN_PROGRESS'] });
  });

  it('não pula a revisão: IN_PROGRESS → DONE é bloqueado', () => {
    expect(errorOf(() => assertValidTransition('IN_PROGRESS', 'DONE', 'ADMIN')).code).toBe(
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejeita mudar para o mesmo status', () => {
    expect(errorOf(() => assertValidTransition('TODO', 'TODO', 'OWNER')).statusCode).toBe(422);
  });

  it('só OWNER/ADMIN reabrem tarefa cancelada', () => {
    expect(errorOf(() => assertValidTransition('CANCELLED', 'TODO', 'MEMBER')).statusCode).toBe(
      403,
    );
    expect(() => assertValidTransition('CANCELLED', 'TODO', 'ADMIN')).not.toThrow();
  });

  it('todo status tem pelo menos uma saída (nenhum estado sem volta)', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      expect(targets.length).toBeGreaterThan(0);
    }
  });

  it('preenche completedAt só ao concluir', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    expect(completedAtFor('DONE', now)).toEqual(now);
    expect(completedAtFor('IN_PROGRESS', now)).toBeNull();
  });
});

describe('permissões de edição e exclusão', () => {
  it('MEMBER edita tarefa que criou ou que está com ele', () => {
    expect(() => assertCanEditTask('MEMBER', task({ createdById: 'u1' }), 'u1')).not.toThrow();
    expect(() => assertCanEditTask('MEMBER', task({ assigneeId: 'u1' }), 'u1')).not.toThrow();
  });

  it('MEMBER não edita tarefa de outra pessoa', () => {
    expect(errorOf(() => assertCanEditTask('MEMBER', task(), 'u1')).statusCode).toBe(403);
  });

  it('ADMIN e OWNER editam qualquer tarefa', () => {
    expect(() => assertCanEditTask('ADMIN', task(), 'u1')).not.toThrow();
    expect(() => assertCanEditTask('OWNER', task(), 'u1')).not.toThrow();
  });

  it('responsável que não criou a tarefa não pode excluí-la', () => {
    expect(
      errorOf(() => assertCanDeleteTask('MEMBER', task({ assigneeId: 'u1' }), 'u1')).statusCode,
    ).toBe(403);
  });
});

describe('prazo', () => {
  const now = new Date('2026-06-15T15:00:00Z');

  it('aceita hoje e datas futuras', () => {
    expect(() => assertDueDateNotInPast(new Date('2026-06-15T00:00:00Z'), now)).not.toThrow();
    expect(() => assertDueDateNotInPast(new Date('2026-07-01'), now)).not.toThrow();
  });

  it('recusa datas passadas', () => {
    expect(errorOf(() => assertDueDateNotInPast(new Date('2026-06-14'), now)).statusCode).toBe(400);
  });

  it('prazo vazio é permitido', () => {
    expect(() => assertDueDateNotInPast(null, now)).not.toThrow();
  });
});
