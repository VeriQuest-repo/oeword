import { describe, expect, it } from "vitest";
import { toServerStatus } from "./health";

describe("toServerStatus", () => {
  it("서버와 D1이 모두 정상이면 ok", () => {
    expect(toServerStatus({ ok: true, database: true })).toBe("ok");
  });

  it("D1만 안 되면 no-database", () => {
    expect(toServerStatus({ ok: true, database: false })).toBe("no-database");
  });

  it("형식이 다르면 offline", () => {
    expect(toServerStatus(null)).toBe("offline");
    expect(toServerStatus("ok")).toBe("offline");
    expect(toServerStatus({ ok: false })).toBe("offline");
  });
});
