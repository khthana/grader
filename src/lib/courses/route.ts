import { type NextRequest, NextResponse } from "next/server"
import { authorizeCourse, type CourseAuth } from "./authorize"

export function courseRoute<P extends { id: string }>(
  options: { staff?: boolean; mutate?: boolean; manage?: boolean },
  handler: (
    req: NextRequest,
    auth: CourseAuth & { ok: true },
    params: P
  ) => Promise<NextResponse>
) {
  return async (req, context) => {
    const params = await context.params
    const auth = await authorizeCourse(req, params.id, options)
    if (!auth.ok) return auth.response
    return handler(req, auth, params)
  }
}
