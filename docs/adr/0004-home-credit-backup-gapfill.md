# 0004. Home Credit = 백업/gap-fill 전용

- 상태: 채택됨
- 날짜: 2026 (소급 기록 2026-08-01)

## 맥락
Home Credit 쇼핑몰은 제휴점(Abenson 등) 가격을 무이자 할부로 재판매 → 다른 유통과 모델이 중복된다.

## 결정
Home Credit은 **다른 유통이 이미 가진 모델은 채우지 않고**, 없는 모델만 gap-fill. 스펙 비교 시 보강용으로만 사용. 공개 JSON API(`/.rest/search/v2/list`)로 수집.

## 결과
- 장점: 중복 집계 방지, 커버리지 보강.
- 트레이드오프: 프런트에서 canonCode 기준 primary 유무로 필터링하는 로직 필요.
