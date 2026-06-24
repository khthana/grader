import type { Queryable } from "@/lib/db"
import type { CourseKey, CourseRecord } from "@/lib/courses/types"
import {
  createCourse,
  getCourseByKey,
  listCourseInstructors,
  setCourseInstructors,
} from "@/lib/courses/repository"
import { listWeeks, createWeek } from "@/lib/weeks/repository"
import {
  listProblems,
  getProblemById,
  getReferenceSolution,
  createProblem,
  setTestCases,
} from "@/lib/problems/repository"

export type DuplicateResult =
  | { ok: true; course: CourseRecord }
  | { ok: false; reason: "target-exists" | "same-as-source" }

export async function duplicateCourseOffering(
  db: Queryable,
  source: CourseKey,
  target: { year: number; semester: number },
  actorId: number
): Promise<DuplicateResult> {
  if (source.year === target.year && source.semester === target.semester) {
    return { ok: false, reason: "same-as-source" }
  }

  const src = await getCourseByKey(db, source)
  if (!src) {
    // Callers (the duplicate route) authorize the source first, so a missing
    // source is an invariant violation rather than an expected outcome.
    throw new Error(
      `duplicateCourseOffering: source ${source.code}/${source.year}/${source.semester} not found`
    )
  }

  const targetKey = { code: src.code, year: target.year, semester: target.semester }
  if (await getCourseByKey(db, targetKey)) {
    return { ok: false, reason: "target-exists" }
  }

  const course = await createCourse(db, {
    code: src.code,
    year: target.year,
    semester: target.semester,
    nameTh: src.nameTh,
    nameEn: src.nameEn,
    program: src.program ?? undefined,
  })

  const instructors = await listCourseInstructors(db, source)
  const ids = new Set(instructors.map((i) => i.id))
  ids.add(actorId)
  await setCourseInstructors(db, course, [...ids])

  const weeks = await listWeeks(db, source)
  const weekIdMap = new Map<number, number>()
  for (const week of weeks) {
    const created = await createWeek(db, course, {
      weekNo: week.weekNo,
      topic: week.topic,
      isReleased: false,
    })
    weekIdMap.set(week.id, created.id)
  }

  // listProblems is ordered by (week_no, problem_no); copying in that order lets
  // createProblem's auto-assign reproduce the source's problem_no exactly.
  const problems = await listProblems(db, source)
  for (const p of problems) {
    const detail = await getProblemById(db, p.id)
    if (!detail) continue
    const targetWeekId = weekIdMap.get(detail.weekId)
    if (targetWeekId == null) continue // every source week was mirrored above
    // Trusted server-side copy: this runs inside the manage:true duplicate route
    // (already authorized), never reaching a Student. The raw read is correct
    // here; request/page paths use getReferenceSolutionForStaff instead.
    const referenceSolution = await getReferenceSolution(db, p.id)
    const created = await createProblem(db, {
      courseCode: course.code,
      courseYear: course.year,
      courseSemester: course.semester,
      weekId: targetWeekId,
      title: detail.title,
      description: detail.description,
      inputSpec: detail.inputSpec,
      outputSpec: detail.outputSpec,
      score: detail.score,
      dueAt: null,
      closeAt: null,
      language: detail.language,
      referenceSolution,
      problemType: detail.problemType,
      functionName: detail.functionName,
      starterCode: detail.starterCode,
      unitTestCode: detail.unitTestCode,
      blacklist: detail.blacklist,
      whitelist: detail.whitelist,
    })
    await setTestCases(
      db,
      created.id,
      detail.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        score: tc.score,
        sortOrder: tc.sortOrder,
      }))
    )
  }

  return { ok: true, course }
}
