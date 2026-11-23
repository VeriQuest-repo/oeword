// 로그인·구성원 선택 API 의 주고받는 모양과 입력 검사. 화면과 서버가 함께 씁니다.
import type { ManageMode, MemberRole, MenuItem } from "./permissions";

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;
export const NAME_MAX_LENGTH = 20;
export const MEMBER_MAX_COUNT = 10;

export interface MemberSummary {
  id: number;
  name: string;
  role: MemberRole;
}

/**
 * GET /api/session 응답.
 * - setup: 아직 가족이 없음 → 처음 설정 화면
 * - login: 로그인 전 → 가족 비밀번호 화면
 * - choose: 로그인했지만 구성원을 고르지 않음 → "누가 쓰나요?"
 * - ready: 구성원까지 고름 → 메뉴가 있는 화면
 */
export type SessionResponse =
  | { state: "setup" }
  | { state: "login" }
  | { state: "choose"; family: { name: string }; members: MemberSummary[] }
  | {
      state: "ready";
      family: { name: string };
      members: MemberSummary[];
      member: MemberSummary;
      manageMode: ManageMode;
      canManage: boolean;
      menu: MenuItem[];
    };

export interface SetupInput {
  familyName: string;
  password: string;
  members: { name: string; role: MemberRole }[];
}

export type ApiError = { error: string; message: string };

/** 비밀번호 규칙. 문제가 있으면 화면에 보여 줄 문구, 없으면 null. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `가족 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상으로 정해 주세요.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `가족 비밀번호는 ${PASSWORD_MAX_LENGTH}자까지 쓸 수 있어요.`;
  }
  return null;
}

/** 처음 설정 입력을 검사하고 앞뒤 공백을 정리합니다. 문제가 있으면 문구를 돌려줍니다. */
export function checkSetupInput(
  body: unknown,
): { ok: true; input: SetupInput } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "입력 내용을 읽지 못했어요." };
  }
  const { familyName, password, members } = body as Record<string, unknown>;
  if (typeof familyName !== "string" || typeof password !== "string" || !Array.isArray(members)) {
    return { ok: false, message: "입력 내용을 읽지 못했어요." };
  }

  const name = familyName.trim();
  if (!name) return { ok: false, message: "가족 이름을 적어 주세요." };
  if (name.length > NAME_MAX_LENGTH) {
    return { ok: false, message: `가족 이름은 ${NAME_MAX_LENGTH}자까지 쓸 수 있어요.` };
  }

  const problem = passwordProblem(password);
  if (problem) return { ok: false, message: problem };

  const cleaned: SetupInput["members"] = [];
  for (const m of members) {
    if (typeof m !== "object" || m === null) return { ok: false, message: "구성원 정보를 읽지 못했어요." };
    const { name: memberName, role } = m as Record<string, unknown>;
    if (typeof memberName !== "string" || (role !== "guardian" && role !== "student")) {
      return { ok: false, message: "구성원 정보를 읽지 못했어요." };
    }
    const trimmed = memberName.trim();
    if (!trimmed) return { ok: false, message: "구성원 이름을 모두 적어 주세요." };
    if (trimmed.length > NAME_MAX_LENGTH) {
      return { ok: false, message: `구성원 이름은 ${NAME_MAX_LENGTH}자까지 쓸 수 있어요.` };
    }
    if (cleaned.some((c) => c.name === trimmed)) {
      return { ok: false, message: `구성원 이름 "${trimmed}"이(가) 두 번 있어요.` };
    }
    cleaned.push({ name: trimmed, role });
  }
  if (cleaned.length > MEMBER_MAX_COUNT) {
    return { ok: false, message: `구성원은 ${MEMBER_MAX_COUNT}명까지 넣을 수 있어요.` };
  }
  if (!cleaned.some((m) => m.role === "guardian")) {
    return { ok: false, message: "보호자를 한 명 이상 넣어 주세요." };
  }

  return { ok: true, input: { familyName: name, password, members: cleaned } };
}
