import { describe, expect, it } from "vitest";
import { createFamily } from "../db/family";
import { createBook } from "../db/book";
import { createTestDb } from "../db/testing/sqlite-d1";
import { call, familyWithCookies } from "./testing/api";

async function setup(options?: { manageMode?: "guardian" | "self" }) {
  const { db, sqlite } = createTestDb();
  return { db, sqlite, ...(await familyWithCookies(db, options)) };
}

describe("단어장 API", () => {
  it("로그인하지 않으면 401, 구성원을 고르지 않아도 401", async () => {
    const { db } = await setup();
    expect((await call(db, "/api/books")).status).toBe(401);
    const login = await call(db, "/api/login", { method: "POST", body: { password: "family-pw" } });
    expect((await call(db, "/api/books", { cookie: login.cookie ?? "" })).status).toBe(401);
  });

  it("단어장 두 권을 만들면 따로 보이고, 이름을 바꾸면 바로 반영된다", async () => {
    const { db, guardian } = await setup();
    const a = await call(db, "/api/books", { method: "POST", body: { title: "  학원  단어장 " }, cookie: guardian });
    expect(a.status).toBe(201);
    expect(a.body.book).toMatchObject({ title: "학원 단어장", archived: false, dayCount: 0, wordCount: 0 });
    await call(db, "/api/books", { method: "POST", body: { title: "연습용" }, cookie: guardian });

    const renamed = await call(db, `/api/books/${a.body.book.id}`, {
      method: "PATCH",
      body: { title: "학원 단어장 1권" },
      cookie: guardian,
    });
    expect(renamed.body.book.title).toBe("학원 단어장 1권");

    const list = await call(db, "/api/books", { cookie: guardian });
    expect(list.body.books.map((b: { title: string }) => b.title)).toEqual(["학원 단어장 1권", "연습용"]);
  });

  it("보관한 단어장은 목록에서 빠지지만 지워지지 않고, 다시 꺼낼 수 있다", async () => {
    const { db, guardian } = await setup();
    const book = await call(db, "/api/books", { method: "POST", body: { title: "지난 단어장" }, cookie: guardian });
    const id = book.body.book.id;
    await call(db, `/api/books/${id}/days`, { method: "POST", body: {}, cookie: guardian });

    const archived = await call(db, `/api/books/${id}`, { method: "PATCH", body: { archived: true }, cookie: guardian });
    expect(archived.body.book.archived).toBe(true);
    expect((await call(db, "/api/books", { cookie: guardian })).body.books).toEqual([]);

    const all = await call(db, "/api/books?archived=1", { cookie: guardian });
    expect(all.body.books).toHaveLength(1);
    expect(all.body.books[0]).toMatchObject({ archived: true, dayCount: 1 });

    await call(db, `/api/books/${id}`, { method: "PATCH", body: { archived: false }, cookie: guardian });
    expect((await call(db, "/api/books", { cookie: guardian })).body.books).toHaveLength(1);
  });

  it("빈 이름이나 너무 긴 이름은 400", async () => {
    const { db, guardian } = await setup();
    expect((await call(db, "/api/books", { method: "POST", body: { title: "  " }, cookie: guardian })).status).toBe(400);
    const long = await call(db, "/api/books", { method: "POST", body: { title: "가".repeat(41) }, cookie: guardian });
    expect(long.status).toBe(400);
    expect(long.body.message).toContain("40자");
  });
});

describe("권한", () => {
  it("보호자 관리에서는 학생이 단어장을 볼 수는 있어도 고칠 수 없다", async () => {
    const { db, guardian, student } = await setup();
    const book = await call(db, "/api/books", { method: "POST", body: { title: "단어장" }, cookie: guardian });
    expect((await call(db, "/api/books", { cookie: student })).body.books).toHaveLength(1);
    const denied = await call(db, "/api/books", { method: "POST", body: { title: "몰래" }, cookie: student });
    expect(denied.status).toBe(403);
    const patch = await call(db, `/api/books/${book.body.book.id}`, {
      method: "PATCH",
      body: { title: "x" },
      cookie: student,
    });
    expect(patch.status).toBe(403);
  });

  it("혼자 관리에서는 학생이 단어장을 만들 수 있다 (역할이 아니라 권한)", async () => {
    const { db, student, guardian } = await setup({ manageMode: "self" });
    expect((await call(db, "/api/books", { method: "POST", body: { title: "내 단어장" }, cookie: student })).status).toBe(
      201,
    );
    expect((await call(db, "/api/books", { method: "POST", body: { title: "x" }, cookie: guardian })).status).toBe(403);
  });

  it("다른 가족의 단어장은 보이지도 고쳐지지도 않는다", async () => {
    const { db, guardian } = await setup();
    const other = await createFamily(db, "다른 가족");
    const book = await createBook(db, { familyId: other.id, title: "남의 단어장" });
    expect((await call(db, `/api/books/${book.id}`, { cookie: guardian })).status).toBe(404);
    const patch = await call(db, `/api/books/${book.id}`, { method: "PATCH", body: { title: "x" }, cookie: guardian });
    expect(patch.status).toBe(404);
    const day = await call(db, `/api/books/${book.id}/days`, { method: "POST", body: {}, cookie: guardian });
    expect(day.status).toBe(404);
  });
});

async function bookWithDays(count: number) {
  const ctx = await setup();
  const book = await call(ctx.db, "/api/books", { method: "POST", body: { title: "단어장" }, cookie: ctx.guardian });
  const bookId = book.body.book.id as number;
  let last: { body: { days: { id: number; dayNumber: number; title: string | null }[] } } = { body: { days: [] } };
  for (let i = 0; i < count; i++) {
    last = await call(ctx.db, `/api/books/${bookId}/days`, { method: "POST", body: {}, cookie: ctx.guardian });
  }
  return { ...ctx, bookId, days: last.body.days };
}

describe("Day API", () => {
  it("번호를 비우면 마지막 번호 + 1, 직접 적으면 그 번호로 만든다", async () => {
    const { db, guardian, bookId, days } = await bookWithDays(2);
    expect(days.map((d) => d.dayNumber)).toEqual([1, 2]);
    const day = await call(db, `/api/books/${bookId}/days`, {
      method: "POST",
      body: { dayNumber: "11", title: "동물" },
      cookie: guardian,
    });
    expect(day.status).toBe(201);
    expect(day.body.day).toMatchObject({ dayNumber: 11, title: "동물", wordCount: 0 });
    const next = await call(db, `/api/books/${bookId}/days`, { method: "POST", body: {}, cookie: guardian });
    expect(next.body.day.dayNumber).toBe(12);
  });

  it("이미 있는 번호는 409", async () => {
    const { db, guardian, bookId, days } = await bookWithDays(2);
    const dup = await call(db, `/api/books/${bookId}/days`, { method: "POST", body: { dayNumber: 2 }, cookie: guardian });
    expect(dup.status).toBe(409);
    const patch = await call(db, `/api/days/${days[0]!.id}`, { method: "PATCH", body: { dayNumber: 2 }, cookie: guardian });
    expect(patch.status).toBe(409);
    expect(patch.body.message).toContain("Day 2");
  });

  it("번호·제목을 고칠 수 있다", async () => {
    const { db, guardian, days } = await bookWithDays(1);
    const patch = await call(db, `/api/days/${days[0]!.id}`, {
      method: "PATCH",
      body: { dayNumber: 5, title: " 과일 " },
      cookie: guardian,
    });
    expect(patch.body.days[0]).toMatchObject({ dayNumber: 5, title: "과일" });
    const cleared = await call(db, `/api/days/${days[0]!.id}`, { method: "PATCH", body: { title: "" }, cookie: guardian });
    expect(cleared.body.days[0].title).toBeNull();
  });

  it("위·아래로 옮기면 번호를 맞바꾸고, 맨 끝에서는 그대로다", async () => {
    const { db, guardian, days } = await bookWithDays(3);
    const [d1, d2, d3] = days;
    const moved = await call(db, `/api/days/${d3!.id}/move`, { method: "POST", body: { direction: "up" }, cookie: guardian });
    expect(moved.body.days.map((d: { id: number }) => d.id)).toEqual([d1!.id, d3!.id, d2!.id]);
    expect(moved.body.days.map((d: { dayNumber: number }) => d.dayNumber)).toEqual([1, 2, 3]);

    const top = await call(db, `/api/days/${d1!.id}/move`, { method: "POST", body: { direction: "up" }, cookie: guardian });
    expect(top.body.days.map((d: { id: number }) => d.id)).toEqual([d1!.id, d3!.id, d2!.id]);
  });

  it("Day를 지우면 목록에서 빠진다", async () => {
    const { db, guardian, days } = await bookWithDays(3);
    const res = await call(db, `/api/days/${days[1]!.id}`, { method: "DELETE", cookie: guardian });
    expect(res.body.days.map((d: { dayNumber: number }) => d.dayNumber)).toEqual([1, 3]);
    expect(res.body.book.dayCount).toBe(2);
  });

  it("학생은 Day를 고칠 수 없다", async () => {
    const { db, student, days } = await bookWithDays(1);
    expect((await call(db, `/api/days/${days[0]!.id}`, { method: "DELETE", cookie: student })).status).toBe(403);
  });
});
