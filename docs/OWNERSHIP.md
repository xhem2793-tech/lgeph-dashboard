# OWNERSHIP — 소유·책임(RACI)

운영 모델: **경영기획 소유·운영(business-managed, [ADR-0007](adr/0007-business-managed-ownership.md))**.
경영기획이 제품·데이터·운영을 모두 보유하므로, **bus-factor(1인 의존)가 최대 리스크**다. 이 문서와 [RUNBOOK](RUNBOOK.md)을 최신으로 유지하는 것이 사실상의 조직적 유지 장치다.

## 역할

| 역할 | 담당 | 책임 |
|---|---|---|
| 제품 오너 | 김성욱(경영기획) | 우선순위·요구사항·데이터 정의·최종 의사결정 |
| **백업 담당** | **_(미지정 — 반드시 지정)_** | 부재 시 RUNBOOK 기반 대응, 정기 점검 |
| 운영/개발 | 김성욱 (+ AI 보조) | 코드·수집기·배포·인시던트 대응 |

> ⚠️ 최우선 액션: **백업 담당 1명 지정.** 경영기획 소유 모델의 유일한 구조적 취약점을 메우는 조치.

## RACI (R=실행 A=최종책임 C=자문 I=공유)

| 활동 | 제품오너 | 백업담당 | AI보조 |
|---|---|---|---|
| 요구사항·우선순위 | A/R | C | C |
| 코드 변경·리뷰 | A/R | R | R |
| 배포 | A/R | R | I |
| 인시던트 대응 | A/R | R | C |
| 데이터 정의 변경 | A/R | C | C |
| 정기 점검(주간) | A | R | I |
| 백업·복구 | A/R | R | I |

## 자격정보·시크릿 대장

| 시크릿 | 위치 | 용도 | 회전 |
|---|---|---|---|
| `SUPABASE_SERVICE_KEY` | 수집 레포 Actions 시크릿 | 스크래퍼 DB 쓰기 | 유출 시 즉시 |
| `SUPABASE_DB_URL` | 대시보드 레포 Actions 시크릿 | DB 백업(pg_dump) | 비번 변경 시 |
| `NEXT_PUBLIC_SUPABASE_*` | 공개(브라우저 번들) | 뷰 읽기 | — |
| `SLACK_WEBHOOK_URL`·`HEARTBEAT_URL` | 대시보드 레포(선택) | 헬스 경보 | — |

원칙: 시크릿은 코드에 하드코딩 금지(공개 값 제외), GitHub Actions Secrets로만. service key는 절대 채팅·커밋에 남기지 않는다.

## 외부 벤더·계정

| 벤더 | 계정 소유 | 플랜 | 한도(주의) |
|---|---|---|---|
| Supabase | 김성욱 | Free | DB 500MB · 7일 미접속 정지 |
| Cloudflare | 김성욱 | Free | 빌드 500/월 |
| GitHub | xhem2793-tech | Free | Actions 2,000분/월(private) |

## 백업 담당 온보딩 체크리스트
- [ ] Supabase·Cloudflare·GitHub 접근 권한 부여
- [ ] [README](../README.md) → [RUNBOOK](RUNBOOK.md) → [DATA_DICTIONARY](DATA_DICTIONARY.md) 정독
- [ ] `data-health.yml`·`retail-daily` 수동 실행 1회 실습
- [ ] 배포(빈 커밋 재트리거) 실습
- [ ] 백업 아티팩트 다운로드·복구 리허설 1회
