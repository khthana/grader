import type { Queryable } from "@/lib/db"
import { getCourseByKey, getCourseMembership } from "./repository"
import { canManageCourses, isTeachingStaff } from "./access"
import type { CourseKey, CourseRecord } from "./types"

// What a user may do in one course offering.
//   staff   — teaching staff of *this* course (sees hidden weeks, rosters)
//   manager — may edit its problems and read their Reference Solutions
export interface CourseAccess {
  course: CourseRecord
  staff: boolean
  manager: boolean
}

// The single course gate for pages and staff-only reads (#73). Returns null
// when the course doesn't exist or the user isn't linked to it at all. Rights
// come from staffing *this* course (a course_instructors row) combined with
// the user's role — a global Instructor role alone grants nothing in a course
// they don't teach. Admin is entitled to and manages every course.
export async function resolveCourseAccess(
  db: Queryable,
  user: { id: number; roles: string[] },
  key: CourseKey
): Promise<CourseAccess | null> {
  const course = await getCourseByKey(db, key)
  return course ? resolveAccessToCourse(db, user, course) : null
}

// Same gate for a course record already loaded (authorizeCourse loads it first
// to tell 404 from 403).
export async function resolveAccessToCourse(
  db: Queryable,
  user: { id: number; roles: string[] },
  course: CourseRecord
): Promise<CourseAccess | null> {
  if (user.roles.includes("Admin")) return { course, staff: true, manager: true }

  const membership = await getCourseMembership(db, course, user.id)
  if (!membership.staff && !membership.enrolled) return null

  return {
    course,
    staff: membership.staff && isTeachingStaff(user.roles),
    manager: membership.staff && canManageCourses(user.roles),
  }
}
