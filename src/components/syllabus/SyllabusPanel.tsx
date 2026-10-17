"use client"

import { useEffect, useState } from "react"
import { FaEdit } from "react-icons/fa"
import { useToast } from "@/components/shell/ToastProvider"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { MarkdownField } from "@/components/ui/MarkdownField"
import { isSyllabusEmpty, type Syllabus } from "@/lib/syllabus/draft"
import type { SyllabusStaff, SyllabusStaffMember } from "@/lib/syllabus/staff"

export interface SyllabusCourse {
  code: string
  nameTh: string
  nameEn: string
}

/**
 * The Syllabus page (#99): view mode for everyone linked to the course; a
 * course manager edits the whole page and saves it with one PUT.
 */
export function SyllabusPanel({
  courseSlug,
  course,
  staff,
  initialSyllabus,
  canEdit,
}: {
  courseSlug: string
  course: SyllabusCourse
  staff: SyllabusStaff
  initialSyllabus: Syllabus
  canEdit: boolean
}) {
  const { notify } = useToast()
  const [syllabus, setSyllabus] = useState(initialSyllabus)
  const [draft, setDraft] = useState<Syllabus | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(syllabus)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  async function save() {
    if (!draft) return
    setSaving(true)
    const res = await fetch(`/api/courses/${courseSlug}/syllabus`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).catch(() => null)
    const body = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (res?.ok) {
      setSyllabus(body.syllabus)
      setDraft(null)
      setErrors({})
      notify("success", "บันทึกประมวลรายวิชาแล้ว")
    } else {
      setErrors(body.errors ?? {})
      notify("error", body.error ?? "บันทึกไม่สำเร็จ")
    }
  }

  const set = (patch: Partial<Syllabus>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">ประมวลรายวิชา</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {course.code} · {course.nameTh}
          </p>
        </div>
        {canEdit && !draft && (
          <button
            onClick={() => setDraft(syllabus)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-hover"
          >
            <FaEdit className="h-3.5 w-3.5" />
            แก้ไข
          </button>
        )}
        {draft && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDraft(null)
                setErrors({})
              }}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        )}
      </div>

      <Section title="ข้อมูลทั่วไป">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">รหัสวิชา</dt>
          <dd className="text-slate-700">{course.code}</dd>
          <dt className="text-slate-500">ชื่อวิชา</dt>
          <dd className="text-slate-700">
            {course.nameTh}
            <span className="block text-slate-500">{course.nameEn}</span>
          </dd>
          <dt className="text-slate-500">หน่วยกิต</dt>
          <dd className="text-slate-700">
            {draft ? (
              <>
                <input
                  value={draft.credits}
                  onChange={(e) => set({ credits: e.target.value })}
                  placeholder="เช่น 3(2-2-5)"
                  className="input-base w-48"
                />
                <FieldError message={errors.credits} />
              </>
            ) : (
              syllabus.credits || "–"
            )}
          </dd>
          <dt className="text-slate-500">ผู้สอน</dt>
          <dd>
            <StaffList members={staff.instructors} />
          </dd>
          <dt className="text-slate-500">ผู้ช่วยสอน</dt>
          <dd>
            <StaffList members={staff.tas} />
          </dd>
        </dl>
        {draft && <p className="mt-3 text-xs text-slate-400">ผู้สอนและผู้ช่วยสอนมาจากรายชื่อผู้สอนของรายวิชา</p>}
      </Section>

      {draft ? (
        <>
          <Section title="คำอธิบายรายวิชา">
            <MarkdownField
              value={draft.description}
              onChange={(description) => set({ description })}
              placeholder="ภาพรวมสั้น ๆ ว่าวิชานี้เรียนเกี่ยวกับอะไร"
            />
            <FieldError message={errors.description} />
          </Section>
          <Section title="วัตถุประสงค์การเรียนรู้">
            <MarkdownField
              value={draft.objectives}
              onChange={(objectives) => set({ objectives })}
              placeholder={"เมื่อเรียนจบวิชานี้ ผู้เรียนสามารถ\n1. ...\n2. ..."}
            />
            <FieldError message={errors.objectives} />
          </Section>
        </>
      ) : isSyllabusEmpty(syllabus) ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
          ยังไม่มีประมวลรายวิชา
        </div>
      ) : (
        <>
          <TextSection title="คำอธิบายรายวิชา" content={syllabus.description} />
          <TextSection title="วัตถุประสงค์การเรียนรู้" content={syllabus.objectives} />
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 font-medium text-primary">{title}</h2>
      {children}
    </section>
  )
}

function TextSection({ title, content }: { title: string; content: string }) {
  return (
    <Section title={title}>
      {content ? <MarkdownContent content={content} /> : <p className="text-sm text-slate-400">–</p>}
    </Section>
  )
}

function StaffList({ members }: { members: SyllabusStaffMember[] }) {
  if (members.length === 0) return <span className="text-sm text-slate-400">–</span>
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {members.map((m) => (
        <li key={m.id} className="text-slate-700">
          {m.name}{" "}
          <a href={`mailto:${m.email}`} className="text-secondary hover:underline">
            {m.email}
          </a>
        </li>
      ))}
    </ul>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null
}
