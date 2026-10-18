import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { openFile, putFile, setTestAttachmentStore, sweepFiles } from "./store"

// Attachment bytes on disk, named by their SHA-256 (ADR 0013).
describe("attachment store", () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "attachments-"))
    setTestAttachmentStore(dir)
  })
  afterEach(async () => {
    setTestAttachmentStore(null)
    await rm(dir, { recursive: true, force: true })
  })

  const bytes = (s: string) => new TextEncoder().encode(s)
  const read = async (stream: ReadableStream<Uint8Array>) => new TextDecoder().decode(await new Response(stream).arrayBuffer())
  const storedFiles = async () =>
    (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name)

  it("stores bytes under their SHA-256 and reads them back", async () => {
    const stored = await putFile(bytes("hello"))
    expect(stored).toEqual({ sha256: createHash("sha256").update("hello").digest("hex"), size: 5 })
    expect(await read((await openFile(stored.sha256))!)).toBe("hello")
  })

  it("identical bytes are stored once", async () => {
    const a = await putFile(bytes("same"))
    const b = await putFile(bytes("same"))
    expect(b.sha256).toBe(a.sha256)
    expect(await storedFiles()).toEqual([a.sha256])
  })

  it("an unknown or malformed hash opens as null, never escaping the store", async () => {
    expect(await openFile("0".repeat(64))).toBeNull()
    expect(await openFile("../../etc/passwd")).toBeNull()
  })

  describe("sweepFiles", () => {
    const HOUR = 60 * 60 * 1000
    const age = async (sha256: string, ms: number) => {
      const t = new Date(Date.now() - ms)
      await utimes(path.join(dir, sha256.slice(0, 2), sha256), t, t)
    }
    const olderThan = () => new Date(Date.now() - HOUR)

    it("removes an unreferenced file older than the grace period, keeps a referenced one", async () => {
      const kept = await putFile(bytes("kept"))
      const lost = await putFile(bytes("lost"))
      await age(kept.sha256, 2 * HOUR)
      await age(lost.sha256, 2 * HOUR)
      expect(await sweepFiles(new Set([kept.sha256]), olderThan())).toBe(1)
      expect(await storedFiles()).toEqual([kept.sha256])
      expect(await openFile(lost.sha256)).toBeNull()
    })

    it("never touches an unreferenced file younger than the grace period — an upload not yet recorded", async () => {
      const fresh = await putFile(bytes("fresh"))
      await age(fresh.sha256, HOUR / 2)
      expect(await sweepFiles(new Set(), olderThan())).toBe(0)
      expect(await storedFiles()).toEqual([fresh.sha256])
    })

    it("clears old leftovers in the temporary folder, keeps a write in progress", async () => {
      await mkdir(path.join(dir, ".tmp"), { recursive: true })
      const stale = path.join(dir, ".tmp", "stale")
      await writeFile(stale, "x")
      await utimes(stale, new Date(Date.now() - 2 * HOUR), new Date(Date.now() - 2 * HOUR))
      await writeFile(path.join(dir, ".tmp", "writing"), "x")
      await sweepFiles(new Set(), olderThan())
      expect(await storedFiles()).toEqual(["writing"])
    })

    it("re-uploading old unreferenced bytes renews them, so a sweep alongside the upload keeps them", async () => {
      const again = await putFile(bytes("again"))
      await age(again.sha256, 2 * HOUR)
      await putFile(bytes("again"))
      expect(await sweepFiles(new Set(), olderThan())).toBe(0)
      expect(await storedFiles()).toEqual([again.sha256])
    })

    it("an empty or missing store sweeps nothing", async () => {
      expect(await sweepFiles(new Set(), olderThan())).toBe(0)
      setTestAttachmentStore(path.join(dir, "nowhere"))
      expect(await sweepFiles(new Set(), olderThan())).toBe(0)
    })
  })
})
