import type { Request, Response } from 'express';
import type { ProjectStatus } from '../../db/schema.js';
import { body, currentUserId, params, query } from '../../utils/request.js';
import type { CreateProjectInput, UpdateProjectInput } from './project.schemas.js';
import { projectService } from './project.service.js';

type ProjectParams = { projectId: string };

export const projectController = {
  async create(req: Request, res: Response) {
    const { teamId } = params<{ teamId: string }>(req);
    res
      .status(201)
      .json(await projectService.create(currentUserId(req), teamId, body<CreateProjectInput>(req)));
  },
  async list(req: Request, res: Response) {
    const { teamId } = params<{ teamId: string }>(req);
    const q = query<{ status?: ProjectStatus; page: number; limit: number }>(req);
    res.json(await projectService.list(currentUserId(req), teamId, q));
  },
  async get(req: Request, res: Response) {
    res.json(await projectService.get(currentUserId(req), params<ProjectParams>(req).projectId));
  },
  async update(req: Request, res: Response) {
    const { projectId } = params<ProjectParams>(req);
    res.json(
      await projectService.update(currentUserId(req), projectId, body<UpdateProjectInput>(req)),
    );
  },
  async archive(req: Request, res: Response) {
    const { projectId } = params<ProjectParams>(req);
    res.json(await projectService.setStatus(currentUserId(req), projectId, 'ARCHIVED'));
  },
  async unarchive(req: Request, res: Response) {
    const { projectId } = params<ProjectParams>(req);
    res.json(await projectService.setStatus(currentUserId(req), projectId, 'ACTIVE'));
  },
  async delete(req: Request, res: Response) {
    await projectService.delete(currentUserId(req), params<ProjectParams>(req).projectId);
    res.status(204).end();
  },
};
