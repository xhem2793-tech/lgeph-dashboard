"use client"

import React from "react"
import {
  newsFeed,
  indicatorChips,
  regBoard,
  analysisPosts,
  freshness,
  fmtStamp,
  type FeedItem,
  type Chip,
  type RegBoardItem,
} from "@/lib/supabase"
import { useLang } from "@/lib/i18n"
import { Segmented } from "@/components/Segmented"

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

type Menu = { key: string; label: string; desc: string }

/** 주석은 한 줄, 항목 3개, 구분자는 가운뎃점 하나 — 표기가 흔들리면 메뉴가 산만해진다 */
const MENUS: Menu[] = [
  { key: "전체", label: "전체", desc: "뉴스 · 규제 · 인사이트" },
  { key: "거시·금융", label: "거시·금융", desc: "물가 · 금리 · 환율" },
  { key: "정치·정책", label: "정치·정책", desc: "예산 · 행정명령 · 정세" },
  { key: "B2B", label: "B2B", desc: "공조 · 인프라 · 데이터센터" },
  { key: "CE·유통", label: "CE·유통", desc: "가전 수요 · 채널 · 경쟁" },
  { key: "기상·재난", label: "기상·재난", desc: "태풍 · 폭염 · 냉방 수요" },
  { key: "에너지·전력", label: "에너지·전력", desc: "유가 · 전기요금 · 전력" },
  { key: "규제·정책", label: "규제·정책", desc: "통관 · 관세 · 시행일" },
  { key: "인사이트", label: "인사이트", desc: "자체 칼럼 · 외부 큐레이션" },
]

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


const PAGE = 20

function ageDays(s: string) {
  const d = new Date(s + "T00:00:00+08:00").getTime()
  const n = new Date()
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  return Math.max(0, Math.round((t - d) / 86400000))
}

function rel(s: string) {
  const a = ageDays(s)
  if (a <= 0) return "오늘"
  if (a === 1) return "어제"
  if (a < 7) return a + "일 전"
  return s.slice(5).replace("-", "/")
}


/** 이번 주 남은 일수(오늘 포함 X) · 주간 진행률 · 가장 급한 시행 D-day */
/** 규제의 시행일 — dDay 로부터 역산(뷰가 effective_date 로 dDay 를 만든다) */
function effDate(r: Doc) {
  const t = new Date()
  const base = new Date(t.getFullYear(), t.getMonth(), t.getDate() + (r.dDay ?? 0))
  return (
    base.getFullYear() +
    "-" +
    String(base.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(base.getDate()).padStart(2, "0")
  )
}

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]






const SEV: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-amber-100 text-amber-700",
  Medium: "bg-gray-100 text-gray-600",
}

/** 우리가 만든 것(가격 트래커·자체 칼럼)에는 표식을 붙인다 — 남의 보도와 섞이면 안 된다 */
const OURS = "LGEPH AI"

function AiMark() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded border border-indigo-200 bg-indigo-50 px-1 py-px text-[9px] font-bold leading-4 text-indigo-700">
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
      title={c.label + " · " + chipStamp(c) + " 기준"}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-1.5 py-px text-[10px] leading-4 text-gray-600 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95"
    >
      <span>{c.label}</span>
      <span className="num font-semibold text-gray-800">
        {c.unit === "₱" ? "₱" : ""}
        {c.value ?? "—"}
        {c.unit && c.unit !== "₱" ? c.unit : ""}
      </span>
      {dv ? (
        <span className={"num font-semibold " + (strong ? (up ? "text-red-600" : "text-emerald-600") : "text-gray-400")}>
          {Math.abs(dv).toFixed(1)}
          {c.deltaUnit}
          {up ? "↑" : "↓"}
        </span>
      ) : null}
      <span className="num text-gray-400">{chipStamp(c)}</span>
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
    accent: "#4f46e5",
    tag: "MACRO",
    glyph: (
      <path d="M4 44 L18 30 L28 38 L44 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  "정치·정책": {
    tint: "#f6f8fa",
    accent: "#475569",
    tag: "POLICY",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        <path d="M12 8h20l8 8v32H12z" />
        <path d="M18 24h16M18 32h16M18 40h10" strokeLinecap="round" />
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
        <path d="M14 24h4M14 32h4M14 40h4M30 32h8M30 40h8" strokeLinecap="round" />
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
        <path d="M20 18v-4a6 6 0 0 1 12 0v4" strokeLinecap="round" />
      </g>
    ),
  },
  "기상·재난": {
    tint: "#f1fdfa",
    accent: "#0d9488",
    tag: "WEATHER",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
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
        <path d="M26 16v11l7 5" strokeLinecap="round" />
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
        <path d="M18 48h16" strokeLinecap="round" />
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
    big1 = d.dDay == null ? "—" : d.dDay <= 0 ? "시행 중" : "D-" + d.dDay
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
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200" style={{ backgroundColor: a.tint }}>
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
            className={"num font-bold leading-none tracking-tight text-gray-900 " + (big ? "text-[34px]" : "text-[19px]")}
            style={{ color: a.accent }}
          >
            {big1}
          </span>
          <span className={"mt-1 truncate font-medium text-gray-600 " + (big ? "text-[13px]" : "text-[10px]")}>{sub}</span>
        </span>

        <span className={"num truncate text-gray-400 " + (big ? "text-[11px]" : "text-[9px]")}>
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
  const parts = text.split(new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\export default function Page() {") + ")", "gi"))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === k.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-gray-900">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  )
}

function hitCount(x: Doc, q: string) {
  const k = q.trim().toLowerCase()
  if (!k) return 0
  const s = (x.title + " " + x.summary + " " + x.so).toLowerCase()
  let n = 0
  let i = s.indexOf(k)
  while (i >= 0) {
    n++
    i = s.indexOf(k, i + k.length)
  }
  return n
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
  const [prod, setProd] = React.useState("에어컨·RAC")
  const [sort, setSort] = React.useState<"new" | "impact">("new")
  const [q, setQ] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [openDup, setOpenDup] = React.useState<Set<string>>(new Set())


  const [page, setPage] = React.useState(1)
  const [feed, setFeed] = React.useState<FeedItem[] | null>(null)
  const [chips, setChips] = React.useState<Record<string, Chip>>({})
  const [regs, setRegs] = React.useState<RegBoardItem[]>([])
  const [posts, setPosts] = React.useState<Awaited<ReturnType<typeof analysisPosts>>>([])
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
  }, [])

  React.useEffect(() => {
    setPage(1)
  }, [menu, sort, q, mode, prod])

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

  const all = React.useMemo(() => [...newsDocs, ...regDocs, ...insightDocs], [newsDocs, regDocs, insightDocs])

  const counts = React.useMemo(() => {
    const m: Record<string, number> = { 전체: all.length }
    for (const d of all) m[d.topic] = (m[d.topic] ?? 0) + 1
    return m
  }, [all])

  const prodCounts = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of all) m[x.product] = (m[x.product] ?? 0) + 1
    return m
  }, [all])

  const shown = React.useMemo(() => {
    let d =
      mode === "product"
        ? all.filter((x) => x.product === prod)
        : menu === "전체"
          ? all
          : all.filter((x) => x.topic === menu)
    const k = q.trim().toLowerCase()
    if (k) d = d.filter((x) => (x.title + " " + x.summary + " " + x.so + " " + x.source).toLowerCase().includes(k))
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
    return d
  }, [all, menu, q, sort, chips, mode, prod])

  /** 같은 사건은 한 줄로 접는다 — 매체가 셋이면 세 줄이 아니라 "관련 2건" */
  const groups = React.useMemo(() => groupDocs(shown), [shown])
  const hits = React.useMemo(() => (q.trim() ? shown.reduce((s, x) => s + hitCount(x, q), 0) : 0), [shown, q])
  const pages = Math.max(1, Math.ceil(groups.length / PAGE))
  const cur = Math.min(page, pages)
  const slice = groups.slice((cur - 1) * PAGE, cur * PAGE)

  const board = React.useMemo(() => {
    const rank = { Critical: 0, High: 1, Medium: 2 } as Record<string, number>
    return [...regDocs].sort((a, b) => {
      const s = (rank[a.severity ?? ""] ?? 9) - (rank[b.severity ?? ""] ?? 9)
      if (s !== 0) return s
      const ad = a.dDay == null ? 9999 : a.dDay < 0 ? 9998 : a.dDay
      const bd = b.dDay == null ? 9999 : b.dDay < 0 ? 9998 : b.dDay
      return ad - bd
    })
  }, [regDocs])


  const go = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="px-4 py-4 sm:px-6">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes calIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.96)}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}"}</style>

      <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)_286px]">
        {/* ── 좌 : 메뉴 ── */}
        <aside
          className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-[88px]"
          style={{ animation: "fadeUp .5s ease both", animationDelay: "0.05s" }}
        >
          <div className="flex items-baseline justify-between border-b border-gray-100 px-3 py-2.5">
            <p className="text-[14px] font-bold tracking-tight text-gray-900">
              보기
            </p>
            
          </div>

          {mode === "topic" ? (
            <div className="px-3 py-3">
              <div className="flex flex-col gap-0.5">
                {MENUS.map((m, i) => (
                  <React.Fragment key={m.key}>
                    {i === 7 ? <div className="my-1 border-t border-gray-100" /> : null}
                    <button
                      type="button"
                      onClick={() => setMenu(m.key)}
                      className={
                        "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                        (menu === m.key ? "bg-indigo-50" : "hover:bg-indigo-50/40")
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={
                            "flex-1 text-[13px] transition-colors duration-300 " +
                            (menu === m.key ? "font-semibold text-indigo-700" : "font-medium text-gray-800 group-hover:text-indigo-600")
                          }
                        >
                          {m.label}
                        </span>
                        <span className="num shrink-0 text-[10px] text-gray-400">{counts[m.key] ?? 0}</span>
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
                  <p className="px-1 pb-1 pt-1.5 text-[10px] font-semibold tracking-wide text-gray-400">{g.group}</p>
                  <div className="flex flex-col gap-0.5">
                    {g.items.map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => setProd(it.key)}
                        className={
                          "group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                          (prod === it.key ? "bg-indigo-50" : "hover:bg-indigo-50/40")
                        }
                      >
                        <span
                          className={
                            "text-[13px] transition-colors duration-300 " +
                            (prod === it.key ? "font-semibold text-indigo-700" : "font-medium text-gray-800 group-hover:text-indigo-600")
                          }
                        >
                          {it.key}
                        </span>
                        <span className="num shrink-0 text-[10px] text-gray-400">{prodCounts[it.key] ?? 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── 중앙 : 결론 앵커 + 피드 ── */}
        <div className="flex min-w-0 flex-col gap-4">
        <section
          className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-300 hover:shadow-md"
          style={{ animation: "fadeUp .5s ease both", animationDelay: "0.1s" }}
        >
          <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-2.5">
            <div className="flex shrink-0 items-center gap-3">
              <h2 className="flex items-baseline gap-2 text-[16px] font-bold tracking-tight text-gray-900">
                {q.trim() ? (
                  <span className="num rounded-full bg-yellow-100 px-1.5 py-px text-[10px] font-semibold text-yellow-800">
                    “{q.trim()}” {shown.length}건 · {hits}곳 일치
                  </span>
                ) : null}
              </h2>

              {/* 정렬 — 제목 바로 옆 */}
              <Segmented value={sort} onChange={(k) => setSort(k as "new" | "impact")} options={[{ k: "new", label: "최신순" }, { k: "impact", label: "영향도순" }]} size="sm" />
            </div>

            {/* 검색 — 가운데, 끝은 동글게 */}
            <div
              className={
                "group absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] lg:block " +
                (focused || q ? "w-[416px]" : "w-[320px]")
              }
              style={{ marginTop: "-5px" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-300 group-focus-within:text-indigo-600"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="제목 · 본문 · SO WHAT · 출처 검색"
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 hover:border-gray-300 hover:bg-white focus:border-indigo-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="검색어 지우기"
                  className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-indigo-600 active:scale-90"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              ) : null}
            </div>

            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500">
              최종 갱신 {stamp ? fmtStamp(stamp) : "—"}
              <span title="CONFIRMED" className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-bold text-emerald-700">C</span>
            </span>
          </header>

          <div className="relative mt-3 lg:hidden">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder="제목 · 본문 · SO WHAT · 출처 검색"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 focus:border-indigo-400 focus:bg-white"
            />
          </div>


          <div key={mode + menu + prod + sort + cur + q} style={{ animation: "viewIn .42s cubic-bezier(.16,1,.3,1) both" }}>
            {feed === null ? (
              <div className="mt-3 flex flex-col gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[104px] rounded-lg bg-gray-50" />
                ))}
              </div>
            ) : slice.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-gray-500">조건에 맞는 항목 없음</p>
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
                        setModal(d)
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          setModal(d)
                        }
                      }}
                      style={{
                        animation: "rowIn .5s cubic-bezier(.16,1,.3,1) backwards",
                        animationDelay: Math.min(i, 10) * 0.035 + "s",
                        willChange: "transform, opacity",
                      }}
                      className={
                        "group flex items-start cursor-pointer gap-3 rounded-lg px-2 py-2.5 border-t border-gray-100 transition-all duration-300 ease-out hover:bg-indigo-50/40 active:scale-[.997] "
                      }
                    >
                      <div
                        className={
                          "shrink-0 overflow-hidden rounded-lg bg-gray-100 " +
                          "hidden h-[60px] w-[80px] sm:block"
                        }
                      >
                        {d.image ? (
                          <img
                            src={d.image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(ev) => {
                              ev.currentTarget.style.display = "none"
                            }}
                          />
                        ) : (
                          <DocArt d={d} chip={c} big={false} />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        {d.kind === "reg" ? (
                          <span className="mb-1 flex flex-wrap items-center gap-1">
                            <span className={"rounded px-1 py-px text-[9px] font-bold leading-4 " + (SEV[d.severity ?? ""] ?? SEV.Medium)}>
                              {d.severity}
                            </span>
                            {d.dDay != null ? (
                              <span
                                className={
                                  "num text-[10px] font-bold " + (d.dDay >= 0 && d.dDay <= 7 ? "text-red-600" : "text-gray-500")
                                }
                              >
                                {d.dDay <= 0 ? "시행 중" : "시행 D-" + d.dDay}
                              </span>
                            ) : null}
                            <span className="text-[10.5px] text-gray-500">{d.agency}</span>
                          </span>
                        ) : null}

                        <p
                          className={
                            "line-clamp-1 font-semibold leading-snug text-gray-800 transition-colors duration-300 group-hover:text-indigo-600 " +
                            "text-[15px]"
                          }
                        >
                          <Hi text={d.title} q={q} />
                        </p>

                        

                        

                        <p className="mt-1 line-clamp-1 text-[11.5px] leading-snug text-gray-500">{d.so ? <Hi text={d.so} q={q} /> : null}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] font-medium text-gray-500">{d.topic}</span>
                          <span className="text-[11.5px] text-gray-300">·</span>
                          <span className="text-[11.5px] text-gray-500">{d.source}</span>
                          {d.source === OURS || d.kind === "insight" ? <AiMark /> : null}
                          <span className="text-[11.5px] text-gray-300">·</span>
                          <span className="num text-[11.5px] text-gray-500">{rel(d.date)}</span>
                          

                          {q.trim() && hitCount(d, q) > 0 ? (
                            <span className="num rounded-full bg-yellow-100 px-1.5 py-px text-[10px] font-semibold text-yellow-800">
                              일치 {hitCount(d, q)}
                            </span>
                          ) : null}

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
                              className="rounded-full border border-gray-200 px-2 py-px text-[10.5px] text-indigo-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95"
                            >
                              관련 {g.dups.length}건 {openDup.has(d.id) ? "▴" : "▾"}
                            </button>
                          ) : null}
                        </div>

                        {/* 같은 사건 — 제목·매체만 얇게. 클릭하면 그 기사 팝업 */}
                        {g.dups.length && openDup.has(d.id) ? (
                          <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-gray-200 pl-2.5">
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
                                <span className="line-clamp-1 text-[12.5px] text-gray-700 transition-colors duration-200 group-hover/d:text-indigo-600">
                                  <Hi text={x.title} q={q} />
                                </span>
                                <span className="shrink-0 text-[10.5px] text-gray-400">{x.source}</span>
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
            <div className="mt-4 flex items-center justify-center gap-1 border-t border-gray-100 pt-3">
              <button
                type="button"
                disabled={cur === 1}
                onClick={() => go(cur - 1)}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                이전
              </button>
              {Array.from({ length: pages })
                .map((_, i) => i + 1)
                .filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 2)
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && p - arr[i - 1] > 1 ? <span className="px-1 text-[11px] text-gray-400">…</span> : null}
                    <button
                      type="button"
                      onClick={() => go(p)}
                      className={
                        "num min-w-[26px] rounded-md px-1.5 py-1 text-[11px] font-medium transition-all duration-300 ease-out active:scale-95 " +
                        (p === cur ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-600")
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
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                다음
              </button>
            </div>
          ) : null}
        </section>
        </div>

        {/* ── 우 : 이번 주 요약(위) + 규제 상위 3건(아래) ── */}
        <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-[88px]" style={{ animation: "fadeUp .5s ease both", animationDelay: "0.15s" }}>
          {/* 규제 동향 — 상단 3건만, 나머지는 메뉴로 */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
            <button
              type="button"
              onClick={() => setMenu("규제·정책")}
              className="group flex w-full items-baseline justify-between border-b border-gray-100 px-3 py-2.5 text-left transition-colors duration-300 hover:bg-indigo-50/40"
            >
              <p className="text-[14px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
                정책 동향 › <span className="num text-[11px] font-medium text-gray-500">{regDocs.length}</span>
              </p>
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                최종 갱신 {stamp ? fmtStamp(stamp) : "—"}
                <span title="CONFIRMED" className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-bold text-emerald-700">C</span>
              </span>
            </button>
            <div className="p-2">
              {board.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-gray-500">등재된 정책 없음</p>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    {board.slice(0, 3).map((r, i) => {
                    const eff = r.dDay == null ? r.date : effDate(r)
                    const urgent = r.dDay != null && r.dDay >= 0 && r.dDay <= 7
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setModal(r)}
                        style={{ animation: "calIn .5s cubic-bezier(.16,1,.3,1) backwards", animationDelay: i * 0.08 + "s" }}
                        className="group flex w-full min-w-0 gap-2.5 rounded-lg px-1 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-gray-50"
                      >
                        {/* 대시보드 캘린더와 같은 날짜 블록 — 규제는 '시행일'이 곧 일정이다 */}
                        <div
                          className={
                            "flex w-9 shrink-0 flex-col items-center justify-center rounded-md py-1 " +
                            (urgent ? "bg-red-50 text-red-600" : r.dDay != null && r.dDay < 0 ? "bg-gray-200 text-gray-500" : "bg-emerald-50 text-emerald-600")
                          }
                        >
                          <span className="text-[10px] font-bold uppercase leading-none">{MON[Number(eff.slice(5, 7)) - 1]}</span>
                          <span className="num text-sm font-semibold leading-tight">{Number(eff.slice(8, 10))}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate break-normal text-[13px] font-semibold leading-snug text-gray-800 transition-colors duration-300 group-hover:text-indigo-600">
                            {r.title.split("—")[0].trim()}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span
                              className={
                                "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors duration-300 " +
                                (r.severity === "Critical"
                                  ? "bg-red-50 text-red-700"
                                  : r.severity === "High"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-gray-100 text-gray-500")
                              }
                            >
                              {r.severity}
                            </span>
                            {r.dDay != null ? (
                              <span className="num rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 transition-colors duration-300 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                                {r.dDay <= 0 ? "시행 중" : "D-" + r.dDay}
                              </span>
                            ) : null}
                            <span className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 transition-colors duration-300 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                              {r.agency}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                  <button
                    type="button"
                    onClick={() => setMenu("규제·정책")}
                    className="mt-1.5 w-full rounded-md py-1.5 text-center text-[11px] text-indigo-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-indigo-50 active:scale-95"
                  >
                    정책 {regDocs.length}건 전체 보기 ›
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── 팝업 : 뉴스·규제·인사이트 공통 ── */}
      {modal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          style={{ animation: closing ? "backOut .24s ease both" : "backIn .24s ease both" }}
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-[88vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ animation: closing ? "modalOut .24s cubic-bezier(.4,0,1,1) both" : "modalIn .34s cubic-bezier(.22,1,.36,1) both" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <span className={"absolute inset-y-0 left-0 z-10 w-1 " + (/금융|거시/.test(modal.topic) ? "bg-blue-500" : /정치/.test(modal.topic) ? "bg-purple-500" : /규제|정책/.test(modal.topic) ? "bg-red-500" : /에너지|전력/.test(modal.topic) ? "bg-amber-500" : /유통|CE/.test(modal.topic) ? "bg-violet-500" : /B2B/.test(modal.topic) ? "bg-teal-500" : /기상|재난/.test(modal.topic) ? "bg-orange-500" : "bg-indigo-500")} />
            <button
              type="button"
              onClick={closeModal}
              aria-label="닫기"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:text-gray-900 active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="h-[200px] w-full shrink-0 overflow-hidden bg-gray-100">
              {modal.image ? (
                <img
                  src={modal.image}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(ev) => {
                    ev.currentTarget.style.display = "none"
                  }}
                />
              ) : (
                <DocArt d={modal} chip={lead(modal, chips)} big />
              )}
            </div>

            <div className="overflow-y-auto px-7 pb-7 pt-5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                <span className="font-semibold text-indigo-600">{modal.topic}</span>
                <span className="text-gray-300">·</span>
                <span>{modal.source}</span>
                {modal.source === OURS || modal.kind === "insight" ? <AiMark /> : null}
                <span className="text-gray-300">·</span>
                <span className="num">{modal.date}</span>
                {modal.kind === "reg" ? (
                  <>
                    <span className={"ml-1 rounded px-1 py-px text-[10px] font-bold " + (SEV[modal.severity ?? ""] ?? SEV.Medium)}>
                      {modal.severity}
                    </span>
                    {modal.dDay != null ? (
                      <span
                        className={
                          "num rounded px-1 py-px text-[10px] font-bold " +
                          (modal.dDay >= 0 && modal.dDay <= 7 ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600")
                        }
                      >
                        {modal.dDay <= 0 ? "시행 중" : "시행 D-" + modal.dDay}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>

              <h3 className="mt-2 text-[24px] font-bold leading-[1.35] tracking-tight text-gray-900">
                <Hi text={modal.title} q={q} />
              </h3>

              {modal.so ? (
                <p className="mt-4 text-[15px] leading-[1.75] text-gray-700"><span className="font-semibold text-indigo-600">{modal.kind === "reg" ? "우리 영향" : modal.kind === "insight" ? "왜 중요한가" : "SO WHAT"} </span><Hi text={modal.so} q={q} /></p>
              ) : null}

              <div className="mt-5">
                <p className="text-[10px] font-bold tracking-widest text-gray-400">본문 요약</p>
                <div className="mt-2 space-y-3">
                  {para(modal.summary).map((p, i) => (
                    <p key={i} className="text-[15px] leading-[1.8] text-gray-700">
                      <Hi text={p} q={q} />
                    </p>
                  ))}
                </div>
              </div>

              {modal.action ? (
                <p className="mt-5 text-[14px] leading-[1.7] text-gray-700"><span className="font-semibold text-gray-900">ACTION </span>{modal.action}</p>
              ) : null}

              {modal.chipKeys.map((k) => chips[k]).filter(Boolean).length ? (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="mb-1.5 text-[10px] font-bold tracking-widest text-gray-400">연결 지표</p>
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

              {modal.url ? (
                <a
                  href={modal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-95"
                >
                  원문 보기 · {modal.source}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
