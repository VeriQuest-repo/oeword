// 외우기 단계별 완료 기록 읽기·쓰기 (#44). D1 쿼리는 worker/db/ 안에만 둡니다 (CLAUDE.md 4장).
import type { StudyDirection, StudyStage } from "../../src/lib/study";

/** 완료 한 번을 남깁니다. dayIds 는 미리 가족 범위를 확인한 Day 들입니다. */
export async function addStudyCompletion(
  db: D1Database,
  input: { studentId: number; stage: StudyStage; direction: StudyDirection; wordCount: number; dayIds: number[]; completedAt: string },
): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO study_completion (student_id, stage, direction, word_count, completed_at)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(input.studentId, input.stage, input.direction, input.wordCount, input.completedAt)
    .first<{ id: number }>();
  if (!row) throw new Error("완료 기록을 남기지 못했습니다.");
  const insertDay = db.prepare("INSERT OR IGNORE INTO study_completion_day (completion_id, day_id) VALUES (?, ?)");
  await db.batch(input.dayIds.map((dayId) => insertDay.bind(row.id, dayId)));
  return row.id;
}

export interface DayStageCount {
  day_id: number;
  stage: StudyStage;
  count: number;
}

/** 한 학생의 한 단어장 Day 별·단계별 완료 횟수. 다른 가족의 단어장이면 빈 목록. */
export async function countStudyCompletions(
  db: D1Database,
  familyId: number,
  studentId: number,
  bookId: number,
): Promise<DayStageCount[]> {
  const { results } = await db
    .prepare(
      `SELECT cd.day_id, c.stage, count(*) AS count
       FROM study_completion c
       JOIN study_completion_day cd ON cd.completion_id = c.id
       JOIN day d ON d.id = cd.day_id
       JOIN book b ON b.id = d.book_id
       WHERE b.family_id = ? AND d.book_id = ? AND c.student_id = ?
       GROUP BY cd.day_id, c.stage`,
    )
    .bind(familyId, bookId, studentId)
    .all<DayStageCount>();
  return results;
}

/** 가족 안의 Day 들만 골라 돌려줍니다 (다른 가족·없는 Day 는 빠짐). */
export async function familyDayIds(db: D1Database, familyId: number, dayIds: number[]): Promise<number[]> {
  if (dayIds.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT d.id FROM day d JOIN book b ON b.id = d.book_id
       WHERE b.family_id = ? AND d.id IN (${dayIds.map(() => "?").join(", ")})`,
    )
    .bind(familyId, ...dayIds)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}
