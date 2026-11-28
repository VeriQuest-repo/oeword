// 다시 볼 단어 (#12): 시험에서 틀린 단어와, 맞혔지만 오래 안 본 단어를 모읍니다.
// 화면 시험을 저장할 때 쌓이는 단어별 기록(word_stat)만 씁니다. 외우기 결과는 기록하지 않으므로 들어가지 않습니다.
import type { StudyCard } from "./study";

/** 맞힌 단어도 이만큼 지나면 '오래 안 본 단어'로 다시 냅니다. */
export const OLD_AFTER_DAYS = 7;
/** 틀린 단어는 모두 내되, 너무 많으면 이만큼만 (오래전에 틀린 것부터 뺌) */
export const WRONG_MAX = 100;

export type ReviewReason = "wrong" | "old";

/** 단어별 기록 한 줄 (같은 철자가 여러 Day 에 있으면 여러 줄) */
export interface WordStatRow {
  wordId: number;
  key: string;
  dayId: number;
  wrongCount: number;
  lastCorrect: boolean;
  lastSeenAt: string;
}

export interface ReviewPick {
  key: string;
  /** 같은 철자의 단어 id 들 (첫 번째로 시험 문항을 만듦) */
  wordIds: number[];
  dayIds: number[];
  reason: ReviewReason;
  wrongCount: number;
  lastSeenAt: string;
}

/**
 * 다시 볼 단어를 고릅니다. 같은 철자는 한 단어로 보고, 가장 최근 결과를 따릅니다.
 * - 틀린 단어: 가장 최근 결과가 틀림 → 모두 (많이 틀린 것, 오래된 것부터, 최대 WRONG_MAX)
 * - 오래 안 본 단어: 가장 최근 결과가 맞음이고 OLD_AFTER_DAYS 일 넘게 지남 → 오래된 것부터, 전체가 limit 개가 될 때까지
 */
export function pickReviewWords(rows: readonly WordStatRow[], now: Date, limit: number): ReviewPick[] {
  const groups = new Map<string, WordStatRow[]>();
  for (const row of rows) groups.set(row.key, [...(groups.get(row.key) ?? []), row]);

  const cutoff = now.getTime() - OLD_AFTER_DAYS * 24 * 3600 * 1000;
  const wrong: ReviewPick[] = [];
  const old: ReviewPick[] = [];
  for (const [key, list] of groups) {
    const latest = list.reduce((a, b) => (Date.parse(b.lastSeenAt) > Date.parse(a.lastSeenAt) ? b : a));
    const pick = {
      key,
      wordIds: [...new Set(list.map((r) => r.wordId))],
      dayIds: [...new Set(list.map((r) => r.dayId))],
      wrongCount: list.reduce((sum, r) => sum + r.wrongCount, 0),
      lastSeenAt: latest.lastSeenAt,
    };
    if (!latest.lastCorrect) wrong.push({ ...pick, reason: "wrong" });
    else if (Date.parse(latest.lastSeenAt) < cutoff) old.push({ ...pick, reason: "old" });
  }
  const byOldest = (a: ReviewPick, b: ReviewPick) => Date.parse(a.lastSeenAt) - Date.parse(b.lastSeenAt);
  // oxlint-disable-next-line unicorn/no-array-sort
  wrong.sort((a, b) => b.wrongCount - a.wrongCount || byOldest(a, b));
  // oxlint-disable-next-line unicorn/no-array-sort
  old.sort(byOldest);
  const wrongPicked = wrong.slice(0, WRONG_MAX);
  return [...wrongPicked, ...old.slice(0, Math.max(0, limit - wrongPicked.length))];
}

/** 다시 볼 단어 카드 (GET /api/review-words) */
export interface ReviewCard extends StudyCard {
  reason: ReviewReason;
  lastSeenAt: string;
}

/** GET /api/review-words 응답 */
export interface ReviewWords {
  studentId: number;
  wrongCount: number;
  oldCount: number;
  /** 시험 범위로 보낼 Day 들 */
  dayIds: number[];
  words: ReviewCard[];
}
