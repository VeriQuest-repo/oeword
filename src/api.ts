// 화면에서 /api/* 를 부르는 함수 (화면 전용, 서버에서는 쓰지 않음). 로그인·구성원 선택 (#3).
import type { SessionResponse, SetupInput } from "./lib/session";

/** 서버가 돌려준 한국어 문구를 담은 오류. 화면에 그대로 보여 줍니다. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.", 0);
  }
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : "잠시 문제가 생겼어요. 다시 해 주세요.";
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

export const api = {
  session: () => request<SessionResponse>("/api/session", "GET"),
  setup: (input: SetupInput) => request<SessionResponse>("/api/setup", "POST", input),
  login: (password: string) => request<SessionResponse>("/api/login", "POST", { password }),
  logout: () => request<SessionResponse>("/api/logout", "POST", {}),
  chooseMember: (memberId: number | null) =>
    request<SessionResponse>("/api/session/member", "PUT", { memberId }),
};
