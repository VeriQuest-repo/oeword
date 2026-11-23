// 테스트 전용: Node 내장 SQLite(node:sqlite)로 D1Database 의 필요한 부분만 흉내 냅니다.
// migrations/ 의 SQL 을 그대로 적용하므로, 스키마와 데이터 모듈의 쿼리를 함께 검사할 수 있습니다.
// 배포 코드에서는 쓰지 않습니다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../../migrations");

type Row = Record<string, unknown>;

function toSqlite(value: unknown): SQLInputValue {
  if (value === undefined) throw new Error("D1 은 undefined 를 bind 할 수 없습니다.");
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as SQLInputValue;
}

function result<T>(results: T[], changes = 0, lastRowId = 0): D1Result<T> {
  return {
    success: true,
    results,
    meta: { changes, last_row_id: lastRowId, duration: 0 },
  } as unknown as D1Result<T>;
}

class SqliteStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SQLInputValue[] = [],
  ) {}

  bind(...values: unknown[]): SqliteStatement {
    return new SqliteStatement(this.db, this.sql, values.map(toSqlite));
  }

  private stmt(): StatementSync {
    return this.db.prepare(this.sql);
  }

  /** batch 에서 쓰는 동기 실행. RETURNING 이 있으면 결과 행을 돌려줍니다. */
  execute(): D1Result<Row> {
    const stmt = this.stmt();
    if (stmt.columns().length > 0) {
      return result(stmt.all(...this.params) as Row[]);
    }
    const { changes, lastInsertRowid } = stmt.run(...this.params);
    return result<Row>([], Number(changes), Number(lastInsertRowid));
  }

  async first<T = Row>(colName?: string): Promise<T | null> {
    const row = this.execute().results[0];
    if (!row) return null;
    return (colName ? row[colName] : row) as T;
  }

  async all<T = Row>(): Promise<D1Result<T>> {
    return this.execute() as D1Result<T>;
  }

  async run<T = Row>(): Promise<D1Result<T>> {
    return this.execute() as D1Result<T>;
  }
}

class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this.sqlite, sql);
  }

  /** D1 처럼 batch 전체를 하나의 트랜잭션으로 실행하고, 하나라도 실패하면 모두 되돌립니다. */
  async batch<T = Row>(statements: SqliteStatement[]): Promise<D1Result<T>[]> {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map((s) => s.execute());
      this.sqlite.exec("COMMIT");
      return results as D1Result<T>[];
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async exec(sql: string): Promise<D1ExecResult> {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .toSorted();
}

/** 메모리 DB 를 만들고 migrations/ 를 번호 순서대로 적용합니다. */
export function createTestDb(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  // D1 은 외래 키 검사가 항상 켜져 있습니다.
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of migrationFiles()) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
  }
  return { db: new SqliteD1(sqlite) as unknown as D1Database, sqlite };
}
