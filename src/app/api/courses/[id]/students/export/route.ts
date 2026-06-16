import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { listAllEnrollments } from "@/lib/enrollments/repository"

type RouteContext = { params: Promise<{ id: string }> }

// All roster rows matching the active search + group filter (no pagination),
// for client-side Excel export. Mutator-only, mirroring the export button.
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id, { mutate: true })
  if (!auth.ok) return auth.response
  const { courseId } = auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const group = searchParams.get("group") ?? ""

  const enrollments = await listAllEnrollments(getDb(), { courseId, search, group })
  return NextResponse.json({ enrollments })
}
