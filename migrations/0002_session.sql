-- 가족 비밀번호 로그인 (#3)
--
-- 로그인 세션과 비밀번호 실패 기록을 저장합니다.
-- 세션 토큰 원문은 쿠키에만 있고, 여기에는 SHA-256 해시만 저장합니다.
-- 그래서 서명용 비밀값(시크릿) 없이도 쿠키를 위조할 수 없습니다.

CREATE TABLE session (
  token_hash   TEXT    PRIMARY KEY,      -- 세션 토큰의 SHA-256 (16진수)
  family_id    INTEGER NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  -- "누가 쓰나요?" 에서 고른 구성원. NULL 이면 아직 고르지 않음
  member_id    INTEGER REFERENCES member(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at   TEXT    NOT NULL
);
CREATE INDEX session_family ON session(family_id);

-- 비밀번호를 틀린 기록. 짧은 시간에 여러 번 틀리면 잠시 로그인을 막습니다.
CREATE TABLE login_failure (
  id        INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  failed_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX login_failure_family ON login_failure(family_id, failed_at);
