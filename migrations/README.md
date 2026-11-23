# migrations

D1 스키마 변경은 이 폴더의 SQL 파일로만 합니다. 파일 이름은 `0001_init.sql`, `0002_...sql` 처럼 번호 순서로 붙입니다.

```sh
npx wrangler d1 migrations create oeword <설명>      # 새 파일 만들기
npx wrangler d1 migrations apply oeword --local    # 로컬 D1에 적용
npx wrangler d1 migrations apply oeword --remote   # 배포 D1에 적용 (사람 확인 후)
```

첫 스키마는 #2(D1 데이터 구조 v1)에서 만듭니다.
