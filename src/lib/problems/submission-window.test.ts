import { describe, it, expect } from "vitest"
import { submissionWindow } from "./submission-window"

// #87 — the ADR 0002 two-tier deadline, with `now` injected.
const DUE = "2026-09-29T10:00:00.000Z"
const CLOSE = "2026-09-29T12:00:00.000Z"
const at = (iso: string) => new Date(iso)

describe("submissionWindow", () => {
  it.each([
    ["before due_at", "2026-09-29T09:59:59.999Z", "open"],
    ["exactly at due_at (not yet past)", DUE, "open"],
    ["just past due_at", "2026-09-29T10:00:00.001Z", "late"],
    ["exactly at close_at (not yet past)", CLOSE, "late"],
    ["just past close_at", "2026-09-29T12:00:00.001Z", "closed"],
  ] as const)("both deadlines, %s → %s", (_label, now, expected) => {
    expect(submissionWindow({ dueAt: DUE, closeAt: CLOSE }, at(now))).toBe(expected)
  })

  it.each([
    ["no deadlines", { dueAt: null, closeAt: null }, "2099-01-01T00:00:00Z", "open"],
    ["only due_at, past it", { dueAt: DUE, closeAt: null }, "2099-01-01T00:00:00Z", "late"],
    ["only due_at, before it", { dueAt: DUE, closeAt: null }, "2026-01-01T00:00:00Z", "open"],
    ["only close_at, past it", { dueAt: null, closeAt: CLOSE }, "2099-01-01T00:00:00Z", "closed"],
    ["only close_at, before it", { dueAt: null, closeAt: CLOSE }, "2026-01-01T00:00:00Z", "open"],
  ] as const)("%s → %s", (_label, deadlines, now, expected) => {
    expect(submissionWindow(deadlines, at(now))).toBe(expected)
  })

  it("close_at is checked first — past both is closed, not late", () => {
    expect(submissionWindow({ dueAt: DUE, closeAt: CLOSE }, at("2099-01-01T00:00:00Z"))).toBe("closed")
  })
})
