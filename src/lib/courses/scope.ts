// Whether a route belongs to a single course (so the navbar course switcher is
// meaningful there).
const GLOBAL_PATHS = ["/users", "/logs", "/courses"]

export function isCourseScopedPath(pathname: string): boolean {
  // New-style course-scoped URL: /courses/{code}/{year}/{semester}[/...]
  if (/^\/courses\/[^/]+\/\d+\/\d+(\/|$)/.test(pathname)) return true
  // Non-course global pages
  return !GLOBAL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
