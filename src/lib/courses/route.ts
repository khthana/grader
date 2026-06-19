import { type NextRequest, NextResponse } from "next/server"
import { authorizeCourse, type CourseAuth } from "./authorize"

export function courseRoute<P extends { code: string; year: string; semester: string }>(
  options: { staff?: boolean; mutate?: boolean; manage?: boolean },
  handler: (
    req: NextRequest,
    auth: CourseAuth & { ok: true },
    params: P
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    const params = await context.params
    const auth = await authorizeCourse(req, params, options)
    if (!auth.ok) return auth.response
    return handler(req, auth, params)
  }
}
