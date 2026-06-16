import { describe, it, expect } from "vitest"
import { validateEnrollInput } from "./validation"

const valid = {
  idCode: "65010100",
  firstNameTh: "ประพาฬพงษ์",
  lastNameTh: "ธรรมาวาดานันท์",
}

describe("validateEnrollInput", () => {
  it("requires student id, first name, and last name", () => {
    const { valid: ok, errors } = validateEnrollInput({
      idCode: "",
      firstNameTh: "",
      lastNameTh: "",
    })
    expect(ok).toBe(false)
    expect(errors.idCode).toBeTruthy()
    expect(errors.firstNameTh).toBeTruthy()
    expect(errors.lastNameTh).toBeTruthy()
  })

  it("accepts minimal input with no email (email is optional)", () => {
    expect(validateEnrollInput(valid).valid).toBe(true)
  })

  it("rejects a malformed email when one is provided", () => {
    const { valid: ok, errors } = validateEnrollInput({ ...valid, email: "not-an-email" })
    expect(ok).toBe(false)
    expect(errors.email).toBeTruthy()
  })

  it("accepts a blank email as absent", () => {
    expect(validateEnrollInput({ ...valid, email: "   " }).valid).toBe(true)
  })

  it("accepts a well-formed email", () => {
    expect(validateEnrollInput({ ...valid, email: "stu@kmitl.ac.th" }).valid).toBe(true)
  })
})
