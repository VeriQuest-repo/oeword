import { useState } from "react";
import { type StudyItem, wrongItems } from "../../lib/study";
import FlashcardSession, { type SessionResult } from "./FlashcardSession";
import RangePicker from "./RangePicker";
import StudySummary from "./StudySummary";

// 외우기 (#7): 범위·방향 고르기 → 플래시카드 → 틀린 단어가 없을 때까지 틀린 단어만 다시 → 결과
type Step =
  | { kind: "pick" }
  | { kind: "study"; all: StudyItem[]; cards: StudyItem[]; round: number }
  | { kind: "done"; all: StudyItem[]; cards: StudyItem[]; result: SessionResult; round: number; stopped: boolean };

export default function StudyPage() {
  const [step, setStep] = useState<Step>({ kind: "pick" });

  if (step.kind === "pick") {
    return <RangePicker onStart={(cards) => setStep({ kind: "study", all: cards, cards, round: 1 })} />;
  }
  if (step.kind === "study") {
    const finish = (result: SessionResult, stopped: boolean) =>
      setStep({ kind: "done", all: step.all, cards: step.cards, result, round: step.round, stopped });
    return (
      <FlashcardSession
        key={step.round}
        cards={step.cards}
        round={step.round}
        onFinish={(result) => finish(result, false)}
        onStop={(result) => finish(result, true)}
      />
    );
  }
  return (
    <StudySummary
      cards={step.cards}
      result={step.result}
      round={step.round}
      stopped={step.stopped}
      onRetryWrong={() =>
        setStep({ kind: "study", all: step.all, cards: wrongItems(step.cards, step.result), round: step.round + 1 })
      }
      onRestart={() => setStep({ kind: "study", all: step.all, cards: step.all, round: 1 })}
      onPickAgain={() => setStep({ kind: "pick" })}
    />
  );
}
