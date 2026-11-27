-- 외우기 단계별 완료 기록 (#44)
--
-- 학생이 외우기 한 단계(가리기·객관식·주관식)를 끝까지 마칠 때마다 한 줄씩 남깁니다.
-- '완료'는 반복이 끝나 모두 외우거나 맞혔을 때만입니다. "그만하기"는 남기지 않습니다 (11/27 결정).
-- 범위에 든 Day 는 study_completion_day 에 적고, Day 별 횟수는 이 표를 세어 냅니다.

CREATE TABLE study_completion (
  id           INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  stage        TEXT    NOT NULL CHECK (stage IN ('blind', 'choice', 'write')),
  direction    TEXT    NOT NULL CHECK (direction IN ('en_ko', 'ko_en', 'mixed')),
  word_count   INTEGER NOT NULL CHECK (word_count >= 1),
  completed_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX study_completion_student ON study_completion(student_id, completed_at);

CREATE TABLE study_completion_day (
  completion_id INTEGER NOT NULL REFERENCES study_completion(id) ON DELETE CASCADE,
  day_id        INTEGER NOT NULL REFERENCES day(id) ON DELETE CASCADE,
  PRIMARY KEY (completion_id, day_id)
);
CREATE INDEX study_completion_day_day ON study_completion_day(day_id);
