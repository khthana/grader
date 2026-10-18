import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CE-CodeClass",
  description: "ระบบตรวจและให้คะแนน Python code อัตโนมัติ",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
