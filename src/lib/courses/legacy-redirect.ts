import { buildCoursePath } from "./slug"
import type { CourseAccess } from "./course-access"
import type { CourseKey } from "./types"

export type LegacyRedirect =
  | { kind: "pick-course" }
  | { kind: "not-found" }
  | { kind: "redirect"; path: string }

// Decide what a legacy shortcut page (/gradebook, /review) does for the active
// course. The right comes from staffing *that* course (getCourseAccess), never
// from global roles (#81): a global TA who is only a student in the active
// course gets a 404 here instead of a redirect into a page that 404s anyway.
export function resolveLegacyRedirect(
  activeCourse: CourseKey | null,
  access: Pick<CourseAccess, "staff" | "manager"> | null,
  opts: { section: "gradebook" | "review"; requires: "staff" | "manager" }
): LegacyRedirect {
  if (!activeCourse) return { kind: "pick-course" }
  if (!access?.[opts.requires]) return { kind: "not-found" }
  return { kind: "redirect", path: `${buildCoursePath(activeCourse)}/${opts.section}` }
}
