import { NextResponse } from "next/server"
import { courseRoute } from "@/lib/courses/route"
import { runReferenceSolution, runUnitTestBlock } from "@/lib/piston"

export const POST = courseRoute<{ code: string; year: string; semester: string }>(
  { manage: true },
  async (request) => {
    const body = await request.json().catch(() => null)

    if (!body || typeof body.code !== "string") {
      return NextResponse.json({ error: "code (string) is required" }, { status: 400 })
    }

    // Unit mode (#55): run reference solution + the unit test block once; report pass/fail.
    if (body.problemType === "unit") {
      if (typeof body.unitTestCode !== "string") {
        return NextResponse.json(
          { error: "unitTestCode (string) is required for unit mode" },
          { status: 400 }
        )
      }
      const result = await runUnitTestBlock(body.code as string, body.unitTestCode as string)
      return NextResponse.json({
        outputs: [
          { stdout: result.actualOutput, stderr: result.error ?? "", ok: result.passed },
        ],
      })
    }

    if (!Array.isArray(body.inputs)) {
      return NextResponse.json(
        { error: "inputs (array) is required for io mode" },
        { status: 400 }
      )
    }

    const outputs = await runReferenceSolution(body.code as string, body.inputs as string[])
    return NextResponse.json({ outputs })
  }
)
