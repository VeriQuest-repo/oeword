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
