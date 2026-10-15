# PRD — Pre-test / Post-test (แบบทดสอบก่อน–หลังเรียน)

> CE-Grader — แบบทดสอบปรนัยหนึ่งชุด ทำสองรอบ (Pre / Post) เพื่อวัดผลการเรียนรู้ เปิดปิดรายกลุ่มเรียน
> Domain glossary: `CONTEXT.md` (Quiz, Quiz Round, Round Window, Quiz Question, Don't Know answer, Quiz Attempt, Answer Key Release) · Architecture decision: `docs/adr/0011-pre-post-test-quizzes.md`

---

## Problem Statement

ผู้สอนทำ Pre-test ก่อนเรียน และทำ Post-test **ด้วยข้อสอบชุดเดิม**หลังเรียน เพื่อดูว่านักศึกษาเข้าใจเรื่องใดเพิ่มขึ้น ตอนนี้ทำผ่าน Google Form ที่สร้างจาก Apps Script (`W01_Pretest_GoogleForm.gs`) ปัญหาที่เจออยู่:

- ผลอยู่นอก CE-Grader ต้องเอา email ไปจับคู่กับ Roster เอง
- Pre กับ Post เป็นฟอร์มแยกกัน การเทียบผลรายข้อต้องทำเองใน spreadsheet
- เปิดปิดฟอร์มแยกตามกลุ่มเรียนที่เรียนคนละเวลาไม่ได้
- เฉลยและคำอธิบายของ Google Form Quiz แสดงทันทีหลังส่ง ทำให้รั่วไปถึง Post-test ซึ่งใช้ข้อสอบชุดเดียวกัน

## Solution

เพิ่มเมนู **"แบบทดสอบ"** ทั้งฝั่ง Staff และ Student ในรายวิชา

- ผู้สอนสร้าง **Quiz** โดยนำเข้า JSON ในรูปแบบเดียวกับ `DATA` ในไฟล์ `.gs`
- Quiz หนึ่งชุดมีสองรอบ **Pre** กับ **Post** ใช้ข้อสอบชุดเดียวกัน
- แต่ละรอบเปิดปิดได้**รายกลุ่มเรียน** ทั้งตั้งเวลาล่วงหน้าและกด "เปิด/ปิดเดี๋ยวนี้"
- นักศึกษาทำครั้งเดียวต่อรอบ ส่งแล้วเห็นคะแนนกับผลรายข้อ (ถูก / ผิด / ไม่ทราบ) ทันที แต่จะเห็นเฉลยและคำอธิบายก็ต่อเมื่อ Post ของกลุ่มตัวเองปิดแล้ว
- ผู้สอนดูรายงานเทียบ Pre กับ Post ได้ทั้งภาพรวม รายข้อ และรายคน และส่งออก Excel ได้

คะแนน Quiz **ไม่**นำไปรวมใน Gradebook และ Scorebook

## User Stories

### ผู้สอน — สร้างและจัดการ Quiz
1. As an Instructor, I want to create a Quiz by importing the JSON I already produce for Google Forms (`title`, `description`, `dontKnow`, `questions[]`), so that I don't re-type 15 questions.
2. As an Instructor, I want a preview of the parsed Quiz (every question, its code snippet, choices, the correct one and the explanation) before I save, so that I catch import mistakes.
3. As an Instructor, I want a clear per-question error when the JSON is malformed (no correct choice, two correct choices, duplicate letters, fewer than 2 choices, missing prompt), so that I can fix the source.
4. As an Instructor, I want the `background` survey section in my file to be ignored with a notice rather than rejected, so that I can import my existing files unchanged.
5. As an Instructor, I want to tie a Quiz to a Week optionally, so that quizzes are grouped by topic week.
6. As an Instructor, I want to edit the title, description, Week and the Don't Know setting, and re-import the questions, as long as no Student has answered, so that I can fix mistakes before the test.
7. As an Instructor, I want the questions locked once any Student has answered either round, so that Pre and Post results stay comparable.
8. As an Instructor, I want to delete a Quiz. If it already has answers, I must type its title to confirm, because the results are lost permanently.
9. As an Instructor, I want to preview a Quiz exactly as a Student sees it, without creating an attempt.

### ผู้สอน — เปิดปิดรอบ
10. As an Instructor, I want to set an open time and a close time for the Pre round and the Post round **per Group**, so that each Group sits the test in its own class period.
11. As an Instructor, I want "เปิดเดี๋ยวนี้" and "ปิดเดี๋ยวนี้" buttons per Group and round, so that I can run the test live in class.
12. As an Instructor, I want "ใช้กับทุกกลุ่ม" to apply one window to every Group at once, so that single-group courses take one step.
13. As an Instructor, I want students with no Group to share one "ไม่ระบุกลุ่ม" window, so that nobody is left out.
14. As an Instructor, I want the system to refuse a Pre window and a Post window of the same Group that overlap, so that students never face two open rounds of the same Quiz.
15. As an Instructor, I want to see each round's state per Group (ยังไม่เปิด / เปิดอยู่ / ปิดแล้ว) and how many have submitted.

### นักศึกษา — ทำแบบทดสอบ
16. As a Student, I want a "แบบทดสอบ" menu listing every Quiz that has opened for my Group, with each round's status and my score, so that I know what to do.
17. As a Student, I want to answer single-choice questions with code snippets shown as formatted code, and a "ไม่ทราบ" option last, so that I can say I don't know instead of guessing.
18. As a Student, I want my answers saved as I go, so that a refresh or a dropped connection loses nothing.
19. As a Student, I want to submit only once every question is answered, and I can't change it afterwards.
20. As a Student, if the round closes before I submit, I want the answers I saved to be submitted automatically, with unanswered questions scoring zero.
21. As a Student, right after submitting I want to see my score and, per question, whether I was correct, wrong or said "ไม่ทราบ", with its topic, so that I know what to review. I do not see the correct answers yet.
22. As a Student, once the Post round of my Group has closed, I want to see the correct answers, the explanations, and my Pre vs Post result per question.
23. As a Student, I want to revisit my results any time later.

### ผู้สอน / TA — รายงาน
24. As an Instructor or TA, I want an overview per Quiz: submitted counts for Pre and Post vs enrolled, and average Pre → Post scores, filterable by Group.
25. As an Instructor or TA, I want a per-question breakdown of correct / wrong / ไม่ทราบ for Pre vs Post, with the topic, and how many chose each choice, so that I see common misconceptions.
26. As an Instructor or TA, I want a per-student table (รหัส, ชื่อ, กลุ่ม, Pre, Post, Post − Pre), where the gain shows only for students who did both rounds.
27. As an Instructor or TA, I want to open one Student's attempt and see what they answered for each question.
28. As an Instructor or TA, I want to export the report to Excel.
29. As a TA, I can see reports read-only. Creating, editing, deleting and opening or closing rounds are Instructor/Admin only.

### ทำซ้ำไปภาคใหม่
30. As an Instructor, when I duplicate a course to a new term, I want its Quizzes copied (questions, answer key, Don't Know setting, Week by `week_no`), unlocked, and with no windows and no attempts.

## Implementation Decisions

### Domain modules (`src/lib/quizzes/`) — one rule per module (ADR 0010 style)

| Rule | Module | Shape |
|---|---|---|
| Import | `import.ts` (pure) | `parseQuizImport(json) → { ok, draft, notices } \| { ok: false, errors }`. Accepts the `DATA` shape. Ignores `background` with a notice. Each question needs a prompt, ≥ 2 choices, unique letters and **exactly one** `correct`. `code` and `topic` are optional. `no` sets the order. |
| Round Window | `round-window.ts` (pure) | `roundWindow({ opensAt, closesAt }, now) → "not-open" \| "open" \| "closed"`, with `now` injected. A null `opensAt` means not open, and a null `closesAt` means it never closes. `windowsOverlap(a, b)` is used to validate Pre against Post within a Group. |
| Attempt state | `attempt.ts` (pure) | An attempt is **submitted** if `submitted_at` is set **or** its Group's window is `closed`. Scoring gives 1 per correct choice, and both "ไม่ทราบ" and unanswered give 0. Each question's outcome is `correct \| wrong \| dont-know \| unanswered`. |
| Answer Key Release | `result-view.ts` (pure) | `quizResultFor(viewer, attempt, quiz, postWindowState)`. Staff see everything. A student sees score and outcome + topic per question, and gets correct choices, explanations and the Pre/Post comparison only when the Post window of their Group is `closed`. It fails closed, and it is the only place this decision is made. |
| Visibility | `quiz-access.ts` | A student sees a Quiz when either round has a non-`not-open` window for their current Group. Week release is ignored. A Quiz that isn't visible returns 404, the same as an unknown id. |

### Schema (`scripts/migrate-009-quizzes.sql` + `schema.sql`)

- `quizzes`: `id SERIAL`, composite FK to `courses`, `week_id` nullable FK to `weeks` (**course-checked on write**, as #88 does for problems), `title`, `description`, `dont_know_enabled BOOLEAN DEFAULT TRUE`, `created_at`.
- `quiz_questions`: `id SERIAL`, `quiz_id` FK `ON DELETE CASCADE`, `sort_order`, `topic`, `prompt`, `code` (nullable), `choices JSONB` (`[{ letter, text }]`), `correct_letter`, `feedback`.
- `quiz_windows`: PK `(quiz_id, round, group_key)`. `round ∈ {'pre','post'}`. `group_key TEXT` holds the `study_group` value, and `''` means "ไม่ระบุกลุ่ม". `opens_at`, `closes_at TIMESTAMPTZ NULL`.
- `quiz_attempts`: `id SERIAL`, `quiz_id`, `round`, `user_id`, `answers JSONB` (`{ questionId: letter | "dont-know" }`), `started_at`, `updated_at`, `submitted_at` (nullable), `UNIQUE (quiz_id, round, user_id)`. The score is computed from `answers` against the current key. The key cannot change after the first attempt, because of the lock.
- **Locked** = `EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_id = …)`. There is no stored flag.

### API (`courseRoute`, all under `/api/courses/[code]/[year]/[semester]/quizzes`)

```
GET    /quizzes                          list (staff: all + counts; student: visible only, own status)
POST   /quizzes                          manage — create from import JSON
POST   /quizzes/preview                  manage — parse only, return draft/errors/notices
GET    /quizzes/[qid]                    staff: full; student: questions without key (404 if not visible)
PUT    /quizzes/[qid]                    manage — meta; questions only when unlocked (409 if locked)
DELETE /quizzes/[qid]                    manage
PUT    /quizzes/[qid]/windows            manage — upsert [{ round, groupKey, opensAt, closesAt }]; 400 on overlap
GET    /quizzes/[qid]/[round]/attempt    student — own attempt (creates on first open while window open)
PUT    /quizzes/[qid]/[round]/attempt    student — save answers (403 unless window open & not submitted)
POST   /quizzes/[qid]/[round]/attempt/submit  student — 400 unless all answered
GET    /quizzes/[qid]/report             staff — overview, per-question, per-student (?group=)
GET    /quizzes/[qid]/report/export      staff — xlsx
GET    /quizzes/[qid]/attempts/[userId]  staff — one student's answers
```

Every student mutation re-checks the window **on the server** using the student's current Group. Only enrolled Students may create attempts. Staff use preview.

### UI

- Sidebar (`roles.ts`): Staff get `แบบทดสอบ` after `รายชื่อนักศึกษา`. Students get it between `งานที่ได้มอบหมาย` and `สมุดคะแนน`. Legacy shortcut `/quizzes` redirects to the active course. Add it to the `proxy.ts` matcher.
- Pages under `/courses/[code]/[year]/[semester]/quizzes`: the list, `new` (import + preview), `[qid]` (staff: windows grid of Group × round + report tabs; student: round cards + results), and `[qid]/[pre|post]` (taking the quiz). Code snippets render read-only, with the course language's grammar.
- Questions and choices appear in their authored order with no shuffling. "ไม่ทราบ" is last and takes the next letter after the final choice.

### Logging

New `LogAction`s: `quiz.create | quiz.update | quiz.delete | quiz.window`.

### Course Duplication

`duplicateCourseOffering` copies `quizzes` + `quiz_questions` and maps `week_id` by `week_no`. It does not copy `quiz_windows` or `quiz_attempts`. This all happens in the same transaction.

## Testing Decisions

Test external behaviour with pg-mem and `courseFixture()`, following the existing pattern.

- **Pure modules** use table-driven tests:
  - `parseQuizImport`: the real `W01` `DATA` imports to 15 questions, and every error case is covered.
  - `roundWindow` boundaries: a window is half-open [open, close) — open from its open instant, closed from its close instant, so a Post may open exactly when its Pre closes; a null open never opens and a null close never closes.
  - `windowsOverlap`.
  - Attempt scoring and outcomes, including don't-know and unanswered.
  - `quizResultFor` over staff/student × Post not-open / open / closed. The key must never appear for a student before Post closes.
- **Routes:**
  - 401/403/404 gating, including TA read-only and a student of another Group.
  - Saving is refused when the window is not open.
  - Submit is refused while answers are incomplete.
  - Attempt auto-counts as submitted after close.
  - Quiz edit returns 409 when locked.
  - Window overlap returns 400.
  - The student list hides not-yet-open quizzes.
  - The report numbers are correct.
- **Duplication:** quizzes are copied and unlocked, with no windows or attempts.

## Out of Scope (v1)

- Survey / background questions (checkbox, scale, ungraded), and any question type other than single-answer MCQ.
- An in-app question editor (questions are edited by re-import while unlocked), and AI conversion from Word.
- Per-attempt countdown timers. Per-student window overrides or make-up sittings.
- Shuffling questions or choices.
- Counting Quiz scores in the Gradebook or Scorebook, or weighting.
- Editing the answer key after answers exist, and regrading.
- More than two rounds, or a Quiz with only one round. A round that is never opened is simply unused.

## Further Notes

- These decisions came out of a `/grill-with-docs` session on 2026-10-15. The glossary terms were added to `CONTEXT.md` during the session, and the trade-offs are recorded in ADR 0011.
- Ship it in vertical slices: (1) schema + import + staff list/preview, (2) windows per Group, (3) the student taking a quiz + auto-submit, (4) results + Answer Key Release, (5) staff report + export, (6) duplication.
