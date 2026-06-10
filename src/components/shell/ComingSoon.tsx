import type { ReactNode } from "react"
import { MenuIcon } from "./icons"

export function PageTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center text-2xl font-medium text-secondary">
      <MenuIcon name={icon} className="me-2 h-6 w-6 text-secondary" />
      {children}
    </span>
  )
}

export function ComingSoon({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="font-thai">
      <PageTitle icon={icon}>{title}</PageTitle>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <MenuIcon name={icon} className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-medium text-slate-500">อยู่ระหว่างการพัฒนา</p>
        <p className="text-sm text-slate-400">ฟีเจอร์นี้จะเปิดให้ใช้งานในเร็ว ๆ นี้</p>
      </div>
    </div>
  )
}
