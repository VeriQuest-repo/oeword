// 가족 비밀번호 로그인과 "누가 쓰나요?" 구성원 선택 API (#3).
//
//   GET  /api/session         지금 상태 (처음 설정 / 로그인 / 구성원 선택 / 사용 중)
//   POST /api/setup           처음 한 번: 가족 이름·비밀번호·구성원 만들기
//   POST /api/login           가족 비밀번호로 로그인
//   POST /api/logout          로그아웃 (이 기기의 세션 지우기)
//   PUT  /api/session/member  구성원 고르기 { memberId }, 바꾸기 { memberId: null }
import { canManage, menuFor } from "../../src/lib/permissions";
import { type ApiError, checkSetupInput, type MemberSummary, type SessionResponse } from "../../src/lib/session";
import {
  addMember,
  countFamilies,
  createFamily,
  getFamily,
  getLoginFamily,
  getMember,
  getSettings,
  listMembers,
  setPasswordHash,
} from "../db/family";
import {
  clearLoginFailures,
  countLoginFailures,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  getSession,
  recordLoginFailure,
  setSessionMember,
} from "../db/session";
import type { Member, Session } from "../db/types";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  clearedSessionCookie,
  hashToken,
  newSessionToken,
  readSessionToken,
  SESSION_DAYS,
  sessionCookie,
} from "../auth/token";

/** 15분 안에 10번 틀리면 잠시 막습니다. */
export const LOCKOUT_FAILURES = 10;
export const LOCKOUT_MINUTES = 15;

function iso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

function fail(status: number, error: string, message: string, headers?: HeadersInit): Response {
  const body: ApiError = { error, message };
  return json(body, { status, headers });
}

function withCookie(body: SessionResponse, cookie: string): Response {
  return json(body, { headers: { "Set-Cookie": cookie } });
}

/**
 * 쓰기 요청은 JSON 으로만 받습니다. 다른 사이트의 폼은 JSON 을 보낼 수 없으므로
 * SameSite=Lax 쿠키와 함께 다른 사이트에서 몰래 보내는 요청(CSRF)을 막습니다.
 */
async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("Content-Type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return undefined;
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function summary(member: Member): MemberSummary {
  return { id: member.id, name: member.name, role: member.role };
}

/** 세션으로 화면에 보여 줄 상태를 만듭니다. 가족이 없어졌으면 null. */
async function sessionState(
  db: D1Database,
  familyId: number,
  memberId: number | null,
): Promise<SessionResponse | null> {
  const family = await getFamily(db, familyId);
  if (!family) return null;
  const members = (await listMembers(db, family.id)).map(summary);
  const base = { family: { name: family.name }, members };

  const member = memberId === null ? undefined : members.find((m) => m.id === memberId);
  if (!member) return { state: "choose", ...base };

  const manageMode = (await getSettings(db, family.id))?.manage_mode ?? "guardian";
  return {
    state: "ready",
    ...base,
    member,
    manageMode,
    canManage: canManage(member.role, manageMode),
    menu: menuFor(member.role, manageMode),
  };
}

async function anonymousState(db: D1Database): Promise<SessionResponse> {
  return (await countFamilies(db)) === 0 ? { state: "setup" } : { state: "login" };
}

/** 쿠키의 세션을 찾습니다. 다른 API(#4~)도 이 함수로 로그인·구성원을 확인합니다. */
export async function currentSession(
  request: Request,
  db: D1Database,
  now: Date,
): Promise<{ session: Session; tokenHash: string } | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const session = await getSession(db, tokenHash, iso(now));
  return session ? { session, tokenHash } : null;
}

async function startSession(db: D1Database, familyId: number, now: Date): Promise<string> {
  const token = newSessionToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await createSession(db, { tokenHash: await hashToken(token), familyId, expiresAt: iso(expires) });
  return token;
}

async function getState(request: Request, db: D1Database, now: Date): Promise<Response> {
  const current = await currentSession(request, db, now);
  const state = current ? await sessionState(db, current.session.family_id, current.session.member_id) : null;
  if (state) return json(state);
  const anonymous = await anonymousState(db);
  // 쿠키가 있었는데 세션이 없으면(만료·로그아웃) 쿠키도 지웁니다.
  return readSessionToken(request) ? withCookie(anonymous, clearedSessionCookie()) : json(anonymous);
}

async function setup(request: Request, db: D1Database, now: Date): Promise<Response> {
  const checked = checkSetupInput(await readJson(request));
  if (!checked.ok) return fail(400, "invalid_input", checked.message);
  if ((await countFamilies(db)) > 0) {
    return fail(409, "already_set_up", "이미 가족이 만들어져 있어요. 가족 비밀번호로 들어가 주세요.");
  }

  const { familyName, password, members } = checked.input;
  const family = await createFamily(db, familyName);
  await setPasswordHash(db, family.id, await hashPassword(password));
  for (const [index, member] of members.entries()) {
    await addMember(db, { familyId: family.id, name: member.name, role: member.role, sortOrder: index });
  }

  const token = await startSession(db, family.id, now);
  const state = await sessionState(db, family.id, null);
  return withCookie(state ?? { state: "login" }, sessionCookie(token));
}

async function login(request: Request, db: D1Database, now: Date): Promise<Response> {
  const body = await readJson(request);
  const password = (body as { password?: unknown } | undefined)?.password;
  if (typeof password !== "string" || !password) {
    return fail(400, "invalid_input", "가족 비밀번호를 적어 주세요.");
  }

  const family = await getLoginFamily(db);
  if (!family) {
    return fail(409, "not_set_up", "아직 가족이 없어요. 처음 설정부터 해 주세요.");
  }

  const since = iso(new Date(now.getTime() - LOCKOUT_MINUTES * 60 * 1000));
  if ((await countLoginFailures(db, family.id, since)) >= LOCKOUT_FAILURES) {
    return fail(
      429,
      "too_many_attempts",
      `비밀번호를 여러 번 틀렸어요. ${LOCKOUT_MINUTES}분 뒤에 다시 해 주세요.`,
      { "Retry-After": String(LOCKOUT_MINUTES * 60) },
    );
  }

  if (!(await verifyPassword(password, family.password_hash))) {
    await recordLoginFailure(db, family.id, iso(now));
    return fail(401, "wrong_password", "가족 비밀번호가 맞지 않아요.");
  }

  await clearLoginFailures(db, family.id);
  await deleteExpiredSessions(db, iso(now));
  const token = await startSession(db, family.id, now);
  const state = await sessionState(db, family.id, null);
  return withCookie(state ?? { state: "login" }, sessionCookie(token));
}

async function logout(request: Request, db: D1Database, now: Date): Promise<Response> {
  const current = await currentSession(request, db, now);
  if (current) await deleteSession(db, current.tokenHash);
  return withCookie(await anonymousState(db), clearedSessionCookie());
}

async function chooseMember(request: Request, db: D1Database, now: Date): Promise<Response> {
  const current = await currentSession(request, db, now);
  if (!current) return fail(401, "not_logged_in", "가족 비밀번호로 먼저 들어가 주세요.");

  const body = await readJson(request);
  const memberId = (body as { memberId?: unknown } | undefined)?.memberId;
  if (memberId !== null && !Number.isInteger(memberId)) {
    return fail(400, "invalid_input", "구성원을 골라 주세요.");
  }
  if (memberId !== null) {
    // 다른 가족의 구성원은 고를 수 없습니다.
    const member = await getMember(db, current.session.family_id, memberId as number);
    if (!member) return fail(404, "member_not_found", "구성원을 찾지 못했어요.");
  }

  await setSessionMember(db, current.tokenHash, memberId as number | null);
  const state = await sessionState(db, current.session.family_id, memberId as number | null);
  return state ? json(state) : fail(401, "not_logged_in", "가족 비밀번호로 먼저 들어가 주세요.");
}

type Handler = (request: Request, db: D1Database, now: Date) => Promise<Response>;

const ROUTES: Record<string, Record<string, Handler>> = {
  "/api/session": { GET: getState },
  "/api/setup": { POST: setup },
  "/api/login": { POST: login },
  "/api/logout": { POST: logout },
  "/api/session/member": { PUT: chooseMember },
};

/** 이 파일이 맡은 주소면 응답을, 아니면 null 을 돌려줍니다. */
export async function handleSessionApi(
  request: Request,
  db: D1Database,
  now: Date = new Date(),
): Promise<Response | null> {
  const methods = ROUTES[new URL(request.url).pathname];
  if (!methods) return null;
  const handler = methods[request.method];
  if (!handler) {
    return fail(405, "method_not_allowed", "지원하지 않는 요청이에요.", {
      Allow: Object.keys(methods).join(", "),
    });
  }
  return handler(request, db, now);
}
