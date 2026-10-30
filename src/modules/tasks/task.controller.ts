import type { Request, Response } from 'express';
import type { TaskStatus } from '../../db/schema.js';
import { body, currentUserId, params, query } from '../../utils/request.js';
import type { TaskFilters } from './task.repository.js';
import type { CreateTaskInput, UpdateTaskInput } from './task.schemas.js';
import { taskService } from './task.service.js';

type TaskParams = { taskId: string };

export const taskController = {
  async create(req: Request, res: Response) {
    const { projectId } = params<{ projectId: string }>(req);
    res
      .status(201)
      .json(await taskService.create(currentUserId(req), projectId, body<CreateTaskInput>(req)));
  },
  async list(req: Request, res: Response) {
    const { projectId } = params<{ projectId: string }>(req);
    res.json(await taskService.list(currentUserId(req), projectId, query<TaskFilters>(req)));
  },
  async listMine(req: Request, res: Response) {
    res.json(await taskService.listMine(currentUserId(req), query<TaskFilters>(req)));
  },
  async get(req: Request, res: Response) {
    res.json(await taskService.get(currentUserId(req), params<TaskParams>(req).taskId));
  },
  async update(req: Request, res: Response) {
    const { taskId } = params<TaskParams>(req);
    res.json(await taskService.update(currentUserId(req), taskId, body<UpdateTaskInput>(req)));
  },
  async changeStatus(req: Request, res: Response) {
    const { taskId } = params<TaskParams>(req);
    const { status } = body<{ status: TaskStatus }>(req);
    res.json(await taskService.changeStatus(currentUserId(req), taskId, status));
  },
  async delete(req: Request, res: Response) {
    await taskService.delete(currentUserId(req), params<TaskParams>(req).taskId);
    res.status(204).end();
  },
  async history(req: Request, res: Response) {
    const { taskId } = params<TaskParams>(req);
    const { page, limit } = query<{ page: number; limit: number }>(req);
    res.json(await taskService.history(currentUserId(req), taskId, page, limit));
  },
};
