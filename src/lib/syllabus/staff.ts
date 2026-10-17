import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { listCourseInstructors } from "@/lib/courses/repository"
import { isRole, resolveActiveRole, type Role } from "@/lib/roles"

export interface SyllabusStaffMember {
  id: number
  name: string
  email: string
}

/** The Syllabus's ผู้สอน and ผู้ช่วยสอน — the Course staff as they stand. */
export interface SyllabusStaff {
  instructors: SyllabusStaffMember[]
  tas: SyllabusStaffMember[]
}

// Each staff member is placed once, by their highest Role: Instructor or an
// Admin on the staff → ผู้สอน; TA → ผู้ช่วยสอน; anyone else isn't listed.
export function groupSyllabusStaff(staff: (SyllabusStaffMember & { roles: Role[] })[]): SyllabusStaff {
  const grouped: SyllabusStaff = { instructors: [], tas: [] }
  for (const { roles, ...member } of staff) {
    const role = resolveActiveRole(roles)
    if (role === "Admin" || role === "Instructor") grouped.instructors.push(member)
    else if (role === "TA") grouped.tas.push(member)
  }
  return grouped
}

/** Course staff with their global Roles (a second query — pg-mem has no STRING_AGG). */
export async function listSyllabusStaff(db: Queryable, key: CourseKey): Promise<SyllabusStaff> {
  const users = await listCourseInstructors(db, key)
  const { rows: roleRows } = await db.query<{ user_id: number; name: string }>(
    `SELECT ur.user_id, r.name
     FROM course_instructors ci
     JOIN user_roles ur ON ur.user_id = ci.user_id
     JOIN roles r ON r.id = ur.role_id
     WHERE ci.course_code = $1 AND ci.course_year = $2::int AND ci.course_semester = $3::int`,
    [key.code, key.year, key.semester]
  )
  const roles = new Map<number, Role[]>()
  for (const { user_id, name } of roleRows) {
    if (isRole(name)) roles.set(user_id, [...(roles.get(user_id) ?? []), name])
  }
  return groupSyllabusStaff(users.map((u) => ({ ...u, roles: roles.get(u.id) ?? [] })))
}
