import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getStudentAssignments } from "@/lib/assignments/repository"

export const GET = courseRoute({}, async (_request, auth) => {
  const assignments = await getStudentAssignments(getDb(), auth.courseId, auth.user.id)
  return NextResponse.json({ assignments })
})
