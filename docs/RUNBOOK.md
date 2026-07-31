# RUNBOOK — 장애 대응 절차

문제가 생겼을 때 **누구든 이 문서만 보고 대응**할 수 있도록 하는 것이 목적. 경영기획 소유·운영이므로, 담당자 부재 시 백업 담당이 여기서 시작한다.

## 인시던트 심각도

| 등급 | 정의 | 예시 | 대응 |
|---|---|---|---|
| **Sev1** | 대시보드 접속 불가 / 데이터 전면 중단 | 사이트 다운, 전 유통 수집 실패 | 즉시 대응 |
| **Sev2** | 일부 기능·유통 손상 | 특정 스크래퍼 파손, 한 페이지 오류 | 당일 대응 |
| **Sev3** | 경미·표시 이슈 | 라벨 오타, 단일 모델 오분류 | 백로그 |

대응 후에는 이 문서 하단 **변경/인시던트 로그**에 1줄 기록(무엇이·왜·어떻게 해결).

---

## 🔴 증상별 대응

### 1. 데이터 헬스 체크 실패 이메일이 왔다
GitHub `data-health.yml`이 신선도/커버리지 이상을 감지한 것.
1. **Actions 탭 → 데이터 헬스 체크 → 최근 실행 로그** 확인 → 어떤 유통이 FAIL인지 본다.
2. 원인 분류:
   - **특정 유통만 FAIL** → 해당 유통 스크래퍼 파손(사이트 개편 가능성) → §2
   - **전체 staleness** → 수집 워크플로 자체가 안 돎 → §3
3. Supabase에서 직접 현황 확인:
   ```sql
   select * from v_data_health;   -- 유통별 오늘 행수·7일평균·상태
   ```

### 2. 특정 유통 스크래퍼가 깨졌다 (Sev2)
사이트 구조 변경이 가장 흔한 원인. 스크래퍼는 별도 레포 `lgeph-market-intelligence`.
1. 해당 수집기 확인:
   - Abenson(Magento GraphQL)·SM(Shopify)·Anson's(Woo) → `backend/collectors/retail_scraper.py`
   - Western·Robinsons·Emcor·Addessa → `retail_scraper_ext.py`
   - Home Credit(JSON API) → `homecredit_scraper.py`
2. 로컬에서 해당 수집기만 실행해 에러 재현 → 셀렉터/엔드포인트 수정.
3. 수정 후 **Actions → retail-daily → Run workflow**로 수동 재수집 → `v_data_health`로 확인.
4. **원칙:** Home Credit은 백업/보강용(gap-fill)이므로 다른 유통이 이미 가진 모델은 채우지 않는다.

### 3. 수집 워크플로가 안 돌았다 (Sev1)
1. `lgeph-market-intelligence` → Actions → `retail-daily` 최근 실행 확인.
2. **cron 자동 비활성화 주의**: 저장소 60일 무활동 시 GitHub이 예약 워크플로를 끈다 → "Enable workflow" 클릭.
3. 수동 실행: Run workflow → 완료 후 `v_data_health` 확인.
4. 시크릿 만료·회전(`SUPABASE_SERVICE_KEY`) 여부 점검.

### 4. 배포가 안 됨 (사이트에 최신 변경이 안 보임)
Cloudflare Pages 웹훅이 커밋을 스킵하는 알려진 이슈.
1. 라이브 번들 해시로 확인:
   ```bash
   curl -s https://axlgeph.report/competitors/ | grep -oE 'page-[a-f0-9]+\.js'
   ```
2. 해시가 이전과 같으면 미배포 → **빈 커밋으로 재트리거**:
   ```bash
   git commit --allow-empty -m "chore: CF Pages 재빌드 트리거" && git push
   ```
3. 강력 새로고침(Ctrl+Shift+R)로 캐시 무시.

### 5. 빌드/배포가 실패한다 (Sev2)
1. **Actions → ci-test** 실패 로그 확인(lint·test·build 중 무엇인지).
2. 로컬 재현: `npm run lint && npm test && npm run build`.
3. 분류기 테스트 실패 시 → 분류 로직 변경이 골든셋을 깨뜨린 것. 의도된 변경이면 `src/lib/classify.test.ts`에 정답 케이스 갱신, 아니면 로직 롤백.

### 6. 데이터베이스 접근/쓰기 문제
- **anon으로 INSERT 401** → 정상(RLS 차단). 권한 쓰기는 **Supabase MCP** 또는 service key로만.
- **프로젝트 일시정지**(Free 티어, 7일 미접속) → Supabase 대시보드에서 Resume.
- **용량 경고(500MB)** → 오래된 이력 아카이빙 필요(§데이터 보존).

---

## 정기 점검(주간)
- [ ] `v_data_health` 전 유통 OK 확인
- [ ] Supabase DB 사용량(500MB 한도 대비) 확인
- [ ] GitHub Actions 사용분(무료 2,000분/월) 확인
- [ ] Cloudflare Pages 빌드 수(무료 500/월) 확인
- [ ] 백업 아티팩트 정상 생성 확인(`db-backup.yml`)

## 접근·자격정보
- **Supabase 프로젝트:** `ozvbyigntwhwzzagwojr` — 대시보드에서 DB URL·키·백업 관리
- **GitHub 레포:** `xhem2793-tech/lgeph-dashboard`(웹) · `xhem2793-tech/lgeph-market-intelligence`(수집)
- **Cloudflare Pages:** axlgeph.report 프로젝트
- 시크릿 목록·소유는 [OWNERSHIP.md](OWNERSHIP.md) 참조

---

## 변경/인시던트 로그
> 큰 변경·장애를 1줄씩 append (날짜 · 무엇 · 왜 · 결과).

- 2026-08-01 · 운영 문서 세트(README·RUNBOOK·DATA_DICTIONARY·ADR) 신설 · 조직적 유지 착수 · 완료
- 2026-08-01 · 데이터 헬스 게이트(`data-health.yml`) 도입 · 조용한 수집 실패 감지 · 완료
- 2026-08-01 · 분류기 `classify.ts` 분리 + 골든셋 테스트 · 정확도 회귀 방지 · 완료
