import type { Queryable } from "@/lib/db"
import { resolveCourseAccess } from "@/lib/courses/course-access"
import { buildCoursePath } from "@/lib/courses/slug"
import { getWeekForCourse } from "@/lib/weeks/repository"
import { getProblemById } from "./repository"

export type LegacyProblemTarget = "" | "/edit" | "/submissions"

// Where a legacy /problems/[id] URL redirects, or null for a 404. The redirect
// itself reveals the problem's course, week and position, so it is only given
// to users who may see the problem: linked to its course, and — unless they
// are its staff — only in a released week (#80). Unknown and inaccessible ids
// both return null, so ids can't be probed.
export async function resolveLegacyProblemPath(
  db: Queryable,
  user: { id: number; roles: string[] },
  problemId: number,
  target: LegacyProblemTarget
): Promise<string | null> {
  const problem = await getProblemById(db, problemId)
  if (!problem) return null

  const key = { code: problem.courseCode, year: problem.courseYear, semester: problem.courseSemester }
  const access = await resolveCourseAccess(db, user, key)
  if (!access) return null

  const week = await getWeekForCourse(db, key, problem.weekId)
  if (!week || (!access.staff && !week.isReleased)) return null

  return `${buildCoursePath(key)}/problems/${week.weekNo}/${problem.problemNo}${target}`
}
