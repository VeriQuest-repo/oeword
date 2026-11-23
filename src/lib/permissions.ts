// 관리 권한과 메뉴. 화면과 서버가 함께 씁니다.
//
// 권한은 '보호자인지'가 아니라 '관리 권한이 있는지'로 확인합니다 (CLAUDE.md 4장).
// 관리 방식이 보호자 관리(guardian)면 보호자가, 혼자 관리(self)면 학생이 관리 권한을 가집니다.

export type MemberRole = "guardian" | "student";
export type ManageMode = "guardian" | "self";

/** 단어장 관리·시험 만들기·출력·일정 설정을 할 수 있는지. */
export function canManage(role: MemberRole, manageMode: ManageMode): boolean {
  return manageMode === "guardian" ? role === "guardian" : role === "student";
}

export type MenuKey = "home" | "study" | "test" | "books" | "make-test" | "records" | "settings";

export interface MenuItem {
  key: MenuKey;
  label: string;
}

const HOME: MenuItem = { key: "home", label: "홈" };
const STUDY: MenuItem = { key: "study", label: "외우기" };
const TEST: MenuItem = { key: "test", label: "시험" };
const BOOKS: MenuItem = { key: "books", label: "단어장" };
const MAKE_TEST: MenuItem = { key: "make-test", label: "시험 만들기" };
const RECORDS: MenuItem = { key: "records", label: "기록" };
const SETTINGS: MenuItem = { key: "settings", label: "설정" };

/**
 * 구성원에게 보이는 메뉴 (노션 기획 4장 "화면 표시는 보호자 / 학생").
 * - 학생: 홈·외우기·시험. 관리 권한이 있으면(혼자 관리) 관리 메뉴도 보입니다.
 * - 보호자: 관리 권한이 있으면(보호자 관리) 전체 메뉴, 없으면(혼자 관리) 홈·기록만 보입니다.
 */
export function menuFor(role: MemberRole, manageMode: ManageMode): MenuItem[] {
  const manage = canManage(role, manageMode);
  if (role === "student") {
    return manage ? [HOME, STUDY, TEST, BOOKS, MAKE_TEST, RECORDS, SETTINGS] : [HOME, STUDY, TEST];
  }
  return manage ? [HOME, STUDY, TEST, BOOKS, MAKE_TEST, RECORDS, SETTINGS] : [HOME, RECORDS];
}
