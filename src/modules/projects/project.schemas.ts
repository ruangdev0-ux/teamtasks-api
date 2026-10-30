import { z } from '../../docs/zod.js';
import { paginationQuery } from '../../utils/pagination.js';

export const projectStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']).openapi('ProjectStatus');

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120).openapi({ example: 'Lançamento v2' }),
    description: z.string().trim().max(1000).optional(),
  })
  .openapi('CreateProjectInput');

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Envie pelo menos um campo para atualizar.')
  .openapi('UpdateProjectInput');

export const listProjectsQuery = z.object({
  status: projectStatusSchema.optional(),
  ...paginationQuery,
});

export const projectParams = z.object({ projectId: z.uuid() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
