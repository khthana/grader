"use client"

import { useState } from "react"
import { GradeResult } from "@/types"

interface CodeEditorProps {
  problemId: number
}

export function CodeEditor({ problemId }: CodeEditorProps) {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<GradeResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<"run" | "submit" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGrade(mode: "run" | "submit") {
    if (!code.trim()) return
    setIsLoading(true)
    setActiveMode(mode)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, code, language: "python", mode }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด")
        return
      }
      setResult(data)
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้")
    } finally {
      setIsLoading(false)
    }
  }

  const perfect = result && result.pointsEarned === result.pointsMax

  return (
    <div className="flex flex-col gap-4 font-thai">
      {/* Code Input */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="พิมพ์ Python code ของคุณที่นี่..."
        className="h-64 w-full resize-none rounded-lg border border-gray-700 bg-gray-900
                   p-4 font-mono text-sm text-green-400 focus:border-blue-500 focus:outline-none"
        spellCheck={false}
      />

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleGrade("run")}
          disabled={isLoading || !code.trim()}
          className="rounded-lg border border-secondary px-5 py-2 text-sm font-medium text-secondary
                     transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && activeMode === "run" ? "กำลังรัน..." : "รันทดสอบ"}
        </button>
        <button
          onClick={() => handleGrade("submit")}
          disabled={isLoading || !code.trim()}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white
                     transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && activeMode === "submit" ? "กำลังส่ง..." : "ส่งคำตอบ"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/50 p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3">
          {/* Score banner */}
          <div
            className={`rounded-lg border p-4 ${
              perfect
                ? "border-green-700 bg-green-900/50 text-green-300"
                : "border-yellow-700 bg-yellow-900/50 text-yellow-300"
            }`}
          >
            <p className="text-2xl font-bold">
              ได้ {result.pointsEarned}/{result.pointsMax} คะแนน
            </p>
            <p className="mt-1 text-sm">{result.feedback}</p>
            {activeMode === "run" && (
              <p className="mt-1 text-xs opacity-75">* รันเฉพาะ test cases ที่แสดงได้</p>
            )}
          </div>

          {/* Test case results */}
          <div className="flex flex-col gap-2">
            {result.results.map((r, i) => (
              <div
                key={r.testCaseId}
                className={`rounded-lg border p-3 font-mono text-sm ${
                  r.passed
                    ? "border-green-700 bg-green-900/30 text-green-300"
                    : "border-red-700 bg-red-900/30 text-red-300"
                }`}
              >
                <p className="font-semibold">
                  Test {i + 1}: {r.passed ? "ผ่าน" : "ไม่ผ่าน"} ({r.score} คะแนน)
                </p>
                {!r.passed && (
                  <>
                    <p>Expected: {r.expectedOutput}</p>
                    <p>Got: {r.actualOutput || "(ไม่มี output)"}</p>
                    {r.error && <p className="text-yellow-400">Error: {r.error}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
