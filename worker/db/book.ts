// 단어장·Day·단어·품사별 뜻 읽기·쓰기. D1 쿼리는 worker/db/ 안에만 둡니다 (CLAUDE.md 4장).
import type { Book, Day, Meaning, Word, WordWithMeanings } from "./types";

export async function createBook(
  db: D1Database,
  input: { familyId: number; title: string; sortOrder?: number },
): Promise<Book> {
  const book = await db
    .prepare(
      `INSERT INTO book (family_id, title, sort_order) VALUES (?, ?, ?)
       RETURNING id, family_id, title, sort_order, archived_at, created_at`,
    )
    .bind(input.familyId, input.title, input.sortOrder ?? 0)
    .first<Book>();
  if (!book) throw new Error("단어장을 만들지 못했습니다.");
  return book;
}

/** 가족의 단어장 목록. 보관한 단어장은 includeArchived 일 때만. */
export async function listBooks(
  db: D1Database,
  familyId: number,
  options: { includeArchived?: boolean } = {},
): Promise<Book[]> {
  const where = options.includeArchived ? "" : " AND archived_at IS NULL";
  const { results } = await db
    .prepare(
      `SELECT id, family_id, title, sort_order, archived_at, created_at FROM book
       WHERE family_id = ?${where} ORDER BY sort_order, id`,
    )
    .bind(familyId)
    .all<Book>();
  return results;
}

export async function createDay(
  db: D1Database,
  input: { bookId: number; dayNumber: number; title?: string },
): Promise<Day> {
  const day = await db
    .prepare(
      `INSERT INTO day (book_id, day_number, title) VALUES (?, ?, ?)
       RETURNING id, book_id, day_number, title, created_at`,
    )
    .bind(input.bookId, input.dayNumber, input.title ?? null)
    .first<Day>();
  if (!day) throw new Error("Day를 만들지 못했습니다.");
  return day;
}

export async function listDays(db: D1Database, bookId: number): Promise<Day[]> {
  const { results } = await db
    .prepare(
      `SELECT id, book_id, day_number, title, created_at FROM day
       WHERE book_id = ? ORDER BY day_number`,
    )
    .bind(bookId)
    .all<Day>();
  return results;
}

export interface MeaningInput {
  pos: string;
  text: string;
}

/**
 * 단어 하나와 품사별 뜻을 한 번에(트랜잭션으로) 넣습니다.
 * 뜻은 넣은 순서대로 sort_order 가 붙습니다.
 */
export async function addWord(
  db: D1Database,
  input: { dayId: number; text: string; meanings: MeaningInput[]; sortOrder?: number },
): Promise<WordWithMeanings> {
  if (input.meanings.length === 0) throw new Error("뜻이 하나 이상 있어야 합니다.");
  // batch 는 하나의 트랜잭션이라 중간에 다른 쓰기가 끼어들지 않습니다.
  // 그래서 방금 넣은 단어의 id 는 word 표의 가장 큰 id 입니다.
  const insertMeaning = db.prepare(
    `INSERT INTO meaning (word_id, pos, text, sort_order)
     VALUES ((SELECT max(id) FROM word), ?, ?, ?)
     RETURNING id, word_id, pos, text, sort_order`,
  );
  const [wordResult, ...meaningResults] = await db.batch([
    db
      .prepare(
        `INSERT INTO word (day_id, text, sort_order) VALUES (?, ?, ?)
         RETURNING id, day_id, text, sort_order, created_at`,
      )
      .bind(input.dayId, input.text, input.sortOrder ?? 0),
    ...input.meanings.map((m, i) => insertMeaning.bind(m.pos, m.text, i)),
  ]);
  const word = wordResult.results[0] as unknown as Word;
  const meanings = meaningResults.map((r) => r.results[0] as unknown as Meaning);
  return { ...word, meanings };
}

/** Day 하나의 단어를 품사별 뜻과 함께 순서대로 가져옵니다. */
export async function listWords(db: D1Database, dayId: number): Promise<WordWithMeanings[]> {
  const [words, meanings] = await db.batch([
    db
      .prepare(
        `SELECT id, day_id, text, sort_order, created_at FROM word
         WHERE day_id = ? ORDER BY sort_order, id`,
      )
      .bind(dayId),
    db
      .prepare(
        `SELECT m.id, m.word_id, m.pos, m.text, m.sort_order FROM meaning m
         JOIN word w ON w.id = m.word_id
         WHERE w.day_id = ? ORDER BY m.word_id, m.sort_order, m.id`,
      )
      .bind(dayId),
  ]);
  const byWord = new Map<number, Meaning[]>();
  for (const m of meanings.results as unknown as Meaning[]) {
    const list = byWord.get(m.word_id) ?? [];
    list.push(m);
    byWord.set(m.word_id, list);
  }
  return (words.results as unknown as Word[]).map((w) => ({ ...w, meanings: byWord.get(w.id) ?? [] }));
}

// 단어장·Day 관리 (#4) ---------------------------------------------------
// 아래 함수는 모두 familyId 로 범위를 좁혀, 다른 가족의 단어장을 읽거나 고칠 수 없게 합니다.

/** 단어장 한 권과 Day 수·단어 수 */
export interface BookRow extends Book {
  day_count: number;
  word_count: number;
}

const BOOK_WITH_COUNTS = `
  SELECT b.id, b.family_id, b.title, b.sort_order, b.archived_at, b.created_at,
    (SELECT count(*) FROM day d WHERE d.book_id = b.id) AS day_count,
    (SELECT count(*) FROM word w JOIN day d ON d.id = w.day_id WHERE d.book_id = b.id) AS word_count
  FROM book b`;

/** 단어장 목록 (Day 수·단어 수 포함). 보관한 단어장은 includeArchived 일 때만. */
export async function listBookRows(
  db: D1Database,
  familyId: number,
  options: { includeArchived?: boolean } = {},
): Promise<BookRow[]> {
  const where = options.includeArchived ? "" : " AND b.archived_at IS NULL";
  const { results } = await db
    .prepare(`${BOOK_WITH_COUNTS} WHERE b.family_id = ?${where} ORDER BY b.archived_at IS NOT NULL, b.sort_order, b.id`)
    .bind(familyId)
    .all<BookRow>();
  return results;
}

export async function getBookRow(db: D1Database, familyId: number, bookId: number): Promise<BookRow | null> {
  return db.prepare(`${BOOK_WITH_COUNTS} WHERE b.family_id = ? AND b.id = ?`).bind(familyId, bookId).first<BookRow>();
}

/** 새 단어장은 목록 맨 뒤에 붙습니다. */
export async function nextBookSortOrder(db: D1Database, familyId: number): Promise<number> {
  const row = await db
    .prepare("SELECT coalesce(max(sort_order), -1) + 1 AS next FROM book WHERE family_id = ?")
    .bind(familyId)
    .first<{ next: number }>();
  return row?.next ?? 0;
}

/** 이름 바꾸기, 보관(archivedAt 에 시각) · 다시 꺼내기(null). 고친 줄 수를 돌려줍니다. */
export async function updateBook(
  db: D1Database,
  familyId: number,
  bookId: number,
  change: { title?: string; archivedAt?: string | null },
): Promise<number> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  if (change.title !== undefined) {
    sets.push("title = ?");
    values.push(change.title);
  }
  if (change.archivedAt !== undefined) {
    sets.push("archived_at = ?");
    values.push(change.archivedAt);
  }
  if (sets.length === 0) return 0;
  const result = await db
    .prepare(`UPDATE book SET ${sets.join(", ")} WHERE family_id = ? AND id = ?`)
    .bind(...values, familyId, bookId)
    .run();
  return result.meta.changes;
}

/** Day 하나와 단어 수 */
export interface DayRow extends Day {
  word_count: number;
}

/** 단어장의 Day 목록 (단어 수 포함). 다른 가족의 단어장이면 빈 목록. */
export async function listDayRows(db: D1Database, familyId: number, bookId: number): Promise<DayRow[]> {
  const { results } = await db
    .prepare(
      `SELECT d.id, d.book_id, d.day_number, d.title, d.created_at,
         (SELECT count(*) FROM word w WHERE w.day_id = d.id) AS word_count
       FROM day d JOIN book b ON b.id = d.book_id
       WHERE b.family_id = ? AND d.book_id = ? ORDER BY d.day_number`,
    )
    .bind(familyId, bookId)
    .all<DayRow>();
  return results;
}

/** Day 하나 (가족 범위 확인). 단어장 이름도 함께. */
export async function getDayRow(
  db: D1Database,
  familyId: number,
  dayId: number,
): Promise<(DayRow & { book_title: string }) | null> {
  return db
    .prepare(
      `SELECT d.id, d.book_id, d.day_number, d.title, d.created_at, b.title AS book_title,
         (SELECT count(*) FROM word w WHERE w.day_id = d.id) AS word_count
       FROM day d JOIN book b ON b.id = d.book_id
       WHERE b.family_id = ? AND d.id = ?`,
    )
    .bind(familyId, dayId)
    .first<DayRow & { book_title: string }>();
}

/** 다음 Day 번호 (지금 가장 큰 번호 + 1, 없으면 1). */
export async function nextDayNumber(db: D1Database, bookId: number): Promise<number> {
  const row = await db
    .prepare("SELECT coalesce(max(day_number), 0) + 1 AS next FROM day WHERE book_id = ?")
    .bind(bookId)
    .first<{ next: number }>();
  return row?.next ?? 1;
}

export async function dayNumberTaken(
  db: D1Database,
  bookId: number,
  dayNumber: number,
  exceptDayId?: number,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM day WHERE book_id = ? AND day_number = ? AND id != ?")
    .bind(bookId, dayNumber, exceptDayId ?? 0)
    .first<{ id: number }>();
  return row !== null;
}

/** Day 번호·제목 고치기. 호출하는 쪽에서 가족 범위와 번호 겹침을 먼저 확인합니다. */
export async function updateDay(
  db: D1Database,
  dayId: number,
  change: { dayNumber?: number; title?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (change.dayNumber !== undefined) {
    sets.push("day_number = ?");
    values.push(change.dayNumber);
  }
  if (change.title !== undefined) {
    sets.push("title = ?");
    values.push(change.title);
  }
  if (sets.length === 0) return;
  await db.prepare(`UPDATE day SET ${sets.join(", ")} WHERE id = ?`).bind(...values, dayId).run();
}

/**
 * 같은 단어장의 두 Day 순서(번호)를 맞바꿉니다.
 * (book_id, day_number) 가 겹치면 안 되므로, 한 트랜잭션 안에서 잠깐 큰 번호로 옮겼다가 바꿉니다.
 */
export async function swapDayNumbers(db: D1Database, a: Day, b: Day): Promise<void> {
  if (a.book_id !== b.book_id) throw new Error("같은 단어장의 Day 끼리만 바꿀 수 있습니다.");
  const move = db.prepare("UPDATE day SET day_number = ? WHERE id = ?");
  await db.batch([
    move.bind(1_000_000 + a.day_number, a.id),
    move.bind(a.day_number, b.id),
    move.bind(b.day_number, a.id),
  ]);
}

/** Day 를 지웁니다. 안의 단어·뜻·기록도 함께 지워집니다 (ON DELETE CASCADE). */
export async function deleteDay(db: D1Database, dayId: number): Promise<void> {
  await db.prepare("DELETE FROM day WHERE id = ?").bind(dayId).run();
}

// 단어 입력·수정 (#5) ---------------------------------------------------

/** 단어 하나 (가족 범위 확인). 어느 Day 에 있는지도 함께. */
export async function getWordRow(db: D1Database, familyId: number, wordId: number): Promise<Word | null> {
  return db
    .prepare(
      `SELECT w.id, w.day_id, w.text, w.sort_order, w.created_at FROM word w
       JOIN day d ON d.id = w.day_id JOIN book b ON b.id = d.book_id
       WHERE b.family_id = ? AND w.id = ?`,
    )
    .bind(familyId, wordId)
    .first<Word>();
}

/** 새 단어는 Day 맨 뒤에 붙습니다. */
export async function nextWordSortOrder(db: D1Database, dayId: number): Promise<number> {
  const row = await db
    .prepare("SELECT coalesce(max(sort_order), -1) + 1 AS next FROM word WHERE day_id = ?")
    .bind(dayId)
    .first<{ next: number }>();
  return row?.next ?? 0;
}

/**
 * 단어 글자와 뜻을 한 번에 바꿉니다. 단어 id 는 그대로라 시험·기록은 이어집니다.
 * 뜻은 모두 지우고 새로 넣습니다 (뜻 id 를 가리키는 표는 없습니다).
 */
export async function updateWord(
  db: D1Database,
  wordId: number,
  input: { text: string; meanings: MeaningInput[] },
): Promise<void> {
  if (input.meanings.length === 0) throw new Error("뜻이 하나 이상 있어야 합니다.");
  const insert = db.prepare("INSERT INTO meaning (word_id, pos, text, sort_order) VALUES (?, ?, ?, ?)");
  await db.batch([
    db.prepare("UPDATE word SET text = ? WHERE id = ?").bind(input.text, wordId),
    db.prepare("DELETE FROM meaning WHERE word_id = ?").bind(wordId),
    ...input.meanings.map((m, i) => insert.bind(wordId, m.pos, m.text, i)),
  ]);
}

/** 단어를 지웁니다. 뜻·기록도 함께 지워집니다 (ON DELETE CASCADE). */
export async function deleteWord(db: D1Database, wordId: number): Promise<void> {
  await db.prepare("DELETE FROM word WHERE id = ?").bind(wordId).run();
}
