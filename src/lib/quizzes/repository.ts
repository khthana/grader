import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import type { QuizChoice, QuizQuestionDraft } from "./import"

export interface QuizRecord {
  id: number
  courseCode: string
  courseYear: number
  courseSemester: number
  weekId: number | null
  weekNo: number | null
  title: string
  description: string
  dontKnowEnabled: boolean
  questionCount: number
  createdAt: string
}

export interface QuizQuestion extends QuizQuestionDraft {
  id: number
}

export interface QuizDetail extends QuizRecord {
  questions: QuizQuestion[]
}

interface QuizRow {
  id: number
  course_code: string
  course_year: number
  course_semester: number
  week_id: number | null
  week_no: number | null
  title: string
  description: string
  dont_know_enabled: boolean
  question_count: number | string
  created_at: Date | string
}

interface QuestionRow {
  id: number
  topic: string
  prompt: string
  code: string | null
  choices: QuizChoice[] | string
  correct_letter: string
  feedback: string
}

function toRecord(row: QuizRow): QuizRecord {
  return {
    id: row.id,
    courseCode: row.course_code,
    courseYear: row.course_year,
    courseSemester: row.course_semester,
    weekId: row.week_id,
    weekNo: row.week_no,
    title: row.title,
    description: row.description,
    dontKnowEnabled: row.dont_know_enabled,
    questionCount: Number(row.question_count),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function toQuestion(row: QuestionRow): QuizQuestion {
  return {
    id: row.id,
    topic: row.topic,
    prompt: row.prompt,
    code: row.code,
    choices: typeof row.choices === "string" ? JSON.parse(row.choices) : row.choices,
    correctLetter: row.correct_letter,
    feedback: row.feedback,
  }
}

// week_no via LEFT JOIN. question_count comes from a second query (pg-mem
// can't run the correlated subquery).
const QUIZ_SELECT = `
  SELECT q.id, q.course_code, q.course_year, q.course_semester, q.week_id, w.week_no,
         q.title, q.description, q.dont_know_enabled, q.created_at
  FROM quizzes q
  LEFT JOIN weeks w ON w.id = q.week_id`

const COURSE_WHERE = `q.course_code = $1 AND q.course_year = $2::int AND q.course_semester = $3::int`

async function questionCounts(db: Queryable, key: CourseKey): Promise<Map<number, number>> {
  const { rows } = await db.query<{ quiz_id: number; n: number | string }>(
    `SELECT qq.quiz_id, COUNT(*)::int AS n
     FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id
     WHERE ${COURSE_WHERE}
     GROUP BY qq.quiz_id`,
    [key.code, key.year, key.semester]
  )
  return new Map(rows.map((r) => [r.quiz_id, Number(r.n)]))
}

export async function listQuizzes(db: Queryable, key: CourseKey): Promise<QuizRecord[]> {
  const { rows } = await db.query<Omit<QuizRow, "question_count">>(
    `${QUIZ_SELECT} WHERE ${COURSE_WHERE} ORDER BY q.id`,
    [key.code, key.year, key.semester]
  )
  const counts = await questionCounts(db, key)
  return rows.map((r) => toRecord({ ...r, question_count: counts.get(r.id) ?? 0 }))
}

/** Course-scoped read: null unless the Quiz belongs to `key`. */
export async function getQuizForCourse(
  db: Queryable,
  key: CourseKey,
  id: number
): Promise<QuizDetail | null> {
  const { rows } = await db.query<Omit<QuizRow, "question_count">>(
    `${QUIZ_SELECT} WHERE ${COURSE_WHERE} AND q.id = $4::int`,
    [key.code, key.year, key.semester, id]
  )
  if (rows.length === 0) return null
  const { rows: qrows } = await db.query<QuestionRow>(
    `SELECT id, topic, prompt, code, choices, correct_letter, feedback
     FROM quiz_questions WHERE quiz_id = $1::int ORDER BY sort_order, id`,
    [id]
  )
  const questions = qrows.map(toQuestion)
  return { ...toRecord({ ...rows[0], question_count: questions.length }), questions }
}

export async function createQuiz(
  db: Queryable,
  key: CourseKey,
  data: {
    title: string
    description: string
    weekId: number | null
    dontKnowEnabled: boolean
    questions: QuizQuestionDraft[]
  }
): Promise<QuizDetail> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO quizzes (course_code, course_year, course_semester, week_id, title, description, dont_know_enabled)
     VALUES ($1, $2::int, $3::int, $4::int, $5, $6, $7)
     RETURNING id`,
    [key.code, key.year, key.semester, data.weekId, data.title, data.description, data.dontKnowEnabled]
  )
  const id = rows[0].id
  await replaceQuestions(db, id, data.questions)
  return (await getQuizForCourse(db, key, id))!
}

export async function updateQuizMeta(
  db: Queryable,
  id: number,
  data: { title: string; description: string; weekId: number | null; dontKnowEnabled: boolean }
): Promise<void> {
  await db.query(
    `UPDATE quizzes
     SET title = $2, description = $3, week_id = $4::int, dont_know_enabled = $5, updated_at = now()
     WHERE id = $1::int`,
    [id, data.title, data.description, data.weekId, data.dontKnowEnabled]
  )
}

/** Replace every question of a Quiz (import / re-import). */
export async function replaceQuestions(
  db: Queryable,
  quizId: number,
  questions: QuizQuestionDraft[]
): Promise<void> {
  await db.query(`DELETE FROM quiz_questions WHERE quiz_id = $1::int`, [quizId])
  for (const [i, q] of questions.entries()) {
    await db.query(
      `INSERT INTO quiz_questions (quiz_id, sort_order, topic, prompt, code, choices, correct_letter, feedback)
       VALUES ($1::int, $2::int, $3, $4, $5, $6::jsonb, $7, $8)`,
      [quizId, i + 1, q.topic, q.prompt, q.code, JSON.stringify(q.choices), q.correctLetter, q.feedback]
    )
  }
}

export async function deleteQuiz(db: Queryable, id: number): Promise<void> {
  await db.query(`DELETE FROM quizzes WHERE id = $1::int`, [id])
}
