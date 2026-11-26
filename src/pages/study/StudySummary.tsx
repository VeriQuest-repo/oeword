import { OutlineButton, Panel, PrimaryButton } from "../../components/ui";
import type { StudyCard } from "../../lib/study";
import type { SessionResult } from "./FlashcardSession";

// 외우기 결과: 맞힌 수, 틀린 단어와 단어장 뜻, 틀린 단어만 다시 (#7)
export default function StudySummary({
  cards,
  result,
  onRetry,
  onPickAgain,
}: {
  cards: StudyCard[];
  result: SessionResult;
  onRetry: (cards: StudyCard[]) => void;
  onPickAgain: () => void;
}) {
  const seen = cards.filter((c) => result.has(c.key));
  const wrong = seen.filter((c) => !result.get(c.key));
  const correct = seen.length - wrong.length;
  const unseen = cards.length - seen.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">외우기 결과</h1>
        <p className="mt-2 text-lg text-slate-700">
          {seen.length}단어 중 <strong className="text-emerald-700">{correct}개</strong> 맞혔어요
          {unseen > 0 && <span className="text-slate-500"> · 남은 카드 {unseen}개</span>}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {wrong.length > 0 && (
          <PrimaryButton type="button" onClick={() => onRetry(wrong)}>
            틀린 단어만 다시 ({wrong.length}개)
          </PrimaryButton>
        )}
        <OutlineButton onClick={() => onRetry(cards)} className="min-h-14">
          처음부터 다시
        </OutlineButton>
        <OutlineButton onClick={onPickAgain} className="min-h-14">
          범위 다시 고르기
        </OutlineButton>
      </div>

      {wrong.length > 0 ? (
        <Panel>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">다시 볼 단어</h2>
          <ul className="divide-y divide-slate-100">
            {wrong.map((c) => (
              <li key={c.key} className="py-3">
                <p lang="en" className="break-words text-xl font-bold text-slate-900">
                  {c.text}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {c.senses.map((s) => (
                    <li key={s.pos} className="text-base text-slate-700">
                      <span className="mr-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-sm">{s.pos}</span>
                      {s.meanings.join(", ")}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        seen.length > 0 && (
          <Panel>
            <p className="text-lg text-slate-700">모두 맞혔어요. 잘했어요!</p>
          </Panel>
        )
      )}
    </div>
  );
}
