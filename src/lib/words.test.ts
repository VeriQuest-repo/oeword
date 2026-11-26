import { describe, expect, it } from "vitest";
import { checkWordInput, flattenSenses, groupMeanings, normalizePos, sensesText } from "./words";

describe("normalizePos", () => {
  it("줄임말과 괄호를 한국어 품사 이름으로 맞춘다", () => {
    expect(normalizePos("n.")).toBe("명사");
    expect(normalizePos("[명]")).toBe("명사");
    expect(normalizePos(" ADJ ")).toBe("형용사");
    expect(normalizePos("v")).toBe("동사");
    expect(normalizePos("(부)")).toBe("부사");
    expect(normalizePos("숙어")).toBe("숙어");
    expect(normalizePos("구동사")).toBe("구동사");
  });
});

describe("checkWordInput", () => {
  it("품사 여러 개, 품사마다 뜻 여러 개를 받는다", () => {
    const checked = checkWordInput({
      text: " present ",
      senses: [
        { pos: "명사", meanings: ["선물", " 현재 ", ""] },
        { pos: "형용사", meanings: ["출석한", "현재의"] },
      ],
    });
    expect(checked).toEqual({
      ok: true,
      value: {
        text: "present",
        senses: [
          { pos: "명사", meanings: ["선물", "현재"] },
          { pos: "형용사", meanings: ["출석한", "현재의"] },
        ],
      },
    });
  });

  it("괄호·물결이 있는 뜻은 그대로 저장한다", () => {
    const checked = checkWordInput({ text: "give", senses: [{ pos: "동사", meanings: ["(~을)  주다", "~에게 건네다"] }] });
    expect(checked.ok && checked.value.senses[0]?.meanings).toEqual(["(~을) 주다", "~에게 건네다"]);
  });

  it("한 칸에 쉼표·세미콜론으로 적은 뜻은 나누고, 괄호 안 쉼표는 그대로 둔다 (#34)", () => {
    const result = checkWordInput({
      text: "give",
      senses: [{ pos: "동사", meanings: ["주다, 건네다; 바치다", "(~에게, ~을) 주다", "주다"] }],
    });
    expect(result).toEqual({
      ok: true,
      value: { text: "give", senses: [{ pos: "동사", meanings: ["주다", "건네다", "바치다", "(~에게, ~을) 주다"] }] },
    });
  });

  it("같은 품사는 합치고 같은 뜻은 한 번만 남긴다", () => {
    const checked = checkWordInput({
      text: "run",
      senses: [
        { pos: "동사", meanings: ["달리다"] },
        { pos: "v.", meanings: ["달리다", "운영하다"] },
      ],
    });
    expect(checked.ok && checked.value.senses).toEqual([{ pos: "동사", meanings: ["달리다", "운영하다"] }]);
  });

  it("통째로 빈 품사 칸은 건너뛰고, 반만 찬 칸은 알려 준다", () => {
    const blank = checkWordInput({
      text: "cat",
      senses: [
        { pos: "명사", meanings: ["고양이"] },
        { pos: "", meanings: [""] },
      ],
    });
    expect(blank.ok && blank.value.senses).toHaveLength(1);
    expect(checkWordInput({ text: "cat", senses: [{ pos: "", meanings: ["고양이"] }] })).toMatchObject({
      ok: false,
      message: expect.stringContaining("품사"),
    });
    expect(checkWordInput({ text: "cat", senses: [{ pos: "명사", meanings: [" "] }] })).toMatchObject({
      ok: false,
      message: expect.stringContaining("뜻을 적어"),
    });
  });

  it("단어가 비었거나 뜻이 하나도 없으면 막는다", () => {
    expect(checkWordInput({ text: " ", senses: [{ pos: "명사", meanings: ["x"] }] }).ok).toBe(false);
    expect(checkWordInput({ text: "cat", senses: [] }).ok).toBe(false);
    expect(checkWordInput({ text: "cat" }).ok).toBe(false);
    expect(checkWordInput(null).ok).toBe(false);
  });
});

describe("펼치기·묶기", () => {
  it("펼쳤다가 다시 묶으면 처음과 같다", () => {
    const senses = [
      { pos: "명사", meanings: ["선물", "현재"] },
      { pos: "형용사", meanings: ["출석한", "현재의"] },
    ];
    expect(groupMeanings(flattenSenses(senses))).toEqual(senses);
    expect(sensesText(senses)).toBe("[명사] 선물, 현재 / [형용사] 출석한, 현재의");
  });
});
