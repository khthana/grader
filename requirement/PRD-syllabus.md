# PRD — ประมวลรายวิชา (Syllabus)

> CE-Grader — หน้าประมวลรายวิชาของแต่ละการเปิดสอน ประกอบด้วยข้อมูลทั่วไป คำอธิบายรายวิชา วัตถุประสงค์การเรียนรู้ แผนการสอนรายสัปดาห์ เกณฑ์การวัดผล และแหล่งเรียนรู้
> Domain glossary: `CONTEXT.md` (Syllabus, Course Description · Learning Objectives, Credits, Teaching Plan, Assessment Component, Learning Resources)

---

## Problem Statement

ตอนนี้ประมวลรายวิชาอยู่นอก CE-Grader เป็นไฟล์ Word/PDF ที่แจกในคาบแรกหรือแปะไว้ที่อื่น ปัญหาที่เจอ:

- นักศึกษาต้องไปหาเอกสารเองว่าวิชานี้เรียนอะไร สัปดาห์ไหนเรียนหัวข้ออะไร และคะแนนแบ่งอย่างไร
- รายชื่อผู้สอนในเอกสารไม่ตรงกับผู้สอนจริงของภาคนั้น
- เปิดสอนภาคใหม่ทีไร ต้องคัดลอกและแก้เอกสารเองทุกครั้ง

## Solution

เพิ่มเมนู **"ประมวลรายวิชา"** ให้ทุก Role ในรายวิชา แต่ละการเปิดสอน (รหัสวิชา + ปีการศึกษา + ภาคเรียน) มีประมวลรายวิชาของตัวเอง

- **ข้อมูลทั่วไป:**
  - รหัสวิชาและชื่อวิชา (ไทย/อังกฤษ) ดึงจาก Course
  - หน่วยกิตเป็นข้อความ เช่น `3(2-2-5)`
  - ผู้สอนและผู้ช่วยสอนดึงจาก Course staff อัตโนมัติ
- **คำอธิบายรายวิชา** และ **วัตถุประสงค์การเรียนรู้** เป็นข้อความ Markdown มีแถบเครื่องมือช่วยจัดรูปแบบ
- **แผนการสอนรายสัปดาห์** เป็นตาราง สัปดาห์ / หัวข้อ / รายละเอียด
  - แยกจาก **Week** ของโจทย์ จึงมีสัปดาห์สอบได้ และนักศึกษาเห็นทั้งเทอมตั้งแต่แรก
- **เกณฑ์การวัดผล** เป็นตาราง ชื่อ / สัดส่วน % / หมายเหตุ พร้อมยอดรวม
  - เป็นข้อมูลแสดงอย่างเดียว **ไม่**นำไปคำนวณใน Gradebook หรือ Scorebook
- **แหล่งเรียนรู้** *(#107)* เป็นข้อความ Markdown หนึ่งก้อน (ตำรา เว็บไซต์ ลิงก์) อยู่ส่วนสุดท้ายของหน้า ลิงก์ไปเว็บนอก CE-Grader เปิดในแท็บใหม่ (#106)
- ผู้สอนแก้ทั้งหน้าแล้วบันทึกครั้งเดียว ไม่มีขั้นตอนเผยแพร่
- พิมพ์ได้ และเลือก Save as PDF จากหน้าต่างพิมพ์ของ browser ได้
- ทำซ้ำไปภาคใหม่ (Course Duplication) แล้วประมวลรายวิชาจะติดไปด้วย

## User Stories

### ผู้สอน — เขียนและแก้ประมวลรายวิชา

1. ในฐานะผู้สอน ฉันเปิดเมนู "ประมวลรายวิชา" แล้วกด "แก้ไข" เพื่อกรอกหน่วยกิต คำอธิบายรายวิชา วัตถุประสงค์ แผนการสอน และเกณฑ์การวัดผลได้ในหน้าเดียว
2. ในฐานะผู้สอน ฉันกดปุ่มตัวหนา ตัวเอียง รายการแบบจุด และรายการแบบตัวเลขในแถบเครื่องมือได้ โดยไม่ต้องจำ syntax ของ Markdown และสลับไปแท็บ "ดูตัวอย่าง" เพื่อดูผลก่อนบันทึกได้
3. ในฐานะผู้สอน ฉันเขียนวัตถุประสงค์เป็นรายการตัวเลขที่มีข้อย่อย หรือแบ่งกลุ่ม เช่น "ด้านความรู้ / ด้านทักษะ" ได้
4. ในฐานะผู้สอน ฉันเพิ่มแถวแผนการสอนได้ แถวใหม่ได้เลขสัปดาห์ถัดไปให้อัตโนมัติ (เลขสูงสุด + 1 แต่ไม่เกิน 20) และใส่สัปดาห์สอบกลางภาคหรือปลายภาคได้ แม้สัปดาห์นั้นไม่มีโจทย์
5. ในฐานะผู้สอน ฉันใส่หลายแถวในสัปดาห์เดียวกันได้ เช่น "Array" กับ "Lab Array" และสลับลำดับแถวภายในสัปดาห์เดียวกันได้
6. ในฐานะผู้สอน ฉันเพิ่ม แก้ และลบรายการเกณฑ์การวัดผลได้ เห็นยอดรวมเปอร์เซ็นต์ และเห็นคำเตือนสีเหลืองถ้ายอดรวมไม่เท่ากับ 100% แต่ยังบันทึกได้
7. ในฐานะผู้สอน ถ้าฉันจะออกจากหน้าโดยยังไม่ได้บันทึก ระบบเตือนก่อน
8. ในฐานะผู้สอน เมื่อฉันเปลี่ยนผู้สอนหรือผู้ช่วยสอนที่หน้ารายวิชา ประมวลรายวิชาเปลี่ยนตามทันทีโดยไม่ต้องแก้เอง

### นักศึกษา / ผู้ช่วยสอน — อ่าน

9. ในฐานะนักศึกษา ฉันเปิดเมนู "ประมวลรายวิชา" แล้วเห็นข้อมูลทุกส่วน รวมถึงแผนการสอนทุกสัปดาห์ ไม่ว่า Week ไหนจะปล่อยแล้วหรือยัง
10. ในฐานะนักศึกษา ฉันเห็นชื่อและอีเมลของผู้สอนและผู้ช่วยสอน เพื่อใช้ติดต่อ
11. ในฐานะนักศึกษา ถ้าผู้สอนยังไม่ได้กรอกอะไร ฉันเห็นข้อความ "ยังไม่มีประมวลรายวิชา"
12. ในฐานะผู้ช่วยสอน ฉันอ่านประมวลรายวิชาได้ แต่ไม่เห็นปุ่ม "แก้ไข"
13. ในฐานะผู้ใช้ทุก Role ฉันกด "พิมพ์" แล้วได้หน้า A4 ที่มีแต่เนื้อหาประมวลรายวิชา และเลือก Save as PDF ได้

### ทำซ้ำไปภาคใหม่

14. ในฐานะผู้สอน เมื่อฉันทำซ้ำรายวิชาไปภาคใหม่ ประมวลรายวิชาทุกส่วนถูกคัดลอกไปเป็นฉบับตั้งต้น และแก้ฉบับของภาคใหม่ได้โดยไม่กระทบภาคเดิม

## Implementation Decisions

### Domain module (`src/lib/syllabus/`) — one rule per module (ADR 0010 style)

- **`draft.ts` (pure):** `buildSyllabusDraft(body)` → `{ ok, draft } | { ok: false, errors }`. This is the one place the rules live. It handles:
  - trimming text
  - Teaching Plan entries: `weekNo` is an integer 1–20 and the topic must not be empty. Entries are sorted by `weekNo`, and ties keep the order sent (stable sort). `sortOrder` is reassigned after sorting.
  - Assessment Components: the name must not be empty and the weight is 0–100 (decimal allowed). They keep the order sent.
  - wrong-typed fields → 400, never 500
  - The route never validates the raw body itself (same pattern as Problem Draft #83).
- **`weights.ts` (pure):** `assessmentTotal(components)` returns the total of the weights. `isComplete(total)` checks it equals 100 (with tolerance for decimal floating point). Both the editor and the view use these, so the total and the warning never diverge.
- **`repository.ts`:**
  - `getSyllabus(db, course)` returns the syllabus, or an empty syllabus when there is no row.
  - `saveSyllabus(db, course, draft)` writes the whole syllabus inside `withTransaction`: upsert the main row, then DELETE + INSERT the plan entries and the assessment components (pg-mem doesn't handle `ON CONFLICT` well).
  - `copySyllabus(db, source, target, actorId)` is used by duplication.
- **Instructors:** not stored in the Syllabus. They are read from `course_instructors`. The existing `listCourseInstructors` returns only `id/name/email`, without roles, so add `listCourseStaffWithRoles(db, course)`, which also fetches `user_roles` in a second query (pg-mem has no `STRING_AGG`). The staff are then grouped by global Role into ผู้สอน (Instructor/Admin) and ผู้ช่วยสอน (TA) by the pure function `groupSyllabusStaff(staff)`. A user who holds both Roles counts as a ผู้สอน, the higher-priority Role.
- **`isSyllabusEmpty(syllabus)`:** true when there is no credits, description, objectives, Learning Resources, plan entry or assessment component. Drives the "ยังไม่มีประมวลรายวิชา" empty state.

### Schema (`scripts/migrate-012-syllabus.sql` + `scripts/migrate-013-syllabus-resources.sql` + `schema.sql`)

- **`course_syllabi`:**
  - PK `(course_code, course_year, course_semester)`, FK → courses `ON DELETE CASCADE`
  - columns `credits TEXT NOT NULL DEFAULT ''`, `description TEXT NOT NULL DEFAULT ''`, `objectives TEXT NOT NULL DEFAULT ''`, `resources TEXT NOT NULL DEFAULT ''` (#107, `migrate-013-syllabus-resources.sql`), `updated_at`, `updated_by`
- **`syllabus_plan_entries`:**
  - `id SERIAL`, course FK `ON DELETE CASCADE`
  - columns `week_no INTEGER CHECK (1–20)`, `topic TEXT NOT NULL`, `detail TEXT NOT NULL DEFAULT ''`, `sort_order INTEGER`
- **`syllabus_assessments`:**
  - `id SERIAL`, course FK `ON DELETE CASCADE`
  - columns `name TEXT NOT NULL`, `weight NUMERIC(5,2) CHECK (0–100)`, `note TEXT NOT NULL DEFAULT ''`, `sort_order INTEGER`
- None of these tables is keyed by Week. The Teaching Plan is not linked to Week (see Teaching Plan in `CONTEXT.md`).

### API (`courseRoute`)

```
GET  /api/courses/[code]/[year]/[semester]/syllabus   → { syllabus, staff: { instructors, tas } }   (anyone linked to the course)
PUT  /api/courses/[code]/[year]/[semester]/syllabus   → { syllabus }                                 (manage — Instructor/Admin of this course)
```

- `GET`: anyone linked to the course gets 200. That means staff plus enrolled students. Someone outside the course gets the existing 403/404 from `authorizeCourse`.
- `PUT` replaces the whole syllabus. It goes through `buildSyllabusDraft`, then `saveSyllabus`. A TA gets 403.
- Staff emails are shown only to people linked to the course, since GET already requires that.

### UI

- **Pages:**
  - `src/app/(app)/courses/[code]/[year]/[semester]/syllabus/page.tsx`: a Server Component that gates through `getCourseAccess` and passes `manager` to a client component.
  - The legacy shortcut `/syllabus` redirects to the active course, like `/quizzes`.
- **Wiring:**
  - Menu: `MENU.syllabus` "ประมวลรายวิชา" for every Role in `roles.ts`
  - Breadcrumb `syllabus: "ประมวลรายวิชา"`
  - Add `/syllabus/:path*` to the `proxy.ts` matcher
- **`SyllabusView`** (view mode) shows sections in this order:
  1. ข้อมูลทั่วไป
  2. คำอธิบายรายวิชา
  3. วัตถุประสงค์การเรียนรู้
  4. แผนการสอน
  5. เกณฑ์การวัดผล
  6. แหล่งเรียนรู้ (#107)

  Markdown is rendered with `MarkdownContent` as it is today. Managers get a "แก้ไข" button, and every viewer gets "พิมพ์".
- **`SyllabusEditor`** (edit mode):
  - Forms for the whole page, "บันทึก" / "ยกเลิก", and a `beforeunload` warning while there are unsaved changes.
  - Plan entry and assessment rows can be added and deleted, and moved up or down. Plan entries move only within the same week.
  - Shows the total % and the warning from `weights.ts`.
- **`MarkdownField`** (new, shared, `src/components/ui/`):
  - A toolbar with ตัวหนา, ตัวเอียง, รายการแบบจุด and รายการแบบตัวเลข, plus "เขียน / ดูตัวอย่าง" tabs.
  - The toolbar's text transforms live in a pure module `markdown-toolbar.ts`, e.g. `applyFormat(text, selection, kind)` → `{ text, selection }`, so they can be tested without a DOM.
  - As built: a second click undoes the first (unwraps bold/italic, removes a list whose every line is that kind); whitespace at the selection's edges stays outside the markers; `-`, `*` and `+` are read as bullets and only a 1–3 digit number as a list number (a year at a line's start is text); a nested level is numbered from 1 on its own.
  - The ProblemEditor's problem description switches to this component too, replacing its current hand-written tabs.
- **Print:** `window.print()` plus `@media print` CSS that hides the navbar, sidebar, breadcrumb and buttons, for A4. As built, buttons are hidden only inside a page's `.print-controls` wrapper (the Syllabus panel is one) — never every `<button>`, as some pages' content is buttons.

### Logging

- Add `syllabus.update` to `LogAction` and write it on every PUT.

### Course Duplication

- `duplicateCourseOffering` calls `copySyllabus(db, source, target, actorId)` inside the same transaction:
  - the main row
  - plan entries 1:1
  - assessment components 1:1
- If the source has no syllabus, nothing is created.
- Update ADR 0006 (table of what gets copied), the Course Duplication entry in `CONTEXT.md`, and `CLAUDE.md`.

## Testing Decisions

Test external behaviour with pg-mem and `courseFixture()`, following the existing pattern.

- **Pure modules** use table-driven tests:
  - `buildSyllabusDraft`:
    - `weekNo` 0 / 21 / 1.5 / string → error
    - empty topic, empty name
    - weight −1 / 100.01 / 2.5 (2.5 passes)
    - stable sort by week
    - trim
    - wrong-typed fields → errors, not throws
  - `assessmentTotal` / `isComplete`: 100, 99.99, 0.1 + 0.2 style floating point, empty list
  - `groupSyllabusStaff`: Instructor, Admin, TA, and a user with several roles
  - `applyFormat` for each kind:
    - with a selection, without a selection, and across several lines
    - toggling numbered list numbers every line
  - `isSyllabusEmpty`
- **Routes:**
  - GET: a student of the course gets 200, a TA gets 200, someone outside the course gets 403/404, and a course with no syllabus returns the empty syllabus
  - PUT: an Instructor gets 200 and the next GET returns the same data, a TA gets 403, a student gets 403, a bad body gets 400 with `errors`
  - A PUT replaces the whole thing, so rows that were removed are gone
  - Staff in GET come from `course_instructors`, so adding or removing staff changes the result immediately
- **Duplication:** the syllabus is copied 1:1, the source is unaffected when the copy is edited, and a source with no syllabus creates nothing in the target.

## Out of Scope (v1)

- Weighted grade calculation from Assessment Components, and entering midterm, final or attendance scores
- An attendance system
- A "pull topics from Weeks" button, or any link between the Teaching Plan and Weeks
- A typed-in list of extra instructors (guest instructors without an account)
- Exporting to Word or the มคอ.3 form
- A draft/publish workflow, or version history of the Syllabus
- A WYSIWYG editor, HTML content, or embedded images or files

## Further Notes

- These decisions came out of a `/grill-with-docs` session on 2026-10-17. The glossary terms were added to `CONTEXT.md` during the session. No ADR was written, because no decision was hard to reverse.
- Ship it in vertical slices:
  1. Schema, the `syllabus/` module, GET/PUT, the page, menu and empty state, with credits, description and objectives (Markdown write/preview tabs) and permissions
  2. Teaching Plan
  3. Assessment Components and the total/warning
  4. `MarkdownField` toolbar, shared with ProblemEditor
  5. Print, plus Course Duplication copying the Syllabus
