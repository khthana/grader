// Server-side course context: the signed-in user's entitled courses plus the
// resolved active course (from the `active_course` cookie). Shared by the shell
// (navbar switcher) and course-scoped pages so both agree on the selection.
import { getCurrentUser, getActiveCourseCookie } from "@/lib/session"
import { getDb } from "@/lib/db"
import { listCoursesForUser, type CourseRecord } from "./repository"
import { resolveActiveCourse } from "./access"

export interface CourseContext {
  courses: CourseRecord[]
  activeCourse: CourseRecord | null
}

export async function getCourseContext(): Promise<CourseContext> {
  const user = await getCurrentUser()
  if (!user) return { courses: [], activeCourse: null }

  const courses = await listCoursesForUser(getDb(), user.id, user.roles)
  const requested = await getActiveCourseCookie()
  return { courses, activeCourse: resolveActiveCourse(courses, requested) }
}
