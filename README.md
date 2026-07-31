# axlgeph.report — LGE-PH 시장 인텔리전스 대시보드

필리핀 가전 시장의 **경쟁사 가격·프로모·거시경제·뉴스**를 매일 자동 수집해 경영기획 의사결정에 제공하는 사내 인텔리전스 대시보드.

- **운영 URL:** https://axlgeph.report
- **운영 모델:** 경영기획 소유·운영(business-managed) — 제품·데이터·운영 책임을 경영기획이 보유
- **제품 오너:** 김성욱 (경영기획) · **백업 담당:** _(미지정 — 반드시 지정 권장, [docs/OWNERSHIP.md](docs/OWNERSHIP.md))_
- **상태:** 운영 중(prod) · 무료 티어 스택

> 신규/백업 담당자는 이 문서 → [RUNBOOK](docs/RUNBOOK.md) → [DATA_DICTIONARY](docs/DATA_DICTIONARY.md) 순으로 30분이면 전체 그림을 잡을 수 있습니다.
> **경영기획이 계속 소유·운영**하므로, 이 문서 세트(런북·데이터사전·ADR)를 최신으로 유지하는 것이 곧 조직적 유지의 핵심입니다.

---

## 1. 아키텍처 한눈에

```
┌─ 수집(매일 cron) ─────────┐     ┌─ 저장 ────────┐     ┌─ 표현 ───────────────┐
│ lgeph-market-intelligence │     │  Supabase     │     │  lgeph-dashboard      │
│  Python 스크래퍼          │──▶ │  (Postgres)   │──▶ │  Next.js 정적 export  │
│  · 8개 유통 가격          │ SVC │  테이블+뷰    │ anon│  Cloudflare Pages      │
│  · 에너지라벨·뉴스·거시   │ KEY │  + RLS        │ read│  axlgeph.report        │
└───────────────────────────┘     └───────────────┘     └────────────────────────┘
      GitHub Actions(cron)              MCP/service            git push = 배포
                                             ▲
                                   data-health.yml(매일 검증·경보)
```

| 계층 | 기술 | 비고 |
|---|---|---|
| 프런트 | Next.js 14 (App Router, `output: export`) · Tailwind · Radix · Recharts | 정적 SSG |
| 호스팅 | Cloudflare Pages | `git push main` → 자동 빌드·배포 |
| 데이터 | Supabase (Postgres, 프로젝트 `ozvbyigntwhwzzagwojr`) | 테이블 ~38 · 뷰 ~50 · RLS |
| 수집 | Python 스크래퍼 + GitHub Actions cron | 별도 레포 `lgeph-market-intelligence` |
| 자동화 | GitHub Actions | `retail-daily`(수집)·`data-health`(검증)·`ci-test`(테스트)·`weekly-insight` |

## 2. 저장소 구조

```
src/
  app/(main)/            # 페이지: overview·competitors·economy·news·reports·calendar 등
    competitors/page.tsx #   경쟁사 탭 오케스트레이션(컨테이너)
  components/competitors/ # 경쟁사 뷰(뷰별 파일 분리)
    BoardView · PositioningMatrix · DealsView · AnomalyView · MoversView · PromoView · shared
  lib/
    supabase.ts          # 데이터 접근 계층(뷰→타입 매핑)
    classify.ts          # 제품 분류·정규화 순수 함수(canonCode·유형·사이즈)
    classify.test.ts     # 분류기 골든셋 회귀 테스트(Vitest)
scripts/                 # 발행·인제스트·헬스체크 스크립트
.github/workflows/       # CI·헬스·주간 자동화
docs/                    # 운영 문서(RUNBOOK·DATA_DICTIONARY·ADR·OWNERSHIP)
```

## 3. 로컬 개발

```bash
npm install
npm run dev      # 개발 서버
npm run lint     # 린트
npm test         # 분류기 골든셋 테스트
npm run build    # 정적 빌드(배포 전 필수 통과)
```

환경변수(`.env.local`, 공개 값): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. 배포

- `main` 브랜치 push → Cloudflare Pages 자동 빌드·배포.
- **CI 게이트**: push/PR 시 `ci-test.yml`이 lint·test·build를 검증(실패 시 병합·배포 전 차단).
- 웹훅 스킵으로 미빌드 시 빈 커밋으로 재트리거 → [RUNBOOK](docs/RUNBOOK.md) 참조.

## 5. 신뢰성·SLO(요약)

| 지표 | 목표(SLO) | 감시 |
|---|---|---|
| 가격 데이터 신선도 | 매일 갱신, 2일 이상 지연 시 경보 | `data-health.yml` |
| 유통 커버리지 | 8개 유통 전부 수집(7일평균 대비 -60% 시 경보) | `v_data_health` |
| 분류 정확도 | 골든셋 42케이스 100% | `ci-test.yml` |
| 사이트 가용성 | 99% | Cloudflare |

전체 운영 규약은 [docs/RUNBOOK.md](docs/RUNBOOK.md) · 데이터 정의는 [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) · 설계 결정은 [docs/adr/](docs/adr/) · 소유·책임은 [docs/OWNERSHIP.md](docs/OWNERSHIP.md) 참조.
