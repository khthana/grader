import { describe, it, expect } from "vitest"
import { studentProblemView } from "./visibility"

describe("studentProblemView", () => {
  it("drops hidden test cases and the unit-test block, keeps everything else", () => {
    const view = studentProblemView({
      id: 1,
      title: "T",
      unitTestCode: "assert x",
      testCases: [
        { id: 1, isHidden: false, expectedOutput: "a" },
        { id: 2, isHidden: true, expectedOutput: "b" },
      ],
    })
    expect(view).toEqual({ id: 1, title: "T", testCases: [{ id: 1, isHidden: false, expectedOutput: "a" }] })
  })
})
