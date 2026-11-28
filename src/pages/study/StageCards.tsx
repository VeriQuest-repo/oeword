import { useEffect, useMemo, useRef, useState } from "react";
import { OutlineButton, PrimaryButton } from "../../components/ui";
import { SpeakButton } from "../../components/SpeakButton";
import { buildChoices } from "../../lib/choices";
import type { StudyCard, StudyItem } from "../../lib/study";

// 외우기 1단계 가리기·2단계 객관식 카드 (#43). 3단계 주관식은 FlashcardSession 의 카드입니다.

/** 문제 쪽: 영단어→뜻이면 영단어, 뜻→영단어면 품사별 뜻 */
export function Prompt({ card }: { card: StudyItem }) {
  return (
    <div className="text-center lg:sticky lg:top-6 lg:flex lg:min-h-72 lg:flex-col lg:items-center lg:justify-center lg:self-start lg:rounded-2xl lg:bg-slate-50 lg:p-8">
      <p className="text-sm text-slate-400">{card.days.join(" · ")}</p>
      {card.direction === "en_ko" ? (
        <>
          <h2 lang="en" className="mt-2 break-words text-4xl font-bold text-slate-900 sm:text-5xl lg:text-6xl">
            {card.text}
          </h2>
          <SpeakButton text={card.text} className="mt-4" />
        </>
      ) : (
        <Meanings card={card} className="mt-3 inline-block text-left text-2xl font-bold sm:text-3xl" />
      )}
    </div>
  );
}

function Meanings({ card, className = "" }: { card: StudyCard; className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {card.senses.map((s) => (
        <li key={s.pos} className="flex items-baseline gap-2 text-slate-900">
          <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-base font-semibold text-slate-700">
            {s.pos}
          </span>
          <span className="min-w-0 break-words">{s.meanings.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

/** 1단계 가리기: 답 칸을 누르면 보이고 다시 누르면 가려집니다. 학생이 '외움' / '못외움'을 직접 고릅니다. */
export function BlindCard({ card, onNext }: { card: StudyItem; onNext: (correct: boolean) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-8 lg:grid lg:grid-cols-2 lg:gap-10">
      <Prompt card={card} />
      <div className="mt-6 space-y-5 lg:mt-0">
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          className={`flex min-h-40 w-full items-center justify-center rounded-2xl border-2 px-4 py-6 text-center ${
            shown ? "border-indigo-300 bg-indigo-50" : "border-dashed border-slate-300 bg-slate-100"
          }`}
        >
          {shown ? (
            card.direction === "en_ko" ? (
              <Meanings card={card} className="text-left text-2xl font-semibold" />
            ) : (
              <span lang="en" className="break-words text-4xl font-bold text-slate-900">
                {card.text}
              </span>
            )
          ) : (
            <span className="text-xl font-semibold text-slate-500">눌러서 답 보기</span>
          )}
        </button>
        {shown && card.direction === "ko_en" && (
          <div className="flex justify-center">
            <SpeakButton text={card.text} />
          </div>
        )}
        <p className="text-center text-sm text-slate-400">{shown ? "다시 누르면 가려져요" : "떠올려 본 다음 눌러 보세요"}</p>
        <div className="grid grid-cols-2 gap-3">
          <OutlineButton onClick={() => onNext(false)} className="min-h-16 text-xl">
            못외움
          </OutlineButton>
          <PrimaryButton type="button" onClick={() => onNext(true)} className="min-h-16 text-xl">
            외움
          </PrimaryButton>
        </div>
      </div>
    </article>
  );
}

/** 2단계 객관식: 보기를 누르면 바로 맞음·틀림과 정답을 보여 줍니다. */
export function ChoiceCard({
  card,
  range,
  extra,
  last,
  onNext,
}: {
  card: StudyItem;
  range: readonly StudyCard[];
  extra: readonly StudyCard[];
  last: boolean;
  onNext: (correct: boolean) => void;
}) {
  const options = useMemo(() => buildChoices(card, card.direction, range, extra), [card, range, extra]);
  const [picked, setPicked] = useState<string | null>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const correct = picked === null ? null : options?.find((o) => o.key === picked)?.correct === true;

  useEffect(() => {
    if (picked !== null) nextButton.current?.focus();
  }, [picked]);

  return (
    <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-8 lg:grid lg:grid-cols-2 lg:gap-10">
      <Prompt card={card} />
      <div className="mt-6 space-y-4 lg:mt-0">
        {options === null ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-lg text-slate-600">
            보기를 만들 다른 단어가 없어요.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((o) => {
              const state =
                picked === null ? "idle" : o.correct ? "answer" : o.key === picked ? "wrong" : "dim";
              return (
                <button
                  key={o.key}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => setPicked(o.key)}
                  lang={card.direction === "ko_en" ? "en" : "ko"}
                  className={`min-h-20 break-words rounded-2xl border-2 px-4 py-3 text-left text-xl font-semibold ${
                    state === "answer"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : state === "wrong"
                        ? "border-rose-400 bg-rose-50 text-rose-900"
                        : state === "dim"
                          ? "border-slate-200 bg-white text-slate-400"
                          : "border-slate-300 bg-white text-slate-800 hover:border-indigo-400"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        {correct !== null && (
          <p
            role="status"
            className={`rounded-2xl px-4 py-3 text-center text-xl font-bold ${
              correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {correct ? "정답이에요!" : "초록색이 정답이에요"}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {options === null ? (
            <PrimaryButton type="button" onClick={() => onNext(true)} className="sm:min-w-48">
              {last ? "결과 보기" : "다음 카드"}
            </PrimaryButton>
          ) : picked !== null ? (
            <PrimaryButton ref={nextButton} type="button" onClick={() => onNext(correct === true)} className="sm:min-w-48">
              {last ? "결과 보기" : "다음 카드"}
            </PrimaryButton>
          ) : (
            <OutlineButton onClick={() => setPicked("")} className="min-h-14 sm:min-w-36">
              모르겠어요
            </OutlineButton>
          )}
        </div>
      </div>
    </article>
  );
}
