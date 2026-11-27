import { OutlineButton, Panel, PrimaryButton } from "../../components/ui";
import type { StudyItem, StudyStage } from "../../lib/study";
import type { SessionResult } from "./FlashcardSession";
import type { SaveState } from "./StudyPage";

// 한 바퀴가 끝난 뒤 화면 (#7): 틀린 단어가 있으면 그 단어만 다시 외우게 하고,
// 모두 맞히면 끝(완료)입니다. "그만하기"로 멈춘 경우는 완료가 아닙니다.
export default function StudySummary({
  stage,
  cards,
  result,
  round,
  stopped,
  save,
  onRetryWrong,
  onRestart,
  onPickAgain,
}: {
  stage: StudyStage;
  cards: StudyItem[];
  result: SessionResult;
  round: number;
  stopped: boolean;
  save: SaveState;
  onRetryWrong: () => void;
  onRestart: () => void;
  onPickAgain: () => void;
}) {
  const seen = cards.filter((c) => result.has(c.key));
  const wrong = seen.filter((c) => !result.get(c.key));
  const correct = seen.length - wrong.length;
  const unseen = cards.length - seen.length;
  const left = wrong.length + unseen;
  const complete = !stopped && left === 0;
  const blind = stage === "blind";
  const wrongName = blind ? "못외운 단어" : "틀린 단어";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {complete ? "다 외웠어요!" : stopped ? "외우기를 멈췄어요" : `${wrongName} ${wrong.length}개가 남았어요`}
        </h1>
        <p className="mt-2 text-lg text-slate-700">
          {complete ? (
            round > 1 ? (
              `${wrongName}를 ${round - 1}번 다시 보고 모두 ${blind ? "외웠어요" : "맞혔어요"}.`
            ) : (
              blind ? "한 번에 모두 외웠어요." : "한 번에 모두 맞혔어요."
            )
          ) : (
            <>
              {seen.length}단어 중 <strong className="text-emerald-700">{correct}개</strong> {blind ? "외웠어요" : "맞혔어요"}
              {unseen > 0 && <span className="text-slate-500"> · 안 본 카드 {unseen}개</span>}
              {!stopped && ` · ${wrongName}만 다시 봐요`}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {left > 0 && (
          <PrimaryButton type="button" onClick={onRetryWrong}>
            {stopped ? `남은 단어 이어서 (${left}개)` : `${wrongName} 다시 (${left}개)`}
          </PrimaryButton>
        )}
        <OutlineButton onClick={onRestart} className="min-h-14">
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
        complete && (
          <Panel>
            <p className="text-lg text-slate-700">잘했어요! 다음 단계나 다른 방향으로도 해 보세요.</p>
            {save !== "skip" && (
              <p className={`mt-2 text-base ${typeof save === "object" ? "text-rose-600" : "text-slate-500"}`}>
                {save === "saving"
                  ? "완료 기록을 남기는 중…"
                  : save === "saved"
                    ? "완료 기록을 남겼어요. 외우기 화면의 Day에서 볼 수 있어요."
                    : `완료 기록을 남기지 못했어요. ${save.error}`}
              </p>
            )}
          </Panel>
        )
      )}
    </div>
  );
}
