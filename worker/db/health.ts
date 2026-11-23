// D1 읽기·쓰기는 worker/db/ 안에만 둡니다 (CLAUDE.md 4장).

/** D1에 간단한 쿼리를 보내 연결되어 있는지 확인합니다. */
export async function checkDatabase(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return row?.ok === 1;
  } catch {
    return false;
  }
}
