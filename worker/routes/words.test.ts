import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/testing/sqlite-d1";
import { call, familyWithCookies } from "./testing/api";

const PRESENT = {
  text: "present",
  senses: [
    { pos: "명사", meanings: ["선물", "현재"] },
    { pos: "형용사", meanings: ["출석한", "현재의"] },
  ],
};

async function setup() {
  const { db, sqlite } = createTestDb();
  const ctx = await familyWithCookies(db);
  const book = await call(db, "/api/books", { method: "POST", body: { title: "단어장" }, cookie: ctx.guardian });
  const day = await call(db, `/api/books/${book.body.book.id}/days`, { method: "POST", body: {}, cookie: ctx.guardian });
  return { db, sqlite, ...ctx, dayId: day.body.day.id as number };
}

describe("단어 API", () => {
  it("품사·뜻이 여러 개인 단어를 넣고 다시 열어도 그대로다", async () => {
    const { db, guardian, dayId } = await setup();
    const added = await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    expect(added.status).toBe(201);
    expect(added.body.word).toMatchObject(PRESENT);

    const list = await call(db, `/api/days/${dayId}/words`, { cookie: guardian });
    expect(list.body.day).toMatchObject({ id: dayId, dayNumber: 1, bookTitle: "단어장" });
    expect(list.body.words).toEqual([{ id: added.body.word.id, ...PRESENT }]);
  });

  it("넣은 순서대로 나온다 (30단어)", async () => {
    const { db, guardian, dayId } = await setup();
    for (let i = 1; i <= 30; i++) {
      const res = await call(db, `/api/days/${dayId}/words`, {
        method: "POST",
        body: { text: `word${i}`, senses: [{ pos: "명사", meanings: [`뜻${i}`] }] },
        cookie: guardian,
      });
      expect(res.status).toBe(201);
    }
    const list = await call(db, `/api/days/${dayId}/words`, { cookie: guardian });
    expect(list.body.words).toHaveLength(30);
    expect(list.body.words[29].text).toBe("word30");
  });

  it("고치면 id 는 그대로, 품사·뜻을 늘리고 줄일 수 있다", async () => {
    const { db, guardian, dayId, sqlite } = await setup();
    const added = await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    const id = added.body.word.id;
    const change = { text: "present", senses: [{ pos: "동사", meanings: ["주다", "제시하다", "발표하다"] }] };
    const put = await call(db, `/api/words/${id}`, { method: "PUT", body: change, cookie: guardian });
    expect(put.status).toBe(200);

    const list = await call(db, `/api/days/${dayId}/words`, { cookie: guardian });
    expect(list.body.words).toEqual([{ id, ...change }]);
    const count = sqlite.prepare("SELECT count(*) AS n FROM meaning").get() as { n: number };
    expect(count.n).toBe(3);
  });

  it("지우면 목록과 뜻에서 모두 빠진다", async () => {
    const { db, guardian, dayId, sqlite } = await setup();
    const added = await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    expect((await call(db, `/api/words/${added.body.word.id}`, { method: "DELETE", cookie: guardian })).status).toBe(200);
    expect((await call(db, `/api/days/${dayId}/words`, { cookie: guardian })).body.words).toEqual([]);
    expect((sqlite.prepare("SELECT count(*) AS n FROM meaning").get() as { n: number }).n).toBe(0);
  });

  it("잘못된 입력은 400 과 한국어 문구", async () => {
    const { db, guardian, dayId } = await setup();
    const res = await call(db, `/api/days/${dayId}/words`, {
      method: "POST",
      body: { text: "cat", senses: [{ pos: "명사", meanings: [""] }] },
      cookie: guardian,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("뜻을 적어");
  });

  it("학생은 볼 수 있지만 넣거나 고칠 수 없다", async () => {
    const { db, guardian, student, dayId } = await setup();
    const added = await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    expect((await call(db, `/api/days/${dayId}/words`, { cookie: student })).body.words).toHaveLength(1);
    expect((await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: student })).status).toBe(403);
    const put = await call(db, `/api/words/${added.body.word.id}`, { method: "PUT", body: PRESENT, cookie: student });
    expect(put.status).toBe(403);
  });

  it("없는 Day·단어는 404", async () => {
    const { db, guardian } = await setup();
    expect((await call(db, "/api/days/999/words", { cookie: guardian })).status).toBe(404);
    expect((await call(db, "/api/words/999", { method: "PUT", body: PRESENT, cookie: guardian })).status).toBe(404);
  });

  it("Day를 지우면 단어도 함께 지워지고 단어 수가 반영된다", async () => {
    const { db, guardian, dayId, sqlite } = await setup();
    await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    const book = sqlite.prepare("SELECT book_id FROM day WHERE id = ?").get(dayId) as { book_id: number };
    expect((await call(db, `/api/books/${book.book_id}`, { cookie: guardian })).body.days[0].wordCount).toBe(1);
    await call(db, `/api/days/${dayId}`, { method: "DELETE", cookie: guardian });
    expect((sqlite.prepare("SELECT count(*) AS n FROM word").get() as { n: number }).n).toBe(0);
  });
});

describe("같은 Day 중복 단어 (#35)", () => {
  it("같은 단어를 다시 넣으면 새로 만들지 않고 기존 단어에 뜻을 더한다 (대소문자 무시)", async () => {
    const { db, guardian, dayId } = await setup();
    const first = await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    const again = await call(db, `/api/days/${dayId}/words`, {
      method: "POST",
      body: {
        text: "Present",
        senses: [
          { pos: "명사", meanings: ["선물", "현재 시제"] },
          { pos: "동사", meanings: ["주다"] },
        ],
      },
      cookie: guardian,
    });
    expect(again.status).toBe(200);
    expect(again.body.merged).toBe(true);
    const expected = {
      id: first.body.word.id,
      text: "present",
      senses: [
        { pos: "명사", meanings: ["선물", "현재", "현재 시제"] },
        { pos: "형용사", meanings: ["출석한", "현재의"] },
        { pos: "동사", meanings: ["주다"] },
      ],
    };
    expect(again.body.word).toEqual(expected);
    const list = await call(db, `/api/days/${dayId}/words`, { cookie: guardian });
    expect(list.body.words).toEqual([expected]);
  });

  it("다른 Day 의 같은 단어는 따로 넣을 수 있다", async () => {
    const { db, guardian, dayId } = await setup();
    const day = await call(db, `/api/days/${dayId}/words`, { cookie: guardian });
    const other = await call(db, `/api/books/${day.body.day.bookId}/days`, { method: "POST", body: {}, cookie: guardian });
    await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    const res = await call(db, `/api/days/${other.body.day.id}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    expect(res.status).toBe(201);
  });

  it("고치기로 같은 Day 의 다른 단어와 철자가 같아지면 409", async () => {
    const { db, guardian, dayId } = await setup();
    await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    const cat = await call(db, `/api/days/${dayId}/words`, {
      method: "POST",
      body: { text: "cat", senses: [{ pos: "명사", meanings: ["고양이"] }] },
      cookie: guardian,
    });
    const id = cat.body.word.id;
    const res = await call(db, `/api/words/${id}`, {
      method: "PUT",
      body: { text: "PRESENT", senses: [{ pos: "명사", meanings: ["고양이"] }] },
      cookie: guardian,
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("이미");
    // 자기 철자의 대소문자만 바꾸는 건 된다
    const self = await call(db, `/api/words/${id}`, {
      method: "PUT",
      body: { text: "Cat", senses: [{ pos: "명사", meanings: ["고양이"] }] },
      cookie: guardian,
    });
    expect(self.status).toBe(200);
  });

  it("붙여넣기는 같은 단어끼리, 그리고 기존 단어와 합친다. 같은 걸 두 번 넣어도 늘지 않는다", async () => {
    const { db, guardian, dayId } = await setup();
    await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    const body = {
      words: [
        { text: "present", senses: [{ pos: "동사", meanings: ["주다"] }] },
        { text: "cat", senses: [{ pos: "명사", meanings: ["고양이"] }] },
        { text: "Cat", senses: [{ pos: "명사", meanings: ["고양잇과 동물"] }] },
      ],
    };
    const first = await call(db, `/api/days/${dayId}/words/bulk`, { method: "POST", body, cookie: guardian });
    expect(first.status).toBe(201);
    const second = await call(db, `/api/days/${dayId}/words/bulk`, { method: "POST", body, cookie: guardian });
    expect(second.body.words).toEqual(first.body.words);
    expect(second.body.words.map((w: { text: string }) => w.text)).toEqual(["present", "cat"]);
    expect(second.body.words[0].senses.at(-1)).toEqual({ pos: "동사", meanings: ["주다"] });
    expect(second.body.words[1].senses).toEqual([{ pos: "명사", meanings: ["고양이", "고양잇과 동물"] }]);
  });
});

describe("여러 단어 한 번에 넣기", () => {
  it("넣은 순서대로 기존 단어 뒤에 붙는다", async () => {
    const { db, guardian, dayId } = await setup();
    await call(db, `/api/days/${dayId}/words`, { method: "POST", body: PRESENT, cookie: guardian });
    const res = await call(db, `/api/days/${dayId}/words/bulk`, {
      method: "POST",
      body: {
        words: [
          { text: "give", senses: [{ pos: "동사", meanings: ["(~을) 주다"] }] },
          { text: "cat", senses: [{ pos: "명사", meanings: ["고양이"] }] },
        ],
      },
      cookie: guardian,
    });
    expect(res.status).toBe(201);
    expect(res.body.words.map((w: { text: string }) => w.text)).toEqual(["present", "give", "cat"]);
    expect(res.body.words[1].senses).toEqual([{ pos: "동사", meanings: ["(~을) 주다"] }]);
  });

  it("하나라도 잘못되면 아무것도 넣지 않고 몇 번째인지 알려 준다", async () => {
    const { db, guardian, dayId, sqlite } = await setup();
    const res = await call(db, `/api/days/${dayId}/words/bulk`, {
      method: "POST",
      body: { words: [PRESENT, { text: "dog", senses: [{ pos: "", meanings: ["개"] }] }] },
      cookie: guardian,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("2번째 단어");
    expect((sqlite.prepare("SELECT count(*) AS n FROM word").get() as { n: number }).n).toBe(0);
  });

  it("학생은 넣을 수 없다", async () => {
    const { db, student, dayId } = await setup();
    const res = await call(db, `/api/days/${dayId}/words/bulk`, { method: "POST", body: { words: [PRESENT] }, cookie: student });
    expect(res.status).toBe(403);
  });
});
