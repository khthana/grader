import { FaCheck } from "react-icons/fa"
import { DONT_KNOW_TEXT, dontKnowLetter, type QuizQuestionDraft } from "@/lib/quizzes/import"

/**
 * Staff view of a Quiz's questions with the answer key: the correct choice is
 * marked and the explanation shown. Never render this for students.
 */
export function QuizQuestionList({
  questions,
  dontKnowEnabled,
}: {
  questions: QuizQuestionDraft[]
  dontKnowEnabled: boolean
}) {
  return (
    <ol className="flex flex-col gap-4">
      {questions.map((q, i) => (
        <li key={i} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-primary">ข้อ {i + 1}.</span>
            {q.topic && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{q.topic}</span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{q.prompt}</p>
          {q.code && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">
              {q.code}
            </pre>
          )}
          <ul className="mt-3 flex flex-col gap-1.5">
            {q.choices.map((c) => {
              const correct = c.letter === q.correctLetter
              return (
                <li
                  key={c.letter}
                  className={`flex items-start gap-2 rounded-lg px-3 py-1.5 text-sm ${
                    correct ? "bg-green-50 text-green-800" : "text-slate-600"
                  }`}
                >
                  <span className="font-medium">{c.letter}.</span>
                  <span className="flex-1 whitespace-pre-wrap">{c.text}</span>
                  {correct && <FaCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />}
                </li>
              )
            })}
            {dontKnowEnabled && (
              <li className="flex items-start gap-2 px-3 py-1.5 text-sm italic text-slate-400">
                <span className="font-medium">{dontKnowLetter(q.choices)}.</span>
                <span>{DONT_KNOW_TEXT}</span>
              </li>
            )}
          </ul>
          {q.feedback && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-slate-500">
              <span className="font-medium text-slate-600">คำอธิบาย: </span>
              {q.feedback}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
