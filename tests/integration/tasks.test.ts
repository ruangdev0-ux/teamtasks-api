import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/client.js';
import {
  api,
  auth,
  createTask,
  createUser,
  futureDate,
  resetDatabase,
  scenario,
} from '../helpers/api.js';

beforeEach(resetDatabase);
afterAll(() => pool.end());

const setStatus = (token: string, taskId: string, status: string) =>
  api().patch(`/tasks/${taskId}/status`).set(auth(token)).send({ status });

describe('tarefas', () => {
  it('não atribui tarefa a quem não é da equipe', async () => {
    const { owner, outsider, projectId } = await scenario();
    const res = await api()
      .post(`/projects/${projectId}/tasks`)
      .set(auth(owner.token))
      .send({ title: 'Tarefa', assigneeId: outsider.id })
      .expect(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('recusa prazo no passado', async () => {
    const { owner, projectId } = await scenario();
    await api()
      .post(`/projects/${projectId}/tasks`)
      .set(auth(owner.token))
      .send({ title: 'Tarefa', dueDate: '2020-01-01' })
      .expect(400);
  });

  it('segue o fluxo de status e registra completedAt', async () => {
    const { owner, projectId } = await scenario();
    const task = await createTask(owner.token, projectId);

    await setStatus(owner.token, task.id, 'IN_PROGRESS').expect(200);
    await setStatus(owner.token, task.id, 'IN_REVIEW').expect(200);
    const done = await setStatus(owner.token, task.id, 'DONE').expect(200);
    expect(done.body.completedAt).not.toBeNull();

    // Concluída não volta direto para TODO
    const back = await setStatus(owner.token, task.id, 'TODO').expect(422);
    expect(back.body.error.details).toEqual({ allowed: ['IN_PROGRESS'] });

    const reopened = await setStatus(owner.token, task.id, 'IN_PROGRESS').expect(200);
    expect(reopened.body.completedAt).toBeNull();
  });

  it('MEMBER só altera tarefas que criou ou que estão com ele', async () => {
    const { owner, member, projectId } = await scenario();
    const others = await createTask(owner.token, projectId);
    await api()
      .patch(`/tasks/${others.id}`)
      .set(auth(member.token))
      .send({ title: 'Mudei' })
      .expect(403);

    const mine = await createTask(owner.token, projectId, { assigneeId: member.id });
    await setStatus(member.token, mine.id, 'IN_PROGRESS').expect(200);
  });

  it('MEMBER não reabre tarefa cancelada; ADMIN reabre', async () => {
    const { admin, member, projectId } = await scenario();
    const task = await createTask(member.token, projectId);
    await setStatus(member.token, task.id, 'CANCELLED').expect(200);
    await setStatus(member.token, task.id, 'TODO').expect(403);
    await setStatus(admin.token, task.id, 'TODO').expect(200);
  });

  it('grava o histórico de cada alteração', async () => {
    const { owner, member, projectId } = await scenario();
    const task = await createTask(owner.token, projectId, { priority: 'LOW' });
    await api()
      .patch(`/tasks/${task.id}`)
      .set(auth(owner.token))
      .send({ priority: 'HIGH', assigneeId: member.id })
      .expect(200);
    await setStatus(owner.token, task.id, 'IN_PROGRESS').expect(200);

    const res = await api().get(`/tasks/${task.id}/history`).set(auth(owner.token)).expect(200);
    const fields = res.body.data.map((h: { field: string }) => h.field);
    expect(fields).toEqual(expect.arrayContaining(['created', 'priority', 'assigneeId', 'status']));
    expect(res.body.meta.total).toBe(4);
  });

  it('não altera tarefas de projeto arquivado', async () => {
    const { owner, projectId } = await scenario();
    const task = await createTask(owner.token, projectId);
    await api().post(`/projects/${projectId}/archive`).set(auth(owner.token)).expect(200);
    await setStatus(owner.token, task.id, 'IN_PROGRESS').expect(422);
  });

  it('quem não é da equipe não vê a tarefa', async () => {
    const { owner, outsider, projectId } = await scenario();
    const task = await createTask(owner.token, projectId);
    await api().get(`/tasks/${task.id}`).set(auth(outsider.token)).expect(404);
  });

  it('filtra por status, prioridade, responsável, busca e atraso, com paginação', async () => {
    const { owner, member, projectId } = await scenario();
    await createTask(owner.token, projectId, {
      title: 'Corrigir login',
      priority: 'URGENT',
      assigneeId: member.id,
    });
    await createTask(owner.token, projectId, {
      title: 'Escrever README',
      priority: 'LOW',
      dueDate: futureDate(3),
    });
    const third = await createTask(owner.token, projectId, {
      title: 'Revisar login',
      priority: 'HIGH',
    });
    await setStatus(owner.token, third.id, 'IN_PROGRESS').expect(200);

    const get = (qs: string) =>
      api().get(`/projects/${projectId}/tasks?${qs}`).set(auth(owner.token)).expect(200);

    expect((await get('status=IN_PROGRESS')).body.meta.total).toBe(1);
    expect((await get('priority=URGENT,HIGH')).body.meta.total).toBe(2);
    expect((await get(`assigneeId=${member.id}`)).body.data[0].assigneeName).toBe('Member');
    expect((await get('assigneeId=none')).body.meta.total).toBe(2);
    expect((await get('q=login')).body.meta.total).toBe(2);
    expect((await get('overdue=true')).body.meta.total).toBe(0);

    const paged = await get('limit=2&page=2&sort=createdAt&order=asc');
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.data[0].title).toBe('Revisar login');

    const byDue = await get('sort=dueDate&order=asc');
    expect(byDue.body.data[0].title).toBe('Escrever README'); // sem prazo fica no fim
  });

  it('rejeita filtros inválidos', async () => {
    const { owner, projectId } = await scenario();
    const res = await api()
      .get(`/projects/${projectId}/tasks?status=QUALQUER&limit=500`)
      .set(auth(owner.token))
      .expect(400);
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(['status', 'limit']),
    );
  });

  it('/me/tasks traz as tarefas atribuídas ao usuário em qualquer equipe', async () => {
    const { owner, member, projectId } = await scenario();
    await createTask(owner.token, projectId, { assigneeId: member.id });
    await createTask(owner.token, projectId);
    const res = await api().get('/me/tasks').set(auth(member.token)).expect(200);
    expect(res.body.meta.total).toBe(1);

    const stranger = await createUser();
    expect((await api().get('/me/tasks').set(auth(stranger.token)).expect(200)).body.data).toEqual(
      [],
    );
  });

  it('id malformado devolve 400 e rota inexistente devolve 404 padronizado', async () => {
    const { owner } = await scenario();
    await api().get('/tasks/nao-e-uuid').set(auth(owner.token)).expect(400);
    const res = await api().get('/rota-que-nao-existe').set(auth(owner.token)).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
