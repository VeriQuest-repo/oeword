import { useState } from "react";
import { api, errorMessage } from "../../api";
import { OutlineButton, Panel, PrimaryButton } from "../../components/ui";
import type { MemberSummary } from "../../lib/session";
import { isBlank, isoSeconds, type TestDetail } from "../../lib/test";
import { clearDraft, loadDraft, saveDraft, type TestDraft, type TestPlan } from "./draft";
import TestPicker from "./TestPicker";
import TestResult from "./TestResult";
import TestSession from "./TestSession";

type Step = { kind: "pick" } | { kind: "test"; draft: TestDraft } | { kind: "result"; detail: TestDetail };

// 시험 메뉴 (#10): 범위 고르기 → 시험 → 한꺼번에 채점 → 결과
export default function TestPage({ member }: { member: MemberSummary }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  // 같은 기기에서 보던 시험 (앱을 닫았다 열어도 이어서 봄)
  const [saved, setSaved] = useState<TestDraft | null>(() => loadDraft(member.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin(plan: TestPlan) {
    const draft: TestDraft = { plan, answers: {}, index: 0, startedAt: isoSeconds(new Date()) };
    saveDraft(member.id, draft);
    setSaved(null);
    setError(null);
    setStep({ kind: "test", draft });
    window.scrollTo({ top: 0 });
  }

  function update(draft: TestDraft) {
    saveDraft(member.id, draft);
    setStep({ kind: "test", draft });
  }

  function quit() {
    clearDraft(member.id);
    setSaved(null);
    setStep({ kind: "pick" });
  }

  async function submit(draft: TestDraft) {
    setSubmitting(true);
    setError(null);
    try {
      const detail = await api.submitTest({
        mode: draft.plan.mode,
        direction: draft.plan.direction,
        firstLetterHint: draft.plan.firstLetterHint,
        dayIds: draft.plan.dayIds,
        startedAt: draft.startedAt,
        items: draft.plan.questions.map((q) => ({
          wordId: q.wordId,
          direction: q.direction,
          answer: draft.answers[q.wordId] ?? (q.direction === "en_ko" ? {} : ""),
        })),
      });
      clearDraft(member.id);
      setStep({ kind: "result", detail });
      window.scrollTo({ top: 0 });
    } catch (e) {
      // 채점하지 못하면 답은 그대로 남아 있어 다시 누를 수 있습니다.
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (step.kind === "test") {
    return (
      <TestSession
        draft={step.draft}
        submitting={submitting}
        error={error}
        onChange={update}
        onSubmit={() => submit(step.draft)}
        onQuit={quit}
      />
    );
  }
  if (step.kind === "result") {
    return <TestResult detail={step.detail} onNewTest={() => setStep({ kind: "pick" })} />;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">시험</h1>
      {saved && (
        <Panel className="ring-2 ring-indigo-200">
          <h2 className="text-lg font-semibold text-slate-800">보던 시험이 있어요</h2>
          <p className="mt-1 text-base text-slate-600">
            {saved.plan.questions.length}문제 중{" "}
            {saved.plan.questions.filter((q) => !isBlank(saved.answers[q.wordId])).length}문제에 답했어요.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton type="button" onClick={() => setStep({ kind: "test", draft: saved })}>
              이어서 보기
            </PrimaryButton>
            <OutlineButton onClick={quit} className="min-h-14">
              버리기
            </OutlineButton>
          </div>
        </Panel>
      )}
      <TestPicker member={member} onStart={begin} />
    </div>
  );
}
