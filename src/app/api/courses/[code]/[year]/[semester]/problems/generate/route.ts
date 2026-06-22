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

    let fields: { title: string; description: string; inputSpec?: string | null; outputSpec?: string | null; problemType?: "io" | "unit" }

    if (body && typeof body.problemId === "number") {
      const db = getDb()
      const problem = await getProblemById(db, body.problemId as number)
      if (!problem || !ownsProblem(problem, auth.course)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      fields = {
        title: problem.title,
        description: problem.description,
        inputSpec: problem.inputSpec,
        outputSpec: problem.outputSpec,
        problemType: (problem.problemType === "unit" ? "unit" : "io") as "io" | "unit",
      }
    } else if (body && typeof body.title === "string") {
      if (!body.title.trim()) {
        return NextResponse.json({ error: "title is required" }, { status: 400 })
      }
      fields = {
        title: body.title as string,
        description: typeof body.description === "string" ? (body.description as string) : "",
        inputSpec: typeof body.inputSpec === "string" ? (body.inputSpec as string) : null,
        outputSpec: typeof body.outputSpec === "string" ? (body.outputSpec as string) : null,
        problemType: (body.problemType === "unit" ? "unit" : "io") as "io" | "unit",
      }
    } else {
      return NextResponse.json(
        { error: "problemId (number) or title (string) is required" },
        { status: 400 }
      )
    }

    try {
      const result = await generateTestPlan(fields)
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof LlmNotConfiguredError) {
        return NextResponse.json({ error: "LLM not configured" }, { status: 503 })
      }
      throw err
    }
  }
)
