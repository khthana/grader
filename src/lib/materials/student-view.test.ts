import { describe, it, expect } from "vitest"
import { canSeeMaterial, materialFor, materialsOutlineFor } from "./student-view"
import { buildMaterialsOutline, type MaterialSummary } from "./outline"
import type { PlanEntry } from "@/lib/syllabus/plan"

const staff = { staff: true }
const student = { staff: false }

describe("canSeeMaterial", () => {
  it.each([
    // viewer, published, planned, sees
    [staff, true, true, true],
    [staff, true, false, true],
    [staff, false, true, true],
    [staff, false, false, true],
    [student, true, true, true],
    [student, true, false, false],
    [student, false, true, false],
    [student, false, false, false],
  ])("%j · published %s · planned %s → %s", (viewer, isPublished, planned, sees) => {
    expect(canSeeMaterial(viewer, { isPublished }, planned)).toBe(sees)
  })
})

describe("materialFor", () => {
  const material = { weekNo: 1, kind: "slides" as const, body: "b", isPublished: true, updatedAt: "t" }

  it("leaves a Material untouched for staff", () => {
    expect(materialFor(staff, material)).toBe(material)
  })

  it("drops the published flag for a Student", () => {
    expect(materialFor(student, material)).toEqual({ weekNo: 1, kind: "slides", body: "b", updatedAt: "t" })
  })
})

describe("materialsOutlineFor", () => {
  const plan: PlanEntry[] = [
    { weekNo: 1, topic: "Intro", detail: "" },
    { weekNo: 2, topic: "Array", detail: "" },
    { weekNo: 3, topic: "สอบกลางภาค", detail: "" },
  ]
  const m = (weekNo: number, kind: MaterialSummary["kind"], isPublished: boolean): MaterialSummary => ({
    weekNo,
    kind,
    isPublished,
  })
  const outline = buildMaterialsOutline(plan, [
    m(1, "slides", true),
    m(1, "lab", false),
    m(2, "handout", false),
    m(9, "slides", true),
  ])

  it("leaves the outline untouched for staff — every week, every Material, the Unplanned ones", () => {
    expect(materialsOutlineFor(staff, outline)).toBe(outline)
  })

  it("gives a Student only Published Materials of planned weeks, without the flag", () => {
    expect(materialsOutlineFor(student, outline)).toEqual({
      weeks: [{ weekNo: 1, heading: "Intro", materials: { slides: { weekNo: 1, kind: "slides" } } }],
      unplanned: [],
    })
  })

  it("drops a week whose Materials are all unpublished, and a week with none", () => {
    const weeks = materialsOutlineFor(student, outline).weeks.map((w) => w.weekNo)
    expect(weeks).not.toContain(2)
    expect(weeks).not.toContain(3)
  })

  it("never gives a Student an Unplanned Material, published or not", () => {
    expect(materialsOutlineFor(student, outline).unplanned).toEqual([])
  })
})
