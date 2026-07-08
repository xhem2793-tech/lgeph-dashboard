"use client"

import React from "react"
import {
  monthlyView,
  macroAll,
  competitorTv,
  latestNews,
} from "@/lib/supabase"

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
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]

function round(n: number, d = 1) {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

function niceStep(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(x)))
  const f = x / p
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return n * p
}

function scale(vals: number[]) {
  let mn = Math.min(...vals)
  let mx = Math.max(...vals)
  if (mn === mx) {
    mn -= 1
    mx += 1
  }
  const pad = (mx - mn) * 0.15
  mn -= pad
  mx += pad
  const step = niceStep((mx - mn) / 4)
  const lo = Math.floor(mn / step) * step
  const hi = Math.ceil(mx / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step * 0.001; t += step) ticks.push(t)
  return { lo, hi, ticks, step }
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
    const { lo, hi, ticks, step } = scale(all)
    const L = 34, R = 292, T = 12, B = 132
    const X = (i: number) => (slots <= 1 ? (L + R) / 2 : L + (i / (slots - 1)) * (R - L))
    const Y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T)
    const el = (n: string, a: Record<string, string | number>): SVGElement => {
      const e = document.createElementNS(NS, n) as SVGElement
      for (const k in a) e.setAttribute(k, String(a[k]))
      return e
    }

    ticks.forEach((t) => {
      svg.appendChild(el("line", { x1: L, y1: Y(t), x2: R, y2: Y(t), stroke: "#eef0f2", "stroke-width": 1 }))
      const tx = el("text", { x: L - 6, y: Y(t) + 3, "text-anchor": "end", "font-size": 9, fill: "#9ca3af" })
      tx.textContent = step < 1 ? t.toFixed(1) : String(Math.round(t))
      svg.appendChild(tx)
    })
    if (unit) {
      const u = el("text", { x: L - 26, y: T - 2, "font-size": 9, fill: "#9ca3af" })
      u.textContent = unit
      svg.appendChild(u)
    }
    labels.forEach((lb, i) => {
      const tx = el("text", { x: X(i), y: B + 13, "text-anchor": "middle", "font-size": 9, fill: "#9ca3af" })
      tx.textContent = lb
      svg.appendChild(tx)
    })

    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: "#cbd5e1", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 })
    svg.appendChild(cross)

    const base = 3
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
        pl.style.transition = "stroke-dashoffset 1000ms ease"
        requestAnimationFrame(() => requestAnimationFrame(() => { pl.style.strokeDashoffset = "0" }))
      }
      return pts.map((pp) => {
        const c = el("circle", { cx: pp[0].toFixed(1), cy: pp[1].toFixed(1), r: base, fill: "#ffffff", stroke: color, "stroke-width": 1.6 })
        svg.appendChild(c)
        return { c, r: base }
      })
    }
    const dPrev = hasPrev ? drawSeries(p.prev as number[], GRY, 1.6, false) : null
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
          const tr = shown && j === active ? (ds === dCur ? 5.6 : 5) : base
          o.r += (tr - o.r) * 0.3
          o.c.setAttribute("r", o.r.toFixed(2))
          const act = shown && j === active
          o.c.setAttribute("fill", act ? (ds === dCur ? IND : GRY) : "#ffffff")
        })
      })
      const sx = rectW / 300, sy = rectH / 165
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
    <div className="relative mt-2" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 165" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair" }} />
      <div
        ref={tipRef}
        className="pointer-events-none absolute left-0 top-0 z-10 min-w-[96px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg transition-opacity dark:border-gray-700 dark:bg-gray-900"
        style={{ opacity: 0 }}
      />
    </div>
  )
}

type Stat = {
  title: string
  value: string
  delta: string
  good: boolean
  prev: string
  danger?: boolean
  chart: Series
}

function Badge({ good, text }: { good: boolean; text: string }) {
  return (
    <span className={"rounded px-1.5 py-0.5 text-xs font-medium " + (good ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400")}>{text}</span>
  )
}

function StatCard({ s }: { s: Stat }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{s.title}</span>
          <Badge good={s.good} text={s.delta} />
        </div>
        {s.chart.prev && s.chart.prev.length ? (
          <div className="flex items-center gap-2.5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: GRY }} />{s.chart.prevName}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: IND }} />{s.chart.curName}</span>
          </div>
        ) : null}
      </div>
      <p className={"mt-1 text-2xl font-semibold tabular-nums " + (s.danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-50")}>{s.value}</p>
      <p className="text-[11px] text-gray-400">{s.prev}</p>
      <ProChart {...s.chart} />
    </div>
  )
}

export default function Overview() {
  const [stats, setStats] = React.useState<Stat[]>([])
  const [comp, setComp] = React.useState<any[]>([])
  const [news, setNews] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    ;(async () => {
      try {
        const [fxM, oilM, inf, cci, bci, imp, tv, nw] = await Promise.all([
          monthlyView("v_fx_monthly"),
          monthlyView("v_oil_monthly"),
          macroAll("INF_all_items"),
          macroAll("consumer_confidence_index"),
          macroAll("business_confidence_index"),
          macroAll("imports_home_appliances"),
          competitorTv(6),
          latestNews(5),
        ])

        const byYearV = (rows: { value: number; date: string }[]) => {
          const m: Record<string, number[]> = {}
          for (const r of rows) { const y = r.date.slice(0, 4); (m[y] = m[y] || []).push(r.value) }
          return m
        }
        const byYearM = (rows: { yr: number; mon: number; v: number }[]) => {
          const m: Record<string, number[]> = {}
          for (const r of rows) { (m[r.yr] = m[r.yr] || []).push(r.v) }
          return m
        }
        const yrs = (m: Record<string, number[]>) => Object.keys(m).sort()

        // FX (monthly avg YoY)
        const fm = byYearM(fxM), fY = yrs(fm)
        const fxCur = fm[fY[fY.length - 1]], fxPrev = fm[fY[fY.length - 2]]
        // Oil
        const om = byYearM(oilM), oY = yrs(om)
        const oilCur = om[oY[oY.length - 1]], oilPrev = om[oY[oY.length - 2]]
        // Inflation
        const im = byYearV(inf), iY = yrs(im)
        const infCur = im[iY[iY.length - 1]], infPrev = im[iY[iY.length - 2]]
        // CCI quarterly
        const cm = byYearV(cci), cY = yrs(cm)
        const cciCur = cm[cY[cY.length - 1]], cciPrev = cm[cY[cY.length - 2]]
        // BCI (2026 only)
        const bm = byYearV(bci), bY = yrs(bm)
        const bciCur = bm[bY[bY.length - 1]]
        // Imports annual (multi-year single line, $M)
        const impVals = imp.map((r) => r.value / 1e6)
        const impYears = imp.map((r) => "'" + r.date.slice(2, 4))

        const last = (a: number[]) => a[a.length - 1]
        const prevPt = (a: number[]) => a[a.length - 2]

        const fxL = last(fxCur), fxP = prevPt(fxCur)
        const oL = last(oilCur), oP = prevPt(oilCur)
        const iL = last(infCur), iP = prevPt(infCur)
        const cL = last(cciCur), cP = prevPt(cciCur)
        const bL = last(bciCur), bP = prevPt(bciCur)
        const mL = last(impVals), mP = prevPt(impVals)

        const qLabels = ["1Q", "2Q", "3Q", "4Q"]

        setStats([
          {
            title: "환율 USD/PHP", value: round(fxL, 2) + "", delta: (fxL <= fxP ? "▼ " : "▲ ") + Math.abs(round(((fxL - fxP) / fxP) * 100, 2)) + "%", good: fxL <= fxP, prev: "전월 " + round(fxP, 2),
            chart: { cur: fxCur, prev: fxPrev, labels: MONTHS.slice(0, Math.max(fxCur.length, fxPrev.length)), unit: "₱", curName: fY[fY.length - 1], prevName: fY[fY.length - 2], decimals: 2 },
          },
          {
            title: "물가상승률", value: round(iL, 1) + "%", delta: (iL <= iP ? "▼ " : "▲ ") + Math.abs(round(iL - iP, 1)) + "%p", good: iL <= iP, prev: "전월 " + round(iP, 1) + "%", danger: iL >= 4,
            chart: { cur: infCur, prev: infPrev, labels: MONTHS.slice(0, Math.max(infCur.length, infPrev.length)), unit: "%", curName: iY[iY.length - 1], prevName: iY[iY.length - 2], decimals: 1 },
          },
          {
            title: "소비자신뢰 CCI", value: round(cL, 1) + "", delta: (cL >= cP ? "▲ " : "▼ ") + Math.abs(round(cL - cP, 1)) + "p", good: cL >= cP, prev: "전분기 " + round(cP, 1), danger: cL < 0,
            chart: { cur: cciCur, prev: cciPrev, labels: qLabels.slice(0, Math.max(cciCur.length, cciPrev.length)), curName: cY[cY.length - 1], prevName: cY[cY.length - 2], decimals: 1 },
          },
          {
            title: "유가 디젤", value: "₱" + round(oL, 1), delta: (oL <= oP ? "▼ " : "▲ ") + Math.abs(round(oL - oP, 1)), good: oL <= oP, prev: "전월 ₱" + round(oP, 1),
            chart: { cur: oilCur, prev: oilPrev, labels: MONTHS.slice(0, Math.max(oilCur.length, oilPrev.length)), unit: "₱", curName: oY[oY.length - 1], prevName: oY[oY.length - 2], decimals: 1 },
          },
          {
            title: "기업경기 BCI", value: round(bL, 1) + "", delta: (bL >= bP ? "▲ " : "▼ ") + Math.abs(round(bL - bP, 1)), good: bL >= bP, prev: "전월 " + round(bP, 1), danger: bL < 0,
            chart: { cur: bciCur, labels: MONTHS.slice(0, bciCur.length), curName: bY[bY.length - 1], decimals: 1 },
          },
          {
            title: "가전 수입(연)", value: "$" + Math.round(mL) + "M", delta: (mL >= mP ? "▲ " : "▼ ") + Math.abs(round(((mL - mP) / mP) * 100, 1)) + "%", good: mL >= mP, prev: "전년 $" + Math.round(mP) + "M",
            chart: { cur: impVals, labels: impYears, unit: "$M", curName: "수입", decimals: 0 },
          },
        ])
        setComp(tv)
        setNews(nw)
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    })()
  }, [])

  const maxP = comp.length ? Math.max(...comp.map((c) => c.price)) : 1

  return (
    <main className="p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">개요</h1>
        <span className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">전년 대비 · 2025 vs 2026</span>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-gray-400">데이터 불러오는 중…</p>
      ) : (
        <>
          <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => (
                <StatCard key={s.title} s={s} />
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">경쟁사 가격 · TV</p>
              <div className="mt-3 flex flex-col gap-2">
                {comp.map((c, i) => {
                  const pct = Math.round((c.price / maxP) * 100)
                  const lg = c.brand === "LG"
                  return (
                    <div key={i} className="relative h-7">
                      <div className={"absolute left-0 top-0 h-full rounded " + (lg ? "bg-indigo-100 dark:bg-indigo-500/20" : "bg-gray-100 dark:bg-gray-800")} style={{ width: pct + "%" }} />
                      <div className="relative flex h-full items-center justify-between px-2 text-xs">
                        <span className={lg ? "font-medium text-indigo-600 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"}>{c.brand} · {c.retailer}</span>
                        <span className={"tabular-nums " + (lg ? "text-indigo-600 dark:text-indigo-300" : "text-gray-600 dark:text-gray-400")}>₱{c.price.toLocaleString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">주요 뉴스</p>
              <div className="mt-3 flex flex-col gap-2.5">
                {news.map((n, i) => (
                  <div key={i}>
                    <p className="text-[13px] leading-snug text-gray-800 dark:text-gray-200">{n.title}</p>
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
