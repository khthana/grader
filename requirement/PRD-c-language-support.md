# PRD — C Language Support (per-course language binding)

## Problem Statement

ตอนนี้ CE-Grader ตรวจได้เฉพาะ Python ภาษาเดียว — ทั้งระบบ hardcode เป็น `python` / `3.10.0`
ในตัวรันโค้ด (Piston) แม้สคีมาจะมีคอลัมน์ `problems.language` / `submissions.language` อยู่แล้วก็ตาม
อาจารย์ที่สอนวิชาภาษา C จึงใช้ระบบนี้ไม่ได้ ต้องไปตรวจมือหรือใช้เครื่องมืออื่น

## Solution

ให้อาจารย์เลือก **ภาษาประจำวิชา (course language)** ได้ตอนสร้างรายวิชา — รองรับ **Python** และ **C**
โจทย์ทุกข้อในวิชานั้นจะใช้ภาษาเดียวกันโดยอัตโนมัติ นักศึกษาเขียนและส่งโค้ดในภาษาของวิชา ระบบคอมไพล์ (กรณี C)
และรันบน Piston แล้วเทียบ stdout กับ test cases เหมือนเดิม โครงสร้าง grading/score/review/gradebook
ทั้งหมดทำงานต่อได้โดยไม่ต้องเปลี่ยน เพราะ io mode เทียบผลลัพธ์ ไม่ผูกกับภาษา

แนวคิดการผูกภาษา: **course เป็น source of truth ตอนตั้งค่า → โจทย์ inherit ภาษาจากวิชา → runner อ่าน
`problems.language` ตอนรัน** (ของเดิมแทบไม่ต้องรื้อ และเปิดทางให้ override รายโจทย์ในอนาคตได้ฟรี)

## User Stories

1. As an Instructor, I want to choose the programming language (Python or C) when I create a course, so that the whole course works in the language I teach.
2. As an Instructor, I want every problem I create in a C course to default to C automatically, so that I don't set the language on each problem.
3. As an Instructor, I want the language field on a problem to be read-only and reflect the course language, so that problems in one course never end up in mixed languages.
4. As an Instructor, I want to be blocked from changing a course's language once it already has problems, so that existing starter code / reference solutions stay consistent with the language.
5. As an Instructor, I want to freely change a course's language while it still has zero problems, so that I can fix a mistaken choice before adding content.
6. As an Instructor of a C course, I want "รันเฉลย" to compile and run my C reference solution against the test-case inputs, so that I can compute expected outputs and verify correctness.
7. As an Instructor, I want per-case ✅/⚠️/🔴 feedback from "รันเฉลย" for C just like Python, so that I can spot mismatches and apply the reference outputs.
8. As an Instructor of a C course, I want the "สร้างด้วย AI" button hidden, so that I'm not offered an unsupported generation path in this release.
9. As a Student in a C course, I want the code editor to highlight C syntax, so that writing C feels natural.
10. As a Student, I want the editor toolbar/label/placeholder to reflect the actual language, so that it's clear which language I'm submitting.
11. As a Student in a C course, I want "รันทดสอบ" (run) to compile and execute my C against the visible test cases, so that I can check my work before submitting.
12. As a Student, I want "ส่งคำตอบ" (submit) to grade my C against all test cases and store my submission, so that I receive a score.
13. As a Student, I want to see the full gcc compile error when my C fails to compile, so that I can fix syntax mistakes — the same way I'd see a Python traceback.
14. As a Student, I want a C runtime error (e.g. segfault / non-zero exit) surfaced clearly, so that I can debug failing cases.
15. As an Instructor/Admin, I want existing Python courses and problems to keep working unchanged after this feature ships, so that nothing regresses.
16. As an Instructor, I want course duplication to carry over the course language (and each problem's language), so that a duplicated C offering stays C.
17. As an Instructor, I want code policy (blacklist/whitelist) to keep working on C problems, so that I can forbid/require terms regardless of language.
18. As a DevOps/maintainer, I want the Piston engine to install both Python and C (gcc) at startup, so that the grader can run either language out of the box.
19. As an Instructor, I want unit-test-mode problems to remain Python-only, so that I'm not given a half-working C unit harness.
20. As a developer, I want all language-specific knowledge (Piston runtime, version, filename, editor mode, supported list) in a single registry, so that adding a future language (C++, Java) is a one-line change.

## Implementation Decisions

### Language binding model
- **Per-course.** New column `courses.language` (`TEXT NOT NULL DEFAULT 'python'`) is the language set by the Instructor.
- On problem creation the server sets `problems.language = course.language` (server-authoritative; client value ignored).
- **The runner reads `problems.language` at execution time** — grading/runner/submission plumbing keeps treating language as a property of the problem.
- `submissions.language` is stored from `problem.language` (server-authoritative), replacing the previous `body.language ?? "python"`.

### Supported languages & versions
- Python (`python` / `3.10.0`) and C (`c` / gcc `10.2.0`). C source must be sent to Piston with a `.c` filename (`main.c`); Python uses `main.py`.
- C is **io mode only**. Unit-test mode stays **Python only**.

### Deep module — Language Registry (new)
- A single `LANGUAGE_CONFIG` map keyed by language code → `{ label, piston, version, filename }`, plus helpers `getLanguageConfig(lang)` (fallback to python), `isSupportedLanguage(lang)`, and `SUPPORTED_LANGUAGES`.
- Consumed by: the Piston runner, the course form language dropdown, course validation, and the code editors' CodeMirror mode selection. This is the only place that knows language facts; adding C++/Java later = one new entry.

### Piston runner (interface extension)
- `runCode(code, input, language)`, `runReferenceSolution(code, inputs, language)`, `runTestCases(code, testCases, language)` all take a language; `runCode` builds `files: [{ name: filename, content }]` and passes the runtime/version from the registry.
- **Compile phase:** the Piston response's `compile` block is honored. If `compile.code !== 0` the attempt fails and `compile.stderr` (the gcc compile error) becomes the error shown to the student. Overall success = compile ok AND run exit 0.
- `runUnitTestBlock` stays Python-only (no language parameter).

### Grading module (interface extension)
- `GradableProblem` gains `language: string`.
- `CodeRunner.runTestCases(code, cases, language)` gains the language parameter; the `pistonRunner` adapter forwards it; `gradeSubmission` passes `problem.language` on the io path. Unit path unchanged. Grading still owns Code Policy → io/unit dispatch → scoring and knows nothing about auth/persistence.

### Course domain
- `CourseRecord` / `NewCourse` / course `SELECT_COLS` / `createCourse` / `updateCourse` carry `language`.
- `validateCourseInput` validates `language` via `isSupportedLanguage` (defaults to python when absent).
- **Language lock:** the course PUT route rejects a language change with HTTP 409 (`errors.language`) when the course already has problems. The check reuses `getCourseCascadeCounts(db, key).problems > 0`.
- `POST /api/courses` forwards `language` to `createCourse`.
- Course duplication copies `language` from source course (problem-level `language` is already copied today).

### Problem creation
- The problems POST route sets `language` from `auth.course.language` (ignores any client-supplied language).

### UI
- Course form dialog: a language `<select>` populated from `SUPPORTED_LANGUAGES`; in edit mode it is disabled (with an explanatory note) when the course already has problems. The dialog learns the problem count from `GET /api/courses/{slug}`, which already returns `counts`.
- Problem editor: receives the course language; the language field is read-only and shows the course language; the "สร้างด้วย AI" button is hidden when the course language is not Python; `language` is passed to the reference-solution editor and included in the "รันเฉลย" request body.
- Code editor & reference-solution editor: receive a `language` prop and pick the CodeMirror extension from the registry (`python()` ↔ `cpp()` for C); toolbar label and placeholder become dynamic. The student problem page passes `problem.language`.
- New dependency: `@codemirror/lang-cpp` (covers C highlighting).

### run-reference route
- Accepts `language` in the request body and forwards it to `runReferenceSolution` (defaults to python when absent).

### Infrastructure
- `schema.sql` adds `courses.language`; migration `scripts/migrate-007-course-language.sql` applies it to existing DBs (`ADD COLUMN IF NOT EXISTS`).
- `docker-compose.yml` `piston-init` installs the C/gcc package (`{"language":"c","version":"10.2.0"}`) in addition to Python; the installed version must match the registry.

## Testing Decisions

Good tests assert **external behavior** through a module's public interface, not internal wiring — consistent with the existing suite (pure modules unit-tested directly; repositories/routes integration-tested against pg-mem with `setTestDb`; the Piston seam exercised via the `CodeRunner` fake, never by mocking modules).

Modules to test:
- **Language registry** (new `languages.test.ts`): lookup by code, fallback to python for unknown input, `isSupportedLanguage`, and the supported-languages list.
- **Piston runner** (`piston.test.ts`): `runCode` sends the correct filename/version per language; a non-zero `compile` block produces a failed result whose error equals the compile stderr; success requires compile-ok + run-exit-0. (Network is faked, as in the existing run-reference/piston tests.)
- **Grading** (`grading/index.test.ts`): the fake `CodeRunner` receives `language`; io grading forwards `problem.language`; unit grading is unaffected; `GradableProblem` carries language.
- **Course repository & validation**: `createCourse`/`getCourseByKey`/`updateCourse` round-trip `language`; `validateCourseInput` accepts supported languages and rejects unsupported ones.
- **Course PUT route**: changing language with existing problems → 409; with zero problems → 200. Prior art: existing course route + repository integration tests, and `getCourseCascadeCounts` tests already added for course deletion.

UI components (course form dialog, code/solution editors, problem editor) are **not** unit-tested, matching the project's convention; they are covered by the end-to-end verification instead.

## Out of Scope

- **AI test-case generation for C** ("สร้างด้วย AI") — deferred; the button is hidden for non-Python courses. The LLM module is untouched this release.
- **Unit-test mode for C** — unit mode remains Python only; no C test harness/convention is designed.
- **Per-problem language override** — language is fixed per course; the inherit-into-`problems.language` design leaves room to add this later without rework.
- **Mixed-language courses** — a single course is one language.
- **Languages beyond Python and C** — the registry makes future additions cheap, but none are added now.
- **Changing a course's language after problems exist** — explicitly blocked, not supported via migration tooling.

## Further Notes

- The hard, language-specific work (compile phase, filename, gcc install) is identical whether binding is per-course or per-problem; per-course was chosen because it matches teaching reality and yields simpler UX, while keeping execution reading from `problems.language`.
- `checkCodePolicy` is language-agnostic (Instructor-authored whole-word terms), so it works for C without changes.
- Several pieces already support language and need no change: `duplicate.ts` copies `problems.language`; `submissions.language` exists; `problem.language` already reaches the student page.
- This feature is documented as part of the standalone CE-Grader product; DEEP-QA repos remain read-only references.
