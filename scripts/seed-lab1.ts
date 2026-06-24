// Seed Lab #1 (6 Python problems) into course 01076105/2569/2, Week 1.
// Natural-key schema. Run: DATABASE_URL=... npx tsx scripts/seed-lab1.ts
import { readFileSync } from "node:fs"
import { Pool } from "pg"
import { createProblem, setTestCases } from "../src/lib/problems/repository"
import { getWeekByNo } from "../src/lib/weeks/repository"
import type { TestCaseInput } from "../src/lib/problems/repository"

// Load .env.local if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch { /* rely on external DATABASE_URL */ }
}

const COURSE = { code: "01076105", year: 2569, semester: 2 }
const WEEK_NO = 1

const p1Output = [
  2002,2009,2016,2023,2037,2044,2051,2058,2072,2079,2086,2093,2107,2114,2121,
  2128,2142,2149,2156,2163,2177,2184,2191,2198,2212,2219,2226,2233,2247,2254,
  2261,2268,2282,2289,2296,2303,2317,2324,2331,2338,2352,2359,2366,2373,2387,
  2394,2401,2408,2422,2429,2436,2443,2457,2464,2471,2478,2492,2499,2506,2513,
  2527,2534,2541,2548,2562,2569,2576,2583,2597,2604,2611,2618,2632,2639,2646,
  2653,2667,2674,2681,2688,2702,2709,2716,2723,2737,2744,2751,2758,2772,2779,
  2786,2793,2807,2814,2821,2828,2842,2849,2856,2863,2877,2884,2891,2898,2912,
  2919,2926,2933,2947,2954,2961,2968,2982,2989,2996,3003,3017,3024,3031,3038,
  3052,3059,3066,3073,3087,3094,3101,3108,3122,3129,3136,3143,3157,3164,3171,
  3178,3192,3199,
].join(",")

interface SeedProblem {
  title: string
  description: string
  inputSpec: string
  outputSpec: string
  testCases: TestCaseInput[]
}

const problems: SeedProblem[] = [
  {
    title: "ตัวเลขหารด้วย 7 แต่ไม่หารด้วย 5",
    description:
      "จงเขียนโปรแกรมที่จะหาตัวเลขระหว่าง 2000-3200 ที่หารด้วย 7 ลงตัว แต่หารด้วย 5 ไม่ลงตัว",
    inputSpec: "ไม่มีข้อมูลนำเข้า",
    outputSpec: "แสดงตัวเลขทั้งหมดที่ตรงเงื่อนไขคั่นด้วยเครื่องหมาย , ในบรรทัดเดียว",
    testCases: [{ input: "", expectedOutput: p1Output, isHidden: false, score: 100, sortOrder: 1 }],
  },
  {
    title: "นับตัวอักษรพิมพ์เล็ก/ใหญ่",
    description:
      "ให้ตรวจสอบว่า String ที่รับเข้ามาผ่านคีย์บอร์ด เป็นตัวอักษรพิมพ์เล็กหรือตัวอักษรพิมพ์ใหญ่ อย่างละกี่ตัว",
    inputSpec: "มี 1 บรรทัด เป็น String ที่ประกอบด้วยตัวอักษรและช่องว่าง",
    outputSpec:
      "มี 2 บรรทัด บรรทัดที่ 1 เป็นจำนวนตัวอักษรพิมพ์เล็ก บรรทัดที่ 2 เป็นจำนวนตัวอักษรพิมพ์ใหญ่",
    testCases: [
      { input: "Hello World", expectedOutput: "8\n2", isHidden: false, score: 30, sortOrder: 1 },
      { input: "Python", expectedOutput: "5\n1", isHidden: true, score: 30, sortOrder: 2 },
      { input: "HELLO world", expectedOutput: "5\n5", isHidden: true, score: 40, sortOrder: 3 },
    ],
  },
  {
    title: "คำนวณค่าที่จอดรถ",
    description: `ให้รับเวลาเข้าและออกของรถคันหนึ่ง (เปิดบริการตั้งแต่ 7:00 - 23:00) จากนั้นคำนวณค่าที่จอดรถที่ต้องจ่าย โดยหลักเกณฑ์การคำนวณมีดังนี้
1) จอดรถไม่เกิน 15 นาที ไม่คิดค่าบริการ
2) จอดรถเกิน 15 นาที แต่ไม่เกิน 3 ชั่วโมง คิดค่าบริการชั่วโมงละ 10 บาท เศษของชั่วโมงคิดเป็นหนึ่งชั่วโมง
3) จอดรถตั้งแต่ 4 ชั่วโมง ถึง 6 ชั่วโมง คิดค่าบริการชั่วโมงที่ 4-6 ชั่วโมงละ 20 บาท เศษของชั่วโมงคิดเป็นหนึ่งชั่วโมง
4) จอดรถเกิน 6 ชั่วโมงขึ้นไป เหมาจ่ายวันละ 200 บาท`,
    inputSpec:
      "มี 1 บรรทัด แต่ละบรรทัดมีจำนวนเต็ม 4 จำนวนคั่นด้วย Space โดยตัวที่ 1-2 เป็นชั่วโมงและนาทีของเวลาเข้า และตัวที่ 3-4 เป็นชั่วโมงและนาทีของเวลาออก",
    outputSpec: "มีบรรทัดเดียว เป็นค่าที่จอดรถที่ต้องจ่าย ให้แสดงผลลัพธ์เป็นจำนวนเต็ม",
    testCases: [
      { input: "7 0 7 15", expectedOutput: "0", isHidden: false, score: 20, sortOrder: 1 },
      { input: "7 0 7 16", expectedOutput: "10", isHidden: false, score: 20, sortOrder: 2 },
      { input: "7 30 10 30", expectedOutput: "30", isHidden: true, score: 20, sortOrder: 3 },
      { input: "7 30 10 31", expectedOutput: "50", isHidden: true, score: 20, sortOrder: 4 },
      { input: "7 30 13 31", expectedOutput: "200", isHidden: true, score: 20, sortOrder: 5 },
    ],
  },
  {
    title: "a+aa+aaa+aaaa",
    description:
      "จงเขียนโปรแกรมที่คำนวณค่าของ a+aa+aaa+aaaa เมื่อรับข้อมูลเป็นตัวเลข 1 หลัก\nตัวอย่าง: Input 9 → Output 11106 (= 9+99+999+9999)",
    inputSpec: "มี 1 บรรทัด เป็นตัวเลข 1 หลัก (1-9)",
    outputSpec: "มี 1 บรรทัด เป็นผลบวก a+aa+aaa+aaaa",
    testCases: [
      { input: "9", expectedOutput: "11106", isHidden: false, score: 25, sortOrder: 1 },
      { input: "1", expectedOutput: "1234", isHidden: true, score: 25, sortOrder: 2 },
      { input: "3", expectedOutput: "3702", isHidden: true, score: 25, sortOrder: 3 },
      { input: "5", expectedOutput: "6170", isHidden: true, score: 25, sortOrder: 4 },
    ],
  },
  {
    title: "Palindrome จากตัวเลข 3 หลัก",
    description:
      "ตัวเลข palindrome คือตัวเลขที่อ่านได้ทั้ง 2 ทาง แล้วมีค่าเท่ากัน เช่น 9009 คือ palindrome ที่เกิดจากการคูณของตัวเลข 2 หลักที่มากที่สุด คือ 91×99 จงหา palindrome ที่มากที่สุดของตัวเลข 3 หลัก",
    inputSpec: "ไม่มีข้อมูลนำเข้า",
    outputSpec: "มี 1 บรรทัด เป็น palindrome ที่มากที่สุดที่เกิดจากผลคูณของตัวเลข 3 หลัก 2 จำนวน",
    testCases: [{ input: "", expectedOutput: "906609", isHidden: false, score: 100, sortOrder: 1 }],
  },
  {
    title: "รูปสามเหลี่ยม (Loop เดียว)",
    description:
      "จงเขียนโปรแกรมแสดงรูปสามเหลี่ยม (ตามโปรแกรมใน Slide 5) แต่ปรับปรุงให้ใช้ Loop เพียง Loop เดียว",
    inputSpec: "มี 1 บรรทัด เป็นจำนวนเต็มบวก n ความสูงของสามเหลี่ยม",
    outputSpec: "แสดงรูปสามเหลี่ยมโดยใช้เครื่องหมาย * จำนวน n แถว",
    testCases: [
      { input: "5", expectedOutput: "*\n**\n***\n****\n*****", isHidden: false, score: 33, sortOrder: 1 },
      { input: "3", expectedOutput: "*\n**\n***", isHidden: true, score: 33, sortOrder: 2 },
      { input: "1", expectedOutput: "*", isHidden: true, score: 34, sortOrder: 3 },
    ],
  },
]

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const week = await getWeekByNo(pool, COURSE, WEEK_NO)
    if (!week) throw new Error(`Week ${WEEK_NO} not found for ${COURSE.code}/${COURSE.year}/${COURSE.semester}`)

    const { rows: existing } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM problems WHERE week_id = $1::int`,
      [week.id]
    )
    if (existing[0].n > 0) {
      console.log(`• Week ${WEEK_NO} already has ${existing[0].n} problem(s) — aborting to avoid duplicates.`)
      return
    }

    for (const [i, prob] of problems.entries()) {
      const totalScore = prob.testCases.reduce((s, tc) => s + (tc.score ?? 0), 0)
      const created = await createProblem(pool, {
        courseCode: COURSE.code,
        courseYear: COURSE.year,
        courseSemester: COURSE.semester,
        weekId: week.id,
        title: prob.title,
        description: prob.description,
        inputSpec: prob.inputSpec,
        outputSpec: prob.outputSpec,
        score: totalScore,
        language: "python",
      })
      await setTestCases(pool, created.id, prob.testCases)
      console.log(`✓ Problem ${i + 1}: "${prob.title}" (id=${created.id}, no=${created.problemNo}, ${prob.testCases.length} tc, score=${totalScore})`)
    }
    console.log(`\nDone — ${problems.length} problems inserted into Week ${WEEK_NO}.`)
  } finally {
    await pool.end()
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
