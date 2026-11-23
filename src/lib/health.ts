export type ServerStatus = "checking" | "ok" | "no-database" | "offline";

/** /api/health 응답을 화면에 보여 줄 상태로 바꿉니다. */
export function toServerStatus(body: unknown): ServerStatus {
  if (typeof body !== "object" || body === null) return "offline";
  const { ok, database } = body as { ok?: unknown; database?: unknown };
  if (ok !== true) return "offline";
  return database === true ? "ok" : "no-database";
}

export const serverStatusLabel: Record<ServerStatus, string> = {
  checking: "서버 확인 중…",
  ok: "서버와 데이터베이스가 연결되어 있어요",
  "no-database": "서버는 켜져 있지만 데이터베이스에 연결하지 못했어요",
  offline: "서버에 연결하지 못했어요",
};
