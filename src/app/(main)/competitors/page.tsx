"use client"

import React from "react"
import {
  competitorTable,
  competitorDaily,
  freshness,
  fmtStamp,
  promoIntensity,
  promoCampaigns,
  promoDeals,
  energyLabels,
  type EnergyRow,
  type PriceRow,
  type DailyRow,
  type PromoIntensity,
  type PromoCampaign,
  type DealRow,
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
      { key: "board", no: 0, label: "채널별 가격 비교", desc: "거래선 × 대표 제품 오늘가 매트릭스 · 동일모델 유통 최저가", status: "live" },
      { key: "movers", no: 1, label: "일일 가격 변동", desc: "3일 가격·변동폭·할인율", status: "live" },
      { key: "outlier", no: 12, label: "이상치 알림", desc: "임계 초과 급변 · VALIDATION REQ", status: "next" },
    ],
  },
  {
    group: "포지션",
    items: [
      { key: "asp", no: 2, label: "가격 포지셔닝", desc: "브랜드 × 가격대 산점도 · New DOE ★ · LG 위치", status: "live" },
      { key: "gap", no: 3, label: "LG vs 경쟁 갭", desc: "동급 스펙 가격차(%) · 프리미엄/디스카운트", status: "next" },
      { key: "trend", no: 5, label: "ASP 추세", desc: "주·월 평균가 시계열 · 가격 인덱스(100)", status: "next" },
    ],
  },
  {
    group: "채널·프로모",
    items: [
      { key: "promo", no: 4, label: "프로모션 트래커", desc: "브랜드별 프로모 강도 · 유통 캠페인", status: "live" },
      { key: "deals", no: 14, label: "프로모 딜", desc: "실딜 리스트 · 할인율·무료배송·번들·쿠폰 · 유통별", status: "live" },
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
// 대시보드에 노출할 브랜드 화이트리스트 — 각 제품군에서 최소 8개 브랜드가 보이도록 실제 가전/TV 브랜드를 포괄.
//   (포지셔닝은 카테고리별 취급수 상위 8개만 표시하므로, 후보를 넓혀 TV·냉장고 등도 8개 채워지게)
const SHOWN_BRANDS = [
  "LG", "Samsung", "Panasonic", "TCL", "Haier", "Condura", "Midea", "Hisense", "Carrier",
  "Sony", "Devant", "Skyworth", "Sharp", "Toshiba", "Whirlpool", "Fujidenzo", "Koppel", "Kolin", "Daikin", "Prestiz", "Gree",
]
const BRANDS = SHOWN_BRANDS
const brandShown = (brand: string, _category: string) => SHOWN_BRANDS.includes(brand)
const SHOPS = ["Anson's", "Abenson", "SM Appliance", "Western Appliances", "Robinsons Appliances", "Emcor", "Addessa"]

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
  live: { t: "LIVE", c: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  next: { t: "SOON", c: "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  plan: { t: "PLAN", c: "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400" },
}

const peso = (n: number | null) => (n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US"))
const pct = (n: number | null) => (n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%")
const md = (s: string | null) => (s ? s.slice(5).replace("-", "/") : "—")

/* ─── 오늘의 가격 비교 보드(제품 × 거래선 매트릭스) ─────────────────────────────
 *  열 = 5개 거래선(현재 3사 라이브 + Western·Robinsons 수집 예정),
 *  행 = 카테고리별 대표 제품(하이브리드: ⭐동일SKU + 대표 스펙 앵커).
 *  셀 = 해당 거래선의 매칭 리스팅 오늘가 최저값. 행 내 최저가 강조, LG 행 인디고.       */
const BOARD_SHOPS: { k: string; label: string; live: boolean }[] = [
  { k: "Abenson", label: "Abenson", live: true },
  { k: "SM Appliance", label: "SM", live: true },
  { k: "Anson's", label: "Anson's", live: true },
  { k: "Robinsons Appliances", label: "Robinsons", live: true },
  { k: "Western Appliances", label: "Western", live: true },
  { k: "Emcor", label: "Emcor", live: true },
  { k: "Addessa", label: "Addessa", live: true },
]

const deltaCol = (d: number | null) => (d == null || d === 0 ? "text-gray-400 dark:text-gray-500" : d < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")

// 에어컨 마력(HP) 추론 — 명시 "X HP" 텍스트 + 브랜드별 모델코드 BTU 환산.
//   LG LA코드=번호/100·HS코드=BTU천 · Carrier WCAR*/CAC/CEP/CTD=BTU백 · TCL TAC##CW/CS · Samsung AR##.
const _btu2hp = (b: number) => (b <= 8 ? 0.75 : b <= 10 ? 1.0 : b <= 15 ? 1.5 : b <= 20 ? 2.0 : b <= 26 ? 2.5 : 3.0)
const acHpNum = (m: string): number | null => {
  const s = m || ""
  const t = s.match(/(\d*\.?\d+)\s*HP/i); if (t) { const v = parseFloat(t[1]); if (v >= 0.3 && v <= 6) return v }
  const la = s.match(/\bLA(\d{3})/i); if (la) { const n = parseInt(la[1], 10) / 100; if (n >= 0.4 && n <= 6) return n }
  const hs = s.match(/\bHS[NU]?(\d{2})/i); if (hs) return _btu2hp(parseInt(hs[1], 10))
  const wc = s.match(/WCAR[A-Z](\d{3})/i); if (wc) return _btu2hp(parseInt(wc[1], 10))
  const cr = s.match(/(?:CAC|CEP|CTD|CAH)(\d{3})/i); if (cr) return _btu2hp(parseInt(cr[1], 10))
  const tac = s.match(/TAC-?(\d{2})C[WS]/i); if (tac) return _btu2hp(parseInt(tac[1], 10))
  const ar = s.match(/\bAR(\d{2})/i); if (ar) { const b = parseInt(ar[1], 10); if (b >= 6 && b <= 30) return _btu2hp(b) }
  return null
}
const acHpLabel = (m: string): string | null => { const h = acHpNum(m); return h == null ? null : (Number.isInteger(h) ? h.toFixed(1) : String(h)) + "HP" }
// 포지셔닝/보드 스펙 필터 버킷 — PM_AC_HP 라벨과 일치
const acHpBucket = (m: string): string | null => { const h = acHpNum(m); return h == null ? null : h <= 0.9 ? "0.75HP↓" : h <= 1.24 ? "1.0HP" : h <= 1.74 ? "1.5HP" : h <= 2.24 ? "2.0HP" : h <= 2.9 ? "2.5HP" : "3.0HP↑" }

// 스펙 도출 — 타입 기준(AC=HP, TV=패널, 세탁기=F/L·T/L, 냉장고=도어형). 모델명 우선, 없으면 capacity
// 보드 표시 스펙 — 포지셔닝과 동일한 정확 분류기(유형=브랜드코드 맵핑 포함) + 사이즈 버킷. 미매핑 최소화.
// 거래선 병합용 정규 코드 — 모델명+코드에서 영문+숫자 혼합 최장 토큰(≥5) 추출(거래선마다 다른 표기 흡수)
// 측정단위 토큰(3.5CUFT·8KG·1.5HP·300L 등)은 모델코드가 아님 → canonCode 후보에서 제외.
const _CANON_NOISE = /^(?:\d*(?:CUFT|CUF|CFT|CU)|\d+(?:KG|HP|LITERS?|LITRES?|WATTS?|INCH|MM|CM)|\d+L)$/
const canonCode = (model: string, code: string | null) => {
  const pre = code && code.length >= 4 && !/^[≈]/.test(code) && code !== "N/A" ? code + " " : ""
  // 하이픈/점으로 끊긴 모델코드 결합(RBT-35SL→RBT35SL·3.5CUFT→35CUFT) 후 나머지 기호는 공백
  const src = (pre + (model || "")).toUpperCase().replace(/([A-Z0-9])[-.]([A-Z0-9])/g, "$1$2").replace(/[^A-Z0-9 ]/g, " ")
  const toks = src.split(/\s+/).filter((x) => /[A-Z]/.test(x) && /\d/.test(x) && x.length >= 5 && !_CANON_NOISE.test(x))
  return toks.sort((a, b) => b.length - a.length)[0] || ""
}
type PivRow = { cat: string; brand: string; code: string; model: string; form: string | null; size: string | null; srp: number | null; cells: ({ price: number; delta: number | null; url: string | null } | null)[]; min: number | null; spread: number | null; star: number | null }
function BoardView({ daily, stamp, elabels }: { daily: DailyRow[] | null; stamp: string | null; elabels: EnergyRow[] | null }) {
  const [cat, setCat] = React.useState("냉장고")
  const [brand, setBrand] = React.useState("전체")
  const [form, setForm] = React.useState("전체")
  const [size, setSize] = React.useState("전체")
  const [q, setQ] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "min", asc: false })
  const [selDate, setSelDate] = React.useState<string | null>(null)
  const D = daily ?? []
  const loading = daily === null
  // 이력 날짜(내림차순) — 달력·이전/다음 이동은 실제 데이터가 있는 날짜만 대상
  const dates = React.useMemo(() => Array.from(new Set(D.map((r) => r.d))).sort((a, b) => b.localeCompare(a)), [D])
  const curDate = selDate && dates.includes(selDate) ? selDate : dates[0] ?? null
  const curIdx = curDate ? dates.indexOf(curDate) : -1
  const prevDate = curIdx >= 0 && curIdx < dates.length - 1 ? dates[curIdx + 1] : null
  const isLatest = curIdx <= 0
  const isOldest = curIdx < 0 || curIdx >= dates.length - 1
  const goOlder = () => { if (!isOldest) setSelDate(dates[curIdx + 1]) }
  const goNewer = () => { if (!isLatest) setSelDate(dates[curIdx - 1]) }
  const pickDate = (v: string) => { if (!v) return; setSelDate(dates.find((d) => d <= v) ?? dates[dates.length - 1] ?? null) }
  const cats = React.useMemo(() => { const av = PM_CATS.filter((c) => D.some((r) => r.category === c)); return av.length ? av : PM_CATS }, [D])
  const brandsL = React.useMemo(() => {
    const m = new Map<string, number>()
    D.forEach((r) => { if (r.brand) m.set(r.brand, (m.get(r.brand) || 0) + 1) })
    const others = Array.from(m.entries()).filter(([b]) => b !== "LG").sort((a, b) => b[1] - a[1]).map((x) => x[0])
    return ["전체", "LG", ...others]
  }, [D])
  const forms = cat === "전체" ? [] : pmFormsFor(cat)
  const effForm = form === "전체" || forms.includes(form) ? form : "전체"
  const sizes = cat === "전체" ? [] : pmSizeList(cat)
  const effSize = size === "전체" || sizes.includes(size) ? size : "전체"
  // DOE ★ 인덱스(카테고리별)
  const starIdx = React.useMemo(() => {
    const m: Record<string, { codeN: string; star: number | null }[]> = {}
    ;(elabels || []).forEach((e) => { if (e.model && e.model.length >= 5) (m[e.category] = m[e.category] || []).push({ codeN: doeNorm(e.category, e.model), star: e.star }) })
    return m
  }, [elabels])
  const starFor = (c: string, model: string) => { const code = DOE_CODE[c]; const idx = code ? starIdx[code] : null; if (!idx) return null; const mm = doeNorm(code, model); const cc = doeNorm(code, canonCode(model, null)); for (const e of idx) { if (e.codeN.length < 5) continue; if (mm.includes(e.codeN)) return e.star; if (cc.length >= 8 && e.codeN.includes(cc)) return e.star } return null }

  const data = React.useMemo(() => {
    const kw = q.trim().toLowerCase()
    // 전일(직전 데이터일) 최저가 인덱스 — canonCode|거래선 → 가격(▼▲ 전일 대비)
    const prevIdx: Record<string, number> = {}
    D.filter((r) => r.d === prevDate && r.price != null).forEach((r) => { const cc = canonCode(r.model, r.code); if (!cc) return; const k = cc + "|" + r.retailer; prevIdx[k] = Math.min(prevIdx[k] ?? Infinity, r.price as number) })
    const f = D.filter((r) => r.d === curDate && r.price != null && (brand === "전체" || r.brand === brand) && PM_CATS.includes(r.category) && (cat === "전체" || r.category === cat) && pmFormHit(cat, r.model + " " + (r.capacity || ""), effForm, r.brand) && pmSizeHit(cat, r.model, r.capacity, effSize) && canonCode(r.model, r.code).length >= 5 && (!kw || (r.code + " " + r.model + " " + canonCode(r.model, r.code)).toLowerCase().includes(kw)))
    const g: Record<string, DailyRow[]> = {}
    f.forEach((r) => { const cc = canonCode(r.model, r.code); (g[r.brand + "|" + cc] = g[r.brand + "|" + cc] || []).push(r) })
    const out: PivRow[] = Object.values(g).map((list) => {
      const r0 = list[0]
      const cc = canonCode(r0.model, r0.code)
      const cells = BOARD_SHOPS.map((s) => {
        const ms = list.filter((r) => r.retailer === s.k)
        if (!ms.length) return null
        const best = ms.reduce((a, b) => ((b.price as number) < (a.price as number) ? b : a))
        const pv = prevIdx[cc + "|" + s.k]
        return { price: best.price as number, delta: pv != null ? (best.price as number) - pv : null, url: best.url ?? null }
      })
      const prices = cells.filter((c): c is { price: number; delta: number | null; url: string | null } => c != null).map((c) => c.price)
      const min = prices.length ? Math.min(...prices) : null
      const max = prices.length ? Math.max(...prices) : null
      const spread = min != null && max != null && min > 0 && max > min ? ((max - min) / min) * 100 : null
      const srps = list.map((x) => x.srp).filter((v): v is number => v != null)
      const _form = pmFormOf(r0.category, r0.model + " " + (r0.capacity || ""), r0.brand)
      const _size = isAC(r0.category) ? acHpLabel(r0.model || "") : pmSizeBucket(r0.category, r0.model, r0.capacity)
      return { cat: r0.category, brand: r0.brand, code: cc || r0.code, model: r0.model, form: _form, size: _size, srp: srps.length ? Math.max(...srps) : null, cells, min, spread, star: starFor(r0.category, r0.model) }
    })
    const dir = sort.asc ? 1 : -1
    const shopIdx = BOARD_SHOPS.findIndex((s) => s.k === sort.k)
    out.sort((a, b) => {
      let x: number | string | null = null, y: number | string | null = null
      if (sort.k === "min") { x = a.min; y = b.min } else if (sort.k === "spread") { x = a.spread; y = b.spread } else if (sort.k === "brand") { x = a.brand; y = b.brand } else if (sort.k === "code") { x = a.code; y = b.code } else if (shopIdx >= 0) { x = a.cells[shopIdx]?.price ?? null; y = b.cells[shopIdx]?.price ?? null }
      if (x == null) return 1; if (y == null) return -1
      return (typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y))) * dir
    })
    return out
  }, [D, curDate, prevDate, cat, brand, effForm, effSize, q, sort]) // eslint-disable-line
  const setS = (k: string) => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))
  const arrow = (k: string) => (sort.k === k ? <span className="ml-0.5 text-indigo-500">{sort.asc ? "▲" : "▼"}</span> : null)

  return (
    <div className="flex flex-col gap-2.5">
      {/* 검색·필터 — LG 기본 · 제품/스펙 호버 드롭다운 · 뉴스형 검색 · 최종갱신(맨오른쪽) */}
      <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <div className="w-fit"><PmDrop label="브랜드" sel={brand} options={brandsL.map((b) => ({ k: b, t: b }))} onSelect={setBrand} /></div>
        <div className="w-fit"><PmDrop label="제품" sel={cat} options={cats.map((c) => ({ k: c, t: c }))} onSelect={(k) => { setCat(k); setForm("전체"); setSize("전체") }} /></div>
        <div className="w-fit"><PmDrop label="유형" sel={effForm} options={[{ k: "전체", t: "전체" }, ...forms.map((t) => ({ k: t, t }))]} onSelect={setForm} /></div>
        <div className="w-fit"><PmDrop label={isAC(cat) ? "마력" : cat === "TV" ? "화면" : "용량"} sel={effSize} options={[{ k: "전체", t: "전체" }, ...sizes.map((t) => ({ k: t, t }))]} onSelect={setSize} /></div>
        {/* 날짜 네비게이터 — 과거 특정일 스냅샷(◀ 이전일 · ▶ 다음일 · 📅 달력에서 선택) */}
        {dates.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-1 py-0.5 shadow-sm">
            <button type="button" onClick={goOlder} disabled={isOldest} aria-label="이전 날짜" className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <span className="min-w-[74px] text-center text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{curDate ? md(curDate) : "—"}{isLatest && <span className="ml-1 rounded bg-emerald-50 dark:bg-emerald-500/10 px-1 text-[8.5px] font-semibold text-emerald-700 dark:text-emerald-300">최신</span>}</span>
            <button type="button" onClick={goNewer} disabled={isLatest} aria-label="다음 날짜" className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
            <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400" title="달력에서 날짜 선택">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <input type="date" value={curDate ?? ""} min={dates[dates.length - 1]} max={dates[0]} onChange={(e) => pickDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="날짜 선택" />
            </label>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className={"group relative transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-[320px]" : "w-[220px]")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="모델·코드 검색"
              className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">최종 {stamp ? fmtStamp(stamp) : curDate ? md(curDate) : "—"}<span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">CONFIRMED</span></span>
        </div>
      </div>

      <div className="max-h-[1040px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[1240px] table-fixed border-collapse text-[12px]">
          <colgroup>
            <col style={{ width: 92 }} /><col style={{ width: 60 }} /><col style={{ width: 132 }} /><col style={{ width: 34 }} /><col style={{ width: 100 }} />
            {BOARD_SHOPS.map((s) => <col key={s.k} style={{ width: 100 }} />)}
            <col style={{ width: 86 }} /><col style={{ width: 70 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr className="text-[10.5px] font-semibold text-gray-600 dark:text-gray-300">
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">브랜드</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">분류</th>
              <th className="cursor-pointer whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("code")}>모델{arrow("code")}</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-1 py-2 text-center" title="New DOE 에너지등급">★</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">SRP</th>
              {BOARD_SHOPS.map((s) => (
                <th key={s.k} onClick={() => setS(s.k)} className={"cursor-pointer whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center " + (s.live ? "" : "text-gray-400 dark:text-gray-600")}>{s.label}{arrow(s.k)}</th>
              ))}
              <th className="cursor-pointer whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("min")}>최저{arrow("min")}</th>
              <th className="cursor-pointer whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("spread")}>스프레드{arrow("spread")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={BOARD_SHOPS.length + 8} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">불러오는 중…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={BOARD_SHOPS.length + 7} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">조건에 맞는 모델 없음</td></tr>
            ) : data.slice(0, 300).map((r, ri) => (
              <tr key={curDate + r.brand + r.code + ri} style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(ri, 20) * 0.018 + "s" }} className="border-b border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5">
                <td className={"px-2 py-1.5 text-center font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{r.brand}</td>
                <td className="px-2 py-1.5 text-center text-[10.5px] text-gray-500 dark:text-gray-400">{r.cat}</td>
                <td className="truncate px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200" title={r.model}>{r.code}</td>
                <td className="px-1 py-1.5 text-center">{r.star != null ? <span className={"rounded px-1 text-[9px] font-bold " + pmStarCls(r.star)}>★{r.star}</span> : <span className="text-gray-300 dark:text-gray-600">·</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.srp != null ? peso(r.srp) : "—"}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums" style={c && r.min != null && c.price === r.min ? { background: "rgba(16,185,129,0.08)" } : undefined}>
                    {!c ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                      <a href={c.url ?? undefined} target={c.url ? "_blank" : undefined} rel="noreferrer" className={c.url ? "cursor-pointer hover:underline" : ""}>
                        <span className={"font-bold " + (r.min != null && c.price === r.min ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-gray-50")}>{peso(c.price)}</span>
                        {c.delta != null && c.delta !== 0 && <span className={"ml-1 text-[9px] " + deltaCol(c.delta)}>{c.delta < 0 ? "▼" : "▲"}</span>}
                      </a>
                    )}
                  </td>
                ))}
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{r.min != null ? peso(r.min) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums">{r.spread == null ? <span className="text-gray-300 dark:text-gray-600">—</span> : <span className={"font-semibold " + (r.spread >= 5 ? "text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400")}>{r.spread.toFixed(1)}%</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">LG 모델 × {BOARD_SHOPS.length}개 거래선 {curDate ? md(curDate) : ""} 스냅샷(경쟁사 제외·유통별 가격차 점검) · 셀=거래선 최저 현금가(클릭→원문)·행 최저가 초록·고가순 정렬 · ▼▲={prevDate ? md(prevDate) + " 대비" : "전일 대비"} · 스프레드=(최고−최저)/최저 ≥5% 적색 · ★=New DOE 등급 · {Math.min(data.length, 300)}/{data.length}행{stamp ? " · 최종 " + fmtStamp(stamp) : ""}</p>
    </div>
  )
}

/* ─── 가격 포지셔닝 매트릭스(ASP) — 실데이터 기반 ────────────────────────────────
 *  세로=5개 유통 평균 단가(위=고가), 가로=브랜드(좌 저가→우 고가). 카드=브랜드×가격
 *  세그먼트(프리미엄/미드/엔트리) 평균가·가격지수·취급 유통수. 자사(LG) 인디고 강조.
 *  제품(카테고리)·스펙(세그먼트) 선택. New DOE ★는 미수집 → 가격 세그먼트로 대체.   */
// RAC(창문·벽걸이) / SAC(스탠드·천장·카세트·멀티·시스템) 분리. 건조기는 세탁기 안에 포함(유형으로 구분)
const PM_CATS = ["냉장고", "세탁기", "TV", "RAC", "SAC"]
const isAC = (c: string) => c === "RAC" || c === "SAC"
// 가격대(tier) 절대 기준(₱) — 카테고리별 실판매가 분위(p25~p75)에 맞춘 시장 세그먼트. [엔트리상한, 프리미엄하한]
//   예: 에어컨 ₱3만 미만 LOW · 3~6만 MED · 6만+ 프리미엄 (₱5만=MED). 상대백분위가 아니라 절대금액.
const PM_TIER_BANDS: Record<string, [number, number]> = {
  "RAC": [30000, 60000],
  "SAC": [60000, 120000],
  "TV": [35000, 80000],
  "냉장고": [25000, 55000],
  "세탁기": [22000, 50000],
}
const pmTierOf = (cat: string, p: number) => { const b = PM_TIER_BANDS[cat] || [25000, 60000]; return p >= b[1] ? "프리미엄" : p >= b[0] ? "미드" : "엔트리" }
// 에어컨은 마력(HP)별로 스펙을 쪼갠다 — 그 외는 SEGMENTS(진열 세그먼트) 사용
const PM_AC_HP: { t: string; re: RegExp }[] = [
  { t: "0.75HP↓", re: /0\.(5|75) ?HP/i },
  { t: "1.0HP", re: /(^|[^\d.])1(\.0)? ?HP/i },
  { t: "1.5HP", re: /1\.5 ?HP/i },
  { t: "2.0HP", re: /(^|[^\d.])2(\.0)? ?HP/i },
  { t: "2.5HP", re: /2\.5 ?HP/i },
  { t: "3.0HP↑", re: /(3(\.0)?|3\.5|4(\.0)?|5(\.0)?) ?HP/i },
]
// 에어컨 설치형태(유형) — HP(스펙)와 별개 축. 우선순위 분류(포터블→스탠드→창문→벽걸이) + 브랜드 코드 인지.
//   Carrier WCAR*=창문·CAC/CEP/CTD=스플릿, Panasonic CW*=창문·CS/CU=스플릿, Samsung AR##=스플릿,
//   Midea MS*=스플릿, TCL TAC##CW/CS, LG LA=창문·HS=스플릿, Condura WCON/WRAC=창문, Kolin KAP=포터블·KA##M=스플릿.
// 유형 우선순위: 포터블 → 스탠드(플로어) → 시스템(SAC: 카세트·천장·멀티·VRF·덕트) → 창문 → 벽걸이(스플릿)
//   시스템에어컨(카세트/멀티스플릿/천장형)이 스탠드형으로 뭉뚱그려지던 문제 분리(2026-07-31).
const RAC_FORMS = ["창문형", "벽걸이형", "포터블"]   // RAC 유형
const SAC_FORMS = ["스탠드형", "시스템"]              // SAC 유형(스탠드·천장/카세트/멀티)
const acFormOf = (m: string): string | null => {
  const s = m || ""
  // 에어컨 아님(공기청정기·산소발생기·에어커튼·제습기 단독) → 배제
  if (/air ?purifier|oxygen concentrat|air ?curtain|\bhepa\b|nebuli/i.test(s)) return null
  if (/portable|\bKAP-?\d/i.test(s)) return "포터블"
  if (/floor ?mount|floor ?standing|스탠드|\bstanding\b|\bZPNQ|53C[LN]V|53CFV|53KFV/i.test(s)) return "스탠드형"
  if (/cassette|ceiling|천장|\bmulti[- ]?split|multi[- ]?v\b|\bvrf\b|\bvrv\b|ducted|concealed|시스템|\bZTNQ|\bZ\dUQ|\bZVNQ|\bZUAB|AMNQ|\bAC0\d{2}[A-Z]/i.test(s)) return "시스템"
  if (/window|창문|\bwdw\b|\bLA\d{3}|WCAR[A-Z]|\bWCON|WRAC|CW[- ]?[A-Z]{0,3}\d|TAC[- ]?\d+CW|\bAW\d|\d+WC[A-Z]*\b|\bKAM ?\d|KAM-?\d|FP-?\d+ARA|MWMDP|HWTAC/i.test(s)) return "창문형"
  if (/split|wall[- ]?mount|벽걸이|HS[NU]?\d{2}|\bAR\d{2}|CS[/-]?CU|\bCS-?[A-Z]{0,2}\d|CSCU|MS[A-Z]{1,3}-?\d|\bMWWA|FTK[A-Z]|TAC[- ]?\d+CS|(?:CAC|CEP|CTD|CAH)\d|KA-?\d+M|\bI?WAR[- ]?\d|\bWAM\d|\bHW-?\d\d|KS-?IW|\bKA-?\d+G|53GCV|53KPV|53CXV|FP ?53|FP\d{2}[A-Z]/i.test(s)) return "벽걸이형"
  // 최종 안전장치(never 기타): 잔여 실물 에어컨은 최빈 구성인 스플릿(벽걸이)로 배정 — 비-에어컨은 위에서 이미 null 배제
  return "벽걸이형"
}
// 냉장고 도어형(유형) — 텍스트 + 브랜드 코드프리픽스(LG RV[SFTB]·Samsung R[SFTB]·Condura C**·Haier HR*)
const REF_FORMS = ["SxS", "F/D", "T/F", "B/F", "1Door", "Freezer"]
const refFormOf = (m: string): string | null => {
  const s = m || ""
  // 액세서리(가전받침대·전압기 AVR·거치대)는 냉장고 아님 → 배제(카테고리 오분류 방어)
  if (/roller stand|appliance stand|support base|voltage reg|\bAVR\b/i.test(s)) return null
  // 명시 타입 텍스트 우선(집계된 마케팅 텍스트/애매한 브랜드코드보다 신뢰) → 그다음 확실한 코드만 폴백
  if (/side by side|\bsxs\b|양문|instaview/i.test(s)) return "SxS"
  if (/french[- ]?door|multi[- ]?door|4[- ]?door|프렌치/i.test(s)) return "F/D"
  // 퍼스널/바 냉장고는 '투도어' 표기가 있어도 소형 단문급 → 1Door 우선(3.5cu.ft급 소형 오분류 방지)
  if (/personal ?(?:ref|refrig|fridge)|bar ?fridge|mini ?bar/i.test(s)) return "1Door"
  if (/top[- ]?mount|two[- ]?door|2[- ]?door|double[- ]?door|top ?freezer|상냉/i.test(s)) return "T/F"
  if (/bottom[- ]?(?:mount|freezer)|하냉|BMF/i.test(s)) return "B/F"
  if (/single[- ]?door|1[- ]?door|one[- ]?door|personal|mini ?(?:bar|fridge|refrig)/i.test(s)) return "1Door"
  if (/chest|showcase|\bfreezer\b|upright|beverage|beer|chiller|wine ?cool/i.test(s)) return "Freezer"
  // ── 브랜드 코드 프리픽스 맵핑 (용량 텍스트가 없는 잔여 대비 — 다층 안전장치) ──
  //   LG RV*·Samsung R*·Condura C*·Fujidenzo I**·Panasonic NR-*·Haier HRF*·Toshiba GR-R*·Sharp SJ*·TCL TRF·Midea MDR*·Whirlpool WF
  if (/\bRVS|\bRS\d|\bISR|\bCSS|\bGRRS/i.test(s)) return "SxS"                                          // 양문
  if (/\bRVF|\bRF\d|\bIFR|\bGRRF/i.test(s)) return "F/D"                                                // 프렌치/멀티도어
  if (/\bRUB|\bRVB|\bRB\d|\bIBM|\bCBF|\bGRRB/i.test(s)) return "B/F"                                    // 하냉동
  if (/\bIRB|\bCPR|\bNRAQ|\bNR-?A|\bRBT|\bRUO|\bHR-?\d0\b/i.test(s)) return "1Door"                       // 소형 퍼스널·단문·미니
  if (/\bCUF|\bCTF|\bCCH|\bGR-?V|\bSC\d|\bHCF|\bHCH|\bIFC|\bISU|\bMDRC|\bCCF|\bIWC|\bEBC/i.test(s)) return "Freezer" // 냉동고·칠러·쇼케이스·쿨러
  if (/\bRVT|\bRUT|\bRT\d|\bCTD|\bCMD|\bNRB|\bNRT|\bNR-?[BT]|\bHRF[- ]?IV|\bGRRT|\bGRRP|\bGR-?[BY]|\bGRB|\bGRY|\bSJ|\bTRF|\bTCF|\bMDRD|\bWF\d|\bARTM|\bINR|\bIRD|\bRDD|\bITV/i.test(s)) return "T/F" // 2도어 상냉동(기본)
  // ── 최종 안전장치: 냉장고는 '기타' 없이 사이즈 기준으로 기본 배정(소형=단문, 그 외=최빈 구성인 상냉동) ──
  const v = refCuft(s)
  if (v != null && v < 6) return "1Door"
  return "T/F"
}
// 세탁기 로드형(유형)
// 세탁기 카테고리에 건조기 포함 — 유형으로 구분. 워시타워/트윈/프론트/탑로드 + 건조기(단독)
const WM_FORMS = ["F/L", "T/L", "Twin Tub", "Single Tub", "W/T", "Dryer"]
const wmFormOf = (m: string): string | null => {
  const s = m || ""
  if (/wash ?tower|washtower|\bWT\d/i.test(s)) return "W/T"
  if (/twin ?(?:wash|tub)|twinwash/i.test(s)) return "Twin Tub"
  // 단조(single tub)·스핀드라이 — 보급형 반자동 세탁기 (탑로드 자동과 구분)
  if (/single ?tub|spin ?dry(?:er)?/i.test(s)) return "Single Tub"
  // 세탁건조 콤보(Combo/Combi · Washer and/& Dryer)는 프론트로드 → F/L (단독 건조기보다 먼저)
  if (/comb[io]|washer.{0,6}dryer/i.test(s)) return "F/L"
  // 단독 건조기(워셔/세탁 텍스트 없이) — 콤보는 위에서 이미 F/L 처리
  if (/\bdryer\b|heat ?pump ?dry|drying machine/i.test(s) && !/\bwasher\b|washing/i.test(s)) return "Dryer"
  if (/\bDVE?\d|\bDVG\d|\bDLE\d/i.test(s)) return "Dryer"   // Samsung DV·LG DLE 건조기 코드
  // 명시 로드형 텍스트 우선 → 코드 폴백(마케팅 텍스트 노이즈로 탑로드가 프론트로 오분류되던 문제)
  if (/top[- ]?load|topload|fully ?auto(?:matic)? ?washing/i.test(s)) return "T/L"
  if (/front[- ]?load|frontload|\bdrum\b/i.test(s)) return "F/L"
  if (/\bFV\d|\bWW\d|\bNA-?V|\bTWF|\bWD\d|\bTWD|\bAWD|WWEB|FWEB|\bESJN|\bHW\d{2}|\bF\d{2}S|\bMF\d/i.test(s)) return "F/L"
  if (/\bT[0-9]\d{3}|\bWA\d|\bNA-?[FW]|\bTWA|\bTWT|\bCWM|\bHWM|\bVHH|\bAWTM|\bAWFM|\bGWTW|\bMA\d{3}W|\bMT\d{3}W|\bMAW|\bMTW|\bAW[- ]?[A-Z]?\d/i.test(s)) return "T/L"
  if (/\bAHW|\bES-?WP|\bEWM|\bWM-?\d|\bBWS|\bHSD|\bJWS/i.test(s)) return "Single Tub"   // 단조 코드 폴백
  // 의류관리기(Styler·AirDresser·Smart Closet)는 세탁기 아님 → 배제
  if (/styler|air ?dresser|smart closet|clothing care|의류관리/i.test(s)) return null
  // 최종 안전장치(never 기타): 잔여 실물 세탁기는 최빈 구성인 탑로드로 배정
  return "T/L"
}
// TV 패널을 **등급(계열)**으로 통합 — 개별 패널명이 아니라 시장 등급으로:
//   OLED(자발광 최상) > QLED급(퀀텀닷·미니LED 프리미엄 LED: QLED·QNED·NanoCell·MiniLED·ULED·NeoQLED) > UHD(표준 4K) > FHD·HD(엔트리)
//   근거: QNED/Neo QLED/Hi-QLED 모두 QLED와 동일 퀀텀닷 계열(2026 시장 통용). 브랜드 인지로 LG의 QLED 오분류 방지.
const TV_FORMS = ["OLED", "QLED급", "UHD", "FHD·HD"]
const tvFormOf = (m: string, brand?: string): string | null => {
  const s = m || ""
  const isLG = /^lg$/i.test(brand || "")
  // 액세서리(녹음기·마이크·셋톱박스·마운트 '단품')는 TV 아님 → 배제.
  //   ※ 광의어(bracket/mount) 금지 — 'with FREE 벽걸이 번들' 실제 TV가 잘못 제외되던 문제. 단품 식별코드만.
  if (/\bVML\d|\bVLT\d|\bVXT\d|\bVST\d|affordabox|set-?top|\bICD-|voice recorder|\bmicrophone\b|\bDM-?1000/i.test(s)) return null
  if (/\boled\b/i.test(s)) return "OLED"
  // QLED급(퀀텀닷/미니LED 프리미엄) — LG 고유(QNED/NanoCell/MiniLED)는 항상, QLED/ULED/NeoQLED는 비LG만
  if (/qned|nano ?cell|\bnano\b|mini ?led|miniled|mini ?rgb|micro ?rgb|rgb ?evo/i.test(s)) return "QLED급"   // LG Mini/Micro RGB evo(2026 플래그십)=프리미엄 등급
  if (!isLG && /qled|\buled\b|neo ?qled/i.test(s)) return "QLED급"
  const inch = tvInOf(s)
  const explicit4k = /uhd|\b4k\b|crystal|\bUA\d|\bNU\d|\bUQ\d|\bUR\d|\bUT\d|WPREU\d/i.test(s)
  // 소형(≤32˝)은 UHD 패널이 사실상 없음 → 명시 4K/UHD가 아니면 무조건 FHD·HD(2K·HD·720p 포함)
  if (inch != null && inch <= 32 && !explicit4k) return "FHD·HD"
  if (explicit4k) return "UHD"
  if (/full ?hd|\bfhd\b|\b2k\b|\bhd\b/i.test(s)) return "FHD·HD"
  // 최종 안전장치(never 기타): 사이즈로 배정 — 40˝↓=FHD·HD, 그 이상=UHD(표준 4K)
  return inch != null && inch < 40 ? "FHD·HD" : "UHD"
}
const pmFormOf = (cat: string, m: string, brand?: string): string | null =>
  isAC(cat) ? acFormOf(m) : cat === "냉장고" ? refFormOf(m) : cat === "세탁기" ? wmFormOf(m) : cat === "TV" ? tvFormOf(m, brand) : null

// ── 스펙(사이즈) 축 — 에어컨=HP, 냉장고=cu.ft, 세탁기=kg, TV=인치. 명시단위 우선, 없으면 브랜드 코드에서 추론 ──
const REF_SIZE = ["7cu.ft↓", "7~14", "14~22", "22cu.ft↑"]
const WM_SIZE = ["8kg↓", "8~11", "11kg↑"]
const TV_SIZE = ["43˝↓", "43~54", "55~64", "65~74", "75˝↑"]
const _mnum = (s: string, re: RegExp) => { const x = s.match(re); return x ? parseFloat(x[1]) : null }
const refCuft = (s: string): number | null => {
  const v = _mnum(s, /(\d+(?:\.\d+)?)\s*cu/i); if (v != null) return v
  const L = _mnum(s, /(\d{3})\s*(?:L\b|li?ters?)/i); if (L != null && L >= 80 && L <= 800) return +(L * 0.0353).toFixed(1)
  let c = s.match(/\b(?:RVS|RVF|RVT|RVB|RUB|RUS|RUT|CMD|CTD)-?[A-Z]?(\d{2,3})/i)
  if (c) { const n = parseInt(c[1], 10) / 10; if (n >= 3 && n <= 40) return n }
  // 파나소닉·하이어·삼성 등은 코드에 리터(L)를 담는다 → cu.ft 환산(L×0.0353)
  c = s.match(/\b(?:NR[-\s]?[A-Z]{1,2}|HRF-?[A-Z]{0,3}|HR[-\s]?|SC|HCF|GR[-\s]?[A-Z]|BCD|RS|RF|RT|RB|RL|RH|CCH|CPR)(\d{2,3})/i)
  if (c) { const L2 = parseInt(c[1], 10); if (L2 >= 60 && L2 <= 800) return +(L2 * 0.0353).toFixed(1); if (L2 >= 30 && L2 < 60) return +(L2 / 10).toFixed(1) }
  return null
}
const wmKgOf = (s: string): number | null => {
  const v = _mnum(s, /(\d+(?:\.\d+)?)\s*kg/i); if (v != null) return v
  const cw = s.match(/CWM(\d+(?:\.\d+)?)/i); if (cw) { const n = parseFloat(cw[1]); if (n >= 4 && n <= 30) return n }
  // 파나소닉 NA-[문자]+숫자: 선두 2~3자리를 /10 해 4~30 되는 해석 채택(W8023→8.0·S056→5.6·FD90→9.0·W10523→10.5)
  const p = s.match(/\bNA[-\s]?[A-Z]{1,2}(\d{2,4})/i); if (p) { const d = p[1]; for (const k of [3, 2]) { if (d.length >= k) { const n = parseInt(d.slice(0, k), 10) / 10; if (n >= 4 && n <= 30) return n } } }
  let c = s.match(/\b(?:FV|WW|WA|WD|WT)(\d{2})/i); if (c) { let n = parseInt(c[1], 10); if (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  const t = s.match(/\bT2(\d)(\d)(\d)/i); if (t) { const a = +t[1], b = +t[2], c2 = +t[3]; const n = a >= 3 ? a * 10 + b : (b === 0 ? c2 : b + (c2 >= 5 ? 0.5 : 0)); if (n >= 4 && n <= 30) return n }
  c = s.match(/\b(?:TWA|TWF|TWT|TWD)(\d{2,3})/i); if (c) { let n = parseInt(c[1], 10); while (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  c = s.match(/\bM[AF](\d{2,3})/i); if (c) { let n = parseInt(c[1], 10); while (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  c = s.match(/\bHWM(\d{2,3})/i); if (c) { let n = parseInt(c[1], 10); if (n > 30) n /= 10; if (n >= 4 && n <= 30) return n }
  return null
}
const tvInOf = (s: string): number | null => {
  const v = _mnum(s, /(\d{2,3})\s*(?:inch|in\b|˝|")/i); if (v != null && v >= 20 && v <= 120) return v
  let c = s.match(/\bWPREU(\d{2})/i)   // Prestiz WPREU{인치}{일련} — 앞 2자리=인치
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  c = s.match(/\b(?:QA|UA|QN|QE|UN|KD|XR|TH|LH|OLED)(\d{2,3})/i)
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  c = s.match(/\bH(\d{2,3})[A-Z]/i)
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  c = s.match(/(?:^|\s)(\d{2,3})(?:["˝]|\s?inch|[A-Z]{2})/i)
  if (c) { const n = parseInt(c[1], 10); if (n >= 20 && n <= 120) return n }
  return null
}
const pmSizeBucket = (cat: string, model: string, capacity: string | null): string | null => {
  const src = (model || "") + " " + (capacity || "")
  if (cat === "냉장고") { const v = refCuft(src); return v == null ? null : v < 7 ? "7cu.ft↓" : v < 14 ? "7~14" : v < 22 ? "14~22" : "22cu.ft↑" }
  if (cat === "세탁기") { const v = wmKgOf(src); return v == null ? null : v < 8 ? "8kg↓" : v < 11 ? "8~11" : "11kg↑" }
  if (cat === "TV") { const v = tvInOf(src); return v == null ? null : v < 43 ? "43˝↓" : v < 55 ? "43~54" : v < 65 ? "55~64" : v < 75 ? "65~74" : "75˝↑" }
  return null
}
// 두 축 목록·매처 — 분류 안 되는 잔여는 "기타"로 흡수(필터에서 제품이 사라지지 않게)
const ETC = "기타"
const pmFormsFor = (c: string) => { const base = c === "RAC" ? RAC_FORMS : c === "SAC" ? SAC_FORMS : c === "냉장고" ? REF_FORMS : c === "세탁기" ? WM_FORMS : c === "TV" ? TV_FORMS : []; return [...base] }   // 유형 '기타' 없음 — 분류기 최종 폴백으로 실물은 항상 유형 배정
const pmFormHit = (cat: string, model: string, t: string, brand?: string) => { if (t === "전체") return true; const f = pmFormOf(cat, model, brand); return t === ETC ? f == null : f === t }
const pmSizeList = (c: string) => { const base = isAC(c) ? PM_AC_HP.map((x) => x.t) : c === "냉장고" ? REF_SIZE : c === "세탁기" ? WM_SIZE : c === "TV" ? TV_SIZE : []; return base.length ? [...base, ETC] : [] }
const pmSizeHit = (cat: string, model: string, capacity: string | null, t: string) => { if (t === "전체") return true; const b = isAC(cat) ? acHpBucket(model) : pmSizeBucket(cat, model, capacity); return t === ETC ? b == null : b === t }
const pmMean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pmTicks = (min: number, max: number, count = 5): number[] => {
  const range = (max - min) || 1, raw = range / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-6; v += step) out.push(v)
  return out
}
const pmShort = (n: number) => (n >= 1000 ? "₱" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : "₱" + Math.round(n))
type PMCard = { b: string; tier: string; label: string; avg: number; shops: number; n: number; star: number | null; kwh: number | null; url: string | null; retailer: string | null; oos: boolean; idx: number; left: number; top: number }
const DOE_CODE: Record<string, string> = { "RAC": "acu", "SAC": "acu", "TV": "tvl", "냉장고": "ref", "세탁기": "cwm" }
const pmNorm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
// DOE 매칭용 카테고리 인지 정규화 — 에어컨(acu)은 리테일의 실내/실외기 프리픽스(HSN·HSU·HSN/U)를
//   DOE 등록코드(HS-12IPX3=HS+숫자)에 맞춰 HS로 접는다. 이 한 줄로 스플릿 AC 매칭 67%→91%.
const doeNorm = (doeCode: string, s: string) => { const n = pmNorm(s); return doeCode === "acu" ? n.replace(/HS[NU]+/g, "HS") : n }
const pmShopLabel = (s: string) => (s === "SM Appliance" ? "SM" : s === "Western Appliances" ? "Western" : s === "Robinsons Appliances" ? "Robinsons" : s)
const pmStarCls = (s: number | null) => (s == null ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500" : s >= 4 ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : s >= 2 ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300")
// 가격대(tier) 라벨·색 — 엔트리=LOW(초록) · 미드=MED(파랑) · 프리미엄(주황)
const pmTierLabel = (t: string) => (t === "프리미엄" ? "프리미엄" : t === "미드" ? "MED" : "LOW")
// 카드 왼쪽 세로 스트립 색 — 가격대 구분(배지 대신)
const pmTierBar = (t: string) => (t === "프리미엄" ? "bg-amber-400 dark:bg-amber-500" : t === "미드" ? "bg-sky-400 dark:bg-sky-500" : "bg-emerald-400 dark:bg-emerald-500")
// 호버 드롭다운 선택 — 좌측 세로 메뉴(마우스 오버로 옵션 펼침)
function PmDrop({ label, sel, options, onSelect }: { label: string; sel: string; options: { k: string; t: string }[]; onSelect: (k: string) => void }) {
  const cur = options.find((o) => o.k === sel)?.t ?? sel
  return (
    <div className="group relative shrink-0">
      <button type="button" className="flex w-full items-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-left transition-colors group-hover:border-indigo-300 dark:group-hover:border-indigo-500/40">
        <span className="shrink-0 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
        <span className="ml-1.5 whitespace-nowrap text-[12px] font-semibold text-gray-800 dark:text-gray-100">{cur}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="shrink-0 text-gray-300 transition-transform duration-200 group-hover:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="invisible absolute left-0 top-[calc(100%-2px)] z-40 max-h-[280px] w-max min-w-full max-w-[280px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {options.map((o) => <button key={o.k} type="button" onClick={() => onSelect(o.k)} className={"block w-full whitespace-nowrap rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " + (o.k === sel ? "bg-indigo-600 font-semibold text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800")}>{o.t}</button>)}
      </div>
    </div>
  )
}

function PositioningMatrix({ rows, elabels, stamp }: { rows: PriceRow[] | null; elabels: EnergyRow[] | null; stamp: string | null }) {
  const [cat, setCat] = React.useState("냉장고")
  const [spec, setSpec] = React.useState("전체")
  const [form, setForm] = React.useState("SxS")   // 유형 기본값(전체 없음) — 냉장고×SxS
  const [stockF, setStockF] = React.useState("전체")
  const [shop, setShop] = React.useState("전체")
  const [q, setQ] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [dling, setDling] = React.useState(false)
  const [logY, setLogY] = React.useState(true)   // 세로축 스케일 기본=로그(가격 범위 넓어 저가 구간 펼침), Auto=선형
  const cardRef = React.useRef<HTMLDivElement>(null)
  const R = rows ?? []
  // 모델명 검색 → 그 모델이 속한 분류(제품·유형)로 자동 이동. 현재 화면에 없고 다른 분류에 있으면 전환.
  React.useEffect(() => {
    const kw = q.trim().toLowerCase()
    if (kw.length < 2) return
    const inCur = R.some((r) => r.category === cat && ((r.model || "") + " " + (r.code || "")).toLowerCase().includes(kw))
    if (inCur) return
    const hit = R.find((r) => PM_CATS.includes(r.category) && ((r.model || "") + " " + (r.code || "")).toLowerCase().includes(kw))
    if (hit) { setCat(hit.category); const f = pmFormOf(hit.category, (hit.model || "") + " " + (hit.capacity || ""), hit.brand); setForm(f ?? pmFormsFor(hit.category)[0] ?? "전체") }
  }, [q, R]) // eslint-disable-line
  // 화면 플롯 높이 940(뉴스처럼 길게). 이미지 다운로드 시엔 이전 PPT 슬라이드 비율(560)로 압축 캡처
  const [H, setH] = React.useState(940)
  const PAD = 18, BOTTOM = 14, CARD_H = 56, CARD_W = 116, GAP = 50, GUT = 50
  const dlPng = React.useCallback(async () => {
    const node = cardRef.current; if (!node) return
    setDling(true); setH(560) // PPT 슬라이드(16:9) 비율로 압축
    await new Promise((r) => setTimeout(r, 380)) // 재렌더+페인트 대기
    try {
      const { toPng } = await import("html-to-image")
      const url = await toPng(node, { pixelRatio: 2.5, backgroundColor: "#ffffff", cacheBust: true, filter: (n) => !(n instanceof HTMLElement && n.dataset.noexport === "1") })
      const a = document.createElement("a")
      a.href = url
      a.download = `LGEPH_가격포지셔닝_${cat}${form !== "전체" ? "_" + form : ""}_${stamp ? String(stamp).slice(0, 10) : "latest"}.png`
      a.click()
    } catch (e) { console.error(e) } finally { setH(940); setDling(false) }
  }, [cat, form, stamp])
  const cats = React.useMemo(() => PM_CATS.filter((c) => R.some((r) => r.category === c)), [R])
  const shopList = React.useMemo(() => Array.from(new Set(R.filter((r) => r.category === cat).map((r) => r.retailer))).filter(Boolean), [R, cat])
  const sizeList = pmSizeList(cat)   // 스펙(사이즈) 축: 에어컨=HP · 냉장고=cu.ft · 세탁기=kg · TV=인치
  const formList = pmFormsFor(cat)   // 유형(형태) 축: 에어컨=창문/벽걸이/스탠드 · 그 외=SEGMENTS(도어/패널/로드)
  const effSpec = spec === "전체" || sizeList.includes(spec) ? spec : "전체"
  const effForm = formList.includes(form) ? form : (formList[0] ?? form)   // 유형 '전체' 없음 → 미매칭 시 첫 유형
  const effShop = shop === "전체" || shopList.includes(shop) ? shop : "전체"
  const exact = effShop !== "전체" // 거래선 지정 시 평균이 아니라 그 거래선 정확 단가

  // DOE 라벨 인덱스 — 모델코드로 에너지등급(★)+전력소비(월kWh) 조인
  const starIdx = React.useMemo(() => {
    const code = DOE_CODE[cat]
    if (!code || !elabels) return [] as { codeN: string; star: number | null; kwh: number | null }[]
    return elabels.filter((e) => e.category === code && e.model && e.model.length >= 5)
      .map((e) => ({ codeN: doeNorm(code, e.model), star: e.star, kwh: e.kwh })).filter((e) => e.codeN.length >= 5)
  }, [elabels, cat])
  // 매칭: DOE코드 ⊆ 모델(정확) OR 모델canon(≥8자) ⊆ DOE코드(DOE 변형접미어 ZTNQ36GNLE0ZUAC1 등 흡수)
  const matchOf = React.useCallback((model: string) => { const dc = DOE_CODE[cat] || ""; const m = doeNorm(dc, model); const cc = doeNorm(dc, canonCode(model, null)); for (const e of starIdx) { if (m.includes(e.codeN)) return e; if (cc.length >= 8 && e.codeN.includes(cc)) return e } return null }, [starIdx, cat])

  // 스펙은 모델(canon)마다 동일 → 같은 모델의 모든 거래선 리스팅의 이름+capacity(구조화 스펙 포함)를 합쳐
  //   하나의 스펙문자열로 만든다. 어느 한 거래선이 서술적 이름/구조화 스펙을 가지면 그 모델 전체가 정확 분류됨(99% 레버).
  const specText = React.useMemo(() => {
    const m: Record<string, string> = {}
    R.forEach((r) => { if (r.category !== cat) return; const cc = canonCode(r.model, r.code); if (!cc) return; m[cc] = (m[cc] || "") + " " + r.model + " " + (r.capacity || "") })
    return m
  }, [R, cat])
  const specOf = React.useCallback((r: PriceRow) => { const cc = canonCode(r.model, r.code); return (cc && specText[cc]) || (r.model + " " + (r.capacity || "")) }, [specText])

  const { cards, brands, ticks, gmin, gmax, plotH } = React.useMemo(() => {
    const f0 = R.filter((r) => r.category === cat && r.p0 != null && (effShop === "전체" || r.retailer === effShop) && pmSizeHit(cat, specOf(r), null, effSpec) && pmFormHit(cat, specOf(r), effForm, r.brand))
    const empty = { cards: [] as PMCard[], brands: [] as string[], ticks: [] as number[], gmin: 0, gmax: 0, plotH: H, count: f0.length, matched: 0 }
    if (f0.length < 3) return empty
    // 가격대는 카테고리별 절대 기준(PM_TIER_BANDS) — 상대백분위 아님
    const tierOf = (p: number) => pmTierOf(cat, p)
    // 브랜드 선정: 리스팅 수 상위 6~8개(제일 큰 브랜드) · null/빈 브랜드 제외 · LG는 항상 맨 오른쪽
    const byB0: Record<string, PriceRow[]> = {}
    f0.forEach((r) => { (byB0[r.brand] = byB0[r.brand] || []).push(r) })
    // n>=1 — 좁은 필터(특정 유형·거래선)에서 리스팅 1개뿐인 브랜드(예: Emcor 벽걸이 Carrier)가 통째로 사라지지 않게
    const bl = Object.entries(byB0).map(([b, list]) => ({ b, n: list.length, avg: pmMean(list.map((x) => x.p0 as number)) })).filter((x) => x.n >= 1 && x.b && x.b.trim() && x.b.toLowerCase() !== "null")
    // 포지셔닝에는 8개만 노출 — 규모(리스팅 수) 상위로 뽑고 LG는 항상 포함
    const cap = 8
    let top = bl.slice().sort((a, b) => b.n - a.n).slice(0, cap)
    if (!top.some((x) => x.b === "LG")) { const lg = bl.find((x) => x.b === "LG"); if (lg) top = [...top.slice(0, cap - 1), lg] }
    const ordered = top.sort((a, b) => a.avg - b.avg).map((x) => x.b)
    const brands = [...ordered.filter((b) => b !== "LG"), ...(ordered.includes("LG") ? ["LG"] : [])] // LG 맨 오른쪽
    const brandSet = new Set(brands)
    const withStar = f0.filter((r) => brandSet.has(r.brand)).map((r) => { const el = matchOf(r.model); return { ...r, star: el ? el.star : null, kwh: el ? el.kwh : null } })
    const matched = withStar.filter((r) => r.star != null).length
    const f = withStar   // 재고 필터는 모델 집계 후(모델 단위 품절 판정) 적용
    if (!f.length) return { ...empty, matched }
    const modeStar = (arr: (number | null)[]) => { const v = arr.filter((x): x is number => x != null); if (!v.length) return null; const m: Record<number, number> = {}; v.forEach((x) => { m[x] = (m[x] || 0) + 1 }); return Number(Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]) }
    // 모델 단위 — 각 모델의 "최저가 리스팅"을 카드로(가격=그 리스팅 가격, 링크·거래선도 동일 리스팅 → 가격↔링크 정확 일치)
    const cards: PMCard[] = []
    brands.forEach((b) => {
      const g: Record<string, typeof f> = {}
      // 카드 병합 키 = canonCode(거래선마다 다른 r.code로 쪼개지지 않게). 같은 모델 = 1카드
      f.filter((r) => r.brand === b && canonCode(r.model, r.code).length >= 5).forEach((r) => { const cc = canonCode(r.model, r.code); (g[cc] = g[cc] || []).push(r) })
      const models = Object.entries(g).map(([code, list]) => {
        const best = list.reduce((a, x) => ((x.p0 ?? Infinity) < (a.p0 ?? Infinity) ? x : a))
        const kwhs = list.map((x) => x.kwh).filter((v): v is number => v != null).sort((a, x) => a - x)
        // 같은 모델(canonCode)로 병합 후 가격 = 최저가 기준(거래선 전체·특정 무관)
        const price = best.p0 as number
        // 재고: 모든 리스팅이 OutOfStock이면 품절(하나라도 InStock이면 재고있음)
        const oos = list.length > 0 && list.every((x) => x.availability === "OutOfStock")
        const label = best.code && best.code.length >= 4 && best.code !== "N/A" && !/^[≈]/.test(best.code) ? best.code : code
        return { code: label, price, url: best.url ?? null, retailer: best.retailer ?? null, shops: new Set(list.map((x) => x.retailer)).size, n: list.length, star: modeStar(list.map((x) => x.star)), kwh: kwhs.length ? kwhs[Math.floor(kwhs.length / 2)] : null, oos }
      }).filter((m) => m.price != null && (stockF === "전체" || (stockF === "재고있음" ? !m.oos : m.oos)))
      // 전체 모델 표시(상위 N 제한 없음) — 취급 거래선↓·가격↑ 순 정렬만 유지
      models.sort((a, b2) => b2.shops - a.shops || a.price - b2.price).forEach((m) => cards.push({ b, tier: tierOf(m.price), label: m.code, avg: m.price, shops: m.shops, n: m.n, star: m.star, kwh: m.kwh, url: m.url, retailer: m.retailer, oos: m.oos, idx: 0, left: 0, top: 0 }))
    })
    if (!cards.length) return { ...empty, matched }
    const cmin = Math.min(...cards.map((c) => c.avg)), cmax = Math.max(...cards.map((c) => c.avg))
    const ticks = pmTicks(cmin, cmax, 4)
    const axMin = Math.min(cmin, ticks[0] ?? cmin), axMax = Math.max(cmax, ticks[ticks.length - 1] ?? cmax)
    // 브랜드별 카드 수에 맞춰 플롯 높이 동적 확장 — 전체 모델 표시 시 세로로 겹치지 않게(최소 H 보장)
    const colN: Record<string, number> = {}
    cards.forEach((c) => { colN[c.b] = (colN[c.b] || 0) + 1 })
    const maxCol = Math.max(1, ...Object.values(colN))
    const plotH = Math.max(H, PAD + BOTTOM + CARD_H + (maxCol - 1) * GAP)
    const lgv = (v: number) => Math.log(Math.max(1, v))
    const topFor = (p: number) => PAD + ((logY ? lgv(axMax) - lgv(p) : axMax - p) / ((logY ? lgv(axMax) - lgv(axMin) : axMax - axMin) || 1)) * (plotH - PAD - BOTTOM - CARD_H)
    const maxTop = plotH - BOTTOM - CARD_H
    cards.forEach((c) => { c.idx = Math.round((c.avg / cmin) * 100); c.top = topFor(c.avg) })
    const cols: Record<string, PMCard[]> = {}
    cards.forEach((c) => { (cols[c.b] = cols[c.b] || []).push(c) })
    Object.values(cols).forEach((list) => { list.sort((a, b) => a.top - b.top); for (let i = 1; i < list.length; i++) if (list[i].top - list[i - 1].top < GAP) list[i].top = Math.min(list[i - 1].top + GAP, maxTop) })
    return { cards, brands, ticks, gmin: axMin, gmax: axMax, plotH, count: f0.length, matched }
  }, [R, cat, effSpec, effForm, effShop, stockF, matchOf, specOf, H, logY]) // eslint-disable-line
  const lgv = (v: number) => Math.log(Math.max(1, v))
  const topFor = (p: number) => PAD + ((logY ? lgv(gmax) - lgv(p) : gmax - p) / ((logY ? lgv(gmax) - lgv(gmin) : gmax - gmin) || 1)) * (plotH - PAD - BOTTOM - CARD_H)
  const brandN = (b: string) => cards.filter((c) => c.b === b).reduce((s, c) => s + c.n, 0)
  const minW = Math.max(1040, GUT + brands.length * 138 + 20)
  const qq = q.trim().toLowerCase()
  return (
    <div className="flex flex-col gap-3" style={{ animation: "fadeUp .5s ease both" }}>
      {/* 상단 가로 필터 — 드롭다운 + 뉴스형 검색 + 최종갱신 */}
      <div className="relative z-20 flex flex-wrap items-center gap-2">
        <div className="w-fit"><PmDrop label="제품" sel={cat} options={cats.map((c) => ({ k: c, t: c }))} onSelect={(k) => { setCat(k); setSpec("전체"); setForm(pmFormsFor(k)[0] ?? "전체"); setShop("전체") }} /></div>
        {formList.length > 0 && <div className="w-fit"><PmDrop label="유형" sel={effForm} options={formList.map((t) => ({ k: t, t }))} onSelect={setForm} /></div>}
        {sizeList.length > 0 && <div className="w-fit"><PmDrop label={isAC(cat) ? "마력" : cat === "TV" ? "화면" : "용량"} sel={effSpec} options={[{ k: "전체", t: "전체" }, ...sizeList.map((t) => ({ k: t, t }))]} onSelect={setSpec} /></div>}
        <div className="w-fit"><PmDrop label="거래선" sel={effShop} options={[{ k: "전체", t: "전체" }, ...shopList.map((s) => ({ k: s, t: pmShopLabel(s) }))]} onSelect={setShop} /></div>
        <div className="w-fit"><PmDrop label="재고" sel={stockF} options={["전체", "재고있음", "재고없음"].map((s) => ({ k: s, t: s }))} onSelect={setStockF} /></div>
        <div className={"group relative ml-auto transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-[300px]" : "w-[200px]")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="모델·브랜드 검색"
            className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="지우기" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 lg:flex">최종 {stamp ? fmtStamp(stamp) : "—"}<span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">CONFIRMED</span></span>
      </div>

      {/* 매트릭스 */}
      <div className="overflow-x-auto">
        <div ref={cardRef} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm" style={{ minWidth: minW }}>
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <span className="h-4 w-1 rounded bg-indigo-500" />
            {(() => { const sp = effSpec !== "전체" ? effSpec : effForm !== "전체" ? effForm : ""; return (
              <span className="text-[25px] font-bold leading-tight text-gray-800 dark:text-gray-100">{cat} <span className="font-semibold text-gray-400 dark:text-gray-500">vs 경쟁사</span> <span className="text-indigo-600 dark:text-indigo-400">{sp ? sp + " " : ""}가격</span></span>
            ) })()}
            <div className="ml-auto flex items-center gap-1.5">
              {/* 세로축 스케일: Auto(선형) / 로그 */}
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 text-[10.5px] font-semibold" title="세로축 가격 스케일 — 로그는 가격대가 넓을 때 저가 구간을 펼쳐 봄">
                <button type="button" onClick={() => setLogY(false)} className={"rounded-md px-2 py-0.5 transition " + (!logY ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400")}>Auto</button>
                <button type="button" onClick={() => setLogY(true)} className={"rounded-md px-2 py-0.5 transition " + (logY ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400")}>로그</button>
              </div>
              <button type="button" onClick={dlPng} disabled={dling} data-noexport="1" title="카드 전체를 PPT 슬라이드 크기 이미지로 저장" className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-[10.5px] font-semibold text-gray-600 dark:text-gray-300 transition hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                {dling ? "생성중…" : "이미지"}
              </button>
            </div>
          </header>

          {/* 브랜드 컬럼 헤더 — 플롯과 동일 구조(px-4 + 게이지 GUT + flex-1)로 1:1 정렬 */}
          <div className="flex border-b-2 border-gray-200 dark:border-gray-700 px-4 py-2">
            <div className="shrink-0" style={{ width: GUT }} />
            <div className="flex flex-1">
              {brands.map((b) => { const lg = b === "LG"; return (
                <div key={b} className="min-w-0 flex-1 px-1 text-center">
                  <div className={"truncate text-[13px] font-extrabold tracking-tight " + (lg ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{b}</div>
                  <div className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">{brandN(b)}개</div>
                </div>
              ) })}
            </div>
          </div>

          {/* 플롯 — 좌 축 게이지 + 브랜드별 세로 레인(카드는 레인 내부에 가격순 배치) */}
          <div key={cat + effSpec + effShop + stockF} className="flex px-4 pb-3 pt-3">
            {cards.length === 0 ? (
              <div className="flex h-44 w-full items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">해당 조건의 데이터가 부족합니다</div>
            ) : (
              <>
                <div className="relative shrink-0" style={{ width: GUT, height: plotH }}>
                  {ticks.map((v) => (
                    <span key={v} className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400" style={{ top: topFor(v) }}>{pmShort(v)}</span>
                  ))}
                  <span className="absolute right-2 top-0 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">고가</span>
                  <span className="absolute right-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500" style={{ bottom: 2 }}>저가</span>
                </div>
                <div className="relative flex-1" style={{ height: plotH }}>
                  {/* 좌측 세로축(absolute → 컬럼 폭에 영향 없음, 정렬 유지) */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 border-l-2 border-gray-200 dark:border-gray-700" />
                  {/* 중간 가격대(MED) 밴드 — 절대 기준(PM_TIER_BANDS) 구간 강조(상·하단 점선 경계 + 옅은 파랑 배경) */}
                  {(() => { const b = PM_TIER_BANDS[cat] || [25000, 60000]; const t = topFor(Math.min(b[1], gmax)); const bot = topFor(Math.max(b[0], gmin)); return <div className="pointer-events-none absolute inset-x-0 border-y border-dashed border-sky-300/70 dark:border-sky-500/30 bg-sky-50/60 dark:bg-sky-500/10" style={{ top: t, height: Math.max(0, bot - t) }} /> })()}
                  {ticks.map((v) => (
                    <div key={v} className="pointer-events-none absolute inset-x-0 border-t border-gray-200/80 dark:border-gray-700/60" style={{ top: topFor(v) }} />
                  ))}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-gray-200 dark:border-gray-700" />
                  {/* 브랜드 컬럼 세로 구분선(가시성) */}
                  {brands.map((b, i) => (i > 0 ? <div key={"v" + b} className="pointer-events-none absolute inset-y-0 border-l border-gray-200/70 dark:border-gray-700/50" style={{ left: (i / brands.length) * 100 + "%" }} /> : null))}
                  <div className="absolute inset-0 flex">
                    {brands.map((b, bi) => { const lg = b === "LG"; return (
                      <div key={b} className={"relative min-w-0 flex-1 " + (lg ? "bg-indigo-50/40 dark:bg-indigo-500/5" : bi % 2 === 1 ? "bg-gray-50/50 dark:bg-gray-800/20" : "")}>
                        {cards.filter((c) => c.b === b).map((c, ci) => { const hit = !qq || (c.b + " " + c.label).toLowerCase().includes(qq); return (
                          <a key={c.label + ci} href={c.url ?? undefined} target={c.url ? "_blank" : undefined} rel="noreferrer"
                            title={`${c.b} · ${c.label} · ${peso(c.avg)}${c.retailer ? " @ " + pmShopLabel(c.retailer) : ""} · ${c.shops}개 유통 취급${c.star != null ? " · New DOE ★" + c.star : ""}${c.kwh != null ? " · " + Math.round(c.kwh) + "kWh/월" : ""}${c.url ? " · 클릭→원문" : ""}`}
                            className={"absolute block overflow-hidden rounded-lg border transition-all duration-200 hover:z-30 hover:shadow-md " + (c.url ? "cursor-pointer " : "cursor-default ") + (qq && !hit ? "opacity-20 " : "") + (qq && hit ? "z-20 ring-2 ring-indigo-500 " : "") + (c.oos ? "border-dashed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 opacity-70 grayscale" : lg ? "z-10 border-transparent bg-indigo-600 text-white shadow-sm" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50")}
                            style={{ top: c.top, left: "50%", marginLeft: -(CARD_W / 2), width: CARD_W, animation: "rowIn .5s cubic-bezier(.22,1,.36,1) both", animationDelay: (Math.min(ci, 8) * 0.03) + "s", willChange: "opacity" }}>
                            {/* 왼쪽 세로 스트립 = 가격대 색(LOW 초록·MED 파랑·프리미엄 주황) — 배지 대체 */}
                            <span className={"absolute inset-y-0 left-0 w-1.5 " + pmTierBar(c.tier)} title={"가격대: " + pmTierLabel(c.tier)} />
                            <div className="pl-2.5 pr-2">
                              {/* 1행 — 모델 서픽스 + 에너지등급(★) */}
                              <div className="flex items-center gap-1 py-0.5">
                                <span className={"truncate text-[9.5px] font-medium " + (c.oos ? "text-gray-400 dark:text-gray-500" : lg ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>{c.label}</span>
                                {c.oos ? <span className="ml-auto shrink-0 rounded bg-gray-300 dark:bg-gray-600 px-1 text-[8px] font-bold leading-4 text-gray-600 dark:text-gray-200">품절</span> : c.star != null && <span className={"ml-auto shrink-0 rounded px-1 text-[8.5px] font-bold leading-4 " + pmStarCls(c.star)}>★{c.star}</span>}
                              </div>
                              {/* 2행 — 가격 + 지수(최저가=100). 가격대는 왼쪽 색 스트립으로 표시 */}
                              <div className={"flex items-center gap-1 border-t py-0.5 " + (lg ? "border-indigo-400/40" : "border-gray-100 dark:border-gray-700/60")}>
                                <span className="text-[13px] font-bold leading-tight tabular-nums">{peso(c.avg)}</span>
                                <span className={"ml-auto tabular-nums text-[9px] font-semibold leading-none " + (lg ? "text-indigo-200" : "text-gray-400 dark:text-gray-500")} title="최저가=100 기준 지수">{c.idx}</span>
                              </div>
                              {/* 3행 — 전력효율(월 소비전력) */}
                              <div className={"flex items-center justify-between gap-1 border-t py-0.5 text-[9px] " + (lg ? "border-indigo-400/40" : "border-gray-100 dark:border-gray-700/60")}>
                                <span className={lg ? "text-indigo-200" : "text-gray-400 dark:text-gray-500"}>전력</span>
                                <span className={"tabular-nums font-semibold " + (lg ? "text-white" : "text-gray-600 dark:text-gray-300")}>{c.kwh != null ? Math.round(c.kwh) + " kWh" : "—"}</span>
                              </div>
                            </div>
                          </a>
                        ) })}
                      </div>
                    ) })}
                  </div>
                </div>
              </>
            )}
          </div>

          <footer className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-600 dark:text-gray-300">New DOE ★</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[9px] font-bold " + pmStarCls(5)}>★5·4</span>고효율</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[9px] font-bold " + pmStarCls(3)}>★3·2</span></span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[9px] font-bold " + pmStarCls(1)}>★1</span>저효율</span>
            <span className="mx-0.5 h-3 w-px bg-gray-200 dark:bg-gray-700" />
            <span className="font-semibold text-gray-600 dark:text-gray-300">가격대</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-1.5 rounded-sm bg-emerald-400 dark:bg-emerald-500" />LOW 〈₱{Math.round((PM_TIER_BANDS[cat]?.[0] ?? 25000) / 10000)}만</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-1.5 rounded-sm bg-sky-400 dark:bg-sky-500" />MED</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-1.5 rounded-sm bg-amber-400 dark:bg-amber-500" />프리미엄 ₱{Math.round((PM_TIER_BANDS[cat]?.[1] ?? 60000) / 10000)}만+</span>
            <span className="ml-auto inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded bg-indigo-600" />자사(LG) · <span className="inline-block h-3 w-4 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />경쟁사</span>
          </footer>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
          세로축 = <b className="text-gray-500 dark:text-gray-300">{exact ? pmShopLabel(effShop) + " 현금가" : "거래선 최저 현금가"}</b>(위=고가) · 가로축 = 브랜드(좌 저가→우 <b className="text-indigo-500 dark:text-indigo-400">LG</b>) · 카드 = 모델별(동일모델 거래선 병합, 우상단 ★=New DOE) · <span className="tabular-nums">( )</span> = 가격지수(최저=100) · 카드 클릭 → 원문
        </p>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">New DOE ★ = <b className="text-gray-500 dark:text-gray-400">2026 개정 에너지효율등급</b>(energy_labels 모델코드 {DOE_CODE[cat] || "-"} 매칭) · 가격 데이터 <b className="tabular-nums">{stamp ? fmtStamp(stamp) : "—"}</b> 기준 조인</p>
        <p className="mt-1 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
          ※ 유형·스펙 분류는 유통 상품속성·모델명에서 추출(모델 단위로 전 거래선 공유). <b className="font-semibold text-gray-500 dark:text-gray-400">정확도 전브랜드 유형 96%·스펙 93%(자사 LG 96%·91%)</b> · 분류 안 되는 잔여는 <b className="font-semibold">기타</b>로 노출돼 필터에서 사라지지 않음 · 가격·스펙·프로모는 수집 가능하나 판매량·점유율은 GfK 패널(비공개) 필요
        </p>
      </div>
    </div>
  )
}

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
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="text-gray-300 dark:text-gray-600 transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[280px] w-[190px] overflow-auto rounded-[10px] border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
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
        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors " +
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
function PromoView({ rows, camps }: { rows: PromoIntensity[] | null; camps: PromoCampaign[] }) {
  if (rows === null) {
    return <div className="flex min-h-[440px] items-center justify-center text-[13px] text-gray-400 dark:text-gray-500">불러오는 중</div>
  }
  if (rows.length === 0) {
    return <div className="flex min-h-[440px] items-center justify-center text-[13px] text-gray-400 dark:text-gray-500">데이터 없음</div>
  }
  const wow = (n: number) => (n > 0 ? "+" + n : String(n))
  const tone = (n: number) =>
    n > 0 ? "text-rose-600 dark:text-rose-400" : n < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/70 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
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
                className="border-b border-gray-50 dark:border-gray-800 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
                style={{ animation: "rowIn .3s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 22 + "ms" }}
              >
                <td className={"px-3 py-2 font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>
                  {r.brand}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.retailer}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                  {r.promoModels}
                  <span className="text-[10px] text-gray-400 dark:text-gray-500"> / {r.listedModels}</span>
                </td>
                <td className={"px-3 py-2 text-right tabular-nums font-semibold " + tone(r.promoModelsWow)}>
                  {wow(r.promoModelsWow)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
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
          <p className="mb-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-200">유통 캠페인 (진행 중)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {camps.map((c) => (
              <a
                key={c.retailer + c.title}
                href={c.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 transition-all duration-200 hover:-translate-y-px hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-sm"
              >
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{c.retailer}</p>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50">{c.title}</p>
                <p className="mt-1 text-[11.5px] text-gray-600 dark:text-gray-300">
                  {c.liveDiscounted !== null && <span>할인 {c.liveDiscounted}종 · 평균 {c.avgDiscount}% · 최대 {c.maxDiscount}%</span>}
                  {c.onSaleCount !== null && <span>세일 중 {c.onSaleCount.toLocaleString()}종</span>}
                </p>
                {c.brands.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500">{c.brands.join(" · ")}</p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        프로모 모델 = 할인가 또는 프로모 문구가 걸린 리스팅 · 전주 대비는 7일 전 대비 변화
        <br />
        Anson&apos;s는 정가 필드가 세일가로 표기돼 비중이 항상 100% — 판단은 전주 대비 변화와 평균 할인율 기준
      </p>
    </div>
  )
}

/** 프로모 딜 — v_competitor_promo 실딜 리스트. 유통별 프로모(할인율·무료배송·쿠폰·번들·할부)를
 *  태그로 분류해 필터·정렬. 브랜드 화이트리스트만. 카드 클릭 → 원문. */
// 프로모 종류(컬럼 순서 고정): 쿠폰·번들·할부·배송·사은품
const PTYPES: { k: "c" | "b" | "i" | "f" | "g"; label: string; cls: string }[] = [
  { k: "c", label: "쿠폰", cls: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  { k: "b", label: "번들", cls: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  { k: "i", label: "할부", cls: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { k: "f", label: "배송", cls: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { k: "g", label: "사은품", cls: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300" },
]
// 프로모 문구 → 종류별 상세({c,b,i,f,g})
const promoTypes = (txt: string | null): Partial<Record<string, string>> => {
  const s = txt || ""; const o: Partial<Record<string, string>> = {}
  const inst = s.match(/x\s*(\d+)\s*mos|(\d+)\s*개월/i); if (inst || /installment|무이자|0 ?% ?install/i.test(s)) o.i = inst ? `${inst[1] || inst[2]}개월` : "무이자"
  if (/free ?ship|free ?deliv|무료 ?배송/i.test(s)) o.f = "무료배송"
  const gift = s.match(/with\s+(?:a\s+)?free\s+([^·|,]{2,24})/i); if (gift) o.g = gift[1].replace(/&#\d+;.*/, "").trim().slice(0, 16)
  if (/coupon|voucher|쿠폰|promo ?code/i.test(s)) o.c = "쿠폰"
  if (/bundle|번들/i.test(s)) o.b = "번들"
  return o
}
type SCOffer = { cc: string; brand: string; own: boolean; model: string; at: string | null; list: number | null; net: number; url: string | null; promoByRet: Record<string, Partial<Record<string, string>>> }
/** 동일 스펙 경쟁사 비교 — 유형(+용량) 고정, 브랜드=행·프로모 종류별 컬럼(쿠폰·번들·할부·배송·사은품).
 *  제품사진·유형/용량/브랜드 필터·가격대 이중 슬라이더·vs 자사·시사점. 레이아웃: Claude Design `spec-compare-photo.reference.html`. */
function DealsView({ rows, deals }: { rows: PriceRow[] | null; deals: DealRow[] | null }) {
  const [cat, setCat] = React.useState("냉장고")
  const [form, setForm] = React.useState("SxS")
  const [size, setSize] = React.useState("전체")
  const [brand, setBrand] = React.useState("전체")
  const [rmin, setRmin] = React.useState(0)
  const [rmax, setRmax] = React.useState(0)
  const R = rows ?? []
  const cats = React.useMemo(() => { const av = PM_CATS.filter((c) => R.some((r) => r.category === c)); return av.length ? av : PM_CATS }, [R])
  const formList = pmFormsFor(cat)
  const effForm = formList.includes(form) ? form : (formList[0] ?? "전체")
  const sizes = pmSizeList(cat)
  const effSize = size === "전체" || sizes.includes(size) ? size : "전체"
  // 프로모 문구 조회: canonCode|retailer → promo_text
  const promoLU = React.useMemo(() => { const m: Record<string, string> = {}; (deals ?? []).forEach((d) => { const k = canonCode(d.model, null) + "|" + d.retailer; if (!m[k] && d.promo) m[k] = d.promo }); return m }, [deals])

  // 세그먼트 = 현재 유형(cat+form)의 모델별 최저오퍼(용량/브랜드/가격 필터 이전) — 슬라이더 도메인·자사기준용
  const segment = React.useMemo(() => {
    const g: Record<string, PriceRow[]> = {}
    R.forEach((r) => { if (r.category !== cat || r.p0 == null) return; if (!pmFormHit(cat, r.model + " " + (r.capacity || ""), effForm, r.brand)) return; const cc = canonCode(r.model, r.code); if (cc.length < 5) return; (g[cc] = g[cc] || []).push(r) })
    return Object.entries(g).map(([cc, list]) => {
      const best = list.reduce((a, x) => ((x.p0 ?? Infinity) < (a.p0 ?? Infinity) ? x : a))
      const srps = list.map((x) => x.srp).filter((v): v is number => v != null)
      const promoByRet: Record<string, Partial<Record<string, string>>> = {}
      Array.from(new Set(list.map((x) => x.retailer))).forEach((ret) => { const p = promoLU[cc + "|" + ret]; if (p) promoByRet[ret] = promoTypes(p) })
      const label = best.code && best.code.length >= 4 && best.code !== "N/A" && !/^[≈]/.test(best.code) ? best.code : cc
      return { cc, brand: best.brand, own: best.brand === "LG", model: label, at: best.retailer ?? null, list: srps.length ? Math.max(...srps) : null, net: best.p0 as number, url: best.url ?? null, promoByRet, _size: pmSizeBucket(cat, best.model, best.capacity) } as SCOffer & { _size: string | null }
    })
  }, [R, cat, effForm, promoLU])

  const brandsL = React.useMemo(() => ["전체", ...Array.from(new Set(segment.map((o) => o.brand))).filter(Boolean)], [segment])
  const dom = React.useMemo(() => {
    const vals = segment.filter((o) => effSize === "전체" || o._size === effSize).map((o) => o.net)
    if (!vals.length) return [0, 0] as [number, number]
    const lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max(1000, Math.round((hi - lo) * 0.2 / 1000) * 1000)
    return [Math.floor((lo - pad) / 1000) * 1000, Math.ceil((hi + pad) / 1000) * 1000] as [number, number]
  }, [segment, effSize])
  // 도메인 바뀌면(유형·용량 변경) 범위 리셋
  const domKey = cat + "|" + effForm + "|" + effSize + "|" + dom[0] + "|" + dom[1]
  const domKeyRef = React.useRef("")
  React.useEffect(() => { if (domKeyRef.current !== domKey) { domKeyRef.current = domKey; setRmin(dom[0]); setRmax(dom[1]) } }, [domKey, dom])

  const lgRef = React.useMemo(() => { const lgs = segment.filter((o) => o.own && (effSize === "전체" || o._size === effSize)); return lgs.length ? lgs.reduce((a, x) => (x.net < a.net ? x : a)) : null }, [segment, effSize])
  const list = React.useMemo(() => segment.filter((o) => (effSize === "전체" || o._size === effSize) && (brand === "전체" || o.brand === brand) && o.net >= rmin && o.net <= rmax).sort((a, b) => a.net - b.net), [segment, effSize, brand, rmin, rmax])
  const best = list.length ? list[0].net : 0

  // 가격대 슬라이더(포인터 드래그)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const rangeRef = React.useRef({ lo: rmin, hi: rmax }); rangeRef.current = { lo: rmin, hi: rmax }
  const pct = (v: number) => (dom[1] === dom[0] ? 0 : ((v - dom[0]) / (dom[1] - dom[0])) * 100)
  const startDrag = (isLo: boolean) => (e: React.PointerEvent) => {
    e.preventDefault(); const track = trackRef.current; if (!track) return
    const gap = Math.max(1000, (dom[1] - dom[0]) * 0.03)
    const move = (ev: PointerEvent) => { const r = track.getBoundingClientRect(); let t = (ev.clientX - r.left) / r.width; t = Math.max(0, Math.min(1, t)); const v = Math.round((dom[0] + t * (dom[1] - dom[0])) / 500) * 500; if (isLo) setRmin(Math.max(dom[0], Math.min(v, rangeRef.current.hi - gap))); else setRmax(Math.min(dom[1], Math.max(v, rangeRef.current.lo + gap))) }
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up) }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up)
  }

  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[13px] text-gray-400 dark:text-gray-500">불러오는 중</div>

  const won = (n: number | null) => peso(n)
  const gapCell = (o: SCOffer) => o.own ? <span className="text-gray-300 dark:text-gray-600">기준</span> : !lgRef ? <span className="text-gray-300">—</span> : (o.net - lgRef.net) > 0 ? <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{won(o.net - lgRef.net)}</span> : <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{won(o.net - lgRef.net)}</span>
  const promoAt = (o: SCOffer, k: string): { val: string; at: string; other: boolean } | null => {
    if (o.at && o.promoByRet[o.at] && o.promoByRet[o.at][k]) return { val: o.promoByRet[o.at][k] as string, at: o.at, other: false }
    for (const ret of Object.keys(o.promoByRet)) { if (o.promoByRet[ret][k]) return { val: o.promoByRet[ret][k] as string, at: ret, other: true } }
    return null
  }
  const lgRank = list.findIndex((o) => o.own) + 1
  const cheaper = list.filter((o) => !o.own && lgRef && o.net < lgRef.net)
  const lgTypes = new Set(lgRef ? Object.keys(lgRef.promoByRet[lgRef.at ?? ""] || {}) : [])
  const rivalOnly = PTYPES.filter((p) => !lgTypes.has(p.k) && list.some((o) => !o.own && promoAt(o, p.k)))
  const win = lgRank === 1 && !!lgRef

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <span className="h-4 w-1 rounded bg-indigo-500" />
        <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">동일 스펙 경쟁사 비교</h2>
        <span className="rounded border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-600 dark:text-rose-400">INTERNAL USE ONLY</span>
        <div className="ml-auto flex items-center gap-1"><span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">종류</span>{PTYPES.map((p) => <span key={p.k} className={"rounded px-1 py-px text-[10px] font-bold " + p.cls}>{p.label}</span>)}</div>
      </header>
      {/* 필터 */}
      <div className="space-y-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="w-fit"><PmDrop label="제품" sel={cat} options={cats.map((c) => ({ k: c, t: c }))} onSelect={(k) => { setCat(k); setForm(pmFormsFor(k)[0] ?? "전체"); setSize("전체"); setBrand("전체") }} /></div>
          {formList.length > 0 && <div className="w-fit"><PmDrop label="유형" sel={effForm} options={formList.map((t) => ({ k: t, t }))} onSelect={(k) => { setForm(k); setBrand("전체") }} /></div>}
          <div className="w-fit"><PmDrop label={isAC(cat) ? "마력" : cat === "TV" ? "화면" : "용량"} sel={effSize} options={["전체", ...sizes].map((t) => ({ k: t, t }))} onSelect={setSize} /></div>
          <div className="w-fit"><PmDrop label="브랜드" sel={brand} options={brandsL.map((b) => ({ k: b, t: b }))} onSelect={setBrand} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="w-9 shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">가격대</span>
          <span className="w-[70px] shrink-0 text-right text-[12px] font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{won(rmin)}</span>
          <div ref={trackRef} className="relative h-6 w-[320px] shrink-0 select-none">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-indigo-500" style={{ left: pct(rmin) + "%", width: (pct(rmax) - pct(rmin)) + "%" }} />
            <div className="pointer-events-none absolute inset-0">{segment.filter((o) => effSize === "전체" || o._size === effSize).map((o, i) => { const inR = o.net >= rmin && o.net <= rmax; return <span key={i} className={"absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full " + (o.own ? "bg-indigo-500" : "bg-gray-400") + (inR ? "" : " opacity-25")} style={{ left: pct(o.net) + "%" }} /> })}</div>
            <div onPointerDown={startDrag(true)} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-indigo-500 bg-white dark:bg-gray-900 shadow" style={{ left: pct(rmin) + "%" }} />
            <div onPointerDown={startDrag(false)} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-indigo-500 bg-white dark:bg-gray-900 shadow" style={{ left: pct(rmax) + "%" }} />
          </div>
          <span className="w-[70px] shrink-0 text-[12px] font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{won(rmax)}</span>
          <button type="button" onClick={() => { setRmin(dom[0]); setRmax(dom[1]) }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-white dark:hover:bg-gray-800">초기화</button>
          <p className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">{lgRef ? <>자사 <b className="text-indigo-700 dark:text-indigo-300">{lgRef.model}</b> 기준</> : "자사 모델 없음"} · <b className="tabular-nums">{won(rmin)}~{won(rmax)}</b></p>
        </div>
      </div>
      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-[12px]">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">제품</th>
              <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">브랜드 · 모델</th>
              <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">최저 채널</th>
              <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">실판매가</th>
              <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">할인율</th>
              <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">vs 자사</th>
              {PTYPES.map((p) => <th key={p.k} className="border-b border-l border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">{p.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-[12px] text-gray-400 dark:text-gray-500">선택한 유형·용량·가격대에 해당하는 제품이 없습니다.</td></tr>
            ) : list.slice(0, 60).map((o, ri) => {
              const isBest = o.net === best, disc = o.list != null && o.list > o.net ? Math.round((o.list - o.net) / o.list * 100) : 0
              return (
                <tr key={o.cc + ri} className={"border-b border-gray-100 dark:border-gray-800/60 last:border-0 " + (o.own ? "bg-indigo-50/40 dark:bg-indigo-500/5" : "hover:bg-gray-50 dark:hover:bg-gray-800/40")}>
                  <td className="px-3 py-2.5"><div className={"flex h-12 w-12 items-center justify-center rounded-lg border text-[13px] font-bold " + (o.own ? "border-indigo-200 dark:border-indigo-500/40 text-indigo-500" : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500") + " bg-white dark:bg-gray-900"}>{o.brand.slice(0, 2)}</div></td>
                  <td className={"whitespace-nowrap px-3 py-2.5 " + (o.own ? "border-r border-indigo-100 dark:border-indigo-500/20" : "")}>
                    <span className="flex items-center gap-1.5">{o.own ? <span className="h-3.5 w-1 rounded bg-indigo-500" /> : null}<span className={"font-bold " + (o.own ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{o.brand}</span>{o.own ? <span className="rounded bg-indigo-100 dark:bg-indigo-500/20 px-1 py-px text-[10px] font-bold text-indigo-600 dark:text-indigo-300">자사</span> : isBest ? <span className="rounded bg-emerald-500 px-1 py-px text-[10px] font-bold text-white">최저가</span> : null}</span>
                    <span className={"mt-0.5 block " + (o.own ? "pl-2.5" : "")}>{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-[10px] tabular-nums text-indigo-600 hover:underline dark:text-indigo-400">{o.model}</a> : <span className="text-[10px] tabular-nums text-gray-400">{o.model}</span>}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{o.at ? pmShopLabel(o.at) : "—"}</td>
                  <td className="px-3 py-2.5 text-right"><span className={"tabular-nums font-bold " + (o.own ? "text-indigo-700 dark:text-indigo-300" : isBest ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-gray-50")}>{won(o.net)}</span>{o.list != null && o.list > o.net ? <div className="text-[10px] tabular-nums text-gray-400 line-through dark:text-gray-500">{won(o.list)}</div> : null}</td>
                  <td className="px-3 py-2.5 text-center">{disc > 0 ? <span className="rounded bg-rose-50 dark:bg-rose-500/10 px-1 py-px text-[10px] font-bold tabular-nums text-rose-600 dark:text-rose-400">-{disc}%</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{gapCell(o)}</td>
                  {PTYPES.map((p) => { const pa = promoAt(o, p.k); return <td key={p.k} className="border-l border-gray-100 dark:border-gray-800 px-3 py-2.5">{pa ? <><span className={"inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold " + p.cls}>{pa.val}</span>{pa.other ? <span className="mt-0.5 block text-[10px] text-amber-600 dark:text-amber-400">↳ {pmShopLabel(pa.at)}</span> : null}</> : <span className="text-[12px] text-gray-300 dark:text-gray-600">—</span>}</td> })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* 시사점 */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2.5">
        {lgRef ? (
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed">
            <span className={"mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white " + (win ? "bg-emerald-600" : "bg-rose-500")}>LG 시사점</span>
            {win ? <span className="text-emerald-800 dark:text-emerald-300">자사 <b>최저가</b> · 할인율 {lgRef.list != null && lgRef.list > lgRef.net ? Math.round((lgRef.list - lgRef.net) / lgRef.list * 100) : 0}%. {rivalOnly.length ? <>단, 경쟁사만 제공하는 <b>{rivalOnly.map((p) => p.label).join("·")}</b> 확인 — 프로모 구성 보완.</> : "프로모 스택도 우위."}</span>
              : <span className="text-rose-700 dark:text-rose-300">자사 <b>{lgRank > 0 ? lgRank + "위" : "범위 밖"}</b>{cheaper.length ? <> · 더 싼 경쟁사 <b>{cheaper.map((c) => c.brand).join(", ")}</b>(최저 −{won(lgRef.net - best)})</> : ""}. {rivalOnly.length ? <>경쟁사만 주는 <b>{rivalOnly.map((p) => p.label).join("·")}</b>도 열세 — 대응 필요.</> : "가격 대응 우선."}</span>}
          </p>
        ) : <p className="text-[11px] text-gray-400 dark:text-gray-500">이 유형·용량에 자사(LG) 모델이 없어 vs 자사 비교를 생략합니다.</p>}
      </div>
    </div>
  )
}

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
  const [priceOpen, setPriceOpen] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "deltaPct", asc: true })
  const [promo, setPromo] = React.useState<PromoIntensity[] | null>(null)
  const [camps, setCamps] = React.useState<PromoCampaign[]>([])
  const [deals, setDeals] = React.useState<DealRow[] | null>(null)
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
    competitorDaily()
      .then(setDaily)
      .catch(() => setDaily([]))
    promoIntensity(14)
      .then(setPromo)
      .catch(() => setPromo([]))
    promoCampaigns()
      .then(setCamps)
      .catch(() => setCamps([]))
    promoDeals()
      .then((ds) => setDeals(ds.filter((r) => brandShown(r.brand, r.category))))
      .catch(() => setDeals([]))
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
    <div className="mx-auto max-w-[1536px] px-4 pb-10 pt-4 sm:px-6">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"}</style>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside style={{ animation: "fadeUp .5s ease both" }} className="h-fit rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm lg:sticky lg:top-[61px]">
          {/* 좌 메뉴 — 뉴스·경쟁사 광고 사이드바와 동일한 구조(아이콘 헤더·그룹 라벨·우측 상태 메타) */}
          <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
            <p className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">분석</p>
          </div>
          <div className="px-3 py-3">
            <div className="flex flex-col gap-0.5">
              {GROUPS.map((g) => (
                <React.Fragment key={g.group}>
                  <p className="mb-1 mt-2.5 px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 first:mt-0">{g.group}</p>
                  {g.items.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setView(it.key)}
                      className={
                        "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                        (view === it.key ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10")
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={"flex-1 truncate text-[13px] transition-colors duration-300 " + (view === it.key ? "font-semibold text-indigo-700 dark:text-indigo-300" : "font-medium text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400")}>{it.label}</span>
                        {it.status === "live"
                          ? <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-px text-[9px] font-bold text-emerald-600 dark:text-emerald-400">LIVE</span>
                          : <span className="shrink-0 text-[9.5px] font-medium text-gray-400 dark:text-gray-500">예정</span>}
                      </span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5">
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
              className="w-full rounded-md border border-gray-200 dark:border-gray-800 py-1.5 text-[12px] text-gray-600 dark:text-gray-300 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-[.98]"
            >
              필터 초기화
            </button>
          </div>
        </aside>

        <div style={{ animation: "fadeUp .5s ease both" }} className="flex min-h-[1200px] min-w-0 flex-col gap-4">
        {view === "movers" ? (() => {
          const R = rows || []
          const cu = R.filter((r) => (r.deltaPct ?? 0) < 0).length
          const hi = R.filter((r) => (r.deltaPct ?? 0) > 0).length
          const nMoved = cu + hi
          const total = R.length
          const lgDisc = avg(R.filter((r) => r.brand === "LG"), (r) => r.discountPct)
          const cxDisc = avg(R.filter((r) => r.brand !== "LG"), (r) => r.discountPct)
          return (
            <div onClick={() => setPriceOpen((v) => !v)} className="group cursor-pointer select-none overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 dark:from-indigo-500/10 via-indigo-50/40 dark:via-transparent to-white dark:to-gray-900 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
                </div>
                <span className="shrink-0 text-[12px] font-bold text-gray-900 dark:text-gray-50">가격 읽기</span>
                {!priceOpen && (
                  <div className="min-w-0 flex-1 truncate text-[13px] text-gray-700 dark:text-gray-200">
                    {nMoved === 0 ? (
                      <><b className="font-semibold text-gray-900 dark:text-gray-50">시장 가격 보합</b> — 관측 {total}개 중 오늘 변동 없음 · LG 할인 {pct(lgDisc)} vs 경쟁 {pct(cxDisc)}</>
                    ) : (
                      <><b className="font-semibold text-gray-900 dark:text-gray-50">오늘 변동 {nMoved}건</b> (인하 {cu}·인상 {hi}) — 관측 {total}개 · LG 할인 {pct(lgDisc)} vs 경쟁 {pct(cxDisc)}</>
                    )}
                  </div>
                )}
                <span className="ml-auto shrink-0 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">더보기 <span className={"inline-block transition-transform " + (priceOpen ? "rotate-180" : "")}>▾</span></span>
              </div>
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: priceOpen ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <div className="border-t border-indigo-100/70 dark:border-indigo-500/25 px-4 pb-3.5 pt-3">
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-500 dark:text-gray-400">
                      <span>관측 <b className="text-gray-800 dark:text-gray-100">{total}</b></span>
                      <span>오늘 변동 <b className="text-gray-800 dark:text-gray-100">{nMoved}건</b> (인하 {cu}·인상 {hi})</span>
                      <span>LG 할인 <b className="text-gray-800 dark:text-gray-100">{pct(lgDisc)}</b> vs 경쟁 {pct(cxDisc)}</span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">관측 <b className="text-gray-900 dark:text-gray-50">{total}개 리스팅</b> 기준, 오늘 가격 변동은 <b className="text-gray-900 dark:text-gray-50">{nMoved}건</b>(인하 {cu}·인상 {hi}). LG 자사 리스팅 평균 할인율은 <b className="text-gray-900 dark:text-gray-50">{pct(lgDisc)}</b>로 경쟁({pct(cxDisc)})과 비교됩니다.</p>
                    <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-indigo-700 dark:text-indigo-300"><span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 시사점</span><span>변동 건수·폭과 경쟁사 SRP 복귀 시점을 주시. 대량 인하 신호 유무로 성수기 프로모 개시 타이밍을 판단.</span></p>
                  </div>
                </div>
              </div>
            </div>
          )
        })() : null}
        <section
          key={view}
          className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
          style={{ animation: "viewIn .42s cubic-bezier(.16,1,.3,1) both" }}
        >
          {view !== "movers" && view !== "asp" && view !== "board" && (<header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
            <h2 className="flex items-baseline gap-2 text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {active?.label}
              <span className={"rounded border px-1 py-px text-[9px] font-semibold " + BADGE[active?.status ?? "plan"].c}>
                {BADGE[active?.status ?? "plan"].t}
              </span>
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              최종 갱신 {stamp ? fmtStamp(stamp) : md(asOf)}
              <span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                CONFIRMED
              </span>
            </span>
          </header>)}

          {view === "board" ? (
            <BoardView daily={daily} stamp={stamp} elabels={elabels} />
          ) : view === "asp" ? (
            <PositioningMatrix rows={rows} elabels={elabels} stamp={stamp} />
          ) : view === "promo" ? (
            <PromoView rows={promo} camps={camps} />
          ) : view === "deals" ? (
            <DealsView rows={rows} deals={deals} />
          ) : active?.status !== "live" ? (
            <div className="flex min-h-[440px] flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">{active?.desc}</p>
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
                  <div className="relative">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
                    <input value={q} onChange={(ev) => setQ(ev.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="모델코드·모델명 검색" className={"rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-3 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] " + (focused || q ? "w-[360px]" : "w-[260px]")} />
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500"><b className="text-gray-700 dark:text-gray-200">{data.length}</b>행{stamp ? " · 최종 " + fmtStamp(stamp) : ""} <span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">CONFIRMED</span></span>
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
          )}
        </section>
        </div>
      </div>
    </div>
  )
}
