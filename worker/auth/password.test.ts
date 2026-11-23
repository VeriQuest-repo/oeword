import { describe, expect, it } from "vitest";
import { hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "./password";

describe("가족 비밀번호 해시", () => {
  it("원문을 저장하지 않고, 맞는 비밀번호만 통과한다", async () => {
    const stored = await hashPassword("우리집단어123");
    expect(stored).not.toContain("우리집단어123");
    expect(stored.startsWith(`pbkdf2-sha256$${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(await verifyPassword("우리집단어123", stored)).toBe(true);
    expect(await verifyPassword("우리집단어124", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("같은 비밀번호도 매번 다른 해시가 된다 (salt)", async () => {
    const a = await hashPassword("same-password", 1000);
    const b = await hashPassword("same-password", 1000);
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });

  it("형식이 이상한 저장값은 항상 틀림", async () => {
    for (const stored of ["", "plain-text", "md5$1$a$b", "pbkdf2-sha256$abc$a$b", "pbkdf2-sha256$1000$%%%$%%%"]) {
      expect(await verifyPassword("anything", stored)).toBe(false);
    }
  });

  it("Workers 한도보다 큰 반복 횟수는 받지 않는다", async () => {
    const stored = await hashPassword("pw-123456", 1000);
    const tooMany = stored.replace("$1000$", `$${PBKDF2_ITERATIONS + 1}$`);
    expect(await verifyPassword("pw-123456", tooMany)).toBe(false);
  });
});
