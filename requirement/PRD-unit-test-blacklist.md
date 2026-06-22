# PRD — Unit Test Mode & Code Policy (Blacklist / Whitelist)

> CE-Grader — ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ
> Domain glossary: `CONTEXT.md` · Architecture decisions: `docs/adr/`

> **⚠️ Unit Test Mode redesigned in #55 (2026-06-22).** The args/expected per-test-case
> model described below (#53/#54) was **superseded** by a single **pytest-style test-code
> block** with all-or-nothing scoring. Sections describing args/expected pairs, the
> `runUnitTestCases` harness, per-test-case unit scoring, and the `{ tests: [{args,
> expected_return}] }` AI shape are **historical**. Current behavior: instructor writes one
> `unit_test_code` block (assert statements), student code is prepended, runs once via
> `runUnitTestBlock`; pass all → full `score`, else 0; student sees the stderr traceback on
> failure; `function_name` is optional. Schema: `problems.unit_test_code`
> (`migrate-006-unit-test-code.sql`). See `CONTEXT.md` → "Unit Test Mode" / "Unit Test Code".
> The **Code Policy** and **Per-Test-Case Scoring (I/O)** parts of this PRD are unchanged.

---

## Problem Statement

ระบบตรวจงานปัจจุบันรองรับเฉพาะรูปแบบ **stdin → stdout comparison** เท่านั้น ทำให้มีข้อจำกัดสองประการ:

1. **ไม่รองรับโจทย์ที่ให้นักศึกษาเขียนเฉพาะฟังก์ชัน** — โจทย์ประเภท "เขียนฟังก์ชัน `add(a, b)` ที่คืนค่าผลบวก" ต้องการ unit test ที่เรียกฟังก์ชันตรงๆ ไม่ใช่การส่ง stdin แล้วอ่าน stdout ซึ่งบังคับให้ Instructor ต้องเขียน boilerplate `input()`/`print()` รอบนอกฟังก์ชันทุกครั้ง และนักศึกษาต้องส่ง code ที่ไม่ตรงกับ pattern จริงที่ใช้ใน production code
2. **ไม่มีการตรวจสอบ pattern ของ code** — Instructor ไม่สามารถบังคับให้นักศึกษาใช้ หรือห้ามใช้ คำสั่ง/โครงสร้างบางอย่าง เช่น "ต้องใช้ recursion" หรือ "ห้าม import sort" ซึ่งเป็น pedagogical requirement สำคัญในรายวิชา intro programming

---

## Solution

เพิ่มสองความสามารถใหม่บน Problem:

**Unit Test Mode** — Instructor เลือก `problem_type = "unit"` กำหนดชื่อฟังก์ชัน และสร้าง test case แบบ structured (arguments + expected return value) ระบบสร้าง Python harness ส่งไป Piston เรียกฟังก์ชันของนักศึกษาตรงๆ ทีละ case นักศึกษาเห็น actual return value เมื่อผิด ไม่ต้องเขียน `input()`/`print()` เอง

**Code Policy (Blacklist / Whitelist)** — Instructor กำหนดรายการคำ/คำสั่ง ที่ "ห้ามมี" (blacklist) และ/หรือ "ต้องมี" (whitelist) บน Problem ระบบตรวจด้วย whole-word regex ก่อนรัน test ทั้งในโหมด run และ submit หากละเมิดกฎจะ reject ทันทีพร้อมบอก term ที่ผิด

นอกจากนี้ยัง **ปรับ scoring เป็น per-test-case** ทั้งสอง mode เนื่องจาก `test_cases.score` มีอยู่แล้วในฐานข้อมูลแต่ยังไม่ถูกใช้

---

## User Stories

### Unit Test Mode — Instructor (สร้าง/แก้ไขโจทย์)

1. As an Instructor, I want to choose the problem type between "I/O" and "Unit Test" when creating or editing a problem, so that I can select the grading method appropriate for the task.
2. As an Instructor, I want to specify a function name (e.g. `add`) at the problem level for unit test problems, so that the grader knows which function to call in every test case.
3. As an Instructor, I want to provide starter code that pre-populates the student's code editor, so that students know the function signature and don't have to guess the expected function name.
4. As an Instructor creating a unit test problem, I want test case fields labelled "Arguments" and "Expected Return Value" instead of "Input" and "Expected Output", so that the form reflects the actual meaning.
5. As an Instructor, I want to type arguments as Python literals (e.g. `2, 3` or `"hello", True`), so that I can express any Python value naturally.
6. As an Instructor, I want to type expected return value as a Python literal (e.g. `5` or `[1, 2, 3]`), so that the comparison is done against the actual Python value returned.
7. As an Instructor, I want the "รันเฉลย" (run reference solution) button to work on unit test problems the same way it does on I/O problems, so that I can verify expected return values before saving.
8. As an Instructor, I want validation to require a function name when problem type is "unit", so that I can't accidentally save an incomplete unit test problem.

### Unit Test Mode — Student (ส่งงาน)

9. As a Student, I want the code editor to be pre-populated with the starter code the Instructor provided, so that I know the function signature I need to implement.
10. As a Student working on a unit test problem, I want to click "รันทดสอบ" and see which test cases my function passes or fails, so that I get feedback before submitting.
11. As a Student, I want to see the actual return value my function produced when a unit test case fails (e.g. "ได้ `4` แต่คาดว่า `5`"), so that I can debug my code.
12. As a Student, I want to see the error message when my function raises an exception, so that I can identify runtime errors.
13. As a Student, I want hidden unit test cases to run at submit time but not be shown to me, consistent with how hidden test cases work on I/O problems.
14. As a Student, I want my score to reflect how many test cases I passed, weighted by each test case's score, so that partial credit is possible.

### Code Policy — Instructor (สร้าง/แก้ไขโจทย์)

15. As an Instructor, I want to add one or more blacklisted terms to a problem (e.g. `sort`, `sorted`, `import os`), so that I can prevent students from using shortcuts I want them to implement themselves.
16. As an Instructor, I want to add one or more whitelisted terms to a problem (e.g. `def`, `recursion`), so that I can require students to use a particular construct.
17. As an Instructor, I want to configure both blacklist and whitelist on the same problem simultaneously, so that I can express composite constraints.
18. As an Instructor, I want the blacklist and whitelist to apply to both I/O and unit test problems, so that code policy is independent of the grading mode.
19. As an Instructor, I want to leave both lists empty (no policy), so that most problems work exactly as before with no change in behavior.

### Code Policy — Student (รับงาน)

20. As a Student, I want to be told immediately when my code contains a blacklisted term before any tests run, so that I can fix the violation without wasting a submission attempt.
21. As a Student, I want to be told which specific term triggered the rejection (e.g. "ห้ามใช้: `sorted`"), so that I know exactly what to change.
22. As a Student, I want code policy to be checked when I click "รันทดสอบ" as well, so that I get policy feedback early without having to submit.
23. As a Student, I want to be told when my code is missing a required term (whitelist violation), with a message indicating which term is missing.

### Per-Test-Case Scoring

24. As a Student, I want my points earned to equal the sum of the scores of the test cases I passed, so that I get partial credit for partial solutions.
25. As an Instructor, I want each test case to carry its own score that contributes to the total, so that I can weight harder test cases more heavily.
26. As an Instructor, I want the problem's total score shown in the editor to equal the sum of all test case scores, as it does today.

### AI Test-Case Generation

27. As an Instructor creating a unit test problem, I want the "สร้างด้วย AI" button to generate test cases as arguments/expected return value pairs, so that I don't have to hand-craft all unit test cases.
28. As an Instructor, I want the AI-generated reference solution to work for unit test problems, so that I can click "รันเฉลย" to verify expected return values after AI generation.
29. As an Instructor creating an I/O problem, I want AI generation to work exactly as before, so that no existing workflow is disrupted.

---

## Implementation Decisions

### Schema — one migration (`migrate-005-unit-test-blacklist.sql`)

Columns added to `problems`:
- `problem_type TEXT NOT NULL DEFAULT 'io'` — `'io'` or `'unit'`
- `function_name TEXT NOT NULL DEFAULT ''` — required (non-empty) when `problem_type = 'unit'`
- `starter_code TEXT NOT NULL DEFAULT ''` — pre-populates student code editor; applies to both modes
- `blacklist TEXT[] NOT NULL DEFAULT '{}'` — terms forbidden in submitted code
- `whitelist TEXT[] NOT NULL DEFAULT '{}'` — terms that must appear in submitted code

`test_cases` table is unchanged. Existing columns are reused:
- `input` — stores arguments string (Python literal) in unit test mode
- `expected_output` — stores expected return value string (Python literal) in unit test mode
- `score` — already present; now used for per-test-case scoring in both modes

### Module: Code Policy Checker (new pure module)

A pure function `checkCodePolicy(code, blacklist, whitelist)` → `{ ok: boolean; violations: string[] }` that applies whole-word regex (`\b{term}\b`) matching. Returns `ok: false` with the list of violated terms (blacklisted terms found, or whitelisted terms missing). Stateless, no DB or Piston dependency — easy to unit test exhaustively.

### Module: Piston Harness (extend existing `piston.ts`)

Add `runUnitTestCase(functionName, argsLiteral, expectedReturn, studentCode)` → `TestResult`. Builds a Python harness string:

```
{studentCode}

try:
    _result = {functionName}({argsLiteral})
    _expected = {expectedReturn}
    if _result == _expected:
        print("PASS")
    else:
        print(f"FAIL:{repr(_result)}")
except Exception as e:
    print(f"ERROR:{str(e)}")
```

Sends to Piston (1 call per test case, consistent with I/O mode). Parses stdout:
- `"PASS"` → `passed: true`
- `"FAIL:<actual>"` → `passed: false`, `actualOutput = <actual>`
- `"ERROR:<msg>"` → `passed: false`, `error = <msg>`

The harness runs inside Piston's sandbox, so `eval`-equivalent expansion of Python literals is safe.

### Module: Grade Route (`/api/grade`)

Grading now proceeds in three stages before running tests:
1. **Code policy check** — call `checkCodePolicy`; if `!ok`, return rejection response with violated terms (no Piston call)
2. **Dispatch** — branch on `problem.problemType`: call `runTestCases` (I/O) or `runUnitTestCases` (unit)
3. **Per-test-case scoring** — `pointsEarned = sum(tc.score for passing tc)`; `pointsMax = sum(tc.score for all tc)`

### Module: Problems Repository (`problems/repository.ts`)

- `ProblemRecord` and `ProblemDetail` gain `problemType`, `functionName`, `starterCode`, `blacklist`, `whitelist`
- `PROBLEM_COLS` updated to include the five new columns
- `createProblem` and `updateProblem` accept the new fields
- Existing field exclusion rule: `reference_solution` must never appear in `PROBLEM_COLS` or any student-reachable projection — this rule is unchanged

### Module: Problem Validation (`problems/validation.ts`)

`validateProblemInput` extended:
- Require `functionName` (non-empty) when `problemType === 'unit'`
- Validate `blacklist`/`whitelist` as arrays of non-empty strings (no further format constraint)

### Module: AI Generation (`llm/index.ts`)

`generateTestPlan` gains a `problemType: 'io' | 'unit'` parameter.

- When `'io'`: prompt and return shape are unchanged (`{ solution, inputs: string[] }`)
- When `'unit'`: prompt instructs the LLM to return `{ solution, tests: [{args, expected_return}] }` where `args` and `expected_return` are Python literal strings

### UI: ProblemEditor

- Add **Problem Type** toggle (`io` / `unit`) — switching resets test cases with a confirmation
- When `unit`: show **Function Name** field; hide Input Format / Output Format fields (not applicable)
- Add **Starter Code** editor (CodeMirror, small, both modes)
- Add **Blacklist** and **Whitelist** multi-value tag inputs (type a term + Enter to add, × to remove)
- Test case form: when `unit`, label "Input" → "Arguments", "Expected Output" → "Expected Return Value"
- "สร้างด้วย AI" passes `problemType` to the generate endpoint; on unit mode fills `tests[].args` and `tests[].expected_return` into test cases

### UI: Student Code Editor

- `starterCode` passed as initial value to `CodeEditor`; if the student has a saved submission, the submission code takes precedence (existing behavior for returning to the problem page)

### API: `POST /api/courses/.../problems/generate`

Passes `problemType` to `generateTestPlan`. Returns the same shape as before for I/O; for unit returns test cases with `args` / `expectedReturn` fields.

---

## Testing Decisions

Good tests for this feature test **observable behavior, not implementation internals**: given inputs to a pure function or a route handler, assert outputs — don't reach into regex internals or harness string shapes.

### Code Policy Checker — unit tests

Pure function with no dependencies; test all branches exhaustively: empty lists, single blacklist hit, single whitelist miss, both lists populated, term inside a longer identifier (must NOT match), term as standalone word (must match), case sensitivity.

Prior art: `src/lib/assignments/status.test.ts` (pure status derivation), `src/lib/scorebook/summary.test.ts`.

### Grade Route — integration tests

Extend `src/app/api/grade/route.test.ts`:
- Blacklist violation → 200 with rejection payload (no test ran)
- Whitelist violation → 200 with rejection payload
- Both lists empty → existing behavior unchanged
- Unit test problem: passing function → correct per-test-case score
- Unit test problem: wrong return value → `actualOutput` matches harness repr
- Per-test-case scoring: 1-of-2 cases passed → partial `pointsEarned`

Prior art: existing `route.test.ts` uses `setTestDb` + `createSessionToken` + `NextRequest`.

### Problems Repository — integration tests

Extend `src/lib/problems/repository.test.ts`:
- `createProblem` with `problem_type='unit'` persists all new columns
- `getProblemById` returns `problemType`, `functionName`, `starterCode`, `blacklist`, `whitelist`
- `updateProblem` can update each new field independently

Prior art: existing repository tests use `courseFixture()` + `pg-mem`.

### Problem Validation — unit tests

Extend `src/lib/problems/validation.test.ts`:
- Unit problem with empty `functionName` → invalid
- I/O problem with empty `functionName` → valid (ignored)
- Blacklist/whitelist with non-string elements → invalid

### AI Generation — unit tests

Extend `src/lib/llm/index.test.ts`:
- Mock fetch; assert prompt contains `problem_type=unit` signal and expected JSON shape differs from I/O prompt

---

## Out of Scope

- **AST-based code analysis** — whole-word regex covers the pedagogical use cases; AST detection of actual language constructs (e.g. detecting a `for` loop node vs the identifier `for_var`) is not included in v1
- **Float tolerance comparison** — unit test expected return values use Python `==` equality; approximate float comparison (e.g. `abs(result - expected) < 1e-9`) is not supported in v1
- **Multiple functions per problem** — function name is a single problem-level field; problems requiring multiple functions are out of scope
- **Per-student deadline extensions**
- **Languages other than Python**
- **Scheduled / automatic policy enforcement** (e.g. deduct points instead of reject)
- **AI generation for reference solution in unit test mode** — AI generates solution + test cases; "รันเฉลย" is still required to compute expected return values from the generated solution before saving

---

## Further Notes

- The `test_cases.score` column has existed since the schema was created but has never been used by the grading route — per-test-case scoring is a **bug fix** bundled with this feature, not new behavior invented for unit tests.
- Blacklist/whitelist terms are matched with `\b{term}\b` (word boundary) so `sort` does not match `sort_key` or `quicksort`, but does match `sort(` and standalone `sort`.
- The Piston harness is built server-side and is never exposed to the student — students cannot see the harness template or infer which assertions are being made on hidden test cases.
- Migration script name: `scripts/migrate-005-unit-test-blacklist.sql`.
