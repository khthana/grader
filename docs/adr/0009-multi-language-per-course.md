# 9. Multi-language support: Python or C, chosen per course

Date: 2026-06-29

## Status

Accepted

## Context

The grader ran **Python only** — the language was effectively hard-coded: the
student editor sent `language: "python"`, `piston.ts` always called the Piston
`python`/`3.10.0` runtime, and the Docker `piston-init` service installed just that
one package (ADR 0008). Some courses teach **C**, so the same submit → run → grade
pipeline needs to compile and run C as well.

Several things make "just add C" non-trivial:

1. **C is compiled.** Piston returns a separate `compile` phase; a program can fail to
   compile (never runs) or compile-then-crash at runtime. Python has no compile phase.
2. **The install package name is not the execute name.** Verified against the real
   engine (issue #61 spike): the *installable* Piston package is **`gcc`** (version
   `10.2.0`), while the *execute* runtime is exposed as **`c`** — `/runtimes` reports
   `{"language":"c","version":"10.2.0","runtime":"gcc"}`. Installing `c-10.2.0` is
   rejected ("does not exist"). gcc also appends `.c` to the source filename, so
   `main.c` is compiled as `main.c.c` (which gcc accepts).
3. **Language must be consistent within a course.** A Problem's language can't be a
   free per-problem field that drifts from how the course is taught, and a student's
   editor/highlighting must match what will actually run.
4. **The Unit-test harness is Python-specific.** It prepends student code to a
   pytest-style assert block and runs it through the Python runtime — there is no C
   equivalent, so unit mode must not be reachable in a C course.

## Decision

Support a **fixed set of languages (Python, C), chosen once per course**, and let
every Problem inherit that language. Built as four vertical slices (#62–#65) on top of
a HITL contract-verification spike (#61).

### Single language registry

`src/lib/languages.ts` is the one source of truth for per-language facts:
`LanguageConfig = { piston, version, filename, label }`, keyed by language code
(`python`, `c`). It exposes `getLanguageConfig(lang)` (silent fallback to Python for
unknown/blank values — execution can never break), `isSupportedLanguage(lang)` (strict
check for validating user input), and `SUPPORTED_LANGUAGES`. Adding a future language
(C++, Java, …) is one new entry here plus its Piston package in `piston-init`.

### Per-course binding, server-authoritative inheritance

- `courses.language` (`TEXT NOT NULL DEFAULT 'python'`) holds the course's language;
  it is chosen in the course create/edit form and validated server-side.
- A Problem **inherits** the course language: `problems.language` is set from
  `auth.course.language` on create **and** update — the client value is ignored. This
  keeps every Problem in a course consistent with how the course is taught, and is the
  single fact the runner reads at execution time.
- **Language lock:** a course's language may be changed freely only while it has **zero
  problems**; once problems exist the change is rejected (`canChangeCourseLanguage`,
  reusing the cascade-count helper that powers course deletion). Submitting the
  *current* language is never a "change", so editing names/program stays possible.
- Course duplication copies the source course's `language`.

### Compiled-language execution

`piston.ts` models the optional `compile` phase. `runTestCases(code, cases, language)`
and `runReferenceSolution(code, inputs, language)` resolve the runtime from the
registry; for a compiled language a non-zero `compile.code` means the source never ran
— the gcc diagnostics are surfaced as the error and, for `runTestCases`, the run
**short-circuits to a single compile-error result** instead of recompiling once per
test case. The grading module and grade route thread `problem.language` through.

### C is I/O-mode only

Unit mode stays Python-only. `validateProblemInput` rejects `problemType='unit'` for a
non-Python course (the route passes `auth.course.language`), and the Problem editor
hides the I/O / Unit toggle and the "สร้างด้วย AI" button in non-Python courses. AI
test-case generation for C is out of scope this release.

### Editor UX

`CodeEditor` / `SolutionEditor` take a `language` prop and select the CodeMirror
grammar (`c` → `@codemirror/lang-cpp`'s `cpp()`, else `python()`), toolbar label, and
placeholder via `src/components/editor/language-support.ts`. The Problem editor shows
the language **read-only** (it is the course's language, not a per-problem pick).

### Docker

The one-shot `piston-init` installs **both** Python `3.10.0` and `gcc`/`10.2.0`,
idempotently (an "already installed" response still resolves, so it exits 0 on every
re-`up`). Because Compose can't import the TS registry at runtime, the versions are
duplicated there; `languages.docker.test.ts` guards the two against drift.

## Consequences

**Positive**
- A course is taught in Python *or* C with no per-problem language wrangling; the whole
  pipeline (editor highlighting → submit → compile/run → per-test-case scoring →
  review) works for both.
- The registry localises every language fact; the per-course setting + inheritance make
  language a property of the course, not a thing each Problem (or the client) can get
  wrong.
- A fresh `docker compose up` grades C out of the box.

**Negative / costs**
- **Two places know the install/execute contract** — the registry and
  `docker-compose.yml` — kept honest only by `languages.docker.test.ts`. The `gcc`
  (install) vs `c` (execute) split is a genuine footgun documented at every relevant
  point.
- The language lock means a course taught in the wrong language after problems exist
  must be emptied (or duplicated) to switch — an accepted trade for consistency.
- C support is deliberately partial: **I/O mode only**, no Unit mode, no AI generation.

**Schema:** adds `courses.language` (`migrate-007-course-language.sql`); `problems.language`
already existed. No change to grading's scoring rules.
