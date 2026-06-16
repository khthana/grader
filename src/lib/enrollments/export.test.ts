import { describe, it, expect } from "vitest"
import { rosterToSheet } from "./export"
import type { EnrollmentListItem } from "./repository"

const row = (over: Partial<EnrollmentListItem> = {}): EnrollmentListItem => ({
  id: 1,
  userId: 10,
  sid: "65010100",
  prefix: "นาย",
  name: "ประพาฬพงษ์ ธรรมาวาดานันท์",
  program: "วิศวกรรมคอมพิวเตอร์",
  studyGroup: "1",
  year: "2565",
  ...over,
})

describe("rosterToSheet", () => {
  it("emits a header row followed by each enrollment in column order", () => {
    const sheet = rosterToSheet([row()])

    expect(sheet[0]).toEqual([
      "รหัสนักศึกษา",
      "คำนำหน้า",
      "ชื่อ - นามสกุล",
      "หลักสูตร",
      "กลุ่ม",
      "ปีการศึกษา",
    ])
    expect(sheet[1]).toEqual([
      "65010100",
      "นาย",
      "ประพาฬพงษ์ ธรรมาวาดานันท์",
      "วิศวกรรมคอมพิวเตอร์",
      "1",
      "2565",
    ])
  })

  it("renders null fields as empty strings", () => {
    const sheet = rosterToSheet([
      row({ sid: null, prefix: null, program: null, studyGroup: null, year: null }),
    ])
    expect(sheet[1]).toEqual(["", "", "ประพาฬพงษ์ ธรรมาวาดานันท์", "", "", ""])
  })

  it("returns only the header row for an empty roster", () => {
    const sheet = rosterToSheet([])
    expect(sheet).toHaveLength(1)
    expect(sheet[0][0]).toBe("รหัสนักศึกษา")
  })
})
