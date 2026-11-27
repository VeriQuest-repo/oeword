import { describe, expect, it } from "vitest";
import { createTestDb, migrationFiles } from "./testing/sqlite-d1";

const TABLES = [
  "book",
  "day",
  "family",
  "family_settings",
  "login_failure",
  "meaning",
  "member",
  "schedule",
  "session",
  "study_completion",
  "study_completion_day",
  "test",
  "test_day",
  "test_item",
  "word",
  "word_stat",
];

describe("migrations", () => {
  it("0001_init.sql 부터 번호 순서대로 있다", () => {
    expect(migrationFiles()[0]).toBe("0001_init.sql");
  });

  it("이슈 #2·#3 의 테이블을 모두 만든다", () => {
    const { sqlite } = createTestDb();
    const rows = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(TABLES);
  });

  it("역할·관리 방식·문제 수는 정한 값만 받는다", () => {
    const { sqlite } = createTestDb();
    sqlite.exec("INSERT INTO family (id, name) VALUES (1, '우리 가족')");
    expect(() =>
      sqlite.exec("INSERT INTO member (family_id, name, role) VALUES (1, '가', 'admin')"),
    ).toThrow("CHECK constraint failed");
    expect(() =>
      sqlite.exec("INSERT INTO family_settings (family_id, question_count) VALUES (1, 35)"),
    ).toThrow("CHECK constraint failed");
    expect(() =>
      sqlite.exec("INSERT INTO family_settings (family_id, manage_mode) VALUES (1, 'student')"),
    ).toThrow("CHECK constraint failed");
  });

  it("없는 가족에 구성원을 넣을 수 없다 (외래 키)", () => {
    const { sqlite } = createTestDb();
    expect(() =>
      sqlite.exec("INSERT INTO member (family_id, name, role) VALUES (99, '가', 'student')"),
    ).toThrow("FOREIGN KEY constraint failed");
  });

  it("한 단어장에 같은 Day 번호는 하나만", () => {
    const { sqlite } = createTestDb();
    sqlite.exec(`
      INSERT INTO family (id, name) VALUES (1, '우리 가족');
      INSERT INTO book (id, family_id, title) VALUES (1, 1, '예시 단어장');
      INSERT INTO day (book_id, day_number) VALUES (1, 1);
    `);
    expect(() => sqlite.exec("INSERT INTO day (book_id, day_number) VALUES (1, 1)")).toThrow(
      "UNIQUE constraint failed",
    );
  });

  it("가족을 지우면 단어장·학생 기록까지 함께 지워진다", () => {
    const { sqlite } = createTestDb();
    sqlite.exec(`
      INSERT INTO family (id, name) VALUES (1, '우리 가족');
      INSERT INTO member (id, family_id, name, role) VALUES (1, 1, '학생', 'student');
      INSERT INTO book (id, family_id, title) VALUES (1, 1, '예시 단어장');
      INSERT INTO day (id, book_id, day_number) VALUES (1, 1, 1);
      INSERT INTO word (id, day_id, text) VALUES (1, 1, 'apple');
      INSERT INTO meaning (word_id, pos, text) VALUES (1, '명사', '사과');
      INSERT INTO test (id, student_id, test_number, mode, direction, medium) VALUES (1, 1, 1, 'full', 'en_ko', 'screen');
      INSERT INTO test_day (test_id, day_id) VALUES (1, 1);
      INSERT INTO test_item (test_id, word_id, position, direction) VALUES (1, 1, 1, 'en_ko');
      INSERT INTO word_stat (student_id, word_id, correct_count) VALUES (1, 1, 1);
      INSERT INTO study_completion (id, student_id, stage, direction, word_count) VALUES (1, 1, 'blind', 'en_ko', 1);
      INSERT INTO study_completion_day (completion_id, day_id) VALUES (1, 1);
      DELETE FROM family WHERE id = 1;
    `);
    for (const table of TABLES) {
      const row = sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number };
      expect({ table, n: row.n }).toEqual({ table, n: 0 });
    }
  });
});
