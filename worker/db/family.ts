// 가족·구성원·가족 설정 읽기·쓰기. D1 쿼리는 worker/db/ 안에만 둡니다 (CLAUDE.md 4장).
import type { Family, FamilySettings, ManageMode, Member, MemberRole, QuestionCount } from "./types";

/** 가족을 만들고 기본 설정(보호자 관리, 30문제)도 함께 만듭니다. */
export async function createFamily(db: D1Database, name: string): Promise<Family> {
  const family = await db
    .prepare("INSERT INTO family (name) VALUES (?) RETURNING id, name, created_at")
    .bind(name)
    .first<Family>();
  if (!family) throw new Error("가족을 만들지 못했습니다.");
  await db.prepare("INSERT INTO family_settings (family_id) VALUES (?)").bind(family.id).run();
  return family;
}

export async function getFamily(db: D1Database, familyId: number): Promise<Family | null> {
  return db
    .prepare("SELECT id, name, created_at FROM family WHERE id = ?")
    .bind(familyId)
    .first<Family>();
}

export async function addMember(
  db: D1Database,
  input: { familyId: number; name: string; role: MemberRole; sortOrder?: number },
): Promise<Member> {
  const member = await db
    .prepare(
      `INSERT INTO member (family_id, name, role, sort_order) VALUES (?, ?, ?, ?)
       RETURNING id, family_id, name, role, sort_order, created_at`,
    )
    .bind(input.familyId, input.name, input.role, input.sortOrder ?? 0)
    .first<Member>();
  if (!member) throw new Error("구성원을 추가하지 못했습니다.");
  return member;
}

/** "누가 쓰나요?" 목록. 정한 순서, 같으면 만든 순서. */
export async function listMembers(db: D1Database, familyId: number): Promise<Member[]> {
  const { results } = await db
    .prepare(
      `SELECT id, family_id, name, role, sort_order, created_at FROM member
       WHERE family_id = ? ORDER BY sort_order, id`,
    )
    .bind(familyId)
    .all<Member>();
  return results;
}

export async function getSettings(db: D1Database, familyId: number): Promise<FamilySettings | null> {
  return db
    .prepare(
      "SELECT family_id, manage_mode, question_count, updated_at FROM family_settings WHERE family_id = ?",
    )
    .bind(familyId)
    .first<FamilySettings>();
}

export async function updateSettings(
  db: D1Database,
  familyId: number,
  changes: { manageMode?: ManageMode; questionCount?: QuestionCount },
): Promise<FamilySettings | null> {
  return db
    .prepare(
      `UPDATE family_settings
       SET manage_mode = COALESCE(?, manage_mode),
           question_count = COALESCE(?, question_count),
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE family_id = ?
       RETURNING family_id, manage_mode, question_count, updated_at`,
    )
    .bind(changes.manageMode ?? null, changes.questionCount ?? null, familyId)
    .first<FamilySettings>();
}
