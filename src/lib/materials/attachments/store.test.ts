import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { openFile, putFile, setTestAttachmentStore } from "./store"

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
})
