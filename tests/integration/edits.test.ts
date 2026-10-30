import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/client.js';
import { api, auth, createTask, resetDatabase, scenario } from '../helpers/api.js';

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('edições e exclusões', () => {
  it('OWNER/ADMIN editam a equipe; MEMBER não', async () => {
    const { admin, member, teamId } = await scenario();
    await api()
      .patch(`/teams/${teamId}`)
      .set(auth(member.token))
      .send({ name: 'Novo nome' })
      .expect(403);
    const res = await api()
      .patch(`/teams/${teamId}`)
      .set(auth(admin.token))
      .send({ name: 'Equipe Renomeada' })
      .expect(200);
    expect(res.body.name).toBe('Equipe Renomeada');
    const detail = await api().get(`/teams/${teamId}`).set(auth(member.token)).expect(200);
    expect(detail.body).toMatchObject({ name: 'Equipe Renomeada', role: 'MEMBER' });
  });

  it('edita projeto ativo, mas não projeto arquivado', async () => {
    const { owner, projectId } = await scenario();
    await api()
      .patch(`/projects/${projectId}`)
      .set(auth(owner.token))
      .send({ description: 'Nova descrição' })
      .expect(200);
    await api().post(`/projects/${projectId}/archive`).set(auth(owner.token)).expect(200);
    await api().post(`/projects/${projectId}/archive`).set(auth(owner.token)).expect(422);
    await api()
      .patch(`/projects/${projectId}`)
      .set(auth(owner.token))
      .send({ name: 'Outro' })
      .expect(422);
  });

  it('exige ao menos um campo para atualizar e recusa campos desconhecidos', async () => {
    const { owner, projectId } = await scenario();
    const task = await createTask(owner.token, projectId);
    await api().patch(`/projects/${projectId}`).set(auth(owner.token)).send({}).expect(400);
    await api()
      .patch(`/tasks/${task.id}`)
      .set(auth(owner.token))
      .send({ status: 'DONE' })
      .expect(400);
  });

  it('só OWNER, ADMIN ou o criador excluem a tarefa', async () => {
    const { owner, member, admin, projectId } = await scenario();
    const assignedToMember = await createTask(owner.token, projectId, { assigneeId: member.id });
    await api().delete(`/tasks/${assignedToMember.id}`).set(auth(member.token)).expect(403);
    await api().delete(`/tasks/${assignedToMember.id}`).set(auth(admin.token)).expect(204);

    const own = await createTask(member.token, projectId);
    await api().delete(`/tasks/${own.id}`).set(auth(member.token)).expect(204);
    await api().get(`/tasks/${own.id}`).set(auth(owner.token)).expect(404);
  });

  it('alteração sem mudança real não gera histórico', async () => {
    const { owner, projectId } = await scenario();
    const task = await createTask(owner.token, projectId, { priority: 'HIGH' });
    await api()
      .patch(`/tasks/${task.id}`)
      .set(auth(owner.token))
      .send({ priority: 'HIGH' })
      .expect(200);
    const history = await api().get(`/tasks/${task.id}/history`).set(auth(owner.token)).expect(200);
    expect(history.body.meta.total).toBe(1); // só o registro de criação
  });

  it('JSON malformado devolve 400 padronizado', async () => {
    const { owner } = await scenario();
    const res = await api()
      .post('/teams')
      .set(auth(owner.token))
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
