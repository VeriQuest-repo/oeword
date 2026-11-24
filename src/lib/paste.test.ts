import { describe, expect, it } from "vitest";
import { groupRows, parseRows, parseTable, splitMeanings, toWordInputs } from "./paste";

const tsv = (...lines: string[][]) => lines.map((l) => l.join("\t")).join("\n");

describe("parseTable", () => {
  it("탭과 줄바꿈으로 칸을 나누고, 따옴표 칸 안의 줄바꿈을 지킨다", () => {
    expect(parseTable('a\tb\tc\r\nd\t"e\nf"\t"g ""h"""\n')).toEqual([
      ["a", "b", "c"],
      ["d", "e\nf", 'g "h"'],
    ]);
  });
});

describe("splitMeanings", () => {
  it("쉼표·세미콜론으로 나누되 괄호 안은 나누지 않는다", () => {
    expect(splitMeanings("선물, 현재")).toEqual(["선물", "현재"]);
    expect(splitMeanings("(~에게, ~을) 주다; 건네다")).toEqual(["(~에게, ~을) 주다", "건네다"]);
    expect(splitMeanings(" , ")).toEqual([]);
  });
});

describe("붙여넣기 묶기", () => {
  it("같은 단어 여러 줄은 품사별로 한 단어 안에 묶인다", () => {
    const words = groupRows(
      parseRows(
        tsv(
          ["present", "명사", "선물, 현재"],
          ["present", "형용사", "출석한, 현재의"],
          ["give", "v.", "(~을) 주다"],
          ["Present", "명", "선물"],
        ),
      ),
    );
    expect(toWordInputs(words)).toEqual([
      {
        text: "present",
        senses: [
          { pos: "명사", meanings: ["선물", "현재"] },
          { pos: "형용사", meanings: ["출석한", "현재의"] },
        ],
      },
      { text: "give", senses: [{ pos: "동사", meanings: ["(~을) 주다"] }] },
    ]);
  });

  it("머리글 줄, 빈 줄, 번호 칸은 건너뛴다", () => {
    const rows = parseRows(tsv(["단어", "품사", "뜻"], [], ["1", "cat", "명사", "고양이"], ["", "", ""]));
    expect(rows).toEqual([{ line: 3, word: "cat", pos: "명사", meaning: "고양이" }]);
  });

  it("단어 칸이 빈 줄(병합한 칸)은 윗줄 단어에 붙이고 안내한다", () => {
    const words = groupRows(parseRows(tsv(["light", "명사", "빛"], ["", "형용사", "가벼운"])));
    expect(words).toHaveLength(1);
    expect(words[0]!.senses).toEqual([
      { pos: "명사", meanings: ["빛"] },
      { pos: "형용사", meanings: ["가벼운"] },
    ]);
    expect(words[0]!.problems).toEqual([]);
    expect(words[0]!.notes[0]).toContain("2번째 줄");
  });

  it("칸이 빠진 줄은 문제로 표시하고 저장 목록에서 뺀다", () => {
    const words = groupRows(parseRows(tsv(["cat", "명사", "고양이"], ["dog", "개"], ["bird", "명사"])));
    expect(words.map((w) => w.problems.map((p) => `${p.line}:${p.message}`))).toEqual([
      [],
      ["2:품사 칸이 비어 있어요."],
      ["3:뜻 칸이 비어 있어요."],
    ]);
    expect(toWordInputs(words).map((w) => w.text)).toEqual(["cat"]);
  });

  it("뜻이 두 칸 이상에 나뉘어 있어도 모은다", () => {
    const words = groupRows(parseRows(tsv(["run", "동사", "달리다", "운영하다"])));
    expect(words[0]!.senses).toEqual([{ pos: "동사", meanings: ["달리다", "운영하다"] }]);
  });

  it("미리보기에서 고친 줄로 다시 묶으면 문제가 사라진다", () => {
    const rows = parseRows(tsv(["dog", "", "개"]));
    expect(groupRows(rows)[0]!.problems).toHaveLength(1);
    const fixed = rows.map((r) => ({ ...r, pos: "명사" }));
    expect(groupRows(fixed)[0]!.problems).toEqual([]);
  });
});
