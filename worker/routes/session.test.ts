import { describe, expect, it } from "vitest";
import type { SessionResponse } from "../../src/lib/session";
import { addMember, createFamily, setPasswordHash, updateSettings } from "../db/family";
import { createTestDb } from "../db/testing/sqlite-d1";
import { hashPassword } from "../auth/password";
import { handleSessionApi, LOCKOUT_FAILURES } from "./session";

const NOW = new Date("2026-11-23T07:00:00Z");
const BASE = "https://oeword.test";

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string | null; contentType?: string } = {},
): Request {
  const headers = new Headers();
  if (init.cookie) headers.set("Cookie", init.cookie);
  if (init.body !== undefined) headers.set("Content-Type", init.contentType ?? "application/json");
  return new Request(BASE + path, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Set-Cookie 에서 브라우저가 다시 보낼 "이름=값" 부분만 꺼냅니다. */
function cookieOf(res: Response): string {
  const header = res.headers.get("Set-Cookie") ?? "";
  return header.split(";")[0] ?? "";
}

async function call(db: D1Database, req: Request, now = NOW) {
  const res = await handleSessionApi(req, db, now);
  if (!res) throw new Error("handled 되지 않음");
  return { res, body: (await res.json()) as SessionResponse & { error?: string; message?: string } };
}

async function familyWithPassword(db: D1Database, password = "family-pw") {
  const family = await createFamily(db, "우리 가족");
  await setPasswordHash(db, family.id, await hashPassword(password, 1000));
  const mom = await addMember(db, { familyId: family.id, name: "엄마", role: "guardian", sortOrder: 0 });
  const kid = await addMember(db, { familyId: family.id, name: "첫째", role: "student", sortOrder: 1 });
  return { family, mom, kid };
}

async function loggedIn(db: D1Database, password = "family-pw") {
  const { res } = await call(db, request("/api/login", { method: "POST", body: { password } }));
  return cookieOf(res);
}

describe("처음 설정", () => {
  it("가족이 없으면 setup, 만들면 바로 로그인되어 구성원 선택으로 간다", async () => {
    const { db } = createTestDb();
    expect((await call(db, request("/api/session"))).body).toEqual({ state: "setup" });

    const { res, body } = await call(
      db,
      request("/api/setup", {
        method: "POST",
        body: {
          familyName: "우리 가족",
          password: "family-pw",
          members: [
            { name: "엄마", role: "guardian" },
            { name: "아빠", role: "guardian" },
            { name: "첫째", role: "student" },
          ],
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    expect(body).toMatchObject({ state: "choose", family: { name: "우리 가족" } });
    expect(body.state === "choose" && body.members.map((m) => m.name)).toEqual(["엄마", "아빠", "첫째"]);
  });

  it("비밀번호는 해시로만 저장된다", async () => {
    const { db, sqlite } = createTestDb();
    await call(
      db,
      request("/api/setup", {
        method: "POST",
        body: { familyName: "우리 가족", password: "family-pw", members: [{ name: "엄마", role: "guardian" }] },
      }),
    );
    const row = sqlite.prepare("SELECT password_hash FROM family").get() as { password_hash: string };
    expect(row.password_hash).not.toContain("family-pw");
    expect(row.password_hash.startsWith("pbkdf2-sha256$")).toBe(true);
  });

  it("이미 가족이 있으면 다시 만들 수 없다", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    const { res } = await call(
      db,
      request("/api/setup", {
        method: "POST",
        body: { familyName: "다른 가족", password: "other-pw", members: [{ name: "누군가", role: "guardian" }] },
      }),
    );
    expect(res.status).toBe(409);
  });

  it("입력이 틀리면 400과 한국어 문구", async () => {
    const { db } = createTestDb();
    const { res, body } = await call(
      db,
      request("/api/setup", {
        method: "POST",
        body: { familyName: "우리 가족", password: "123", members: [{ name: "엄마", role: "guardian" }] },
      }),
    );
    expect(res.status).toBe(400);
    expect(body.message).toContain("6자 이상");
  });
});

describe("로그인", () => {
  it("가족이 있으면 login 상태", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    expect((await call(db, request("/api/session"))).body).toEqual({ state: "login" });
  });

  it("맞는 비밀번호면 쿠키를 받고, 여러 기기가 같은 구성원 목록을 본다", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    const pc = await loggedIn(db);
    const pad = await loggedIn(db);
    expect(pc).not.toBe(pad);

    const fromPc = (await call(db, request("/api/session", { cookie: pc }))).body;
    const fromPad = (await call(db, request("/api/session", { cookie: pad }))).body;
    expect(fromPc).toMatchObject({ state: "choose" });
    expect(fromPad).toEqual(fromPc);
  });

  it("틀린 비밀번호는 401, 쿠키 없음", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    const { res, body } = await call(db, request("/api/login", { method: "POST", body: { password: "nope" } }));
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(body.message).toBe("가족 비밀번호가 맞지 않아요.");
  });

  it(`${LOCKOUT_FAILURES}번 틀리면 15분 동안 맞는 비밀번호도 막고, 지나면 풀린다`, async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    for (let i = 0; i < LOCKOUT_FAILURES; i++) {
      await call(db, request("/api/login", { method: "POST", body: { password: "wrong" } }));
    }
    const blocked = await call(db, request("/api/login", { method: "POST", body: { password: "family-pw" } }));
    expect(blocked.res.status).toBe(429);

    const later = new Date(NOW.getTime() + 16 * 60 * 1000);
    const ok = await call(db, request("/api/login", { method: "POST", body: { password: "family-pw" } }), later);
    expect(ok.res.status).toBe(200);
  });

  it("JSON 이 아닌 요청(다른 사이트의 폼 등)은 받지 않는다", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    const { res } = await call(
      db,
      request("/api/login", { method: "POST", body: { password: "family-pw" }, contentType: "text/plain" }),
    );
    expect(res.status).toBe(400);
  });

  it("만료된 세션은 login 으로 돌아가고 쿠키를 지운다", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    const cookie = await loggedIn(db);
    const after91Days = new Date(NOW.getTime() + 91 * 24 * 60 * 60 * 1000);
    const { res, body } = await call(db, request("/api/session", { cookie }), after91Days);
    expect(body).toEqual({ state: "login" });
    expect(res.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);
  });

  it("로그아웃하면 그 기기 세션만 사라진다", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    const pc = await loggedIn(db);
    const pad = await loggedIn(db);
    await call(db, request("/api/logout", { method: "POST", body: {}, cookie: pc }));
    expect((await call(db, request("/api/session", { cookie: pc }))).body).toEqual({ state: "login" });
    expect((await call(db, request("/api/session", { cookie: pad }))).body).toMatchObject({ state: "choose" });
  });
});

describe("누가 쓰나요?", () => {
  it("학생을 고르면 홈·외우기·시험 메뉴, 관리 권한 없음", async () => {
    const { db } = createTestDb();
    const { kid } = await familyWithPassword(db);
    const cookie = await loggedIn(db);
    const { body } = await call(
      db,
      request("/api/session/member", { method: "PUT", body: { memberId: kid.id }, cookie }),
    );
    expect(body).toMatchObject({ state: "ready", member: { name: "첫째", role: "student" }, canManage: false });
    expect(body.state === "ready" && body.menu.map((m) => m.label)).toEqual(["홈", "외우기", "시험"]);

    // 새로고침해도 고른 구성원이 유지된다
    expect((await call(db, request("/api/session", { cookie }))).body).toMatchObject({
      state: "ready",
      member: { id: kid.id },
    });
  });

  it("보호자는 관리 권한과 전체 메뉴, 혼자 관리로 바꾸면 권한이 학생에게 간다", async () => {
    const { db } = createTestDb();
    const { family, mom } = await familyWithPassword(db);
    const cookie = await loggedIn(db);
    const { body } = await call(
      db,
      request("/api/session/member", { method: "PUT", body: { memberId: mom.id }, cookie }),
    );
    expect(body).toMatchObject({ state: "ready", canManage: true });
    expect(body.state === "ready" && body.menu).toHaveLength(7);

    await updateSettings(db, family.id, { manageMode: "self" });
    expect((await call(db, request("/api/session", { cookie }))).body).toMatchObject({
      state: "ready",
      manageMode: "self",
      canManage: false,
    });
  });

  it("구성원 바꾸기(null)면 다시 choose", async () => {
    const { db } = createTestDb();
    const { kid } = await familyWithPassword(db);
    const cookie = await loggedIn(db);
    await call(db, request("/api/session/member", { method: "PUT", body: { memberId: kid.id }, cookie }));
    const { body } = await call(
      db,
      request("/api/session/member", { method: "PUT", body: { memberId: null }, cookie }),
    );
    expect(body).toMatchObject({ state: "choose" });
  });

  it("로그인하지 않았거나 다른 가족의 구성원이면 고를 수 없다", async () => {
    const { db } = createTestDb();
    await familyWithPassword(db);
    const other = await createFamily(db, "다른 가족");
    const stranger = await addMember(db, { familyId: other.id, name: "남", role: "guardian" });

    const anonymous = await call(
      db,
      request("/api/session/member", { method: "PUT", body: { memberId: stranger.id } }),
    );
    expect(anonymous.res.status).toBe(401);

    const cookie = await loggedIn(db);
    const { res } = await call(
      db,
      request("/api/session/member", { method: "PUT", body: { memberId: stranger.id }, cookie }),
    );
    expect(res.status).toBe(404);
  });
});

describe("라우팅", () => {
  it("맡지 않은 주소는 null, 메서드가 다르면 405", async () => {
    const { db } = createTestDb();
    expect(await handleSessionApi(request("/api/other"), db, NOW)).toBeNull();
    const res = await handleSessionApi(request("/api/login"), db, NOW);
    expect(res?.status).toBe(405);
  });
});
