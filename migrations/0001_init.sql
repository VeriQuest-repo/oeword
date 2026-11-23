-- 외워드 D1 데이터 구조 v1 (#2)
--
-- 가족 › 구성원 구조입니다. 단어장(book › day › word › meaning)은 가족 공용이고,
-- 학원 일정·시험·단어별 기록은 학생(member)별입니다.
--
-- 규칙
-- - id 는 INTEGER PRIMARY KEY (SQLite rowid) 를 씁니다.
-- - 시각은 UTC ISO 8601 문자열(TEXT)로 저장합니다. 예: 2026-11-23T06:40:00Z
-- - 날짜만 필요한 곳(학원 일정 시작일)은 YYYY-MM-DD 입니다.
-- - 참/거짓은 INTEGER 0/1 입니다.
-- - 위쪽(가족·단어장 등)을 지우면 아래쪽 기록도 함께 지워집니다 (ON DELETE CASCADE).

-- 가족 ------------------------------------------------------------------

CREATE TABLE family (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  -- 가족 비밀번호는 해시로만 저장합니다 (CLAUDE.md 6장). 로그인(#3)에서 채웁니다.
  password_hash TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 구성원: 보호자(guardian) 여러 명, 학생(student) 여러 명
CREATE TABLE member (
  id         INTEGER PRIMARY KEY,
  family_id  INTEGER NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  role       TEXT    NOT NULL CHECK (role IN ('guardian', 'student')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX member_family ON member(family_id, sort_order);

-- 가족 설정: 관리 방식(보호자 관리 / 혼자 관리), 스마트 출제 문제 수
CREATE TABLE family_settings (
  family_id      INTEGER PRIMARY KEY REFERENCES family(id) ON DELETE CASCADE,
  manage_mode    TEXT    NOT NULL DEFAULT 'guardian' CHECK (manage_mode IN ('guardian', 'self')),
  question_count INTEGER NOT NULL DEFAULT 30 CHECK (question_count IN (30, 40, 50)),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 단어장 (가족 공용) -----------------------------------------------------

-- 단어장(책). 다 쓴 단어장은 지우지 않고 archived_at 으로 보관합니다.
CREATE TABLE book (
  id          INTEGER PRIMARY KEY,
  family_id   INTEGER NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX book_family ON book(family_id, sort_order);

-- Day: 단어장 안의 번호(1, 2, 3 …). 3일치 밀기는 이 번호로 계산합니다.
CREATE TABLE day (
  id         INTEGER PRIMARY KEY,
  book_id    INTEGER NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1),
  title      TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (book_id, day_number)
);

-- 단어 (영어)
CREATE TABLE word (
  id         INTEGER PRIMARY KEY,
  day_id     INTEGER NOT NULL REFERENCES day(id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX word_day ON word(day_id, sort_order);

-- 품사별 뜻. 한 단어에 품사 여러 개, 한 품사에 뜻 여러 개.
-- 뜻은 단어장에 적힌 그대로 저장합니다 (채점 기준, CLAUDE.md 5장).
CREATE TABLE meaning (
  id         INTEGER PRIMARY KEY,
  word_id    INTEGER NOT NULL REFERENCES word(id) ON DELETE CASCADE,
  pos        TEXT    NOT NULL,           -- 품사 (예: 명사, 동사, 형용사)
  text       TEXT    NOT NULL,           -- 뜻 (예: (~을) 주다)
  sort_order INTEGER NOT NULL DEFAULT 0  -- 단어 안에서의 순서 (품사 순서 → 뜻 순서)
);
CREATE INDEX meaning_word ON meaning(word_id, sort_order);

-- 학생별 ----------------------------------------------------------------

-- 학원 일정: 학생마다 하나. 요일과 시작 범위만 정하면 이후 범위는 자동 계산(#13).
CREATE TABLE schedule (
  id               INTEGER PRIMARY KEY,
  student_id       INTEGER NOT NULL UNIQUE REFERENCES member(id) ON DELETE CASCADE,
  book_id          INTEGER NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  -- 수업 요일 비트마스크: 일=1, 월=2, 화=4, 수=8, 목=16, 금=32, 토=64 (화·목 = 20)
  weekdays         INTEGER NOT NULL CHECK (weekdays BETWEEN 1 AND 127),
  start_date       TEXT    NOT NULL,     -- 시작 범위로 시험 보는 날 (YYYY-MM-DD)
  start_day_number INTEGER NOT NULL CHECK (start_day_number >= 1),
  days_per_test    INTEGER NOT NULL DEFAULT 3 CHECK (days_per_test >= 1),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 시험
CREATE TABLE test (
  id                INTEGER PRIMARY KEY,
  student_id        INTEGER NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  test_number       INTEGER NOT NULL,    -- 학생별 시험 번호 (시험지에 인쇄)
  mode              TEXT    NOT NULL CHECK (mode IN ('smart', 'full', 'review')),
  direction         TEXT    NOT NULL CHECK (direction IN ('en_ko', 'ko_en', 'mixed')),
  medium            TEXT    NOT NULL CHECK (medium IN ('screen', 'paper')),
  first_letter_hint INTEGER NOT NULL DEFAULT 0 CHECK (first_letter_hint IN (0, 1)),
  created_by        INTEGER REFERENCES member(id) ON DELETE SET NULL,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  finished_at       TEXT,                -- 채점이 끝난 시각 (NULL 이면 아직 안 봄)
  UNIQUE (student_id, test_number)
);
CREATE INDEX test_student ON test(student_id, created_at);

-- 시험 범위: 시험에 들어간 Day 목록 (3일치 밀기, 직접 고른 Day 모두 이 표로)
CREATE TABLE test_day (
  test_id INTEGER NOT NULL REFERENCES test(id) ON DELETE CASCADE,
  day_id  INTEGER NOT NULL REFERENCES day(id) ON DELETE CASCADE,
  PRIMARY KEY (test_id, day_id)
);

-- 문항
CREATE TABLE test_item (
  id         INTEGER PRIMARY KEY,
  test_id    INTEGER NOT NULL REFERENCES test(id) ON DELETE CASCADE,
  word_id    INTEGER NOT NULL REFERENCES word(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,           -- 문제 번호 (1부터)
  direction  TEXT    NOT NULL CHECK (direction IN ('en_ko', 'ko_en')),
  answer     TEXT,                       -- 학생 답 (종이 시험은 NULL). 품사별 입력칸 형식은 #10에서 정함
  is_correct INTEGER CHECK (is_correct IN (0, 1)), -- NULL 이면 아직 채점 전
  UNIQUE (test_id, position)
);
CREATE INDEX test_item_word ON test_item(word_id);

-- 단어별 기록: 스마트 출제·다시 볼 단어에 사용
CREATE TABLE word_stat (
  student_id    INTEGER NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  word_id       INTEGER NOT NULL REFERENCES word(id) ON DELETE CASCADE,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count   INTEGER NOT NULL DEFAULT 0,
  last_correct  INTEGER CHECK (last_correct IN (0, 1)), -- 마지막 결과 (0 이면 다시 볼 단어)
  last_seen_at  TEXT,
  PRIMARY KEY (student_id, word_id)
);
CREATE INDEX word_stat_seen ON word_stat(student_id, last_seen_at);
