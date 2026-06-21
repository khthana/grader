"use client"

import dynamic from "next/dynamic"
import { python } from "@codemirror/lang-python"

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false })

interface Props {
  value: string
  onChange: (v: string) => void
}

export function SolutionEditor({ value, onChange }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <div className="border-b border-gray-700/60 bg-[#1e1e2e] px-3 py-1.5">
        <span className="font-mono text-xs text-slate-400">Python — เฉลยอ้างอิง</span>
      </div>
      <CodeMirror
        value={value}
        height="200px"
        theme="dark"
        extensions={[python()]}
        onChange={onChange}
        placeholder="# เขียน Python เฉลยของโจทย์ที่นี่..."
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
