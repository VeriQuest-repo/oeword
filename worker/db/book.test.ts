import { describe, expect, it } from "vitest";
import { addWord, createBook, createDay, listBooks, listDays, listWords } from "./book";
import { createFamily } from "./family";
import { createTestDb } from "./testing/sqlite-d1";

async function setup() {
  const { db, sqlite } = createTestDb();
  const family = await createFamily(db, "우리 가족");
  const book = await createBook(db, { familyId: family.id, title: "예시 단어장" });
  const day = await createDay(db, { bookId: book.id, dayNumber: 1 });
  return { db, sqlite, family, book, day };
}

describe("단어장·Day", () => {
  it("보관한 단어장은 기본 목록에서 빠진다", async () => {
    const { db, sqlite, family, book } = await setup();
    const old = await createBook(db, { familyId: family.id, title: "지난 단어장" });
    sqlite.prepare("UPDATE book SET archived_at = '2026-11-01T00:00:00Z' WHERE id = ?").run(old.id);

    expect((await listBooks(db, family.id)).map((b) => b.id)).toEqual([book.id]);
    expect((await listBooks(db, family.id, { includeArchived: true })).map((b) => b.id)).toEqual([
      book.id,
      old.id,
    ]);
  });

  it("Day 는 번호 순서로 나온다", async () => {
    const { db, book } = await setup();
    await createDay(db, { bookId: book.id, dayNumber: 3 });
    await createDay(db, { bookId: book.id, dayNumber: 2 });
    expect((await listDays(db, book.id)).map((d) => d.day_number)).toEqual([1, 2, 3]);
  });

  it("같은 Day 번호를 또 만들면 실패한다", async () => {
    const { db, book } = await setup();
    await expect(createDay(db, { bookId: book.id, dayNumber: 1 })).rejects.toThrow(
      "UNIQUE constraint failed",
    );
  });
});

describe("단어·품사별 뜻", () => {
  it("품사 여러 개, 한 품사에 뜻 여러 개를 넣은 순서대로 저장한다", async () => {
    const { db, day } = await setup();
    const word = await addWord(db, {
      dayId: day.id,
      text: "present",
      meanings: [
        { pos: "명사", text: "선물" },
        { pos: "명사", text: "현재" },
        { pos: "형용사", text: "출석한" },
        { pos: "형용사", text: "현재의" },
      ],
    });
    expect(word.text).toBe("present");
    expect(word.meanings.map((m) => [m.pos, m.text, m.sort_order])).toEqual([
      ["명사", "선물", 0],
      ["명사", "현재", 1],
      ["형용사", "출석한", 2],
      ["형용사", "현재의", 3],
    ]);
    expect(word.meanings.every((m) => m.word_id === word.id)).toBe(true);
  });

  it("뜻은 입력한 글자 그대로 저장한다 (괄호·물결 포함)", async () => {
    const { db, day } = await setup();
    await addWord(db, { dayId: day.id, text: "give", meanings: [{ pos: "동사", text: "(~을) 주다" }] });
    const [word] = await listWords(db, day.id);
    expect(word.meanings[0].text).toBe("(~을) 주다");
  });

  it("Day 의 단어를 순서대로, 각자의 뜻과 함께 돌려준다", async () => {
    const { db, day, book } = await setup();
    const other = await createDay(db, { bookId: book.id, dayNumber: 2 });
    await addWord(db, { dayId: day.id, text: "b-word", sortOrder: 2, meanings: [{ pos: "명사", text: "비" }] });
    await addWord(db, { dayId: other.id, text: "other", meanings: [{ pos: "명사", text: "다른 Day" }] });
    await addWord(db, {
      dayId: day.id,
      text: "a-word",
      sortOrder: 1,
      meanings: [
        { pos: "동사", text: "에이하다" },
        { pos: "명사", text: "에이" },
      ],
    });

    const words = await listWords(db, day.id);
    expect(words.map((w) => [w.text, w.meanings.map((m) => m.text)])).toEqual([
      ["a-word", ["에이하다", "에이"]],
      ["b-word", ["비"]],
    ]);
  });

  it("뜻 없이 단어만 넣을 수 없다", async () => {
    const { db, day } = await setup();
    await expect(addWord(db, { dayId: day.id, text: "empty", meanings: [] })).rejects.toThrow(
      "뜻이 하나 이상",
    );
    expect(await listWords(db, day.id)).toEqual([]);
  });

  it("뜻을 넣다 실패하면 단어도 남지 않는다 (한 트랜잭션)", async () => {
    const { db, day } = await setup();
    await expect(
      addWord(db, {
        dayId: day.id,
        text: "broken",
        meanings: [
          { pos: "명사", text: "괜찮음" },
          { pos: "명사", text: null as unknown as string },
        ],
      }),
    ).rejects.toThrow("NOT NULL constraint failed");
    expect(await listWords(db, day.id)).toEqual([]);
  });
});
