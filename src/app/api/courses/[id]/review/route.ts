import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { listPendingSubmissions } from "@/lib/submissions/repository"

export const GET = courseRoute({}, async (_request, auth) => {
  const submissions = await listPendingSubmissions(getDb(), auth.courseId)
  return NextResponse.json({ submissions })
})
