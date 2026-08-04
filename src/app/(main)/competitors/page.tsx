"use client"

import React from "react"
import {
  competitorTable,
  competitorDaily,
  competitorDailyLatest,
  freshness,
  fmtStamp,
  promoIntensity,
  promoCampaigns,
  promoDeals,
  competitorAds,
  energyLabels,
  type EnergyRow,
  type PriceRow,
  type DailyRow,
  type PromoIntensity,
  type PromoCampaign,
  type DealRow,
  type CompAd,
} from "@/lib/supabase"
import { canonCode } from "@/lib/classify"
import { peso, pct, md, SEGMENTS, ListSearch } from "@/components/competitors/shared"
import { BoardView } from "@/components/competitors/BoardView"
import { PositioningMatrix } from "@/components/competitors/PositioningMatrix"
import { PromoView } from "@/components/competitors/PromoView"
import { DealsView } from "@/components/competitors/DealsView"
import { AnomalyView } from "@/components/competitors/AnomalyView"
import { MoversView } from "@/components/competitors/MoversView"
import { ErrorBoundary } from "@/components/ErrorBoundary"

/** 경쟁사 가격 — 좌 1/4 메뉴판 + 우 3/4 콘텐츠.
 *
 *  메뉴는 2026-07-10에 정리한 "가격 데이터로 만들 수 있는 분석 13종" 로드맵을 그대로 옮긴 것.
 *  status: live=데이터 연결됨, next=다음 구현, plan=인프라(스펙버킷·롤업) 선행 필요
 *
 *  애니메이션 철학은 대시보드와 동일: fadeUp(진입) · 0.2~0.35s · cubic-bezier(.22,1,.36,1) ·
 *  hover는 indigo-600으로 색만 바뀌고, 클릭은 active:scale로 아주 살짝 눌린다.
 */

type Status = "live" | "next" | "plan"

const GROUPS: { group: string; items: { key: string; no: number; label: string; desc: string; status: Status }[] }[] = [
  {
    group: "가격 모니터링",
    items: [
      { key: "board", no: 0, label: "채널별 가격 비교", desc: "거래선 × 대표 제품 오늘가 매트릭스 · 동일모델 유통 최저가", status: "live" },
      { key: "movers", no: 1, label: "일일 가격 변동", desc: "3일 가격·변동폭·할인율", status: "live" },
      { key: "outlier", no: 12, label: "이상치 알림", desc: "가격 급락·급등·깊은할인·품절 감지 · 유리/불리 신호", status: "live" },
    ],
  },
  {
    group: "포지셔닝·비교",
    items: [
      { key: "asp", no: 2, label: "가격 포지셔닝", desc: "브랜드 × 가격대 산점도 · New DOE ★ · LG 위치", status: "live" },
      { key: "gap", no: 3, label: "LG vs 경쟁 갭", desc: "동급 스펙 가격차(%) · 프리미엄/디스카운트", status: "next" },
      { key: "trend", no: 5, label: "ASP 추세", desc: "주·월 평균가 시계열 · 가격 인덱스(100)", status: "next" },
    ],
  },
  {
    group: "채널·프로모션",
    items: [
      { key: "promo", no: 4, label: "프로모션 트래커", desc: "브랜드별 프로모 강도 · 유통 캠페인", status: "live" },
      { key: "deals", no: 14, label: "프로모 딜", desc: "실딜 리스트 · 할인율·무료배송·번들·쿠폰 · 유통별", status: "live" },
    ],
  },
  {
    group: "시장 신호·인사이트",
    items: [
      { key: "lifecycle", no: 7, label: "신제품·EOL 감지", desc: "신규 리스팅 등장 / 구모델 소멸", status: "plan" },
      { key: "volatility", no: 8, label: "가격 변동성", desc: "모델별 변경 빈도·표준편차 랭킹", status: "plan" },
      { key: "intensity", no: 9, label: "경쟁 강도 지수", desc: "취급 브랜드 수·가격 밀집도", status: "plan" },
      { key: "listing", no: 10, label: "취급·노출 시그널", desc: "브랜드별 리스팅 수 변화", status: "plan" },
      { key: "fx", no: 11, label: "환율 연동 분석", desc: "페소 약세 ↔ 수입가전 가격 상관", status: "plan" },
      { key: "sowhat", no: 13, label: "경쟁분석 요약", desc: "핵심 인사이트 · 액션(Owner·Timing)", status: "plan" },
    ],
  },
]

const ALL = GROUPS.flatMap((g) => g.items)
// 대시보드에 노출할 브랜드 화이트리스트 — 각 제품군에서 최소 8개 브랜드가 보이도록 실제 가전/TV 브랜드를 포괄.
//   (포지셔닝은 카테고리별 취급수 상위 8개만 표시하므로, 후보를 넓혀 TV·냉장고 등도 8개 채워지게)
const SHOWN_BRANDS = [
  "LG", "Samsung", "Panasonic", "TCL", "Haier", "Condura", "Midea", "Hisense", "Carrier",
  "Sony", "Devant", "Skyworth", "Sharp", "Toshiba", "Whirlpool", "Fujidenzo", "Koppel", "Kolin", "Daikin", "Prestiz", "Gree",
]
const BRANDS = SHOWN_BRANDS
const brandShown = (brand: string, _category: string) => SHOWN_BRANDS.includes(brand)
const SHOPS = ["Anson's", "Abenson", "SM Appliance", "Western Appliances", "Robinsons Appliances", "Emcor", "Addessa"]


/** 가격대 — 절대 금액이 아니라 "급". 프로모 판단이 급별로 갈린다 */
const BANDS: { t: string; lo: number; hi: number }[] = [
  { t: "엔트리 <₱25k", lo: 0, hi: 25000 },
  { t: "미드 ₱25~60k", lo: 25000, hi: 60000 },
  { t: "프리미엄 ₱60k+", lo: 60000, hi: Infinity },
]

const BADGE: Record<Status, { t: string; c: string }> = {
  live: { t: "LIVE", c: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  next: { t: "SOON", c: "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  plan: { t: "PLAN", c: "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400" },
}


/* ─── 오늘의 가격 비교 보드(제품 × 거래선 매트릭스) ─────────────────────────────
 *  열 = 5개 거래선(현재 3사 라이브 + Western·Robinsons 수집 예정),
 *  행 = 카테고리별 대표 제품(하이브리드: ⭐동일SKU + 대표 스펙 앵커).
 *  셀 = 해당 거래선의 매칭 리스팅 오늘가 최저값. 행 내 최저가 강조, LG 행 인디고.       */


function exportCsv(rows: PriceRow[], name: string) {
  const head = ["유통", "브랜드", "카테고리", "모델코드", "모델명", "SRP(₱)", "D-2(₱)", "D-1(₱)", "당일(₱)", "전일변동(₱)", "전일변동(%)", "3일변동(%)", "할인율(%)", "URL"]
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const body = rows.map((r) =>
    [r.retailer, r.brand, r.category, r.code, r.model, r.srp, r.p2, r.p1, r.p0, r.deltaPhp, r.deltaPct?.toFixed(1), r.delta3Pct?.toFixed(1), r.discountPct, r.url]
      .map(esc)
      .join(","),
  )
  const csv = "\uFEFF" + [head.join(","), ...body].join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** 3일 미니 라인 — 숫자 3개를 눈으로 비교하는 대신 모양으로 읽는다 */
function Spark({ p2, p1, p0 }: { p2: number | null; p1: number | null; p0: number | null }) {
  const v = [p2, p1, p0]
  if (v.some((x) => x == null)) return <span className="text-gray-300 dark:text-gray-600">—</span>
  const arr = v as number[]
  const mn = Math.min(...arr)
  const mx = Math.max(...arr)
  const W = 40
  const H = 14
  const y = (n: number) => (mx === mn ? H / 2 : H - 2 - ((n - mn) / (mx - mn)) * (H - 4))
  const pts = arr.map((n, i) => (i * (W - 2)) / 2 + 1 + "," + y(n)).join(" ")
  const dn = arr[2] < arr[0]
  const flat = arr[2] === arr[0]
  const col = flat ? "#9ca3af" : dn ? "#047857" : "#b91c1c"
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W - 1} cy={y(arr[2])} r="1.8" fill={col} />
    </svg>
  )
}

function FacetMenu({ label, value, active, children }: { label: string; value: string; active: boolean; children: React.ReactNode }) {
  return (
    <details className="group relative">
      <summary
        className={
          "flex cursor-pointer list-none items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors [&::-webkit-details-marker]:hidden " +
          (active ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-500/40")
        }
      >
        <span className={"font-semibold " + (active ? "text-indigo-400 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500")}>{label}</span>
        <span className={"font-semibold " + (active ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{value}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600 transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[280px] w-[190px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 shadow-lg">
        {children}
      </div>
    </details>
  )
}

function Opt({ on, count, multi, onClick, children }: { on: boolean; count?: number | null; multi?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors " +
        (on && !multi ? "bg-indigo-50 dark:bg-indigo-500/10 font-semibold text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900")
      }
    >
      <span className="flex items-center gap-2">
        {multi ? (
          <span className={"flex h-[15px] w-[15px] items-center justify-center rounded border " + (on ? "border-indigo-600 bg-indigo-600" : "border-gray-300 dark:border-gray-700")}>
            {on ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg> : null}
          </span>
        ) : null}
        {children}
      </span>
      {count != null ? <span className="num text-[10px] text-gray-400 dark:text-gray-500">{count}</span> : null}
    </button>
  )
}

const COLS: { k: string; t: string; num?: boolean }[] = [
  { k: "brand", t: "브랜드" },
  { k: "category", t: "카테고리" },
  { k: "code", t: "모델코드" },
  { k: "retailer", t: "유통" },
  { k: "p1", t: "D-1", num: true },
  { k: "p0", t: "당일", num: true },
  { k: "deltaPhp", t: "전일변동₱", num: true },
  { k: "deltaPct", t: "전일변동%", num: true },
  { k: "spark", t: "3일 추이" },
  { k: "srp", t: "SRP", num: true },
  { k: "discountPct", t: "할인율", num: true },
]


/** 프로모션 트래커 — 브랜드별 프로모 강도(전주 대비) + 유통 캠페인.
 *  ⚠ Anson's는 정가 필드가 항상 세일가로 잡혀 '비중'이 구조적으로 100%가 된다.
 *     따라서 판단은 '전주 대비 변화'와 '평균 할인율'로만 한다. */
export default function Competitors() {
  const [view, setView] = React.useState("board")
  const [cat, setCat] = React.useState("전체")
  const [brands, setBrands] = React.useState<string[]>(["LG"])
  const [shops, setShops] = React.useState<string[]>([...SHOPS])
  const [seg, setSeg] = React.useState("전체")
  const [band, setBand] = React.useState("전체")
  const [onlyMoved, setOnlyMoved] = React.useState(false)
  const [rows, setRows] = React.useState<PriceRow[] | null>(null)
  const [daily, setDaily] = React.useState<DailyRow[] | null>(null)
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "deltaPct", asc: true })
  const [promo, setPromo] = React.useState<PromoIntensity[] | null>(null)
  const [camps, setCamps] = React.useState<PromoCampaign[]>([])
  const [deals, setDeals] = React.useState<DealRow[] | null>(null)
  const [ads, setAds] = React.useState<CompAd[] | null>(null)
  const [elabels, setElabels] = React.useState<EnergyRow[] | null>(null)

  React.useEffect(() => {
    freshness()
      .then((f) => setStamp(f.prices ?? null))
      .catch(() => {})
    competitorTable(4000)
      .then((rs) => {
        const shown = rs.filter((r) => brandShown(r.brand, r.category))
        // 홈크레딧 = 백업/보강용(제휴점 가격 재판매) → 주요 유통이 이미 가진 모델은 제외, 없는 모델만 채운다(gap-fill·중복 방지)
        const primary = new Set(shown.filter((r) => r.retailer !== "Home Credit").map((r) => canonCode(r.model, r.code)).filter((c) => c && c.length >= 4))
        setRows(shown.filter((r) => r.retailer !== "Home Credit" || !primary.has(canonCode(r.model, r.code))))
      })
      .catch(() => setRows([]))
    // 2단계 로딩 — 최신일 우선(board 즉시 렌더, <1s). 전체 이력(20p)은 최신일 완료 후 백그라운드로
    // 이어받아 달력 네비게이터를 채움(초기 웨이브에서 대역폭 경쟁 방지).
    let full = false
    competitorDailyLatest()
      .then((d) => { if (!full) setDaily((prev) => (prev && prev.length > d.length ? prev : d)) })
      .catch(() => {})
      .finally(() => {
        competitorDaily()
          .then((d) => { full = true; setDaily(d) })
          .catch(() => setDaily((prev) => prev ?? []))
      })
    promoIntensity(14)
      .then(setPromo)
      .catch(() => setPromo([]))
    promoCampaigns()
      .then(setCamps)
      .catch(() => setCamps([]))
    promoDeals()
      .then((ds) => setDeals(ds.filter((r) => brandShown(r.brand, r.category))))
      .catch(() => setDeals([]))
    competitorAds()
      .then(setAds)
      .catch(() => setAds([]))
    energyLabels()
      .then(setElabels)
      .catch(() => setElabels([]))
  }, [])

  const toggle = (arr: string[], x: string, set: (v: string[]) => void) =>
    set(arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x])

  /** 필터 → 검색 → 정렬. 표에 보이는 것이 곧 CSV로 나가는 것 */
  const data = React.useMemo(() => {
    let d = (rows ?? []).filter(
      (r) =>
        (cat === "전체" || r.category === cat) &&
        (brands.length === 0 || brands.includes(r.brand)) &&
        (shops.length === 0 || shops.includes(r.retailer)),
    )
    if (onlyMoved) d = d.filter((r) => r.deltaPct != null && r.deltaPct !== 0)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      d = d.filter((r) => (r.model + " " + r.code + " " + r.brand + " " + r.category).toLowerCase().includes(k))
    }
    const dir = sort.asc ? 1 : -1
    return [...d].sort((a: any, b: any) => {
      const x = a[sort.k]
      const y = b[sort.k]
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir
    })
  }, [rows, cat, seg, band, brands, shops, onlyMoved, q, sort])

  // 일별 움직임 데이터가 아직 없으면(스냅샷) 전일변동·3일추이 컬럼을 숨김 — 빈 '—' 컬럼이 버그처럼 보이지 않게
  const hasTrend = React.useMemo(() => (rows ?? []).some((r) => r.deltaPhp != null && r.deltaPhp !== 0), [rows])
  const activeCols = React.useMemo(() => COLS.filter((c) => hasTrend || !["deltaPhp", "deltaPct", "spark"].includes(c.k)), [hasTrend])

  /** 카테고리는 리스팅에서 실제로 나온 것만 — 건수 많은 순 */
  const CATS = React.useMemo(() => {
    const m = new Map<string, number>()
    ;(rows ?? []).forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + 1))
    return ["전체", ...Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0])]
  }, [rows])
  const asOf = rows && rows[0] ? rows[0].d0 : "—"
  const active = ALL.find((v) => v.key === view)

  return (
    <div className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes badgeSwap{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}@keyframes sparkDraw{to{stroke-dashoffset:0}}"}</style>

      <div className="grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-7">
        <aside style={{ animation: "fadeUp .5s ease both" }} className="h-fit lg:sticky lg:top-[61px] lg:border-r lg:border-gray-100 lg:dark:border-gray-800/70 lg:pr-6">
          {/* 좌 메뉴 — 뉴스·경쟁사 광고 사이드바와 동일한 구조(아이콘 헤더·그룹 라벨·우측 상태 메타) */}
          <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 px-2 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
            <p className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">분석</p>
          </div>
          <div className="px-2 py-3">
            <div className="flex flex-col gap-1">
              {GROUPS.map((g) => (
                <React.Fragment key={g.group}>
                  <p className="px-2.5 pb-1 pt-3.5 text-[11px] font-semibold tracking-wide text-gray-400 dark:text-gray-500 first:pt-1">{g.group}</p>
                  {g.items.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setView(it.key)}
                      className={
                        "group relative flex items-center rounded-md px-2.5 py-2 text-left transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 active:scale-[.98] " +
                        (view === it.key ? "bg-indigo-50/70 dark:bg-indigo-500/10" : "hover:bg-indigo-50 dark:hover:bg-indigo-500/10")
                      }
                    >
                      {view === it.key && <span className="absolute -left-2 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-indigo-500 dark:bg-indigo-400" />}
                      <span className="flex w-full items-center gap-1.5">
                        <span className={"flex-1 truncate text-[14px] transition-colors " + (view === it.key ? "font-semibold text-indigo-700 dark:text-indigo-300" : "font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400")}>{it.label}</span>
                        {it.status !== "live" && <span className="shrink-0 text-[9.5px] font-medium text-gray-400 dark:text-gray-500">예정</span>}
                      </span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

        </aside>

        <div style={{ animation: "fadeUp .5s ease both" }} className="flex min-h-[1200px] min-w-0 flex-col gap-4">
        <section
          key={view}
          className="min-w-0"
          style={{ animation: "viewIn .42s cubic-bezier(.22,1,.36,1) both" }}
        >
          {view !== "movers" && view !== "asp" && view !== "board" && view !== "deals" && view !== "outlier" && (<header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
            <h2 className="flex items-baseline gap-2 text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {active?.label}
              <span className={"rounded border px-1 py-px text-[9px] font-semibold " + BADGE[active?.status ?? "plan"].c}>
                {BADGE[active?.status ?? "plan"].t}
              </span>
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              최신 {stamp ? fmtStamp(stamp) : md(asOf)}
              <span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                C
              </span>
            </span>
          </header>)}

          <ErrorBoundary key={view} label={active?.label}>{view === "board" ? (
            <BoardView daily={daily} stamp={stamp} elabels={elabels} />
          ) : view === "asp" ? (
            <PositioningMatrix rows={rows} elabels={elabels} stamp={stamp} />
          ) : view === "promo" ? (
            <PromoView rows={promo} camps={camps} />
          ) : view === "deals" ? (
            <DealsView rows={rows} deals={deals} stamp={stamp} />
          ) : view === "outlier" ? (
            <AnomalyView rows={rows} ads={ads} stamp={stamp} />
          ) : view === "movers" ? (
            <MoversView rows={rows} elabels={elabels} stamp={stamp} />
          ) : active?.status !== "live" ? (
            <div className="flex min-h-[440px] flex-col items-center justify-center gap-1">
              <p className="text-[12.5px] font-medium text-gray-600 dark:text-gray-300">{active?.desc}</p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">데이터 연결 예정 — 뷰 확정 후 구현</p>
            </div>
          ) : (
            <>
              


              {/* 필터 바 — 매장이 실제로 진열을 나누는 축 순서: 카테고리 → 세그먼트 → 가격대 → 브랜드 → 유통 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                <FacetMenu label="카테고리" value={cat} active={cat !== "전체"}>
                  {CATS.map((c) => (
                    <Opt key={c} on={cat === c} count={rows ? (c === "전체" ? rows.length : rows.filter((r) => r.category === c).length) : null} onClick={() => { setCat(c); setSeg("전체") }}>{c}</Opt>
                  ))}
                </FacetMenu>
                {(SEGMENTS[cat] ?? []).length > 0 ? (
                  <FacetMenu label="세그먼트" value={seg} active={seg !== "전체"}>
                    <Opt on={seg === "전체"} onClick={() => setSeg("전체")}>전체</Opt>
                    {(SEGMENTS[cat] ?? []).map((s) => (
                      <Opt key={s.t} on={seg === s.t} onClick={() => setSeg(s.t)}>{s.t}</Opt>
                    ))}
                  </FacetMenu>
                ) : null}
                <FacetMenu label="가격대" value={band} active={band !== "전체"}>
                  <Opt on={band === "전체"} onClick={() => setBand("전체")}>전체</Opt>
                  {BANDS.map((b) => (
                    <Opt key={b.t} on={band === b.t} onClick={() => setBand(b.t)}>{b.t}</Opt>
                  ))}
                </FacetMenu>
                <FacetMenu label="브랜드" value={brands.length === BRANDS.length ? "전체" : brands.length + "개"} active={brands.length !== BRANDS.length}>
                  {BRANDS.map((b) => (
                    <Opt key={b} multi on={brands.includes(b)} count={rows ? rows.filter((r) => r.brand === b).length : null} onClick={() => toggle(brands, b, setBrands)}>{b}</Opt>
                  ))}
                </FacetMenu>
                <FacetMenu label="유통" value={shops.length === SHOPS.length ? "전체" : shops.length + "곳"} active={shops.length !== SHOPS.length}>
                  {SHOPS.map((s) => (
                    <Opt key={s} multi on={shops.includes(s)} count={rows ? rows.filter((r) => r.retailer === s).length : null} onClick={() => toggle(shops, s, setShops)}>{s === "SM Appliance" ? "SM" : s}</Opt>
                  ))}
                </FacetMenu>
                <button type="button" onClick={() => setOnlyMoved(!onlyMoved)} className={"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors " + (onlyMoved ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-transparent bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700")}>
                  <span className={"flex h-4 w-7 items-center rounded-full px-0.5 transition-colors " + (onlyMoved ? "bg-indigo-600" : "bg-gray-300")}><span className={"h-3 w-3 rounded-full bg-white dark:bg-gray-900 transition-transform " + (onlyMoved ? "translate-x-3" : "")} /></span>
                  변동분만
                </button>
                <div className="ml-auto flex items-center gap-2.5">
                  <ListSearch value={q} onChange={setQ} placeholder="모델코드·모델명 검색" />
                  <span className="whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500"><b className="text-gray-700 dark:text-gray-200">{data.length}</b>행{stamp ? " · 최신 " + fmtStamp(stamp) : ""} <span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
                  <button type="button" onClick={() => exportCsv(data, "LGEPH_경쟁사가격_" + asOf + ".csv")} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 transition hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-300">엑셀</button>
                </div>
              </div>

              <div className="mt-2 max-h-[600px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {activeCols.map((c) => (
                        <th
                          key={c.k as string}
                          onClick={() => setSort((s) => ({ k: c.k as string, asc: s.k === c.k ? !s.asc : true }))}
                          className={
                            "cursor-pointer select-none whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-1.5 font-semibold text-gray-600 dark:text-gray-300 transition-colors duration-200 hover:text-indigo-600 dark:hover:text-indigo-400 " +
                            (c.num ? "text-right" : "text-left")
                          }
                        >
                          {c.t === "D-2" ? "D-2 " + md(rows?.[0]?.d2 ?? null) : c.t === "D-1" ? "D-1 " + md(rows?.[0]?.d1 ?? null) : c.t === "당일" ? "당일 " + md(asOf) : c.t}
                          {sort.k === c.k ? <span className="ml-0.5 text-indigo-500 dark:text-indigo-400">{sort.asc ? "▲" : "▼"}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody key={cat + brands.join() + shops.join() + band + seg + sort.k + String(sort.asc) + q + String(onlyMoved)}>
                    {rows === null ? (
                      <tr>
                        <td colSpan={activeCols.length} className="px-2 py-10 text-center text-[12px] text-gray-400 dark:text-gray-500">
                          불러오는 중…
                        </td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={activeCols.length} className="px-2 py-10 text-center text-[12px] text-gray-400 dark:text-gray-500">
                          조건에 맞는 행 없음
                        </td>
                      </tr>
                    ) : (
                      data.slice(0, 100).map((r, i) => {
                        const up = (r.deltaPhp ?? 0) > 0
                        const dn = (r.deltaPhp ?? 0) < 0
                        const dcol = dn ? "text-emerald-700 dark:text-emerald-300" : up ? "text-red-700 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
                        return (
                          <tr
                            key={i}
                            style={{ animation: "rowIn .28s ease both", animationDelay: Math.min(i, 24) * 0.02 + "s" }}
                            className="border-b border-gray-100 dark:border-gray-800 transition-all duration-200 hover:-translate-y-px hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 hover:shadow-[0_1px_0_0_rgba(99,102,241,.25)]"
                          >
                            <td className="px-2 py-1 font-medium text-gray-800 dark:text-gray-100">{r.brand}</td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-300">{r.category}</td>
                            <td className="whitespace-nowrap px-2 py-1 font-medium text-gray-800 dark:text-gray-100" title={r.model}>
                              {r.code}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 text-gray-500 dark:text-gray-400">{r.retailer}</td>
                            <td className="num px-2 py-1 text-right text-gray-500 dark:text-gray-400">{peso(r.p1)}</td>
                            <td className="num px-2 py-1 text-right font-semibold text-gray-900 dark:text-gray-50">{peso(r.p0)}</td>
                            {hasTrend && (
                              <>
                                <td className={"num px-2 py-1 text-right " + dcol}>
                                  {r.deltaPhp == null || r.deltaPhp === 0 ? "—" : (dn ? "−" : "+") + peso(Math.abs(r.deltaPhp)).slice(1)}
                                </td>
                                <td className={"num px-2 py-1 text-right font-semibold " + dcol}>
                                  {r.deltaPct == null || r.deltaPct === 0 ? "—" : pct(r.deltaPct)}
                                </td>
                                <td className="px-2 py-1"><Spark p2={r.p2} p1={r.p1} p0={r.p0} /></td>
                              </>
                            )}
                            <td className="num px-2 py-1 text-right text-gray-400 dark:text-gray-500">{peso(r.srp)}</td>
                            <td className="num px-2 py-1 text-right text-gray-600 dark:text-gray-300">
                              {r.discountPct == null ? "—" : r.discountPct.toFixed(0) + "%"}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                표는 상위 100행만 표시(정렬 기준) · 엑셀(CSV)에는 필터된 전체 {data.length}행 전부 · 모델코드에 마우스를 올리면 원문 모델명
              </p>
            </>
          )}</ErrorBoundary>
        </section>
        </div>
      </div>
    </div>
  )
}
