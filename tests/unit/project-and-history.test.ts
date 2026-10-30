import { describe, expect, it } from 'vitest';
import type { Project, Task } from '../../src/db/schema.js';
import { AppError } from '../../src/errors/app-error.js';
import {
  assertCanDeleteProject,
  assertCanManageProject,
  assertProjectIsActive,
} from '../../src/modules/projects/project-rules.js';
import { diffTask } from '../../src/modules/tasks/task-history.js';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  teamId: 't1',
  name: 'Projeto',
  description: null,
  status: 'ACTIVE',
  createdById: 'creator',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const code = (fn: () => void) => {
  try {
    fn();
    return 'ok';
  } catch (e) {
    return e instanceof AppError ? e.statusCode : 'erro inesperado';
  }
};

describe('regras de projeto', () => {
  it('criador e OWNER/ADMIN gerenciam; outro MEMBER não', () => {
    expect(code(() => assertCanManageProject('MEMBER', project(), 'creator'))).toBe('ok');
    expect(code(() => assertCanManageProject('ADMIN', project(), 'x'))).toBe('ok');
    expect(code(() => assertCanManageProject('MEMBER', project(), 'x'))).toBe(403);
  });

  it('projeto arquivado é somente leitura', () => {
    expect(code(() => assertProjectIsActive(project({ status: 'ARCHIVED' })))).toBe(422);
  });

  it('não exclui projeto com tarefas em aberto', () => {
    expect(code(() => assertCanDeleteProject(2))).toBe(422);
    expect(code(() => assertCanDeleteProject(0))).toBe('ok');
  });
});

describe('histórico de alterações', () => {
  const before = {
    title: 'Antigo',
    description: null,
    priority: 'LOW',
    dueDate: new Date('2026-12-01T00:00:00Z'),
    assigneeId: null,
    status: 'TODO',
  } as unknown as Task;

  it('registra só os campos que mudaram', () => {
    const changes = diffTask(before, { title: 'Novo', priority: 'LOW' });
    expect(changes).toEqual([{ field: 'title', oldValue: 'Antigo', newValue: 'Novo' }]);
  });

  it('compara datas pelo valor, não pela referência', () => {
    expect(diffTask(before, { dueDate: new Date('2026-12-01T00:00:00Z') })).toEqual([]);
  });

  it('registra remoção de responsável como null', () => {
    const withAssignee = { ...before, assigneeId: 'u1' } as Task;
    expect(diffTask(withAssignee, { assigneeId: null })).toEqual([
      { field: 'assigneeId', oldValue: 'u1', newValue: null },
    ]);
  });
});
