import { describe, it, expect } from "vitest"
import { buildMaterialDraft, buildMoveDraft, buildPublishDraft } from "./draft"

describe("buildMaterialDraft", () => {
  it("takes the body, trimmed at its ends", () => {
    expect(buildMaterialDraft({ body: "\n  # สไลด์\n\n- ข้อ 1  \n" })).toEqual({ ok: true, draft: { body: "# สไลด์\n\n- ข้อ 1" } })
  })

  it("accepts an empty body", () => {
    expect(buildMaterialDraft({ body: "" })).toEqual({ ok: true, draft: { body: "" } })
  })

  it.each([[{ body: 3 }], [{ body: null }], [{}], [{ body: ["x"] }]])("a wrong-typed body %j is a field error", (body) => {
    const result = buildMaterialDraft(body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["body"])
  })

  it.each([[null], ["text"], [[1, 2]], [42]])("a non-object %j is an error, not a throw", (body) => {
    const result = buildMaterialDraft(body)
    expect(result.ok).toBe(false)
  })
})

describe("buildPublishDraft", () => {
  it.each([
    [{ published: true }, true],
    [{ published: false }, false],
  ])("%j → %s", (body, published) => {
    expect(buildPublishDraft(body)).toEqual({ ok: true, published })
  })

  it.each([[{ published: "yes" }], [{ published: 1 }], [{}], [null], ["true"], [[true]]])("%j is a field error", (body) => {
    const result = buildPublishDraft(body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["published"])
  })
})

describe("buildMoveDraft", () => {
  it("takes a Teaching Plan week number", () => {
    expect(buildMoveDraft({ weekNo: 5 })).toEqual({ ok: true, weekNo: 5 })
    expect(buildMoveDraft({ weekNo: 20 })).toEqual({ ok: true, weekNo: 20 })
  })

  it.each([[{ weekNo: 0 }], [{ weekNo: 21 }], [{ weekNo: 1.5 }], [{ weekNo: "5" }], [{}], [null], [[5]], ["5"]])(
    "%j is an error on weekNo",
    (input) => {
      const result = buildMoveDraft(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(Object.keys(result.errors)).toEqual(["weekNo"])
    }
  )
})
