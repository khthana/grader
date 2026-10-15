import { describe, it, expect } from "vitest"
import { roundWindow, windowsOverlap, type WindowTimes } from "./round-window"

const t = (hhmm: string) => new Date(`2026-10-20T${hhmm}:00.000Z`)
const w = (opensAt: string | null, closesAt: string | null): WindowTimes => ({
  opensAt: opensAt ? t(opensAt) : null,
  closesAt: closesAt ? t(closesAt) : null,
})

describe("roundWindow", () => {
  it.each([
    ["never opened (no open instant)", w(null, null), "09:00", "not-open"],
    ["a close instant alone never opens it", w(null, "10:00"), "09:00", "not-open"],
    ["before the open instant", w("09:00", "10:00"), "08:59", "not-open"],
    ["exactly at the open instant", w("09:00", "10:00"), "09:00", "open"],
    ["between open and close", w("09:00", "10:00"), "09:30", "open"],
    ["exactly at the close instant", w("09:00", "10:00"), "10:00", "closed"],
    ["after the close instant", w("09:00", "10:00"), "11:00", "closed"],
    ["open with no close instant never closes", w("09:00", null), "23:59", "open"],
  ])("%s → %s", (_label, window, now, expected) => {
    expect(roundWindow(window, t(now))).toBe(expected)
  })
})

describe("windowsOverlap", () => {
  it.each([
    ["Post after Pre", w("09:00", "10:00"), w("11:00", "12:00"), false],
    ["Post starting exactly when Pre closes", w("09:00", "10:00"), w("10:00", "11:00"), false],
    ["Post starting before Pre closes", w("09:00", "10:00"), w("09:59", "11:00"), true],
    ["one inside the other", w("09:00", "12:00"), w("10:00", "11:00"), true],
    ["an open-ended Pre and a later Post", w("09:00", null), w("11:00", "12:00"), true],
    ["an open-ended Post after a closed Pre", w("09:00", "10:00"), w("10:00", null), false],
    ["a never-opened window overlaps nothing", w(null, null), w("09:00", null), false],
    ["a never-opened window with only a close", w(null, "12:00"), w("09:00", "10:00"), false],
  ])("%s → %s", (_label, a, b, expected) => {
    expect(windowsOverlap(a, b)).toBe(expected)
    expect(windowsOverlap(b, a)).toBe(expected)
  })
})
