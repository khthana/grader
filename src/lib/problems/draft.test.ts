// #83 — the Problem Draft module: one place turns an untrusted authoring body
// (+ the stored Problem on edit) into the exact Problem that gets validated and
// written, so validation and persistence can't disagree.
import { describe, it, expect } from "vitest"
import { buildProblemDraft } from "./draft"
import type { ProblemDetail } from "./repository"

const IO_CASES = [
  { input: "1", expectedOutput: "1", isHidden: false, score: 15, sortOrder: 0 },
  { input: "2", expectedOutput: "2", isHidden: true, sortOrder: 1 },
]

function stored(over: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    id: 7,
    courseCode: "C01",
    courseYear: 2567,
    courseSemester: 1,
    weekId: 3,
    problemNo: 1,
    title: "Stored",
    description: "desc",
    inputSpec: "in",
    outputSpec: "out",
    score: 25,
    dueAt: "2026-10-01T00:00:00.000Z",
    closeAt: "2026-10-02T00:00:00.000Z",
    language: "python",
    problemType: "io",
    functionName: "",
    starterCode: "",
    unitTestCode: "",
    blacklist: [],
    whitelist: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    testCases: [
      { id: 1, problemId: 7, input: "a", expectedOutput: "A", isHidden: false, score: 10, sortOrder: 0 },
    ],
    ...over,
  }
}

const storedUnit = () =>
  stored({ problemType: "unit", unitTestCode: "assert add(1, 2) == 3", testCases: [] })

describe("buildProblemDraft — create (#83)", () => {
  it("defaults to io, trims text, derives the max score, and takes the course language", () => {
    const r = buildProblemDraft(
      { title: "  Sum ", weekId: 3, description: " d ", language: "c", testCases: IO_CASES },
      { language: "python" }
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.draft.problemType).toBe("io")
    expect(r.draft.title).toBe("Sum")
    expect(r.draft.description).toBe("d")
    expect(r.draft.language).toBe("python")
    expect(r.draft.score).toBe(25) // 15 + default 10
    expect(r.draft.testCases).toEqual(IO_CASES)
  })

  it("returns the validation errors", () => {
    const r = buildProblemDraft({ title: " ", testCases: [] }, { language: "python" })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(Object.keys(r.errors).sort()).toEqual(["testCases", "title", "weekId"])
  })

  it("unit mode keeps problem.score as the max and stores no Test Cases", () => {
    const r = buildProblemDraft(
      { title: "U", weekId: 3, problemType: "unit", score: 40, unitTestCode: "assert f()", testCases: IO_CASES },
      { language: "python" }
    )
    expect(r.ok && r.draft).toMatchObject({ problemType: "unit", score: 40, testCases: [] })
  })

  it("a wrong-typed field is a validation error, not a crash", () => {
    const r = buildProblemDraft(
      { title: 5, weekId: "3", blacklist: "x", dueAt: 1, testCases: [null] },
      { language: "python" }
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(Object.keys(r.errors).sort()).toEqual(["blacklist", "dueAt", "testCases", "title", "weekId"])
  })

  it("rejects unit mode in a non-Python course", () => {
    const r = buildProblemDraft(
      { title: "U", weekId: 3, problemType: "unit", unitTestCode: "assert f()" },
      { language: "c" }
    )
    expect(!r.ok && r.errors.problemType).toBeTruthy()
  })
})

describe("buildProblemDraft — edit merges over the stored Problem (#83)", () => {
  it("omitting problemType on a unit Problem is validated AND written as unit", () => {
    // The bug: validation read the body (absent = io → needs Test Cases) while
    // the write kept the stored unit type.
    const r = buildProblemDraft({ title: "Edited" }, { language: "python", existing: storedUnit() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.draft.problemType).toBe("unit")
    expect(r.draft.unitTestCode).toBe("assert add(1, 2) == 3")
    expect(r.draft.testCases).toEqual([])
  })

  it("a unit Problem never gets Test Cases attached, even when the body sends some", () => {
    const r = buildProblemDraft({ testCases: IO_CASES }, { language: "python", existing: storedUnit() })
    expect(r.ok && r.draft.testCases).toEqual([])
  })

  it("omitted testCases keep the stored ones (and the max score follows them)", () => {
    const r = buildProblemDraft({ title: "Edited" }, { language: "python", existing: stored() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.draft.testCases).toEqual([
      { input: "a", expectedOutput: "A", isHidden: false, score: 10, sortOrder: 0 },
    ])
    expect(r.draft.score).toBe(10)
  })

  it("omitted fields keep their stored value; an explicit null clears a deadline", () => {
    const r = buildProblemDraft({ closeAt: null }, { language: "python", existing: stored() })
    expect(r.ok && r.draft).toMatchObject({
      title: "Stored",
      description: "desc",
      weekId: 3,
      dueAt: "2026-10-01T00:00:00.000Z",
      closeAt: null,
    })
  })

  it("null on a non-deadline field keeps the stored value", () => {
    const r = buildProblemDraft(
      { title: null, problemType: null, blacklist: null, testCases: null },
      { language: "python", existing: stored({ blacklist: ["eval"] }) }
    )
    expect(r.ok && r.draft).toMatchObject({
      title: "Stored",
      problemType: "io",
      blacklist: ["eval"],
      testCases: [{ input: "a" }],
    })
  })

  it("a Problem keeps its Week on edit", () => {
    const r = buildProblemDraft({ weekId: 9 }, { language: "python", existing: stored() })
    expect(r.ok && r.draft.weekId).toBe(3)
  })

  it("an explicit type switch is validated as the new type", () => {
    const toUnit = buildProblemDraft({ problemType: "unit" }, { language: "python", existing: stored() })
    expect(!toUnit.ok && toUnit.errors.unitTestCode).toBeTruthy()
    const toIo = buildProblemDraft({ problemType: "io" }, { language: "python", existing: storedUnit() })
    expect(!toIo.ok && toIo.errors.testCases).toBeTruthy()
  })

  it("leaves the reference solution untouched unless the body sends one", () => {
    const keep = buildProblemDraft({}, { language: "python", existing: stored() })
    expect(keep.ok && keep.draft.referenceSolution).toBeUndefined()
    const set = buildProblemDraft({ referenceSolution: "print(1)" }, { language: "python", existing: stored() })
    expect(set.ok && set.draft.referenceSolution).toBe("print(1)")
  })

  it("re-syncs the language to the course's", () => {
    const r = buildProblemDraft({ language: "c" }, { language: "python", existing: stored({ language: "c" }) })
    expect(r.ok && r.draft.language).toBe("python")
  })
})
