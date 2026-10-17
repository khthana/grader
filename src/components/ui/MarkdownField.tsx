"use client"

import { useLayoutEffect, useRef, useState } from "react"
import type { IconType } from "react-icons"
import { FaBold, FaItalic, FaListOl, FaListUl } from "react-icons/fa"
import { MarkdownContent } from "./MarkdownContent"
import { applyFormat, type FormatKind, type TextSelection } from "./markdown-toolbar"

const TOOLS: { kind: FormatKind; label: string; icon: IconType }[] = [
  { kind: "bold", label: "ตัวหนา", icon: FaBold },
  { kind: "italic", label: "ตัวเอียง", icon: FaItalic },
  { kind: "bullet", label: "รายการแบบจุด", icon: FaListUl },
  { kind: "numbered", label: "รายการแบบตัวเลข", icon: FaListOl },
]

/**
 * A Markdown textarea with a formatting toolbar and เขียน / ดูตัวอย่าง tabs
 * (#98) — shared by the Problem description and the Syllabus. The toolbar's
 * transforms live in `markdown-toolbar.ts`; rendering is `MarkdownContent`.
 */
export function MarkdownField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [tab, setTab] = useState<"write" | "preview">("write")
  const textarea = useRef<HTMLTextAreaElement>(null)
  // The selection to restore once the formatted value has rendered.
  const pending = useRef<TextSelection | null>(null)

  useLayoutEffect(() => {
    const el = textarea.current
    if (!el || !pending.current) return
    el.focus()
    el.setSelectionRange(pending.current.start, pending.current.end)
    pending.current = null
  }, [value])

  function format(kind: FormatKind) {
    const el = textarea.current
    if (!el) return
    // The textarea's own value: the browser normalises line breaks to LF and
    // the selection offsets count against that, so a stored CRLF can't shift them.
    const result = applyFormat(el.value, { start: el.selectionStart, end: el.selectionEnd }, kind)
    if (result.text === el.value) return
    pending.current = result.selection
    onChange(result.text)
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab === t ? "bg-primary text-white" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "write" ? "เขียน" : "ดูตัวอย่าง"}
          </button>
        ))}
        {tab === "write" && (
          <div className="ml-auto flex gap-0.5">
            {TOOLS.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                title={label}
                aria-label={label}
                // Keep the textarea's selection: don't let the button take focus.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => format(kind)}
                className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === "write" ? (
        <textarea
          ref={textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder={placeholder}
          className="input-base w-full resize-y font-mono text-sm"
        />
      ) : (
        <div className="min-h-[144px] rounded-lg border border-gray-200 bg-slate-50 px-4 py-3">
          {value.trim() ? (
            <MarkdownContent content={value} />
          ) : (
            <span className="text-sm text-slate-400">ยังไม่มีเนื้อหา</span>
          )}
        </div>
      )}
    </div>
  )
}
