# DATA DICTIONARY — 데이터 사전

지표·테이블·뷰의 **정의·출처·갱신주기·소유**. 데이터 시스템의 신뢰는 "이 숫자가 무엇이고 어디서 왔나"를 답할 수 있느냐에 달려 있다. 도메인 단위로 정리(전체 테이블 ~38 · 뷰 ~50).

원칙
- **뷰(`v_*`) = 대시보드가 읽는 계약(contract).** 프런트는 뷰만 읽고 원천 테이블은 직접 읽지 않는다.
- 원천 테이블은 스크래퍼/인제스트가 채운다(service key). anon은 뷰 SELECT만.
- 연간지표는 World Bank, 최소 10년치 기준(ADR-0002 관련).

---

## 도메인 1 — 경쟁사 가격 (핵심 자산)

| 객체 | 유형 | 정의 | 출처 | 갱신 |
|---|---|---|---|---|
| `competitor_prices` | 테이블 | 유통×모델×일자 실판매가 원천(전 이력) | 8개 유통 스크래퍼 | 매일 |
| `v_competitor_3d` | 뷰 | 유통×모델 최근 7일 스냅샷(p0~p3·d0~d3·prices7·srp·availability·image) | ↑ 파생 | 조회시 |
| `v_competitor_daily` | 뷰 | LG 120일 이력 + 전 브랜드 최신 | ↑ 파생 | 조회시 |
| `v_competitor_movers` | 뷰 | 전일 대비 변동 | ↑ 파생 | 조회시 |
| `v_competitor_promo` | 뷰 | 프로모 텍스트 결합 | ↑ 파생 | 조회시 |
| `v_data_health` | 뷰 | **수집 건전성**(유통별 오늘 행수·7일평균·FAIL/WARN/OK) | ↑ 파생 | 매일 검증 |

수집 유통(8): Abenson · SM Appliance · Anson's · Western Appliances · Robinsons Appliances · Emcor · Addessa · **Home Credit**(백업/gap-fill).

핵심 파생 개념(코드: `src/lib/classify.ts`)
- **canonCode** — 거래선마다 다른 표기를 흡수하는 모델 병합 키(측정단위 토큰 제외·하이픈 결합).
- **유형(form)** — 냉장고(SxS/F·D/T·F…)·세탁기(F·L/T·L…)·TV(OLED/QLED급/UHD…)·에어컨(창문/벽걸이/스탠드/시스템). 다층 폴백으로 '기타' 0%.
- **사이즈** — 냉장고=cu.ft·세탁기=kg·TV=인치·에어컨=HP 버킷.
- 정의 변경 시 반드시 `classify.test.ts` 골든셋 갱신(회귀 방지).

## 도메인 2 — 프로모·광고·경쟁 인텔

| 객체 | 정의 | 출처 |
|---|---|---|
| `retail_promos` · `v_promo_intensity` · `v_promo_campaigns` | 프로모 강도·캠페인 | 스크래퍼 |
| `competitor_ads` · `competitor_ads_raw` · `v_competitor_ads_board` | 경쟁사 광고 | 광고 수집 |
| `competitor_intel` · `coverage_gaps` · `distributors` | 경쟁 인텔·유통 커버리지 | 수기/파생 |
| `energy_labels` · `v_energy_label_new_models` · `v_rac_efficiency_by_brand` | DOE 에너지등급(★)·신규모델 | DOE 스크래퍼 |

## 도메인 3 — 거시경제

| 객체 | 정의 | 출처 |
|---|---|---|
| `annual_indicators` | 연간 거시지표(10년+) | **World Bank** |
| `monthly_indicators` · `macro_indicators` · `v_macro_latest` | 월간·최신 지표 | PSA/BSP 등 |
| `fx_daily` · `exchange_rates` · `v_fx_monthly` | 환율 | FX 소스 |
| `import_prices` · `oil_prices` · `v_oil_daily` | 수입물가·유가 | 인제스트 |
| `weather` · `weather_alerts` · `earthquakes` | 날씨·재해 | Open-Meteo·USGS(keyless) |
| `infra_regional*` · `sellout_regional` · `v_cost_of_living_regional` | 지역 인프라·셀아웃 | DPWH·PSA |

## 도메인 4 — 뉴스·리포트·캘린더

| 객체 | 정의 | 출처 |
|---|---|---|
| `news_raw` → `news_articles` · `v_news_feed` · `v_daily_news` | 뉴스 수집·정제 | 뉴스 인제스트 |
| `analysis_posts` · `ai_insights` · `v_latest_insight` | 분석·AI 인사이트 | 생성/수기 |
| `weekly_summary` · `weekly_trends` · `v_week_digest` | 주간 요약·트렌드 | `weekly-insight.mjs` |
| `economic_calendar` · `v_calendar_month` | 경제 캘린더 | 인제스트 |
| `regulatory_alerts` · `v_reg_board` | 규제 알림 | 인제스트 |
| `daily_brief` · `business_risk` · `market_estimates` | 브리핑·리스크·시장추정 | 생성/수기 |

## 도메인 5 — 운영·건전성 메타

| 객체 | 정의 |
|---|---|
| `v_data_health` | 경쟁가 수집 건전성(§도메인1) |
| `v_ingest_health` · `v_freshness` · `v_data_provenance` | 인제스트 신선도·출처 추적 |

---

## 보존·아카이빙 정책 (초안)
- `competitor_prices`는 이력이 계속 누적 → **500MB DB 한도**의 최우선 압박 요인.
- 정책(권장): 최근 N개월 상세 유지, 이후는 월별 집계로 롤업 또는 콜드 아카이브(백업 아티팩트).
- 백업: `db-backup.yml`(무료, pg_dump 아티팩트) · 근본은 Supabase Pro PITR.

## `*_backup_*` 테이블
`competitor_ads_backup_20260722`, `oil_prices_backup_20260714` 등은 **일회성 수동 백업 스냅샷**. 정기 백업 체계(`db-backup.yml`) 정착 후 정리 대상.
