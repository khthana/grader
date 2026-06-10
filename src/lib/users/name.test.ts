import { describe, it, expect } from "vitest"
import { resolveNameFields } from "./name"

describe("resolveNameFields", () => {
  it("uses the structured Thai name when present", () => {
    expect(resolveNameFields({ firstNameTh: "สมชาย", lastNameTh: "ใจดี", name: "ignored" })).toEqual({
      firstNameTh: "สมชาย",
      lastNameTh: "ใจดี",
    })
  })

  it("falls back to splitting the display name when structured fields are missing", () => {
    expect(resolveNameFields({ firstNameTh: null, lastNameTh: null, name: "นักศึกษา คนที่ 3" })).toEqual({
      firstNameTh: "นักศึกษา",
      lastNameTh: "คนที่ 3",
    })
  })

  it("puts a single-word display name in the first-name field", () => {
    expect(resolveNameFields({ name: "Admin" })).toEqual({ firstNameTh: "Admin", lastNameTh: "" })
  })

  it("returns empty fields when nothing is available", () => {
    expect(resolveNameFields({})).toEqual({ firstNameTh: "", lastNameTh: "" })
  })
})
