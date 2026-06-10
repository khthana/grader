import { NextRequest, NextResponse } from "next/server"
import { runTestCases } from "@/lib/piston"
import { SubmissionRequest, GradeResult } from "@/types"
import { getUserFromRequest } from "@/lib/auth-guard"

// ข้อมูลโจทย์ตัวอย่าง — ย้ายไป database ทีหลังได้
const problems = {
  "hello-world": {
    testCases: [
      {
        id: "1",
        input: "",
        expectedOutput: "Hello, World!",
        isHidden: false,
      },
    ],
  },
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const body: SubmissionRequest = await request.json()
    const { problemId, code } = body

    // ตรวจสอบ input
    if (!problemId || !code) {
      return NextResponse.json(
        { error: "problemId and code are required" },
        { status: 400 }
      )
    }

    // หา problem
    const problem = problems[problemId as keyof typeof problems]
    if (!problem) {
      return NextResponse.json(
        { error: "Problem not found" },
        { status: 404 }
      )
    }

    // ส่งไป Piston แล้วรับผล
    const results = await runTestCases(code, problem.testCases)

    // คำนวณคะแนน
    const passedTests = results.filter((r) => r.passed).length
    const totalTests = results.length
    const score = Math.round((passedTests / totalTests) * 100)

    const gradeResult: GradeResult = {
      score,
      totalTests,
      passedTests,
      results,
      feedback:
        score === 100
          ? "ผ่านทุก test case!"
          : `ผ่าน ${passedTests}/${totalTests} test cases`,
    }

    return NextResponse.json(gradeResult)

  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}