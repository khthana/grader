// Server-side course context: the signed-in user's entitled courses plus the
// resolved active course (from the `active_course` cookie). Shared by the shell
// (navbar switcher) and course-scoped pages so both agree on the selection.
import { getCurrentUser, getActiveCourseCookie, getActiveRoleCookie } from "@/lib/session"
import { getDb } from "@/lib/db"
import { resolveActiveRole, type Role } from "@/lib/roles"
import { listCoursesForUser, type CourseRecord } from "./repository"
import { resolveActiveCourse } from "./access"

export interface CourseContext {
  courses: CourseRecord[]
  activeCourse: CourseRecord | null
}

export async function getCourseContext(): Promise<CourseContext> {
  const user = await getCurrentUser()
  if (!user) return { courses: [], activeCourse: null }

  // Course entitlement follows the *active* role, not the full role set: an
  // Admin who switches to Instructor on the navbar should see only the courses
  // they teach. Falls back to the full roles when no role is selected.
  const requestedRole = (await getActiveRoleCookie()) as Role | undefined
  const activeRole = resolveActiveRole(user.roles as Role[], requestedRole)
  const entitlementRoles = activeRole ? [activeRole] : user.roles

  const courses = await listCoursesForUser(getDb(), user.id, entitlementRoles)
  const requested = await getActiveCourseCookie()
  return { courses, activeCourse: resolveActiveCourse(courses, requested) }
}
