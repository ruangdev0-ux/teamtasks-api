import type { Task } from '../../db/schema.js';

/** Uma linha do histórico: qual campo mudou, de qual valor para qual. */
export interface HistoryChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Campos da tarefa que entram no histórico quando mudam. */
export const TRACKED_FIELDS = [
  'title',
  'description',
  'priority',
  'dueDate',
  'assigneeId',
  'status',
] as const;

/** Converte qualquer valor para texto (datas em ISO), como fica salvo no histórico. */
export const asText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

/** Compara o antes e o depois e gera uma entrada de histórico por campo que realmente mudou. */
export function diffTask(before: Task, changes: Partial<Task>): HistoryChange[] {
  return TRACKED_FIELDS.filter(
    (field) => field in changes && asText(before[field]) !== asText(changes[field]),
  ).map((field) => ({ field, oldValue: asText(before[field]), newValue: asText(changes[field]) }));
}
