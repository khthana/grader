import { describe, it, expect } from "vitest"
import { deriveScorebookStatus } from "./status"

const NOW = new Date("2026-06-17T00:00:00Z")
const PAST = "2026-06-10T00:00:00Z"
const FUTURE = "2026-06-24T00:00:00Z"

describe("deriveScorebookStatus", () => {
  it("is none-due when the course has no problems", () => {
    expect(
      deriveScorebookStatus({ problems: [], scores: {}, lateByProblem: {}, now: NOW })
    ).toBe("none-due")
  })

  it("is complete when every due problem has an on-time submission", () => {
    expect(
      deriveScorebookStatus({
        problems: [{ id: 1, dueAt: PAST }],
        scores: { 1: 8 },
        lateByProblem: { 1: false },
        now: NOW,
      })
    ).toBe("complete")
  })

  it("is none-due when every problem's due date is still in the future", () => {
    expect(
      deriveScorebookStatus({
        problems: [{ id: 1, dueAt: FUTURE }],
        scores: { 1: null },
        lateByProblem: {},
        now: NOW,
      })
    ).toBe("none-due")
  })

  it("is missing when a past-due problem has no submission, even if another is complete", () => {
    expect(
      deriveScorebookStatus({
        problems: [
          { id: 1, dueAt: PAST },
          { id: 2, dueAt: PAST },
        ],
        scores: { 1: 10, 2: null },
        lateByProblem: { 1: false },
        now: NOW,
      })
    ).toBe("missing")
  })

  it("is late when a submission is late and nothing is missing", () => {
    expect(
      deriveScorebookStatus({
        problems: [{ id: 1, dueAt: PAST }],
        scores: { 1: 5 },
        lateByProblem: { 1: true },
        now: NOW,
      })
    ).toBe("late")
  })

  it("never counts a problem with no due date as missing", () => {
    expect(
      deriveScorebookStatus({
        problems: [{ id: 1, dueAt: null }],
        scores: { 1: null },
        lateByProblem: {},
        now: NOW,
      })
    ).toBe("none-due")
  })

  it("ranks missing above late when both apply", () => {
    expect(
      deriveScorebookStatus({
        problems: [
          { id: 1, dueAt: PAST },
          { id: 2, dueAt: PAST },
        ],
        scores: { 1: 5, 2: null },
        lateByProblem: { 1: true },
        now: NOW,
      })
    ).toBe("missing")
  })
})
