import type { Queryable } from "@/lib/db"
import { resolveCourseAccess, type CourseAccess } from "@/lib/courses/course-access"
import { getWeekForCourse, type WeekRecord } from "@/lib/weeks/repository"
import { getProblemById, type ProblemDetail } from "./repository"

// The Week-release rule for a single Problem, written once (#82): staff of the
// course see every Week; everyone else only released ones. Callers that have
// already resolved course access (the problem page, courseRoute handlers) use
// this directly; callers holding only a problem id use resolveProblemVisibility.
export function canSeeWeek(access: { staff: boolean }, week: { isReleased: boolean }): boolean {
  return access.staff || week.isReleased
}

export type ProblemVisibility =
  | { kind: "visible"; problem: ProblemDetail; week: WeekRecord; access: CourseAccess }
  // Unknown id, a course the user isn't linked to, or (non-staff) an unreleased
  // Week — one answer on purpose, so a caller can't reveal which (#80).
  | { kind: "not-found" }

// Whether `user` may see Problem `problemId`, resolving its course from the
// problem itself.
export async function resolveProblemVisibility(
  db: Queryable,
  user: { id: number; roles: string[] },
  problemId: number
): Promise<ProblemVisibility> {
  const problem = await getProblemById(db, problemId)
  if (!problem) return { kind: "not-found" }

  const key = { code: problem.courseCode, year: problem.courseYear, semester: problem.courseSemester }
  const access = await resolveCourseAccess(db, user, key)
  if (!access) return { kind: "not-found" }

  const week = await getWeekForCourse(db, key, problem.weekId)
  if (!week || !canSeeWeek(access, week)) return { kind: "not-found" }
  return { kind: "visible", problem, week, access }
}
