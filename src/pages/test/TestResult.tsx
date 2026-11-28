import { OutlineButton, Panel } from "../../components/ui";
import { DIRECTION_LABELS, durationLabel, type TestDetail } from "../../lib/test";

// 시험 결과 (#10): 점수와 문제별 맞음·틀림
export default function TestResult({ detail, onNewTest }: { detail: TestDetail; onNewTest: () => void }) {
  const wrong = detail.total - detail.correctCount;
  const took = durationLabel(detail.createdAt, detail.finishedAt);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-base text-slate-500">
          {detail.testNumber !== null && `${detail.testNumber}회 · `}
          {detail.dayLabels.join(" · ")} · {DIRECTION_LABELS[detail.direction]}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          {detail.total}문제 중 <span className="text-emerald-700">{detail.correctCount}개</span> 맞혔어요
        </h1>
        <p className="mt-2 text-lg text-slate-700">
          {wrong === 0 ? "모두 맞혔어요!" : `틀린 문제 ${wrong}개`}
          {took && <span className="text-slate-500"> · 걸린 시간 {took}</span>}
        </p>
        <p className="mt-1 text-base text-slate-500">
          {detail.id !== null ? "시험 기록에 남겼어요." : "보호자가 본 시험은 기록에 남지 않아요."}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <OutlineButton onClick={onNewTest} className="min-h-14 text-lg">
          새 시험 보기
        </OutlineButton>
      </div>

      <Panel>
        <ol className="divide-y divide-slate-100">
          {detail.items.map((item) => (
            <li key={item.position} className="flex items-baseline gap-3 py-3">
              <span className="w-8 shrink-0 text-right text-base text-slate-400">{item.position}</span>
              <span lang="en" className="min-w-0 flex-1 break-words text-xl font-bold text-slate-900">
                {item.text}
              </span>
              <span className={`shrink-0 text-lg font-bold ${item.correct ? "text-emerald-600" : "text-rose-600"}`}>
                {item.correct ? "맞음" : "틀림"}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
