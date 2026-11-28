// 보던 시험을 기기에 잠시 남겨 두기 (#10). 앱을 닫거나 다른 메뉴로 가도 같은 기기에서 이어서 볼 수 있습니다.
// 채점이 끝나면 지웁니다. 서버에는 다 푼 시험만 저장합니다.
import type { ItemAnswer, TestDirection, TestQuestion } from "../../lib/test";

export interface TestPlan {
  mode: "full" | "review";
  direction: TestDirection;
  firstLetterHint: boolean;
  dayIds: number[];
  questions: TestQuestion[];
}

export interface TestDraft {
  plan: TestPlan;
  /** 단어 id → 쓴 답 */
  answers: Record<number, ItemAnswer>;
  index: number;
  startedAt: string;
}

const keyFor = (memberId: number) => `oeword.test-draft.${memberId}`;

export function loadDraft(memberId: number): TestDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(memberId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as TestDraft;
    if (!draft?.plan?.questions?.length || typeof draft.startedAt !== "string") return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(memberId: number, draft: TestDraft): void {
  try {
    localStorage.setItem(keyFor(memberId), JSON.stringify(draft));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 이어 보기만 못 할 뿐 시험은 계속합니다.
  }
}

export function clearDraft(memberId: number): void {
  try {
    localStorage.removeItem(keyFor(memberId));
  } catch {
    // 무시
  }
}
