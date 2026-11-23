// 세션 토큰과 쿠키.
//
// 토큰은 32바이트 무작위 값이고 원문은 쿠키에만 있습니다. D1 에는 SHA-256 해시만 저장하므로
// 서명용 비밀값(시크릿)이 필요 없고, D1 내용이 새어 나가도 그것으로 로그인할 수 없습니다.

export const SESSION_COOKIE = "oeword_session";
/** 가족 기기에서 매번 로그인하지 않도록 90일 동안 유지합니다. */
export const SESSION_DAYS = 90;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newSessionToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      const value = rest.join("=");
      return /^[0-9a-f]{64}$/.test(value) ? value : null;
    }
  }
  return null;
}

/** HttpOnly(화면 스크립트가 못 읽음), Secure(https 만), SameSite=Lax(다른 사이트 요청에 안 붙음). */
export function sessionCookie(token: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
