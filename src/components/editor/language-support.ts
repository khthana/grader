import { python } from "@codemirror/lang-python"
import { cpp } from "@codemirror/lang-cpp"
import { DEFAULT_LANGUAGE, getLanguageConfig } from "@/lib/languages"

type LanguageSupport = ReturnType<typeof python>

// CodeMirror grammar per registry language. Kept out of the pure registry
// (`@/lib/languages`) so server code never pulls in CodeMirror; the
// language-support test fails if a registry language is missing here (#68).
// C reuses the cpp() grammar (covers C).
const GRAMMARS: Record<string, () => LanguageSupport> = {
  python: python,
  c: cpp,
}

export function hasEditorGrammar(language: string): boolean {
  return Object.prototype.hasOwnProperty.call(GRAMMARS, language)
}

// Map a course/problem language to its CodeMirror language extension; an
// unknown value falls back to the default language's highlighting.
export function editorExtension(language: string): LanguageSupport {
  return (GRAMMARS[language] ?? GRAMMARS[DEFAULT_LANGUAGE])()
}

// Human label for the editor toolbar (single-sourced from the registry).
export function editorLabel(language: string): string {
  return getLanguageConfig(language).label
}
