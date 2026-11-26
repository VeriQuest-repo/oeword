import { describe, expect, it } from "vitest";
import { acceptedForms, gradeEnKo, gradeKoEn, isSenseCorrect, normalizeAnswer } from ".";

// 예시 단어는 직접 만든 짧은 예시입니다 (CLAUDE.md 6장).
const present = [
  { pos: "명사", meanings: ["선물", "현재"] },
  { pos: "형용사", meanings: ["출석한", "현재의"] },
];

describe("품사마다 뜻 하나 이상", () => {
  it("품사마다 뜻 하나씩만 써도 정답", () => {
    const grade = gradeEnKo(present, ["선물", "출석한"]);
    expect(grade.correct).toBe(true);
    expect(grade.senses.map((s) => s.correct)).toEqual([true, true]);
  });

  it("한 품사에 뜻이 여러 개면 그중 어느 것이든 정답", () => {
    expect(gradeEnKo(present, ["현재", "현재의"]).correct).toBe(true);
  });

  it("품사 두 개 중 하나만 쓰면 틀림, 어느 품사를 틀렸는지 알려 준다", () => {
    const grade = gradeEnKo(present, ["선물", ""]);
    expect(grade.correct).toBe(false);
    expect(grade.senses.map((s) => s.correct)).toEqual([true, false]);
    expect(grade.senses[1]).toMatchObject({ pos: "형용사", answer: "", meanings: ["출석한", "현재의"] });
  });

  it("다른 품사의 뜻을 쓰면 틀림", () => {
    expect(gradeEnKo(present, ["출석한", "선물"]).correct).toBe(false);
  });

  it("답 칸이 모자라면 빈 답으로 보고 틀림", () => {
    expect(gradeEnKo(present, ["선물"]).correct).toBe(false);
  });

  it("뜻이 없는 단어는 정답이 될 수 없다", () => {
    expect(gradeEnKo([], []).correct).toBe(false);
  });
});

describe("공백·쉼표·물결 무시", () => {
  const give = ["~에게 주다"];

  it("앞뒤·중간 공백을 더하거나 빼도 정답", () => {
    expect(isSenseCorrect("  ~에게   주다 ", give)).toBe(true);
    expect(isSenseCorrect("~에게주다", give)).toBe(true);
  });

  it("물결을 빼거나 전각 물결(～)로 써도 정답", () => {
    expect(isSenseCorrect("에게 주다", give)).toBe(true);
    expect(isSenseCorrect("～에게 주다", give)).toBe(true);
  });

  it("쉼표를 더해도 정답", () => {
    expect(isSenseCorrect("~에게, 주다", give)).toBe(true);
  });

  it("빈 답이나 무시하는 글자만 쓴 답은 틀림", () => {
    expect(isSenseCorrect("", give)).toBe(false);
    expect(isSenseCorrect(" ~ , ", give)).toBe(false);
  });
});

describe("괄호 부분은 써도 되고 생략해도 됨", () => {
  const give = ["(~을) 주다"];

  it("노션 예시: (~을) 주다 → ~을 주다, 주다 모두 정답", () => {
    expect(isSenseCorrect("~을 주다", give)).toBe(true);
    expect(isSenseCorrect("주다", give)).toBe(true);
  });

  it("괄호까지 그대로 써도 정답", () => {
    expect(isSenseCorrect("(~을) 주다", give)).toBe(true);
    expect(isSenseCorrect("을 주다", give)).toBe(true);
  });

  it("괄호 밖 글자를 빼면 틀림", () => {
    expect(isSenseCorrect("~을", give)).toBe(false);
  });

  it("괄호가 여러 개면 각각 써도 되고 빼도 된다", () => {
    const meaning = ["(~에게) (~을) 건네다"];
    for (const answer of ["건네다", "~에게 건네다", "~을 건네다", "~에게 ~을 건네다"]) {
      expect(isSenseCorrect(answer, meaning)).toBe(true);
    }
    expect(isSenseCorrect("~을 ~에게 건네다", meaning)).toBe(false);
  });

  it("뒤쪽 괄호와 전각 괄호도 같다", () => {
    expect(isSenseCorrect("빠른", ["빠른（속도가）"])).toBe(true);
    expect(isSenseCorrect("빠른 속도가", ["빠른（속도가）"])).toBe(true);
  });

  it("acceptedForms 는 정리한 모양을 돌려준다", () => {
    expect(new Set(acceptedForms("(~을) 주다"))).toEqual(new Set(["주다", "을주다"]));
  });
});

describe("어미 차이는 틀림", () => {
  it("~하다 / ~한 은 서로 틀림", () => {
    expect(isSenseCorrect("행복한", ["행복하다"])).toBe(false);
    expect(isSenseCorrect("행복하다", ["행복한"])).toBe(false);
  });

  it("틀려도 결과에 단어장 뜻을 그대로 돌려준다", () => {
    const grade = gradeEnKo([{ pos: "형용사", meanings: ["행복한"] }], ["행복하다"]);
    expect(grade.senses[0]).toEqual({ pos: "형용사", answer: "행복하다", correct: false, meanings: ["행복한"] });
  });
});

describe("단어장 뜻만 정답", () => {
  it("뜻이 비슷해도 단어장에 없는 말은 틀림", () => {
    expect(isSenseCorrect("기쁜", ["행복한"])).toBe(false);
    expect(isSenseCorrect("선물하다", ["선물"])).toBe(false);
  });

  it("뜻의 일부만 쓰면 틀림", () => {
    expect(isSenseCorrect("출석", ["출석한"])).toBe(false);
  });
});

describe("한 칸에 뜻을 여러 개 적으면", () => {
  it("적은 뜻이 모두 그 품사의 단어장 뜻이면 정답", () => {
    expect(isSenseCorrect("현재, 선물", ["선물", "현재"])).toBe(true);
    expect(isSenseCorrect("선물; 현재", ["선물", "현재"])).toBe(true);
  });

  it("하나라도 단어장에 없는 뜻이면 틀림", () => {
    expect(isSenseCorrect("선물, 사과", ["선물", "현재"])).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("유니코드 모양이 달라도(NFD) 같은 글자로 본다", () => {
    expect(normalizeAnswer("주다".normalize("NFD"))).toBe("주다");
    expect(isSenseCorrect("주다".normalize("NFD"), ["(~을) 주다"])).toBe(true);
  });
});

describe("한→영 채점", () => {
  it("대소문자·앞뒤 공백은 무시", () => {
    expect(gradeKoEn("present", "  Present ")).toBe(true);
    expect(gradeKoEn("give up", "GIVE  UP")).toBe(true);
  });

  it("아이패드 둥근 따옴표도 같은 글자로 본다", () => {
    expect(gradeKoEn("don't", "don’t")).toBe(true);
  });

  it("철자가 다르거나 비어 있으면 틀림", () => {
    expect(gradeKoEn("present", "presant")).toBe(false);
    expect(gradeKoEn("present", "presents")).toBe(false);
    expect(gradeKoEn("present", "  ")).toBe(false);
  });
});
