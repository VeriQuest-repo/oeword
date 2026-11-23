# 외워드 (Oeword)

단어장을 한 번 입력하면, 학생은 패드나 폰으로 직접 떠올려 답하며 외우고, 보호자는 매일 시험지를 자동으로 받고 공부 기록을 확인하는 가족용 영단어 서비스입니다.

- 기술 스택: React · TypeScript · Vite · Tailwind CSS · Cloudflare Workers · D1 · PWA
- 개발 지침: [CLAUDE.md](CLAUDE.md)
- 작업일지: [docs/worklog](docs/worklog)

## 설치와 실행

Node.js 22가 필요합니다.

```sh
npm install
npm run dev
```

브라우저에서 터미널에 나온 주소(기본 http://localhost:5173)를 엽니다. 화면과 `/api/*` 가 한 서버에서 함께 뜨고, D1은 로컬 데이터베이스(`.wrangler/` 폴더)를 씁니다. `/api/health` 를 열면 서버와 D1 연결 상태를 볼 수 있습니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 로컬 개발 서버 |
| `npm run lint` | oxlint 검사 |
| `npm test` | Vitest 단위 테스트 |
| `npm run build` | 타입 검사 후 `dist/` 로 빌드 |
| `npm run preview` | 빌드한 결과를 로컬에서 실행 |
| `npm run cf-typegen` | `wrangler.jsonc` 를 바꾼 뒤 Worker 타입 다시 만들기 |
| `npm run deploy` | 빌드 후 Cloudflare에 배포 (사람 확인 후) |

## 처음 배포하기

1. Cloudflare에 로그인합니다: `npx wrangler login`
2. D1 데이터베이스를 만듭니다: `npx wrangler d1 create oeword`
3. 나온 `database_id` 를 `wrangler.jsonc` 의 `d1_databases` 에 넣고 커밋합니다.
4. 배포합니다: `npm run deploy` → `https://oeword.<계정>.workers.dev`

마이그레이션은 [migrations/README.md](migrations/README.md)를 봅니다.

## CI

main 푸시와 PR마다 GitHub Actions가 `npm ci` → `npm run lint` → `npm test` → `npm run build` 를 실행합니다 (`.github/workflows/ci.yml`).
