import { describe, expect, it } from "vitest";
import { gradeEnKo } from "./grading";
import { buildDeck, shuffle } from "./study";
import type { DayWords } from "./words";

function day(dayNumber: number, words: DayWords["words"]): DayWords {
  return { day: { id: dayNumber * 10, bookId: 1, bookTitle: "예시 단어장", dayNumber, title: "제목" }, words };
}

describe("buildDeck", () => {
  it("Day 번호 순서, Day 안의 단어 순서대로 카드를 만든다", () => {
    const deck = buildDeck([
      day(2, [{ id: 3, text: "quick", senses: [{ pos: "형용사", meanings: ["빠른"] }] }]),
      day(1, [
        { id: 1, text: "apple", senses: [{ pos: "명사", meanings: ["사과"] }] },
        { id: 2, text: "give", senses: [{ pos: "동사", meanings: ["(~을) 주다"] }] },
      ]),
    ]);
    expect(deck.map((c) => c.text)).toEqual(["apple", "give", "quick"]);
    expect(deck[2]?.days).toEqual(["Day 2"]);
  });

  it("여러 Day 의 같은 단어는 한 번만 내고 뜻을 합친다", () => {
    const deck = buildDeck([
      day(1, [{ id: 1, text: "present", senses: [{ pos: "명사", meanings: ["선물"] }] }]),
      day(3, [
        {
          id: 9,
          text: "Present",
          senses: [
            { pos: "명사", meanings: ["현재", "선물"] },
            { pos: "형용사", meanings: ["출석한"] },
          ],
        },
      ]),
    ]);
    expect(deck).toHaveLength(1);
    expect(deck[0]).toEqual({
      key: "present",
      text: "present",
      senses: [
        { pos: "명사", meanings: ["선물", "현재"] },
        { pos: "형용사", meanings: ["출석한"] },
      ],
      days: ["Day 1", "Day 3"],
    });
    // 어느 Day 의 뜻이든 정답
    expect(gradeEnKo(deck[0]!.senses, ["현재", "출석한"]).correct).toBe(true);
  });

  it("고른 Day 에 단어가 없으면 빈 묶음", () => {
    expect(buildDeck([day(1, [])])).toEqual([]);
  });
});

describe("shuffle", () => {
  it("같은 카드들을 순서만 바꿔 돌려주고 원래 배열은 그대로 둔다", () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, () => 0);
    expect(result).toEqual([2, 3, 4, 5, 1]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...shuffle(items)].toString().length).toBe(items.toString().length);
  });
});
