import { NextResponse } from "next/server"
import { courseRoute } from "@/lib/courses/route"
import { verifyReferenceSolution } from "@/lib/grading"
import { isProblemTypeAllowed } from "@/lib/problems/problem-type"

// "รันเฉลย": run the Instructor's Reference Solution through the same
// CodeRunner as grading, so the editor's verdict matches grading's (#85).
export const POST = courseRoute<{ code: string; year: string; semester: string }>(
  { manage: true },
  async (request, auth) => {
    const body = await request.json().catch(() => null)

    if (!body || typeof body.code !== "string") {
      return NextResponse.json({ error: "code (string) is required" }, { status: 400 })
    }
    const language = auth.course.language

    // Unit mode (#55): run reference solution + the unit test block once; report pass/fail.
    if (body.problemType === "unit") {
      // The harness is Python-only — same rule as saving a Problem (#64, #86).
      if (!isProblemTypeAllowed("unit", language)) {
        return NextResponse.json(
          { error: "unit mode is not available for this course language" },
          { status: 400 }
        )
      }
      if (typeof body.unitTestCode !== "string") {
        return NextResponse.json(
          { error: "unitTestCode (string) is required for unit mode" },
          { status: 400 }
        )
      }
      const outputs = await verifyReferenceSolution(
        { code: body.code, problemType: "unit", unitTestCode: body.unitTestCode },
        language
      )
      return NextResponse.json({ outputs })
    }

    if (!Array.isArray(body.inputs) || !body.inputs.every((i: unknown) => typeof i === "string")) {
      return NextResponse.json(
        { error: "inputs (array of strings) is required for io mode" },
        { status: 400 }
      )
    }

    // Compile + run in the course's language (#64) so an Instructor can compute
    // expected outputs for a C problem too.
    const outputs = await verifyReferenceSolution(
      { code: body.code, problemType: "io", inputs: body.inputs },
      language
    )
    return NextResponse.json({ outputs })
  }
)
