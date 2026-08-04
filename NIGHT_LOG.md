# 야간 자동작업 로그 (김성욱님 취침 중)

---

## ☀️ 깨어나서 할 일 — Supabase 로그인 전환 (약 3분, 제가 못 누르는 것만)

> 지금 상태: 로그인 페이지·DB·게이트 **전부 구축·배포·검증 완료**. 단 **Cloudflare Access가 켜져 있어** 아직은 Access로 로그인합니다(안전, 아무것도 안 깨짐). 아래만 하시면 Supabase 로그인으로 전환됩니다. **급하지 않으면 그냥 두셔도 사이트는 정상 작동합니다.**

**A. Supabase 대시보드 (제가 로그인 못 함)**
1. **이메일 템플릿에 코드 넣기** (필수) — Authentication → Emails → **Magic Link** 템플릿에 아래 한 줄 추가(코드 로그인이라 코드가 메일에 보여야 함):
   `<p>로그인 코드: <b>{{ .Token }}</b></p>`
   - (선택) 발송량이 많으면 Project Settings → Auth → SMTP에 사내 메일 서버 연결(무료 기본 SMTP는 시간당 한도 있음).
2. 확인만: Authentication → Providers → **Email = 켜짐**(이미 켜져 있음 ✓), Confirm email 유지.

**B. 코드에서 스위치 켜기 (제가 해둘 수도 있으나, Access와 동시 전환 타이밍이라 남겨둠)**
3. `src/lib/authClient.ts` 의 `SUPABASE_AUTH_ENABLED = false` → `true` 로 바꾸고 저장 → 자동 배포(git push는 제가 안내). 
   - *원하시면 "로그인 켜줘" 한마디면 제가 이 한 줄 바꿔 배포합니다.*

**C. Cloudflare Zero Trust 대시보드 (제가 로그인 못 함)**
4. Access → Applications → axlgeph.report → 정책을 끄거나 앱 삭제(= Access 해제). 그래야 Supabase 로그인이 실제로 뜹니다.

**D. 첫 로그인 테스트**
5. axlgeph.report 접속 → /login → 본인 이메일(`xhem2793@gmail.com` 또는 `@lge.com`) → 메일 코드 입력 → 진입.

> 허용 계정: **@lge.com 전체 + xhem2793@gmail.com**. 추가하려면 "○○@메일 허용해줘" 하시면 제가 DB에 넣습니다. (허용목록은 외부에 노출 안 되게 RLS로 막아둠.)

---

> 각 태스크 전환·완료·배포·질문·중단 시각 기록. 시간=로컬 시스템 시계.
> 순서: ① 영문화 완성 → ② 최적화 → ③ Supabase 로그인 → ④ 본사 제출 자가점검(디자인철학·추가지표/페이지/데이터)

## 타임라인

- **2026-08-05 00:16** — 야간 자동작업 시작. 로그 개시. 로그인 방식 A(이메일 OTP) 확정.
- **00:21** — [①완료] **영문화 완성 배포**(b3abb52). 워크플로 5에이전트(캘린더 event_en·지표 210개 EN·배너 _en·마케팅) + 잔여 한글 정리.
  - 남은 한글(불가피): 일부 아젠다 이벤트(DB event_en=null) → 데이터 보정 필요. 뉴스 본문·이벤트 상세(summary_en 컬럼 없음)는 원문 유지(정책대로).
- **00:26** — [②진행] **최적화 배포**(575de1c): sb() 세션 인메모리 캐시(TTL 3분)+디듀프, _next/static·woff2 immutable, 보안헤더, 이미지 lazy.
- **00:28** — [②완료] 실측: economy DOMContentLoaded 346ms/load 717ms. **캐시 검증: SPA 재방문 시 신규 Supabase 요청 0건**. 콘솔 에러 0. 안정성 양호.
- **00:44** — [③완료] **Supabase 로그인 배포**(f6a2d67): /login(이메일 OTP·SDK없이 REST), authClient, AuthGate(기본 OFF·Access 병행), login_allowlist+RPC(목록 비노출), TopNav /login 숨김.
  - 검증: 게이트 정상(master/@lge.com 허용·random 차단·목록 0행 비노출), email 인증 활성 확인. 위 ☀️체크리스트로 전환.
- **00:44** — [④시작] **본사 제출 자가점검** — 적합성·수정점·디자인 철학·추가 지표/페이지/데이터 제안.

- **00:48** — [④진행] 메타데이터 실브랜딩+noindex, HQ_REVIEW.md 작성 배포(f5f94b8).
- **00:51** — [④진행] 캘린더 event_en 전건(20건) DB 채움 + 통상/사회 카테고리(ec188ba).
- **00:59** — [④/EN최종스윕] 전 페이지 EN 한글 재스캔 후 잔여 정리 배포(b895206):
  - TopNav soon 뱃지 '예정' raw→T (전역 — 모든 페이지 '예정' 원인이었음).
  - calendar: 사회/통상 라벨 + 발표시각 'N AM/PM' 포맷.
  - competitor-ads prodLabel 정규식 폴백(bare '에어컨'→RAC).
  - **남은 한글(데이터·불가피):** ①경쟁광고 카드 본문(유통사 스크랩 원문), ②reports 문서 제목·kind(한글 분석문서, EN원본 없음), ③이벤트 상세 summary(summary_en 컬럼 없음). 모두 UI가 아닌 '데이터 콘텐츠' → EN 원본 생성 시에만 번역 가능(별도 데이터 작업).
  - **UI 크롬 한글 = 사실상 0.**
