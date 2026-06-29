import { describe, it, expect } from "vitest"
import { validateCourseInput } from "./validation"

const valid = { code: "01076021", year: 2567, semester: 1, nameTh: "โครงสร้างข้อมูล", nameEn: "Data Structures" }

describe("validateCourseInput", () => {
  it("requires code, Thai name, and English name", () => {
    const { valid: ok, errors } = validateCourseInput({ code: "", year: 2567, semester: 1, nameTh: "", nameEn: "" })
    expect(ok).toBe(false)
    expect(errors.code).toBeTruthy()
    expect(errors.nameTh).toBeTruthy()
    expect(errors.nameEn).toBeTruthy()
  })

  it("accepts a well-formed course (program optional)", () => {
    expect(validateCourseInput(valid).valid).toBe(true)
    expect(validateCourseInput({ ...valid, program: "วิศวกรรมคอมพิวเตอร์" }).valid).toBe(true)
  })

  it("treats an absent language as valid (defaults to Python downstream)", () => {
    expect(validateCourseInput(valid).valid).toBe(true)
  })

  it("accepts a supported language and rejects an unsupported one", () => {
    expect(validateCourseInput({ ...valid, language: "c" }).valid).toBe(true)
    const { valid: ok, errors } = validateCourseInput({ ...valid, language: "rust" })
    expect(ok).toBe(false)
    expect(errors.language).toBeTruthy()
  })
})
