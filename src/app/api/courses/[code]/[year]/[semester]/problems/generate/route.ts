import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { getProblemForCourse } from "@/lib/problems/repository"
import { generateTestPlan, LlmNotConfiguredError } from "@/lib/llm"
import { canGenerateTests, isProblemType, toProblemType, type ProblemType } from "@/lib/problems/problem-type"

export const POST = courseRoute<{ code: string; year: string; semester: string }>(
  { manage: true },
  async (request, auth) => {
    const body = await request.json().catch(() => null)
    // A malformed type is rejected, not defaulted — defaulting to io would
    // silently override a stored unit problem in edit mode.
    if (body?.problemType != null && !isProblemType(body.problemType)) {
      return NextResponse.json({ error: "problemType must be io or unit" }, { status: 400 })
    }

    let fields: { title: string; description: string; inputSpec?: string | null; outputSpec?: string | null; problemType: ProblemType }

    if (body && typeof body.problemId === "number") {
      const db = getDb()
      const problem = await getProblemForCourse(db, auth.course, body.problemId as number)
      if (!problem) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      fields = {
        title: problem.title,
        description: problem.description,
        inputSpec: problem.inputSpec,
        outputSpec: problem.outputSpec,
        // The request's type (current UI state, may be unsaved) wins over the stored one.
        problemType: body.problemType ?? problem.problemType,
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
        problemType: toProblemType(body.problemType),
      }
    } else {
      return NextResponse.json(
        { error: "problemId (number) or title (string) is required" },
        { status: 400 }
      )
    }

    // The same rule ProblemEditor uses to hide the button, enforced here (#86).
    if (!canGenerateTests(fields.problemType, auth.course.language)) {
      return NextResponse.json(
        { error: "AI generation is not available for this course language" },
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
