/**
 * Popula o banco com dados fictícios para testar a API manualmente.
 * Uso: npm run db:seed (depois de npm run db:migrate)
 *
 * Usuários criados (senha de todos: demo12345):
 *   ana@exemplo.com   - OWNER da equipe
 *   bruno@exemplo.com - ADMIN
 *   carla@exemplo.com - MEMBER
 */
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { hashPassword } from '../lib/password.js';
import { db, pool } from './client.js';
import { projects, taskHistory, tasks, teamMembers, teams, users } from './schema.js';

const DEMO_PASSWORD = 'demo12345';
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('O seed não deve rodar em produção.');
  }
  const [existing] = await db.select().from(users).where(eq(users.email, 'ana@exemplo.com'));
  if (existing) {
    console.info('Seed já aplicado (ana@exemplo.com existe). Nada a fazer.');
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.transaction(async (tx) => {
    const [ana, bruno, carla] = await tx
      .insert(users)
      .values([
        { name: 'Ana Souza', email: 'ana@exemplo.com', passwordHash },
        { name: 'Bruno Lima', email: 'bruno@exemplo.com', passwordHash },
        { name: 'Carla Mendes', email: 'carla@exemplo.com', passwordHash },
      ])
      .returning();

    const [team] = await tx
      .insert(teams)
      .values({
        name: 'Equipe Produto',
        description: 'Equipe fictícia de exemplo',
        createdById: ana!.id,
      })
      .returning();

    await tx.insert(teamMembers).values([
      { teamId: team!.id, userId: ana!.id, role: 'OWNER' },
      { teamId: team!.id, userId: bruno!.id, role: 'ADMIN' },
      { teamId: team!.id, userId: carla!.id, role: 'MEMBER' },
    ]);

    const [site, app] = await tx
      .insert(projects)
      .values([
        {
          teamId: team!.id,
          name: 'Novo site',
          description: 'Redesenho do site institucional',
          createdById: ana!.id,
        },
        {
          teamId: team!.id,
          name: 'App mobile',
          description: 'Primeira versão do app',
          createdById: bruno!.id,
        },
      ])
      .returning();

    const created = await tx
      .insert(tasks)
      .values([
        {
          projectId: site!.id,
          title: 'Definir layout da home',
          priority: 'HIGH',
          status: 'DONE',
          completedAt: new Date(),
          assigneeId: carla!.id,
          createdById: ana!.id,
        },
        {
          projectId: site!.id,
          title: 'Implementar formulário de contato',
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
          dueDate: daysFromNow(5),
          assigneeId: carla!.id,
          createdById: ana!.id,
        },
        {
          projectId: site!.id,
          title: 'Revisar textos da página Sobre',
          priority: 'LOW',
          status: 'TODO',
          dueDate: daysFromNow(10),
          createdById: bruno!.id,
        },
        {
          projectId: site!.id,
          title: 'Configurar SEO básico',
          priority: 'URGENT',
          status: 'IN_REVIEW',
          dueDate: daysFromNow(2),
          assigneeId: bruno!.id,
          createdById: ana!.id,
        },
        {
          projectId: app!.id,
          title: 'Tela de login',
          priority: 'HIGH',
          status: 'TODO',
          dueDate: daysFromNow(7),
          assigneeId: carla!.id,
          createdById: bruno!.id,
        },
        {
          projectId: app!.id,
          title: 'Notificações push',
          priority: 'MEDIUM',
          status: 'CANCELLED',
          createdById: bruno!.id,
        },
      ])
      .returning();

    await tx.insert(taskHistory).values(
      created.map((t) => ({
        taskId: t.id,
        actorId: t.createdById,
        field: 'created',
        newValue: t.title,
      })),
    );
  });

  console.info(
    `Seed aplicado. Usuários: ana@, bruno@ e carla@exemplo.com (senha: ${DEMO_PASSWORD}).`,
  );
}

main()
  .catch((error) => {
    console.error('Falha no seed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
