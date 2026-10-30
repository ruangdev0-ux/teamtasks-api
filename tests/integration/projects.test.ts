import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/client.js';
import { api, auth, createProject, createTask, resetDatabase, scenario } from '../helpers/api.js';

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('projetos', () => {
  it('somente membros da equipe veem os projetos', async () => {
    const { member, outsider, teamId, projectId } = await scenario();
    await api().get(`/teams/${teamId}/projects`).set(auth(member.token)).expect(200);
    await api().get(`/teams/${teamId}/projects`).set(auth(outsider.token)).expect(404);
    await api().get(`/projects/${projectId}`).set(auth(outsider.token)).expect(404);
  });

  it('MEMBER que não criou o projeto não pode excluí-lo; o criador pode', async () => {
    const { member, teamId, projectId } = await scenario();
    await api().delete(`/projects/${projectId}`).set(auth(member.token)).expect(403);

    const own = await createProject(member.token, teamId, 'Projeto do membro');
    await api().delete(`/projects/${own}`).set(auth(member.token)).expect(204);
  });

  it('não exclui projeto com tarefas em aberto', async () => {
    const { owner, projectId } = await scenario();
    await createTask(owner.token, projectId);
    const res = await api().delete(`/projects/${projectId}`).set(auth(owner.token)).expect(422);
    expect(res.body.error.details).toEqual({ openTasks: 1 });
  });

  it('projeto arquivado não aceita novas tarefas até ser desarquivado', async () => {
    const { owner, projectId } = await scenario();
    await api().post(`/projects/${projectId}/archive`).set(auth(owner.token)).expect(200);
    await api()
      .post(`/projects/${projectId}/tasks`)
      .set(auth(owner.token))
      .send({ title: 'Nova tarefa' })
      .expect(422);
    await api().post(`/projects/${projectId}/unarchive`).set(auth(owner.token)).expect(200);
    await createTask(owner.token, projectId);
  });

  it('lista com paginação e filtro de status', async () => {
    const { owner, teamId } = await scenario();
    for (let i = 0; i < 3; i++) await createProject(owner.token, teamId, `Extra ${i}`);
    const page = await api()
      .get(`/teams/${teamId}/projects?page=2&limit=2`)
      .set(auth(owner.token))
      .expect(200);
    expect(page.body.meta).toEqual({ page: 2, limit: 2, total: 4, totalPages: 2 });

    const archived = await api()
      .get(`/teams/${teamId}/projects?status=ARCHIVED`)
      .set(auth(owner.token))
      .expect(200);
    expect(archived.body.data).toHaveLength(0);
  });
});
