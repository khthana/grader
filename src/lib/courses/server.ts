// Server-side course context: the signed-in user's entitled courses plus the
// resolved active course (from the `active_course` cookie). Shared by the shell
// (navbar switcher) and course-scoped pages so both agree on the selection.
import { cache } from "react"
import { getCurrentUser, getActiveCourseCookie, getActiveRoleCookie } from "@/lib/session"
import { getDb } from "@/lib/db"
import { resolveActiveRole, type Role } from "@/lib/roles"
import { listCoursesForUser, type CourseRecord } from "./repository"
import { resolveActiveCourse } from "./access"
import { resolveCourseAccess, type CourseAccess } from "./course-access"
import type { UserWithRoles } from "@/lib/users/repository"
import type { CourseKey } from "./types"

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

// The signed-in user's access to one course, for course-scoped pages (#73):
// null when signed out, the course is unknown, or the user isn't linked to it.
// The course layout 404s on null; pages read `staff` / `manager` from here
// rather than from global roles. Memoised per request so the layout and the
// page share one lookup.
const courseAccessFor = cache(
  async (code: string, year: number, semester: number): Promise<(CourseAccess & { user: UserWithRoles }) | null> => {
    const user = await getCurrentUser()
    if (!user) return null
    const access = await resolveCourseAccess(getDb(), user, { code, year, semester })
    return access ? { ...access, user } : null
  }
)

export function getCourseAccess(key: CourseKey) {
  return courseAccessFor(key.code, key.year, key.semester)
}
