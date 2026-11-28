import { describe, expect, it } from "vitest";
import { pickReviewWords, type WordStatRow } from "./review";

const NOW = new Date("2026-11-28T12:00:00Z");
const row = (wordId: number, key: string, lastCorrect: boolean, lastSeenAt: string, wrongCount = lastCorrect ? 0 : 1): WordStatRow => ({
  wordId,
  key,
  dayId: wordId * 10,
  wrongCount,
  lastCorrect,
  lastSeenAt,
});

describe("pickReviewWords", () => {
  it("틀린 단어는 모두, 오래(7일 넘게) 안 본 맞힌 단어는 남는 자리만큼", () => {
    const picks = pickReviewWords(
      [
        row(1, "apple", false, "2026-11-27T10:00:00Z"),
        row(2, "give", true, "2026-11-27T10:00:00Z"), // 최근에 맞힘 → 안 나옴
        row(3, "quick", true, "2026-11-10T10:00:00Z"),
        row(4, "quiet", true, "2026-11-01T10:00:00Z"),
        row(5, "carry", false, "2026-11-20T10:00:00Z", 3),
      ],
      NOW,
      3,
    );
    expect(picks.map((p) => [p.key, p.reason])).toEqual([
      ["carry", "wrong"],
      ["apple", "wrong"],
      ["quiet", "old"],
    ]);
  });

  it("같은 철자는 한 단어로 보고 가장 최근 결과를 따른다", () => {
    const picks = pickReviewWords(
      [row(1, "present", false, "2026-11-20T10:00:00Z"), row(2, "present", true, "2026-11-27T10:00:00Z")],
      NOW,
      30,
    );
    expect(picks).toEqual([]);
    const again = pickReviewWords(
      [row(1, "present", true, "2026-11-20T10:00:00Z"), row(2, "present", false, "2026-11-27T10:00:00Z")],
      NOW,
      30,
    );
    expect(again).toMatchObject([{ key: "present", wordIds: [1, 2], dayIds: [10, 20], reason: "wrong" }]);
  });
});
