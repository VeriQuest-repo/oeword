import { useState } from "react";
import { type StudyCard } from "../../lib/study";
import FlashcardSession, { type SessionResult } from "./FlashcardSession";
import RangePicker from "./RangePicker";
import StudySummary from "./StudySummary";

// 외우기 (#7): Day 범위 고르기 → 플래시카드(영→한) → 결과
type Step =
  | { kind: "pick" }
  | { kind: "study"; cards: StudyCard[]; round: number }
  | { kind: "done"; cards: StudyCard[]; result: SessionResult; round: number };

export default function StudyPage() {
  const [step, setStep] = useState<Step>({ kind: "pick" });

  if (step.kind === "pick") {
    return <RangePicker onStart={(cards) => setStep({ kind: "study", cards, round: 1 })} />;
  }
  if (step.kind === "study") {
    return (
      <FlashcardSession
        key={step.round}
        cards={step.cards}
        onFinish={(result) => setStep({ kind: "done", cards: step.cards, result, round: step.round })}
      />
    );
  }
  return (
    <StudySummary
      cards={step.cards}
      result={step.result}
      onRetry={(cards) => setStep({ kind: "study", cards, round: step.round + 1 })}
      onPickAgain={() => setStep({ kind: "pick" })}
    />
  );
}
