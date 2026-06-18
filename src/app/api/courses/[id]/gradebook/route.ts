import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getGradebook } from "@/lib/gradebook/repository"

export const GET = courseRoute({ staff: true }, async (_request, auth) => {
  const gradebook = await getGradebook(getDb(), auth.courseId)
  return NextResponse.json({ gradebook })
})
