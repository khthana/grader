"use client"

import { useState } from "react"
import { GradeResult } from "@/types"

interface CodeEditorProps {
  problemId: string
}

export function CodeEditor({ problemId }: CodeEditorProps) {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<GradeResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!code.trim()) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, code, language: "python" }),
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

  return (
    <div className="flex flex-col gap-4">
      {/* Code Input */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="พิมพ์ Python code ของคุณที่นี่..."
        className="w-full h-64 p-4 font-mono text-sm bg-gray-900 text-green-400 
                   rounded-lg border border-gray-700 resize-none focus:outline-none 
                   focus:border-blue-500"
        spellCheck={false}
      />

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !code.trim()}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium
                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {isLoading ? "กำลังตรวจ..." : "ส่งคำตอบ"}
      </button>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3">
          {/* Score */}
          <div className={`p-4 rounded-lg border ${
            result.score === 100
              ? "bg-green-900/50 border-green-700 text-green-300"
              : "bg-yellow-900/50 border-yellow-700 text-yellow-300"
          }`}>
            <p className="text-2xl font-bold">{result.score}/100</p>
            <p className="text-sm mt-1">{result.feedback}</p>
          </div>

          {/* Test Cases */}
          <div className="flex flex-col gap-2">
            {result.results.map((r, i) => (
              <div
                key={r.testCaseId}
                className={`p-3 rounded-lg border text-sm font-mono ${
                  r.passed
                    ? "bg-green-900/30 border-green-700 text-green-300"
                    : "bg-red-900/30 border-red-700 text-red-300"
                }`}
              >
                <p className="font-semibold">
                  Test {i + 1}: {r.passed ? "ผ่าน" : "ไม่ผ่าน"}
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