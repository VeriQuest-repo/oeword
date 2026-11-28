import { describe, expect, it } from "vitest";
import { checkSubmitInput, decodeAnswer, durationLabel, encodeAnswer, firstLetter, gradeItem, isBlank } from "./test";

const NOW = new Date("2026-11-28T12:00:00Z");
const card = {
  text: "present",
  senses: [
    { pos: "명사", meanings: ["선물", "현재"] },
    { pos: "형용사", meanings: ["출석한"] },
  ],
};

describe("gradeItem", () => {
  it("영→한은 품사 이름으로 답을 찾아 채점한다 (순서가 달라도 됨)", () => {
    expect(gradeItem(card, "en_ko", { 형용사: "출석한", 명사: "현재" }).correct).toBe(true);
    const half = gradeItem(card, "en_ko", { 명사: "선물" });
    expect(half.correct).toBe(false);
    expect(half.senseGrades?.map((g) => g.correct)).toEqual([true, false]);
  });

  it("한→영은 대소문자·앞뒤 공백을 무시한다", () => {
    expect(gradeItem(card, "ko_en", " Present ").correct).toBe(true);
    expect(gradeItem(card, "ko_en", "presents").correct).toBe(false);
    expect(gradeItem(card, "ko_en", {}).correct).toBe(false);
  });
});

describe("답 저장 형식", () => {
  it("영→한은 품사→답 JSON, 한→영은 글자 그대로", () => {
    const stored = encodeAnswer("en_ko", { 명사: "선물" });
    expect(stored).toBe('{"명사":"선물"}');
    expect(decodeAnswer("en_ko", stored)).toEqual({ 명사: "선물" });
    expect(encodeAnswer("ko_en", "gift")).toBe("gift");
    expect(decodeAnswer("ko_en", "gift")).toBe("gift");
  });

  it("읽지 못하는 답은 빈 답", () => {
    expect(decodeAnswer("en_ko", "깨진")).toEqual({});
    expect(decodeAnswer("en_ko", null)).toEqual({});
    expect(decodeAnswer("ko_en", null)).toBe("");
  });

  it("빈 답 판단", () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank({ 명사: "  " })).toBe(true);
    expect(isBlank({ 명사: "", 동사: "주다" })).toBe(false);
    expect(isBlank(" ")).toBe(true);
  });
});

describe("힌트·걸린 시간", () => {
  it("첫 알파벳은 괄호·물결을 건너뛴다", () => {
    expect(firstLetter("Apple")).toBe("a");
    expect(firstLetter("(be) able to")).toBe("b");
    expect(firstLetter("~ off")).toBe("o");
  });

  it("걸린 시간", () => {
    expect(durationLabel("2026-11-28T12:00:00Z", "2026-11-28T12:12:30Z")).toBe("12분 30초");
    expect(durationLabel("2026-11-28T12:00:00Z", "2026-11-28T12:00:45Z")).toBe("45초");
    expect(durationLabel("2026-11-28T12:00:00Z", null)).toBeNull();
  });
});

describe("checkSubmitInput", () => {
  const base = {
    mode: "full",
    direction: "en_ko",
    firstLetterHint: false,
    dayIds: [1, 1, 2],
    startedAt: "2026-11-28T11:50:00.123Z",
    items: [{ wordId: 5, direction: "en_ko", answer: { 명사: "선물" } }],
  };

  it("정상 입력은 Day 중복을 없애고 시각을 초까지로 맞춘다", () => {
    const result = checkSubmitInput(base, NOW);
    expect(result.ok && result.value.dayIds).toEqual([1, 2]);
    expect(result.ok && result.value.startedAt).toBe("2026-11-28T11:50:00Z");
  });

  it("같은 단어 두 번, 다른 형식, 이상한 답은 받지 않는다", () => {
    const twice = { ...base, items: [...base.items, ...base.items] };
    expect(checkSubmitInput(twice, NOW).ok).toBe(false);
    expect(checkSubmitInput({ ...base, items: [{ wordId: 5, direction: "ko_en", answer: "x" }] }, NOW).ok).toBe(false);
    expect(checkSubmitInput({ ...base, items: [{ wordId: 5, direction: "en_ko", answer: "x" }] }, NOW).ok).toBe(false);
    expect(checkSubmitInput({ ...base, mode: "smart" }, NOW).ok).toBe(false);
  });

  it("섞기는 두 방향 문제를 함께 받는다", () => {
    const mixed = {
      ...base,
      direction: "mixed",
      items: [...base.items, { wordId: 6, direction: "ko_en", answer: "gift" }],
    };
    expect(checkSubmitInput(mixed, NOW).ok).toBe(true);
  });
});
