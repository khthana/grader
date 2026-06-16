// Pure course-access helpers (mirrors src/lib/roles.ts — no I/O, unit-tested).

// Pick the active course from a user's entitled courses. Prefer the requested
// id (e.g. from the `active_course` cookie) when it's still in the list;
// otherwise fall back to the first course. Returns null for an empty list.
export function resolveActiveCourse<T extends { id: number }>(
  courses: T[],
  requested?: number
): T | null {
  if (requested != null) {
    const match = courses.find((c) => c.id === requested)
    if (match) return match
  }
  return courses[0] ?? null
}
