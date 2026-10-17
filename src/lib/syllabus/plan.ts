// Teaching Plan (#100) — week / topic / optional detail, independent of Week:
// a plan may list สอบกลางภาค with no Problems, and a week may hold several
// entries. The pure rules the draft and the editor share live here.


export interface PlanEntry {
  weekNo: number
  topic: string
  detail: string
}

export const MIN_PLAN_WEEK = 1
export const MAX_PLAN_WEEK = 20

export function isPlanWeek(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_PLAN_WEEK && value <= MAX_PLAN_WEEK
}

/** Entries by week number; entries of one week keep their order (a stable sort). */
export function sortPlan<T extends { weekNo: number }>(entries: T[]): T[] {
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => a.entry.weekNo - b.entry.weekNo || a.i - b.i)
    .map(({ entry }) => entry)
}

/** The week a new row suggests: the highest so far + 1 (capped), or 1 when empty. */
export function nextPlanWeek(entries: { weekNo: number }[]): number {
  const valid = entries.map((e) => e.weekNo).filter(isPlanWeek)
  return valid.length === 0 ? MIN_PLAN_WEEK : Math.min(Math.max(...valid) + 1, MAX_PLAN_WEEK)
}

/** Can the row at `index` move up (-1) or down (+1)? Only past a row of the same week. */
export function canMovePlanEntry(entries: { weekNo: number }[], index: number, step: -1 | 1): boolean {
  const other = entries[index + step]
  return other !== undefined && other.weekNo === entries[index]?.weekNo
}
