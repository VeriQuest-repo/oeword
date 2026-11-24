// 단어장·Day API (#4). 읽기는 구성원을 고른 누구나, 쓰기는 관리 권한이 있어야 합니다.
//
//   GET    /api/books?archived=1        단어장 목록 (archived=1 이면 보관한 것도)
//   POST   /api/books                   단어장 만들기 { title }
//   GET    /api/books/:bookId           단어장 한 권과 Day 목록
//   PATCH  /api/books/:bookId           이름 바꾸기 { title }, 보관 { archived: true }, 다시 꺼내기 { archived: false }
//   POST   /api/books/:bookId/days      Day 추가 { dayNumber?, title? } (번호를 비우면 마지막 번호 + 1)
//   PATCH  /api/days/:dayId             Day 번호·제목 고치기 { dayNumber?, title? }
//   POST   /api/days/:dayId/move        Day 순서 바꾸기 { direction: "up" | "down" }
//   DELETE /api/days/:dayId             Day 삭제 (안의 단어도 함께)
import {
  type BookDetail,
  type BookSummary,
  checkBookTitle,
  checkDayNumber,
  checkDayTitle,
  type DaySummary,
} from "../../src/lib/books";
import {
  type BookRow,
  createBook,
  createDay,
  dayNumberTaken,
  type DayRow,
  deleteDay,
  getBookRow,
  getDayRow,
  listBookRows,
  listDayRows,
  nextBookSortOrder,
  nextDayNumber,
  swapDayNumbers,
  updateBook,
  updateDay,
} from "../db/book";
import { dispatch, fail, json, readJson, requireActor, type Route } from "./http";

function iso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function bookSummary(row: BookRow): BookSummary {
  return {
    id: row.id,
    title: row.title,
    archived: row.archived_at !== null,
    dayCount: row.day_count,
    wordCount: row.word_count,
  };
}

export function daySummary(row: DayRow): DaySummary {
  return { id: row.id, dayNumber: row.day_number, title: row.title, wordCount: row.word_count };
}

const BOOK_NOT_FOUND = () => fail(404, "book_not_found", "단어장을 찾지 못했어요.");
const DAY_NOT_FOUND = () => fail(404, "day_not_found", "Day를 찾지 못했어요.");
const BAD_INPUT = () => fail(400, "invalid_input", "입력 내용을 읽지 못했어요.");
const dayTaken = (n: number) => fail(409, "day_number_taken", `Day ${n}이(가) 이미 있어요. 다른 번호로 적어 주세요.`);

async function bookDetail(db: D1Database, familyId: number, bookId: number): Promise<BookDetail | null> {
  const book = await getBookRow(db, familyId, bookId);
  if (!book) return null;
  const days = await listDayRows(db, familyId, bookId);
  return { book: bookSummary(book), days: days.map(daySummary) };
}

function asObject(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export const BOOK_ROUTES: Route[] = [
  {
    pattern: "/api/books",
    methods: {
      async GET(request, db, now) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
        const rows = await listBookRows(db, actor.familyId, { includeArchived });
        return json({ books: rows.map(bookSummary) });
      },
      async POST(request, db, now) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const body = asObject(await readJson(request));
        if (!body) return BAD_INPUT();
        const title = checkBookTitle(body.title);
        if (!title.ok) return fail(400, "invalid_input", title.message);
        const book = await createBook(db, {
          familyId: actor.familyId,
          title: title.value,
          sortOrder: await nextBookSortOrder(db, actor.familyId),
        });
        const detail = await bookDetail(db, actor.familyId, book.id);
        return json(detail, { status: 201 });
      },
    },
  },
  {
    pattern: "/api/books/:bookId",
    methods: {
      async GET(request, db, now, { bookId }) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const detail = await bookDetail(db, actor.familyId, bookId!);
        return detail ? json(detail) : BOOK_NOT_FOUND();
      },
      async PATCH(request, db, now, { bookId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const body = asObject(await readJson(request));
        if (!body) return BAD_INPUT();
        const change: { title?: string; archivedAt?: string | null } = {};
        if (body.title !== undefined) {
          const title = checkBookTitle(body.title);
          if (!title.ok) return fail(400, "invalid_input", title.message);
          change.title = title.value;
        }
        if (body.archived !== undefined) {
          if (typeof body.archived !== "boolean") return BAD_INPUT();
          change.archivedAt = body.archived ? iso(now) : null;
        }
        if (!(await getBookRow(db, actor.familyId, bookId!))) return BOOK_NOT_FOUND();
        await updateBook(db, actor.familyId, bookId!, change);
        return json(await bookDetail(db, actor.familyId, bookId!));
      },
    },
  },
  {
    pattern: "/api/books/:bookId/days",
    methods: {
      async POST(request, db, now, { bookId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const body = asObject(await readJson(request));
        if (!body) return BAD_INPUT();
        if (!(await getBookRow(db, actor.familyId, bookId!))) return BOOK_NOT_FOUND();

        const title = checkDayTitle(body.title);
        if (!title.ok) return fail(400, "invalid_input", title.message);
        let dayNumber: number;
        if (body.dayNumber === undefined || body.dayNumber === null || body.dayNumber === "") {
          dayNumber = await nextDayNumber(db, bookId!);
        } else {
          const checked = checkDayNumber(body.dayNumber);
          if (!checked.ok) return fail(400, "invalid_input", checked.message);
          dayNumber = checked.value;
        }
        if (await dayNumberTaken(db, bookId!, dayNumber)) return dayTaken(dayNumber);

        const day = await createDay(db, { bookId: bookId!, dayNumber, title: title.value ?? undefined });
        const row = await getDayRow(db, actor.familyId, day.id);
        return json(
          { day: row ? daySummary(row) : null, ...(await bookDetail(db, actor.familyId, bookId!)) },
          { status: 201 },
        );
      },
    },
  },
  {
    pattern: "/api/days/:dayId",
    methods: {
      async PATCH(request, db, now, { dayId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const body = asObject(await readJson(request));
        if (!body) return BAD_INPUT();
        const day = await getDayRow(db, actor.familyId, dayId!);
        if (!day) return DAY_NOT_FOUND();

        const change: { dayNumber?: number; title?: string | null } = {};
        if (body.title !== undefined) {
          const title = checkDayTitle(body.title);
          if (!title.ok) return fail(400, "invalid_input", title.message);
          change.title = title.value;
        }
        if (body.dayNumber !== undefined) {
          const checked = checkDayNumber(body.dayNumber);
          if (!checked.ok) return fail(400, "invalid_input", checked.message);
          if (await dayNumberTaken(db, day.book_id, checked.value, day.id)) return dayTaken(checked.value);
          change.dayNumber = checked.value;
        }
        await updateDay(db, day.id, change);
        return json(await bookDetail(db, actor.familyId, day.book_id));
      },
      async DELETE(request, db, now, { dayId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const day = await getDayRow(db, actor.familyId, dayId!);
        if (!day) return DAY_NOT_FOUND();
        await deleteDay(db, day.id);
        return json(await bookDetail(db, actor.familyId, day.book_id));
      },
    },
  },
  {
    pattern: "/api/days/:dayId/move",
    methods: {
      async POST(request, db, now, { dayId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const body = asObject(await readJson(request));
        const direction = body?.direction;
        if (direction !== "up" && direction !== "down") return BAD_INPUT();
        const day = await getDayRow(db, actor.familyId, dayId!);
        if (!day) return DAY_NOT_FOUND();

        const days = await listDayRows(db, actor.familyId, day.book_id);
        const index = days.findIndex((d) => d.id === day.id);
        const other = days[direction === "up" ? index - 1 : index + 1];
        if (other) await swapDayNumbers(db, day, other);
        return json(await bookDetail(db, actor.familyId, day.book_id));
      },
    },
  },
];

export function handleBookApi(request: Request, db: D1Database, now: Date = new Date()): Promise<Response | null> {
  return dispatch(BOOK_ROUTES, request, db, now);
}
