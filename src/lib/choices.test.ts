import { describe, expect, it } from "vitest";
import { buildChoices, meaningLabel } from "./choices";
import type { StudyCard } from "./study";

function card(text: string, ...senses: [string, ...string[]][]): StudyCard {
  return {
    key: text.toLowerCase(),
    wordId: 1,
    text,
    senses: senses.map(([pos, ...meanings]) => ({ pos, meanings })),
    days: ["Day 1"],
  };
}

const apple = card("apple", ["명사", "사과"]);
const give = card("give", ["동사", "(~을) 주다"]);
const quick = card("quick", ["형용사", "빠른"]);
const run = card("run", ["동사", "달리다"]);
const fast = card("fast", ["형용사", "빠른", "단단히 고정된"]);
const hand = card("hand", ["동사", "주다", "건네다"]);
const sad = card("sad", ["형용사", "슬픈"]);

describe("buildChoices", () => {
  it("정답 1개와 오답 3개, 정답은 하나뿐이다", () => {
    const options = buildChoices(apple, "en_ko", [apple, give, quick, run, sad])!;
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.correct)).toEqual([{ key: "apple", label: "사과", correct: true }]);
    expect(new Set(options.map((o) => o.key)).size).toBe(4);
  });

  it("뜻→영단어는 영단어를 보기로 낸다", () => {
    const options = buildChoices(apple, "ko_en", [apple, give, quick, run])!;
    expect(new Set(options.map((o) => o.label))).toEqual(new Set(["apple", "give", "quick", "run"]));
  });

  it("정답과 뜻이 겹치는 단어는 오답으로 쓰지 않는다 (괄호 생략 모양 포함)", () => {
    const quickOptions = buildChoices(quick, "ko_en", [quick, fast, apple, run, sad])!;
    expect(quickOptions.map((o) => o.key)).not.toContain("fast");
    const giveOptions = buildChoices(give, "en_ko", [give, hand, apple, run, sad])!;
    expect(giveOptions.map((o) => o.key)).not.toContain("hand");
  });

  it("범위에서 먼저 뽑고 모자라면 단어장의 다른 단어로 채운다", () => {
    const options = buildChoices(apple, "en_ko", [apple, give], [quick, run, sad])!;
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.key)).toContain("give");
  });

  it("단어가 모자라면 보기를 줄이고, 오답을 하나도 못 만들면 null", () => {
    expect(buildChoices(apple, "en_ko", [apple, give])).toHaveLength(2);
    expect(buildChoices(apple, "en_ko", [apple])).toBeNull();
    expect(buildChoices(quick, "en_ko", [quick, fast])).toBeNull();
  });
});

describe("meaningLabel", () => {
  it("품사가 여럿이면 품사를 붙여 보여 준다", () => {
    expect(meaningLabel(apple.senses)).toBe("사과");
    expect(meaningLabel(card("present", ["명사", "선물", "현재"], ["형용사", "참석한"]).senses)).toBe(
      "명사 선물, 현재 / 형용사 참석한",
    );
  });
});
