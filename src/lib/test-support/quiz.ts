// Test seeding for Quizzes: a small Quiz, enrolled Students, Round Windows set
// relative to the real clock (no clock seam — ADR 0011 testing decision).
import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { createUser, assignRole } from "@/lib/users/repository"
import { createEnrollment } from "@/lib/enrollments/repository"
import { createQuiz } from "@/lib/quizzes/repository"
import { saveWindows } from "@/lib/quizzes/windows"
import type { QuizRound } from "@/lib/quizzes/round-window"

export const HOUR = 3_600_000

const choices = [
  { letter: "A", text: "a" },
  { letter: "B", text: "b" },
  { letter: "C", text: "c" },
]

/** A 3-question Quiz; the keys are A, B, C. */
export function seedQuiz(db: Queryable, key: CourseKey, opts: { dontKnowEnabled?: boolean } = {}) {
  return createQuiz(db, key, {
    title: "Pre W1",
    description: "",
    weekId: null,
    dontKnowEnabled: opts.dontKnowEnabled ?? true,
    questions: ["A", "B", "C"].map((correctLetter, i) => ({
      topic: `หัวข้อ ${i + 1}`,
      prompt: `ข้อ ${i + 1}`,
      code: null,
      choices,
      correctLetter,
      feedback: `เพราะ ${correctLetter}`,
    })),
  })
}

let n = 0
export async function seedStudent(db: Queryable, key: CourseKey, group: string | null) {
  n += 1
  const s = await createUser(db, { email: `quiz-s${n}@kmitl.ac.th`, name: `S${n}` })
  await assignRole(db, s.id, "Student")
  await createEnrollment(db, {
    courseCode: key.code,
    courseYear: key.year,
    courseSemester: key.semester,
    userId: s.id,
    studyGroup: group,
  })
  return s
}

export type WindowPhase = "not-open" | "open" | "closed"

/** Set one round's window for one Group to be not yet open / open / closed now. */
export function setWindow(db: Queryable, quizId: number, round: QuizRound, groupKey: string, phase: WindowPhase) {
  const at = (h: number) => new Date(Date.now() + h * HOUR)
  const times = {
    "not-open": { opensAt: at(1), closesAt: at(2) },
    open: { opensAt: at(-1), closesAt: at(1) },
    closed: { opensAt: at(-2), closesAt: at(-1) },
  }[phase]
  return saveWindows(db, quizId, [{ round, groupKey, ...times }])
}
