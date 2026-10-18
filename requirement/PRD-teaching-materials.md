# PRD — เอกสารการสอน (Teaching Materials)

> CE-Grader: หน้าเอกสารการสอนของแต่ละการเปิดสอน จัดตามสัปดาห์ของแผนการสอน (Teaching Plan) ใน Syllabus สัปดาห์ละ 3 ประเภท ได้แก่ สไลด์ · เอกสารประกอบ · ใบงานปฏิบัติการ
> Domain glossary: `CONTEXT.md` (Teaching Materials, Teaching Material, Material Kind, Published Teaching Material, Teaching Plan, Course Duplication)
> Design decision: **ADR 0012**, Teaching Materials keyed by Teaching Plan week number

---

## Problem Statement

ตอนนี้เอกสารประกอบการสอนกระจายอยู่นอก CE-Grader เช่น Google Drive, LINE กลุ่ม หรือ LMS อื่น ปัญหาที่เจอ:

- นักศึกษาต้องไปหาเองว่าสไลด์และใบงานของสัปดาห์ไหนอยู่ที่ใด
- หัวข้อของเอกสารต้องพิมพ์ซ้ำกับแผนการสอนใน Syllabus ซึ่งพิมพ์ไว้แล้ว และพอแก้ฝั่งหนึ่งอีกฝั่งก็ไม่ตรงกัน
- อาจารย์เตรียมใบงานไว้ล่วงหน้าแล้วยังไม่อยากให้นักศึกษาเห็นก่อนคาบ แต่ที่เก็บเดิมคุมเรื่องนี้ได้ไม่สะดวก
- เปิดสอนภาคใหม่ทีไร ต้องจัดเอกสารใหม่ทุกครั้ง

## Solution

เพิ่มเมนู **"เอกสารการสอน"** ให้ทุก Role ในรายวิชา อยู่ถัดจาก "ประมวลรายวิชา"

- ในหน้าจะเห็นทุกสัปดาห์ของ **Teaching Plan** เรียงตามลำดับ หัวข้อดึงจากแผนการสอนโดยตรง จึง**ไม่ต้องพิมพ์ซ้ำ**
- แต่ละสัปดาห์มีเอกสาร 3 ประเภท (**Material Kind**) ได้แก่ สไลด์ (Slides) · เอกสารประกอบ (Handout) · ใบงานปฏิบัติการ (Lab Sheet)
- เอกสารแต่ละชิ้นเขียนด้วย Markdown ผ่าน `MarkdownField` ส่วนไฟล์แนบจะมาใน **Phase 2**
- **เผยแพร่ทีละชิ้น:** ชิ้นใหม่ยังไม่เผยแพร่ อาจารย์กดเปิดเองเมื่อพร้อม และเปิดสไลด์ก่อนใบงานได้
- ถ้าลบสัปดาห์ออกจากแผน เอกสารของสัปดาห์นั้นไม่หาย จะเปลี่ยนเป็น **Unplanned** ซึ่งเห็นเฉพาะ staff และย้ายไปสัปดาห์อื่นหรือลบได้
- ทำซ้ำไปภาคใหม่แล้ว เอกสารติดไปด้วย ทุกชิ้นเริ่มเป็นยังไม่เผยแพร่
- พิมพ์ได้ เช่น แจก handout หรือใบงาน

### Phasing

- **Phase 1 (PRD นี้):** เนื้อหา Markdown, การเผยแพร่, การย้าย/ลบ, Unplanned, การพิมพ์ และการทำซ้ำ รูปภาพใช้ URL ภายนอก (`![](https://…)`) ส่วนสไลด์ที่ทำใน PowerPoint หรือ Google Slides ใส่เป็นลิงก์ได้ (ลิงก์ภายนอกเปิดในแท็บใหม่ ตาม #106)
- **Phase 2 (แยก PRD):** ไฟล์แนบต่อชิ้น มีได้หลายไฟล์ เช่น PDF/PPTX/ZIP และรูปภาพที่อัปโหลดมาแสดงในเนื้อหา ยังต้องตัดสินเรื่องที่เก็บไฟล์ (แนวที่เอนไว้คือ Docker volume + metadata ใน Postgres + ดาวน์โหลดผ่าน API ที่ตรวจสิทธิ์), ขนาดไฟล์สูงสุด และชนิดไฟล์ที่รับ Phase 1 ต้องออกแบบไว้ให้เพิ่มส่วนนี้ได้โดยไม่ต้องรื้อ

## User Stories

### ผู้สอน: เขียน เผยแพร่ จัดการ

1. ในฐานะผู้สอน ฉันเปิดเมนู "เอกสารการสอน" แล้วเห็นทุกสัปดาห์ของแผนการสอน พร้อมหัวข้อจาก Syllabus และสัปดาห์ละ 3 ช่อง
2. ในฐานะผู้สอน ฉันกด "+ สร้าง" ในช่องที่ว่างเพื่อเขียนเอกสารประเภทนั้นของสัปดาห์นั้นด้วย Markdown โดยมีแถบเครื่องมือและแท็บ "ดูตัวอย่าง"
3. ในฐานะผู้สอน เมื่อฉันแก้หัวข้อในแผนการสอนของ Syllabus หัวข้อในหน้าเอกสารการสอนเปลี่ยนตามทันที
4. ในฐานะผู้สอน ถ้าสัปดาห์หนึ่งมีหลายหัวข้อในแผน หัวข้อของสัปดาห์นั้นจะแสดงทุกหัวข้อต่อกันตามลำดับในแผน
5. ในฐานะผู้สอน เอกสารที่เพิ่งสร้างยังไม่เผยแพร่ ฉันกดเผยแพร่หรือเลิกเผยแพร่ทีละชิ้นได้ และเห็นป้าย "ยังไม่เผยแพร่" บนชิ้นที่ยังไม่เปิด
6. ในฐานะผู้สอน ถ้าฉันจะออกจากหน้าแก้ไขโดยยังไม่ได้บันทึก ระบบเตือนก่อน (#104)
7. ในฐานะผู้สอน ถ้าสัปดาห์ใดหายจากแผนการสอน ฉันเห็นเอกสารของสัปดาห์นั้นในกลุ่ม "ไม่อยู่ในแผนการสอน" ท้ายหน้า
8. ในฐานะผู้สอน ฉันกด "ย้ายไปสัปดาห์…" บนเอกสารเพื่อย้ายไปสัปดาห์อื่นได้ ถ้าสัปดาห์ปลายทางมีเอกสารประเภทเดียวกันอยู่แล้ว ระบบไม่ยอมย้ายและบอกเหตุผล
9. ในฐานะผู้สอน ฉันลบเอกสารได้ โดยต้องยืนยันก่อน
10. ในฐานะผู้สอน ถ้ายังไม่มีแผนการสอน ฉันเห็นข้อความว่าง พร้อมลิงก์ไปเพิ่มแผนใน "ประมวลรายวิชา"

### นักศึกษา / ผู้ช่วยสอน: อ่าน

11. ในฐานะนักศึกษา ฉันเห็นเฉพาะสัปดาห์ที่มีเอกสารเผยแพร่แล้วอย่างน้อยหนึ่งชิ้น และในสัปดาห์นั้นเห็นเฉพาะชิ้นที่เผยแพร่แล้ว
12. ในฐานะนักศึกษา ฉันไม่เห็นเอกสารที่ยังไม่เผยแพร่หรือเป็น Unplanned แม้จะพิมพ์ URL ตรง ระบบตอบ 404 แบบเดียวกับชิ้นที่ไม่มีอยู่จริง
13. ในฐานะนักศึกษา ถ้ายังไม่มีเอกสารเผยแพร่เลย ฉันเห็นข้อความ "ยังไม่มีเอกสารการสอน"
14. ในฐานะผู้ช่วยสอน ฉันเห็นเอกสารทุกชิ้น รวมถึงชิ้นที่ยังไม่เผยแพร่และ Unplanned แต่ไม่เห็นปุ่มแก้ไข เผยแพร่ ย้าย หรือลบ
15. ในฐานะผู้ใช้ทุก Role ฉันกด "พิมพ์" บนหน้าเอกสารแล้วได้หน้า A4 ที่มีแต่หัวข้อและเนื้อหา

### ทำซ้ำไปภาคใหม่

16. ในฐานะผู้สอน เมื่อฉันทำซ้ำรายวิชาไปภาคใหม่ เอกสารทุกชิ้นถูกคัดลอกไปที่เลขสัปดาห์และประเภทเดิม รวมถึงชิ้นที่เป็น Unplanned ทุกชิ้นเริ่มเป็นยังไม่เผยแพร่ และการแก้ฝั่งภาคใหม่ไม่กระทบภาคเดิม

## Implementation Decisions

### Domain module (`src/lib/materials/`): one rule per module (ADR 0010 style)

- **`kinds.ts` (pure):** the Material Kind registry.
  - `MATERIAL_KINDS = ["slides", "handout", "lab"]` (the URL slug), each with a Thai label: สไลด์ / เอกสารประกอบ / ใบงานปฏิบัติการ
  - `isMaterialKind(value)`
  - Every list, label and route param reads from here, so there is no second list.
- **`outline.ts` (pure):** the one rule for "which week, under which heading, planned or not".
  - `materialHeading(plan, weekNo)` returns that week's plan topics in plan order, joined by ` · `. It returns `null` when the week isn't in the plan.
  - `buildMaterialsOutline(plan, materials)` returns `{ weeks: [{ weekNo, heading, byKind }], unplanned: Material[] }`. The weeks are the distinct plan week numbers in order, and `unplanned` holds Materials whose week isn't in the plan.
  - The page and the API both use it, so the grouping is never re-derived.
- **`student-view.ts` (pure):** the one module for what a Student sees, in the same spirit as the Problem Student View (#84). It takes the viewer's course access (`{ staff }`).
  - `materialsOutlineFor(viewer, outline)`:
    - staff: untouched
    - student: keep only published Materials of planned weeks, drop weeks left with none, drop `unplanned`, and strip the `isPublished` flag
  - `canSeeMaterial(viewer, material, planned)` returns `staff || (isPublished && planned)` for the single-document page and the GET.
  - Callers never redact inline.
- **`draft.ts` (pure):** `buildMaterialDraft(body)` returns `{ ok, draft } | { ok: false, errors }`. The body is a string, trimmed at the ends only. A wrong-typed body is a 400, never a 500. Routes never validate the raw body.
- **Week number:** reuse `syllabus/plan.ts#isPlanWeek` (integer 1–20). Teaching Materials use the same range as the Teaching Plan, with no second constant.
- **`repository.ts`:**
  - `listMaterials(db, key)`
  - `getMaterial(db, key, weekNo, kind)`
  - `saveMaterial(db, key, weekNo, kind, body, actorId)` creates or updates the row. pg-mem has weak `ON CONFLICT`, so it does an existence check, then INSERT or UPDATE.
  - `setMaterialPublished(db, key, weekNo, kind, published)`
  - `moveMaterial(db, key, weekNo, kind, toWeekNo)` returns `{ ok } | { ok: false, reason: "target-taken" | "not-found" }`. It checks before writing.
  - `deleteMaterial(db, key, weekNo, kind)`
  - `copyMaterials(db, source, target, actorId)` is used by duplication. It copies 1:1 with `is_published = false`.
- **The Syllabus is not touched.** `saveSyllabus` stays unchanged and never reads or writes Teaching Materials (ADR 0012).

### Schema (`scripts/migrate-014-teaching-materials.sql` + `schema.sql`)

- **`teaching_materials`:**
  - `id SERIAL` PK. It is an anchor for Phase 2 attachments, and stays unchanged when a Material moves weeks.
  - course FK `(course_code, course_year, course_semester)` → courses `ON DELETE CASCADE`
  - `week_no INTEGER NOT NULL CHECK (week_no BETWEEN 1 AND 20)`
  - `kind TEXT NOT NULL CHECK (kind IN ('slides','handout','lab'))`
  - `body TEXT NOT NULL DEFAULT ''`
  - `is_published BOOLEAN NOT NULL DEFAULT FALSE`
  - `updated_at TIMESTAMPTZ`, `updated_by` → users
  - `UNIQUE (course_code, course_year, course_semester, week_no, kind)`
- **No link to `weeks` or `syllabus_plan_entries`.** The heading is joined in code by week number. The surrogate `id` never appears in a URL, which uses week + kind, in the same way that Problem URLs use week + position.

### API (`courseRoute`)

```
GET    /api/courses/[code]/[year]/[semester]/materials                      → { weeks, unplanned }   (anyone linked; viewer-shaped via materialsOutlineFor)
GET    /api/courses/[code]/[year]/[semester]/materials/[week]/[kind]        → { material, heading }  (anyone linked; student → 404 unless canSeeMaterial)
PUT    /api/courses/[code]/[year]/[semester]/materials/[week]/[kind]        → { material }           (manage; { body }; creates on first save)
PUT    /api/courses/[code]/[year]/[semester]/materials/[week]/[kind]/publish → { material }          (manage; { published: boolean })
POST   /api/courses/[code]/[year]/[semester]/materials/[week]/[kind]/move   → { material }           (manage; { weekNo }; 409 target-taken)
DELETE /api/courses/[code]/[year]/[semester]/materials/[week]/[kind]                                  (manage)
```

- Bad `[week]` (not `isPlanWeek`) or `[kind]` (not `isMaterialKind`) → 404.
- For a Student, a Material that doesn't exist, isn't published, or is Unplanned all return the **same 404 body**, so a Student can't probe what exists (#80 style).
- PUT accepts any week number from 1 to 20, even one that isn't in the plan, because the Material is Unplanned until the plan has that week. The UI only offers "+ สร้าง" on planned weeks.
- A move to a week outside 1–20 → 400. Moving to the same week is a no-op that returns 200.
- TA → 403 on every write. Someone not linked to the course → the existing 403/404 from `authorizeCourse`.

### UI

- **Pages** (Server Components gated through `getCourseAccess`):
  - `src/app/(app)/courses/[code]/[year]/[semester]/materials/page.tsx`: the outline
  - `…/materials/[week]/[kind]/page.tsx`: one document, with a view mode plus an edit mode for managers. A Student who can't see it gets `notFound()`.
  - The legacy shortcut `/materials` redirects to the active course, like `/syllabus`.
- **Wiring:**
  - Menu: `MENU.materials` "เอกสารการสอน" for every Role, right after `MENU.syllabus` in `roles.ts`
  - Breadcrumbs: `materials: "เอกสารการสอน"`, plus the week number and the Kind label from `kinds.ts`
  - Add `/materials/:path*` to the `proxy.ts` matcher
- **`MaterialsOutline`:**
  - One card per plan week: "สัปดาห์ N · heading", with 3 slots in `MATERIAL_KINDS` order
  - For staff: a "ยังไม่เผยแพร่" badge, "+ สร้าง" on empty slots of planned weeks (managers only), and a "ไม่อยู่ในแผนการสอน" group at the end
  - Empty states: no plan (staff see a link to the Syllabus), and "ยังไม่มีเอกสารการสอน" for a Student with nothing published
- **`MaterialPanel`** (document page):
  - **View:** the heading, rendered with `MarkdownContent` as it is today. Unplanned shows "ไม่อยู่ในแผนการสอน".
  - **Manager controls** (inside `.print-controls`): แก้ไข, เผยแพร่/เลิกเผยแพร่, ย้ายไปสัปดาห์…, ลบ (via `ConfirmDialog`)
  - **Every viewer:** พิมพ์
  - **Edit:** `MarkdownField` with บันทึก / ยกเลิก, and the `useUnsavedChangesGuard(dirty)` guard (#104)
- **Print:** reuse the Syllabus pattern (#102): `window.print()`, the shell is already `print:hidden`, and the buttons sit in `.print-controls`. Prints the heading and content.

### Logging

- Add `material.update` (save, move, delete, with the op and `week/kind` in the detail) and `material.publish` (publish and unpublish) to `LogAction`. The target is the course slug.

### Course Duplication

- `duplicateCourseOffering` calls `copyMaterials(db, source, target, actorId)` inside the same transaction. It copies every Material, Unplanned ones included, with the same `week_no` and `kind`, `is_published = false`. If the source has none, nothing is created.
- Update ADR 0006 (what gets copied), `CLAUDE.md` and the Course Duplication entry in `CONTEXT.md` (the glossary is already updated).

## Testing Decisions

Test external behaviour with pg-mem and `courseFixture()`, following the existing pattern.

- **Pure modules** use table-driven tests:
  - `kinds.ts`: `isMaterialKind` accepts the 3 slugs and rejects anything else, including the wrong case
  - `materialHeading`: one entry, several entries in one week (plan order kept), and a week not in the plan → null
  - `buildMaterialsOutline`:
    - the weeks are the distinct plan weeks in order
    - Materials land in the right slot
    - a Material whose week isn't in the plan → `unplanned`
    - an empty plan → every Material is unplanned
  - `materialsOutlineFor` / `canSeeMaterial`: staff/student × published/unpublished × planned/unplanned; a week whose Materials are all unpublished disappears for a Student
  - `buildMaterialDraft`: a string passes (trimmed), a number/null/missing body → errors, not throws
- **Routes:**
  - GET outline: Instructor, TA and Student each get the right shape. Someone outside the course gets 403/404.
  - GET one: a Student gets the same 404 for a missing, unpublished or Unplanned Material, and 200 for a published planned one. A TA gets 200 for an unpublished one.
  - PUT: an Instructor creates on the first save and updates on the second, and the Material starts unpublished. A TA gets 403, a Student gets 403, a bad body gets 400, and a bad week/kind gets 404.
  - publish: the flag toggles, and a TA gets 403
  - move: succeeds into an empty slot, gets 409 when the target is taken (both Materials stay unchanged), and gets 400 for a week outside 1–20
  - DELETE: the Material is gone
  - Saving the Syllabus so that a week is removed leaves its Materials in place, and they show as Unplanned
  - Each write logs the expected action
- **Duplication:** Materials are copied 1:1, Unplanned included, and all are unpublished. Editing the copy leaves the source unaffected, and a source with none creates nothing.

## Out of Scope (Phase 1)

- File attachments and uploaded images (**Phase 2**, a separate PRD covering storage, size limits and file types)
- A slide presentation mode (`---` page breaks, arrow keys, full screen)
- Syntax highlighting in code blocks. That belongs to `MarkdownContent` as a whole, as a separate task.
- TA editing (it would be the first TA write in the system, and needs its own ADR)
- Scheduled or auto-release, and any link to Released Week
- Custom Material Kinds per Course
- Links to Materials from the Teaching Plan rows on the Syllabus page
- Version history, or a separate draft from the published copy (publishing exposes the current body)
- Tracking which students have read a Material

## Further Notes

- These decisions came out of a `/grill-with-docs` session on 2026-10-18. The glossary terms were added to `CONTEXT.md` during the session, and the keying decision is ADR 0012.
- One default was picked without a separate question: a Material with an empty body can still be saved and published. Phase 2 attachments will make "body empty but has files" normal, so Phase 1 adds no rule that blocks it.
- Ship it in vertical slices:
  1. Schema + `materials/` module (kinds, outline, draft, repository) + GET outline / GET one / PUT + the outline and document pages, menu, breadcrumbs and proxy + empty states + permissions (everything unpublished, staff only)
  2. Publish/unpublish + the Student View (Students see published planned Materials, with the same 404 otherwise)
  3. Unplanned group + move + delete
  4. Print + Course Duplication copying Materials
