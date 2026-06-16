import { describe, it, expect } from "vitest"
import { validateRosterRows, type RawRosterRow } from "./import"

const goodRow: RawRosterRow = {
  idCode: "65010100",
  titleTh: "นาย",
  firstNameTh: "ประพาฬพงษ์",
  lastNameTh: "ธรรมาวาดานันท์",
  studyGroup: "1",
  year: "2565",
  program: "วิศวกรรมคอมพิวเตอร์",
}

describe("validateRosterRows", () => {
  it("marks a well-formed row valid and normalizes its cells", () => {
    const results = validateRosterRows([{ ...goodRow, firstNameTh: "  ประพาฬพงษ์  " }])
    expect(results).toHaveLength(1)
    expect(results[0].row).toBe(1)
    expect(results[0].valid).toBe(true)
    expect(results[0].errors).toEqual({})
    expect(results[0].input?.idCode).toBe("65010100")
    expect(results[0].input?.firstNameTh).toBe("ประพาฬพงษ์")
    expect(results[0].input?.studyGroup).toBe("1")
  })

  it("flags bad rows per-row without affecting the valid ones", () => {
    const results = validateRosterRows([
      goodRow,
      { idCode: "", firstNameTh: "", lastNameTh: "x", email: "nope" }, // missing + bad email
      { idCode: "65010200", firstNameTh: "ดี", lastNameTh: "มาก" },
    ])

    expect(results[0].valid).toBe(true)
    expect(results[1].valid).toBe(false)
    expect(results[1].errors.idCode).toBeDefined()
    expect(results[1].errors.firstNameTh).toBeDefined()
    expect(results[1].errors.email).toBeDefined()
    expect(results[2].valid).toBe(true)
  })

  it("flags a within-sheet duplicate id_code (first occurrence wins)", () => {
    const results = validateRosterRows([
      goodRow,
      { ...goodRow, firstNameTh: "อีกคน", lastNameTh: "ซ้ำรหัส" }, // same idCode
    ])

    expect(results[0].valid).toBe(true)
    expect(results[1].valid).toBe(false)
    expect(results[1].errors.idCode).toBeTruthy()
  })
})
