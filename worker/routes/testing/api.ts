// 테스트 전용: 로그인한 쿠키를 만들고 API 를 부르는 도우미. 배포 코드에서는 쓰지 않습니다.
import { addMember, createFamily, setPasswordHash, updateSettings } from "../../db/family";
import { hashPassword } from "../../auth/password";
import { handleApi } from "../../index";

export const NOW = new Date("2026-11-24T05:00:00Z");
const BASE = "https://oeword.test";

export interface Call {
  status: number;
  // oxlint-disable-next-line no-explicit-any -- 테스트에서 응답 모양을 자유롭게 확인하려고
  body: any;
  cookie: string | null;
}

export async function call(
  db: D1Database,
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<Call> {
  const headers = new Headers();
  if (init.cookie) headers.set("Cookie", init.cookie);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const req = new Request(BASE + path, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const res = await handleApi(req, { DB: db } as Env, NOW);
  const cookie = res.headers.get("Set-Cookie")?.split(";")[0] ?? null;
  return { status: res.status, body: await res.json(), cookie };
}

/** 보호자(엄마)·학생(첫째)이 있는 가족을 만들고, 각자 구성원을 고른 쿠키를 돌려줍니다. */
export async function familyWithCookies(db: D1Database, options: { manageMode?: "guardian" | "self" } = {}) {
  const family = await createFamily(db, "우리 가족");
  await setPasswordHash(db, family.id, await hashPassword("family-pw", 1000));
  const mom = await addMember(db, { familyId: family.id, name: "엄마", role: "guardian", sortOrder: 0 });
  const kid = await addMember(db, { familyId: family.id, name: "첫째", role: "student", sortOrder: 1 });
  if (options.manageMode) await updateSettings(db, family.id, { manageMode: options.manageMode });

  async function cookieFor(memberId: number): Promise<string> {
    const login = await call(db, "/api/login", { method: "POST", body: { password: "family-pw" } });
    const cookie = login.cookie ?? "";
    await call(db, "/api/session/member", { method: "PUT", body: { memberId }, cookie });
    return cookie;
  }

  return { family, mom, kid, guardian: await cookieFor(mom.id), student: await cookieFor(kid.id) };
}
