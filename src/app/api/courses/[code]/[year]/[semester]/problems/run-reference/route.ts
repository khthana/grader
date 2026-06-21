import { NextResponse } from "next/server"
import { courseRoute } from "@/lib/courses/route"
import { runReferenceSolution } from "@/lib/piston"

export const POST = courseRoute<{ code: string; year: string; semester: string }>(
  { manage: true },
  async (request) => {
    const body = await request.json().catch(() => null)

    if (
      !body ||
      typeof body.code !== "string" ||
      !Array.isArray(body.inputs)
    ) {
      return NextResponse.json(
        { error: "code (string) and inputs (array) are required" },
        { status: 400 }
      )
    }

    const outputs = await runReferenceSolution(body.code as string, body.inputs as string[])
    return NextResponse.json({ outputs })
  }
)
