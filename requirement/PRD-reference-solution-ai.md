# PRD — Reference Solution + AI Test-Case Generation

> CE-Grader — เฉลยอ้างอิงในระบบ + ผู้ช่วย AI สร้าง test case
> Domain glossary: `CONTEXT.md` · Architecture decisions: `docs/adr/`

---

## Problem Statement

ในหน้าแก้ไขโจทย์ (`ProblemEditor`) ปัจจุบัน Instructor ต้องกรอก test case ทั้ง `input` และ `expectedOutput` ด้วยมือ ทำให้เกิดสองปัญหา:

1. **ไม่มีทางรู้ว่า test case ที่กรอกถูกต้องหรือไม่** — บ่อยครั้ง `expectedOutput` ถูกพิมพ์ผิด แล้วไปพบทีหลังตอนนักศึกษาส่งงาน ต้องกลับมาแก้ ซึ่งเสียเวลาและบั่นทอนความเชื่อมั่นในคะแนน
2. **การสร้าง test case เป็นงานน่าเบื่อ** — ทุกวันนี้ Instructor ต้องเปิด LLM ภายนอก ให้มันช่วยเขียนเฉลยและคิด test case แล้ว copy ผลกลับมากรอกในฟอร์มเองทีละช่อง สลับหน้าจอไปมา

## Solution

นำ **เฉลยอ้างอิง (Reference Solution)** เข้ามาเก็บเป็นส่วนหนึ่งของโจทย์ในระบบ แล้วใช้ Piston (ตัวรันโค้ดที่มีอยู่แล้ว) รันเฉลยเพื่อสร้าง `expectedOutput` จริง — ทำให้ `expectedOutput` ถูกต้องตามนิยาม (มาจากการรันเฉลย ไม่ใช่พิมพ์มือ)

ส่งมอบเป็นสองเฟส:

- **เฟส 1 — Reference Solution + Verify (ไม่ใช้ AI):** เพิ่มช่องเฉลยในฟอร์ม + ปุ่ม "รันเฉลย" ที่รันเฉลยกับทุก test case ผ่าน Piston แล้ว **แสดงความไม่ตรงให้เห็นพร้อมปุ่ม "ใช้ค่านี้" รายเคส** — แก้ปัญหา 1 เต็มรูปแบบ และใช้งานได้ทันทีโดยไม่ต้องมี LLM key
- **เฟส 2 — AI Generation:** ปุ่ม "สร้างด้วย AI" ให้ LLM เขียนเฉลย + ชุด input หลากหลายให้ แล้วป้อนเข้า pipeline เฟส 1 (Piston คำนวณ output จริง) — แก้ปัญหา 2 โดย reuse กลไกเฟส 1 ทั้งหมด

หลักการสำคัญ: **AI/เฉลยไม่เคยเดา output** — output มาจากการรันเฉลยจริงผ่าน Piston เสมอ และ Instructor ยังเป็นผู้ตัดสินใจสุดท้าย (review เฉลยและเคสก่อนบันทึก)

## User Stories

1. As an Instructor, I want to store a reference solution together with a problem, so that the system has an authoritative source for the correct output.
2. As an Instructor, I want to paste a Python reference solution into the problem editor, so that I do not have to keep it in a separate document.
3. As an Instructor, I want to run my reference solution against all current test-case inputs with one click, so that I can confirm whether my expected outputs are correct.
4. As an Instructor, when a test case's expected output is empty, I want the system to fill it from the reference solution's output, so that I do not have to type outputs by hand.
5. As an Instructor, when a test case's expected output matches the reference solution, I want a clear ✅ indicator, so that I know that case is verified.
6. As an Instructor, when a test case's expected output does NOT match the reference solution, I want to see the mismatch and the reference's actual output with a per-case "use this value" button, so that I can decide whether my case was wrong (and fix it) or my solution is wrong.
7. As an Instructor, when the reference solution errors on a given input, I want a clear error indicator on that case, so that I know my solution is broken or the input is invalid.
8. As an Instructor, I want an optional "apply all from reference solution" action, so that once I trust the solution I can fill every output at once.
9. As an Instructor, I want the reference solution to persist after I save, so that I can re-verify the test cases later without re-pasting it.
10. As an Instructor, I want to edit the reference solution later, so that I can fix it if I discover it is wrong.
11. As an Admin, I want the same reference-solution capability as Instructors, so that I can manage any course's problems.
12. As a Student, I want to never see the reference solution anywhere (page or API), so that I cannot trivially copy the answer.
13. As an Instructor, I want to generate a reference solution and a diverse set of test inputs from the problem description using AI, so that I do not have to switch to an external LLM and copy results back. *(Phase 2)*
14. As an Instructor, I want AI-generated inputs to cover normal values, edge cases, and boundary values, so that my test suite is more thorough. *(Phase 2)*
15. As an Instructor, I want AI-generated content to flow into the same "run reference → fill outputs" pipeline, so that the outputs are computed by Piston rather than guessed by the AI. *(Phase 2)*
16. As an Instructor, I want to review the AI-written solution and the generated cases before saving, so that I remain the final authority on correctness. *(Phase 2)*
17. As an Instructor, I want the "generate with AI" button to be hidden or disabled when no LLM key is configured, so that the app degrades gracefully. *(Phase 2)*
18. As a system operator, I want the LLM provider and model to be configurable via environment variables, so that I can switch between Claude and other providers without code changes. *(Phase 2)*

## Implementation Decisions

### Domain
- A **Reference Solution** is course-content authored by staff (Admin/Instructor), stored per Problem, used to compute authoritative expected outputs. It is **not** a Submission.

### Schema
- Add one column to `problems`: `reference_solution TEXT NOT NULL DEFAULT ''`.
- Default empty string — existing problems remain valid with no reference solution.
- Idempotent migration script (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), following the established manual-migration convention (prior art: migration 002 for `weeks.is_released`).

### Security — leak prevention (critical)
- The single-problem GET endpoint is entitlement-gated only (enrolled Students can call it) and returns the full problem detail. Therefore the reference solution **must not** enter the default problem projection / record / detail type.
- The reference solution is read through a **dedicated projection function** callable only from staff-gated paths. Request/page paths use the gated `getReferenceSolutionForStaff(db, id, roles)` (the Problem edit page); the raw `getReferenceSolution` is reserved for already-authorized server-side work (course duplication). The run-reference endpoint runs Instructor-supplied code from the request body and does **not** read the stored solution. *(See ADR 0007 — the staff gate was later folded into the read.)*
- The write path (create/update problem) accepts an optional reference solution; the default read path is unchanged and never exposes it.

### Reference-solution runner (deep module)
- A new Piston helper runs one piece of code against a list of inputs and returns, per input, `{ stdout, stderr, ok }` where `ok` means no stderr and a zero exit code.
- Output is trimmed consistently with the existing test-case runner so comparisons line up.
- Reuses the existing single-execution Piston primitive.

### API contract
- **New:** `POST /api/courses/[code]/[year]/[semester]/problems/run-reference`
  - Staff-only (course `manage` permission).
  - Request: `{ code: string, inputs: string[] }`.
  - Response: `{ outputs: Array<{ stdout: string, stderr: string, ok: boolean }> }`.
  - Not bound to a problem id, so it works during both create and edit.
- **Extended:** problem create (`POST .../problems`) and update (`PUT .../problems/[pid]`) accept an optional `referenceSolution` field on the request body and persist it. Input validation rules are unchanged (reference solution is optional).
- **Unchanged:** the single-problem GET continues to return a detail object that does not include the reference solution.

### Verify interaction (Problem 1)
After the Instructor clicks "run reference", each test case shows one of:
- **filled** — expected output was empty and has been populated from the reference's stdout (with a "filled from solution" indicator).
- **✅ match** — current expected output equals the reference's stdout.
- **⚠️ mismatch** — differs; shows the reference's actual stdout plus a per-case "use this value" button that overwrites only that case.
- **🔴 error** — the reference solution failed on this input (non-`ok`).

A secondary "apply all from reference solution" action overwrites every case at once.

### Editor UI
- The problem editor gains a reference-solution code field implemented as a small **controlled** CodeMirror wrapper (reusing the project's dynamic-import + Python-language CodeMirror pattern), distinct from the grading-bound student `CodeEditor`.
- The editor sends the reference solution as part of the save payload.
- The edit page loads the existing reference solution via the staff-only projection and passes it to the editor; the create page starts empty.

### AI generation (Phase 2 — sketch, reuses Phase 1 pipeline)
- A **provider-agnostic LLM module** exposes a single function that, given a problem's description/specs, returns `{ solution: string, inputs: string[] }`.
- Provider, model, and API key are selected via environment variables; the default target is Claude. Anthropic-specific details (model id, request params) are deferred to implementation time.
- A staff-only generate endpoint returns `{ solution, inputs }`; the UI fills the reference-solution field and the input fields, then the Instructor uses the Phase 1 "run reference" flow to compute outputs and reviews before saving.
- The feature degrades gracefully (button hidden/disabled) when no key is configured.

## Testing Decisions

Good tests verify **external behavior through public interfaces**, not internal implementation, so they survive refactors. Tests run on Vitest; repository and route handlers are integration-tested against pg-mem with `setTestDb` injection (prior art: `src/lib/weeks/repository.test.ts`, `src/app/api/courses/[code]/[year]/[semester]/weeks/[wid]/route.test.ts`).

Modules to test:

1. **problems/repository** — create and update persist the reference solution and it reads back via the dedicated projection; assert the default problem-detail read does **not** include the reference solution (the leak-prevention guarantee). Use `freshDb()` + `courseFixture()`.
2. **run-reference route** — staff session succeeds; a non-staff (Student) session is rejected with 403; malformed body is rejected. The actual Piston call is mocked/isolated (pg-mem cannot execute Python); the test focuses on auth gating, request validation, and response shaping.
3. **piston reference runner** — given a mocked Piston fetch, the helper parses stdout/stderr and computes `ok` correctly per input, and trims output consistently.

UI (`ProblemEditor`, `SolutionEditor`) is **not** unit-tested (no jsdom in the project); it is verified manually in the browser via the `/verify` flow.

## Out of Scope

- **Auto-grading by reference solution at submit time** — grading still compares student output to stored `expected_output`; the reference solution only assists authoring.
- **Non-Python reference solutions** — Python only in v1 (matches current problem language support).
- **Non-deterministic / interactive reference solutions** — solutions that produce random or time-dependent output are the Instructor's responsibility; the verifier reports whatever Piston returns.
- **Auto-migration of existing problems** — existing problems keep an empty reference solution until an Instructor fills one.
- **Phase 2 detailed implementation** — the LLM module and generate endpoint are sketched here but specified in full when Phase 1 lands and an LLM key is available.
- **TA authoring** — TAs remain read-only; only Admin and Instructor author reference solutions (matches existing `manage` gating).

## Further Notes

- The reference solution is intentionally treated as low-secrecy content (students could obtain a working solution from an LLM anyway); leak prevention is basic hygiene (keep it out of student-reachable payloads), not a hard security boundary.
- Schema change requires the standard manual migration on existing databases after editing `schema.sql`; fresh installs get the column via `db:setup`.
- Phase 2 depends on procuring an LLM API key (provider may be Claude or another vendor).
