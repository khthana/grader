"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { python } from "@codemirror/lang-python"
import { FaCog } from "react-icons/fa"
import type { GradeResult } from "@/types"

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false })

type Theme = "dark" | "light"
type FontSize = 13 | 15 | 17
type TabSize = 2 | 4

interface CodeEditorProps {
  problemId: number
  draftKey?: string
  isClosed?: boolean
  starterCode?: string
}

function useEditorPrefs() {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [fontSize, setFontSizeState] = useState<FontSize>(15)
  const [tabSize, setTabSizeState] = useState<TabSize>(4)

  useEffect(() => {
    setThemeState((localStorage.getItem("editor-theme") as Theme) ?? "dark")
    setFontSizeState((Number(localStorage.getItem("editor-font-size")) as FontSize) || 15)
    setTabSizeState((Number(localStorage.getItem("editor-tab-size")) as TabSize) || 4)
  }, [])

  function setTheme(v: Theme) {
    setThemeState(v)
    localStorage.setItem("editor-theme", v)
  }
  function setFontSize(v: FontSize) {
    setFontSizeState(v)
    localStorage.setItem("editor-font-size", String(v))
  }
  function setTabSize(v: TabSize) {
    setTabSizeState(v)
    localStorage.setItem("editor-tab-size", String(v))
  }

  return { theme, fontSize, tabSize, setTheme, setFontSize, setTabSize }
}

function PrefSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs text-slate-400">{label}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}

function SettingsPopover({
  theme, fontSize, tabSize, setTheme, setFontSize, setTabSize, onClose,
}: {
  theme: Theme; fontSize: FontSize; tabSize: TabSize
  setTheme: (v: Theme) => void; setFontSize: (v: FontSize) => void; setTabSize: (v: TabSize) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [onClose])

  function btnClass(active: boolean) {
    return `rounded px-2.5 py-1 text-xs font-medium transition ${
      active
        ? "bg-primary text-white"
        : "border border-gray-600 text-slate-300 hover:border-primary hover:text-white"
    }`
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-20 w-52 rounded-xl border border-gray-700 bg-[#1e1e2e] p-4 shadow-xl"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">ตั้งค่า Editor</p>
      <PrefSection label="ธีม">
        {(["dark", "light"] as Theme[]).map((v) => (
          <button key={v} className={btnClass(theme === v)} onClick={() => setTheme(v)}>
            {v === "dark" ? "Dark" : "Light"}
          </button>
        ))}
      </PrefSection>
      <PrefSection label="ขนาดตัวอักษร">
        {([13, 15, 17] as FontSize[]).map((s) => (
          <button key={s} className={btnClass(fontSize === s)} onClick={() => setFontSize(s)}>{s}</button>
        ))}
      </PrefSection>
      <PrefSection label="Tab size">
        {([2, 4] as TabSize[]).map((n) => (
          <button key={n} className={btnClass(tabSize === n)} onClick={() => setTabSize(n)}>{n}</button>
        ))}
      </PrefSection>
    </div>
  )
}

export function CodeEditor({ problemId, draftKey, isClosed = false, starterCode = "" }: CodeEditorProps) {
  const key = draftKey ?? `editor-code-${problemId}`
  const [code, setCode] = useState("")
  const [result, setResult] = useState<GradeResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<"run" | "submit" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const { theme, fontSize, tabSize, setTheme, setFontSize, setTabSize } = useEditorPrefs()

  useEffect(() => {
    const saved = localStorage.getItem(key)
    setCode(saved ?? starterCode)
  }, [key, starterCode])

  const handleChange = useCallback((value: string) => {
    setCode(value)
    localStorage.setItem(key, value)
  }, [key])

  const handleCloseSettings = useCallback(() => setShowSettings(false), [])

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
      {/* Code editor */}
      <div className="overflow-hidden rounded-lg border border-gray-700">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-700/60 bg-[#1e1e2e] px-3 py-1.5">
          <span className="font-mono text-xs text-slate-400">Python</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="rounded p-1 text-slate-400 transition hover:bg-gray-700 hover:text-slate-200"
              title="ตั้งค่า Editor"
            >
              <FaCog className="h-3.5 w-3.5" />
            </button>
            {showSettings && (
              <SettingsPopover
                theme={theme}
                fontSize={fontSize}
                tabSize={tabSize}
                setTheme={setTheme}
                setFontSize={setFontSize}
                setTabSize={setTabSize}
                onClose={handleCloseSettings}
              />
            )}
          </div>
        </div>

        <div style={{ fontSize: `${fontSize}px` }}>
          <CodeMirror
            value={code}
            height="256px"
            theme={theme}
            extensions={[python()]}
            onChange={handleChange}
            editable={!isClosed}
            placeholder="พิมพ์ Python code ของคุณที่นี่..."
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: true,
              tabSize,
            }}
          />
        </div>
      </div>

      {/* Buttons */}
      {isClosed ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          หมดเวลาส่งงานแล้ว — ไม่สามารถส่งคำตอบได้อีก
        </div>
      ) : (
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
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3">
          <div
            className={`rounded-lg border p-4 ${
              perfect
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-yellow-200 bg-yellow-50 text-yellow-800"
            }`}
          >
            <p className="text-2xl font-bold">
              ได้ {result.pointsEarned}/{result.pointsMax} คะแนน
            </p>
            <p className="mt-1 text-sm">{result.feedback}</p>
            {activeMode === "run" && (
              <p className="mt-1 text-xs opacity-60">* รันเฉพาะ test cases ที่แสดงได้</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {result.results.map((r, i) => (
              <div
                key={r.testCaseId}
                className={`rounded-lg border p-3 text-sm ${
                  r.passed
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <p className="font-semibold">
                  Test {i + 1}: {r.passed ? "ผ่าน ✓" : "ไม่ผ่าน ✗"}
                </p>
                {!r.passed && (
                  <div className="mt-2 flex flex-col gap-1 font-mono text-xs">
                    <p><span className="font-sans font-semibold text-slate-500">Expected:</span></p>
                    <pre className="whitespace-pre-wrap rounded bg-white/60 px-2 py-1">{r.expectedOutput}</pre>
                    <p><span className="font-sans font-semibold text-slate-500">Got:</span></p>
                    <pre className="whitespace-pre-wrap rounded bg-white/60 px-2 py-1">{r.actualOutput || "(ไม่มี output)"}</pre>
                    {r.error && <p className="text-orange-600"><span className="font-sans font-semibold">Error:</span> {r.error}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
