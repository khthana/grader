import type { IconType } from "react-icons"
import {
  FaUsersCog,
  FaUserGraduate,
  FaCode,
  FaClipboardCheck,
  FaBook,
  FaTasks,
  FaRegCircle,
} from "react-icons/fa"

// Maps the string `icon` keys from the role-resolution menu config to components,
// keeping src/lib/roles.ts free of React imports (and unit-testable).
const ICONS: Record<string, IconType> = {
  users: FaUsersCog,
  students: FaUserGraduate,
  problems: FaCode,
  review: FaClipboardCheck,
  gradebook: FaBook,
  assignments: FaTasks,
}

export function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? FaRegCircle
  return <Icon className={className} />
}
