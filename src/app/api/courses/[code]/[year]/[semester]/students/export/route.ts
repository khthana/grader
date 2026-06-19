import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { listAllEnrollments } from "@/lib/enrollments/repository"

export const GET = courseRoute({ mutate: true }, async (request, auth) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const group = searchParams.get("group") ?? ""

  const enrollments = await listAllEnrollments(getDb(), { courseKey: auth.course, search, group })
  return NextResponse.json({ enrollments })
})
