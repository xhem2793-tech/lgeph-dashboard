"use client"

import React from "react"
import {
  newsFeed,
  indicatorChips,
  regBoard,
  analysisPosts,
  publishedReports,
  pageBanner,
  freshness,
  fmtStamp,
  type FeedItem,
  type Chip,
  type RegBoardItem,
  type PubReport,
} from "@/lib/supabase"
import { useLang, T } from "@/lib/i18n"
import { SEV } from "@/lib/severity"
import { Segmented } from "@/components/Segmented"
import { InsightBanner, type Banner } from "@/components/InsightBanner"

/** 배너 폴백 — 매니페스트 로드 실패 시 표시(주간 자동 갱신 대상) */
const NEWS_BANNER: Banner = {
  title: "유가·환율 리스크 부각",
  summary: "디젤 10.68페소 인상(중동發), 6월 국제수지 흑자 34억달러로 대외 완충 개선",
  body: "중동발 유가 쇼크로 **디젤 리터당 10.68페소** 인상(3일 분산)돼 물류비·실질구매력 부담 확대. 한편 **6월 국제수지 흑자 34억달러**(2년래 최대)로 대외 완충은 개선됐으나, BSP는 연말 BoP 적자 확대를 전망해 하반기 환율 변동성 여지.",
  insight: "연료비 전가에 따른 대형가전 구매 지연·가격민감도, 페소 표시 수입원가·부품 조달비 영향 주시 권고.",
  insightLabel: "LG 관점",
  period: "2026-W31",
}

/** 주요뉴스 — 좌 메뉴 / 피드 / 규제 상시.
 *
 *  ■ 세 종류를 한 그릇에
 *   뉴스 · 규제·정책 · 인사이트는 성격이 다르지만 읽는 방식은 같다 —
 *   리스트에서 고르고, 팝업에서 결론(SO WHAT)부터 읽는다. 그래서 카드·모달을 하나로 통일했다.
 *
 *  ■ 리스트의 역할은 "열 것을 고르는 것"
 *   행은 제목 · SO WHAT 한 줄 · 메타 한 줄까지만. 본문은 모달에서.
 *
 *  ■ 색은 신호가 있을 때만 — 지표칩은 행당 1개, ±1% 이상일 때만 색.
 */

type Kind = "news" | "reg" | "insight"

/** 리스트·모달이 함께 쓰는 표준형 — 셋을 한 모양으로 만든다 */
type Doc = {
  id: string
  kind: Kind
  topic: string
  product: string
  title: string
  summary: string
  so: string
  source: string
  date: string
  url: string | null
  image: string | null
  chipKeys: string[]
  action?: string | null
  severity?: string | null
  dDay?: number | null
  agency?: string | null
}

/** 메뉴 = 표시 카테고리. topic(기본 6종/규제/인사이트)로 1차 필터, kw(키워드)로 세분.
 *  데이터 topic은 6종뿐이라 큰 덩어리(거시·금융·B2B·에너지)는 제목·요약·시사점 키워드로 쪼갠다. */
type Menu = { key: string; label: string; topic: string; kw?: string[]; group?: string }

const MENUS: Menu[] = [
  { key: "전체", label: "전체 동향", topic: "전체" },

  { key: "인사이트", label: "인사이트·칼럼", topic: "인사이트", group: "인사이트 칼럼" },

  // 거시·금융 → 4분할
  { key: "물가·인플레", label: "물가·인플레이션", topic: "거시·금융", group: "거시·금융", kw: ["물가", "인플레", "cpi", "소비자물가", "생활비", "가격"] },
  { key: "금리·통화", label: "금리·통화정책", topic: "거시·금융", group: "거시·금융", kw: ["금리", "기준금리", "bsp", "통화", "유동성", "대출", "신용", "m3"] },
  { key: "환율·외환", label: "환율·외환·송금", topic: "거시·금융", group: "거시·금융", kw: ["환율", "페소", "외환", "달러", "송금", "ofw", "fdi", "외국인투자", "외국인 투자"] },
  { key: "성장·무역", label: "성장·무역·고용", topic: "거시·금융", group: "거시·금융", kw: ["gdp", "성장", "무역", "수출", "수입", "고용", "실업", "임금", "투자", "경상", "gni"] },

  // 에너지·전력 → 2분할
  { key: "유가·연료", label: "유가·연료", topic: "에너지·전력", group: "에너지·전력", kw: ["유가", "석유", "디젤", "휘발유", "경유", "연료", "가스", "brent", "wti", "유류"] },
  { key: "전력·요금", label: "전기요금·전력", topic: "에너지·전력", group: "에너지·전력", kw: ["전기", "전력", "요금", "meralco", "전력망", "정전", "재생에너지", "태양광", "송전", "발전"] },

  { key: "정치·정책", label: "정치·행정·정세", topic: "정치·정책", group: "정책·규제" },
  { key: "규제·정책", label: "규제·통관·관세", topic: "규제·정책", group: "정책·규제" },

  // 산업·유통(B2B + 가전유통)
  { key: "B2B·공조", label: "B2B·공조·HVAC", topic: "B2B", group: "산업·유통", kw: ["공조", "hvac", "냉방", "칠러", "vrf", "히트펌프", "에어컨", "냉난방", "시스템에어컨"] },
  { key: "B2B·인프라", label: "데이터센터·인프라", topic: "B2B", group: "산업·유통", kw: ["데이터센터", "data center", "인프라", "건설", "프로젝트", "발주", "설비", "reit", "부동산", "오피스", "물류"] },
  { key: "CE·유통", label: "가전·유통·경쟁", topic: "CE·유통", group: "산업·유통" },

  { key: "기상·재난", label: "기상·재난·냉방수요", topic: "기상·재난", group: "환경·리스크" },
]

/** 인사이트 전용 분류 — 뉴스 topic과 별개(AI·정책·시장전망·기술). 제목·요약·시사점 키워드로 분류. */
const INSIGHT_CATS = ["AI", "정책", "시장전망", "기술"] as const
function insightCatOf(d: Doc): string {
  const s = (d.title + " " + d.summary + " " + d.so).toLowerCase()
  if (/\bai\b|인공지능|생성형|반도체|칩|chip|데이터센터|data center|llm|자동화|로봇|머신러닝|딥러닝/.test(s)) return "AI"
  if (/정책|규제|정부|의회|대통령|법안|관세|통상|보조금|dti|doe|bcda|dbcc|sona|재정|예산|통화정책/.test(s)) return "정책"
  if (/기술|인버터|에너지효율|스마트|iot|친환경|소재|공정|특허|r&d|차세대|혁신/.test(s)) return "기술"
  return "시장전망"
}

/** 문서가 메뉴에 속하는지 — topic 일치 + (kw 있으면) 제목·요약·시사점에 키워드 포함 */
function menuMatch(x: Doc, mi: Menu): boolean {
  if (mi.topic !== "전체" && x.topic !== mi.topic) return false
  if (mi.kw && mi.kw.length) {
    const hay = (x.title + " " + x.summary + " " + x.so).toLowerCase()
    return mi.kw.some((k) => hay.includes(k))
  }
  return true
}

const W: Record<string, number> = {
  "거시·금융": 1.0,
  "에너지·전력": 1.0,
  "CE·유통": 0.95,
  B2B: 0.9,
  "정치·정책": 0.85,
  "기상·재난": 0.8,
  "규제·정책": 1.1,
  인사이트: 0.9,
}

/** 제품별 보기 — PD 조직 그대로. 각 제품군에 걸리는 지표를 함께 묶는다 */
const PRODUCTS: { group: string; items: { key: string; chips: string[] }[] }[] = [
  {
    group: "CE — 생활가전",
    items: [
      { key: "에어컨·RAC", chips: ["electricity", "heat_index", "cpi"] },
      { key: "냉장고", chips: ["electricity", "cpi", "fx"] },
      { key: "세탁기·건조기", chips: ["electricity", "cpi"] },
      { key: "TV·오디오", chips: ["cpi", "fx", "policy_rate"] },
      { key: "에어케어·정수기", chips: ["heat_index", "cpi"] },
    ],
  },
  {
    group: "B2B — 공조·솔루션",
    items: [
      { key: "칠러·데이터센터", chips: ["electricity", "policy_rate"] },
      { key: "SAC·VRF", chips: ["policy_rate", "electricity"] },
      { key: "사이니지·상업용TV", chips: ["policy_rate", "fx"] },
    ],
  },
  {
    group: "공통",
    items: [{ key: "전 제품 영향", chips: ["fx", "cpi", "diesel"] }],
  },
]


/** 제품 키워드 검색 — 제품군을 유의어로 확장해 본문에서 OR 매칭.
 *  뉴스 원문은 제품 필드가 비어있는 경우가 많아, 제목·요약·시사점 텍스트를 유의어로 훑는다. */
const PROD_KW: { key: string; label: string; syn: string[] }[] = [
  { key: "ac", label: "에어컨", syn: ["에어컨", "RAC", "냉방", "인버터", "aircon", "air con"] },
  { key: "ref", label: "냉장고", syn: ["냉장고", "김치냉장고", "냉동", "refriger"] },
  { key: "wash", label: "세탁·건조", syn: ["세탁기", "세탁", "건조기", "워시타워", "washer", "dryer"] },
  { key: "tv", label: "TV·AV", syn: ["TV", "티비", "올레드", "OLED", "QLED", "사운드바", "디스플레이"] },
  { key: "air", label: "에어케어", syn: ["공기청정", "에어케어", "정수기", "제습", "가습", "청정기"] },
  { key: "b2b", label: "공조·B2B", syn: ["칠러", "VRF", "시스템에어컨", "데이터센터", "공조", "히트펌프", "상업용"] },
]

// ── EN 표시 라벨 맵(키·필터값은 한글 로직 유지, '표시'만 번역). 함수라 렌더 시점 평가 → 토글 즉시 반영. ──
const MENU_EN: Record<string, string> = {
  "전체 동향": "All Trends", "인사이트·칼럼": "Insights & Columns",
  "물가·인플레이션": "Prices & Inflation", "금리·통화정책": "Rates & Monetary Policy", "환율·외환·송금": "FX & Remittances", "성장·무역·고용": "Growth, Trade & Jobs",
  "유가·연료": "Fuel & Oil", "전기요금·전력": "Electricity & Power",
  "정치·행정·정세": "Politics & Governance", "규제·통관·관세": "Regulation & Customs",
  "B2B·공조·HVAC": "B2B HVAC", "데이터센터·인프라": "Data Center & Infra", "가전·유통·경쟁": "Appliance Retail & Competition",
  "기상·재난·냉방수요": "Weather, Disaster & Cooling",
}
const GROUP_EN: Record<string, string> = {
  "인사이트 칼럼": "Insight Columns", "거시·금융": "Macro & Finance", "에너지·전력": "Energy & Power",
  "정책·규제": "Policy & Regulation", "산업·유통": "Industry & Retail", "환경·리스크": "Environment & Risk",
}
const PRODKW_EN: Record<string, string> = { "전 제품": "All", "에어컨": "RAC", "냉장고": "REF", "세탁·건조": "Laundry", "TV·AV": "TV·AV", "에어케어": "Air Care", "공조·B2B": "HVAC B2B" }
const TOPIC_EN: Record<string, string> = { "전체": "All", "거시·금융": "Macro & Finance", "에너지·전력": "Energy & Power", "CE·유통": "Appliance Retail", "B2B": "B2B", "정치·정책": "Politics", "규제·정책": "Regulation", "기상·재난": "Weather & Disaster", "인사이트": "Insight" }
const INSIGHT_EN: Record<string, string> = { "전체": "All", "AI": "AI", "정책": "Policy", "시장전망": "Outlook", "기술": "Tech" }
const menuLabel = (l: string) => T(l, MENU_EN[l] ?? l)
const groupLabelN = (g: string) => T(g, GROUP_EN[g] ?? g)
const prodChipLabel = (l: string) => T(l, PRODKW_EN[l] ?? l)
const topicLabelN = (t: string) => T(t, TOPIC_EN[t] ?? t)
const insightLabelN = (c: string) => T(c, INSIGHT_EN[c] ?? c)

const PAGE = 20

function ageDays(s: string) {
  const d = new Date(s + "T00:00:00+08:00").getTime()
  const n = new Date()
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  return Math.max(0, Math.round((t - d) / 86400000))
}

function rel(s: string) {
  const a = ageDays(s)
  if (a <= 0) return T("오늘", "Today")
  if (a === 1) return T("어제", "Yesterday")
  if (a < 7) return a + T("일 전", "d ago")
  return s.slice(5).replace("-", "/")
}


/** 이번 주 남은 일수(오늘 포함 X) · 주간 진행률 · 가장 급한 시행 D-day */
/** 규제의 시행일 — dDay 로부터 역산(뷰가 effective_date 로 dDay 를 만든다) */







/** 우리가 만든 것(가격 트래커·자체 칼럼)에는 표식을 붙인다 — 남의 보도와 섞이면 안 된다 */
const OURS = "LGEPH AI"

function AiMark() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-1 py-px text-[9px] font-bold leading-4 text-indigo-700 dark:text-indigo-300">
      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1l1.3 3.2L10.5 5.5 7.3 6.8 6 10 4.7 6.8 1.5 5.5l3.2-1.3L6 1z" fill="currentColor" />
      </svg>
      AI
    </span>
  )
}

/** 지표칩 — 기준 시점을 반드시 붙인다(월간 지표는 'N월').
 *  6월 CPI를 5월 값으로 보여주던 사고가 여기서 났다: 값만 있고 기준이 없으면 아무도 못 잡는다.
 *  변동은 물가·금리처럼 값 자체가 %인 지표는 %p 절대차, 나머지는 상대변화율 %. */
function chipStamp(c: Chip) {
  if (!c.asOf) return ""
  if (c.freq === "monthly") return Number(c.asOf.slice(5, 7)) + "월"
  return Number(c.asOf.slice(5, 7)) + "/" + Number(c.asOf.slice(8, 10))
}

function ChipPill({ c }: { c: Chip }) {
  const dv = c.deltaPct ?? 0
  const pp = c.deltaUnit === "%p"
  const strong = pp ? Math.abs(dv) >= 0.2 : Math.abs(dv) >= 1
  const up = dv > 0
  return (
    <a
      href={"/economy?k=" + c.k}
      onClick={(e) => e.stopPropagation()}
      title={c.label + " · " + chipStamp(c) + T(" 기준", " as of")}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-800 px-1.5 py-px text-[10px] leading-4 text-gray-600 dark:text-gray-300 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95"
    >
      <span>{c.label}</span>
      <span className="num font-semibold text-gray-800 dark:text-gray-100">
        {c.unit === "₱" ? "₱" : ""}
        {c.value ?? "—"}
        {c.unit && c.unit !== "₱" ? c.unit : ""}
      </span>
      {dv ? (
        <span className={"num font-semibold " + (strong ? (up ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400") : "text-gray-400 dark:text-gray-500")}>
          {Math.abs(dv).toFixed(1)}
          {c.deltaUnit}
          {up ? "↑" : "↓"}
        </span>
      ) : null}
      <span className="num text-gray-400 dark:text-gray-500">{chipStamp(c)}</span>
    </a>
  )
}

function lead(d: Doc, chips: Record<string, Chip>): Chip | null {
  const arr = d.chipKeys.map((k) => chips[k]).filter(Boolean)
  if (!arr.length) return null
  return [...arr].sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))[0]
}

/** 사진이 없으면 지어내지 않는다 — 우리 데이터로 만든 자체 비주얼.
 *  구성: 상단 액센트 바 · 토픽 라벨 · 큰 수치(지표값 또는 시행 D-day) · 워터마크 글리프 · 출처/날짜.
 *  사진 자리를 "채우는 그림"이 아니라 "읽히는 정보"가 되게 만든다. */
const ART: Record<string, { tint: string; accent: string; tag: string; glyph: React.ReactNode }> = {
  "거시·금융": {
    tint: "#f5f6ff",
    accent: "#2563eb",
    tag: "MACRO",
    glyph: (
      <path d="M4 44 L18 30 L28 38 L44 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  "정치·정책": {
    tint: "#f6f8fa",
    accent: "#9333ea",
    tag: "POLICY",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        <path d="M12 8h20l8 8v32H12z" />
        <path d="M18 24h16M18 32h16M18 40h10" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  B2B: {
    tint: "#f2f8ff",
    accent: "#0284c7",
    tag: "B2B",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        <path d="M8 48V16h16v32M24 48V24h20v24" />
        <path d="M14 24h4M14 32h4M14 40h4M30 32h8M30 40h8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  "CE·유통": {
    tint: "#f8f6ff",
    accent: "#7c3aed",
    tag: "RETAIL",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        <path d="M10 18h32l-3 30H13z" />
        <path d="M20 18v-4a6 6 0 0 1 12 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  "기상·재난": {
    tint: "#f1fdfa",
    accent: "#0d9488",
    tag: "WEATHER",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 22c6-8 14-8 20 0s14 8 20 0" />
        <path d="M6 34c6-8 14-8 20 0s14 8 20 0" />
        <path d="M6 46c6-8 14-8 20 0s14 8 20 0" />
      </g>
    ),
  },
  "에너지·전력": {
    tint: "#fffaf0",
    accent: "#d97706",
    tag: "ENERGY",
    glyph: (
      <path d="M28 6 L14 32h12l-4 20 20-28H30l4-18z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    ),
  },
  "규제·정책": {
    tint: "#fff6f6",
    accent: "#dc2626",
    tag: "REGULATION",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        <circle cx="26" cy="26" r="16" />
        <path d="M26 16v11l7 5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  인사이트: {
    tint: "#f5f6ff",
    accent: "#4f46e5",
    tag: "INSIGHT",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        <path d="M26 6a16 16 0 0 1 10 28v6H16v-6A16 16 0 0 1 26 6z" />
        <path d="M18 48h16" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
}

function DocArt({ d, chip, big }: { d: Doc; chip: Chip | null; big?: boolean }) {
  const a = ART[d.topic] ?? ART["거시·금융"]

  /** 큰 수치 — 규제는 시행 D-day, 뉴스는 대표 지표. 둘 다 없으면 날짜 */
  let big1 = ""
  let sub = ""
  if (d.kind === "reg") {
    big1 = d.dDay == null ? "—" : d.dDay <= 0 ? T("시행 중", "In effect") : "D-" + d.dDay
    sub = d.agency ?? ""
  } else if (chip) {
    big1 = (chip.unit === "₱" ? "₱" : "") + (chip.value ?? "—") + (chip.unit && chip.unit !== "₱" ? chip.unit : "")
    sub =
      chip.label +
      (chip.deltaPct ? " " + (chip.deltaPct > 0 ? "▲" : "▼") + Math.abs(chip.deltaPct).toFixed(1) + chip.deltaUnit : "") +
      (chip.asOf ? " · " + (chip.freq === "monthly" ? Number(chip.asOf.slice(5, 7)) + "월" : chip.asOf.slice(5).replace("-", "/")) : "")
  } else {
    big1 = d.date.slice(5).replace("-", "/")
    sub = d.topic
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
      {/* 상단 액센트 바 */}
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: a.accent }} />

      {/* 워터마크 글리프 — 정보가 아니라 결, 아주 옅게 */}
      <svg
        viewBox="0 0 52 52"
        className={"pointer-events-none absolute " + (big ? "-bottom-4 -right-3 h-[140px] w-[140px]" : "-bottom-2 -right-2 h-[74px] w-[74px]")}
        style={{ color: a.accent, opacity: 0.1 }}
        aria-hidden
      >
        {a.glyph}
      </svg>

      <div className={"relative flex h-full flex-col justify-between " + (big ? "p-5" : "p-2.5")}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ backgroundColor: a.accent }} />
          
        </span>

        <span className="flex flex-col">
          <span
            className={"num font-bold leading-none tracking-tight text-gray-900 dark:text-gray-50 " + (big ? "text-[30.5px]" : "text-[18px]")}
            style={{ color: a.accent }}
          >
            {big1}
          </span>
          <span className={"mt-1 truncate font-medium text-gray-600 dark:text-gray-300 " + (big ? "text-[12.5px]" : "text-[10px]")}>{sub}</span>
        </span>

        <span className={"num truncate text-gray-400 dark:text-gray-500 " + (big ? "text-[11px]" : "text-[9px]")}>
          {d.source} · {d.date.slice(5).replace("-", "/")}
        </span>
      </div>
    </div>
  )
}

/** 요약 한 덩어리를 문단으로 — 벽처럼 붙은 글은 아무도 안 읽는다 */
function para(s: string): string[] {
  if (!s) return []
  const out: string[] = []
  for (const x of s.split(/(?<=\.)\s+/)) {
    const last = out[out.length - 1]
    if (last && (last + x).length < 170) out[out.length - 1] = last + " " + x
    else out.push(x)
  }
  return out
}

/** 검색어 하이라이트 — 어디가 걸렸는지 눈으로 보이지 않으면 검색 결과를 신뢰할 수 없다 */
function Hi({ text, q }: { text: string; q: string }) {
  const k = q.trim()
  if (!k || !text) return <>{text}</>
  const parts = text.split(new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === k.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-yellow-200 dark:bg-yellow-500/30 px-0.5 text-gray-900 dark:text-gray-50">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  )
}

/** 같은 사건 묶기 — 날짜 ±2일 + 제목·요약 토큰 유사도. 시트(관점)가 다르면 묶지 않는다 */
const STOP = /^(그|및|등|위해|대한|관련|올해|지난|이번|the|a|an|of|in|on|to|for|and|with|its|his|by)$/i

function tokens(x: Doc) {
  return new Set(
    (x.title + " " + x.summary)
      .toLowerCase()
      .replace(/[^0-9a-z가-힣₱%.\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP.test(w)),
  )
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0
  a.forEach((w) => {
    if (b.has(w)) inter++
  })
  const uni = a.size + b.size - inter
  return uni === 0 ? 0 : inter / uni
}

type Group = { head: Doc; dups: Doc[] }

function groupDocs(list: Doc[]): Group[] {
  const used = new Set<string>()
  const out: Group[] = []
  const toks = new Map<string, Set<string>>()
  list.forEach((x) => toks.set(x.id, tokens(x)))

  for (const x of list) {
    if (used.has(x.id)) continue
    used.add(x.id)
    const dups: Doc[] = []
    for (const y of list) {
      if (used.has(y.id)) continue
      if (y.kind !== x.kind || y.topic !== x.topic) continue
      if (Math.abs(ageDays(y.date) - ageDays(x.date)) > 2) continue
      if (jaccard(toks.get(x.id)!, toks.get(y.id)!) < 0.42) continue
      used.add(y.id)
      dups.push(y)
    }
    out.push({ head: x, dups })
  }
  return out
}

export default function Page() {
  const { pick } = useLang()
  const [mode] = React.useState<"topic" | "product">("topic")
  const [menu, setMenu] = React.useState("전체")
  const [insightCat, setInsightCat] = React.useState("전체")
  const [prod, setProd] = React.useState("에어컨·RAC")
  const [sort, setSort] = React.useState<"new" | "impact">("new")
  // 새로고침·언어토글에도 마지막 카테고리·정렬 유지
  React.useEffect(() => { try { const m = localStorage.getItem("news_menu"); if (m) setMenu(m); const s = localStorage.getItem("news_sort"); if (s === "new" || s === "impact") setSort(s) } catch {} }, [])
  React.useEffect(() => { try { localStorage.setItem("news_menu", menu) } catch {} }, [menu])
  React.useEffect(() => { try { localStorage.setItem("news_sort", sort) } catch {} }, [sort])
  const [q, setQ] = React.useState("")
  const [searchFocused, setSearchFocused] = React.useState(false)
  // 상단 메뉴바 통합 검색(/news?q=) → 뉴스 검색에 반영. 정적 export 안전을 위해 window.location으로 읽음
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("q")
    if (p) setQ(p)
  }, [])
  const [prodKw, setProdKw] = React.useState<string | null>(null)
  const [openDup, setOpenDup] = React.useState<Set<string>>(new Set())
  const [newsOpen, setNewsOpen] = React.useState(false)


  const [page, setPage] = React.useState(1)
  const [feed, setFeed] = React.useState<FeedItem[] | null>(null)
  const [chips, setChips] = React.useState<Record<string, Chip>>({})
  const [regs, setRegs] = React.useState<RegBoardItem[]>([])
  const [posts, setPosts] = React.useState<Awaited<ReturnType<typeof analysisPosts>>>([])
  const [reports, setReports] = React.useState<PubReport[]>([])
  const [banner, setBanner] = React.useState<Banner>(NEWS_BANNER)
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [modal, setModal] = React.useState<Doc | null>(null)
  const [closing, setClosing] = React.useState(false)

  const closeModal = React.useCallback(() => {
    setClosing(true)
    window.setTimeout(() => {
      setModal(null)
      setClosing(false)
    }, 240)
  }, [])

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeModal()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [closeModal])

  React.useEffect(() => {
    Promise.all([indicatorChips(), regBoard(40), analysisPosts(20), freshness()])
      .then(([c, r, p, f]) => {
        setChips(c)
        setRegs(r)
        setPosts(p)
        setStamp(f.news ?? null)
      })
      .catch(() => {})
    newsFeed(0).then(setFeed).catch(() => setFeed([]))
    publishedReports().then(setReports).catch(() => setReports([]))
    pageBanner("news").then((b) => { if (b) setBanner(b as Banner) }).catch(() => {})
  }, [])

  React.useEffect(() => {
    setPage(1)
  }, [menu, sort, q, mode, prod, prodKw])

  /** 세 소스를 표준형으로 */
  const newsDocs: Doc[] = React.useMemo(
    () =>
      (feed ?? [])
        .filter((f) => f.ai && f.ai.trim().length > 0 && f.source !== OURS)
        .map((f) => ({
          id: "n" + f.id,
          kind: "news" as Kind,
          topic: f.topic,
          product: f.product,
          title: pick(f.title, f.titleEn) as string,
          summary: pick(f.summary, f.summaryEn) as string,
          so: pick(f.ai, f.aiEn) as string,
          source: f.source,
          date: f.date,
          url: f.url,
          image: f.image,
          chipKeys: f.chipKeys,
        })),
    [feed, pick],
  )

  const regDocs: Doc[] = React.useMemo(
    () =>
      regs.map((r) => ({
        id: "r" + r.id,
        kind: "reg" as Kind,
        topic: "규제·정책",
        product: "전 제품 영향",
        title: pick(r.title, r.titleEn) as string,
        summary: pick(r.summary, r.summaryEn) as string,
        so: r.implication ?? "",
        source: r.source,
        date: r.date,
        url: r.url,
        image: null,
        chipKeys: [],
        action: r.actions,
        severity: r.severity,
        dDay: r.dDay,
        agency: r.agency,
      })),
    [regs, pick],
  )

  const insightDocs: Doc[] = React.useMemo(
    () =>
      posts.map((p) => ({
        id: "i" + p.id,
        kind: "insight" as Kind,
        topic: "인사이트",
        product: "전 제품 영향",
        title: pick(p.title, p.titleEn) as string,
        summary: (pick(p.summary, p.summaryEn) as string) || (pick(p.dek, p.dekEn) as string) || "",
        so: pick(p.whyMatters, p.whyMattersEn) as string,
        source: p.kind === "own" ? (p.author ?? "경영기획") : p.source,
        date: p.publishedAt,
        url: p.url,
        image: p.kind === "own" ? null : p.image,
        chipKeys: [],
      })),
    [posts, pick],
  )

  // 발간 리포트 — reports/index.json 매니페스트에서 로드(발행 스크립트가 갱신).
  //  분류 지정 토픽에 노출, 클릭 시 PDF 원문(새 탭). 발행 = 자동 대시보드 반영.
  const reportDocs: Doc[] = React.useMemo(
    () =>
      reports.map((r) => ({
        id: "rep-" + r.id, kind: "insight" as Kind, topic: "인사이트", product: "전 제품 영향",
        title: r.title, summary: r.summary, so: r.so,
        source: r.source, date: r.date, url: r.pdf, image: r.thumb ?? null, chipKeys: [],
      })),
    [reports],
  )
  const all = React.useMemo(() => [...reportDocs, ...newsDocs, ...regDocs, ...insightDocs], [reportDocs, newsDocs, regDocs, insightDocs])

  const counts = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const mi of MENUS) m[mi.key] = 0
    for (const d of all) for (const mi of MENUS) if (menuMatch(d, mi)) m[mi.key]++
    return m
  }, [all])

  const prodCounts = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of all) m[x.product] = (m[x.product] ?? 0) + 1
    return m
  }, [all])

  const shown = React.useMemo(() => {
    const mi = MENUS.find((m) => m.key === menu)
    let d =
      mode === "product"
        ? all.filter((x) => x.product === prod)
        : mi
          ? all.filter((x) => menuMatch(x, mi))
          : all
    const k = q.trim().toLowerCase()
    if (k) d = d.filter((x) => (x.title + " " + x.summary + " " + x.so + " " + x.source).toLowerCase().includes(k))
    // 제품 키워드 — 유의어 OR 매칭(제목·요약·시사점)
    const pk = PROD_KW.find((p) => p.key === prodKw)
    if (pk) {
      const syn = pk.syn.map((s) => s.toLowerCase())
      d = d.filter((x) => {
        const hay = (x.title + " " + x.summary + " " + x.so).toLowerCase()
        return syn.some((s) => hay.includes(s))
      })
    }
    if (sort === "impact") {
      const score = (x: Doc) => {
        if (x.kind === "reg") {
          const urgent = x.dDay != null && x.dDay >= 0 && x.dDay <= 14 ? 2 : 1
          const sev = x.severity === "Critical" ? 3 : x.severity === "High" ? 2 : 1
          return (W["규제·정책"] ?? 1) * sev * urgent
        }
        const c = lead(x, chips)
        const mv = Math.min(6, Math.abs(c?.deltaPct ?? 0))
        const decay = 1 / (1 + ageDays(x.date) / 14)
        return (W[x.topic] ?? 0.8) * (1 + mv) * decay
      }
      d = [...d].sort((a, b) => score(b) - score(a))
    } else {
      d = [...d].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    }
    // 인사이트 칼럼 — 발간 PDF 리포트(SONA·Pax Silica)는 날짜와 무관하게 항상 최상단 고정(핵심 인사이트)
    if (menu === "인사이트") {
      const isRep = (x: Doc) => x.id.startsWith("rep-") || (!!x.url && /\.pdf($|\?)/i.test(x.url))
      d = [...d.filter(isRep), ...d.filter((x) => !isRep(x))]
    }
    return d
  }, [all, menu, q, sort, chips, mode, prod, prodKw])

  /** 같은 사건은 한 줄로 접는다 — 매체가 셋이면 세 줄이 아니라 "관련 2건" */
  const groups = React.useMemo(() => groupDocs(shown), [shown])
  const pages = Math.max(1, Math.ceil(groups.length / PAGE))
  const cur = Math.min(page, pages)
  const slice = groups.slice((cur - 1) * PAGE, cur * PAGE)



  const go = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes calIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.96)}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}"}</style>

      <div className="grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-7">
        {/* ── 좌 : 메뉴 ── */}
        <aside
          className="h-fit lg:sticky lg:top-[61px] scroll-soft lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-gray-100 lg:dark:border-gray-800/70 lg:pr-6"
          style={{ animation: "fadeUp .5s ease both" }}
        >
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-2 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><path d="M3 4h18M6 12h12M10 20h4" /></svg>
            <p className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("분류", "Category")}</p>
          </div>

          {mode === "topic" ? (
            <div className="px-2 py-3">
              <div className="flex flex-col gap-1">
                {MENUS.map((m, i) => (
                  <React.Fragment key={m.key}>
                    {m.group && m.group !== MENUS[i - 1]?.group && <p className="px-2.5 pb-1 pt-3.5 text-[11px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">{groupLabelN(m.group)}</p>}
                    <button
                      type="button"
                      onClick={() => { setMenu(m.key); setPage(1); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }) }}
                      className={
                        "group relative flex items-center rounded-md px-2.5 py-2 text-left transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 active:scale-[.98] " +
                        (menu === m.key ? "bg-indigo-50/70 dark:bg-indigo-500/10" : "hover:bg-indigo-50 dark:hover:bg-indigo-500/10")
                      }
                    >
                      {menu === m.key && <span className="absolute -left-2 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-indigo-500 dark:bg-indigo-400" />}
                      <span className="flex w-full items-center gap-1.5">
                        <span
                          className={
                            "flex-1 text-[14px] transition-colors " +
                            (menu === m.key ? "font-semibold text-indigo-700 dark:text-indigo-300" : "font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400")
                          }
                        >
                          {menuLabel(m.label)}
                        </span>
                        <span className="num shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{counts[m.key] ?? 0}</span>
                      </span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-3">
              {PRODUCTS.map((g) => (
                <div key={g.group} className="mb-2 last:mb-0">
                  <p className="px-1 pb-1 pt-1.5 text-[10px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">{g.group}</p>
                  <div className="flex flex-col gap-0.5">
                    {g.items.map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => setProd(it.key)}
                        className={
                          "group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 active:scale-[.98] " +
                          (prod === it.key ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10")
                        }
                      >
                        <span
                          className={
                            "text-[12.5px] transition-colors duration-300 " +
                            (prod === it.key ? "font-semibold text-indigo-700 dark:text-indigo-300" : "font-medium text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400")
                          }
                        >
                          {it.key}
                        </span>
                        <span className="num shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{prodCounts[it.key] ?? 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── 중앙 : 결론 앵커 + 피드 ── */}
        <div className="flex min-h-[1200px] min-w-0 flex-col gap-4" style={{ animation: "fadeUp .5s ease both" }}>
        <InsightBanner banner={banner} open={newsOpen} onToggle={() => setNewsOpen((v) => !v)} />
        <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* 정렬 */}
              <Segmented value={sort} onChange={(k) => setSort(k as "new" | "impact")} options={[{ k: "new", label: T("최신순", "Latest") }, { k: "impact", label: T("영향도순", "Impact") }]} size="sm" />
              {/* 인사이트 칼럼 — 카테고리 필터(알약형, 통일 스타일) */}
              {menu === "인사이트" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {["전체", ...INSIGHT_CATS].map((k, i) => {
                    const on = insightCat === k
                    const n = k === "전체" ? slice.length : slice.filter((g) => insightCatOf(g.head) === k).length
                    if (k !== "전체" && n === 0) return null
                    return <button key={k} type="button" onClick={() => setInsightCat(k)} style={{ animation: "fadeUp .4s cubic-bezier(.22,1,.36,1) both", animationDelay: Math.min(i, 8) * 0.03 + "s" }} className={"inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-200 active:scale-95 " + (on ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300")}>{insightLabelN(k)}<span className={"tabular-nums text-[10.5px] " + (on ? "text-indigo-100" : "text-gray-400 dark:text-gray-500")}>{n}</span></button>
                  })}
                </div>
              )}
              {/* 제품 키워드 필터 — 알약형(통일 스타일, 인사이트 뷰에선 숨김) */}
              {menu !== "인사이트" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[{ key: "", label: "전 제품" }, ...PROD_KW.map((p) => ({ key: p.key, label: p.label }))].map((p, i) => {
                    const on = (prodKw ?? "") === p.key
                    return <button key={p.key || "all"} type="button" onClick={() => setProdKw(p.key === "" ? null : p.key)} style={{ animation: "fadeUp .4s cubic-bezier(.22,1,.36,1) both", animationDelay: Math.min(i, 8) * 0.03 + "s" }} className={"inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-200 active:scale-95 " + (on ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300")}>{prodChipLabel(p.label)}</button>
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
            {/* 확장형 검색 — 포커스/입력 시 부드럽게 넓어짐(우리 원래 디자인+애니메이션) */}
            <div
              className="group relative hidden lg:block"
              style={{ width: searchFocused || q ? 319 : 245, transition: "width .42s cubic-bezier(.22,1,.36,1)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={T("제목·본문·출처 검색", "Search title / SO WHAT / source")}
                aria-label={T("뉴스 검색", "Search news")}
                className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-8 text-[13px] outline-none transition-[background,border,box-shadow] duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 hover:bg-white dark:hover:border-gray-700 dark:hover:bg-gray-900 focus:border-indigo-400 focus:bg-white focus:shadow-[0_0_0_3.5px_rgba(99,102,241,0.12)] dark:focus:border-indigo-500/50 dark:focus:bg-gray-950"
              />
              {q && <button type="button" onClick={() => setQ("")} aria-label={T("검색어 지우기", "Clear search")} className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-indigo-600 active:scale-90 dark:hover:bg-gray-800 dark:text-gray-500 dark:hover:text-indigo-400" style={{ animation: "fadeUp .2s ease both" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              {T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}
              <span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span>
            </span>
          </div>
          </header>
        <section className="min-w-0 rounded-xl p-4 transition-shadow duration-300 hover:shadow-md" style={{ animation: "fadeUp .5s ease both" }}>

          <div className="relative mt-3 lg:hidden">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder={T("제목·본문·출처 검색", "Search title / SO WHAT / source")}
              className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900"
            />
          </div>


          <div key={mode + menu + prod + sort + cur + q} style={{ animation: "viewIn .42s cubic-bezier(.22,1,.36,1) both" }}>
            {feed === null ? (
              <div className="mt-3 flex flex-col gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[104px] rounded-lg bg-gray-50 dark:bg-gray-900" />
                ))}
              </div>
            ) : slice.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-gray-500 dark:text-gray-400">{T("조건에 맞는 항목 없음", "No matching items")}</p>
            ) : menu === "인사이트" ? (
              /* 인사이트 칼럼 — 1열 매거진 카드(카테고리 필터는 상단 정렬 옆으로 이동). 시작점 상향(mt 제거) */
              <div className="flex flex-col gap-3">
                {slice.filter((g) => insightCat === "전체" || insightCatOf(g.head) === insightCat).map((g, i) => {
                  const d = g.head
                  const c = lead(d, chips)
                  return (
                    <article key={d.id} role="button" tabIndex={0}
                      onClick={() => { if (d.url && /\.pdf($|\?)/i.test(d.url)) window.open(d.url, "_blank", "noopener"); else setModal(d) }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") setModal(d) }}
                      style={{ animation: "rowIn .5s cubic-bezier(.22,1,.36,1) backwards", animationDelay: Math.min(i, 8) * 0.04 + "s" }}
                      className="group flex cursor-pointer gap-4 overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 p-3 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md active:scale-[.997]">
                      <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900 sm:h-28 sm:w-44">
                        <DocArt d={d} chip={c} big />
                        {d.image && <img src={d.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(ev) => { ev.currentTarget.style.display = "none" }} />}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5 font-semibold" style={{ color: (ART[d.topic] ?? ART["거시·금융"]).accent }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: (ART[d.topic] ?? ART["거시·금융"]).accent }} />{topicLabelN(d.topic)}</span>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span>{d.source}</span>{d.source === OURS || d.kind === "insight" ? <AiMark /> : null}
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="num">{rel(d.date)}</span>
                        </div>
                        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-700 dark:text-gray-50 dark:group-hover:text-indigo-300"><Hi text={d.title} q={q} /></h3>
                        {d.so ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400"><Hi text={d.so} q={q} /></p> : d.summary ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400"><Hi text={d.summary} q={q} /></p> : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {slice.map((g, i) => {
                  const d = g.head
                  const c = lead(d, chips)
                  
                  return (
                    <div
                      key={d.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (d.url && /\.pdf($|\?)/i.test(d.url)) window.open(d.url, "_blank", "noopener")
                        else setModal(d)
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          if (d.url && /\.pdf($|\?)/i.test(d.url)) window.open(d.url, "_blank", "noopener")
                          else setModal(d)
                        }
                      }}
                      style={{
                        animation: "rowIn .5s cubic-bezier(.22,1,.36,1) backwards",
                        animationDelay: Math.min(i, 10) * 0.035 + "s",
                        willChange: "transform, opacity",
                      }}
                      className={
                        "group flex items-start cursor-pointer gap-3 rounded-lg px-2 py-4 border-t border-gray-100 dark:border-gray-800 transition-all duration-300 ease-out hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 active:scale-[.997] "
                      }
                    >
                      <div className="relative shrink-0 overflow-hidden rounded-lg hidden h-[60px] w-[80px] sm:block">
                        {/* 카테고리 아트를 항상 뒤에 — 이미지 없음/로드 실패 시에도 빈 회색 박스가 아니라 브랜디드 폴백이 보임 */}
                        <DocArt d={d} chip={c} big={false} />
                        {d.image && (
                          <img
                            src={d.image}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(ev) => { ev.currentTarget.style.display = "none" }}
                          />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <p
                          className={
                            "line-clamp-1 font-semibold leading-snug text-gray-800 dark:text-gray-100 transition-colors duration-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 " +
                            "text-[14.5px]"
                          }
                        >
                          <Hi text={d.title} q={q} />
                        </p>

                        <p className="mt-1 line-clamp-1 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{d.so ? <Hi text={d.so} q={q} /> : null}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {d.kind === "reg" && (
                            <>
                              <span className={"rounded px-1 py-px text-[9px] font-bold leading-4 " + (SEV[d.severity ?? ""] ?? SEV.Medium)}>{d.severity}</span>
                              {d.dDay != null && <span className={"num text-[10px] font-bold " + (d.dDay >= 0 && d.dDay <= 7 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400")}>{d.dDay <= 0 ? T("시행 중", "In effect") : T("시행 D-", "Effective D-") + d.dDay}</span>}
                            </>
                          )}
                          <span className="text-[10.5px] font-medium text-gray-500 dark:text-gray-400">{d.kind === "reg" ? (d.agency || topicLabelN(d.topic)) : topicLabelN(d.topic)}</span>
                          <span className="text-[11.5px] text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-[11.5px] text-gray-500 dark:text-gray-400">{d.source}</span>
                          {d.source === OURS || d.kind === "insight" ? <AiMark /> : null}
                          <span className="text-[11.5px] text-gray-300 dark:text-gray-600">·</span>
                          <span className="num text-[11.5px] text-gray-500 dark:text-gray-400">{rel(d.date)}</span>

                          {g.dups.length ? (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setOpenDup((prev) => {
                                  const n = new Set(prev)
                                  if (n.has(d.id)) n.delete(d.id)
                                  else n.add(d.id)
                                  return n
                                })
                              }}
                              className="rounded-full border border-gray-200 dark:border-gray-800 px-2 py-px text-[10.5px] text-indigo-600 dark:text-indigo-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 active:scale-95"
                            >
                              {T("관련", "Related")} {g.dups.length}{T("건", "")} {openDup.has(d.id) ? "▴" : "▾"}
                            </button>
                          ) : null}
                        </div>

                        {/* 같은 사건 — 제목·매체만 얇게. 클릭하면 그 기사 팝업 */}
                        {g.dups.length && openDup.has(d.id) ? (
                          <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-gray-200 dark:border-gray-800 pl-2.5">
                            {g.dups.map((x) => (
                              <button
                                key={x.id}
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  setModal(x)
                                }}
                                className="group/d flex items-baseline gap-2 text-left transition-colors duration-200"
                              >
                                <span className="line-clamp-1 text-[12px] text-gray-700 dark:text-gray-200 transition-colors duration-200 group-hover/d:text-indigo-600 dark:text-indigo-400">
                                  <Hi text={x.title} q={q} />
                                </span>
                                <span className="shrink-0 text-[10.5px] text-gray-400 dark:text-gray-500">{x.source}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {feed && shown.length > PAGE ? (
            <div className="mt-4 flex items-center justify-center gap-1 border-t border-gray-100 dark:border-gray-800 pt-3">
              <button
                type="button"
                disabled={cur === 1}
                onClick={() => go(cur - 1)}
                className="rounded-md border border-gray-200 dark:border-gray-800 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {T("이전", "Prev")}
              </button>
              {Array.from({ length: pages })
                .map((_, i) => i + 1)
                .filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 2)
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && p - arr[i - 1] > 1 ? <span className="px-1 text-[11px] text-gray-400 dark:text-gray-500">…</span> : null}
                    <button
                      type="button"
                      onClick={() => go(p)}
                      className={
                        "num min-w-[26px] rounded-md px-1.5 py-1 text-[11px] font-medium transition-all duration-300 ease-out active:scale-95 " +
                        (p === cur ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300 hover:-translate-y-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400")
                      }
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                type="button"
                disabled={cur === pages}
                onClick={() => go(cur + 1)}
                className="rounded-md border border-gray-200 dark:border-gray-800 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {T("다음", "Next")}
              </button>
            </div>
          ) : null}
        </section>
        </div>


      </div>

      {/* ── 팝업 : 뉴스·규제·인사이트 공통 ── */}
      {modal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
          style={{ animation: closing ? "veilOut .24s ease both" : "veilIn .24s ease both" }}
          onClick={closeModal}
        >
          <div
            className="relative flex h-[80vh] max-h-[700px] w-full max-w-[600px] flex-col overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[0.06] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] dark:bg-gray-900 dark:ring-white/10"
            style={{ animation: closing ? "popOut .22s cubic-bezier(.4,0,1,1) both" : "popIn .44s cubic-bezier(.34,1.42,.64,1) both" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label={T("닫기", "Close")}
              className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-gray-600 backdrop-blur transition-all duration-200 hover:bg-black/10 hover:text-gray-900 active:scale-90 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 dark:hover:text-gray-50"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="relative h-[200px] w-full shrink-0 overflow-hidden">
              <DocArt d={modal} chip={lead(modal, chips)} big />
              {modal.image && (
                <img
                  src={modal.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(ev) => { ev.currentTarget.style.display = "none" }}
                />
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
              {/* 메타 — iOS 캡션(토픽 컬러 닷 + 출처·날짜) */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5 font-semibold" style={{ color: (ART[modal.topic] ?? ART["거시·금융"]).accent }}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: (ART[modal.topic] ?? ART["거시·금융"]).accent }} />
                  {topicLabelN(modal.topic)}
                </span>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span>{modal.source}</span>
                {modal.source === OURS || modal.kind === "insight" ? <AiMark /> : null}
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span className="num">{modal.date}</span>
                {modal.kind === "reg" ? (
                  <>
                    <span className={"ml-1 rounded-md px-1.5 py-px text-[10px] font-bold " + (SEV[modal.severity ?? ""] ?? SEV.Medium)}>
                      {modal.severity}
                    </span>
                    {modal.dDay != null ? (
                      <span
                        className={
                          "num rounded-md px-1.5 py-px text-[10px] font-bold " +
                          (modal.dDay >= 0 && modal.dDay <= 7 ? "bg-red-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300")
                        }
                      >
                        {modal.dDay <= 0 ? T("시행 중", "In effect") : T("시행 D-", "Effective D-") + modal.dDay}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>

              {/* 제목 — iOS large title */}
              <h3 className="mt-2.5 text-[22px] font-bold leading-[1.3] tracking-[-0.01em] text-gray-900 dark:text-gray-50">
                <Hi text={modal.title} q={q} />
              </h3>

              {/* 시사점 — iOS 틴티드 콜아웃 카드 */}
              {modal.so ? (
                <div className="mt-4 rounded-2xl bg-indigo-50/80 p-4 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/10 dark:ring-indigo-500/20">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{T("시사점", "Implication")}</p>
                  <p className="mt-1.5 text-[14px] font-medium leading-[1.7] text-gray-800 dark:text-gray-100"><Hi text={modal.so} q={q} /></p>
                </div>
              ) : null}

              {/* 본문 요약 — iOS 그룹 카드 */}
              <div className="mt-3.5 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/40">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("본문 요약", "Summary")}</p>
                <div className="mt-2 space-y-2.5">
                  {para(modal.summary).map((p, i) => (
                    <p key={i} className="text-[13px] leading-[1.75] text-gray-600 dark:text-gray-300">
                      <Hi text={p} q={q} />
                    </p>
                  ))}
                </div>
              </div>

              {/* 대응 — iOS 틴티드 콜아웃(에메랄드) */}
              {modal.action ? (
                <div className="mt-3.5 rounded-2xl bg-emerald-50/70 p-4 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{T("대응", "Action")}</p>
                  <p className="mt-1.5 text-[13px] leading-[1.7] text-gray-700 dark:text-gray-200">{modal.action}</p>
                </div>
              ) : null}

              {/* 연결 지표 */}
              {modal.chipKeys.map((k) => chips[k]).filter(Boolean).length ? (
                <div className="mt-4">
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("연결 지표", "Linked")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {modal.chipKeys
                      .map((k) => chips[k])
                      .filter(Boolean)
                      .map((c) => (
                        <ChipPill key={c.k} c={c} />
                      ))}
                  </div>
                </div>
              ) : null}

              {/* 원문 — iOS 풀폭 버튼 */}
              {modal.url ? (
                <a
                  href={modal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-3 text-[13.5px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-[.98]"
                >
                  {T("원문 보기", "View source")} · {modal.source}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M17 7H8M17 7v9" />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
