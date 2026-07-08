"use client"

import React from "react"
import { rangeRows, competitorTv, latestNews } from "@/lib/supabase"

export type PeriodValue = "previous-period" | "last-year" | "no-comparison"
export type KpiEntry = {
  title: string
  percentage: number
  current: number
  allowed: number
  unit?: string
}
export type KpiEntryExtended = Omit<KpiEntry, "current" | "allowed" | "unit"> & {
  value: string
  color: string
}

const IND = "#6366f1"
const GRY = "#b4b2a9"
const SURFACE = "#f9fafb"
const GRID = "#eceef1"

function niceScale(vals: number[], div = 5) {
  let mn = Math.min(...vals)
  let mx = Math.max(...vals)
  if (mn === mx) { mn -= 1; mx += 1 }
  const pad = (mx - mn) * 0.1
  const lo = mn - pad
  const hi = mx + pad
  const dec = hi - lo < 20 ? 1 : 0
  const ticks: number[] = []
  for (let i = 0; i <= div; i++) ticks.push(lo + ((hi - lo) * i) / div)
  return { lo, hi, ticks, dec }
}

type Series = {
  cur: number[]
  prev?: number[]
  labels: string[]
  unit?: string
  curName?: string
  prevName?: string
  decimals?: number
}

function ProChart(p: Series) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const svg = svgRef.current
    const tip = tipRef.current
    if (!svg || !tip) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    tip.innerHTML = ""

    const NS = "http://www.w3.org/2000/svg"
    const dec = p.decimals ?? 1
    const unit = p.unit ?? ""
    const labels = p.labels
    const slots = labels.length
    const hasPrev = !!(p.prev && p.prev.length)
    const all = [...p.cur, ...(p.prev ?? [])].filter((v) => Number.isFinite(v))
    if (!all.length) return
    const { lo, hi, ticks } = niceScale(all)
    const L = 36, R = 292, T = 8, B = 80
    const X = (i: number) => (slots <= 1 ? (L + R) / 2 : L + (i / (slots - 1)) * (R - L))
    const Y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T)
    const el = (n: string, a: Record<string, string | number>): SVGElement => {
      const e = document.createElementNS(NS, n) as SVGElement
      for (const k in a) e.setAttribute(k, String(a[k]))
      return e
    }

    ticks.forEach((t) => {
      svg.appendChild(el("line", { x1: L, y1: Y(t), x2: R, y2: Y(t), stroke: GRID, "stroke-width": 1 }))
      const tx = el("text", { x: L - 6, y: Y(t) + 3, "text-anchor": "end", "font-size": 9, fill: "#9ca3af" })
      tx.textContent = t.toFixed(1)
      svg.appendChild(tx)
    })
    const everyN = slots <= 8 ? 1 : slots <= 16 ? 2 : Math.ceil(slots / 7)
    labels.forEach((lb, i) => {
      if (!lb || (slots - 1 - i) % everyN !== 0) return
      const tx = el("text", { x: X(i), y: B + 13, "text-anchor": "middle", "font-size": 9, fill: "#9ca3af" })
      tx.textContent = lb
      svg.appendChild(tx)
    })

    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: "#c3c8d0", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 })
    svg.appendChild(cross)

    const base = slots <= 7 ? 4 : 3
    const drawSeries = (vals: number[], color: string, w: number, draw: boolean) => {
      const pts = vals.map((v, i) => [X(i), Y(v)])
      const pl = el("polyline", {
        points: pts.map((pp) => pp[0].toFixed(1) + "," + pp[1].toFixed(1)).join(" "),
        fill: "none", stroke: color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round",
      })
      svg.appendChild(pl)
      if (draw) {
        const len = (pl as unknown as SVGPolylineElement).getTotalLength()
        pl.style.strokeDasharray = String(len)
        pl.style.strokeDashoffset = String(len)
        pl.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.22,1,.36,1)"
        pl.style.transitionDelay = "0.18s"
        requestAnimationFrame(() => requestAnimationFrame(() => { pl.style.strokeDashoffset = "0" }))
      }
      return pts.map((pp) => {
        const c = el("circle", { cx: pp[0].toFixed(1), cy: pp[1].toFixed(1), r: base, fill: SURFACE, stroke: color, "stroke-width": 1.5 })
        svg.appendChild(c)
        return { c, r: base }
      })
    }
    const dPrev = hasPrev ? drawSeries(p.prev as number[], GRY, 1.6, true) : null
    const dCur = drawSeries(p.cur, IND, 2, true)

    const ttm = document.createElement("div")
    ttm.className = "mb-1 text-[11px] text-gray-400"
    tip.appendChild(ttm)
    let bPrev: HTMLElement | null = null
    if (hasPrev) {
      const rp = document.createElement("div")
      rp.className = "flex items-center justify-between gap-3 text-xs"
      const sp = document.createElement("span")
      sp.className = "text-gray-500"
      sp.textContent = p.prevName ?? "전년"
      bPrev = document.createElement("b")
      bPrev.className = "tabular-nums font-medium text-gray-500"
      rp.appendChild(sp)
      rp.appendChild(bPrev)
      tip.appendChild(rp)
    }
    const rc = document.createElement("div")
    rc.className = "mt-0.5 flex items-center justify-between gap-3 text-xs"
    const sc = document.createElement("span")
    sc.className = "text-gray-500"
    sc.textContent = p.curName ?? "값"
    const bCur = document.createElement("b")
    bCur.className = "tabular-nums font-medium text-indigo-600"
    rc.appendChild(sc)
    rc.appendChild(bCur)
    tip.appendChild(rc)

    const tween = (node: HTMLElement, to: number) => {
      const from = parseFloat(node.getAttribute("data-v") || "0")
      const t0 = performance.now()
      node.setAttribute("data-v", String(to))
      const stepFn = (t: number) => {
        const k = Math.min((t - t0) / 300, 1)
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        node.textContent = (from + (to - from) * e).toFixed(dec) + unit
        if (k < 1) requestAnimationFrame(stepFn)
      }
      requestAnimationFrame(stepFn)
    }

    let active = -1, shown = false
    let curX = X(0), tgtX = X(0), curTop = 0, tgtTop = 0, crossOp = 0, tgtOp = 0
    let rectW = 300, rectH = 165, raf = 0

    const setActive = (i: number) => {
      if (i === active) return
      active = i
      ttm.textContent = labels[i] ?? ""
      const tops: number[] = []
      if (bPrev && p.prev && i < p.prev.length) { tween(bPrev, p.prev[i]); tops.push(Y(p.prev[i])) }
      if (i < p.cur.length) { tween(bCur, p.cur[i]); tops.push(Y(p.cur[i])) } else { bCur.textContent = "—" }
      tgtTop = tops.length ? Math.min(...tops) : B
    }

    const loop = () => {
      curX += (tgtX - curX) * 0.28
      curTop += (tgtTop - curTop) * 0.28
      crossOp += (tgtOp - crossOp) * 0.25
      cross.setAttribute("x1", curX.toFixed(1))
      cross.setAttribute("x2", curX.toFixed(1))
      cross.setAttribute("opacity", crossOp.toFixed(2))
      const both = dPrev ? [dPrev, dCur] : [dCur]
      both.forEach((ds) => {
        ds.forEach((o, j) => {
          const tr = shown && j === active ? (ds === dCur ? base + 2.6 : base + 2) : base
          o.r += (tr - o.r) * 0.3
          o.c.setAttribute("r", o.r.toFixed(2))
          const act = shown && j === active
          o.c.setAttribute("fill", act ? (ds === dCur ? IND : GRY) : SURFACE)
        })
      })
      const sx = rectW / 300, sy = rectH / 100
      tip.style.left = (curX * sx).toFixed(1) + "px"
      tip.style.top = (curTop * sy - 14).toFixed(1) + "px"
      tip.style.transform = "translate(-50%,-100%)"
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect()
      rectW = rect.width
      rectH = rect.height
      const px = ((e.clientX - rect.left) / rect.width) * 300
      const xi = (px - L) / (R - L) * (slots - 1)
      const i = Math.max(0, Math.min(slots - 1, Math.round(xi)))
      tgtX = X(Math.max(0, Math.min(slots - 1, xi)))
      setActive(i)
      shown = true
      tgtOp = 1
      tip.style.opacity = "1"
    }
    const leave = () => {
      shown = false
      tgtOp = 0
      tip.style.opacity = "0"
      active = -1
    }
    svg.addEventListener("pointermove", move)
    svg.addEventListener("pointerdown", move)
    svg.addEventListener("pointerleave", leave)
    return () => {
      cancelAnimationFrame(raf)
      svg.removeEventListener("pointermove", move)
      svg.removeEventListener("pointerdown", move)
      svg.removeEventListener("pointerleave", leave)
    }
  }, [p])

  return (
    <div className="relative mt-1" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 100" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair" }} />
      <div
        ref={tipRef}
        className="pointer-events-none absolute left-0 top-0 z-10 min-w-[96px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg transition-opacity"
        style={{ opacity: 0 }}
      />
    </div>
  )
}

function CountUp({ value, prefix = "", suffix = "", decimals = 1 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const to = Number.isFinite(value) ? value : 0
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min((t - t0) / 1200, 1)
      const e = 1 - Math.pow(1 - k, 3)
      node.textContent = prefix + (to * e).toFixed(decimals) + suffix
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, prefix, suffix, decimals])
  return <span ref={ref}>{prefix + (Number.isFinite(value) ? value : 0).toFixed(decimals) + suffix}</span>
}

type Stat = {
  title: string
  vNum: number; vPrefix: string; vSuffix: string; vDec: number
  dDown: boolean; dPct: number; dPctSuffix: string; dAbs: number | null; dAbsPrefix: string
  prevText: string
  src: string; note: string; insight: string
  chart: Series
}

function Badge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return (
    <span className={"inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums " + (good ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{children}</span>
  )
}

function DeltaBadge({ down, pct, pctSuffix, absVal, absPrefix }: { down: boolean; pct: number; pctSuffix: string; absVal: number | null; absPrefix: string }) {
  const [mode, setMode] = React.useState(0)
  React.useEffect(() => {
    if (absVal == null) return
    const id = setInterval(() => setMode((m) => (m === 0 ? 1 : 0)), 4000)
    return () => clearInterval(id)
  }, [absVal])
  const showAbs = absVal != null && mode === 1
  return (
    <Badge good={down}>
      {down ? "▼ " : "▲ "}
      <span key={mode} className="inline-block" style={{ animation: "badgeSwap .45s cubic-bezier(.22,1,.36,1) both" }}>
        {showAbs ? (
          <CountUp value={absVal as number} decimals={1} prefix={absPrefix} />
        ) : (
          <CountUp value={pct} decimals={1} suffix={pctSuffix} />
        )}
      </span>
    </Badge>
  )
}

function StatCard({ s, delay }: { s: Stat; delay: number }) {
  return (
    <div className="rounded-xl bg-[#f9fafb] p-3.5 transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white hover:shadow-[0_12px_34px_-12px_rgba(99,102,241,0.4)]" style={{ animation: "fadeUp .95s cubic-bezier(.22,1,.36,1) both", animationDelay: delay + "s" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{s.title}</span>
          <DeltaBadge down={s.dDown} pct={s.dPct} pctSuffix={s.dPctSuffix} absVal={s.dAbs} absPrefix={s.dAbsPrefix} />
        </div>
        <div className="flex items-center gap-2.5 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: GRY }} />{s.chart.prevName}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: IND }} />{s.chart.curName}</span>
        </div>
      </div>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tabular-nums text-gray-900">
          <CountUp value={s.vNum} prefix={s.vPrefix} suffix={s.vSuffix} decimals={s.vDec} />
        </span>
        <span className="text-[10px] text-gray-400/90">{s.prevText}</span>
      </p>
      <ProChart {...s.chart} />
      <div className="mt-2 border-t border-gray-200 pt-2 text-[11px] leading-snug text-gray-500">
        <span className="rounded bg-indigo-100 px-1 text-[9px] font-semibold text-indigo-600">AI</span>
        <span className="ml-1">{s.insight}</span>
        <div className="mt-1 text-[10px] text-gray-400">출처 {s.note}</div>
      </div>
    </div>
  )
}

const RANGES = [
  { key: "7d", label: "최근 7일" },
  { key: "1m", label: "한 달" },
  { key: "3m", label: "3개월" },
  { key: "1y", label: "연간" },
] as const
type RangeKey = (typeof RANGES)[number]["key"]

const pad2 = (n: number) => String(n).padStart(2, "0")
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const minusYear = (d: Date) => { const x = new Date(d); x.setFullYear(x.getFullYear() - 1); return x }
const eom = (y: number, m: number) => `${y}-${pad2(m + 1)}-${pad2(new Date(y, m + 1, 0).getDate())}`

type Bucket = { start: string; end: string }
type Buckets = { cur: Bucket[]; prev: Bucket[]; labels: string[]; curName: string; prevName: string }

function buildBuckets(range: RangeKey, today: Date): Buckets {
  const yr = today.getFullYear()
  if (range === "1y") {
    const cur: Bucket[] = [], prev: Bucket[] = [], labels: string[] = []
    for (let m = 0; m < 12; m++) {
      cur.push({ start: `${yr}-${pad2(m + 1)}-01`, end: eom(yr, m) })
      prev.push({ start: `${yr - 1}-${pad2(m + 1)}-01`, end: eom(yr - 1, m) })
      labels.push(`${m + 1}월`)
    }
    return { cur, prev, labels, curName: String(yr), prevName: String(yr - 1) }
  }
  const cfg = range === "7d" ? { n: 7, step: 1 } : range === "1m" ? { n: 30, step: 1 } : { n: 13, step: 7 }
  const cur: Bucket[] = [], prev: Bucket[] = [], labels: string[] = []
  for (let k = 0; k < cfg.n; k++) {
    const end = addDays(today, -cfg.step * (cfg.n - 1 - k))
    const start = addDays(end, -(cfg.step - 1))
    cur.push({ start: iso(start), end: iso(end) })
    prev.push({ start: iso(minusYear(start)), end: iso(minusYear(end)) })
    labels.push(`${end.getMonth() + 1}/${end.getDate()}`)
  }
  return { cur, prev, labels, curName: String(yr), prevName: String(yr - 1) }
}

function trimTrail(arr: number[]) {
  let e = arr.length
  while (e > 0 && !Number.isFinite(arr[e - 1])) e--
  return arr.slice(0, e)
}
function fillGaps(arr: number[]) {
  const first = arr.find((v) => Number.isFinite(v))
  if (first === undefined) return arr
  let cur = first
  return arr.map((v) => { if (Number.isFinite(v)) { cur = v; return v } return cur })
}
function seriesFor(rows: { date: string; value: number }[], buckets: Bucket[]) {
  const last = rows.length ? rows[rows.length - 1].date : ""
  return buckets.map((b) => {
    if (last && b.start > last) return NaN
    let sum = 0, cnt = 0, ff = NaN
    for (const r of rows) {
      const v = r.value
      if (v == null || !Number.isFinite(v)) continue
      if (r.date <= b.end) ff = v
      if (r.date >= b.start && r.date <= b.end) { sum += v; cnt++ }
    }
    return cnt ? sum / cnt : ff
  })
}

const METRICS = [
  { key: "fx", table: "exchange_rates", col: "usd_php", title: "환율 USD/PHP", unit: "₱", dec: 1, src: "BSP", note: "BSP 기준환율 (USD/PHP, 전일 종가)" },
  { key: "oil", table: "oil_prices", col: "diesel", title: "경유", unit: "₱", dec: 1, src: "DOE", note: "DOE NCR 공동고시 · 일반 경유(Diesel)" },
  { key: "gas", table: "oil_prices", col: "ron91", title: "가솔린 RON91", unit: "₱", dec: 1, src: "DOE", note: "DOE NCR 공동고시 · 가솔린 RON91" },
  { key: "wx", table: "weather", col: "heat_index", title: "체감 열지수", unit: "℃", dec: 1, src: "PAGASA", note: "PAGASA 관측 · 체감 열지수(Heat Index)" },
] as const

export default function Overview() {
  const today = React.useRef(new Date()).current
  const [raw, setRaw] = React.useState<Record<string, { date: string; value: number }[]> | null>(null)
  const [comp, setComp] = React.useState<any[]>([])
  const [news, setNews] = React.useState<any[]>([])
  const [range, setRange] = React.useState<RangeKey>("7d")

  React.useEffect(() => {
    ;(async () => {
      try {
        const start = "2025-01-01"
        const end = iso(today)
        const fetched = await Promise.all(METRICS.map((m) => rangeRows(m.table, m.col, start, end)))
        const [tv, nw] = await Promise.all([competitorTv(6), latestNews(5)])
        const map: Record<string, { date: string; value: number }[]> = {}
        METRICS.forEach((m, i) => { map[m.key] = fetched[i] })
        setRaw(map)
        setComp(tv)
        setNews(nw)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [today])

  const stats: Stat[] = React.useMemo(() => {
    if (!raw) return []
    const B = buildBuckets(range, today)
    return METRICS.map((m) => {
      const rows = raw[m.key] || []
      const cur = fillGaps(trimTrail(seriesFor(rows, B.cur)))
      const prev = fillGaps(seriesFor(rows, B.prev))
      const meanOf = (a: number[]) => { const f = a.filter((v) => Number.isFinite(v)); return f.length ? f.reduce((x, y) => x + y, 0) / f.length : NaN }
      const cVal = meanOf(cur)
      const pVal = meanOf(prev)
      const down = cVal <= pVal
      const up = cVal > pVal
      const pfx = m.unit === "₱" ? "₱" : ""
      const sfx = m.unit === "℃" ? "℃" : ""
      const isTemp = m.col === "heat_index"
      const trendUp = cur.length >= 2 ? cur[cur.length - 1] > cur[0] : up
      const trendFlat = cur.length >= 2 && cur[cur.length - 1] === cur[0]
      const trendW = trendFlat ? "보합세" : trendUp ? "상승 흐름" : "하락 흐름"
      const brief =
        m.key === "fx"
          ? `${trendW} 속 수입 가전 원가에 ${up ? "상방" : "하방"} 압력이 이어지는 국면`
          : m.key === "oil"
            ? `${trendW} 속 물류·배송비 부담이 ${up ? "가중" : "완화"}되는 흐름`
            : m.key === "gas"
              ? `${trendW} 속 소비자 유류비 부담이 ${up ? "확대" : "축소"}되며 가전 구매여력에 ${up ? "부정적" : "우호적"}으로 작용하는 국면`
              : `${trendW} 속 RAC·냉장고 등 냉방 가전 수요 환경이 ${up ? "우호적" : "둔화"}인 국면`
      return {
        title: m.title,
        vNum: cVal, vPrefix: pfx, vSuffix: sfx, vDec: m.dec,
        dDown: down,
        dPct: isTemp ? Math.abs(cVal - pVal) : Math.abs(((cVal - pVal) / pVal) * 100),
        dPctSuffix: isTemp ? "℃" : "%",
        dAbs: isTemp ? null : Math.abs(cVal - pVal),
        dAbsPrefix: isTemp ? "" : "₱",
        prevText: "전년 동기 " + pfx + (Number.isFinite(pVal) ? pVal.toFixed(m.dec) : "-") + sfx,
        src: m.src,
        note: m.note,
        insight: brief,
        chart: { cur, prev, labels: B.labels, unit: m.unit, curName: B.curName, prevName: B.prevName, decimals: m.dec },
      }
    })
  }, [raw, range, today])

  const maxP = comp.length ? Math.max(...comp.map((c) => c.price)) : 1

  return (
    <main className="p-4 sm:p-6">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes badgeSwap{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}"}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">일간지표</h1>
        <div className="inline-flex rounded-lg bg-gray-100/80 p-0.5 backdrop-blur">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-300 ease-out active:scale-95 " +
              (range === r.key ? "scale-[1.03] bg-white text-indigo-600 shadow-md" : "text-gray-500 hover:-translate-y-0.5 hover:bg-white/70 hover:text-indigo-600 hover:shadow-sm")
            }
          >
            {r.label}
          </button>
        ))}
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-gray-400">* 모든 변동률·비교는 전년 동기 대비</p>

      {!raw ? (
        <p className="mt-8 text-sm text-gray-400">데이터 불러오는 중…</p>
      ) : (
        <>
          <div key={range} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <StatCard key={s.title} s={s} delay={i * 0.14} />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animation: "fadeUp .95s ease both", animationDelay: "0.55s" }}>
            <div className="rounded-xl p-5" style={{ background: SURFACE }}>
              <p className="text-sm font-medium text-gray-900">경쟁사 가격 · TV</p>
              <div className="mt-3 flex flex-col gap-2">
                {comp.map((c, i) => {
                  const pct = Math.round((c.price / maxP) * 100)
                  const lg = c.brand === "LG"
                  return (
                    <div key={i} className="relative h-7">
                      <div className={"absolute left-0 top-0 h-full rounded " + (lg ? "bg-indigo-100" : "bg-gray-200")} style={{ width: pct + "%" }} />
                      <div className="relative flex h-full items-center justify-between px-2 text-xs">
                        <span className={lg ? "font-medium text-indigo-600" : "text-gray-700"}>{c.brand} · {c.retailer}</span>
                        <span className={"tabular-nums " + (lg ? "text-indigo-600" : "text-gray-600")}>₱{c.price.toLocaleString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: SURFACE }}>
              <p className="text-sm font-medium text-gray-900">주요 뉴스</p>
              <div className="mt-3 flex flex-col gap-2.5">
                {news.map((n, i) => (
                  <div key={i}>
                    <p className="text-[13px] leading-snug text-gray-800">{n.title}</p>
                    <p className="text-[11px] text-gray-400">{n.domain} · {n.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
