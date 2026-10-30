/**
 * Utilitários dos testes de integração: app em memória (supertest),
 * limpeza do banco entre testes e atalhos para criar usuários, equipes e tarefas.
 */
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/client.js';

export const app = createApp();
export const api = () => request(app);

export async function resetDatabase() {
  await db.execute(
    sql`TRUNCATE task_history, tasks, projects, team_members, teams, users RESTART IDENTITY CASCADE`,
  );
}

let counter = 0;

export async function createUser(name = 'Pessoa Teste') {
  counter += 1;
  const email = `user${counter}-${Date.now()}@teste.dev`;
  const res = await api()
    .post('/auth/register')
    .send({ name, email, password: 'senha12345' })
    .expect(201);
  return { id: res.body.user.id as string, email, token: res.body.token as string };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createTeam(token: string, name = 'Equipe Teste') {
  const res = await api().post('/teams').set(auth(token)).send({ name }).expect(201);
  return res.body.id as string;
}

export async function addMember(token: string, teamId: string, email: string, role = 'MEMBER') {
  await api().post(`/teams/${teamId}/members`).set(auth(token)).send({ email, role }).expect(201);
}

export async function createProject(token: string, teamId: string, name = 'Projeto Teste') {
  const res = await api()
    .post(`/teams/${teamId}/projects`)
    .set(auth(token))
    .send({ name })
    .expect(201);
  return res.body.id as string;
}

export async function createTask(
  token: string,
  projectId: string,
  body: Record<string, unknown> = {},
) {
  const res = await api()
    .post(`/projects/${projectId}/tasks`)
    .set(auth(token))
    .send({ title: 'Tarefa de teste', ...body })
    .expect(201);
  return res.body as { id: string; status: string; assigneeId: string | null };
}

/** Cenário comum: OWNER, ADMIN, MEMBER e alguém de fora, com uma equipe e um projeto. */
export async function scenario() {
  const owner = await createUser('Owner');
  const admin = await createUser('Admin');
  const member = await createUser('Member');
  const outsider = await createUser('Outsider');
  const teamId = await createTeam(owner.token);
  await addMember(owner.token, teamId, admin.email, 'ADMIN');
  await addMember(owner.token, teamId, member.email, 'MEMBER');
  const projectId = await createProject(owner.token, teamId);
  return { owner, admin, member, outsider, teamId, projectId };
}

export const futureDate = (days = 7) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
