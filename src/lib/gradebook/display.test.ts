import { describe, it, expect } from "vitest"
import { scoreTier, paginate } from "./display"

describe("scoreTier", () => {
  it("is empty when the score is null (not submitted)", () => {
    expect(scoreTier(null, 10)).toBe("empty")
  })

  it("is mid at exactly 50% of the max", () => {
    expect(scoreTier(5, 10)).toBe("mid")
  })

  it("is hi at the 80% threshold and at full marks", () => {
    expect(scoreTier(8, 10)).toBe("hi")
    expect(scoreTier(10, 10)).toBe("hi")
  })

  it("is lo below 50% of the max", () => {
    expect(scoreTier(4, 10)).toBe("lo")
    expect(scoreTier(0, 10)).toBe("lo")
  })
})

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1)

  it("returns the first page of 20 and reports the page count", () => {
    const result = paginate(items, 1, 20)
    expect(result.pageItems).toHaveLength(20)
    expect(result.pageItems[0]).toBe(1)
    expect(result.pageCount).toBe(2)
    expect(result.page).toBe(1)
  })

  it("returns the remainder on the last page", () => {
    const result = paginate(items, 2, 20)
    expect(result.pageItems).toHaveLength(5)
    expect(result.pageItems[0]).toBe(21)
  })

  it("clamps an out-of-range page to the last page", () => {
    const result = paginate(items, 99, 20)
    expect(result.page).toBe(2)
    expect(result.pageItems[0]).toBe(21)
  })

  it("reports a single empty page for an empty list", () => {
    const result = paginate([], 1, 20)
    expect(result.pageItems).toEqual([])
    expect(result.pageCount).toBe(1)
    expect(result.page).toBe(1)
  })
})
