import { describe, it, expect } from "vitest"
import { deriveAssignmentStatus } from "./status"

const NOW = new Date("2026-06-19T12:00:00Z")
const PAST = "2026-06-10T00:00:00Z"
const FUTURE = "2026-06-30T00:00:00Z"
const EXACTLY_NOW = NOW.toISOString()

describe("deriveAssignmentStatus", () => {
  it("is not-submitted when there is no submission and closeAt is null", () => {
    expect(
      deriveAssignmentStatus({ dueAt: null, closeAt: null, submission: null }, NOW)
    ).toBe("not-submitted")
  })

  it("is not-submitted when there is no submission and closeAt is in the future", () => {
    expect(
      deriveAssignmentStatus({ dueAt: null, closeAt: FUTURE, submission: null }, NOW)
    ).toBe("not-submitted")
  })

  // Past only strictly after close_at — the grade route still accepts at that
  // instant, so the badge must not say closed yet (#87).
  it("is not-submitted when closeAt is exactly now (boundary)", () => {
    expect(
      deriveAssignmentStatus({ dueAt: null, closeAt: EXACTLY_NOW, submission: null }, NOW)
    ).toBe("not-submitted")
  })

  it("is closed when there is no submission and closeAt is in the past", () => {
    expect(
      deriveAssignmentStatus({ dueAt: null, closeAt: PAST, submission: null }, NOW)
    ).toBe("closed")
  })

  it("is pending when submission exists but reviewedAt is null", () => {
    expect(
      deriveAssignmentStatus(
        { dueAt: null, closeAt: PAST, submission: { reviewedAt: null } },
        NOW
      )
    ).toBe("pending")
  })

  it("is reviewed when submission has a non-null reviewedAt", () => {
    expect(
      deriveAssignmentStatus(
        { dueAt: null, closeAt: PAST, submission: { reviewedAt: "2026-06-11T10:00:00Z" } },
        NOW
      )
    ).toBe("reviewed")
  })
})
