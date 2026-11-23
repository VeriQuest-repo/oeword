import { describe, expect, it } from "vitest";
import { handleApi } from "./index";

function fakeEnv(firstResult: unknown, shouldThrow = false): Env {
  const db = {
    prepare: () => ({
      first: async () => {
        if (shouldThrow) throw new Error("db down");
        return firstResult;
      },
    }),
  };
  return { DB: db } as unknown as Env;
}

describe("/api/health", () => {
  it("D1이 응답하면 database: true", async () => {
    const res = await handleApi(new Request("http://localhost/api/health"), fakeEnv({ ok: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, database: true });
  });

  it("D1 쿼리가 실패해도 200과 database: false", async () => {
    const res = await handleApi(new Request("http://localhost/api/health"), fakeEnv(null, true));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, database: false });
  });

  it("GET 이외의 요청은 405", async () => {
    const res = await handleApi(
      new Request("http://localhost/api/health", { method: "POST" }),
      fakeEnv({ ok: 1 }),
    );
    expect(res.status).toBe(405);
  });
});

describe("없는 API", () => {
  it("404를 돌려준다", async () => {
    const res = await handleApi(new Request("http://localhost/api/nope"), fakeEnv({ ok: 1 }));
    expect(res.status).toBe(404);
  });
});
