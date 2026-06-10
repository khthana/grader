import { describe, it, expect } from "vitest"
import { validateUserInput, type UserInput } from "./validation"

const validInput: UserInput = {
  firstNameTh: "สมชาย",
  lastNameTh: "ใจดี",
  email: "somchai@kmitl.ac.th",
  idCode: "64010001",
}

describe("validateUserInput", () => {
  it("accepts input with all required fields present", () => {
    const result = validateUserInput(validInput)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it("flags each missing required field", () => {
    const result = validateUserInput({
      firstNameTh: "  ",
      lastNameTh: "",
      email: "",
      idCode: "",
    })
    expect(result.valid).toBe(false)
    expect(result.errors.firstNameTh).toBeDefined()
    expect(result.errors.lastNameTh).toBeDefined()
    expect(result.errors.email).toBeDefined()
    expect(result.errors.idCode).toBeDefined()
  })

  it("rejects a malformed email", () => {
    const result = validateUserInput({ ...validInput, email: "not-an-email" })
    expect(result.errors.email).toBeDefined()
  })

  it("treats password as optional but rejects a weak one when present", () => {
    expect(validateUserInput({ ...validInput }).errors.password).toBeUndefined()
    expect(validateUserInput({ ...validInput, password: "" }).errors.password).toBeUndefined()
    // too short
    expect(validateUserInput({ ...validInput, password: "ab1" }).errors.password).toBeDefined()
    // no digit
    expect(validateUserInput({ ...validInput, password: "abcdefgh" }).errors.password).toBeDefined()
    // no letter
    expect(validateUserInput({ ...validInput, password: "12345678" }).errors.password).toBeDefined()
    // ok
    expect(validateUserInput({ ...validInput, password: "Password123" }).errors.password).toBeUndefined()
  })

  it("rejects unknown roles when roles are provided", () => {
    expect(validateUserInput({ ...validInput, roles: ["Admin", "Student"] }).errors.roles).toBeUndefined()
    expect(validateUserInput({ ...validInput, roles: ["Wizard"] }).errors.roles).toBeDefined()
  })
})
