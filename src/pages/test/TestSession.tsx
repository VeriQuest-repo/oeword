import { useEffect, useRef, useState } from "react";
import { ErrorText, OutlineButton, Panel, PrimaryButton, SubtleButton } from "../../components/ui";
import { useKeyboardInset } from "../../components/useKeyboardInset";
import { firstLetter, isBlank, type ItemAnswer, type TestQuestion } from "../../lib/test";
import { Prompt } from "../study/StageCards";
import type { TestDraft } from "./draft";

// 화면 시험 (#10): 문제 번호로 앞뒤를 오가며 풀고, 다 푼 뒤 한꺼번에 채점합니다.
// 시험 중에는 정답을 보여 주지 않습니다.
export default function TestSession({
  draft,
  submitting,
  error,
  onChange,
  onSubmit,
  onQuit,
}: {
  draft: TestDraft;
  submitting: boolean;
  error: string | null;
  onChange: (draft: TestDraft) => void;
  onSubmit: () => void;
  onQuit: () => void;
}) {
  const { plan, answers, index } = draft;
  const questions = plan.questions;
  const question = questions[index]!;
  const last = index === questions.length - 1;
  const answered = questions.filter((q) => !isBlank(answers[q.wordId])).length;
  const blanks = questions.length - answered;
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  useKeyboardInset();

  function go(next: number) {
    if (next < 0 || next >= questions.length) return;
    setConfirmSubmit(false);
    onChange({ ...draft, index: next });
    window.scrollTo({ top: 0 });
  }

  function setAnswer(answer: ItemAnswer) {
    onChange({ ...draft, answers: { ...answers, [question.wordId]: answer } });
  }

  function submit() {
    // 빈 문제가 있으면 한 번 더 눌러야 채점합니다.
    if (blanks > 0 && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    onSubmit();
  }

  const submitLabel = submitting
    ? "채점하는 중…"
    : confirmSubmit
      ? `빈 문제 ${blanks}개, 그래도 채점하기`
      : "채점하기";

  return (
    <div className="space-y-4 pb-[var(--keyboard-inset,0px)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-medium text-slate-600" aria-live="polite">
          <span className="whitespace-nowrap">
            {index + 1}번 / {questions.length}문제
          </span>
          <span className="ml-3 whitespace-nowrap text-slate-400">답한 문제 {answered}</span>
        </p>
        <SubtleButton
          className={`shrink-0 ${confirmQuit ? "bg-rose-50 text-rose-700" : ""}`}
          onClick={() => (confirmQuit ? onQuit() : setConfirmQuit(true))}
          onBlur={() => setConfirmQuit(false)}
        >
          {confirmQuit ? "정말 그만두기" : "그만두기"}
        </SubtleButton>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="답한 문제"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={answered}
      >
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${(answered / questions.length) * 100}%` }}
        />
      </div>

      <QuestionCard
        key={`${index}-${question.wordId}`}
        number={index + 1}
        question={question}
        hint={plan.firstLetterHint}
        answer={answers[question.wordId]}
        onAnswer={setAnswer}
        onDone={() => (last ? submit() : go(index + 1))}
      />

      <ErrorText message={error} />

      <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
        <OutlineButton disabled={index === 0} onClick={() => go(index - 1)} className="min-h-14 text-lg sm:min-w-36">
          ← 이전 문제
        </OutlineButton>
        {last ? (
          <PrimaryButton type="button" disabled={submitting} onClick={submit} className="sm:min-w-48">
            {submitLabel}
          </PrimaryButton>
        ) : (
          <PrimaryButton type="button" onClick={() => go(index + 1)} className="sm:min-w-48">
            다음 문제 →
          </PrimaryButton>
        )}
      </div>

      <Panel>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">문제 번호</h2>
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2">
          {questions.map((q, i) => {
            const done = !isBlank(answers[q.wordId]);
            return (
              <li key={q.wordId}>
                <button
                  type="button"
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`${i + 1}번${done ? " (답함)" : ""}`}
                  onClick={() => go(i)}
                  className={`min-h-12 w-full rounded-xl border text-base font-semibold ${
                    i === index
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : done
                        ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                        : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-slate-500">
            {blanks > 0 ? `아직 안 푼 문제 ${blanks}개` : "모든 문제에 답했어요"}
          </p>
          <PrimaryButton
            type="button"
            disabled={submitting}
            onClick={submit}
            className={confirmSubmit ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            {submitLabel}
          </PrimaryButton>
        </div>
      </Panel>
    </div>
  );
}

/** 펜슬로 쓰기 편한 큰 입력칸 (#8 과 같은 크기) */
const answerClass =
  "block min-h-16 w-full min-w-0 rounded-2xl border-2 border-slate-300 bg-white px-4 text-2xl text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

const inputProps = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;

function QuestionCard({
  number,
  question,
  hint,
  answer,
  onAnswer,
  onDone,
}: {
  number: number;
  question: TestQuestion;
  hint: boolean;
  answer: ItemAnswer | undefined;
  onAnswer: (answer: ItemAnswer) => void;
  /** 마지막 칸에서 Enter: 다음 문제로 (마지막 문제면 채점) */
  onDone: () => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus({ preventScroll: true });
  }, []);

  const byPos = typeof answer === "object" ? answer : {};
  const word = typeof answer === "string" ? answer : "";

  return (
    // 패드 가로(넓은 화면)는 왼쪽 문제 · 오른쪽 입력칸, 세로·폰은 위아래로 놓습니다 (#8).
    <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-8 lg:grid lg:grid-cols-2 lg:gap-10">
      <div>
        <p className="mb-2 text-center text-lg font-bold text-indigo-700 lg:text-left">{number}번</p>
        <Prompt card={question} />
      </div>
      <form
        className="mt-6 space-y-5 lg:mt-0"
        onSubmit={(e) => {
          e.preventDefault();
          onDone();
        }}
      >
        {question.direction === "en_ko" ? (
          question.senses.map((sense, i) => (
            <div key={sense.pos}>
              <label htmlFor={`test-answer-${i}`} className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-700">
                <span className="rounded-lg bg-slate-100 px-2 py-0.5">{sense.pos}</span>
              </label>
              <input
                id={`test-answer-${i}`}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={byPos[sense.pos] ?? ""}
                onChange={(e) => onAnswer({ ...byPos, [sense.pos]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && i < question.senses.length - 1) {
                    e.preventDefault();
                    inputs.current[i + 1]?.focus();
                  }
                }}
                placeholder="뜻을 적어 보세요"
                lang="ko"
                enterKeyHint={i < question.senses.length - 1 ? "next" : "done"}
                className={answerClass}
                {...inputProps}
              />
            </div>
          ))
        ) : (
          <div>
            <label htmlFor="test-answer-word" className="mb-2 flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-700">
              영단어
              {hint && (
                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-base text-amber-900">
                  첫 글자 <b lang="en" className="text-xl">{firstLetter(question.text)}</b>
                </span>
              )}
            </label>
            <input
              id="test-answer-word"
              ref={(el) => {
                inputs.current[0] = el;
              }}
              value={word}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder={hint ? `${firstLetter(question.text)}로 시작해요` : "영단어를 적어 보세요"}
              lang="en"
              enterKeyHint="done"
              className={answerClass}
              {...inputProps}
            />
          </div>
        )}
        {/* Enter 로 넘어가게 하는 숨은 버튼 (보이는 버튼은 카드 아래에 있음) */}
        <button type="submit" className="sr-only" tabIndex={-1}>
          다음
        </button>
      </form>
    </article>
  );
}
