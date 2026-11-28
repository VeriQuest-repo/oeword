import { describe, expect, it } from "vitest";
import { addMember } from "../db/family";
import { createTestDb } from "../db/testing/sqlite-d1";
import { call, familyWithCookies, NOW } from "./testing/api";

// 직접 만든 짧은 예시 단어만 씁니다 (CLAUDE.md 6장).
async function setup() {
  const { db } = createTestDb();
  const ctx = await familyWithCookies(db);
  const book = await call(db, "/api/books", { method: "POST", body: { title: "예시 단어장" }, cookie: ctx.guardian });
  const bookId = book.body.book.id as number;
  const d1 = (await call(db, `/api/books/${bookId}/days`, { method: "POST", body: {}, cookie: ctx.guardian })).body.day.id as number;
  const d2 = (await call(db, `/api/books/${bookId}/days`, { method: "POST", body: {}, cookie: ctx.guardian })).body.day.id as number;
  const add = async (dayId: number, text: string, senses: { pos: string; meanings: string[] }[]) =>
    (await call(db, `/api/days/${dayId}/words`, { method: "POST", body: { text, senses }, cookie: ctx.guardian })).body.word
      .id as number;
  const present = await add(d1, "present", [
    { pos: "명사", meanings: ["선물", "현재"] },
    { pos: "형용사", meanings: ["출석한"] },
  ]);
  const give = await add(d1, "give", [{ pos: "동사", meanings: ["(~을) 주다"] }]);
  const apple = await add(d2, "apple", [{ pos: "명사", meanings: ["사과"] }]);
  // Day 2 에도 present 가 있으면 한 문제로 합치고 뜻도 합칩니다.
  const present2 = await add(d2, "Present", [{ pos: "동사", meanings: ["주다"] }]);
  return { db, ...ctx, bookId, d1, d2, present, present2, give, apple };
}

const startedAt = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();

describe("화면 시험 채점", () => {
  it("학생이 다 푼 시험을 보내면 한꺼번에 채점하고 저장한다", async () => {
    const { db, student, kid, d1, d2, present, give, apple } = await setup();
    const res = await call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: {
        mode: "full",
        direction: "mixed",
        firstLetterHint: true,
        dayIds: [d2, d1],
        startedAt,
        items: [
          { wordId: present, direction: "en_ko", answer: { 명사: "현재", 형용사: "출석한", 동사: "주다" } },
          { wordId: give, direction: "en_ko", answer: { 동사: "~을 주다" } },
          { wordId: apple, direction: "ko_en", answer: "  Apple " },
        ],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      testNumber: 1,
      studentId: kid.id,
      mode: "full",
      direction: "mixed",
      firstLetterHint: true,
      dayIds: [d1, d2],
      dayLabels: ["Day 1", "Day 2"],
      correctCount: 3,
      total: 3,
      createdAt: "2026-11-24T04:55:00Z",
      finishedAt: "2026-11-24T05:00:00Z",
    });
    // 여러 Day 의 같은 단어는 뜻을 합쳐 채점
    expect(res.body.items[0].senses.map((s: { pos: string }) => s.pos)).toEqual(["명사", "형용사", "동사"]);

    const rows = await db.prepare("SELECT position, answer, is_correct FROM test_item ORDER BY position").all();
    expect(rows.results).toEqual([
      { position: 1, answer: JSON.stringify({ 명사: "현재", 형용사: "출석한", 동사: "주다" }), is_correct: 1 },
      { position: 2, answer: JSON.stringify({ 동사: "~을 주다" }), is_correct: 1 },
      { position: 3, answer: "  Apple ", is_correct: 1 },
    ]);
  });

  it("품사 하나라도 비거나 틀리면 그 문제는 틀림, 시험 번호는 이어진다", async () => {
    const { db, student, d1, present, give } = await setup();
    const body = (answer: Record<string, string>) => ({
      mode: "full",
      direction: "en_ko",
      firstLetterHint: false,
      dayIds: [d1],
      startedAt,
      items: [
        { wordId: present, direction: "en_ko", answer },
        { wordId: give, direction: "en_ko", answer: { 동사: "주는" } },
      ],
    });
    const first = await call(db, "/api/tests", { method: "POST", cookie: student, body: body({ 명사: "선물" }) });
    expect(first.body.correctCount).toBe(0);
    expect(first.body.items[0].senseGrades.map((g: { correct: boolean }) => g.correct)).toEqual([true, false]);
    const second = await call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: body({ 명사: "선물, 현재", 형용사: "출석한" }),
    });
    expect(second.body.testNumber).toBe(2);
    expect(second.body.correctCount).toBe(1);
  });

  it("보호자가 본 시험은 채점만 하고 저장하지 않는다", async () => {
    const { db, guardian, d2, apple } = await setup();
    const res = await call(db, "/api/tests", {
      method: "POST",
      cookie: guardian,
      body: {
        mode: "full",
        direction: "ko_en",
        firstLetterHint: false,
        dayIds: [d2],
        startedAt,
        items: [{ wordId: apple, direction: "ko_en", answer: "aple" }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: null, testNumber: null, correctCount: 0, total: 1 });
    const count = await db.prepare("SELECT count(*) AS n FROM test").first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it("범위 밖 단어·형식이 맞지 않는 문제·이상한 시작 시각을 막거나 고친다", async () => {
    const { db, student, d1, apple, give } = await setup();
    const base = { mode: "full", direction: "en_ko", firstLetterHint: false, dayIds: [d1], startedAt };
    const outside = await call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: { ...base, items: [{ wordId: apple, direction: "en_ko", answer: {} }] },
    });
    expect(outside.status).toBe(409);
    const wrongDirection = await call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: { ...base, items: [{ wordId: give, direction: "ko_en", answer: "give" }] },
    });
    expect(wrongDirection.status).toBe(400);
    const future = await call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: { ...base, startedAt: "2030-01-01T00:00:00Z", items: [{ wordId: give, direction: "en_ko", answer: {} }] },
    });
    expect(future.body.createdAt).toBe("2026-11-24T05:00:00Z");
    const missingDay = await call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: { ...base, dayIds: [999], items: [{ wordId: give, direction: "en_ko", answer: {} }] },
    });
    expect(missingDay.status).toBe(404);
  });

  it("로그인하지 않으면 401", async () => {
    const { db, d1, give } = await setup();
    const body = {
      mode: "full",
      direction: "en_ko",
      firstLetterHint: false,
      dayIds: [d1],
      startedAt,
      items: [{ wordId: give, direction: "en_ko", answer: {} }],
    };
    expect((await call(db, "/api/tests", { method: "POST", body })).status).toBe(401);
  });
});

async function twoTests() {
  const ctx = await setup();
  const { db, student, d1, present, give } = ctx;
  const submit = (answers: [Record<string, string>, Record<string, string>]) =>
    call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: {
        mode: "full",
        direction: "en_ko",
        firstLetterHint: false,
        dayIds: [d1],
        startedAt,
        items: [
          { wordId: present, direction: "en_ko", answer: answers[0] },
          { wordId: give, direction: "en_ko", answer: answers[1] },
        ],
      },
    });
  const first = await submit([{ 명사: "선물", 형용사: "출석한" }, { 동사: "주는" }]);
  const second = await submit([{ 명사: "사과" }, { 동사: "주다" }]);
  return { ...ctx, first: first.body, second: second.body };
}

describe("시험 기록 (#11)", () => {
  it("시험을 저장하면 단어별 기록(맞힌·틀린 횟수, 마지막 결과)이 쌓인다", async () => {
    const { db, kid, present, give } = await twoTests();
    const rows = await db
      .prepare("SELECT word_id, correct_count, wrong_count, last_correct, last_seen_at FROM word_stat WHERE student_id = ? ORDER BY word_id")
      .bind(kid.id)
      .all();
    expect(rows.results).toEqual([
      { word_id: present, correct_count: 1, wrong_count: 1, last_correct: 0, last_seen_at: "2026-11-24T05:00:00Z" },
      { word_id: give, correct_count: 1, wrong_count: 1, last_correct: 1, last_seen_at: "2026-11-24T05:00:00Z" },
    ]);
  });

  it("지난 시험 목록과 결과를 다시 열 수 있다 (내 답과 단어장 뜻)", async () => {
    const { db, student, first, second } = await twoTests();
    const list = await call(db, "/api/tests", { cookie: student });
    expect(list.status).toBe(200);
    expect(list.body.tests.map((t: { testNumber: number }) => t.testNumber)).toEqual([2, 1]);
    expect(list.body.tests[1]).toMatchObject({ id: first.id, correctCount: 1, total: 2, dayLabels: ["Day 1"], mode: "full" });

    const detail = await call(db, `/api/tests/${second.id}`, { cookie: student });
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ testNumber: 2, correctCount: 1, total: 2, dayLabels: ["Day 1"] });
    expect(detail.body.items[0]).toMatchObject({ position: 1, text: "present", answer: { 명사: "사과" }, correct: false });
    expect(detail.body.items[0].senseGrades[0]).toMatchObject({ pos: "명사", answer: "사과", correct: false, meanings: ["선물", "현재"] });
  });

  it("보호자는 아이 시험을 보고, 학생은 다른 학생 시험을 볼 수 없다", async () => {
    const { db, guardian, kid, family, first } = await twoTests();
    const list = await call(db, `/api/tests?studentId=${kid.id}`, { cookie: guardian });
    expect(list.body.tests).toHaveLength(2);
    expect((await call(db, `/api/tests/${first.id}`, { cookie: guardian })).status).toBe(200);

    const other = await addMember(db, { familyId: family.id, name: "둘째", role: "student", sortOrder: 2 });
    const login = await call(db, "/api/login", { method: "POST", body: { password: "family-pw" } });
    await call(db, "/api/session/member", { method: "PUT", body: { memberId: other.id }, cookie: login.cookie! });
    expect((await call(db, `/api/tests/${first.id}`, { cookie: login.cookie! })).status).toBe(403);
    expect((await call(db, `/api/tests?studentId=${kid.id}`, { cookie: login.cookie! })).status).toBe(403);
    expect((await call(db, "/api/tests/9999", { cookie: guardian })).status).toBe(404);
  });

  it("90문제 시험도 저장된다 (여러 줄을 묶어 넣기)", async () => {
    const { db, guardian, student, d1 } = await setup();
    const words = Array.from({ length: 90 }, (_, i) => ({ text: `word${i}`, senses: [{ pos: "명사", meanings: [`뜻${i}`] }] }));
    const bulk = await call(db, `/api/days/${d1}/words/bulk`, { method: "POST", body: { words }, cookie: guardian });
    const ids = bulk.body.words.map((w: { id: number }) => w.id) as number[];
    const res = await call(db, "/api/tests", {
      method: "POST",
      cookie: student,
      body: {
        mode: "full",
        direction: "ko_en",
        firstLetterHint: true,
        dayIds: [d1],
        startedAt,
        items: ids.map((wordId) => ({ wordId, direction: "ko_en", answer: "" })),
      },
    });
    expect(res.status).toBe(201);
    const count = await db.prepare("SELECT count(*) AS n FROM test_item").first<{ n: number }>();
    expect(count?.n).toBe(ids.length);
  });
});
