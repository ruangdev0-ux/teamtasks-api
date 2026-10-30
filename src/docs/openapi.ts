/**
 * Documento OpenAPI 3.1 gerado a partir dos schemas Zod das rotas.
 * Disponível em GET /docs (Swagger UI) e GET /openapi.json.
 */
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { loginSchema, registerSchema } from '../modules/auth/auth.schemas.js';
import {
  createProjectSchema,
  listProjectsQuery,
  projectParams,
  updateProjectSchema,
} from '../modules/projects/project.schemas.js';
import {
  changeStatusSchema,
  createTaskSchema,
  historyQuery,
  listTasksQuery,
  taskParams,
  updateTaskSchema,
} from '../modules/tasks/task.schemas.js';
import {
  addMemberSchema,
  changeRoleSchema,
  createTeamSchema,
  memberParams,
  teamParams,
  updateTeamSchema,
} from '../modules/teams/team.schemas.js';
import { z } from './zod.js';

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// ---------- Schemas de resposta ----------
const ErrorResponse = registry.register(
  'ErrorResponse',
  z.object({
    error: z.object({
      code: z.enum([
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'BUSINESS_RULE_VIOLATION',
        'INTERNAL_ERROR',
      ]),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
);

const PageMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const User = registry.register(
  'User',
  z.object({ id: z.uuid(), name: z.string(), email: z.email(), createdAt: z.iso.datetime() }),
);
const AuthResponse = registry.register(
  'AuthResponse',
  z.object({
    user: User,
    token: z.string().openapi({ description: 'JWT para o header Authorization' }),
  }),
);
const Role = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
const Team = registry.register(
  'Team',
  z.object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    role: Role.openapi({ description: 'Seu papel na equipe' }),
    createdAt: z.iso.datetime(),
  }),
);
const Member = registry.register(
  'Member',
  z.object({
    userId: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: Role,
    joinedAt: z.iso.datetime(),
  }),
);
const Project = registry.register(
  'Project',
  z.object({
    id: z.uuid(),
    teamId: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
    createdById: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
);
const TaskStatus = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']);
const TaskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const Task = registry.register(
  'Task',
  z.object({
    id: z.uuid(),
    projectId: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: TaskStatus,
    priority: TaskPriority,
    dueDate: z.iso.datetime().nullable(),
    assigneeId: z.uuid().nullable(),
    createdById: z.uuid(),
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
);
const TaskListItem = registry.register(
  'TaskListItem',
  Task.omit({ description: true }).extend({ assigneeName: z.string().nullable() }),
);
const HistoryEntry = registry.register(
  'HistoryEntry',
  z.object({
    id: z.uuid(),
    field: z.string().openapi({ example: 'status' }),
    oldValue: z.string().nullable().openapi({ example: 'IN_PROGRESS' }),
    newValue: z.string().nullable().openapi({ example: 'IN_REVIEW' }),
    actorId: z.uuid(),
    actorName: z.string(),
    createdAt: z.iso.datetime(),
  }),
);

const page = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), meta: PageMeta });

// ---------- Helpers ----------
const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const errors = (...codes: number[]) =>
  Object.fromEntries(
    codes.map((c) => [
      c,
      json(
        ErrorResponse,
        {
          400: 'Dados inválidos',
          401: 'Token ausente ou inválido',
          403: 'Sem permissão para a ação',
          404: 'Não encontrado (ou você não é membro da equipe)',
          409: 'Conflito',
          422: 'Regra de negócio violada',
        }[c] ?? 'Erro',
      ),
    ]),
  );

type Method = RouteConfig['method'];
function route(
  method: Method,
  path: string,
  tag: string,
  summary: string,
  opts: {
    params?: z.ZodObject;
    query?: z.ZodObject;
    body?: z.ZodType;
    ok: number;
    response?: z.ZodType;
    errors: number[];
    public?: boolean;
    description?: string;
  },
) {
  registry.registerPath({
    method,
    path,
    tags: [tag],
    summary,
    description: opts.description,
    security: opts.public ? [] : [{ bearerAuth: [] }],
    request: {
      params: opts.params,
      query: opts.query,
      body: opts.body
        ? { content: { 'application/json': { schema: opts.body } }, required: true }
        : undefined,
    },
    responses: {
      [opts.ok]: opts.response ? json(opts.response, 'Sucesso') : { description: 'Sucesso' },
      ...errors(...opts.errors),
    },
  });
}

// ---------- Rotas ----------
route('post', '/auth/register', 'Auth', 'Cria uma conta', {
  body: registerSchema,
  ok: 201,
  response: AuthResponse,
  errors: [400, 409],
  public: true,
});
route('post', '/auth/login', 'Auth', 'Faz login e recebe um JWT', {
  body: loginSchema,
  ok: 200,
  response: AuthResponse,
  errors: [400, 401],
  public: true,
});
route('get', '/auth/me', 'Auth', 'Dados do usuário autenticado', {
  ok: 200,
  response: User,
  errors: [401],
});

route('post', '/teams', 'Equipes', 'Cria uma equipe (você vira OWNER)', {
  body: createTeamSchema,
  ok: 201,
  response: Team,
  errors: [400, 401],
});
route('get', '/teams', 'Equipes', 'Lista as suas equipes', {
  ok: 200,
  response: z.object({ data: z.array(Team) }),
  errors: [401],
});
route('get', '/teams/{teamId}', 'Equipes', 'Detalhe da equipe', {
  params: teamParams,
  ok: 200,
  response: Team,
  errors: [401, 404],
});
route('patch', '/teams/{teamId}', 'Equipes', 'Edita a equipe (OWNER/ADMIN)', {
  params: teamParams,
  body: updateTeamSchema,
  ok: 200,
  response: Team,
  errors: [400, 401, 403, 404],
});
route('delete', '/teams/{teamId}', 'Equipes', 'Exclui a equipe (OWNER, sem projetos)', {
  params: teamParams,
  ok: 204,
  errors: [401, 403, 404, 422],
});
route('get', '/teams/{teamId}/members', 'Membros', 'Lista os membros', {
  params: teamParams,
  ok: 200,
  response: z.object({ data: z.array(Member) }),
  errors: [401, 404],
});
route('post', '/teams/{teamId}/members', 'Membros', 'Adiciona um membro pelo e-mail', {
  params: teamParams,
  body: addMemberSchema,
  ok: 201,
  response: Member,
  errors: [400, 401, 403, 404, 409],
  description: 'OWNER e ADMIN adicionam MEMBER; só o OWNER adiciona ADMIN ou OWNER.',
});
route('patch', '/teams/{teamId}/members/{userId}', 'Membros', 'Altera o papel (só OWNER)', {
  params: memberParams,
  body: changeRoleSchema,
  ok: 200,
  errors: [400, 401, 403, 404, 422],
  description: 'A equipe precisa manter pelo menos um OWNER.',
});
route(
  'delete',
  '/teams/{teamId}/members/{userId}',
  'Membros',
  'Remove um membro ou sai da equipe',
  {
    params: memberParams,
    ok: 204,
    errors: [401, 403, 404, 422],
    description: 'As tarefas abertas do membro ficam sem responsável (registrado no histórico).',
  },
);

route('post', '/teams/{teamId}/projects', 'Projetos', 'Cria um projeto na equipe', {
  params: teamParams,
  body: createProjectSchema,
  ok: 201,
  response: Project,
  errors: [400, 401, 404],
});
route('get', '/teams/{teamId}/projects', 'Projetos', 'Lista os projetos da equipe', {
  params: teamParams,
  query: listProjectsQuery,
  ok: 200,
  response: page(Project),
  errors: [400, 401, 404],
});
route('get', '/projects/{projectId}', 'Projetos', 'Detalhe do projeto com resumo de tarefas', {
  params: projectParams,
  ok: 200,
  response: Project.extend({ taskSummary: z.record(z.string(), z.number()) }),
  errors: [401, 404],
});
route('patch', '/projects/{projectId}', 'Projetos', 'Edita o projeto', {
  params: projectParams,
  body: updateProjectSchema,
  ok: 200,
  response: Project,
  errors: [400, 401, 403, 404, 422],
});
route(
  'post',
  '/projects/{projectId}/archive',
  'Projetos',
  'Arquiva o projeto (fica somente leitura)',
  {
    params: projectParams,
    ok: 200,
    response: Project,
    errors: [401, 403, 404, 422],
  },
);
route('post', '/projects/{projectId}/unarchive', 'Projetos', 'Desarquiva o projeto', {
  params: projectParams,
  ok: 200,
  response: Project,
  errors: [401, 403, 404, 422],
});
route('delete', '/projects/{projectId}', 'Projetos', 'Exclui o projeto', {
  params: projectParams,
  ok: 204,
  errors: [401, 403, 404, 422],
  description: 'Só OWNER, ADMIN ou o criador; bloqueado se houver tarefas em aberto.',
});

route('post', '/projects/{projectId}/tasks', 'Tarefas', 'Cria uma tarefa', {
  params: projectParams,
  body: createTaskSchema,
  ok: 201,
  response: Task,
  errors: [400, 401, 404, 422],
});
route('get', '/projects/{projectId}/tasks', 'Tarefas', 'Lista tarefas com filtros e paginação', {
  params: projectParams,
  query: listTasksQuery,
  ok: 200,
  response: page(TaskListItem),
  errors: [400, 401, 404],
});
route('get', '/me/tasks', 'Tarefas', 'Tarefas atribuídas a você', {
  query: listTasksQuery,
  ok: 200,
  response: page(TaskListItem),
  errors: [400, 401],
});
route('get', '/tasks/{taskId}', 'Tarefas', 'Detalhe da tarefa', {
  params: taskParams,
  ok: 200,
  response: Task,
  errors: [401, 404],
});
route('patch', '/tasks/{taskId}', 'Tarefas', 'Edita a tarefa (registra histórico)', {
  params: taskParams,
  body: updateTaskSchema,
  ok: 200,
  response: Task,
  errors: [400, 401, 403, 404, 422],
});
route('patch', '/tasks/{taskId}/status', 'Tarefas', 'Muda o status seguindo o fluxo permitido', {
  params: taskParams,
  body: changeStatusSchema,
  ok: 200,
  response: Task,
  errors: [400, 401, 403, 404, 422],
  description:
    'TODO → IN_PROGRESS → IN_REVIEW → DONE. DONE só reabre para IN_PROGRESS. CANCELLED só reabre (para TODO) por OWNER/ADMIN.',
});
route('delete', '/tasks/{taskId}', 'Tarefas', 'Exclui a tarefa (OWNER, ADMIN ou criador)', {
  params: taskParams,
  ok: 204,
  errors: [401, 403, 404, 422],
});
route('get', '/tasks/{taskId}/history', 'Tarefas', 'Histórico de alterações da tarefa', {
  params: taskParams,
  query: historyQuery,
  ok: 200,
  response: page(HistoryEntry),
  errors: [400, 401, 404],
});

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'TeamTasks API',
      version: '1.0.0',
      description:
        'API REST de gerenciamento de tarefas e equipes. Projeto de portfólio: dados de exemplo são fictícios.',
    },
    servers: [{ url: '/' }],
  });
}
