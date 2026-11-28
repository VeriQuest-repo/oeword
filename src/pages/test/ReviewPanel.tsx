import { useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import { ChoiceButton, ErrorText, Panel, PrimaryButton } from "../../components/ui";
import { OLD_AFTER_DAYS, type ReviewWords } from "../../lib/review";
import { assignDirections, shuffle } from "../../lib/study";
import { DIRECTION_LABELS, type TestDirection } from "../../lib/test";
import type { TestPlan } from "./draft";

/** 학생의 다시 볼 단어를 불러옵니다. 열쇠가 바뀌면 다시 불러옵니다. */
export function useReviewWords(studentId: number | null, refreshKey = 0) {
  const key = studentId === null ? null : `${studentId}:${refreshKey}`;
  const [loaded, setLoaded] = useState<{ key: string; data: ReviewWords } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (key === null) return;
    let alive = true;
    const [id] = key.split(":");
    api
      .reviewWords(Number(id))
      .then((data) => {
        if (alive) setLoaded({ key, data });
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return { data: loaded?.key === key ? loaded.data : null, error };
}

/** "틀린 단어 3 · 오래 안 본 단어 2" */
export function reviewCountLabel(data: ReviewWords): string {
  const parts = [];
  if (data.wrongCount > 0) parts.push(`틀린 단어 ${data.wrongCount}개`);
  if (data.oldCount > 0) parts.push(`${OLD_AFTER_DAYS}일 넘게 안 본 단어 ${data.oldCount}개`);
  return parts.join(" · ");
}

const directions: TestDirection[] = ["en_ko", "ko_en", "mixed"];

// 다시 볼 단어 (#12): 시험에서 틀린 단어와 오래 안 본 단어를 모아 시험합니다.
export default function ReviewPanel({
  studentId,
  canTake,
  title,
  refreshKey,
  onStart,
}: {
  studentId: number;
  /** 학생 본인일 때만 시험을 볼 수 있습니다. 보호자는 목록만 봅니다. */
  canTake: boolean;
  title: string;
  refreshKey: number;
  onStart: (plan: TestPlan) => void;
}) {
  const { data, error } = useReviewWords(studentId, refreshKey);
  const [direction, setDirection] = useState<TestDirection>("en_ko");
  const [hint, setHint] = useState(true);

  function start() {
    if (!data || data.words.length === 0) return;
    onStart({
      mode: "review",
      direction,
      firstLetterHint: direction !== "en_ko" && hint,
      dayIds: data.dayIds,
      questions: assignDirections(shuffle(data.words), direction),
    });
  }

  return (
    <Panel className={data && data.words.length > 0 ? "ring-2 ring-amber-200" : ""}>
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <ErrorText message={error} />
      {data === null ? (
        !error && <p className="mt-2 text-base text-slate-400">불러오는 중…</p>
      ) : data.words.length === 0 ? (
        <p className="mt-2 text-base text-slate-600">
          지금은 다시 볼 단어가 없어요. 시험에서 틀린 단어와 {OLD_AFTER_DAYS}일 넘게 안 본 단어가 여기에 모여요.
        </p>
      ) : (
        <>
          <p className="mt-1 text-base text-slate-600">{reviewCountLabel(data)}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.words.map((w) => (
              <li
                key={w.key}
                lang="en"
                className={`rounded-xl px-3 py-1.5 text-base font-semibold ${
                  w.reason === "wrong" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-700"
                }`}
              >
                {w.text}
              </li>
            ))}
          </ul>
          {canTake && (
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {directions.map((d) => (
                  <ChoiceButton key={d} selected={direction === d} onClick={() => setDirection(d)} className="text-center!">
                    {DIRECTION_LABELS[d]}
                  </ChoiceButton>
                ))}
              </div>
              {direction !== "en_ko" && (
                <label className="flex min-h-12 items-center gap-3 text-base text-slate-700">
                  <input
                    type="checkbox"
                    checked={hint}
                    onChange={(e) => setHint(e.target.checked)}
                    className="size-6 shrink-0 accent-indigo-600"
                  />
                  한→영 문제에 첫 알파벳 보여 주기
                </label>
              )}
              <PrimaryButton type="button" onClick={start} className="w-full sm:w-auto">
                다시 볼 단어 시험 ({data.words.length}문제)
              </PrimaryButton>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
