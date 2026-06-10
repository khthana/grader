"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from "react-icons/fa"

type ToastType = "success" | "error" | "info"
interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  notify: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

const STYLES: Record<ToastType, { ring: string; icon: ReactNode }> = {
  success: { ring: "border-green-200", icon: <FaCheckCircle className="text-green-500" /> },
  error: { ring: "border-red-200", icon: <FaExclamationCircle className="text-red-500" /> },
  info: { ring: "border-slate-200", icon: <FaInfoCircle className="text-secondary" /> },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (type: ToastType, message: string) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => dismiss(id), 5000)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border ${STYLES[t.type].ring} bg-white px-4 py-3 text-sm shadow-xl`}
          >
            {STYLES[t.type].icon}
            <span className="font-thai text-slate-700">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-2 text-slate-400 hover:text-slate-600"
              aria-label="ปิด"
            >
              <FaTimes />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
