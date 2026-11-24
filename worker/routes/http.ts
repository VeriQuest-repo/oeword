// API 응답·요청 읽기 도우미와 로그인·권한 확인. 여러 라우트 파일이 함께 씁니다.
import { canManage } from "../../src/lib/permissions";
import type { ApiError } from "../../src/lib/session";
import { getMember, getSettings } from "../db/family";
import type { Member } from "../db/types";
import { currentSession } from "./session";

export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

export function fail(status: number, error: string, message: string, headers?: HeadersInit): Response {
  const body: ApiError = { error, message };
  return json(body, { status, headers });
}

/**
 * 쓰기 요청은 JSON 으로만 받습니다 (다른 사이트의 폼이 몰래 보내는 요청 막기).
 * JSON 이 아니거나 읽지 못하면 undefined.
 */
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("Content-Type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return undefined;
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export interface Actor {
  familyId: number;
  member: Member;
  canManage: boolean;
}

/**
 * 로그인하고 구성원까지 고른 사람을 찾습니다. 아니면 401 응답을 돌려줍니다.
 * manage 가 true 면 관리 권한(CLAUDE.md 4장 '역할이 아니라 권한')까지 확인해 없으면 403.
 */
export async function requireActor(
  request: Request,
  db: D1Database,
  now: Date,
  options: { manage?: boolean } = {},
): Promise<Actor | Response> {
  const current = await currentSession(request, db, now);
  if (!current) return fail(401, "not_logged_in", "가족 비밀번호로 먼저 들어가 주세요.");
  const { family_id: familyId, member_id: memberId } = current.session;
  const member = memberId === null ? null : await getMember(db, familyId, memberId);
  if (!member) return fail(401, "member_not_chosen", "누가 쓰는지 먼저 골라 주세요.");
  const manageMode = (await getSettings(db, familyId))?.manage_mode ?? "guardian";
  const actor = { familyId, member, canManage: canManage(member.role, manageMode) };
  if (options.manage && !actor.canManage) {
    return fail(403, "no_permission", "단어장을 고칠 권한이 없어요. 관리하는 사람에게 부탁해 주세요.");
  }
  return actor;
}

export type Params = Record<string, number>;
export type Handler = (request: Request, db: D1Database, now: Date, params: Params) => Promise<Response>;

/** "/api/books/:bookId" 같은 주소 모양과 메서드별 처리 함수 */
export interface Route {
  pattern: string;
  methods: Record<string, Handler>;
}

function match(pattern: string, pathname: string): Params | null {
  const want = pattern.split("/");
  const got = pathname.split("/");
  if (want.length !== got.length) return null;
  const params: Params = {};
  for (const [i, part] of want.entries()) {
    const value = got[i] ?? "";
    if (part.startsWith(":")) {
      if (!/^[1-9]\d{0,15}$/.test(value)) return null;
      params[part.slice(1)] = Number(value);
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

/** 주소에 맞는 라우트가 있으면 응답을, 없으면 null 을 돌려줍니다. */
export async function dispatch(
  routes: Route[],
  request: Request,
  db: D1Database,
  now: Date,
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  for (const route of routes) {
    const params = match(route.pattern, pathname);
    if (!params) continue;
    const handler = route.methods[request.method];
    if (!handler) {
      return fail(405, "method_not_allowed", "지원하지 않는 요청이에요.", {
        Allow: Object.keys(route.methods).join(", "),
      });
    }
    return handler(request, db, now, params);
  }
  return null;
}
