import { useState } from "react";
import { api, errorMessage } from "../../api";
import { ChoiceButton, ErrorText, OutlineButton, Panel, PrimaryButton } from "../../components/ui";
import type { MemberSummary } from "../../lib/session";
import { shuffle } from "../../lib/study";
import { isBlank, isoSeconds, type TestDetail, type TestQuestion } from "../../lib/test";
import { wordKey } from "../../lib/words";
import { clearDraft, loadDraft, saveDraft, type TestDraft, type TestPlan } from "./draft";
import ReviewPanel from "./ReviewPanel";
import TestHistory from "./TestHistory";
import TestPicker from "./TestPicker";
import TestResult from "./TestResult";
import TestSession from "./TestSession";

type Step =
  | { kind: "home" }
  | { kind: "test"; draft: TestDraft }
  | { kind: "result"; detail: TestDetail; fromHistory: boolean };

/** 결과에서 틀린 문제만 골라 다시 볼 시험을 만듭니다 (#11). 방향·힌트·범위는 그대로, 순서는 다시 섞습니다. */
export function retryPlan(detail: TestDetail): TestPlan {
  const questions: TestQuestion[] = detail.items
    .filter((it) => !it.correct)
    .map((it) => ({
      key: wordKey(it.text),
      wordId: it.wordId,
      text: it.text,
      senses: it.senses,
      days: it.days,
      direction: it.direction,
    }));
  return {
    mode: "review",
    direction: detail.direction,
    firstLetterHint: detail.firstLetterHint,
    dayIds: detail.dayIds,
    questions: shuffle(questions),
  };
}

// 시험 메뉴 (#10, #11, #12): 보던 시험 · 다시 볼 단어 · 새 시험 고르기 · 지난 시험 → 시험 → 한꺼번에 채점 → 결과
export default function TestPage({ member, members }: { member: MemberSummary; members: MemberSummary[] }) {
  const students = members.filter((m) => m.role === "student");
  const [step, setStep] = useState<Step>({ kind: "home" });
  // 같은 기기에서 보던 시험 (앱을 닫았다 열어도 이어서 봄)
  const [saved, setSaved] = useState<TestDraft | null>(() => loadDraft(member.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 학생은 자기 기록, 보호자는 고른 아이의 기록을 봅니다.
  const [historyOf, setHistoryOf] = useState<number | null>(
    member.role === "student" ? member.id : (students[0]?.id ?? null),
  );
  const [refreshKey, setRefreshKey] = useState(0);

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
    setStep({ kind: "home" });
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
      setRefreshKey((n) => n + 1);
      setStep({ kind: "result", detail, fromHistory: false });
      window.scrollTo({ top: 0 });
    } catch (e) {
      // 채점하지 못하면 답은 그대로 남아 있어 다시 누를 수 있습니다.
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function openTest(testId: number) {
    setError(null);
    try {
      const detail = await api.test(testId);
      setStep({ kind: "result", detail, fromHistory: true });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(errorMessage(e));
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
    const { detail } = step;
    // 보호자가 아이 기록을 볼 때는 다시 시험 버튼을 두지 않습니다 (아이 기록에 섞이지 않게).
    const own = detail.studentId === null || detail.studentId === member.id;
    return (
      <TestResult
        detail={detail}
        onRetryWrong={own ? () => begin(retryPlan(detail)) : undefined}
        onBack={() => setStep({ kind: "home" })}
        backLabel={step.fromHistory ? "지난 시험" : "시험"}
      />
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">시험</h1>
      <ErrorText message={error} />
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
      {member.role === "student" && (
        <ReviewPanel studentId={member.id} canTake title="다시 볼 단어" refreshKey={refreshKey} onStart={begin} />
      )}
      <TestPicker member={member} onStart={begin} />
      {member.role !== "student" && students.length > 1 && (
        <Panel>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">누구의 시험을 볼까요?</h2>
          <div className="flex flex-wrap gap-2">
            {students.map((st) => (
              <ChoiceButton key={st.id} selected={st.id === historyOf} onClick={() => setHistoryOf(st.id)}>
                {st.name}
              </ChoiceButton>
            ))}
          </div>
        </Panel>
      )}
      {historyOf !== null && (
        <TestHistory
          studentId={historyOf}
          title={
            member.role === "student"
              ? "지난 시험"
              : `${students.find((st) => st.id === historyOf)?.name ?? "학생"}의 지난 시험`
          }
          refreshKey={refreshKey}
          onOpen={openTest}
        />
      )}
      {member.role !== "student" && historyOf !== null && (
        <ReviewPanel
          studentId={historyOf}
          canTake={false}
          title={`${students.find((st) => st.id === historyOf)?.name ?? "학생"}의 다시 볼 단어`}
          refreshKey={refreshKey}
          onStart={begin}
        />
      )}
    </div>
  );
}
