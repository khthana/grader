import type { Queryable } from "@/lib/db"
import { buildCoursePath } from "@/lib/courses/slug"
import { resolveProblemVisibility } from "./problem-access"

export type LegacyProblemTarget = "" | "/edit" | "/submissions"

// Where a legacy /problems/[id] URL redirects, or null for a 404. The redirect
// itself reveals the problem's course, week and position, so it is only given
// to users who may see the problem (#80) — the shared visibility gate (#82).
// Unknown, inaccessible and hidden-week ids all return null, so ids can't be
// probed.
export async function resolveLegacyProblemPath(
  db: Queryable,
  user: { id: number; roles: string[] },
  problemId: number,
  target: LegacyProblemTarget
): Promise<string | null> {
  const visibility = await resolveProblemVisibility(db, user, problemId)
  if (visibility.kind !== "visible") return null

  const { problem, week, access } = visibility
  return `${buildCoursePath(access.course)}/problems/${week.weekNo}/${problem.problemNo}${target}`
}
