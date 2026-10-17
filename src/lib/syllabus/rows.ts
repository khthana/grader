// The Syllabus's row lists (Teaching Plan #100, Assessment Components #101)
// report errors per row, keyed by the row's position as sent — which is the
// editor's row order: `plan.2` (the row) or `plan.2.topic` (one field).

export type RowList = "plan" | "assessments"

/** Field errors, keyed by field or by `rowErrorKey`. */
export type Errors = Record<string, string>

export function rowErrorKey(list: RowList, row: number, field?: string): string {
  return field ? `${list}.${row}.${field}` : `${list}.${row}`
}

/** A row's error messages — the row's own first, then its fields'. */
export function rowErrors(errors: Errors, list: RowList, row: number): string[] {
  const key = rowErrorKey(list, row)
  return Object.entries(errors)
    .filter(([k]) => k === key || k.startsWith(`${key}.`))
    .sort(([a], [b]) => (a === key ? -1 : b === key ? 1 : 0))
    .map(([, message]) => message)
}

/** `errors` without the per-row errors of `list` (once its rows move, they point at the wrong rows). */
export function withoutRowErrors(errors: Errors, list: RowList): Errors {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => !k.startsWith(`${list}.`)))
}

/** Has the row at `index` a neighbour in direction `step`? */
export function canMoveRow(rows: unknown[], index: number, step: -1 | 1): boolean {
  const other = index + step
  return index >= 0 && index < rows.length && other >= 0 && other < rows.length
}

/** Swap the row at `index` with its neighbour; unchanged past either end. */
export function moveRow<T>(rows: T[], index: number, step: -1 | 1): T[] {
  if (!canMoveRow(rows, index, step)) return rows
  const other = index + step
  const next = [...rows]
  ;[next[index], next[other]] = [next[other], next[index]]
  return next
}
