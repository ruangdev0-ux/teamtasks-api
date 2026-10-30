import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db/client.js';
import { api, auth, createUser, resetDatabase } from '../helpers/api.js';

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('autenticação', () => {
  it('cadastra, faz login e acessa /auth/me sem expor o hash da senha', async () => {
    const reg = await api()
      .post('/auth/register')
      .send({ name: 'Ana', email: 'Ana@Exemplo.com', password: 'senha12345' })
      .expect(201);
    expect(reg.body.user.email).toBe('ana@exemplo.com');
    expect(reg.body.user).not.toHaveProperty('passwordHash');

    const login = await api()
      .post('/auth/login')
      .send({ email: 'ana@exemplo.com', password: 'senha12345' })
      .expect(200);
    const me = await api().get('/auth/me').set(auth(login.body.token)).expect(200);
    expect(me.body.name).toBe('Ana');
  });

  it('recusa e-mail duplicado com 409', async () => {
    const user = await createUser();
    const res = await api()
      .post('/auth/register')
      .send({ name: 'Outra', email: user.email, password: 'senha12345' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('valida a entrada e devolve os campos com erro', async () => {
    const res = await api()
      .post('/auth/register')
      .send({ name: 'A', email: 'nao-e-email', password: '123' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });

  it('senha errada e e-mail inexistente recebem a mesma resposta', async () => {
    const user = await createUser();
    const wrong = await api()
      .post('/auth/login')
      .send({ email: user.email, password: 'errada123' });
    const missing = await api()
      .post('/auth/login')
      .send({ email: 'ninguem@teste.dev', password: 'errada123' });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
  });

  it('rotas protegidas exigem token válido', async () => {
    await api().get('/teams').expect(401);
    const res = await api().get('/teams').set(auth('token-invalido')).expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
