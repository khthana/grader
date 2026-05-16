# Grader Project

## Project Overview
ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ
นักศึกษาส่ง Python code เข้ามา ระบบจะรัน ตรวจสอบความถูกต้อง และให้คะแนนพร้อม feedback

## Tech Stack
- Next.js 16 + TypeScript
- Tailwind CSS
- Turbopack

## Commands
- `npm run dev` — start development server
- `npm run build` — build for production
- `npm run lint` — run ESLint

## Project Structure
- `src/app/` — App Router pages and layouts
- `src/components/` — shared components
- `src/app/api/` — API routes สำหรับรับ code และส่งผลการตรวจ

## Conventions
- ใช้ Server Components by default
- Client Components ต้องมี 'use client' เสมอ
- ชื่อไฟล์ component ใช้ PascalCase

## Core Features
- รับ Python code จากนักศึกษาผ่าน web interface
- รัน code ในสภาพแวดล้อมที่ปลอดภัย (sandbox)
- ตรวจสอบผลลัพธ์เทียบกับ test cases
- ให้คะแนนและ feedback อัตโนมัติ

## Tech Stack
- Next.js 16 + TypeScript
- Tailwind CSS
- Turbopack
- Piston API — sandbox สำหรับรัน Python code

## Project Structure
- `src/app/` — App Router pages and layouts
- `src/app/api/grade/` — API route รับ code และส่งไป Piston
- `src/app/api/problems/` — API route จัดการโจทย์
- `src/app/problems/` — หน้าแสดงโจทย์และส่ง code
- `src/components/editor/` — code editor component
- `src/components/ui/` — shared UI components
- `src/lib/` — utility functions เช่น Piston client
- `src/types/` — TypeScript type definitions