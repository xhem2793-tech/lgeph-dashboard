# axlgeph.report — 디자인 교과서 (Design System)

> 한번 정한 패턴은 이 문서와 `src/components`의 공용 컴포넌트로만 관리한다.
> 새 페이지·차트·위젯을 만들 때 규칙을 다시 만들지 말고 여기서 **가져다 쓴다.**
> 규칙을 바꾸려면 이 문서 + 공용 컴포넌트를 바꾸면 전 페이지에 자동 반영된다.

핵심 철학 — **사용자 경험(UX)이 1순위.** 모든 전환은 대시보드처럼 부드럽게.

---

## 1. 색 팔레트 (Color)

| 용도 | 토큰 | 값 |
|---|---|---|
| 주 강조(Primary) | `indigo-600` | 토글 활성, 링크 hover, 포커스 |
| 텍스트 기본 | `gray-900` | 제목·본문 |
| 텍스트 보조 | `gray-500` | 메타·캡션 |
| 카드 배경 | `white` + `border-gray-200` + `shadow-sm` | 모든 카드 |
| 페이지 배경 | `gray-50` | |
| 상승/악화 | `rose-600` | 수치 증가(부담↑) |
| 하락/개선 | `emerald-600` | 수치 감소 |

### 카테고리 색 (캘린더·태그 공통)

| 분류 | bg | fg | dot |
|---|---|---|---|
| 경제 | emerald-50 | emerald-800 | emerald-500 |
| 금융 | blue-50 | blue-800 | blue-500 |
| 정치 | purple-50 | purple-800 | purple-500 |
| 규제 | red-50 | red-800 | red-500 |
| 에너지 | amber-50 | amber-800 | amber-500 |
| 유통 | violet-50 | violet-800 | violet-500 |
| 공휴일 | teal-50 | teal-800 | teal-500 |

규제만 빨강 계열 단독 — 정치(purple)·공휴일(teal)과 색이 겹치지 않게 확정.

---

## 2. 모션 (Motion) — 대시보드 표준

전환 곡선은 **`cubic-bezier(.22,1,.36,1)`** 하나로 통일(감속형, "스르륵").

```css
@keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes viewIn  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:none} }
@keyframes rowIn   { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:none} }
@keyframes backIn  { from{opacity:0} to{opacity:1} }
@keyframes backOut { from{opacity:1} to{opacity:0} }
@keyframes modalIn { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:none} }
@keyframes modalOut{ from{opacity:1;transform:none} to{opacity:0;transform:translateY(8px) scale(.98)} }
```

| 상황 | 애니메이션 |
|---|---|
| 카드 진입 | `fadeUp .5s ease both` (+ 카드별 `animationDelay` 80·140ms 스태거) |
| 뷰 전환(탭·필터) | `viewIn .4s cubic-bezier(.22,1,.36,1) both` — 컨테이너에 `key` 부여해 재생 |
| 리스트 행 | `rowIn .4s …` + `animationDelay: min(i,14)*22ms` (계단식) |
| 모달 열기 | 백드롭 `backIn .22s`, 본체 `modalIn .34s cubic-bezier(.22,1,.36,1)` |
| 모달 닫기 | `closing` state → `backOut/modalOut .22s` → 230ms 후 unmount |
| hover | `-translate-y-px` (또는 `-translate-y-0.5`) + indigo 전환, `duration-300` |
| active | `active:scale-95` (버튼) / `active:scale-[.99]` (넓은 행) |

**끊김 방지 규칙** — 스태거 지연은 22~60ms, 총 진입은 .4~.5s를 넘기지 않는다. `key`로 재마운트해야 필터 전환 시 애니메이션이 재생된다.

---

## 3. 공용 컴포넌트 (Shared Components)

### `Segmented` — 배타적 토글 (알약 A안, 슬라이딩)

2~3구간 배타 선택(최신순/영향도순, 지남/예정, 일간, 제품별 등)은 **전부 이걸 쓴다.**
인디고 알약 하이라이트가 `cubic-bezier(.22,1,.36,1)`로 이동, 글자색 부드럽게 전환.

```tsx
import { Segmented } from "@/components/Segmented"

<Segmented
  value={sort}
  onChange={setSort}
  options={[{ k: "latest", label: "최신순" }, { k: "impact", label: "영향도순" }]}
  size="md"   // "sm" | "md"
/>
```

- 절대배치 `<span>` 썸을 활성 버튼 ref의 `offsetWidth/offsetLeft`로 `useLayoutEffect` 측정.
- ⚠️ 로컬에 SlideToggle을 다시 만들지 말 것. 반드시 import.

### 모달 (news-style)

`backdrop-blur` 백드롭 + `rounded-2xl bg-white shadow-2xl` 본체 + 색 밴드 헤더 + X 버튼 + `closing` state 페어드 애니메이션. 캘린더·뉴스 동일 구조.

---

## 4. 카드 / 테이블 / 페이지 규칙

**카드** — `rounded-xl border border-gray-200 bg-white p-4 shadow-sm`, 헤더는 `border-b border-gray-100 pb-2.5`, 제목 `text-[17px] font-bold tracking-tight text-gray-900`.

**테이블** — 헤더 `text-[11px] font-semibold text-gray-500 border-b`, 데이터 셀은 높이 통일 위해 `h-[44px] px-2 align-middle`, 숫자는 `tabular-nums`, 행 hover `hover:bg-indigo-50/50`. **시간 컬럼엔 시간만**(출처·기관 금지 — 출처는 별도 컬럼/모달).

**페이지 쉘** — `mx-auto max-w-[1536px] px-4 pt-6 sm:px-6 sm:pt-8`, 우측 레일 위젯 폭 `286px` (`lg:grid-cols-[minmax(0,1fr)_286px]`) — 대시보드·주요뉴스와 동일.

---

## 5. 문체 (Copy) — CLAUDE.md 준수

- 개조식 명사 종결. ~이다/~한다/~됨/~임 금지. 마침표 금지.
- KPI 비교값 `x.x%↑ / x.x%↓` (▲▼ 금지).
- 수치엔 Confidence 태그(CONFIRMED/ESTIMATED/AI INTERPRETED/VALIDATION REQ).
- 미확인 수치·URL·날짜 생성 금지 → `—` 또는 "확인 후 기입".
- So What(가전 영업 함의) 필수.

---

## 6. 새 페이지 만들 때 체크리스트

1. 페이지 쉘(§4) + `@keyframes`(§2) 블록 삽입
2. 카드는 `fadeUp` 스태거 진입
3. 토글 필요하면 `Segmented` import (새로 만들지 말 것)
4. 모달 필요하면 news-style 패턴 복제(§3)
5. 테이블 셀 높이·시간 컬럼 규칙(§4) 확인
6. 색은 §1 팔레트/카테고리 맵에서만
7. 문체·Confidence(§5) 확인
