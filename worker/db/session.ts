// 로그인 세션·비밀번호 실패 기록 읽기·쓰기. D1 쿼리는 worker/db/ 안에만 둡니다 (CLAUDE.md 4장).
import type { Session } from "./types";

export async function createSession(
  db: D1Database,
  input: { tokenHash: string; familyId: number; expiresAt: string },
): Promise<void> {
  await db
    .prepare("INSERT INTO session (token_hash, family_id, expires_at) VALUES (?, ?, ?)")
    .bind(input.tokenHash, input.familyId, input.expiresAt)
    .run();
}

/** 만료되지 않은 세션만 돌려줍니다. now 는 UTC ISO 8601 문자열입니다. */
export async function getSession(
  db: D1Database,
  tokenHash: string,
  now: string,
): Promise<Session | null> {
  return db
    .prepare(
      `SELECT token_hash, family_id, member_id, created_at, expires_at FROM session
       WHERE token_hash = ? AND expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<Session>();
}

/** 구성원을 고르거나(memberId) 고른 것을 지웁니다(null). */
export async function setSessionMember(
  db: D1Database,
  tokenHash: string,
  memberId: number | null,
): Promise<void> {
  await db
    .prepare("UPDATE session SET member_id = ? WHERE token_hash = ?")
    .bind(memberId, tokenHash)
    .run();
}

export async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM session WHERE token_hash = ?").bind(tokenHash).run();
}

/** 로그인할 때 만료된 세션을 함께 정리합니다. */
export async function deleteExpiredSessions(db: D1Database, now: string): Promise<void> {
  await db.prepare("DELETE FROM session WHERE expires_at <= ?").bind(now).run();
}

export async function recordLoginFailure(db: D1Database, familyId: number, at: string): Promise<void> {
  await db
    .prepare("INSERT INTO login_failure (family_id, failed_at) VALUES (?, ?)")
    .bind(familyId, at)
    .run();
}

/** since 이후에 비밀번호를 틀린 횟수. */
export async function countLoginFailures(
  db: D1Database,
  familyId: number,
  since: string,
): Promise<number> {
  const row = await db
    .prepare("SELECT count(*) AS n FROM login_failure WHERE family_id = ? AND failed_at > ?")
    .bind(familyId, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** 로그인에 성공하면 실패 기록을 지웁니다. */
export async function clearLoginFailures(db: D1Database, familyId: number): Promise<void> {
  await db.prepare("DELETE FROM login_failure WHERE family_id = ?").bind(familyId).run();
}
