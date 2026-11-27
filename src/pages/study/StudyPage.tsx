import { useState } from "react";
import { type StudyCard, type StudyItem, type StudyStage, wrongItems } from "../../lib/study";
import FlashcardSession, { type SessionResult } from "./FlashcardSession";
import RangePicker, { type StudyPlan } from "./RangePicker";
import StudySummary from "./StudySummary";

// 외우기 (#7, #42, #43): 범위·방향·단계 고르기 → 카드 → 틀린(못외운) 카드가 없을 때까지 그 카드만 다시 → 결과
interface Session {
  stage: StudyStage;
  all: StudyItem[];
  range: StudyCard[];
  extra: StudyCard[];
}
type Step =
  | { kind: "pick" }
  | { kind: "study"; session: Session; cards: StudyItem[]; round: number }
  | { kind: "done"; session: Session; cards: StudyItem[]; result: SessionResult; round: number; stopped: boolean };

export default function StudyPage() {
  const [step, setStep] = useState<Step>({ kind: "pick" });

  if (step.kind === "pick") {
    return (
      <RangePicker
        onStart={(plan: StudyPlan) => setStep({ kind: "study", session: plan, cards: plan.all, round: 1 })}
      />
    );
  }
  const { session } = step;
  if (step.kind === "study") {
    const finish = (result: SessionResult, stopped: boolean) =>
      setStep({ kind: "done", session, cards: step.cards, result, round: step.round, stopped });
    return (
      <FlashcardSession
        key={step.round}
        cards={step.cards}
        stage={session.stage}
        range={session.range}
        extra={session.extra}
        round={step.round}
        onFinish={(result) => finish(result, false)}
        onStop={(result) => finish(result, true)}
      />
    );
  }
  return (
    <StudySummary
      stage={session.stage}
      cards={step.cards}
      result={step.result}
      round={step.round}
      stopped={step.stopped}
      onRetryWrong={() =>
        setStep({ kind: "study", session, cards: wrongItems(step.cards, step.result), round: step.round + 1 })
      }
      onRestart={() => setStep({ kind: "study", session, cards: session.all, round: 1 })}
      onPickAgain={() => setStep({ kind: "pick" })}
    />
  );
}
