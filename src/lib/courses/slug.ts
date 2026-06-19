import type { CourseKey } from "./types"

export function buildCoursePath(key: CourseKey): string {
  return `/courses/${key.code}/${key.year}/${key.semester}`
}

export function parseCourseSlug(
  code: string,
  year: string,
  semester: string
): CourseKey | null {
  const y = Number.parseInt(year, 10)
  const s = Number.parseInt(semester, 10)
  if (!Number.isFinite(y) || s < 1 || s > 3) return null
  return { code, year: y, semester: s }
}

export function courseSlugString(key: CourseKey): string {
  return `${key.code}/${key.year}/${key.semester}`
}
