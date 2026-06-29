import { python } from "@codemirror/lang-python"
import { cpp } from "@codemirror/lang-cpp"
import { getLanguageConfig } from "@/lib/languages"

// Map a course/problem language to its CodeMirror language extension. C reuses
// the cpp() grammar (covers C). Anything else falls back to Python highlighting.
export function editorExtension(language: string) {
  return language === "c" ? cpp() : python()
}

// Human label for the editor toolbar (single-sourced from the registry).
export function editorLabel(language: string): string {
  return getLanguageConfig(language).label
}
