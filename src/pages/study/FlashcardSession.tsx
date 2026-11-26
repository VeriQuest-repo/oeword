import { useEffect, useRef, useState } from "react";
import { OutlineButton, PrimaryButton, SubtleButton } from "../../components/ui";
import { useKeyboardInset } from "../../components/useKeyboardInset";
import { gradeEnKo, type WordGrade } from "../../lib/grading";
import type { StudyCard } from "../../lib/study";

/** 카드별 결과: 열쇠(wordKey) → 맞혔는지 */
export type SessionResult = Map<string, boolean>;

// 플래시카드 (영→한, #7). 영단어를 보고 품사별 입력칸에 뜻을 적으면 바로 채점하고 단어장 뜻을 보여 줍니다.
export default function FlashcardSession({
  cards,
  onFinish,
}: {
  cards: StudyCard[];
  onFinish: (result: SessionResult) => void;
}) {
  const [index, setIndex] = useState(0);
  const [result] = useState<SessionResult>(() => new Map());
  const card = cards[index]!;
  const last = index === cards.length - 1;
  const correctCount = [...result.values()].filter(Boolean).length;
  useKeyboardInset();

  function next(grade: WordGrade) {
    result.set(card.key, grade.correct);
    if (last) onFinish(result);
    else setIndex(index + 1);
  }

  return (
    // 키보드가 올라오면 그 높이만큼 아래 여백을 둬 마지막 버튼까지 올려 볼 수 있게 합니다 (#8).
    <div className="space-y-4 pb-[var(--keyboard-inset,0px)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-medium text-slate-600" aria-live="polite">
          {index + 1} / {cards.length}
          <span className="ml-3 text-slate-400">맞힘 {correctCount}</span>
        </p>
        <SubtleButton onClick={() => onFinish(result)}>그만하기</SubtleButton>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="진행"
        aria-valuemin={0}
        aria-valuemax={cards.length}
        aria-valuenow={index}
      >
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>
      <Flashcard key={`${index}-${card.key}`} card={card} last={last} onNext={next} />
    </div>
  );
}

function Flashcard({
  card,
  last,
  onNext,
}: {
  card: StudyCard;
  last: boolean;
  onNext: (grade: WordGrade) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(() => card.senses.map(() => ""));
  const [grade, setGrade] = useState<WordGrade | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const nextButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (grade) nextButton.current?.focus();
  }, [grade]);

  function check(giveUp = false) {
    setGrade(gradeEnKo(card.senses, giveUp ? [] : answers));
  }

  return (
    // 패드 가로(넓은 화면)는 왼쪽 영단어 · 오른쪽 입력칸, 세로·폰은 위아래로 놓습니다 (#8).
    <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-8 lg:grid lg:grid-cols-2 lg:gap-10">
      <div className="text-center lg:sticky lg:top-6 lg:flex lg:min-h-72 lg:flex-col lg:items-center lg:justify-center lg:self-start lg:rounded-2xl lg:bg-slate-50 lg:p-8">
        <p className="text-sm text-slate-400">{card.days.join(" · ")}</p>
        <h2 lang="en" className="mt-2 break-words text-4xl font-bold text-slate-900 sm:text-5xl lg:text-6xl">
          {card.text}
        </h2>
      </div>

      <form
        className="mt-6 space-y-5 lg:mt-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (grade) onNext(grade);
          else check();
        }}
      >
        {card.senses.map((sense, i) => {
          const result = grade?.senses[i];
          return (
            <div key={sense.pos}>
              <label htmlFor={`answer-${i}`} className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-700">
                <span className="rounded-lg bg-slate-100 px-2 py-0.5">{sense.pos}</span>
                {result && (
                  <span className={result.correct ? "text-emerald-600" : "text-rose-600"}>
                    {result.correct ? "맞음" : "틀림"}
                  </span>
                )}
              </label>
              <input
                id={`answer-${i}`}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={answers[i] ?? ""}
                readOnly={grade !== null}
                onChange={(e) => setAnswers((list) => list.map((a, j) => (j === i ? e.target.value : a)))}
                onKeyDown={(e) => {
                  // 마지막 칸이 아니면 Enter 로 다음 칸으로 갑니다.
                  if (e.key === "Enter" && !grade && i < card.senses.length - 1) {
                    e.preventDefault();
                    inputs.current[i + 1]?.focus();
                  }
                }}
                placeholder="뜻을 적어 보세요"
                // 펜슬 손글씨(아이패드 손글씨 입력)와 키보드 모두 그대로 받도록 자동 고침·대문자·추천을 끕니다.
                lang="ko"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint={i < card.senses.length - 1 ? "next" : "done"}
                className={`${answerClass} ${
                  result
                    ? result.correct
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-rose-400 bg-rose-50"
                    : "border-slate-300 bg-white"
                }`}
              />
              {result && (
                <p className="mt-2 rounded-xl bg-slate-50 px-4 py-2 text-lg text-slate-800">
                  <span className="mr-2 text-sm font-medium text-slate-500">단어장 뜻</span>
                  {result.meanings.join(", ")}
                </p>
              )}
            </div>
          );
        })}

        {grade && (
          <p
            role="status"
            className={`rounded-2xl px-4 py-3 text-center text-xl font-bold ${
              grade.correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {grade.correct ? "정답이에요!" : "다시 한번 보고 넘어가요"}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {grade ? (
            <PrimaryButton ref={nextButton} type="submit" className="sm:min-w-48">
              {last ? "결과 보기" : "다음 카드"}
            </PrimaryButton>
          ) : (
            <>
              <OutlineButton onClick={() => check(true)} className="min-h-14 sm:min-w-36">
                모르겠어요
              </OutlineButton>
              <PrimaryButton type="submit" className="sm:min-w-48">
                확인
              </PrimaryButton>
            </>
          )}
        </div>
      </form>
    </article>
  );
}

/** 펜슬로 쓰기 편한 큰 입력칸 (#8) */
const answerClass =
  "block min-h-16 w-full min-w-0 rounded-2xl border-2 px-4 text-2xl text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
