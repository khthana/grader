import { describe, it, expect } from "vitest"
import { validateImportRows, type RawImportRow } from "./import"

const goodRow: RawImportRow = {
  firstNameTh: "สมชาย",
  lastNameTh: "ใจดี",
  email: "somchai@kmitl.ac.th",
  idCode: "64010001",
  roles: "Instructor, TA",
}

describe("validateImportRows", () => {
  it("marks well-formed rows valid and normalizes the roles cell into an array", () => {
    const results = validateImportRows([goodRow])
    expect(results).toHaveLength(1)
    expect(results[0].row).toBe(1)
    expect(results[0].valid).toBe(true)
    expect(results[0].errors).toEqual({})
    expect(results[0].input?.roles).toEqual(["Instructor", "TA"])
    expect(results[0].input?.email).toBe("somchai@kmitl.ac.th")
  })

  it("flags bad rows per-row without affecting the valid ones", () => {
    const results = validateImportRows([
      goodRow,
      { firstNameTh: "", lastNameTh: "x", email: "nope", idCode: "" }, // missing + bad email
      { firstNameTh: "ดี", lastNameTh: "มาก", email: "ok@kmitl.ac.th", idCode: "64010099" },
    ])

    expect(results[0].valid).toBe(true)
    expect(results[1].valid).toBe(false)
    expect(results[1].errors.firstNameTh).toBeDefined()
    expect(results[1].errors.email).toBeDefined()
    expect(results[1].errors.idCode).toBeDefined()
    expect(results[2].valid).toBe(true)
  })

  it("flags an unknown role in the roles cell", () => {
    const results = validateImportRows([{ ...goodRow, roles: "Instructor, Wizard" }])
    expect(results[0].valid).toBe(false)
    expect(results[0].errors.roles).toBeDefined()
  })

  it("flags within-sheet duplicate emails (first wins)", () => {
    const results = validateImportRows([
      { ...goodRow, email: "dup@kmitl.ac.th" },
      { firstNameTh: "ซ้ำ", lastNameTh: "อีก", email: "DUP@kmitl.ac.th", idCode: "64010100" },
    ])
    expect(results[0].valid).toBe(true)
    expect(results[1].valid).toBe(false)
    expect(results[1].errors.email).toBeDefined()
  })
})
