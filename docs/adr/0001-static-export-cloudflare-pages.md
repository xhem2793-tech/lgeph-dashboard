# 0001. 정적 export + Cloudflare Pages 호스팅

- 상태: 채택됨
- 날짜: 2026 (소급 기록 2026-08-01)

## 맥락
1인 운영·무료 티어에서 서버 관리 부담 없이 빠른 대시보드가 필요.

## 결정
Next.js를 `output: export`(정적 SSG)로 빌드하고 Cloudflare Pages에 배포. `git push main` = 배포.

## 대안
- Vercel SSR: 서버 런타임·비용·벤더 종속.
- 자체 서버: 운영 부담 과다.

## 결과
- 장점: 무료·빠름·CDN 캐시·운영 단순.
- 트레이드오프: 런타임 서버 없음 → 모든 데이터는 클라이언트가 Supabase anon으로 조회. 웹훅 스킵 시 빈 커밋 재트리거 필요(RUNBOOK §배포).
