// Quiz Report (#94, ADR 0011): what staff see of a Quiz's Pre vs Post results —
// overview, per-question tallies and per-student scores — optionally narrowed
// to one Group. Only submitted attempts count (submitted by the Student, or
// auto-submitted once their Group's window closed).
import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { listAllEnrollments, type EnrollmentListItem } from "@/lib/enrollments/repository"
import { isAttemptSubmitted, questionOutcome, scoreAttempt } from "./attempt"
import { getAttempt, listAttemptsForQuiz, type AttemptRecord } from "./attempt-repository"
import type { QuizDetail } from "./repository"
import { quizResultForRounds, studentGroupKey } from "./quiz-access"
import type { QuizResult } from "./result-view"
import { QUIZ_ROUNDS, QUIZ_ROUND_LABEL, type QuizRound } from "./round-window"
import { groupKeyOf, groupLabel, groupRoundWindows, listWindows, quizGroups, type RoundWindow } from "./windows"

export interface RoundTally {
  correct: number
  wrong: number
  dontKnow: number
  unanswered: number
  /** choice letter → how many picked it (ไม่ทราบ is counted in `dontKnow`). */
  choices: Record<string, number>
}

export interface QuestionReport {
  id: number
  no: number
  topic: string
  correctLetter: string
  choices: { letter: string; text: string }[]
  pre: RoundTally
  post: RoundTally
}

export interface StudentReportRow {
  userId: number
  sid: string | null
  name: string
  groupKey: string
  /** The Group as shown (กลุ่ม 1 / ไม่ระบุกลุ่ม). */
  group: string
  pre: number | null
  post: number | null
  /** Post − Pre, only when both rounds are submitted. */
  diff: number | null
}

export interface RoundOverview {
  submitted: number
  average: number | null
}

export interface QuizReport {
  /** The Group filter applied, or null for every Group. */
  group: string | null
  groups: { key: string; label: string }[]
  overview: { enrolled: number; max: number } & Record<QuizRound, RoundOverview>
  questions: QuestionReport[]
  students: StudentReportRow[]
}

/** Each roster Student's submitted attempt per round (null = none counted). */
type SubmittedAttempts = Record<QuizRound, AttemptRecord | null>

function submittedAttempts(
  student: EnrollmentListItem,
  attempts: AttemptRecord[],
  windows: RoundWindow[],
  now: Date
): SubmittedAttempts {
  const rounds = groupRoundWindows(windows, groupKeyOf(student.studyGroup), now)
  return Object.fromEntries(
    QUIZ_ROUNDS.map((r) => {
      const a = attempts.find((x) => x.userId === student.userId && x.round === r) ?? null
      return [r, a && isAttemptSubmitted(a, rounds[r].state) ? a : null]
    })
  ) as SubmittedAttempts
}

function tally(q: QuizDetail["questions"][number], taken: AttemptRecord[]): RoundTally {
  const t: RoundTally = {
    correct: 0,
    wrong: 0,
    dontKnow: 0,
    unanswered: 0,
    choices: Object.fromEntries(q.choices.map((c) => [c.letter, 0])),
  }
  const bucket = { correct: "correct", wrong: "wrong", "dont-know": "dontKnow", unanswered: "unanswered" } as const
  for (const a of taken) {
    const answer = a.answers[String(q.id)]
    const outcome = questionOutcome(q, answer)
    t[bucket[outcome]] += 1
    // A picked choice is correct or wrong; ไม่ทราบ and blanks pick none.
    if ((outcome === "correct" || outcome === "wrong") && answer in t.choices) t.choices[answer] += 1
  }
  return t
}

const average = (scores: number[]) => (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null)

/** The report (pure): roster × attempts × windows at `now`, narrowed to `group`. */
export function buildQuizReport(
  quiz: QuizDetail,
  ctx: {
    roster: EnrollmentListItem[]
    attempts: AttemptRecord[]
    windows: RoundWindow[]
    groups: string[]
    group: string | null
    now: Date
  }
): QuizReport {
  const roster = ctx.roster.filter((e) => ctx.group === null || groupKeyOf(e.studyGroup) === ctx.group)
  const taken = roster.map((student) => ({
    student,
    attempts: submittedAttempts(student, ctx.attempts, ctx.windows, ctx.now),
  }))
  const scoreOf = (a: AttemptRecord | null) => (a ? scoreAttempt(quiz.questions, a.answers).score : null)

  const students: StudentReportRow[] = taken.map(({ student, attempts }) => {
    const pre = scoreOf(attempts.pre)
    const post = scoreOf(attempts.post)
    return {
      userId: student.userId,
      sid: student.sid,
      name: student.name,
      groupKey: groupKeyOf(student.studyGroup),
      group: groupLabel(groupKeyOf(student.studyGroup)),
      pre,
      post,
      diff: pre !== null && post !== null ? post - pre : null,
    }
  })

  const submittedIn = (round: QuizRound) =>
    taken.map((t) => t.attempts[round]).filter((a): a is AttemptRecord => a !== null)
  const overviewOf = (round: QuizRound): RoundOverview => {
    const scores = students.map((s) => s[round]).filter((v): v is number => v !== null)
    return { submitted: scores.length, average: average(scores) }
  }

  return {
    group: ctx.group,
    groups: ctx.groups.map((key) => ({ key, label: groupLabel(key) })),
    overview: {
      enrolled: roster.length,
      max: quiz.questions.length,
      pre: overviewOf("pre"),
      post: overviewOf("post"),
    },
    questions: quiz.questions.map((q, i) => ({
      id: q.id,
      no: i + 1,
      topic: q.topic,
      correctLetter: q.correctLetter,
      choices: q.choices.map((c) => ({ letter: c.letter, text: c.text })),
      pre: tally(q, submittedIn("pre")),
      post: tally(q, submittedIn("post")),
    })),
    students,
  }
}

const listRoster = (db: Queryable, course: CourseKey) =>
  listAllEnrollments(db, { courseKey: course, search: "", group: "" })

/** Load and build the Quiz Report for this course's Quiz. */
export async function loadQuizReport(
  db: Queryable,
  course: CourseKey,
  quiz: QuizDetail,
  group: string | null,
  now: Date
): Promise<QuizReport> {
  const windows = await listWindows(db, quiz.id)
  return buildQuizReport(quiz, {
    roster: await listRoster(db, course),
    attempts: await listAttemptsForQuiz(db, quiz.id),
    windows,
    groups: await quizGroups(db, course, windows),
    group,
    now,
  })
}

/**
 * One roster Student's Pre vs Post answers with the key (staff view of the
 * Answer Key Release result) — null when the user isn't on the roster.
 */
export async function loadStudentResult(
  db: Queryable,
  course: CourseKey,
  quiz: QuizDetail,
  userId: number,
  now: Date
): Promise<QuizResult | null> {
  const groupKey = await studentGroupKey(db, course, userId)
  if (groupKey === null) return null
  const rounds = groupRoundWindows(await listWindows(db, quiz.id), groupKey, now)
  const records = Object.fromEntries(
    await Promise.all(QUIZ_ROUNDS.map(async (r) => [r, await getAttempt(db, quiz.id, r, userId)] as const))
  ) as Record<QuizRound, AttemptRecord | null>
  return quizResultForRounds({ staff: true }, quiz, rounds, (r) => records[r])
}

/** The report as two Excel sheets: รายคน and รายข้อ (rows of cells). */
export function quizReportSheets(report: QuizReport): { students: unknown[][]; questions: unknown[][] } {
  const students = [
    ["รหัส", "ชื่อ", "กลุ่ม", "Pre", "Post", "Post − Pre"],
    ...report.students.map((s) => [s.sid ?? "", s.name, s.group, s.pre, s.post, s.diff]),
  ]
  const letters = [...new Set(report.questions.flatMap((q) => q.choices.map((c) => c.letter)))]
  const roundCols = (label: string) => [
    `${label} ถูก`,
    `${label} ผิด`,
    `${label} ไม่ทราบ`,
    `${label} ไม่ตอบ`,
    ...letters.map((l) => `${label} เลือก ${l}`),
  ]
  const roundCells = (t: RoundTally) => [t.correct, t.wrong, t.dontKnow, t.unanswered, ...letters.map((l) => t.choices[l] ?? null)]
  const questions = [
    ["ข้อ", "หัวข้อ", "เฉลย", ...QUIZ_ROUNDS.flatMap((r) => roundCols(QUIZ_ROUND_LABEL[r]))],
    ...report.questions.map((q) => [q.no, q.topic, q.correctLetter, ...QUIZ_ROUNDS.flatMap((r) => roundCells(q[r]))]),
  ]
  return { students, questions }
}
