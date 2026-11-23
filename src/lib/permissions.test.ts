import { describe, expect, it } from "vitest";
import { canManage, menuFor } from "./permissions";

const labels = (role: "guardian" | "student", mode: "guardian" | "self") =>
  menuFor(role, mode).map((m) => m.label);

describe("관리 권한", () => {
  it("보호자 관리면 보호자가, 혼자 관리면 학생이 관리 권한을 가진다", () => {
    expect(canManage("guardian", "guardian")).toBe(true);
    expect(canManage("student", "guardian")).toBe(false);
    expect(canManage("student", "self")).toBe(true);
    expect(canManage("guardian", "self")).toBe(false);
  });
});

describe("메뉴", () => {
  it("보호자 관리: 학생은 홈·외우기·시험, 보호자는 전체", () => {
    expect(labels("student", "guardian")).toEqual(["홈", "외우기", "시험"]);
    expect(labels("guardian", "guardian")).toEqual([
      "홈",
      "외우기",
      "시험",
      "단어장",
      "시험 만들기",
      "기록",
      "설정",
    ]);
  });

  it("혼자 관리: 학생은 전체, 보호자는 홈·기록", () => {
    expect(labels("student", "self")).toEqual(labels("guardian", "guardian"));
    expect(labels("guardian", "self")).toEqual(["홈", "기록"]);
  });
});
