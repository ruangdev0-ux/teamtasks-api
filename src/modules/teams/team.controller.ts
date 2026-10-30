import type { Request, Response } from 'express';
import type { TeamRole } from '../../db/schema.js';
import { body, currentUserId, params } from '../../utils/request.js';
import type { AddMemberInput, CreateTeamInput, UpdateTeamInput } from './team.schemas.js';
import { teamService } from './team.service.js';

type TeamParams = { teamId: string };
type MemberParams = { teamId: string; userId: string };

export const teamController = {
  async create(req: Request, res: Response) {
    res.status(201).json(await teamService.create(currentUserId(req), body<CreateTeamInput>(req)));
  },
  async listMine(req: Request, res: Response) {
    res.json({ data: await teamService.listMine(currentUserId(req)) });
  },
  async get(req: Request, res: Response) {
    res.json(await teamService.get(currentUserId(req), params<TeamParams>(req).teamId));
  },
  async update(req: Request, res: Response) {
    const { teamId } = params<TeamParams>(req);
    res.json(await teamService.update(currentUserId(req), teamId, body<UpdateTeamInput>(req)));
  },
  async delete(req: Request, res: Response) {
    await teamService.delete(currentUserId(req), params<TeamParams>(req).teamId);
    res.status(204).end();
  },
  async listMembers(req: Request, res: Response) {
    const { teamId } = params<TeamParams>(req);
    res.json({ data: await teamService.listMembers(currentUserId(req), teamId) });
  },
  async addMember(req: Request, res: Response) {
    const { teamId } = params<TeamParams>(req);
    res
      .status(201)
      .json(await teamService.addMember(currentUserId(req), teamId, body<AddMemberInput>(req)));
  },
  async changeRole(req: Request, res: Response) {
    const { teamId, userId } = params<MemberParams>(req);
    const { role } = body<{ role: TeamRole }>(req);
    res.json(await teamService.changeRole(currentUserId(req), teamId, userId, role));
  },
  async removeMember(req: Request, res: Response) {
    const { teamId, userId } = params<MemberParams>(req);
    await teamService.removeMember(currentUserId(req), teamId, userId);
    res.status(204).end();
  },
};
