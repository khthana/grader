// Whether a route belongs to a single course (so the navbar course switcher is
// meaningful there). The global admin/management pages — User Management,
// Activity Logs, and Course management — are not tied to one course, so the
// switcher is hidden on them.
const NON_COURSE_SCOPED = ["/users", "/logs", "/courses"]

export function isCourseScopedPath(pathname: string): boolean {
  return !NON_COURSE_SCOPED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
