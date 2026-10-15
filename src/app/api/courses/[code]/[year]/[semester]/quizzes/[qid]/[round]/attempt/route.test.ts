import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PUT } from "./route"
import { POST as SUBMIT } from "./submit/route"
import { PUT as PUT_WINDOWS } from "../../windows/route"
import { courseFixture, setTestDb, sessionFor } from "@/lib/test-support/db"
import type { CourseFixture } from "@/lib/test-support/db"
import { seedQuiz, seedStudent, setWindow } from "@/lib/test-support/quiz"
import type { QuizDetail } from "@/lib/quizzes/repository"

describe("/api/courses/[code]/[year]/[semester]/quizzes/[qid]/[round]/attempt", () => {
  let f: CourseFixture
  let quiz: QuizDetail
  let student: { email: string }
  let qids: string[]

  function req(method: string, body?: unknown, email = student.email) {
    const r = new NextRequest("http://localhost/api/x", {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    r.cookies.set("session", sessionFor(email))
    return r
  }
  const ctx = (round = "pre", id: number = quiz.id) => ({
    params: Promise.resolve({
      code: f.course.code,
      year: String(f.course.year),
      semester: String(f.course.semester),
      qid: String(id),
      round,
    }),
  })

  const open = (email?: string) => GET(req("GET", undefined, email), ctx())
  const answer = (answers: Record<string, string | null>, email?: string) =>
    PUT(req("PUT", { answers }, email), ctx())
  const submit = (email?: string) => SUBMIT(req("POST", undefined, email), ctx())

  beforeEach(async () => {
    f = await courseFixture()
    setTestDb(f.db)
    quiz = await seedQuiz(f.db, f.course)
    qids = quiz.questions.map((q) => String(q.id))
    student = await seedStudent(f.db, f.course, "1")
    await setWindow(f.db, quiz.id, "pre", "1", "open")
  })
  afterEach(() => setTestDb(null))

  it("starts the attempt on first open and sends the questions without the key", async () => {
    const res = await open()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.state).toBe("open")
    expect(body.attempt).toMatchObject({ answers: {}, submitted: false, result: null })
    expect(body.quiz.questions).toHaveLength(3)
    const raw = JSON.stringify(body)
    expect(raw).not.toContain("correctLetter")
    expect(raw).not.toContain("เพราะ")
  })

  it("saves answers as the Student goes, merging each save", async () => {
    await answer({ [qids[0]]: "A" })
    const res = await answer({ [qids[1]]: "dont-know" })
    expect(res.status).toBe(200)
    expect((await res.json()).attempt.answers).toEqual({ [qids[0]]: "A", [qids[1]]: "dont-know" })
  })

  it("400s an answer that isn't one of the question's choices", async () => {
    expect((await answer({ [qids[0]]: "Z" })).status).toBe(400)
  })

  it("refuses to submit until every question is answered (ไม่ทราบ counts)", async () => {
    await answer({ [qids[0]]: "A", [qids[1]]: "dont-know" })
    expect((await submit()).status).toBe(400)

    await answer({ [qids[2]]: "A" })
    const res = await submit()
    expect(res.status).toBe(200)
    const { attempt } = await res.json()
    expect(attempt.submitted).toBe(true)
    expect(attempt.result.score).toBe(1)
    expect(attempt.result.outcomes.map((o: { outcome: string }) => o.outcome)).toEqual([
      "correct",
      "dont-know",
      "wrong",
    ])
    expect(JSON.stringify(attempt)).not.toContain("correctLetter")
  })

  it("a submitted attempt can't be changed or submitted again", async () => {
    await answer({ [qids[0]]: "A", [qids[1]]: "B", [qids[2]]: "C" })
    await submit()
    expect((await answer({ [qids[0]]: "B" })).status).toBe(403)
    expect((await submit()).status).toBe(403)
  })

  it("auto-submits with the saved answers once the Group's window closes", async () => {
    await answer({ [qids[0]]: "A" })
    await setWindow(f.db, quiz.id, "pre", "1", "closed")
    const res = await open()
    expect(res.status).toBe(200)
    const { state, attempt } = await res.json()
    expect(state).toBe("closed")
    expect(attempt.submitted).toBe(true)
    expect(attempt.result.score).toBe(1)
    expect(attempt.result.outcomes[2].outcome).toBe("unanswered")
    expect((await answer({ [qids[1]]: "B" })).status).toBe(403)
  })

  it("stays submitted when staff reopen the closed window (or clear it)", async () => {
    await answer({ [qids[0]]: "A" })
    await setWindow(f.db, quiz.id, "pre", "1", "closed")
    const reopen = (body: unknown) => PUT_WINDOWS(req("PUT", body, f.ins.email), ctx())
    expect((await reopen({ windows: [{ round: "pre", groupKey: "1", closesAt: null }] })).status).toBe(200)

    expect((await answer({ [qids[1]]: "B" })).status).toBe(403)
    const { state, attempt } = await (await open()).json()
    expect(state).toBe("open")
    expect(attempt).toMatchObject({ submitted: true, result: { score: 1 } })
  })

  it("refuses every write while the round isn't open for the Student's current Group", async () => {
    await setWindow(f.db, quiz.id, "post", "1", "closed") // keeps the Quiz visible
    await setWindow(f.db, quiz.id, "pre", "1", "not-open")
    expect((await answer({ [qids[0]]: "A" })).status).toBe(403)
    expect((await submit()).status).toBe(403)

    // Group 2's window is open, but this Student is in Group 1.
    await setWindow(f.db, quiz.id, "pre", "2", "open")
    expect((await answer({ [qids[0]]: "A" })).status).toBe(403)
  })

  it("a closed round with no attempt opens read-only, without starting one", async () => {
    await setWindow(f.db, quiz.id, "pre", "1", "closed")
    const body = await (await open()).json()
    expect(body).toMatchObject({ state: "closed", attempt: null })
  })

  it("404s a Quiz not yet opened for the Student's Group, and an unknown round", async () => {
    const other = await seedStudent(f.db, f.course, "2")
    expect((await open(other.email)).status).toBe(404)
    expect((await GET(req("GET"), ctx("mid"))).status).toBe(404)
  })

  it("is for enrolled Students only — staff preview instead", async () => {
    expect((await open(f.ins.email)).status).toBe(403)
    expect((await answer({ [qids[0]]: "A" }, f.ta.email)).status).toBe(403)
  })
})
