// Syllabus Draft (#99) — the one place a Syllabus body is validated and
// normalized, like the Problem Draft (#83). The route never validates the raw
// body itself; what comes out here is exactly what gets written.

import { isPlanWeek, sortPlan, MAX_PLAN_WEEK, MIN_PLAN_WEEK, type PlanEntry } from "./plan"
import { rowErrorKey, type Errors, type RowList } from "./rows"
import { isWeight, MAX_WEIGHT, type AssessmentComponent } from "./weights"

/** A Course offering's Syllabus as stored (staff are read live, never stored). */
export interface Syllabus {
  credits: string
  description: string
  objectives: string
  /** The Teaching Plan (#100), sorted by week. */
  plan: PlanEntry[]
  /** Assessment Components (#101), in the order sent. */
  assessments: AssessmentComponent[]
}

export const EMPTY_SYLLABUS: Syllabus = { credits: "", description: "", objectives: "", plan: [], assessments: [] }

const TEXT_FIELDS = ["credits", "description", "objectives"] as const

const TEXT_FIELD_LABELS: Record<(typeof TEXT_FIELDS)[number], string> = {
  credits: "หน่วยกิต",
  description: "คำอธิบายรายวิชา",
  objectives: "วัตถุประสงค์การเรียนรู้",
}

export type SyllabusDraftResult = { ok: true; draft: Syllabus } | { ok: false; errors: Errors }

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** Reads one row's fields, recording a field error under that row's key. */
interface RowReader {
  /** Optional text, trimmed; a non-string is an error. */
  text(field: string, message: string): string
  /** Text that must not be empty once trimmed. */
  required(field: string, message: string): string
  /** The raw value if `valid`, else `fallback` (the error discards the draft anyway). */
  check<T>(field: string, valid: (value: unknown) => value is T, fallback: T, message: string): T
}

function optionalText(value: unknown, onError: () => void): string {
  if (value == null) return ""
  if (typeof value !== "string") {
    onError()
    return ""
  }
  return value.trim()
}

function rowReader(raw: Record<string, unknown>, errors: Errors, list: RowList, row: number): RowReader {
  const fail = (field: string, message: string) => (errors[rowErrorKey(list, row, field)] = message)
  return {
    text: (field, message) => optionalText(raw[field], () => fail(field, message)),
    required(field, message) {
      const text = typeof raw[field] === "string" ? (raw[field] as string).trim() : ""
      if (text === "") fail(field, message)
      return text
    },
    check(field, valid, fallback, message) {
      const value = raw[field]
      if (valid(value)) return value
      fail(field, message)
      return fallback
    },
  }
}

const LIST_MESSAGES: Record<RowList, string> = {
  plan: "แผนการสอนไม่ถูกต้อง",
  assessments: "เกณฑ์การวัดผลไม่ถูกต้อง",
}

// Errors are keyed by the row's position as sent (`plan.2.topic`), which is
// the editor's row order; the plan is sorted only after.
function buildRows<T>(value: unknown, list: RowList, errors: Errors, build: (row: RowReader) => T): T[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    errors[list] = LIST_MESSAGES[list]
    return []
  }
  const rows: T[] = []
  value.forEach((raw, i) => {
    if (!isObject(raw)) errors[rowErrorKey(list, i)] = "แถวไม่ถูกต้อง"
    else rows.push(build(rowReader(raw, errors, list, i)))
  })
  return rows
}

const buildPlanEntry = (row: RowReader): PlanEntry => ({
  weekNo: row.check("weekNo", isPlanWeek, MIN_PLAN_WEEK, `สัปดาห์ต้องเป็นจำนวนเต็ม ${MIN_PLAN_WEEK}–${MAX_PLAN_WEEK}`),
  topic: row.required("topic", "กรุณากรอกหัวข้อ"),
  detail: row.text("detail", "รายละเอียดต้องเป็นข้อความ"),
})

const buildAssessment = (row: RowReader): AssessmentComponent => ({
  name: row.required("name", "กรุณากรอกชื่อ"),
  weight: row.check("weight", isWeight, 0, `สัดส่วนต้องอยู่ระหว่าง 0–${MAX_WEIGHT} (ทศนิยมไม่เกิน 2 ตำแหน่ง)`),
  note: row.text("note", "หมายเหตุต้องเป็นข้อความ"),
})

// A PUT replaces the whole Syllabus, so a field left out is cleared. A
// wrong-typed field is a field error (a 400), never a crash further down.
export function buildSyllabusDraft(body: unknown): SyllabusDraftResult {
  if (!isObject(body)) return { ok: false, errors: { body: "ข้อมูลไม่ถูกต้อง" } }
  const errors: Errors = {}
  const draft: Syllabus = {
    ...EMPTY_SYLLABUS,
    plan: sortPlan(buildRows(body.plan, "plan", errors, buildPlanEntry)),
    assessments: buildRows(body.assessments, "assessments", errors, buildAssessment),
  }
  for (const key of TEXT_FIELDS) {
    draft[key] = optionalText(body[key], () => (errors[key] = `${TEXT_FIELD_LABELS[key]}ต้องเป็นข้อความ`))
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, draft }
}

/** Nothing written yet — viewers see "ยังไม่มีประมวลรายวิชา". */
export function isSyllabusEmpty(syllabus: Syllabus): boolean {
  return (
    TEXT_FIELDS.every((key) => syllabus[key] === "") && syllabus.plan.length === 0 && syllabus.assessments.length === 0
  )
}
