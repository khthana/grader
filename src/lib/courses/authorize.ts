import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { getCourseByKey, listCoursesForUser } from "./repository"
import { parseCourseSlug } from "./slug"
import { canMutateRoster, canManageCourses, isTeachingStaff } from "./access"
import type { UserWithRoles } from "@/lib/users/repository"
import type { CourseRecord } from "./types"

export type CourseAuth =
  | { ok: true; user: UserWithRoles; course: CourseRecord }
  | { ok: false; response: NextResponse }

// Resolve + authorize a course-scoped request:
//   401 unauthenticated · 404 bad slug or unknown course · 403 not entitled
//   403 (staff) for an enrolled Student · 403 (mutate) for TA read-only
//   403 (manage) for a non course-manager (TA/Student).
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
  if (!key) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }

  const db = getDb()
  const course = await getCourseByKey(db, key)
  if (!course) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }

  const entitled = await listCoursesForUser(db, user.id, user.roles)
  if (!entitled.some((c) => c.code === key.code && c.year === key.year && c.semester === key.semester)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (options.staff && !isTeachingStaff(user.roles)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (options.mutate && !canMutateRoster(user.roles)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (options.manage && !canManageCourses(user.roles)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, user, course }
}
