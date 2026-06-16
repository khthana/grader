import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { listCoursesForUser } from "./repository"
import { canMutateRoster } from "./access"
import type { UserWithRoles } from "@/lib/users/repository"

export type CourseAuth =
  | { ok: true; user: UserWithRoles; courseId: number }
  | { ok: false; response: NextResponse }

// Resolve + authorize a course-scoped request:
//   401 unauthenticated · 404 bad course id · 403 when the course isn't in the
//   caller's entitled set · 403 (when `mutate`) for a read-only role such as TA.
export async function authorizeCourse(
  request: NextRequest,
  courseIdParam: string,
  options: { mutate?: boolean } = {}
): Promise<CourseAuth> {
  const user = await getUserFromRequest(request)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  }

  const courseId = Number.parseInt(courseIdParam, 10)
  if (!Number.isFinite(courseId)) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }

  const entitled = await listCoursesForUser(getDb(), user.id, user.roles)
  if (!entitled.some((c) => c.id === courseId)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (options.mutate && !canMutateRoster(user.roles)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, user, courseId }
}
