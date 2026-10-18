import { describe, it, expect } from "vitest"
import { buildMaterialsOutline, materialHeading } from "./outline"
import type { MaterialSummary } from "./outline"
import type { PlanEntry } from "@/lib/syllabus/plan"

const entry = (weekNo: number, topic: string): PlanEntry => ({ weekNo, topic, detail: "" })
const material = (weekNo: number, kind: MaterialSummary["kind"]): MaterialSummary => ({
  weekNo,
  kind,
  isPublished: false,
})

describe("materialHeading", () => {
  const plan = [entry(1, "Intro"), entry(2, "Array"), entry(2, "Lab Array"), entry(4, "สอบกลางภาค")]

  it("is the week's one topic", () => {
    expect(materialHeading(plan, 1)).toBe("Intro")
  })

  it("joins several entries of one week in plan order", () => {
    expect(materialHeading(plan, 2)).toBe("Array · Lab Array")
  })

  it("is null for a week not in the plan", () => {
    expect(materialHeading(plan, 3)).toBeNull()
    expect(materialHeading([], 1)).toBeNull()
  })
})

describe("buildMaterialsOutline", () => {
  it("lists the distinct plan weeks in order, each with its heading", () => {
    const plan = [entry(1, "Intro"), entry(2, "Array"), entry(2, "Lab Array"), entry(5, "Loop")]
    const outline = buildMaterialsOutline(plan, [])
    expect(outline.weeks).toEqual([
      { weekNo: 1, heading: "Intro", materials: {} },
      { weekNo: 2, heading: "Array · Lab Array", materials: {} },
      { weekNo: 5, heading: "Loop", materials: {} },
    ])
    expect(outline.unplanned).toEqual([])
  })

  it("puts each Material in its week's Kind slot", () => {
    const outline = buildMaterialsOutline(
      [entry(1, "Intro"), entry(2, "Array")],
      [material(2, "lab"), material(1, "slides"), material(2, "slides")]
    )
    expect(outline.weeks[0].materials).toEqual({ slides: material(1, "slides") })
    expect(outline.weeks[1].materials).toEqual({ slides: material(2, "slides"), lab: material(2, "lab") })
  })

  it("sets aside Materials whose week isn't in the plan, by week then Kind", () => {
    const outline = buildMaterialsOutline(
      [entry(1, "Intro")],
      [material(9, "lab"), material(1, "handout"), material(9, "slides"), material(3, "handout")]
    )
    expect(outline.weeks[0].materials).toEqual({ handout: material(1, "handout") })
    expect(outline.unplanned).toEqual([material(3, "handout"), material(9, "slides"), material(9, "lab")])
  })

  it("with an empty plan, every Material is unplanned", () => {
    const outline = buildMaterialsOutline([], [material(1, "slides")])
    expect(outline.weeks).toEqual([])
    expect(outline.unplanned).toEqual([material(1, "slides")])
  })
})
