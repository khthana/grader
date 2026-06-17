import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as XLSX from "xlsx"
import { splitThaiName, parseKmitlSheet } from "./kmitl"

describe("splitThaiName", () => {
  it("separates a prefix glued to the first name", () => {
    // KMITL sheets store the name as " นายอดิศร  วนาภรณ์"
    expect(splitThaiName(" นายอดิศร  วนาภรณ์")).toEqual({
      titleTh: "นาย",
      firstNameTh: "อดิศร",
      lastNameTh: "วนาภรณ์",
    })
  })

  it("prefers นางสาว over นาง", () => {
    expect(splitThaiName(" นางสาวเกตุแก้ว  ชมกลิ่น")).toEqual({
      titleTh: "นางสาว",
      firstNameTh: "เกตุแก้ว",
      lastNameTh: "ชมกลิ่น",
    })
  })

  it("leaves the prefix blank when the name has none", () => {
    expect(splitThaiName("สมชาย ใจดี")).toEqual({
      titleTh: "",
      firstNameTh: "สมชาย",
      lastNameTh: "ใจดี",
    })
  })
})

describe("parseKmitlSheet", () => {
  // A minimal slice mirroring the real report: page header noise, a
  // section/ตอน marker, the column-header row, then one data row.
  const sheet: unknown[][] = [
    ["สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง"],
    ["รหัสวิชา01076105", "", " ชื่อวิชา การเขียนโปรแกรมเชิงวัตถุ"],
    ["หน่วยกิต 2", "", "ตอน 18"],
    ["ลำดับที่", "รหัส น.ศ.", "ชื่อ-นามสกุล", "ลายเซ็น"],
    [1, "68010037", " นายกฤษกร  ขันสิงห์", ""],
  ]

  it("extracts a student row with its id, parsed name, and section as the group", () => {
    const students = parseKmitlSheet(sheet)
    expect(students).toEqual([
      {
        idCode: "68010037",
        titleTh: "นาย",
        firstNameTh: "กฤษกร",
        lastNameTh: "ขันสิงห์",
        studyGroup: "18",
      },
    ])
  })

  it("assigns each student the section in effect above them", () => {
    const multi: unknown[][] = [
      ["หน่วยกิต 2", "", "ตอน 0"],
      ["ลำดับที่", "รหัส น.ศ.", "ชื่อ-นามสกุล"],
      [1, "68015260", " นายอดิศร  วนาภรณ์"],
      ["หน่วยกิต 2", "", "ตอน 19"],
      ["ลำดับที่", "รหัส น.ศ.", "ชื่อ-นามสกุล"],
      [1, "68010071", " นายกันตภณ  กุศลเอี่ยม"],
      ["", "", "รวมจำนวนนักศึกษา", " 2  คน"],
    ]
    const students = parseKmitlSheet(multi)
    expect(students.map((s) => [s.idCode, s.studyGroup])).toEqual([
      ["68015260", "0"],
      ["68010071", "19"],
    ])
  })

  it("parses the real KMITL exam sheet end-to-end", () => {
    // Asserts structural invariants rather than an exact roster, so swapping in a
    // different real export (different course/sections) doesn't break the test.
    const path = fileURLToPath(
      new URL("../../../requirement/stdfinsec_2568-2-01076105.xls", import.meta.url)
    )
    const wb = XLSX.read(readFileSync(path))
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      blankrows: false,
      defval: "",
    })
    const students = parseKmitlSheet(aoa)

    // It reads real student rows out of the formatted report...
    expect(students.length).toBeGreaterThan(0)
    // ...each complete enough for import (id + first + last + a section group)...
    expect(
      students.every(
        (s) => /^\d{6,}$/.test(s.idCode) && s.firstNameTh !== "" && s.lastNameTh !== "" && s.studyGroup !== ""
      )
    ).toBe(true)
    // ...and the page-header / total rows are never mistaken for students.
    expect(students.some((s) => s.firstNameTh.includes("รวมจำนวน"))).toBe(false)
  })
})
