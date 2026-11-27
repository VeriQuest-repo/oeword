# migrations

D1 스키마 변경은 이 폴더의 SQL 파일로만 합니다. 파일 이름은 `0001_init.sql`, `0002_...sql` 처럼 번호 순서로 붙입니다.

```sh
npx wrangler d1 migrations create oeword <설명>      # 새 파일 만들기
npx wrangler d1 migrations apply oeword --local    # 로컬 D1에 적용
npx wrangler d1 migrations apply oeword --remote   # 배포 D1에 적용 (사람 확인 후)
```

한 번 원격에 적용한 파일은 고치지 않습니다. 바꿀 내용이 있으면 새 번호의 파일을 만듭니다.

## 테이블 (0001_init.sql)

| 구분 | 테이블 | 내용 |
| --- | --- | --- |
| 가족 | `family` | 가족 이름, 가족 비밀번호 해시 |
| | `member` | 구성원 이름, 역할(`guardian` 보호자 / `student` 학생) |
| | `family_settings` | 관리 방식(`guardian` 보호자 관리 / `self` 혼자 관리), 문제 수(30·40·50) |
| 단어장 (가족 공용) | `book` › `day` › `word` › `meaning` | 단어장 › Day › 단어 › 품사별 뜻 |
| 학생별 | `schedule` | 학원 요일·시작 범위·단어장 (학생마다 하나) |
| | `test`, `test_day` | 시험(방식·형식·화면/종이·시험 번호)과 시험 범위(Day) |
| | `test_item` | 문항(단어·방향·학생 답·정답 여부) |
| | `word_stat` | 학생·단어별 맞힘·틀림 횟수, 마지막 결과, 마지막으로 본 날 |

## 테이블 (0002_session.sql)

| 테이블 | 내용 |
| --- | --- |
| `session` | 로그인 세션 (토큰의 SHA-256 해시, 가족, 고른 구성원, 만료 시각) |
| `login_failure` | 가족 비밀번호를 틀린 시각 (짧은 시간에 여러 번 틀리면 잠시 막기) |

데이터 모듈 테스트(`worker/db/*.test.ts`)는 Node 내장 SQLite에 이 폴더의 SQL을 그대로 적용해서 돌립니다.

## 테이블 (0003_study_completion.sql)

| 테이블 | 내용 |
| --- | --- |
| `study_completion` | 외우기 단계 완료 한 번 (학생, 단계 `blind`·`choice`·`write`, 방향, 단어 수, 시각) |
| `study_completion_day` | 그 완료에 들어간 Day (Day별 완료 횟수는 이 표를 셈) |
