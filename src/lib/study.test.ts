import { describe, expect, it } from "vitest";
import { gradeEnKo } from "./grading";
import { assignDirections, buildDeck, checkCompletionInput, recommendStage, shuffle, wrongItems } from "./study";
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
      wordId: 1,
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

describe("assignDirections", () => {
  const cards = buildDeck([
    day(1, [
      { id: 1, text: "apple", senses: [{ pos: "명사", meanings: ["사과"] }] },
      { id: 2, text: "give", senses: [{ pos: "동사", meanings: ["(~을) 주다"] }] },
      { id: 3, text: "quick", senses: [{ pos: "형용사", meanings: ["빠른"] }] },
      { id: 4, text: "run", senses: [{ pos: "동사", meanings: ["달리다"] }] },
    ]),
  ]);

  it("한 방향을 고르면 모든 카드가 그 방향이다", () => {
    expect(assignDirections(cards, "en_ko").map((c) => c.direction)).toEqual(["en_ko", "en_ko", "en_ko", "en_ko"]);
    expect(assignDirections(cards, "ko_en").every((c) => c.direction === "ko_en")).toBe(true);
  });

  it("섞기는 5:5로 나누고 카드 순서는 그대로 둔다", () => {
    let seed = 0.3;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    const items = assignDirections(cards, "mixed", random);
    expect(items.map((c) => c.text)).toEqual(["apple", "give", "quick", "run"]);
    expect(items.filter((c) => c.direction === "ko_en")).toHaveLength(2);
  });

  it("홀수 장이면 차이는 한 장뿐이다", () => {
    const items = assignDirections(cards.slice(0, 3), "mixed", () => 0.1);
    const koEn = items.filter((c) => c.direction === "ko_en").length;
    expect(koEn === 1 || koEn === 2).toBe(true);
  });
});

describe("wrongItems", () => {
  it("맞힌 카드만 빼고 틀리거나 안 본 카드는 남긴다", () => {
    const cards = buildDeck([
      day(1, [
        { id: 1, text: "apple", senses: [{ pos: "명사", meanings: ["사과"] }] },
        { id: 2, text: "give", senses: [{ pos: "동사", meanings: ["주다"] }] },
        { id: 3, text: "run", senses: [{ pos: "동사", meanings: ["달리다"] }] },
      ]),
    ]);
    const result = new Map([
      [cards[0]!.key, true],
      [cards[1]!.key, false],
    ]);
    expect(wrongItems(cards, result).map((c) => c.text)).toEqual(["give", "run"]);
  });
});

const c = (blind: number, choice: number, write: number) => ({ blind, choice, write });

describe("recommendStage", () => {
  it("처음이면 가리기, 앞 단계를 했으면 다음 단계를 추천한다", () => {
    expect(recommendStage([])).toBe("blind");
    expect(recommendStage([c(0, 0, 0)])).toBe("blind");
    expect(recommendStage([c(1, 0, 0)])).toBe("choice");
    expect(recommendStage([c(1, 1, 0)])).toBe("write");
    expect(recommendStage([c(1, 1, 1)])).toBe("blind");
  });
  it("여러 Day 면 가장 덜 한 Day 기준으로 고른다", () => {
    expect(recommendStage([c(2, 1, 1), c(0, 0, 0)])).toBe("blind");
    expect(recommendStage([c(2, 2, 1), c(1, 0, 3)])).toBe("choice");
  });
  it("객관식을 못 하면 건너뛴다", () => {
    expect(recommendStage([c(1, 0, 0)], false)).toBe("write");
  });
});

describe("checkCompletionInput", () => {
  it("정한 값만 받고 Day 중복은 하나로 줄인다", () => {
    expect(checkCompletionInput({ stage: "write", direction: "mixed", dayIds: [3, 3, 4], wordCount: 5 })).toEqual({
      ok: true,
      value: { stage: "write", direction: "mixed", dayIds: [3, 4], wordCount: 5 },
    });
    expect(checkCompletionInput({ stage: "write", direction: "up", dayIds: [3], wordCount: 5 }).ok).toBe(false);
    expect(checkCompletionInput({ stage: "write", direction: "en_ko", dayIds: [], wordCount: 5 }).ok).toBe(false);
    expect(checkCompletionInput({ stage: "write", direction: "en_ko", dayIds: [1.5], wordCount: 5 }).ok).toBe(false);
  });
});
