import { z } from '../../docs/zod.js';
import { paginationQuery } from '../../utils/pagination.js';

export const taskStatusSchema = z
  .enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'])
  .openapi('TaskStatus');
export const taskPrioritySchema = z
  .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  .openapi('TaskPriority');

/** Aceita "2026-11-30" ou um ISO completo e converte para Date. */
const dateInput = z.coerce.date({ message: 'Data inválida. Use AAAA-MM-DD ou ISO 8601.' });

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(160).openapi({ example: 'Criar tela de login' }),
    description: z.string().trim().max(2000).optional(),
    priority: taskPrioritySchema.default('MEDIUM'),
    dueDate: dateInput
      .optional()
      .openapi({ type: 'string', format: 'date', example: '2026-12-15' }),
    assigneeId: z.uuid().optional(),
  })
  .openapi('CreateTaskInput');

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: dateInput.nullable().optional().openapi({ type: 'string', format: 'date' }),
    assigneeId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Envie pelo menos um campo para atualizar.')
  .openapi('UpdateTaskInput');

export const changeStatusSchema = z
  .object({ status: taskStatusSchema })
  .openapi('ChangeStatusInput');

/** "TODO,IN_PROGRESS" -> ['TODO', 'IN_PROGRESS'] */
const csv = <T extends z.ZodType<unknown, string>>(item: T) =>
  z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item));

export const listTasksQuery = z.object({
  status: csv(taskStatusSchema).optional().openapi({ example: 'TODO,IN_PROGRESS' }),
  priority: csv(taskPrioritySchema).optional().openapi({ example: 'HIGH,URGENT' }),
  assigneeId: z
    .union([z.uuid(), z.enum(['me', 'none'])])
    .optional()
    .openapi({ description: 'UUID do responsável, "me" ou "none" (sem responsável)' }),
  dueFrom: dateInput.optional().openapi({ type: 'string', format: 'date' }),
  dueTo: dateInput.optional().openapi({ type: 'string', format: 'date' }),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  q: z.string().trim().min(1).max(100).optional().openapi({ description: 'Busca no título' }),
  sort: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...paginationQuery,
});

export const historyQuery = z.object({ ...paginationQuery });
export const taskParams = z.object({ taskId: z.uuid() });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuery>;
