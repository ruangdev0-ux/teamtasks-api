import { z } from '../../docs/zod.js';

export const teamRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']).openapi('TeamRole');

export const createTeamSchema = z
  .object({
    name: z.string().trim().min(2).max(100).openapi({ example: 'Time de Produto' }),
    description: z.string().trim().max(500).optional().openapi({ example: 'Squad do app mobile' }),
  })
  .openapi('CreateTeamInput');

export const updateTeamSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Envie pelo menos um campo para atualizar.')
  .openapi('UpdateTeamInput');

export const addMemberSchema = z
  .object({
    email: z.email().openapi({ example: 'bruno@exemplo.com' }),
    role: teamRoleSchema.default('MEMBER'),
  })
  .openapi('AddMemberInput');

export const changeRoleSchema = z.object({ role: teamRoleSchema }).openapi('ChangeRoleInput');

export const teamParams = z.object({ teamId: z.uuid() });
export const memberParams = z.object({ teamId: z.uuid(), userId: z.uuid() });

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
