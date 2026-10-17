import { describe, it, expect } from "vitest"
import { guardedHref, type GuardClick, type GuardAnchor } from "./navigation-guard"

const HERE = "http://localhost:3000/courses/C01/2567/1/syllabus"

const click = (over: Partial<GuardClick> = {}): GuardClick => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
})

const anchor = (href: string, over: Partial<GuardAnchor> = {}): GuardAnchor => ({
  href: new URL(href, HERE).href,
  target: "",
  download: false,
  ...over,
})

describe("guardedHref — which clicks leave the page inside the app (#104)", () => {
  it.each([
    ["a Sidebar link to another course page", click(), anchor("/courses/C01/2567/1/problems"), "/courses/C01/2567/1/problems"],
    ["keeps the query and hash", click(), anchor("/users?page=2#top"), "/users?page=2#top"],
    ["target=_self is the same tab", click(), anchor("/users", { target: "_self" }), "/users"],
    ["the same page with a query is another page", click(), anchor("/courses/C01/2567/1/syllabus?x=1"), "/courses/C01/2567/1/syllabus?x=1"],
  ])("guards %s", (_, c, a, expected) => {
    expect(guardedHref(c, a, HERE)).toBe(expected)
  })

  it.each([
    ["no link was clicked", click(), null],
    ["a middle click (new tab)", click({ button: 1 }), anchor("/users")],
    ["ctrl-click", click({ ctrlKey: true }), anchor("/users")],
    ["cmd-click", click({ metaKey: true }), anchor("/users")],
    ["shift-click", click({ shiftKey: true }), anchor("/users")],
    ["alt-click", click({ altKey: true }), anchor("/users")],
    ["a link opening a new tab", click(), anchor("/users", { target: "_blank" })],
    ["a download link", click(), anchor("/export.xlsx", { download: true })],
    ["another site (the browser's unload warning covers it)", click(), anchor("https://docs.python.org/3/")],
    ["mailto", click(), anchor("mailto:a@kmitl.ac.th")],
    ["the page itself", click(), anchor(HERE)],
    ["an anchor on the page itself", click(), anchor("#plan")],
  ])("lets through %s", (_, c, a) => {
    expect(guardedHref(c, a, HERE)).toBeNull()
  })
})
