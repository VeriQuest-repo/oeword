import { useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import { ErrorText, Panel } from "../../components/ui";
import { DIRECTION_LABELS, MODE_LABELS, type TestSummary } from "../../lib/test";
import { testDateLabel } from "./TestResult";

// 지난 시험 (#11): 날짜·범위·점수. 누르면 결과를 다시 엽니다.
export default function TestHistory({
  studentId,
  title,
  refreshKey,
  onOpen,
}: {
  studentId: number;
  title: string;
  /** 바뀌면 목록을 다시 불러옵니다 (새 시험을 본 뒤) */
  refreshKey: number;
  onOpen: (testId: number) => void;
}) {
  const key = `${studentId}:${refreshKey}`;
  // 불러온 목록과 그 목록의 열쇠. 열쇠가 지금과 다르면 '불러오는 중'입니다.
  const [loaded, setLoaded] = useState<{ key: string; tests: TestSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const [id] = key.split(":");
    api
      .tests(Number(id))
      .then((res) => {
        if (alive) setLoaded({ key, tests: res.tests });
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [key]);

  const tests = loaded?.key === key ? loaded.tests : null;

  return (
    <Panel>
      <h2 className="mb-3 text-lg font-semibold text-slate-800">{title}</h2>
      <ErrorText message={error} />
      {tests === null ? (
        !error && <p className="text-base text-slate-400">불러오는 중…</p>
      ) : tests.length === 0 ? (
        <p className="text-base text-slate-600">아직 본 시험이 없어요.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tests.map((t) => {
            const perfect = t.correctCount === t.total;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-slate-800">
                      {t.testNumber}회 · {testDateLabel(t.createdAt)}
                    </span>
                    <span className="block break-words text-sm text-slate-500">
                      {t.dayLabels.join(" · ") || "범위 없음"} · {DIRECTION_LABELS[t.direction]}
                      {t.mode !== "full" && ` · ${MODE_LABELS[t.mode]}`}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xl font-bold ${perfect ? "text-emerald-700" : "text-slate-900"}`}
                  >
                    {t.correctCount}
                    <span className="text-base font-medium text-slate-400"> / {t.total}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
