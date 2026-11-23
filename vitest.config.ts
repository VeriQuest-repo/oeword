import { defineConfig } from "vitest/config";

// 테스트는 Cloudflare 플러그인 없이 순수 로직만 돌립니다.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "worker/**/*.test.ts"],
  },
});
