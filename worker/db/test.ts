// 시험·문항 읽기·쓰기 (#10). D1 쿼리는 worker/db/ 안에만 둡니다 (CLAUDE.md 4장).
import type { ItemDirection, TestDirection, TestMode } from "../../src/lib/test";

export interface NewTestItem {
  wordId: number;
  direction: ItemDirection;
  /** 저장용 답 (src/lib/test.ts encodeAnswer) */
  answer: string;
  isCorrect: boolean;
}

/**
 * 채점이 끝난 화면 시험을 저장합니다. 시험 번호는 학생별로 1, 2, 3 … 이어 붙입니다.
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
  const insertDay = db.prepare("INSERT OR IGNORE INTO test_day (test_id, day_id) VALUES (?, ?)");
  const insertItem = db.prepare(
    `INSERT INTO test_item (test_id, word_id, position, direction, answer, is_correct)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  await db.batch([
    ...input.dayIds.map((dayId) => insertDay.bind(row.id, dayId)),
    ...input.items.map((item, i) =>
      insertItem.bind(row.id, item.wordId, i + 1, item.direction, item.answer, item.isCorrect ? 1 : 0),
    ),
  ]);
  return { id: row.id, testNumber: row.test_number };
}
