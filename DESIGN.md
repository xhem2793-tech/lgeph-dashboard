# axlgeph.report — 디자인 교과서 (Design System)

> 한번 정한 패턴은 이 문서와 `src/components`의 공용 컴포넌트로만 관리한다.
> 새 페이지·차트·위젯을 만들 때 규칙을 다시 만들지 말고 여기서 **가져다 쓴다.**
> 규칙을 바꾸려면 이 문서 + 공용 컴포넌트를 바꾸면 전 페이지에 자동 반영된다.

핵심 철학 — **사용자 경험(UX)이 1순위.** 모든 전환은 대시보드처럼 부드럽게.
기준 페이지 = **주요 뉴스 · 캘린더** — 두 페이지의 모션·모달·검색·목록이 전체 표준. 새 페이지는 이 둘을 복제한다.

---

## 1. 색 팔레트 (Color)

| 용도 | 토큰 | 값 |
|---|---|---|
| 주 강조(Primary) | `indigo-600` | 토글 활성, 링크 hover, 포커스 |
| 텍스트 기본 | `gray-900` | 제목·본문 |
| 텍스트 보조 | `gray-500` | 메타·캡션 |
| 캡션 라벨 | `gray-400` | 모달 소제목(시사점/본문 요약/대응) |
| 카드 배경 | `white` + `border-gray-200` + `shadow-sm` | 모든 카드 |
| 페이지 배경 | `gray-50` | |
| 상승/악화 | `rose-600` | 수치 증가(부담↑) |
| 하락/개선 | `emerald-600` | 수치 감소 |

### 카테고리 색 (캘린더·태그·모달 공통)

| 분류 | dot / 색 바 |
|---|---|
| 경제 | emerald-500 |
| 금융 | blue-500 |
| 정치 | purple-500 |
| 규제(표시=정책) | red-500 |
| 에너지 | amber-500 |
| 유통 | violet-500 |
| 공휴일 | teal-500 |

**색=신호 원칙** — 채운 배지·틴트 카드 금지. 카테고리는 **dot(점) 또는 얇은 색 바**로만 표현. 한 화면 강조색은 indigo 1개 + 카테고리 dot로 제한.
규제만 빨강 단독 — 정치(purple)·공휴일(teal)과 겹치지 않게 확정.

---

## 2. 모션 (Motion) — 대시보드 표준  ★ 2026-07-16 라이브(주요뉴스·캘린더) 기준으로 갱신

진입·리스트·뷰전환·모달 **감속 곡선은 `cubic-bezier(.16,1,.3,1)`** 하나로 통일(ease-out expo, "위→아래로 스르륵").
`Segmented` 알약 슬라이드만 내부적으로 `cubic-bezier(.22,1,.36,1)`(사실상 동일 계열).

```css
@keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes viewIn  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:none} }
@keyframes rowIn   { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:none} }
@keyframes calIn   { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
@keyframes backIn  { from{opacity:0} to{opacity:1} }
@keyframes backOut { from{opacity:1} to{opacity:0} }
@keyframes modalIn { from{opacity:0;transform:translateY(12px) scale(.96)} to{opacity:1;transform:none} }
@keyframes modalOut{ from{opacity:1;transform:none} to{opacity:0;transform:translateY(8px) scale(.98)} }
```

| 상황 | 애니메이션 (라이브 값) |
|---|---|
| 섹션/카드 진입 | `fadeUp .5s ease both` + `animationDelay` 0.05·0.1·0.15s 스태거 |
| 뷰 전환(탭·필터·달) | `viewIn .42s cubic-bezier(.16,1,.3,1) both` — 컨테이너에 `key={mode+menu+...}` 부여해 재생 |
| 리스트 행(표·목록) | `rowIn .5s cubic-bezier(.16,1,.3,1) backwards` + `animationDelay: Math.min(i,10)*0.035s` |
| 사이드 위젯 행(예정 일정 등) | `rowIn`/`calIn` + `animationDelay: Math.min(i,10)*0.04s` (사이드바 `i*0.08s`) |
| 모달 열기 | 백드롭 `backIn .22s` + 본체 `modalIn .34s cubic-bezier(.16,1,.3,1)` |
| 모달 닫기 | `closing` state → `backOut`/`modalOut .22s` → ~230ms 후 unmount |
| hover | `-translate-y-px` + indigo 전환, `duration-200`~`300` |
| active | `active:scale-95`(버튼) / `active:scale-[.99]`(넓은 행) |

**끊김 방지 규칙(중요)**
1. 스태거는 `Math.min(i,10)*0.035s`처럼 **상한을 걸어** 총 진입이 .4~.5s를 넘지 않게. 과거 `120+i*60ms`는 너무 느려 "뚝뚝"댔음.
2. 필터 전환 시 애니메이션을 재생하려면 컨테이너를 `key`로 **리마운트**.
3. 단, 같은 리스트가 토글마다 "움직이면" 안 되는 경우(2주/한달처럼 목록 불변)엔 스태거를 빼고 즉시 교체. 자세히 [[calendar_design_confirmed]].

---

## 3. 공용 컴포넌트 (Shared Components)

### `Segmented` — 배타적 토글 (알약, 슬라이딩)

2~3구간 배타 선택(최신순/영향도순, 지남/예정, 2주/한달, 주제별/부서별 등)은 **전부 이걸 쓴다.**
인디고 알약 하이라이트가 `cubic-bezier(.22,1,.36,1)`로 이동, 글자색 부드럽게 전환.

```tsx
import { Segmented } from "@/components/Segmented"

<Segmented value={sort} onChange={setSort}
  options={[{ k: "latest", label: "최신순" }, { k: "impact", label: "영향도순" }]}
  size="md" />   // "sm" | "md"
```

- 절대배치 `<span>` 썸을 활성 버튼 ref의 `offsetWidth/offsetLeft`로 `useLayoutEffect` 측정.
- ⚠️ 로컬에 SlideToggle을 다시 만들지 말 것. 반드시 import.
- 배치: 페이지 상단 토글은 헤더가 아니라 **필터 pill 행**에 둔다(캘린더 확정).

### 모달 — 3안 컴팩트 (2026-07-16 확정, 캘린더·뉴스 공통)

과거 "색 밴드 헤더" 폐기. 확정 구조:
- 본체 `relative overflow-hidden rounded-2xl bg-white shadow-2xl max-w-[600px]`, 백드롭 `backdrop-blur`.
- **좌측 카테고리 색 바** — `absolute inset-y-0 left-0 z-10 w-1` + 카테고리 색(뉴스는 토픽 substring 매핑, 캘린더는 `tone(c)`). `overflow-hidden rounded-2xl`로 바 클립. 틴트 카드·채운 배경 금지.
- 헤더 = `분류 · 성격 · ★중요도`. 별은 inline `text-[12px] text-amber-500`, **`ml-auto` 금지**(닫기 X와 겹침). 제목 `text-[20px] font-semibold`(가벼운 굵기). 메타는 회색 `출처 · 날짜`.
- **두괄식** — `시사점`(결론)을 `본문 요약` 위에 먼저. 시사점 블록 `border-l-2 border-indigo-300 pl-3`.
- **라벨 통일** — `시사점` / `본문 요약` / `대응 · Owner` 캡션(`text-[11px] text-gray-400`). SO WHAT / 우리 영향 / ACTION 등 영문·혼용 금지.
- 지표 연동 시 얇은 pill로 예측·실제·이전.
- 뉴스 모달은 상단 썸네일 유지, 나머지 구조 동일.
- 열고 닫기 `closing` state 페어드 애니메이션(§2).

---

## 4. 카드 / 테이블 / 검색 / 레이아웃

**카드** — `rounded-xl border border-gray-200 bg-white p-4 shadow-sm`, 헤더 `border-b border-gray-100 pb-2.5`, 제목 `text-[17px] font-bold tracking-tight text-gray-900`.

**테이블** — 헤더 `text-[11px] font-semibold text-gray-500 border-b`, 셀은 **자동높이(`py-*`) + `align-middle`**(다줄 겹침 방지 위해 고정높이 `h-[44px]`는 다줄 셀에 쓰지 말 것), 숫자 `tabular-nums`, 행 hover `hover:bg-indigo-50/50`. 시간 컬럼엔 시간만(출처·기관은 별도 컬럼/모달).

**월별 그룹핑** — 긴 목록은 `이번 주 / 7월 / 8월`처럼 월 기준 그룹 헤더. 지난 항목도 월별. `groupOf(r)` 헬퍼 + `showHead = i===0 || groupOf(prev)!==groupOf(cur)`.

**헤더 검색(확장형, 주요뉴스·캘린더 표준)** — 헤더 정중앙 `absolute left-1/2 -translate-x-1/2`. 포커스/입력 시 폭 `320px → 416px` 확장(`transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]`), 슬림 input `py-1`, 포커스 링 `focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]`, 아이콘 `group-focus-within:text-indigo-600`, 입력 있으면 clear `X`. 모든 페이지 동일.

**페이지 쉘** — `mx-auto max-w-[1536px] px-4 pt-6 sm:px-6 sm:pt-8`, 우측 레일 위젯 폭 `286px`(`lg:grid-cols-[minmax(0,1fr)_286px]`).

**그리드 빈공간 방지(중요)** — CSS grid 행 높이는 가장 큰 열 기준. 짧은 열(예: 2주 캘린더 카드) 밑에 빈 공간이 남으면, 그 열을 `flex flex-col gap-4` 래퍼로 감싸 **다음 카드(이벤트 목록 등)를 같은 열에 쌓아** 채운다. `items-start`는 늘어남만 막을 뿐 빈 공간은 안 없앰.

---

## 5. 문체 (Copy) — CLAUDE.md 준수

- 개조식 명사 종결. ~이다/~한다/~됨/~임 금지. 마침표 금지.
- KPI 비교값 `x.x%↑ / x.x%↓` (▲▼ 금지).
- 수치엔 Confidence 태그(CONFIRMED/ESTIMATED/AI INTERPRETED/VALIDATION REQ).
- 미확인 수치·URL·날짜 생성 금지 → `—` 또는 "확인 후 기입".
- So What(가전 영업 함의) 필수.

---

## 6. 새 페이지 만들 때 체크리스트 (이대로 하면 디폴트로 "우리 UX"가 나옴)

1. 페이지 쉘(§4) + `@keyframes` 8종(§2) 블록 삽입
2. 섹션·카드 `fadeUp` 스태거(0.05/0.1/0.15s) 진입
3. 뷰전환 컨테이너 `key` + `viewIn .42s`, 리스트 행 `rowIn .5s` + `Math.min(i,10)*0.035s`
4. 토글은 `Segmented` import(새로 만들지 말 것) — 필터 pill 행에 배치
5. 모달은 §3 3안 구조(좌측 색 바 · 두괄식 · 시사점/본문 요약/대응)
6. 검색은 §4 확장형(320→416) 패턴
7. 테이블 자동높이 · 시간컬럼 · 월별 그룹(§4)
8. 색은 §1 팔레트/카테고리 맵에서만(색=신호는 dot·얇은 바)
9. 문체·Confidence·So What(§5)
10. 배포 후 commits ✓ 및 라이브 육안 확인
