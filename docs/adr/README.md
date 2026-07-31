# Architecture Decision Records (ADR)

중요한 기술·운영 결정을 **왜 그렇게 정했는지**와 함께 남긴다. 사람이 바뀌어도 "이건 왜 이렇게 돼 있지?"에 답할 수 있게 하는 것이 목적.

## 규칙
- 되돌리기 어렵거나 논쟁 여지가 있는 결정을 남긴다(사소한 건 X).
- 파일명: `NNNN-제목-슬러그.md` (번호는 증가).
- 상태: `제안됨` → `채택됨` → (필요시) `대체됨(→NNNN)`.
- 결정을 바꾸면 기존 ADR을 지우지 말고 새 ADR로 대체(supersede)한다.
- 템플릿: [`template.md`](template.md)

## 목록
| # | 제목 | 상태 |
|---|---|---|
| [0001](0001-static-export-cloudflare-pages.md) | 정적 export + Cloudflare Pages 호스팅 | 채택됨 |
| [0002](0002-supabase-datastore-rls.md) | Supabase 데이터스토어 + RLS(뷰 읽기 계약) | 채택됨 |
| [0003](0003-canoncode-classifier-fallbacks.md) | canonCode 병합 + 분류기 다층 폴백(기타 0%) | 채택됨 |
| [0004](0004-home-credit-backup-gapfill.md) | Home Credit = 백업/gap-fill 전용 | 채택됨 |
| [0005](0005-classifier-module-golden-tests.md) | 분류기 모듈 분리 + 골든셋 회귀 테스트 | 채택됨 |
| [0006](0006-data-health-gate.md) | 데이터 헬스 게이트(조용한 실패 감지) | 채택됨 |
| [0007](0007-business-managed-ownership.md) | 경영기획 소유·운영(business-managed) | 채택됨 |
