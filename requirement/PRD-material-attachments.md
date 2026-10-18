# PRD — ไฟล์แนบของเอกสารการสอน (Teaching Material Attachments)

> CE-Grader: Teaching Materials Phase 2 ทำให้อัปโหลดไฟล์เข้าเอกสารการสอนแต่ละชิ้นได้ เช่น สไลด์, PDF, ไฟล์ ZIP และรูปที่แสดงในเนื้อหา
> Domain glossary: `CONTEXT.md` (Attachment, Teaching Material, Published Teaching Material, Course Duplication)
> Design decisions: **ADR 0012** (Teaching Materials keyed by Teaching Plan week number), **ADR 0013** (Attachments stored on disk by content hash and referenced by name)
> Phase 1: `requirement/PRD-teaching-materials.md` (#108–#112, shipped)
>
> **แก้ไขภายหลัง (2026-10-18, #118/#119):** เนื้อหาเอกสารการสอนไม่แสดงรูปแล้ว `![..](...)` จะแสดงเป็นลิงก์ ไฟล์แนบทุกไฟล์รวมทั้งรูปเป็นการดาวน์โหลด และเอาปุ่ม "แทรกรูป" ออกแล้ว ส่วนที่อ้างถึงรูปในเนื้อหาหรือ "แทรกรูป" ข้างล่างนี้เป็นของเดิม ดู ADR 0013 Amendment

---

## Problem Statement

Phase 1 ให้เขียนเอกสารการสอนเป็น Markdown ได้แล้ว แต่สื่อที่ใช้สอนจริงส่วนใหญ่เป็นไฟล์:

- สไลด์เป็น `.pptx` หรือ `.pdf` ตอนนี้ต้องฝากไว้ที่ Google Drive แล้วแปะลิงก์ ลิงก์จึงเสียได้ถ้าเปลี่ยนสิทธิ์ แชร์ หรือย้ายไฟล์ และนักศึกษาต้องมีบัญชีที่เปิดได้
- ใบงานมักมาพร้อมไฟล์ตั้งต้น เช่น `starter.zip`, `data.csv`, `lab3.ipynb` ซึ่งยังไม่มีที่ให้แนบ
- เอกสารประกอบต้องมีแผนภาพหรือภาพหน้าจอ ตอนนี้ใส่ได้แค่รูปจาก URL ภายนอก จึงต้องไปหาที่ฝากรูปเอง
- ไฟล์ที่ฝากไว้ข้างนอกไม่อยู่ใต้สวิตช์ "เผยแพร่" ของ CE-Grader ใครมีลิงก์ก็เปิดได้ก่อนคาบ
- ทำซ้ำไปภาคใหม่แล้ว ไฟล์ข้างนอกไม่ได้ติดไปด้วย

## Solution

เอกสารการสอนแต่ละชิ้นมี **ไฟล์แนบ (Attachment)** ได้หลายไฟล์

- ผู้สอนอัปโหลดไฟล์ได้บนหน้าเอกสาร และไฟล์ขึ้นเป็นรายการใต้เนื้อหา นักศึกษากดดาวน์โหลดได้
- **รูปก็เป็นไฟล์แนบ** แทรกในเนื้อหาด้วยปุ่ม "แทรกรูป" ซึ่งอัปโหลดแล้วใส่ `![ชื่อ](attachment:ชื่อไฟล์)` ให้ การอ้างแบบนี้ใช้ชื่อไฟล์ จึงยังใช้ได้หลังย้ายสัปดาห์และหลังทำซ้ำไปภาคใหม่
- **นักศึกษาเห็นไฟล์แนบเมื่อเห็นเอกสารนั้น** คือเผยแพร่แล้วและอยู่ในแผนการสอน ไม่มีสวิตช์เผยแพร่ต่อไฟล์ ไฟล์ของเอกสารที่ยังไม่เผยแพร่ตอบ 404 แม้จะรู้ลิงก์
- อัปโหลดชื่อไฟล์ซ้ำเป็นการ **แทนที่** (ระบบถามยืนยันก่อน) แก้สไลด์แล้วอัปโหลดทับได้ รูปในเนื้อหาที่อ้างชื่อนั้นไม่เสีย
- ทำซ้ำไปภาคใหม่แล้วไฟล์แนบติดไปด้วยทุกไฟล์

## User Stories

### ผู้สอน: แนบ แทนที่ ลบ

1. ในฐานะผู้สอน ฉันอัปโหลดไฟล์ (PDF, สไลด์, ZIP, รูป, โค้ด) เข้าเอกสารชิ้นหนึ่งได้หลายไฟล์ และเห็นรายการไฟล์ใต้เนื้อหา พร้อมชื่อและขนาด
2. ในฐานะผู้สอน การอัปโหลดมีผลทันที ไม่ต้องกดบันทึกเนื้อหา
3. ในฐานะผู้สอน ถ้าอัปโหลดไฟล์ชื่อเดียวกับที่มีอยู่แล้ว ระบบถามว่าจะแทนที่ไหม ถ้ายืนยัน ไฟล์ใหม่แทนที่ไฟล์เดิม และรูปหรือลิงก์ในเนื้อหาที่อ้างชื่อนั้นยังใช้ได้
4. ในฐานะผู้สอน ฉันลบไฟล์แนบได้ โดยต้องยืนยันก่อน
5. ในฐานะผู้สอน ฉันกด "แทรกรูป" ในตัวแก้ไข เลือกไฟล์รูป แล้วรูปถูกอัปโหลดและแทรก `![ชื่อ](attachment:ชื่อไฟล์)` ที่ตำแหน่งเคอร์เซอร์ และเห็นรูปในแท็บ "ดูตัวอย่าง"
6. ในฐานะผู้สอน ถ้าเนื้อหาอ้าง `attachment:` ชื่อที่ไม่มีอยู่ ตัวแก้ไขเตือนว่าไม่มีไฟล์ชื่อนั้น
7. ในฐานะผู้สอน ถ้าไฟล์ใหญ่เกิน 50 MB, เป็นชนิดที่ไม่รับ หรือเอกสารมีไฟล์ครบ 20 ไฟล์แล้ว ระบบไม่รับและบอกเหตุผล
8. ในฐานะผู้สอน เอกสารที่ยังไม่เคยบันทึกยังแนบไฟล์ไม่ได้ ระบบแสดง "บันทึกเอกสารก่อนจึงแนบไฟล์ได้"
9. ในฐานะผู้สอน ฉันบันทึกและเผยแพร่เอกสารที่มีแต่ไฟล์แนบ ไม่มีเนื้อหา ได้
10. ในฐานะผู้สอน ย้ายเอกสารไปสัปดาห์อื่นแล้ว ไฟล์แนบและรูปในเนื้อหาติดไปด้วย
11. ในฐานะผู้สอน ลบเอกสารแล้วไฟล์แนบของชิ้นนั้นหายไปด้วย

### นักศึกษา / ผู้ช่วยสอน: ดาวน์โหลด

12. ในฐานะนักศึกษา ฉันดาวน์โหลดไฟล์แนบของเอกสารที่เผยแพร่แล้วได้ และเห็นรูปที่แทรกในเนื้อหา
13. ในฐานะนักศึกษา ไฟล์แนบของเอกสารที่ยังไม่เผยแพร่หรือไม่อยู่ในแผนการสอนตอบ 404 แบบเดียวกับไฟล์ที่ไม่มีอยู่จริง แม้จะรู้ลิงก์
14. ในฐานะผู้ช่วยสอน ฉันดาวน์โหลดไฟล์แนบได้ทุกไฟล์ แต่ไม่เห็นปุ่มอัปโหลด แทนที่ หรือลบ
15. ในฐานะผู้ใช้ทุก Role กด "พิมพ์" แล้วรายการไฟล์แนบพิมพ์ออกมาเป็นชื่อไฟล์ และรูปในเนื้อหาพิมพ์ออกมาด้วย
16. ในฐานะผู้ใช้ทุก Role ไฟล์ที่ไม่ใช่รูปถูกดาวน์โหลดเสมอ ไม่ถูกเปิดเป็นหน้าเว็บในโดเมนของ CE-Grader

### ทำซ้ำไปภาคใหม่

17. ในฐานะผู้สอน ทำซ้ำไปภาคใหม่แล้ว ไฟล์แนบทุกไฟล์ของทุกเอกสารติดไปด้วยด้วยชื่อเดิม และรูปในเนื้อหาของภาคใหม่แสดงได้ทันที
18. ในฐานะผู้สอน แทนที่หรือลบไฟล์แนบฝั่งภาคใหม่แล้วภาคเดิมไม่เปลี่ยน

### ผู้ดูแลระบบ

19. ในฐานะผู้ดูแลระบบ ไฟล์อยู่ใน Docker volume `grader-attachments` และมีคำสั่งสำรองข้อมูลที่ทำคู่กับ dump ของ DB
20. ในฐานะผู้ดูแลระบบ ไฟล์บนดิสก์ที่ไม่มีไฟล์แนบไหนชี้แล้วถูกกวาดทิ้งเอง (ไม่แตะไฟล์อายุต่ำกว่า 1 ชั่วโมง) และสั่งกวาดด้วยสคริปต์ได้

## Implementation Decisions

### Domain module (`src/lib/materials/attachments/`): one rule per module (ADR 0010 style)

- **`policy.ts` (pure):** the one place for what is accepted and how it is served.
  - `MAX_ATTACHMENT_BYTES = 50 MB`, `MAX_ATTACHMENTS_PER_MATERIAL = 20`
  - An allow-list of extensions, each with its content type and whether it is an image:
    - documents: `pdf pptx ppt docx doc xlsx xls csv txt md`
    - code: `py c cpp h ipynb`
    - images: `png jpg jpeg gif webp`
    - archive: `zip`
  - `svg` and executables are not on the list.
  - `checkUpload({ name, size }, existingCount)` returns `{ ok, name, contentType } | { ok: false, error }`. It normalises the name: strips any path, trims it, and rejects an empty name, `/`, `\` or a name over 200 characters. Then it checks the extension, the size and the count.
  - `downloadHeaders(attachment)`:
    - an image gets `Content-Disposition: inline`; everything else gets `attachment` with an RFC 5987 `filename*`, because Thai names occur
    - every response gets `X-Content-Type-Options: nosniff` and `Content-Type` from the allow-list, never the client's
- **`references.ts` (pure):** the one rule for `attachment:` references.
  - `attachmentUrlTransform(courseSlug, attachments)` builds the renderer's URL transform, which maps `attachment:<name>` to that Material's download URL. A name with no Attachment resolves to an empty string, which renders as a broken image or link. Any other URL falls through to `react-markdown`'s `defaultUrlTransform`, so other sanitising is unchanged.
  - `missingReferences(body, names)` lists the referenced names that have no Attachment, for the editor warning.
  - The name in a reference is URL-decoded, so `attachment:week%203.png` matches `week 3.png`.
- **`store.ts`:** the only code that touches `ATTACHMENTS_DIR`.
  - `putFile(bytes)` hashes the bytes, writes them to a temporary file, then renames it to `<sha[0..2]>/<sha>`. It is idempotent: when the hash already exists, nothing is written. It returns `{ sha256, size }`.
  - `openFile(sha256)` returns a readable stream, or null when the file is missing. A missing file is a 404 for the caller, never a 500.
  - `sweepFiles(db, { olderThan })` deletes every stored file that no `material_attachments` row points to and that is older than the grace period (1 hour).
  - Test seam: `setTestAttachmentStore(dir | null)`, like `setTestDb` / `setTestRunner`, so each test gets its own temporary directory.
  - Directory: `ATTACHMENTS_DIR`, defaulting to `local/attachments`. Compose sets `/data/attachments` on the named volume `grader-attachments`.
- **`repository.ts`:**
  - `listAttachments(db, materialId)`, in upload order
  - `getAttachmentForCourse(db, key, attachmentId)` is course-scoped (null unless the Attachment's Material belongs to `key`) and also returns the Material's address and published flag for the visibility check
  - `saveAttachment(db, materialId, { name, sha256, size, contentType }, actorId)` inserts, or replaces the row of the same name when `replace` is set. pg-mem has weak `ON CONFLICT`, so it checks first, then INSERTs or UPDATEs.
  - `deleteAttachment(db, key, attachmentId)`
  - `copyAttachments(db, sourceMaterialId, targetMaterialId)` copies rows with the same names and hashes, and no bytes. Duplication calls it.
- **Visibility:** reuse `student-view.ts#canSeeMaterial(viewer, material, planned)` on the Attachment's Material. There is no second rule.
- **Rendering:** `MarkdownContent` gets an optional `urlTransform` prop. Only Teaching Materials pass one, built from `resolveAttachmentUrl` and that Material's Attachments, so Problems and the Syllabus are unchanged. `MaterialPanel` passes the same resolver to the `MarkdownField` preview.

### Schema (`scripts/migrate-016-material-attachments.sql` + `schema.sql`)

- **`material_attachments`:**
  - `id SERIAL` PK
  - `material_id INTEGER NOT NULL` → `teaching_materials(id) ON DELETE CASCADE`. Deleting a Material or its Course removes its rows, and the sweep removes the bytes.
  - `name TEXT NOT NULL`, `content_type TEXT NOT NULL`, `size_bytes INTEGER NOT NULL`, `sha256 TEXT NOT NULL`
  - `uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `uploaded_by` → users `ON DELETE SET NULL`
  - `UNIQUE (material_id, name)`
  - an index on `sha256` for the sweep
- A Material that moves weeks keeps its `id`, so its Attachments need no update (ADR 0012).

### API (`courseRoute`)

```
GET    /api/courses/[code]/[year]/[semester]/materials/[week]/[kind]                    → { material, heading, attachments }  (attachments added, same visibility as today)
POST   /api/courses/[code]/[year]/[semester]/materials/[week]/[kind]/attachments        → { attachment, replaced }  (manage; multipart: file, replace?)
GET    /api/courses/[code]/[year]/[semester]/materials/attachments/[aid]                → the file  (anyone linked; student → 404 unless canSeeMaterial)
DELETE /api/courses/[code]/[year]/[semester]/materials/attachments/[aid]                (manage)
```

- POST: the Material must exist, or 404 ("บันทึกเอกสารก่อน" is handled in the UI). It returns:
  - 400 for a disallowed type or a bad name
  - 413 for a file over 50 MB
  - 409 `{ reason: "name-taken" }` for a name already present without `replace=true`, so the UI asks to confirm
  - 409 `{ reason: "limit" }` for a 21st file
- The download URL uses the Attachment id. It is course-scoped, and because the body refers by name and resolves at render time, the id never appears in stored text.
- For a Student, an Attachment that doesn't exist, belongs to another course, or whose Material isn't visible returns the **same 404 body** (#80 style). A missing file on disk is the same 404.
- A TA gets 403 on POST and DELETE.
- POST and DELETE call `sweepFiles` after their database write. DELETE sweeps the replaced or removed hash; it is a best-effort step, and an error there never fails the request.

### UI (`MaterialPanel`)

- **The ไฟล์แนบ section** goes under the content, in view mode and edit mode alike: each Attachment's name (a download link), its size, and a ลบ button for managers (via `ConfirmDialog`).
- **Managers** get an "แนบไฟล์" button (choose one or more files). A `name-taken` response asks "แทนที่ไฟล์ … ไหม" and retries with `replace=true`. Other errors are shown in a toast.
- **In edit mode,** a "แทรกรูป" toolbar action uploads an image and inserts `![name](attachment:name)` at the cursor. A warning lists `missingReferences`.
- **For a new Material** that hasn't been saved yet, the section reads "บันทึกเอกสารก่อนจึงแนบไฟล์ได้".
- **Print:** the list prints as file names. The buttons are already hidden by `.print-controls`, and images in the content print.
- The outline page doesn't show Attachments.

### Logging

- `material.update`, with details `attach 3/slides slides.pdf`, `replace 3/slides slides.pdf` and `remove 3/slides slides.pdf`. The target is the course slug (`LogInput.detail`, #111).

### Course Duplication

- `copyMaterials` also copies each Material's Attachments through `copyAttachments`, inside the duplication's transaction. The rows point to the same hashes, and no bytes are copied. Update ADR 0006, `CLAUDE.md` and the Course Duplication entry in `CONTEXT.md`.

### Operations

- `docker-compose.yml`: add a named volume `grader-attachments` mounted at `/data/attachments` in `app`, and `ATTACHMENTS_DIR=/data/attachments`. The `local/` folder is already gitignored and dockerignored, so `local/attachments` doesn't leak into git or an image.
- `scripts/sweep-attachments.ts` sweeps on demand.
- `CLAUDE.md` documents the backup pair: `pg_dump` plus a tar of the `grader-attachments` volume, taken together. It also lists the effects of restoring one without the other (ADR 0013).

## Testing Decisions

Test external behaviour. Use pg-mem with `courseFixture()`, plus a temporary attachments directory per test through `setTestAttachmentStore`. No network and no Docker.

- **Pure modules**, table-driven:
  - `policy.ts`:
    - every allowed extension passes, case-insensitively
    - `svg`, `exe`, `html` and a missing extension are rejected
    - 50 MB passes and 50 MB + 1 byte fails
    - the 21st file fails
    - path parts are stripped, and empty, slash or overlong names are rejected
    - `downloadHeaders`: inline for an image, attachment for the rest, `nosniff` always, and a Thai name encoded correctly
  - `references.ts`:
    - `attachment:x.png` resolves to its URL
    - a missing name gives an empty string
    - `https://…` and relative URLs pass through as `defaultUrlTransform` would
    - `javascript:` is still dropped
    - an encoded name matches
    - `missingReferences` finds only the missing ones
- **Store:** `putFile` of the same bytes twice writes once, and `openFile` of an unknown hash returns null. The sweep removes an unreferenced old file and keeps a referenced one and an unreferenced file younger than 1 hour.
- **Routes:**
  - upload, list in GET one, download, replace (409 then retry) and delete
  - limits: 400 for a type, 413 for size, 409 for count
  - a TA or a Student gets 403 on writes
  - a Student gets 200 for a published planned Material's file, and the same 404 for an unpublished, Unplanned, missing, other-course or file-missing-on-disk Attachment
  - the headers are right
  - deleting a Material removes its Attachments' rows, and the sweep then removes the bytes
  - the logs carry the right details
- **Duplication:**
  - Attachments are copied by name and hash, with no new bytes on disk
  - replacing one on the copy leaves the source unchanged
  - it runs on the duplication's transaction connection, using the same atomicity test pattern as `copyMaterials`

## Out of Scope (Phase 2)

- An object store (MinIO / S3). ADR 0013 keeps the move to one module.
- A publish switch per file, or scheduled release
- Video (`mp4` and similar) and streaming. The allow-list can grow later.
- Previewing a PDF or deck inside the page. Students download the file.
- Renaming an Attachment in place. Upload under the new name and delete the old one.
- Virus scanning, and per-course storage quotas
- Files on Problems, the Syllabus or Quizzes
- Showing Attachments on the outline page

## Further Notes

- These decisions came out of a `/grill-with-docs` session on 2026-10-18. The term **Attachment** was added to `CONTEXT.md` during the session, and the storage and reference decisions are ADR 0013.
- Defaults picked without a separate question:
  - managers write and TAs read
  - the log details listed above
  - the list sits under the content, in upload order
  - print shows names only
  - a body-less Material with Attachments can be published
- Ship in vertical slices:
  1. Schema, `policy.ts`, `store.ts` (+ seam), repository, POST upload / GET download / DELETE, the Attachment section on the document page (upload, replace, delete, download), the Student-visibility 404s, the Compose volume and logging
  2. `references.ts` + the `MarkdownContent` `urlTransform`, plus "แทรกรูป" and the missing-reference warning in the editor
  3. Course Duplication copying Attachments + the sweep script + the backup notes in CLAUDE.md and ADR 0006
