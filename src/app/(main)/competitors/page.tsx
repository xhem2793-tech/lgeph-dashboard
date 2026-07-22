"use client"

import React from "react"
import {
  competitorTable,
  freshness,
  fmtStamp,
  promoIntensity,
  promoCampaigns,
  type PriceRow,
  type PromoIntensity,
  type PromoCampaign,
} from "@/lib/supabase"

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
    group: "매일 보는 것",
    items: [
      { key: "movers", no: 1, label: "일일 가격 변동", desc: "3일 가격·변동폭·할인율", status: "live" },
      { key: "outlier", no: 12, label: "이상치 알림", desc: "임계 초과 급변 · VALIDATION REQ", status: "next" },
    ],
  },
  {
    group: "포지션",
    items: [
      { key: "asp", no: 2, label: "ASP 포지셔닝", desc: "스펙버킷 × 가격대 · LG 위치", status: "next" },
      { key: "gap", no: 3, label: "LG vs 경쟁 갭", desc: "동급 스펙 가격차(%) · 프리미엄/디스카운트", status: "next" },
      { key: "trend", no: 5, label: "ASP 추세", desc: "주·월 평균가 시계열 · 가격 인덱스(100)", status: "next" },
    ],
  },
  {
    group: "채널·프로모",
    items: [
      { key: "promo", no: 4, label: "프로모션 트래커", desc: "브랜드별 프로모 강도 · 유통 캠페인", status: "live" },
      { key: "channel", no: 6, label: "채널별 가격 비교", desc: "동일모델 유통 최저가 · 온·오프 격차", status: "plan" },
    ],
  },
  {
    group: "시장 신호",
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
const BRANDS = ["LG", "Samsung", "Panasonic", "TCL", "Midea", "Hisense"]
const SHOPS = ["Anson's", "Abenson", "SM Appliance"]

/** 세그먼트 — 유통 매장이 실제로 진열을 나누는 축(설치형태·도어·급) */
const SEGMENTS: Record<string, { t: string; re: RegExp }[]> = {
  에어컨: [
    { t: "윈도우", re: /window/i },
    { t: "스플릿", re: /split|wall[- ]?mount/i },
    { t: "플로어·천장", re: /floor|ceiling|cassette/i },
    { t: "포터블", re: /portable/i },
    { t: "인버터", re: /inverter/i },
  ],
  냉장고: [
    { t: "양문형(SxS)", re: /side by side|sxs/i },
    { t: "상냉동", re: /top mount|two door|2 door/i },
    { t: "하냉동·프렌치", re: /bottom|french|multi ?door/i },
    { t: "인버터", re: /inverter/i },
  ],
  세탁기: [
    { t: "프론트로드", re: /front load/i },
    { t: "탑로드", re: /top load/i },
    { t: "트윈워시", re: /twin/i },
  ],
  TV: [
    { t: "OLED", re: /oled/i },
    { t: "QNED·NANO", re: /qned|nano/i },
    { t: "UHD·4K", re: /uhd|4k/i },
  ],
}

/** 가격대 — 절대 금액이 아니라 "급". 프로모 판단이 급별로 갈린다 */
const BANDS: { t: string; lo: number; hi: number }[] = [
  { t: "엔트리 <₱25k", lo: 0, hi: 25000 },
  { t: "미드 ₱25~60k", lo: 25000, hi: 60000 },
  { t: "프리미엄 ₱60k+", lo: 60000, hi: Infinity },
]

const BADGE: Record<Status, { t: string; c: string }> = {
  live: { t: "LIVE", c: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  next: { t: "SOON", c: "border-indigo-200 bg-indigo-50 text-indigo-600" },
  plan: { t: "PLAN", c: "border-gray-200 bg-gray-50 text-gray-500" },
}

const peso = (n: number | null) => (n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US"))
const pct = (n: number | null) => (n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%")
const md = (s: string | null) => (s ? s.slice(5).replace("-", "/") : "—")

/** 화면 표 = CSV. Excel에서 바로 열리도록 UTF-8 BOM */
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
  if (v.some((x) => x == null)) return <span className="text-gray-300">—</span>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 px-3 py-3 first:border-t-0">
      <p className="mb-2 text-[14px] font-bold tracking-tight text-gray-900">{title}</p>
      {children}
    </div>
  )
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-2 py-1 text-[12px] transition-all duration-200 active:scale-95 " +
        (on
          ? "border-indigo-200 bg-indigo-50 font-medium text-indigo-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-indigo-600")
      }
    >
      {children}
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
function PromoView({ rows, camps }: { rows: PromoIntensity[] | null; camps: PromoCampaign[] }) {
  if (rows === null) {
    return <div className="flex min-h-[440px] items-center justify-center text-[13px] text-gray-400">불러오는 중</div>
  }
  if (rows.length === 0) {
    return <div className="flex min-h-[440px] items-center justify-center text-[13px] text-gray-400">데이터 없음</div>
  }
  const wow = (n: number) => (n > 0 ? "+" + n : String(n))
  const tone = (n: number) =>
    n > 0 ? "text-rose-600" : n < 0 ? "text-emerald-600" : "text-gray-400"

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500">
              <th className="px-3 py-2 text-left">브랜드</th>
              <th className="px-3 py-2 text-left">유통</th>
              <th className="px-3 py-2 text-right">프로모 모델</th>
              <th className="px-3 py-2 text-right">전주 대비</th>
              <th className="px-3 py-2 text-right">평균 할인율</th>
              <th className="px-3 py-2 text-right">전주 대비</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.brand + r.retailer}
                className="border-b border-gray-50 transition-colors hover:bg-indigo-50/40"
                style={{ animation: "rowIn .3s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 22 + "ms" }}
              >
                <td className={"px-3 py-2 font-semibold " + (r.brand === "LG" ? "text-indigo-700" : "text-gray-800")}>
                  {r.brand}
                </td>
                <td className="px-3 py-2 text-gray-500">{r.retailer}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                  {r.promoModels}
                  <span className="text-[10px] text-gray-400"> / {r.listedModels}</span>
                </td>
                <td className={"px-3 py-2 text-right tabular-nums font-semibold " + tone(r.promoModelsWow)}>
                  {wow(r.promoModelsWow)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                  {r.avgDiscount === null ? "—" : r.avgDiscount.toFixed(1) + "%"}
                </td>
                <td className={"px-3 py-2 text-right tabular-nums font-semibold " + tone(r.avgDiscountWowPp ?? 0)}>
                  {r.avgDiscountWowPp === null ? "—" : wow(r.avgDiscountWowPp) + "%p"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {camps.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-gray-700">유통 캠페인 (진행 중)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {camps.map((c) => (
              <a
                key={c.retailer + c.title}
                href={c.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200 hover:-translate-y-px hover:border-indigo-300 hover:shadow-sm"
              >
                <p className="text-[11px] font-semibold text-gray-500">{c.retailer}</p>
                <p className="text-[13px] font-semibold text-gray-900">{c.title}</p>
                <p className="mt-1 text-[11.5px] text-gray-600">
                  {c.liveDiscounted !== null && <span>할인 {c.liveDiscounted}종 · 평균 {c.avgDiscount}% · 최대 {c.maxDiscount}%</span>}
                  {c.onSaleCount !== null && <span>세일 중 {c.onSaleCount.toLocaleString()}종</span>}
                </p>
                {c.brands.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-gray-400">{c.brands.join(" · ")}</p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400">
        프로모 모델 = 할인가 또는 프로모 문구가 걸린 리스팅 · 전주 대비는 7일 전 대비 변화
        <br />
        Anson&apos;s는 정가 필드가 세일가로 표기돼 비중이 항상 100% — 판단은 전주 대비 변화와 평균 할인율 기준
      </p>
    </div>
  )
}

export default function Competitors() {
  const [view, setView] = React.useState("movers")
  const [cat, setCat] = React.useState("전체")
  const [brands, setBrands] = React.useState<string[]>(["LG"])
  const [shops, setShops] = React.useState<string[]>([...SHOPS])
  const [seg, setSeg] = React.useState("전체")
  const [band, setBand] = React.useState("전체")
  const [onlyMoved, setOnlyMoved] = React.useState(false)
  const [rows, setRows] = React.useState<PriceRow[] | null>(null)
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")
  const [priceOpen, setPriceOpen] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "deltaPct", asc: true })
  const [promo, setPromo] = React.useState<PromoIntensity[] | null>(null)
  const [camps, setCamps] = React.useState<PromoCampaign[]>([])

  React.useEffect(() => {
    freshness()
      .then((f) => setStamp(f.prices ?? null))
      .catch(() => {})
    competitorTable(4000)
      .then(setRows)
      .catch(() => setRows([]))
    promoIntensity(14)
      .then(setPromo)
      .catch(() => setPromo([]))
    promoCampaigns()
      .then(setCamps)
      .catch(() => setCamps([]))
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

  const avg = (a: PriceRow[], f: (r: PriceRow) => number | null) => {
    const v = a.map(f).filter((x): x is number => x != null)
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
  }
  /** 카테고리는 리스팅에서 실제로 나온 것만 — 건수 많은 순 */
  const CATS = React.useMemo(() => {
    const m = new Map<string, number>()
    ;(rows ?? []).forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + 1))
    return ["전체", ...Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0])]
  }, [rows])
  const asOf = rows && rows[0] ? rows[0].d0 : "—"
  const active = ALL.find((v) => v.key === view)

  return (
    <div className="mx-auto max-w-[1536px] px-4 pb-6 pt-4 sm:px-6 sm:pb-8">
      <style>{"@keyframes viewIn{from{opacity:0;transform:translateY(8px) scale(.995)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"}</style>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside style={{ animation: "viewIn .45s ease both" }} className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm">
          <Section title="보기">
            <div className="flex flex-col gap-0.5">
              {GROUPS.map((g) => (
                <div key={g.group} className="mt-1.5 first:mt-0">
                  <div className="px-1.5 pb-0.5 pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">{g.group}</div>
                  {g.items.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setView(it.key)}
                      className={
                        "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all duration-200 hover:-translate-y-px active:scale-[.99] " +
                        (view === it.key ? "bg-indigo-50" : "hover:bg-indigo-50/40")
                      }
                    >
                      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (it.status === "live" ? "bg-emerald-500" : "bg-gray-300")} />
                      <span className={"flex-1 truncate text-[13px] transition-colors duration-200 " + (view === it.key ? "font-semibold text-indigo-700" : "font-medium text-gray-600")}>{it.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Section>

          <div className="border-t border-gray-100 px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                setCat("전체")
                setSeg("전체")
                setBand("전체")
                setBrands(["LG"])
                setShops([...SHOPS])
                setOnlyMoved(false)
                setQ("")
              }}
              className="w-full rounded-md border border-gray-200 py-1.5 text-[12px] text-gray-600 transition-all duration-200 hover:border-gray-300 hover:text-indigo-600 active:scale-[.98]"
            >
              필터 초기화
            </button>
          </div>
        </aside>

        <div style={{ animation: "viewIn .45s ease both", animationDelay: ".06s" }} className="flex min-w-0 flex-col gap-4">
        {view === "movers" ? (() => {
          const R = rows || []
          const cu = R.filter((r) => (r.deltaPct ?? 0) < 0).length
          const hi = R.filter((r) => (r.deltaPct ?? 0) > 0).length
          const nMoved = cu + hi
          const total = R.length
          const lgDisc = avg(R.filter((r) => r.brand === "LG"), (r) => r.discountPct)
          const cxDisc = avg(R.filter((r) => r.brand !== "LG"), (r) => r.discountPct)
          return (
            <div onClick={() => setPriceOpen((v) => !v)} className="group cursor-pointer select-none overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-indigo-50/40 to-white shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
                </div>
                <span className="shrink-0 text-[12px] font-bold text-gray-900">가격 읽기</span>
                {!priceOpen && (
                  <div className="min-w-0 flex-1 truncate text-[13px] text-gray-700">
                    {nMoved === 0 ? (
                      <><b className="font-semibold text-gray-900">시장 가격 보합</b> — 관측 {total}개 중 오늘 변동 없음 · LG 할인 {pct(lgDisc)} vs 경쟁 {pct(cxDisc)}</>
                    ) : (
                      <><b className="font-semibold text-gray-900">오늘 변동 {nMoved}건</b> (인하 {cu}·인상 {hi}) — 관측 {total}개 · LG 할인 {pct(lgDisc)} vs 경쟁 {pct(cxDisc)}</>
                    )}
                  </div>
                )}
                <span className="ml-auto shrink-0 text-[11px] font-medium text-indigo-600">더보기 <span className={"inline-block transition-transform " + (priceOpen ? "rotate-180" : "")}>▾</span></span>
              </div>
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: priceOpen ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <div className="border-t border-indigo-100/70 px-4 pb-3.5 pt-3">
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-500">
                      <span>관측 <b className="text-gray-800">{total}</b></span>
                      <span>오늘 변동 <b className="text-gray-800">{nMoved}건</b> (인하 {cu}·인상 {hi})</span>
                      <span>LG 할인 <b className="text-gray-800">{pct(lgDisc)}</b> vs 경쟁 {pct(cxDisc)}</span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-gray-700">관측 <b className="text-gray-900">{total}개 리스팅</b> 기준, 오늘 가격 변동은 <b className="text-gray-900">{nMoved}건</b>(인하 {cu}·인상 {hi}). LG 자사 리스팅 평균 할인율은 <b className="text-gray-900">{pct(lgDisc)}</b>로 경쟁({pct(cxDisc)})과 비교됩니다.</p>
                    <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-indigo-700"><span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 시사점</span><span>변동 건수·폭과 경쟁사 SRP 복귀 시점을 주시. 대량 인하 신호 유무로 성수기 프로모 개시 타이밍을 판단.</span></p>
                  </div>
                </div>
              </div>
            </div>
          )
        })() : null}
        <section
          key={view}
          className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          style={{ animation: "viewIn .32s cubic-bezier(.22,1,.36,1) both" }}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-2">
            <h2 className="flex items-baseline gap-2 text-[16px] font-bold tracking-tight text-gray-900">
              {active?.label}
              <span className={"rounded border px-1 py-px text-[9px] font-semibold " + BADGE[active?.status ?? "plan"].c}>
                {BADGE[active?.status ?? "plan"].t}
              </span>
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
              최종 갱신 {stamp ? fmtStamp(stamp) : md(asOf)}
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700">
                CONFIRMED
              </span>
            </span>
          </header>

          {view === "promo" ? (
            <PromoView rows={promo} camps={camps} />
          ) : active?.status !== "live" ? (
            <div className="flex min-h-[440px] flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-medium text-gray-600">{active?.desc}</p>
              <p className="text-[12px] text-gray-400">데이터 연결 예정 — 뷰 확정 후 구현</p>
            </div>
          ) : (
            <>
              


              {/* 필터 바 — 매장이 실제로 진열을 나누는 축 순서: 카테고리 → 세그먼트 → 가격대 → 브랜드 → 유통 */}
              <div className="mt-3 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">카테고리</span>
                  {CATS.map((c) => (
                    <Chip key={c} on={cat === c} onClick={() => { setCat(c); setSeg("전체") }}>
                      {c}
                    </Chip>
                  ))}
                </div>
                {(SEGMENTS[cat] ?? []).length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">세그먼트</span>
                    <Chip on={seg === "전체"} onClick={() => setSeg("전체")}>전체</Chip>
                    {(SEGMENTS[cat] ?? []).map((s) => (
                      <Chip key={s.t} on={seg === s.t} onClick={() => setSeg(s.t)}>
                        {s.t}
                      </Chip>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">가격대</span>
                  <Chip on={band === "전체"} onClick={() => setBand("전체")}>전체</Chip>
                  {BANDS.map((b) => (
                    <Chip key={b.t} on={band === b.t} onClick={() => setBand(b.t)}>
                      {b.t}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">브랜드</span>
                  {BRANDS.map((b) => (
                    <Chip key={b} on={brands.includes(b)} onClick={() => toggle(brands, b, setBrands)}>
                      {b}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">유통</span>
                  {SHOPS.map((s) => (
                    <Chip key={s} on={shops.includes(s)} onClick={() => toggle(shops, s, setShops)}>
                      {s === "SM Appliance" ? "SM" : s}
                    </Chip>
                  ))}
                  <Chip on={onlyMoved} onClick={() => setOnlyMoved(!onlyMoved)}>가격 변동분만</Chip>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
                  <input
                    value={q}
                    onChange={(ev) => setQ(ev.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="모델코드·모델명 검색"
                    className={"rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-3 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 hover:border-gray-300 hover:bg-white focus:border-indigo-400 focus:bg-white " + (focused || q ? "w-[416px]" : "w-[320px]")}
                  />
                </div>
                <span className="num text-[11px] text-gray-500">{data.length}행</span>
                <button
                  type="button"
                  onClick={() => exportCsv(data, "LGEPH_경쟁사가격_" + asOf + ".csv")}
                  className="ml-auto rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-100 active:scale-95"
                >
                  엑셀(CSV) 내보내기
                </button>
              </div>

              <div className="mt-2 max-h-[600px] overflow-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr>
                      {COLS.map((c) => (
                        <th
                          key={c.k as string}
                          onClick={() => setSort((s) => ({ k: c.k as string, asc: s.k === c.k ? !s.asc : true }))}
                          className={
                            "cursor-pointer select-none whitespace-nowrap border-b border-gray-200 px-2 py-1.5 font-semibold text-gray-600 transition-colors duration-200 hover:text-indigo-600 " +
                            (c.num ? "text-right" : "text-left")
                          }
                        >
                          {c.t === "D-2" ? "D-2 " + md(rows?.[0]?.d2 ?? null) : c.t === "D-1" ? "D-1 " + md(rows?.[0]?.d1 ?? null) : c.t === "당일" ? "당일 " + md(asOf) : c.t}
                          {sort.k === c.k ? <span className="ml-0.5 text-indigo-500">{sort.asc ? "▲" : "▼"}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody key={cat + brands.join() + shops.join() + band + seg + sort.k + String(sort.asc) + q + String(onlyMoved)}>
                    {rows === null ? (
                      <tr>
                        <td colSpan={COLS.length} className="px-2 py-10 text-center text-[12px] text-gray-400">
                          불러오는 중…
                        </td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={COLS.length} className="px-2 py-10 text-center text-[12px] text-gray-400">
                          조건에 맞는 행 없음
                        </td>
                      </tr>
                    ) : (
                      data.slice(0, 100).map((r, i) => {
                        const up = (r.deltaPhp ?? 0) > 0
                        const dn = (r.deltaPhp ?? 0) < 0
                        const dcol = dn ? "text-emerald-700" : up ? "text-red-700" : "text-gray-400"
                        return (
                          <tr
                            key={i}
                            style={{ animation: "rowIn .28s ease both", animationDelay: Math.min(i, 24) * 0.02 + "s" }}
                            className="border-b border-gray-100 transition-all duration-200 hover:-translate-y-px hover:bg-indigo-50/60 hover:text-indigo-700 hover:shadow-[0_1px_0_0_rgba(99,102,241,.25)]"
                          >
                            <td className="px-2 py-1 font-medium text-gray-800">{r.brand}</td>
                            <td className="px-2 py-1 text-gray-600">{r.category}</td>
                            <td className="whitespace-nowrap px-2 py-1 font-medium text-gray-800" title={r.model}>
                              {r.code}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 text-gray-500">{r.retailer}</td>
                            <td className="num px-2 py-1 text-right text-gray-500">{peso(r.p1)}</td>
                            <td className="num px-2 py-1 text-right font-semibold text-gray-900">{peso(r.p0)}</td>
                            <td className={"num px-2 py-1 text-right " + dcol}>
                              {r.deltaPhp == null || r.deltaPhp === 0 ? "—" : (dn ? "−" : "+") + peso(Math.abs(r.deltaPhp)).slice(1)}
                            </td>
                            <td className={"num px-2 py-1 text-right font-semibold " + dcol}>
                              {r.deltaPct == null || r.deltaPct === 0 ? "—" : pct(r.deltaPct)}
                            </td>
                            <td className="px-2 py-1"><Spark p2={r.p2} p1={r.p1} p0={r.p0} /></td>
                            <td className="num px-2 py-1 text-right text-gray-400">{peso(r.srp)}</td>
                            <td className="num px-2 py-1 text-right text-gray-600">
                              {r.discountPct == null ? "—" : r.discountPct.toFixed(0) + "%"}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                표는 상위 100행만 표시(정렬 기준) · 엑셀(CSV)에는 필터된 전체 {data.length}행 전부 · 모델코드에 마우스를 올리면 원문 모델명
              </p>
            </>
          )}
        </section>
        </div>
      </div>
    </div>
  )
}
