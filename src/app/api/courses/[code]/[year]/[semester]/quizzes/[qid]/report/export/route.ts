import * as XLSX from "xlsx"
import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { findQuizForCourse, quizNotFound } from "@/lib/quizzes/route-helpers"
import { loadQuizReport, quizReportSheets } from "@/lib/quizzes/report"

type Params = { code: string; year: string; semester: string; qid: string }

/** The Quiz Report as an .xlsx — sheets รายคน and รายข้อ; `?group=` as the report. */
export const GET = courseRoute<Params>({ staff: true }, async (req, auth, { qid }) => {
  const db = getDb()
  const quiz = await findQuizForCourse(db, auth.course, qid)
  if (!quiz) return quizNotFound()
  const group = new URL(req.url).searchParams.get("group")
  const sheets = quizReportSheets(await loadQuizReport(db, auth.course, quiz, group, new Date()))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets.students), "รายคน")
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets.questions), "รายข้อ")
  const body: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quiz-${quiz.id}-report.xlsx"`,
    },
  })
})
