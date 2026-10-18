// Attachment store (#114, ADR 0013) — the only code that touches the
// attachments directory. Bytes are written once, named by their SHA-256, under
// `<first two hex>/<hash>`; Postgres holds everything else. Moving to an
// object store means changing this module alone.

import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

// Test seam, like setTestDb: each test gets its own temporary directory.
let testDir: string | null = null
export function setTestAttachmentStore(dir: string | null): void {
  testDir = dir
}

function storeRoot(): string {
  return testDir ?? process.env.ATTACHMENTS_DIR ?? path.join(process.cwd(), "local", "attachments")
}

const SHA256 = /^[0-9a-f]{64}$/
const filePath = (sha256: string) => path.join(storeRoot(), sha256.slice(0, 2), sha256)

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false
  )

/**
 * Store these bytes and return their hash. Written to a temporary file first
 * and renamed into place, so a reader never sees half a file; bytes already
 * stored are not written again.
 */
export async function putFile(bytes: Uint8Array): Promise<{ sha256: string; size: number }> {
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const target = filePath(sha256)
  if (!(await exists(target))) {
    const tmpDir = path.join(storeRoot(), ".tmp")
    await mkdir(tmpDir, { recursive: true })
    await mkdir(path.dirname(target), { recursive: true })
    const tmp = path.join(tmpDir, randomUUID())
    try {
      await writeFile(tmp, bytes)
      await rename(tmp, target)
    } finally {
      await rm(tmp, { force: true })
    }
  }
  return { sha256, size: bytes.byteLength }
}

/** The stored bytes as a stream, or null when there are none (the caller answers 404). */
export async function openFile(sha256: string): Promise<ReadableStream<Uint8Array> | null> {
  if (!SHA256.test(sha256)) return null
  const file = filePath(sha256)
  if (!(await exists(file))) return null
  return Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>
}
