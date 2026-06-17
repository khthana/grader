"use client"

import { useState } from "react"
import { FaUserSecret } from "react-icons/fa"

// Persistent banner shown while an Admin is impersonating another user. Clicking
// "ออกจากโหมด" hits the exit route, then hard-navigates to User Management so the
// restored Admin session re-renders the whole shell.
export function ImpersonationBanner({ userName }: { userName: string }) {
  const [exiting, setExiting] = useState(false)

  async function exit() {
    setExiting(true)
    try {
      await fetch("/api/users/impersonate/exit", { method: "POST" })
    } finally {
      window.location.href = "/users"
    }
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white font-thai">
      <FaUserSecret className="h-4 w-4 shrink-0" />
      <span>
        กำลังเข้าใช้งานในนาม <strong>{userName}</strong>
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-60"
      >
        {exiting ? "กำลังออก..." : "ออกจากโหมด"}
      </button>
    </div>
  )
}
