import { useState } from "react";
import { BackButton, OutlineButton, Panel, PrimaryButton } from "../../components/ui";
import { SpeakButton } from "../../components/SpeakButton";
import { DIRECTION_LABELS, durationLabel, MODE_LABELS, type TestDetail, type TestItemResult } from "../../lib/test";
import { PosTag } from "../study/StageCards";

/** 시험 날짜·시각. 예: "11월 28일 (토) 오후 9:40" */
export function testDateLabel(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// 시험 결과 (#10, #11): 점수, 문제별 내 답과 단어장 뜻, 틀린 단어만 다시 시험
export default function TestResult({
  detail,
  onRetryWrong,
  onBack,
  backLabel,
}: {
  detail: TestDetail;
  /** 틀린 단어만 다시 시험 (보호자가 아이 기록을 볼 때는 없음) */
  onRetryWrong?: () => void;
  onBack: () => void;
  backLabel: string;
}) {
  const wrong = detail.items.filter((it) => !it.correct);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const took = durationLabel(detail.createdAt, detail.finishedAt);
  const shown = onlyWrong ? wrong : detail.items;

  return (
    <div className="space-y-6">
      <div>
        <BackButton onClick={onBack}>{backLabel}</BackButton>
        <p className="text-base text-slate-500">
          {detail.testNumber !== null && `${detail.testNumber}회 · `}
          {testDateLabel(detail.createdAt)}
        </p>
        <p className="mt-0.5 text-base text-slate-500">
          {detail.dayLabels.join(" · ")} · {DIRECTION_LABELS[detail.direction]}
          {detail.mode !== "full" && ` · ${MODE_LABELS[detail.mode]}`}
          {detail.firstLetterHint && detail.direction !== "en_ko" && " · 첫 알파벳 힌트"}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          {detail.total}문제 중 <span className="text-emerald-700">{detail.correctCount}개</span> 맞혔어요
        </h1>
        <p className="mt-2 text-lg text-slate-700">
          {wrong.length === 0 ? "모두 맞혔어요!" : `틀린 문제 ${wrong.length}개`}
          {took && <span className="text-slate-500"> · 걸린 시간 {took}</span>}
        </p>
        {detail.id === null && <p className="mt-1 text-base text-slate-500">보호자가 본 시험은 기록에 남지 않아요.</p>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {onRetryWrong && wrong.length > 0 && (
          <PrimaryButton type="button" onClick={onRetryWrong}>
            틀린 단어만 다시 시험 ({wrong.length}개)
          </PrimaryButton>
        )}
        {wrong.length > 0 && (
          <OutlineButton aria-pressed={onlyWrong} onClick={() => setOnlyWrong((v) => !v)} className="min-h-14 text-lg">
            {onlyWrong ? "모든 문제 보기" : "틀린 문제만 보기"}
          </OutlineButton>
        )}
      </div>

      <ol className="space-y-3">
        {shown.map((item) => (
          <ItemRow key={item.position} item={item} />
        ))}
      </ol>
    </div>
  );
}

/** 문제 하나: 틀린 문제는 붉은 테두리로 강조하고, 내 답 옆에 단어장 뜻을 분명히 보여 줍니다. */
function ItemRow({ item }: { item: TestItemResult }) {
  return (
    <li>
      <Panel className={item.correct ? "" : "bg-rose-50/40 ring-2 ring-rose-300"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="shrink-0 text-base font-semibold text-slate-400">{item.position}</span>
            <span lang="en" className="min-w-0 break-words text-2xl font-bold text-slate-900">
              {item.text}
            </span>
            <SpeakButton text={item.text} small className="shrink-0 self-center" />
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-base font-bold ${
              item.correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {item.correct ? "맞음" : "틀림"}
          </span>
        </div>

        {item.direction === "en_ko" ? (
          <ul className="mt-3 space-y-3">
            {(item.senseGrades ?? []).map((g) => (
              <li key={g.pos} className="grid gap-1 sm:grid-cols-[auto_1fr_1fr] sm:items-baseline sm:gap-4">
                <PosTag pos={g.pos} className="sm:min-w-12" />
                <Answer label="내 답" text={g.answer} correct={g.correct} />
                <Book label="단어장 뜻" text={g.meanings.join(", ")} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 space-y-2">
            <ul className="space-y-1">
              {item.senses.map((s) => (
                <li key={s.pos} className="flex items-baseline gap-2 text-lg text-slate-700">
                  <PosTag pos={s.pos} />
                  <span className="min-w-0 break-words">{s.meanings.join(", ")}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-1 sm:grid-cols-2 sm:gap-4">
              <Answer label="내 답" text={typeof item.answer === "string" ? item.answer : ""} correct={item.correct} english />
              <Book label="단어장 영단어" text={item.text} english />
            </div>
          </div>
        )}
      </Panel>
    </li>
  );
}

function Answer({ label, text, correct, english }: { label: string; text: string; correct: boolean; english?: boolean }) {
  const blank = text.trim() === "";
  return (
    <p className="min-w-0 break-words text-lg">
      <span className="mr-2 text-sm font-medium text-slate-500">{label}</span>
      <span
        lang={english ? "en" : "ko"}
        className={blank ? "text-slate-400" : correct ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}
      >
        {blank ? "(빈칸)" : text}
      </span>
    </p>
  );
}

function Book({ label, text, english }: { label: string; text: string; english?: boolean }) {
  return (
    <p className="min-w-0 break-words rounded-xl bg-slate-50 px-3 py-1.5 text-lg text-slate-900">
      <span className="mr-2 text-sm font-medium text-slate-500">{label}</span>
      <span lang={english ? "en" : "ko"} className="font-semibold">
        {text}
      </span>
    </p>
  );
}
