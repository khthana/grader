import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { getLanguageConfig } from "./languages"

// The docker-compose `piston-init` service installs language packages into the
// Piston engine. Those versions are duplicated from the language registry
// (compose can't import TS at runtime), so this guards the two against drift —
// an install/execute version mismatch would silently break grading (#65).
const compose = readFileSync(
  fileURLToPath(new URL("../../docker-compose.yml", import.meta.url)),
  "utf8"
)

describe("piston-init installs languages at the registry versions", () => {
  it("installs Python at the registry version", () => {
    expect(compose).toContain("python")
    expect(compose).toContain(getLanguageConfig("python").version)
  })

  it("installs the C runtime via the gcc package at the registry version", () => {
    // The installable package is `gcc` (NOT `c`) — verified vs the real engine
    // in #61 — while the execute runtime is `c`.
    expect(compose).toContain("gcc")
    expect(compose).toContain(getLanguageConfig("c").version)
  })
})
