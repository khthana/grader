import type { CourseRecord } from "./types"

// Pure course-access helpers (mirrors src/lib/roles.ts — no I/O, unit-tested).

// Who may mutate a course roster: Admin and Instructor. TA is view-only
// (per ADR 0001), Student has no access.
const ROSTER_MUTATORS = ["Admin", "Instructor"]

export function canMutateRoster(roles: string[]): boolean {
  return roles.some((r) => ROSTER_MUTATORS.includes(r))
}

// Who may create/edit/delete courses: Admin and Instructor. TA and Student
// have no course-management access.
const COURSE_MANAGERS = ["Admin", "Instructor"]

export function canManageCourses(roles: string[]): boolean {
  return roles.some((r) => COURSE_MANAGERS.includes(r))
}

// Who counts as teaching staff for a course: Admin, Instructor, or TA. Used to
// gate read access to staff-only views such as the Scorebook — an enrolled
// Student is entitled to the course but is not teaching staff.
const TEACHING_STAFF = ["Admin", "Instructor", "TA"]

export function isTeachingStaff(roles: string[]): boolean {
  return roles.some((r) => TEACHING_STAFF.includes(r))
}

// Pick the active course from the user's entitled courses. Prefer the slug
// from the `active_course` cookie ("code/year/semester") when it matches;
// otherwise fall back to the first course. Returns null for an empty list.
export function resolveActiveCourse(
  courses: CourseRecord[],
  requestedSlug?: string
): CourseRecord | null {
  if (requestedSlug) {
    const [code, yearStr, semStr] = requestedSlug.split("/")
    const year = Number.parseInt(yearStr ?? "", 10)
    const semester = Number.parseInt(semStr ?? "", 10)
    const match = courses.find((c) => c.code === code && c.year === year && c.semester === semester)
    if (match) return match
  }
  return courses[0] ?? null
}
