import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { listAllEnrollments } from "@/lib/enrollments/repository"

// All roster rows matching the active search + group filter (no pagination),
// for client-side Excel export. Mutator-only, mirroring the export button.
export const GET = courseRoute({ mutate: true }, async (request, auth) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const group = searchParams.get("group") ?? ""

  const enrollments = await listAllEnrollments(getDb(), { courseId: auth.courseId, search, group })
  return NextResponse.json({ enrollments })
})
