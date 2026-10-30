import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/client.js';
import { api, auth, createTask, resetDatabase, scenario } from '../helpers/api.js';

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('equipes e membros', () => {
  it('quem cria a equipe vira OWNER e a vê na lista', async () => {
    const { owner } = await scenario();
    const res = await api().get('/teams').set(auth(owner.token)).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].role).toBe('OWNER');
  });

  it('quem não é membro recebe 404 (a equipe "não existe" para ele)', async () => {
    const { outsider, teamId } = await scenario();
    await api().get(`/teams/${teamId}`).set(auth(outsider.token)).expect(404);
    await api().get(`/teams/${teamId}/members`).set(auth(outsider.token)).expect(404);
  });

  it('ADMIN não pode promover ninguém a ADMIN', async () => {
    const { admin, outsider, teamId } = await scenario();
    await api()
      .post(`/teams/${teamId}/members`)
      .set(auth(admin.token))
      .send({ email: outsider.email, role: 'ADMIN' })
      .expect(403);
  });

  it('não permite adicionar o mesmo membro duas vezes', async () => {
    const { owner, member, teamId } = await scenario();
    await api()
      .post(`/teams/${teamId}/members`)
      .set(auth(owner.token))
      .send({ email: member.email })
      .expect(409);
  });

  it('o último OWNER não pode ser rebaixado nem sair', async () => {
    const { owner, teamId } = await scenario();
    await api()
      .patch(`/teams/${teamId}/members/${owner.id}`)
      .set(auth(owner.token))
      .send({ role: 'MEMBER' })
      .expect(422);
    await api().delete(`/teams/${teamId}/members/${owner.id}`).set(auth(owner.token)).expect(422);
  });

  it('ao remover um membro, as tarefas abertas dele ficam sem responsável e isso entra no histórico', async () => {
    const { owner, member, teamId, projectId } = await scenario();
    const task = await createTask(owner.token, projectId, { assigneeId: member.id });

    await api().delete(`/teams/${teamId}/members/${member.id}`).set(auth(owner.token)).expect(204);

    const updated = await api().get(`/tasks/${task.id}`).set(auth(owner.token)).expect(200);
    expect(updated.body.assigneeId).toBeNull();
    const history = await api().get(`/tasks/${task.id}/history`).set(auth(owner.token)).expect(200);
    expect(history.body.data[0]).toMatchObject({
      field: 'assigneeId',
      oldValue: member.id,
      newValue: null,
    });
  });

  it('só exclui equipe sem projetos', async () => {
    const { owner, teamId, projectId } = await scenario();
    await api().delete(`/teams/${teamId}`).set(auth(owner.token)).expect(422);
    await api().delete(`/projects/${projectId}`).set(auth(owner.token)).expect(204);
    await api().delete(`/teams/${teamId}`).set(auth(owner.token)).expect(204);
  });
});
