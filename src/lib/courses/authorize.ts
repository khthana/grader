import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getCourseByKey } from "./repository"
import { parseCourseSlug } from "./slug"
import { resolveAccessToCourse } from "./course-access"
import type { UserWithRoles } from "@/lib/users/repository"
import type { CourseRecord } from "./types"

// `staff` / `manager` are rights in *this* course (#74) — from staffing it,
// not from a global role — so handlers branch on these, never on user.roles.
export type CourseAuth =
  | { ok: true; user: UserWithRoles; course: CourseRecord; staff: boolean; manager: boolean }
  | { ok: false; response: NextResponse }

const notFound = (): CourseAuth => ({
  ok: false,
  response: NextResponse.json({ error: "Not found" }, { status: 404 }),
})
const forbidden = (): CourseAuth => ({
  ok: false,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
})

// Resolve + authorize a course-scoped request:
//   401 unauthenticated · 404 bad slug or unknown course · 403 not entitled
//   403 (staff) for a non-staff member · 403 (mutate/manage) for a member who
//   doesn't manage this course (TA read-only, Student, or staff elsewhere).
export async function authorizeCourse(
  request: NextRequest,
  slug: { code: string; year: string; semester: string },
  options: { staff?: boolean; mutate?: boolean; manage?: boolean } = {}
): Promise<CourseAuth> {
  const user = await getUserFromRequest(request)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  }

  const key = parseCourseSlug(slug.code, slug.year, slug.semester)
  if (!key) return notFound()

  const db = getDb()
  const course = await getCourseByKey(db, key)
  if (!course) return notFound()

  const access = await resolveAccessToCourse(db, user, course)
  if (!access) return forbidden()
  if (options.staff && !access.staff) return forbidden()
  // Roster mutation and course management are the same right (Admin or an
  // Instructor staffing this course) — ADR 0001.
  if ((options.mutate || options.manage) && !access.manager) return forbidden()

  return { ok: true, user, course, staff: access.staff, manager: access.manager }
}
