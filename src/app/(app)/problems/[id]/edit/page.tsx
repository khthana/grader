import { notFound, redirect } from "next/navigation"
import { getDb } from "@/lib/db"
import { getProblemById } from "@/lib/problems/repository"
import { buildCoursePath } from "@/lib/courses/slug"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LegacyEditProblemPage({ params }: PageProps) {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId)) notFound()

  const db = getDb()
  const problem = await getProblemById(db, problemId)
  if (!problem) notFound()

  const { rows } = await db.query<{ week_no: number }>(
    "SELECT week_no FROM weeks WHERE id = $1::int",
    [problem.weekId]
  )
  if (!rows[0]) notFound()

  const key = { code: problem.courseCode, year: problem.courseYear, semester: problem.courseSemester }
  redirect(`${buildCoursePath(key)}/problems/${rows[0].week_no}/${problem.problemNo}/edit`)
}
