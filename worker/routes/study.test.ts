import { describe, expect, it } from "vitest";
import { addMember } from "../db/family";
import { createTestDb } from "../db/testing/sqlite-d1";
import { call, familyWithCookies } from "./testing/api";

async function setup() {
  const { db } = createTestDb();
  const ctx = await familyWithCookies(db);
  const book = await call(db, "/api/books", { method: "POST", body: { title: "예시 단어장" }, cookie: ctx.guardian });
  const bookId = book.body.book.id as number;
  const d1 = await call(db, `/api/books/${bookId}/days`, { method: "POST", body: {}, cookie: ctx.guardian });
  const d2 = await call(db, `/api/books/${bookId}/days`, { method: "POST", body: {}, cookie: ctx.guardian });
  return { db, ...ctx, bookId, day1: d1.body.day.id as number, day2: d2.body.day.id as number };
}

const done = (dayIds: number[], stage = "blind") => ({ stage, direction: "en_ko", dayIds, wordCount: 10 });

describe("외우기 완료 기록", () => {
  it("학생이 완료하면 범위에 든 Day 마다 그 단계가 1회씩 오른다", async () => {
    const { db, student, bookId, day1, day2, kid } = await setup();
    expect((await call(db, "/api/study/completions", { method: "POST", body: done([day1, day2]), cookie: student })).status).toBe(201);
    await call(db, "/api/study/completions", { method: "POST", body: done([day1], "choice"), cookie: student });
    await call(db, "/api/study/completions", { method: "POST", body: done([day1], "choice"), cookie: student });

    const res = await call(db, `/api/books/${bookId}/study-records`, { cookie: student });
    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe(kid.id);
    const byDay = Object.fromEntries(res.body.days.map((d: { dayId: number }) => [d.dayId, d]));
    expect(byDay[day1]).toEqual({ dayId: day1, blind: 1, choice: 2, write: 0 });
    expect(byDay[day2]).toEqual({ dayId: day2, blind: 1, choice: 0, write: 0 });
  });

  it("보호자는 아이를 골라 기록을 보고, 보호자 자신은 기록을 남기지 않는다", async () => {
    const { db, guardian, student, bookId, day1, kid } = await setup();
    await call(db, "/api/study/completions", { method: "POST", body: done([day1]), cookie: student });
    const res = await call(db, `/api/books/${bookId}/study-records?studentId=${kid.id}`, { cookie: guardian });
    expect(res.body.days).toEqual([{ dayId: day1, blind: 1, choice: 0, write: 0 }]);
    const own = await call(db, "/api/study/completions", { method: "POST", body: done([day1]), cookie: guardian });
    expect(own.status).toBe(403);
  });

  it("학생은 다른 학생의 기록을 볼 수 없다", async () => {
    const { db, student, family, bookId } = await setup();
    const other = await addMember(db, { familyId: family.id, name: "둘째", role: "student", sortOrder: 2 });
    const res = await call(db, `/api/books/${bookId}/study-records?studentId=${other.id}`, { cookie: student });
    expect(res.status).toBe(403);
  });

  it("잘못된 단계·없는 Day 는 받지 않는다", async () => {
    const { db, student, day1 } = await setup();
    const bad = await call(db, "/api/study/completions", { method: "POST", body: done([day1], "speed"), cookie: student });
    expect(bad.status).toBe(400);
    const missing = await call(db, "/api/study/completions", { method: "POST", body: done([day1, 999]), cookie: student });
    expect(missing.status).toBe(404);
  });

  it("로그인하지 않으면 401", async () => {
    const { db, bookId } = await setup();
    expect((await call(db, `/api/books/${bookId}/study-records`)).status).toBe(401);
  });
});
