// 시험·문항·단어별 기록 읽기·쓰기 (#10, #11). D1 쿼리는 worker/db/ 안에만 둡니다 (CLAUDE.md 4장).
import type { ItemDirection, TestDirection, TestMode } from "../../src/lib/test";

export interface NewTestItem {
  wordId: number;
  direction: ItemDirection;
  /** 저장용 답 (src/lib/test.ts encodeAnswer) */
  answer: string;
  isCorrect: boolean;
}

/**
 * 채점이 끝난 화면 시험을 저장하고 단어별 기록(word_stat)도 고칩니다. 시험 번호는 학생별로 1, 2, 3 … 이어 붙입니다.
 * dayIds·items 의 단어는 미리 가족 범위를 확인한 것이어야 합니다.
 */
export async function createTest(
  db: D1Database,
  input: {
    studentId: number;
    mode: TestMode;
    direction: TestDirection;
    firstLetterHint: boolean;
    createdBy: number;
    createdAt: string;
    finishedAt: string;
    dayIds: number[];
    items: NewTestItem[];
  },
): Promise<{ id: number; testNumber: number }> {
  const row = await db
    .prepare(
      `INSERT INTO test (student_id, test_number, mode, direction, medium, first_letter_hint, created_by, created_at, finished_at)
       SELECT ?, coalesce(max(test_number), 0) + 1, ?, ?, 'screen', ?, ?, ?, ?
       FROM test WHERE student_id = ?
       RETURNING id, test_number`,
    )
    .bind(
      input.studentId,
      input.mode,
      input.direction,
      input.firstLetterHint ? 1 : 0,
      input.createdBy,
      input.createdAt,
      input.finishedAt,
      input.studentId,
    )
    .first<{ id: number; test_number: number }>();
  if (!row) throw new Error("시험을 저장하지 못했습니다.");
  // D1 은 한 번 부를 때 쿼리 수(무료 50개)와 한 쿼리의 값 개수(100개)에 한도가 있어,
  // 여러 줄을 한 INSERT 로 묶어 보냅니다 (90문제 시험도 쿼리 십여 개).
  await db.batch([
    ...rowsInsert(db, "INSERT OR IGNORE INTO test_day (test_id, day_id) VALUES", input.dayIds.map((dayId) => [row.id, dayId]), ""),
    ...rowsInsert(
      db,
      "INSERT INTO test_item (test_id, word_id, position, direction, answer, is_correct) VALUES",
      input.items.map((item, i) => [row.id, item.wordId, i + 1, item.direction, item.answer, item.isCorrect ? 1 : 0]),
      "",
    ),
    ...wordStatStatements(db, input.studentId, input.finishedAt, input.items),
  ]);
  return { id: row.id, testNumber: row.test_number };
}

/**
 * 단어별 기록(word_stat)을 시험 결과로 고칩니다 (#11). 스마트 출제·다시 볼 단어(#12)가 씁니다.
 * 마지막 결과(last_correct)와 마지막으로 본 시각(last_seen_at)은 이번 시험으로 바꿉니다.
 */
export function wordStatStatements(
  db: D1Database,
  studentId: number,
  seenAt: string,
  items: { wordId: number; isCorrect: boolean }[],
): D1PreparedStatement[] {
  return rowsInsert(
    db,
    "INSERT INTO word_stat (student_id, word_id, correct_count, wrong_count, last_correct, last_seen_at) VALUES",
    items.map((item) => [studentId, item.wordId, item.isCorrect ? 1 : 0, item.isCorrect ? 0 : 1, item.isCorrect ? 1 : 0, seenAt]),
    `ON CONFLICT (student_id, word_id) DO UPDATE SET
       correct_count = correct_count + excluded.correct_count,
       wrong_count = wrong_count + excluded.wrong_count,
       last_correct = excluded.last_correct,
       last_seen_at = excluded.last_seen_at`,
  );
}

/** 여러 줄을 몇 개의 INSERT 로 묶습니다. 한 쿼리의 값은 100개를 넘지 않게 나눕니다. */
function rowsInsert(db: D1Database, head: string, rows: (string | number)[][], tail: string): D1PreparedStatement[] {
  if (rows.length === 0) return [];
  const width = rows[0]!.length;
  const perQuery = Math.max(1, Math.floor(100 / width));
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += perQuery) {
    const chunk = rows.slice(i, i + perQuery);
    const values = chunk.map(() => `(${Array.from({ length: width }, () => "?").join(", ")})`).join(", ");
    statements.push(db.prepare(`${head} ${values} ${tail}`).bind(...chunk.flat()));
  }
  return statements;
}

export interface TestRow {
  id: number;
  student_id: number;
  test_number: number;
  mode: TestMode;
  direction: TestDirection;
  medium: "screen" | "paper";
  first_letter_hint: number;
  created_at: string;
  finished_at: string | null;
  total: number;
  correct_count: number;
}

const TEST_WITH_COUNTS = `
  SELECT t.id, t.student_id, t.test_number, t.mode, t.direction, t.medium, t.first_letter_hint,
    t.created_at, t.finished_at,
    (SELECT count(*) FROM test_item i WHERE i.test_id = t.id) AS total,
    (SELECT count(*) FROM test_item i WHERE i.test_id = t.id AND i.is_correct = 1) AS correct_count
  FROM test t JOIN member m ON m.id = t.student_id`;

/** 한 학생의 채점이 끝난 시험 목록 (최근 것부터). 다른 가족의 학생이면 빈 목록. */
export async function listTests(db: D1Database, familyId: number, studentId: number, limit = 30): Promise<TestRow[]> {
  const { results } = await db
    .prepare(
      `${TEST_WITH_COUNTS}
       WHERE m.family_id = ? AND t.student_id = ? AND t.finished_at IS NOT NULL
       ORDER BY t.created_at DESC, t.id DESC LIMIT ?`,
    )
    .bind(familyId, studentId, limit)
    .all<TestRow>();
  return results;
}

/** 시험 한 개 (가족 범위 확인) */
export async function getTest(db: D1Database, familyId: number, testId: number): Promise<TestRow | null> {
  return db.prepare(`${TEST_WITH_COUNTS} WHERE m.family_id = ? AND t.id = ?`).bind(familyId, testId).first<TestRow>();
}

export interface TestItemRow {
  word_id: number;
  position: number;
  direction: ItemDirection;
  answer: string | null;
  is_correct: number | null;
}

export async function listTestItems(db: D1Database, testId: number): Promise<TestItemRow[]> {
  const { results } = await db
    .prepare(
      `SELECT word_id, position, direction, answer, is_correct FROM test_item
       WHERE test_id = ? ORDER BY position`,
    )
    .bind(testId)
    .all<TestItemRow>();
  return results;
}

/** 시험들의 범위 Day (시험 id → Day 목록). 목록 화면의 "Day 1 · Day 2" 표시에 씁니다. */
export async function listTestDays(
  db: D1Database,
  testIds: number[],
): Promise<{ test_id: number; day_id: number; day_number: number; book_id: number; book_title: string }[]> {
  if (testIds.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT td.test_id, d.id AS day_id, d.day_number, d.book_id, b.title AS book_title
       FROM test_day td JOIN day d ON d.id = td.day_id JOIN book b ON b.id = d.book_id
       WHERE td.test_id IN (${testIds.map(() => "?").join(", ")})
       ORDER BY td.test_id, b.sort_order, d.day_number`,
    )
    .bind(...testIds)
    .all<{ test_id: number; day_id: number; day_number: number; book_id: number; book_title: string }>();
  return results;
}

/** 한 학생의 단어별 기록 (보관하지 않은 단어장의 단어만). 다시 볼 단어(#12)에 씁니다. */
export async function listWordStats(
  db: D1Database,
  familyId: number,
  studentId: number,
): Promise<
  { word_id: number; text: string; day_id: number; wrong_count: number; last_correct: number | null; last_seen_at: string | null }[]
> {
  const { results } = await db
    .prepare(
      `SELECT ws.word_id, w.text, w.day_id, ws.wrong_count, ws.last_correct, ws.last_seen_at
       FROM word_stat ws
       JOIN word w ON w.id = ws.word_id JOIN day d ON d.id = w.day_id JOIN book b ON b.id = d.book_id
       WHERE ws.student_id = ? AND b.family_id = ? AND b.archived_at IS NULL AND ws.last_seen_at IS NOT NULL`,
    )
    .bind(studentId, familyId)
    .all<{
      word_id: number;
      text: string;
      day_id: number;
      wrong_count: number;
      last_correct: number | null;
      last_seen_at: string | null;
    }>();
  return results;
}
