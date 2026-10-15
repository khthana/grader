import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import type { QuizAnswers } from "./attempt"
import type { QuizRound } from "./round-window"
import { groupKeyOf } from "./windows"

export interface AttemptRecord {
  id: number
  quizId: number
  round: QuizRound
  userId: number
  answers: QuizAnswers
  startedAt: string
  updatedAt: string
  submittedAt: string | null
}

interface AttemptRow {
  id: number
  quiz_id: number
  round: QuizRound
  user_id: number
  answers: QuizAnswers | string
  started_at: Date | string
  updated_at: Date | string
  submitted_at: Date | string | null
}

const COLS = `id, quiz_id, round, user_id, answers, started_at, updated_at, submitted_at`
const iso = (v: Date | string) => new Date(v).toISOString()

function toRecord(row: AttemptRow): AttemptRecord {
  return {
    id: row.id,
    quizId: row.quiz_id,
    round: row.round,
    userId: row.user_id,
    answers: typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers,
    startedAt: iso(row.started_at),
    updatedAt: iso(row.updated_at),
    submittedAt: row.submitted_at === null ? null : iso(row.submitted_at),
  }
}

export async function getAttempt(
  db: Queryable,
  quizId: number,
  round: QuizRound,
  userId: number
): Promise<AttemptRecord | null> {
  const { rows } = await db.query<AttemptRow>(
    `SELECT ${COLS} FROM quiz_attempts WHERE quiz_id = $1::int AND round = $2 AND user_id = $3::int`,
    [quizId, round, userId]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

/** The Student's attempt at this round, started now if there is none yet. */
export async function getOrStartAttempt(
  db: Queryable,
  quizId: number,
  round: QuizRound,
  userId: number
): Promise<AttemptRecord> {
  const existing = await getAttempt(db, quizId, round, userId)
  if (existing) return existing
  try {
    const { rows } = await db.query<AttemptRow>(
      `INSERT INTO quiz_attempts (quiz_id, round, user_id) VALUES ($1::int, $2, $3::int) RETURNING ${COLS}`,
      [quizId, round, userId]
    )
    return toRecord(rows[0])
  } catch (err) {
    // A concurrent first open won the UNIQUE (quiz, round, user) race.
    const raced = await getAttempt(db, quizId, round, userId)
    if (raced) return raced
    throw err
  }
}

export async function saveAnswers(db: Queryable, attemptId: number, answers: QuizAnswers): Promise<void> {
  await db.query(`UPDATE quiz_attempts SET answers = $2::jsonb, updated_at = now() WHERE id = $1::int`, [
    attemptId,
    JSON.stringify(answers),
  ])
}

export async function submitAttempt(db: Queryable, attemptId: number): Promise<void> {
  await db.query(
    `UPDATE quiz_attempts SET submitted_at = now(), updated_at = now() WHERE id = $1::int AND submitted_at IS NULL`,
    [attemptId]
  )
}

/** One Student's attempts at every Quiz of a course. */
export async function listAttemptsForUser(db: Queryable, key: CourseKey, userId: number): Promise<AttemptRecord[]> {
  const { rows } = await db.query<AttemptRow>(
    `SELECT a.id, a.quiz_id, a.round, a.user_id, a.answers, a.started_at, a.updated_at, a.submitted_at
     FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
     WHERE q.course_code = $1 AND q.course_year = $2::int AND q.course_semester = $3::int
       AND a.user_id = $4::int`,
    [key.code, key.year, key.semester, userId]
  )
  return rows.map(toRecord)
}

/** The course's locked Quizzes — those with any attempt (cf. isQuizLocked). */
export async function lockedQuizIds(db: Queryable, key: CourseKey): Promise<Set<number>> {
  const { rows } = await db.query<{ quiz_id: number }>(
    `SELECT DISTINCT a.quiz_id
     FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
     WHERE q.course_code = $1 AND q.course_year = $2::int AND q.course_semester = $3::int`,
    [key.code, key.year, key.semester]
  )
  return new Set(rows.map((r) => r.quiz_id))
}

/** Locked = any Student has started an attempt. No stored flag. */
export async function isQuizLocked(db: Queryable, quizId: number): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM quiz_attempts WHERE quiz_id = $1::int LIMIT 1`, [quizId])
  return rows.length > 0
}

/**
 * Freeze the auto-submit of a closed Round Window: every unsubmitted attempt
 * at this round by a Student of the Group gets `submitted_at = closedAt`. Run
 * before staff change a closed window, so reopening (or clearing) it never
 * makes an already-submitted attempt editable again.
 */
export async function sealAttempts(
  db: Queryable,
  key: CourseKey,
  quizId: number,
  round: QuizRound,
  groupKey: string,
  closedAt: Date
): Promise<void> {
  const { rows } = await db.query<{ user_id: number; study_group: string | null }>(
    `SELECT user_id, study_group FROM enrollments
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int`,
    [key.code, key.year, key.semester]
  )
  const userIds = rows.filter((r) => groupKeyOf(r.study_group) === groupKey).map((r) => r.user_id)
  if (userIds.length === 0) return
  const placeholders = userIds.map((_, i) => `$${i + 4}::int`).join(", ")
  await db.query(
    `UPDATE quiz_attempts SET submitted_at = $3
     WHERE quiz_id = $1::int AND round = $2 AND submitted_at IS NULL AND user_id IN (${placeholders})`,
    [quizId, round, closedAt, ...userIds]
  )
}

/** Every attempt at one Quiz (both rounds, all Students). */
export async function listAttemptsForQuiz(db: Queryable, quizId: number): Promise<AttemptRecord[]> {
  const { rows } = await db.query<AttemptRow>(`SELECT ${COLS} FROM quiz_attempts WHERE quiz_id = $1::int`, [quizId])
  return rows.map(toRecord)
}
