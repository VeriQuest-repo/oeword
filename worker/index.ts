import { checkDatabase } from "./db/health";
import { handleBookApi } from "./routes/books";
import { handleSessionApi } from "./routes/session";
import { handleStudyApi } from "./routes/study";
import { handleTestApi } from "./routes/tests";
import { handleWordApi } from "./routes/words";

export interface HealthResponse {
  ok: boolean;
  database: boolean;
}

function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

export async function handleApi(request: Request, env: Env, now: Date = new Date()): Promise<Response> {
  const url = new URL(request.url);

  const session = await handleSessionApi(request, env.DB, now);
  if (session) return session;

  const books = await handleBookApi(request, env.DB, now);
  if (books) return books;

  const words = await handleWordApi(request, env.DB, now);
  if (words) return words;

  const study = await handleStudyApi(request, env.DB, now);
  if (study) return study;

  const tests = await handleTestApi(request, env.DB, now);
  if (tests) return tests;

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET" } });
    }
    const database = await checkDatabase(env.DB);
    const body: HealthResponse = { ok: true, database };
    return json(body);
  }

  return json({ error: "not_found" }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    // /api/* 가 아닌 주소는 wrangler.jsonc 의 assets 설정이 먼저 처리합니다.
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
