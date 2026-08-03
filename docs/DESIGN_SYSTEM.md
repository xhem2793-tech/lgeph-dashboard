# LGE-PH 대시보드 디자인 시스템

iOS 톤으로 통일된 대시보드의 **구조적 설계 단일 소스**. 새 UI를 만들거나 기존 UI를 수정할 때 이 문서의 토큰·규칙을 따른다. (2026-08 확정, 지속 갱신)

전역 토큰은 `src/app/globals.css`, 공용 값은 `src/lib/*`(예: `severity.ts`)에 있다.

---

## 1. 모션 시스템

**easing 2곡선 체계** (globals.css `:root`):

| 토큰 | 값 | 용도 |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | 진입·이동·hover (앱 표준 ease-out) |
| `--ease-spring` | `cubic-bezier(.34,1.42,.64,1)` | 팝업·토글 젠틀 스프링(살짝 튕김) |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | 종료 |

- 새 애니메이션은 이 3곡선 밖으로 나가지 않는다. (구 `cubic-bezier(.16,1,.3,1)`·`.34,1.56` 등은 금지)
- 전역 키프레임: `popIn`/`popOut`(모달), `veilIn`/`veilOut`(배경 딤) — globals.css 정의, 개별 인라인 재정의 금지.
- 접근성: `@media (prefers-reduced-motion: reduce)`로 애니메이션 정지(Apple HIG).

## 2. 전역 iOS 디테일 (globals.css)

- **포커스 링**: `:focus-visible` 시 `box-shadow: 0 0 0 3.5px rgba(99,102,241,.32)`(키보드 전용, 요소 radius 따름).
- **스크롤바**: 얇은 반투명(`rgba(120,120,128,.35)`, 8px, rounded). 개별 컴포넌트 별도 스타일 금지.
- `scroll-behavior: smooth` · `-webkit-tap-highlight-color: transparent` · 폰트 스무딩.

## 3. 색 · 카테고리 팔레트

전 페이지 단일 소스. calendar `tone().dot`·EventModal `CAT_DOT`·news `ART.accent`가 모두 일치.

| 카테고리 | 색 | 카테고리 | 색 |
|---|---|---|---|
| 경제 | emerald | 유통/CE | violet |
| 금융/거시 | **blue** (#2563eb) | 공휴일·기상 | teal |
| 정치 | **purple** (#9333ea) | B2B | sky |
| 규제 | red | 에너지 | amber |
| 인사이트 | indigo | | |

- 하드코딩 hex 배경(`style={{backgroundColor}}`)은 다크에서 깨짐 → Tailwind 토큰 사용(`bg-gray-50 dark:bg-gray-900/40`). 차트 series 색만 예외.

## 4. 모달 / 팝업 (단일 스펙)

- **배경**: `fixed inset-0 z-[..] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md` + `veilIn/veilOut`.
- **패널**: `rounded-[26px] bg-white ring-1 ring-black/[0.06] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] dark:bg-gray-900 dark:ring-white/10` (투명 금지). Drawer도 `rounded-[26px]`.
- **진입** `popIn .44s var(--ease-spring)` · **종료** `popOut .22s var(--ease-in)`.
- **닫기 버튼**: `absolute right-3.5 top-3.5 h-8 w-8 rounded-full bg-black/[0.06] dark:bg-white/10 active:scale-90` + `aria-label="닫기"`.
- **카테고리 표시**: 풀하이트 좌측 색 슬랩 금지 → 헤더에 `h-1.5 w-1.5 rounded-full` 카테고리 도트.
- **기사 팝업**: 고정 높이 `h-[660px]`, 본문만 내부 스크롤(기사별 크기 편차 방지).

## 5. 알약 토글 (iOS 세그먼티드)

- 트랙: `rounded-full bg-gray-200/80 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] dark:bg-gray-800/80 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]` (테두리 없음).
- 썸: 떠 있는 흰색 `bg-white shadow-[0_1px_3px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.04)] dark:bg-gray-950` (indigo 채움 금지) + 스프링 모션.
- 라벨: 선택=뉴트럴 `text-gray-900 dark:text-gray-50`, 누름 `active:scale-[.93]`.
- 적용: `Segmented`·`PillToggle`(TopNav)·월 스테퍼·DailyIndicators·MoversView·PositioningMatrix·WeatherView·EconViews.

## 6. 배지 · 칩

- 지배형: `inline rounded border border-{c}-200 dark:border-{c}-500/30 bg-{c}-50 dark:bg-{c}-500/10 px-1 py-px text-[10px] font-semibold text-{c}-700 dark:text-{c}-300`.
- weight는 `font-semibold` 통일(bold 금지). 카운트 pill=`rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500`. 모든 배지 `dark:` 필수.
- **심각도**(Critical/High/Medium)는 `@/lib/severity`의 `SEV` 단일 소스 사용.
- 콜아웃 좌측 보더: `border-l-2 border-indigo-300 dark:border-indigo-500/40`(3px·indigo-500 금지). "LG 인사이트/관점"은 항상 indigo.

## 7. 아이콘

- UI 글리프: `viewBox 0 0 24 24` · `fill="none" stroke="currentColor"` · `strokeWidth="1.8"` · 항상 `strokeLinecap="round" strokeLinejoin="round"`.
- 차트/데이터-viz 스트로크(≤1.8·9), news `ART` 장식 글리프(viewBox 52·sw3)는 예외.
- 배너 리딩 아이콘: iOS 앱배지형 스퀘어클 `h-9 w-9 rounded-[11px] bg-{c}-600 text-white shadow-sm shadow-{c}-600/25`.

## 8. 사이드바 (news·economy·competitors 동일)

- 헤더: 아이콘(13px) + 타이틀 `text-[13.5px] font-bold` + `px-2 py-2.5 border-b`.
- 메뉴 컨테이너 `px-2 gap-1`. 그룹 구분 헤더 없음(평면 리스트).
- 항목: `rounded-md px-2.5 py-2` · 라벨 `text-[14px]` · 카운트 `text-[11px]`.
- 활성: `bg-indigo-50/70` + 좌측 액센트 바(`absolute -left-2 h-4 w-[2.5px] rounded-r-full bg-indigo-500`).
- hover: 보라 `hover:bg-indigo-50` + 플로팅 lift `transition-all duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 active:scale-[.98]`.
- (competitor-ads 좌측은 다중선택 **필터**라 그룹 라벨 유지)

## 9. 배너 (InsightBanner + 형제 뷰 배너)

- 셸: `rounded-2xl border border-{c}-100 dark:border-{c}-500/25 bg-{c}-50/60 dark:bg-{c}-500/[0.08]` (무거운 그라디언트 금지 → 솔리드 틴트).
- 내부 pill: 솔리드 인디고 금지 → 소프트 틴트 `bg-{c}-600/10 dark:bg-{c}-500/20 text-{c}-700 dark:text-{c}-300`.
- 확장: `grid-template-rows 0fr↔1fr` `.36s var(--ease-out)`.

## 10. 카드 · 톤 (플랫)

- 위젯 박스 흰 채움 금지 → `rounded-xl border border-gray-100 dark:border-gray-800`(hairline, 무채움) + hover lift.
- 섹션 카드: `rounded-xl p-4 hover:shadow-md`(채움·테두리 없음, 페이지 배경 위).
- 라운드 티어: 모달 `rounded-[26px]` / 카드·섹션 `rounded-xl` / 컨트롤·칩 `rounded-lg`·`rounded-full`.

## 11. 테이블

- 헤더: `bg-gray-50 dark:bg-gray-900`(불투명, /60·/70·/95 금지), th `border-b border-gray-200 dark:border-gray-800`(gray-700 금지), `text-gray-600 dark:text-gray-300`.
- 행 hover: `hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10`(/30·/40 금지). 행 분리선 `border-gray-100 dark:border-gray-800/60`.

## 12. 인풋 · 검색

- 표준: `rounded-full border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 focus:border-indigo-400 focus:bg-white focus:shadow-[0_0_0_3.5px_rgba(99,102,241,0.12)]`. `focus:ring-2` idiom 금지. 사이드바 검색만 `rounded-xl` 허용.
- **리스트 검색 = 단일 컴포넌트 `ListSearch`(`components/competitors/shared.tsx`)**. 뉴스 검색과 폭·스타일 단일 소스 — 기본 **245px**, 포커스·입력 시 **319px**로 `.42s cubic-bezier(.22,1,.36,1)` 확장. 아이콘 15·글자 13px·`pl-9 pr-8`·클리어버튼 `h-5 w-5`·focus 그림자 `3.5px`. **뷰마다 폭(`w-[…px]`)을 다르게 주지 말 것** — 경쟁사 board·movers·positioning·원자료 테이블·competitors 페이지가 모두 이 컴포넌트 사용. 예외: DealsView 히어로 검색(구글식 중앙 대형, 활성 시 컴팩트)만 자체 폭.
- 차트 툴팁: `rounded-lg border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 shadow-lg`.

## 13. 빈 상태 · 스켈레톤

- 빈상태 박스: `rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-12 text-center text-[12px] text-gray-400 dark:text-gray-500`.
- 스켈레톤: `animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900`(카드·차트 공통).

## 14. 레이아웃

- 페이지 컨테이너: `w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10`.
- 사이드바 그리드: `grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-7` · aside `lg:sticky lg:top-[61px] lg:border-r lg:pr-6`.
- 상단 nav: 검색창 없음. nav 항목은 텍스트 색 hover만.

## 15. 차트

- 라인 차트(viewBox 300×100, 3:1)는 풀와이드에서 세로 과대 → 래퍼 `mx-auto w-full max-w-[900px]`로 폭 캡(SVG가 박스를 정확히 채워 툴팁 좌표 유지). EconChart·FxView·DailyIndicators·ProChartCore·GdpComposition 적용.

## 16. 뉴스 카테고리 (topic + 키워드 세분)

- 데이터 `v_news_feed.topic`은 6종(거시·금융·B2B·정치·정책·에너지·전력·CE·유통·기상·재난) + 규제(regBoard)·인사이트(analysisPosts/reports).
- 메뉴는 `{ key, label, topic, kw? }`. `menuMatch(x, mi)` = topic 일치 + (kw 있으면) 제목·요약·시사점 키워드 포함.
- 큰 덩어리는 kw로 세분: 거시·금융→물가/금리/환율/성장, 에너지→유가/전력, B2B→공조/인프라. 미매칭 문서는 "전체"에 노출.

## 17. 배포

- `git push` = Cloudflare Pages 배포. 웹훅 누락 시 빈 커밋 재트리거.
- 검증: 배포 URL(`axlgeph.report`) 번들을 grep해 신규 문자열 확인.

---

## 미완료 (구조 리팩터 후속)

- `<EmptyState>`·`<SearchInput>`·`<BannerShell>` 공통 컴포넌트 추출(현재 복붙 통일 상태).
- 배지 ~50곳 → `Badge.tsx` 컴포넌트 이관, SEV 외 카테고리 배지도 단일화.
- 폰트 크기: `zoom:1.18` 하 `.5px` 튜닝은 의도적 → 대량 정수화는 보류.
