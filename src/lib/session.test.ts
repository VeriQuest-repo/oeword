import { describe, expect, it } from "vitest";
import { checkSetupInput, passwordProblem } from "./session";

const valid = {
  familyName: " 우리 가족 ",
  password: "123456",
  members: [
    { name: " 엄마 ", role: "guardian" },
    { name: "첫째", role: "student" },
  ],
};

describe("처음 설정 입력 검사", () => {
  it("앞뒤 공백을 정리해서 돌려준다", () => {
    expect(checkSetupInput(valid)).toEqual({
      ok: true,
      input: {
        familyName: "우리 가족",
        password: "123456",
        members: [
          { name: "엄마", role: "guardian" },
          { name: "첫째", role: "student" },
        ],
      },
    });
  });

  it("비밀번호는 6자 이상", () => {
    expect(passwordProblem("12345")).toContain("6자 이상");
    expect(passwordProblem("123456")).toBeNull();
    expect(checkSetupInput({ ...valid, password: "12345" })).toMatchObject({ ok: false });
  });

  it("보호자가 한 명은 있어야 한다", () => {
    const result = checkSetupInput({ ...valid, members: [{ name: "첫째", role: "student" }] });
    expect(result).toEqual({ ok: false, message: "보호자를 한 명 이상 넣어 주세요." });
  });

  it("빈 이름, 같은 이름, 이상한 역할은 받지 않는다", () => {
    expect(checkSetupInput({ ...valid, familyName: "  " })).toMatchObject({ ok: false });
    expect(
      checkSetupInput({ ...valid, members: [...valid.members, { name: "  ", role: "student" }] }),
    ).toMatchObject({ ok: false });
    expect(
      checkSetupInput({ ...valid, members: [...valid.members, { name: "첫째", role: "student" }] }),
    ).toMatchObject({ ok: false });
    expect(
      checkSetupInput({ ...valid, members: [...valid.members, { name: "둘째", role: "admin" }] }),
    ).toMatchObject({ ok: false });
  });

  it("모양이 다른 입력은 받지 않는다", () => {
    expect(checkSetupInput(null)).toMatchObject({ ok: false });
    expect(checkSetupInput({ familyName: "가족" })).toMatchObject({ ok: false });
  });
});
