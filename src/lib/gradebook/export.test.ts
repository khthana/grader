import { describe, it, expect } from "vitest"
import { gradebookToSheet } from "./export"
import type { Gradebook } from "./repository"

function gb(overrides: Partial<Gradebook> = {}): Gradebook {
  return {
    problems: [
      { id: 1, title: "Q1", weekNo: 1, pointsMax: 10, dueAt: null },
      { id: 2, title: "Q2", weekNo: 2, pointsMax: 20, dueAt: null },
    ],
    students: [
      {
        userId: 5,
        name: "สมชาย ใจดี",
        idCode: "64010001",
        scores: { 1: 8, 2: null },
        status: "missing",
      },
    ],
    ...overrides,
  }
}

describe("gradebookToSheet", () => {
  it("starts with a header row of identity columns, each problem title, then รวม", () => {
    const sheet = gradebookToSheet(gb())
    expect(sheet[0]).toEqual([
      "#",
      "รหัสนักศึกษา",
      "ชื่อ - นามสกุล",
      "สถานะ",
      "Q1",
      "Q2",
      "รวม",
    ])
  })

  it("renders a row per student with rank, identity, status label, scores, and total", () => {
    const sheet = gradebookToSheet(gb())
    // 8 on Q1, nothing on Q2 (blank), total 8, status missing -> ค้างส่ง
    expect(sheet[1]).toEqual(["1", "64010001", "สมชาย ใจดี", "ค้างส่ง", "8", "", "8"])
  })

  it("totals the submitted (effective) scores, ignoring blanks", () => {
    const sheet = gradebookToSheet(
      gb({
        students: [
          {
            userId: 9,
            name: "Bee",
            idCode: "64010002",
            scores: { 1: 10, 2: 15 },
            status: "complete",
          },
        ],
      })
    )
    expect(sheet[1]).toEqual(["1", "64010002", "Bee", "ส่งครบ", "10", "15", "25"])
  })

  it("numbers students by their position in the list", () => {
    const sheet = gradebookToSheet(
      gb({
        students: [
          { userId: 1, name: "A", idCode: "001", scores: { 1: 1, 2: 2 }, status: "complete" },
          { userId: 2, name: "B", idCode: "002", scores: { 1: 3, 2: 4 }, status: "late" },
        ],
      })
    )
    expect(sheet[1][0]).toBe("1")
    expect(sheet[2][0]).toBe("2")
    expect(sheet[2][2]).toBe("B")
  })

  it("returns only the header row when there are no students", () => {
    const sheet = gradebookToSheet(gb({ students: [] }))
    expect(sheet).toHaveLength(1)
  })
})
