# DEEP-QA Frontend — Design System

---

## 1. Brand Identity

| Property | Value |
|---|---|
| Product name | CE-Grader |
| Full name | Computer Engineering Python Grader |
| Organization | Computer Engineering / Faculty of Engineering, KMITL |
| Logo accent | สี่เหลี่ยมมุมโค้ง background `orange-500`, ตัวอักษร **CE** สีขาว |
| Brand tone | Professional, clean, minimal — ระบบการศึกษาเชิงวิชาการ |

---

## 2. Color Palette

### Brand Colors (custom Tailwind tokens)

| Token | Hex | การใช้งาน |
|---|---|---|
| `primary` | `#0F2A60` | Navbar background, primary buttons, page titles |
| `primary_hover` | `#0D2047` | hover state ของ primary button |
| `secondary` | `#003296` | Text links, secondary emphasis, content titles |
| `secondary_hover` | `#0039AA` | hover state ของ secondary elements |

### Background Colors

| บริเวณ | Color | Class |
|---|---|---|
| Login page (right panel) | `#FAFAFB` | bg-[#FAFAFB] |
| Login page (left/branding panel) | `#0F172A` | bg-[#0F172A] |
| Main app background | `#F8FAFC` | bg-[#F8FAFC] |
| Sidebar | White | bg-white |
| Loading screen | `#0B1120` | bg-[#0B1120] |
| Body (root) | Black | `#000000` |

### Semantic / State Colors

| การใช้งาน | Tailwind class |
|---|---|
| Active/selected menu | `bg-blue-50` + `text-blue-600` |
| Hover (sidebar items) | `hover:bg-blue-50` + `hover:text-primary` |
| Error / Danger | `text-red-600`, `bg-red-50`, `border-red-300` |
| Success | MUI `severity="success"` |
| Warning | MUI `severity="warning"` |

### Role Badge Colors (StatusTag)

| Role | Background | Text |
|---|---|---|
| FULL_ADMIN | `bg-indigo-100` | `text-indigo-800` |
| FACULTY_ADMIN | `bg-purple-100` | `text-purple-800` |
| DEPT_ADMIN | `bg-blue-100` | `text-secondary` |
| PROG_MANAGER | `bg-yellow-100` | `text-yellow-800` |
| TEACHER | `bg-green-100` | `text-green-800` |
| STUDENT | `bg-pink-100` | `text-pink-800` |
| GUEST | `bg-gray-100` | `text-gray-800` |

---

## 3. Typography

### Font Families

| ชื่อ | Font | Class | การใช้งาน |
|---|---|---|---|
| System UI | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto | (default body) | ทั่วไป |
| Thai | "Noto Sans Thai" | `font-thai` | ข้อความภาษาไทย |
| Code | source-code-pro, Menlo, Monaco, Consolas | `code` tag | Code snippets |

### Type Scale (ที่พบในโค้ด)

| Element | Class | ขนาด |
|---|---|---|
| Page hero heading | `text-5xl font-semibold leading-[1.1] tracking-tight` | ~48px |
| Login heading | `text-3xl font-bold tracking-tight sm:text-4xl` | 30–36px |
| Section title (ContentTitle) | `text-2xl font-medium` | 24px |
| Modal heading | `text-xl font-semibold` | 20px |
| Sub-heading | `text-lg font-semibold tracking-tight` | 18px |
| Body / dropdown item | `text-sm` | 14px |
| Caption / label | `text-xs` | 12px |
| Badge label | `text-xs uppercase tracking-widest` | 12px |

---

## 4. Spacing & Layout

### App Shell Layout

```
┌─────────────────────────────────────────────┐
│  Navbar (fixed, h-[64px], z-60)             │
├──────────────────┬──────────────────────────┤
│  Sidebar         │  Breadcrumb (sticky)     │
│  collapsed: 80px │─────────────────────────│
│  expanded: 320px │  Main Content            │
│                  │  px-4 py-6 lg:px-8      │
│                  │  max-w-[1920px]          │
└──────────────────┴──────────────────────────┘
```

### Login Page Layout (split screen)

```
┌────────────────────┬──────────────────────────────┐
│  Left 42%          │  Right 58%                   │
│  Branding panel    │  Login form                  │
│  bg-[#0F172A]      │  bg-[#FAFAFB]                │
│  (hidden < lg)     │  max-w-[400px] centered      │
└────────────────────┴──────────────────────────────┘
```

### Content Padding

| บริเวณ | Class |
|---|---|
| Main content area | `px-4 py-6 lg:px-8` |
| Cards / modals | `p-6` หรือ `p-8` |
| Navbar horizontal | `px-6` |
| Sidebar list | `px-3` |
| Menu items | `px-3 py-3` (top level), `px-4 py-2` (sub) |

---

## 5. Component Patterns

### Buttons

#### Primary Button
```jsx
<button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white 
  hover:bg-primary_hover focus:outline-none focus:ring-4 focus:ring-blue-300 
  transition-transform duration-100 active:scale-95">
  ข้อความปุ่ม
</button>
```

#### Secondary / Outline Button
```jsx
<button className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 
  transition hover:bg-gray-100 active:scale-95">
  ยกเลิก
</button>
```

#### Danger Button
```jsx
<button className="rounded-lg bg-red-600 px-4 py-2 text-white 
  transition hover:bg-red-700 active:scale-95">
  ลบ
</button>
```

#### Icon Button (circular)
```jsx
<button className="flex items-center justify-center rounded-full 
  transition-all hover:ring-2 hover:ring-white/50 active:scale-95">
  <FaUser className="text-white" />
</button>
```

> **Global rule:** ทุก `button` มี `transition-transform duration-100 active:scale-95` จาก Tailwind base layer

---

### Form Inputs

#### Text / Password Input
```jsx
<input
  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 
    px-4 py-3 text-sm transition 
    focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

#### Input with Prefix Icon
```jsx
<div className="flex">
  <span className="inline-flex items-center rounded-s-md border border-e-0 
    border-gray-300 px-3 text-sm text-gray-900">
    {/* icon */}
  </span>
  <input className="block w-full min-w-0 flex-1 rounded-none rounded-e-lg 
    border border-gray-300 p-2.5 text-sm text-gray-900 
    focus:outline-none focus:ring-2 focus:ring-blue-500" />
</div>
```

#### Form Label
```jsx
<label className="text-sm text-gray-500 uppercase tracking-wider">
  ชื่อ Field
</label>
```

---

### Cards & Modals

#### Standard Modal
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
  <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
    {/* content */}
  </div>
</div>
```

#### Large Modal (e.g. change password)
```jsx
<div className="relative w-full max-w-[500px] rounded-xl bg-white p-8 shadow-2xl">
```

#### Dropdown Menu
```jsx
<div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl 
  bg-white py-1 shadow-xl ring-1 ring-black ring-opacity-5 z-[100]">
  {/* menu items */}
</div>
```

#### Dropdown Menu Item
```jsx
<button className="flex w-full items-center gap-3 rounded-md px-3 py-2 
  text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-secondary">
  {/* icon + label */}
</button>
```

---

### Navbar

```jsx
<nav className="h-[64px] bg-primary px-6 shadow-sm backdrop-blur-md">
  <div className="mx-auto flex h-full items-center justify-between">
    {/* Left: Logo (w-1/3) */}
    {/* Center: Role Dropdown */}
    {/* Right: User Profile (w-1/3) */}
  </div>
</nav>
```

- User avatar: `h-10 w-10 rounded-full border-2 border-white/20`
- Username text: `text-white`
- Fixed + `z-[60]` + backdrop blur

---

### Sidebar

- Width: `80px` (collapsed) / `320px` (expanded) — animated ด้วย `framer-motion`
- Background: `bg-white`
- Border right: `border-r border-slate-100`
- Shadow: `shadow-[4px_0_24px_rgba(0,0,0,0.02)]`
- Toggle button: `-right-4 top-1/2` floating circle, bg-white, shadow-md

**Active menu item:** `bg-blue-50 text-blue-600`  
**Hover menu item:** `hover:bg-blue-50 hover:text-primary`  
**Sub-menu:** `ml-9 mt-1 border-l border-slate-100`

---

### Table

```jsx
<thead className="border border-t border-gray-200 bg-slate-100">
  <tr>
    <th className="whitespace-nowrap px-2 py-3 text-center">...</th>
  </tr>
</thead>
```

---

### Status / Role Badge

```jsx
<span className="inline-flex items-center rounded-full px-2.5 py-0.5 
  text-sm font-medium bg-green-100 text-green-800">
  อาจารย์
</span>
```

---

### Content Page Title

```jsx
<span className="inline-flex items-center text-2xl font-medium text-secondary">
  <Icon className="me-2 h-6 w-6 text-secondary" />
  ชื่อหน้า
</span>
```

---

### Loading Screen

```jsx
<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B1120]">
  {/* Ambient Glow */}
  <div className="absolute h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[160px]" />
  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-indigo-900/20" />
  
  {/* Spinner: border-t-white */}
  <div className="animate-spin rounded-full border-[6px] border-transparent border-t-white h-20 w-20" />
  
  {/* Bounce dots */}
  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" />
</div>
```

---

### Alert / Toast (MUI Snackbar)

```jsx
<Snackbar
  open={alert.open}
  autoHideDuration={5000}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
>
  <Alert severity={alert.severity} variant="filled" onClose={...}>
    {alert.message}
  </Alert>
</Snackbar>
```

---

### Delete Confirmation Dialog

```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
  <div className="mb-32 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
    <div className="flex items-center gap-3">
      <FaExclamationTriangle className="text-2xl text-red-500" />
      <h2 className="text-xl font-semibold text-red-500">ยืนยันการลบ</h2>
    </div>
    {/* buttons: ยกเลิก + ลบ */}
  </div>
</div>
```

---

## 6. Motion & Animation

### ContentMotionDIV (framer-motion — ใช้ทั่วทั้ง app)

```js
// initial → animate → exit
{ opacity: 0, y: -4 } → { opacity: 1, y: 0 } → { opacity: 0, y: -4 }
transition: { duration: 0.18, ease: [0.42, 0, 0.58, 1] }
```

> ใช้ wrap ทุกหน้าและ component ที่ต้องการ fade-in/out

### Sidebar Collapse Animation
```js
animate={{ width: isCollapsed ? '80px' : '320px' }}
// + toggle icon rotate:
animate={{ rotate: isCollapsed ? 180 : 0 }}
transition={{ duration: 0.2 }}
```

### Submenu Expand/Collapse
```js
initial={{ height: 0, opacity: 0 }}
animate={{ height: 'auto', opacity: 1 }}
exit={{ height: 0, opacity: 0 }}
```

### Global Button Press
```css
/* จาก Tailwind base layer */
button { @apply transition-transform duration-100 active:scale-95; }
```

### Loading Spinner
- `animate-spin` บน border-t spinner
- `animate-bounce` บน dot indicators  
- `animate-ping` บน ripple effect (`opacity-75`)

---

## 7. Glassmorphism / Depth Effects

| Component | Effect |
|---|---|
| Navbar (sticky) | `bg-white/80 backdrop-blur-md` |
| Breadcrumb bar | `bg-white/50 backdrop-blur-sm` |
| Dropdown overlay backdrop | `bg-black/50` |
| Login left panel glow | `bg-blue-600/10 blur-[120px]` |
| Loading screen glow | `bg-blue-600/10 blur-[160px]` |
| Login left gradient | `bg-gradient-to-br from-blue-900/20 via-transparent to-indigo-900/20` |

---

## 8. Border Radius Convention

| Element | Class |
|---|---|
| Primary buttons | `rounded-lg` |
| Input fields | `rounded-xl` |
| Cards / modals | `rounded-xl` |
| Dropdown menu | `rounded-xl` |
| Menu items | `rounded-xl` (top) / `rounded-lg` (sub) |
| Role badges | `rounded-full` |
| User avatar | `rounded-full` |
| Toggle button (sidebar) | `rounded-full` |

---

## 9. Shadow Convention

| Element | Class |
|---|---|
| Modal | `shadow-xl` หรือ `shadow-2xl` |
| Sidebar | `shadow-[4px_0_24px_rgba(0,0,0,0.02)]` |
| Toggle button | `shadow-md ring-1 ring-slate-200` |
| Dropdown | `shadow-xl ring-1 ring-black ring-opacity-5` |
| Spinner | `shadow-lg shadow-orange-500/20` |

---

## 10. Icon Library

ใช้ **react-icons** ทั่วทั้ง project:

```js
import { FaSignOutAlt, FaUser, FaBars, FaChevronDown, FaChevronLeft, FaExclamationTriangle } from 'react-icons/fa'
import { RiLockPasswordFill } from 'react-icons/ri'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { FaExternalLinkAlt } from 'react-icons/fa'
import { HiArrowsRightLeft } from 'react-icons/hi2'
```

Icon size ที่ใช้บ่อย: `size={18}` / `size={12}` / `size={10}`  
Class `text-[20px]` สำหรับ sidebar menu icons

---

## 11. Tech Stack (UI)

| Library | Version | การใช้งาน |
|---|---|---|
| React | 18.x | UI framework |
| Tailwind CSS | v3 | Utility-first styling |
| framer-motion | latest | Page/component animations |
| Material UI (MUI) | v7 | Alert, Snackbar, Dialog |
| @material-tailwind/react | latest | เสริม Tailwind components |
| react-icons | latest | Icon sets |
| react-router-dom | v6 | Routing + NavLink |

---

## 12. Breakpoints (Tailwind default)

| Breakpoint | Width |
|---|---|
| `sm` | ≥ 640px |
| `lg` | ≥ 1024px |

ใช้หลักๆ แค่ `sm:` และ `lg:` — ไม่มี `md:` / `xl:` ในโค้ด

---

## 13. Quick Reference — Reproducing the Look

เพื่อสร้าง UI ใหม่ที่มีสไตล์คล้ายเดิม ใช้สูตรนี้:

1. **สี**: dark navy primary (`#0F2A60`), medium blue secondary (`#003296`), white content area, light slate background (`#F8FAFC`)
2. **Navbar**: สูง 64px, สี primary, logo ซ้าย, user avatar ขวา
3. **Sidebar**: พื้นขาว, collapsible, active item สี blue-50/blue-600
4. **Cards**: `rounded-xl bg-white shadow-xl p-6`
5. **Buttons**: `rounded-lg`, primary color, `active:scale-95`
6. **Inputs**: `rounded-xl border-slate-200 bg-slate-50`, `focus:ring-blue-500`
7. **Animation**: ทุก element ใช้ `ContentMotionDIV` (opacity + y fade, 0.18s)
8. **Glassmorphism**: Navbar + breadcrumb ใช้ backdrop-blur
9. **Thai font**: ต้องโหลด Noto Sans Thai และใช้ class `font-thai`
10. **Icons**: react-icons package (fa, fi, ri, hi2)