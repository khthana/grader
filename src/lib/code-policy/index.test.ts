import { describe, it, expect } from "vitest"
import { checkCodePolicy } from "./index"

describe("checkCodePolicy", () => {
  it("blacklisted term in code → ok=false, violations lists the term", () => {
    const result = checkCodePolicy("x = sorted(lst)", ["sorted"], [])
    expect(result.ok).toBe(false)
    expect(result.violations).toContain("sorted")
  })

  it("code clean of blacklist → ok=true, no violations", () => {
    const result = checkCodePolicy("def bubble_sort(lst): pass", ["sorted"], [])
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it("term inside longer identifier → no match", () => {
    const result = checkCodePolicy("def quicksort(lst): pass", ["sort"], [])
    expect(result.ok).toBe(true)
  })

  it("term at word boundary → matches", () => {
    const result = checkCodePolicy("lst.sort()", ["sort"], [])
    expect(result.ok).toBe(false)
    expect(result.violations).toContain("sort")
  })

  it("missing whitelist term → ok=false, violations lists the term", () => {
    const result = checkCodePolicy("x = x + 1", [], ["def"])
    expect(result.ok).toBe(false)
    expect(result.violations).toContain("def")
  })

  it("whitelist term present → ok=true", () => {
    const result = checkCodePolicy("def add(a, b): return a + b", [], ["def"])
    expect(result.ok).toBe(true)
  })

  it("both blacklist and whitelist violated → all violations listed", () => {
    const result = checkCodePolicy("x = sorted(lst)", ["sorted"], ["def"])
    expect(result.ok).toBe(false)
    expect(result.violations).toContain("sorted")
    expect(result.violations).toContain("def")
  })

  it("empty lists → always ok", () => {
    const result = checkCodePolicy("import os; os.system('rm -rf /')", [], [])
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })
  describe("terms edged by symbols (#67)", () => {
    it("blacklist `sum(` flags a call to sum", () => {
      expect(checkCodePolicy("x = sum( a )", ["sum("], []).violations).toEqual(["sum("])
    })

    it("blacklist `sum(` ignores other identifiers ending in sum", () => {
      expect(checkCodePolicy("summary(a); mysum(a)", ["sum("], []).ok).toBe(true)
    })

    it("blacklist `.sort` flags a method call", () => {
      expect(checkCodePolicy("(a + b).sort()", [".sort"], []).violations).toEqual([".sort"])
    })

    it("blacklist `.sort` ignores a longer method name", () => {
      expect(checkCodePolicy("a.sorted_items()", [".sort"], []).ok).toBe(true)
    })

    it("a purely symbolic term like `**` matches anywhere", () => {
      expect(checkCodePolicy("y = x ** 2", ["**"], []).ok).toBe(false)
    })

    it("whitelist `+=` is satisfied when present", () => {
      expect(checkCodePolicy("total += n", [], ["+="]).ok).toBe(true)
    })
  })
})
