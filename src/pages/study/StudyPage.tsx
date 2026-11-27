import { useState } from "react";
import { api, errorMessage } from "../../api";
import type { MemberSummary } from "../../lib/session";
import { type StudyCard, type StudyDirection, type StudyItem, type StudyStage, wrongItems } from "../../lib/study";
import FlashcardSession, { type SessionResult } from "./FlashcardSession";
import RangePicker, { type StudyPlan } from "./RangePicker";
import StudySummary from "./StudySummary";

// 외우기 (#7, #42, #43): 범위·방향·단계 고르기 → 카드 → 틀린(못외운) 카드가 없을 때까지 그 카드만 다시 → 결과
interface Session {
  stage: StudyStage;
  direction: StudyDirection;
  dayIds: number[];
  all: StudyItem[];
  range: StudyCard[];
  extra: StudyCard[];
}
type Step =
  | { kind: "pick" }
  | { kind: "study"; session: Session; cards: StudyItem[]; round: number }
  | { kind: "done"; session: Session; cards: StudyItem[]; result: SessionResult; round: number; stopped: boolean };

/** 완료 기록 저장 상태: 학생이 아니면 남기지 않음(skip) */
export type SaveState = "skip" | "saving" | "saved" | { error: string };

export default function StudyPage({ member, members }: { member: MemberSummary; members: MemberSummary[] }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [save, setSave] = useState<SaveState>("skip");

  /** 반복이 끝나 모두 외우거나 맞히면 완료 한 번을 남깁니다 ("그만하기"는 남기지 않음, #44). */
  function recordIfComplete(session: Session, cards: StudyItem[], result: SessionResult) {
    if (cards.some((c) => result.get(c.key) !== true) || member.role !== "student") {
      setSave("skip");
      return;
    }
    setSave("saving");
    api
      .saveCompletion({
        stage: session.stage,
        direction: session.direction,
        dayIds: session.dayIds,
        wordCount: session.all.length,
      })
      .then(() => setSave("saved"))
      .catch((e) => setSave({ error: errorMessage(e) }));
  }

  if (step.kind === "pick") {
    return (
      <RangePicker
        member={member}
        members={members}
        onStart={(plan: StudyPlan) => setStep({ kind: "study", session: plan, cards: plan.all, round: 1 })}
      />
    );
  }
  const { session } = step;
  if (step.kind === "study") {
    const finish = (result: SessionResult, stopped: boolean) => {
      if (stopped) setSave("skip");
      else recordIfComplete(session, step.cards, result);
      setStep({ kind: "done", session, cards: step.cards, result, round: step.round, stopped });
    };
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
      save={save}
      onRetryWrong={() =>
        setStep({ kind: "study", session, cards: wrongItems(step.cards, step.result), round: step.round + 1 })
      }
      onRestart={() => setStep({ kind: "study", session, cards: session.all, round: 1 })}
      onPickAgain={() => setStep({ kind: "pick" })}
    />
  );
}
