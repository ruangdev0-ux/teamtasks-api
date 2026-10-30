import { Router } from 'express';
import { authenticate } from './middlewares/authenticate.js';
import { validate } from './middlewares/validate.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { projectController } from './modules/projects/project.controller.js';
import {
  createProjectSchema,
  listProjectsQuery,
  projectParams,
  updateProjectSchema,
} from './modules/projects/project.schemas.js';
import { taskController } from './modules/tasks/task.controller.js';
import {
  changeStatusSchema,
  createTaskSchema,
  historyQuery,
  listTasksQuery,
  taskParams,
  updateTaskSchema,
} from './modules/tasks/task.schemas.js';
import { teamController } from './modules/teams/team.controller.js';
import {
  addMemberSchema,
  changeRoleSchema,
  createTeamSchema,
  memberParams,
  teamParams,
  updateTeamSchema,
} from './modules/teams/team.schemas.js';

/** Todas as rotas da API. Fora /auth/register e /auth/login, todas exigem token. */
export const routes = Router();

routes.use('/auth', authRoutes);

const api = Router();
api.use(authenticate);

// Equipes e membros
api.post('/teams', validate({ body: createTeamSchema }), teamController.create);
api.get('/teams', teamController.listMine);
api.get('/teams/:teamId', validate({ params: teamParams }), teamController.get);
api.patch(
  '/teams/:teamId',
  validate({ params: teamParams, body: updateTeamSchema }),
  teamController.update,
);
api.delete('/teams/:teamId', validate({ params: teamParams }), teamController.delete);
api.get('/teams/:teamId/members', validate({ params: teamParams }), teamController.listMembers);
api.post(
  '/teams/:teamId/members',
  validate({ params: teamParams, body: addMemberSchema }),
  teamController.addMember,
);
api.patch(
  '/teams/:teamId/members/:userId',
  validate({ params: memberParams, body: changeRoleSchema }),
  teamController.changeRole,
);
api.delete(
  '/teams/:teamId/members/:userId',
  validate({ params: memberParams }),
  teamController.removeMember,
);

// Projetos
api.post(
  '/teams/:teamId/projects',
  validate({ params: teamParams, body: createProjectSchema }),
  projectController.create,
);
api.get(
  '/teams/:teamId/projects',
  validate({ params: teamParams, query: listProjectsQuery }),
  projectController.list,
);
api.get('/projects/:projectId', validate({ params: projectParams }), projectController.get);
api.patch(
  '/projects/:projectId',
  validate({ params: projectParams, body: updateProjectSchema }),
  projectController.update,
);
api.post(
  '/projects/:projectId/archive',
  validate({ params: projectParams }),
  projectController.archive,
);
api.post(
  '/projects/:projectId/unarchive',
  validate({ params: projectParams }),
  projectController.unarchive,
);
api.delete('/projects/:projectId', validate({ params: projectParams }), projectController.delete);

// Tarefas
api.post(
  '/projects/:projectId/tasks',
  validate({ params: projectParams, body: createTaskSchema }),
  taskController.create,
);
api.get(
  '/projects/:projectId/tasks',
  validate({ params: projectParams, query: listTasksQuery }),
  taskController.list,
);
api.get('/me/tasks', validate({ query: listTasksQuery }), taskController.listMine);
api.get('/tasks/:taskId', validate({ params: taskParams }), taskController.get);
api.patch(
  '/tasks/:taskId',
  validate({ params: taskParams, body: updateTaskSchema }),
  taskController.update,
);
api.patch(
  '/tasks/:taskId/status',
  validate({ params: taskParams, body: changeStatusSchema }),
  taskController.changeStatus,
);
api.delete('/tasks/:taskId', validate({ params: taskParams }), taskController.delete);
api.get(
  '/tasks/:taskId/history',
  validate({ params: taskParams, query: historyQuery }),
  taskController.history,
);

routes.use(api);
