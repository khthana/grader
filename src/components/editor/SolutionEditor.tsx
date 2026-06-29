"use client"

import dynamic from "next/dynamic"
import { editorExtension, editorLabel } from "./language-support"

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false })

interface Props {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  language?: string
}

export function SolutionEditor({
  value,
  onChange,
  label = "เฉลยอ้างอิง",
  placeholder,
  language = "python",
}: Props) {
  const langLabel = editorLabel(language)
  const ph = placeholder ?? `// เขียน ${langLabel} เฉลยของโจทย์ที่นี่...`
  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <div className="border-b border-gray-700/60 bg-[#1e1e2e] px-3 py-1.5">
        <span className="font-mono text-xs text-slate-400">{langLabel} — {label}</span>
      </div>
      <CodeMirror
        value={value}
        height="200px"
        theme="dark"
        extensions={[editorExtension(language)]}
        onChange={onChange}
        placeholder={ph}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          tabSize: 4,
        }}
      />
    </div>
  )
}
