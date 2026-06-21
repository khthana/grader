import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getProblemById } from "@/lib/problems/repository"
import { generateTestPlan, LlmNotConfiguredError } from "@/lib/llm"

function ownsProblem(
  problem: { courseCode: string; courseYear: number; courseSemester: number },
  course: { code: string; year: number; semester: number }
) {
  return (
    problem.courseCode === course.code &&
    problem.courseYear === course.year &&
    problem.courseSemester === course.semester
  )
}

export const POST = courseRoute<{ code: string; year: string; semester: string }>(
  { manage: true },
  async (request, auth) => {
    const body = await request.json().catch(() => null)
    const problemId =
      body && typeof body.problemId === "number" ? (body.problemId as number) : null

    if (!problemId) {
      return NextResponse.json(
        { error: "problemId (number) is required" },
        { status: 400 }
      )
    }

    const db = getDb()
    const problem = await getProblemById(db, problemId)
    if (!problem || !ownsProblem(problem, auth.course)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    try {
      const result = await generateTestPlan({
        title: problem.title,
        description: problem.description,
        inputSpec: problem.inputSpec,
        outputSpec: problem.outputSpec,
      })
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof LlmNotConfiguredError) {
        return NextResponse.json({ error: "LLM not configured" }, { status: 503 })
      }
      throw err
    }
  }
)
