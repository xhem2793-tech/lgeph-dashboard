"use client"

import React from "react"
import {
  latestMacro,
  macroSeries,
  exchangeRates,
  oilSeries,
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

function round(n: number, d = 1) {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

function Spark({ data, unit = "" }: { data: number[]; unit?: string }) {
  const ref = React.useRef<SVGSVGElement | null>(null)
  const tip = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const svg = ref.current
    if (!svg || data.length < 2) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    const NS = "http://www.w3.org/2000/svg"
    const w = 200, h = 48, pad = 4
    const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1
    const xy = data.map((y, i) => [pad + (i * (w - 2 * pad)) / (data.length - 1), h - pad - ((y - min) / rng) * (h - 2 * pad)])
    const line = xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
    const mk = (n: string, a: Record<string, string>) => {
      const e = document.createElementNS(NS, n)
      for (const k in a) e.setAttribute(k, a[k])
      return e
    }
    const area = mk("path", { d: `M${xy[0][0].toFixed(1)},${h - pad} L${line.split(" ").join(" L")} L${xy[xy.length - 1][0].toFixed(1)},${h - pad} Z`, fill: IND, opacity: "0.12" })
    svg.appendChild(area)
    const pl = mk("polyline", { points: line, fill: "none", stroke: IND, "stroke-width": "1.6", "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }) as SVGPolylineElement
    svg.appendChild(pl)
    const len = pl.getTotalLength()
    pl.style.strokeDasharray = String(len)
    pl.style.strokeDashoffset = String(len)
    pl.style.transition = "stroke-dashoffset 900ms ease"
    requestAnimationFrame(() => requestAnimationFrame(() => { pl.style.strokeDashoffset = "0" }))
    const dot = mk("circle", { cx: String(xy[xy.length - 1][0].toFixed(1)), cy: String(xy[xy.length - 1][1].toFixed(1)), r: "2.6", fill: IND })
    svg.appendChild(dot)
    const cross = mk("line", { x1: "0", y1: String(pad), x2: "0", y2: String(h - pad), stroke: "#9ca3af", "stroke-width": "1", "stroke-dasharray": "3 3", opacity: "0" })
    svg.appendChild(cross)
    const hov = mk("circle", { r: "3.4", fill: IND, opacity: "0" })
    svg.appendChild(hov)
    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width) * w
      let i = Math.round(((px - pad) / (w - 2 * pad)) * (data.length - 1))
      i = Math.max(0, Math.min(data.length - 1, i))
      cross.setAttribute("x1", String(xy[i][0])); cross.setAttribute("x2", String(xy[i][0])); cross.setAttribute("opacity", "1")
      hov.setAttribute("cx", String(xy[i][0])); hov.setAttribute("cy", String(xy[i][1])); hov.setAttribute("opacity", "1")
      if (tip.current) {
        tip.current.textContent = round(data[i], 1) + unit
        tip.current.style.left = ((xy[i][0] / w) * rect.width) + "px"
        tip.current.style.opacity = "1"
      }
    }
    const leave = () => {
      cross.setAttribute("opacity", "0"); hov.setAttribute("opacity", "0")
      if (tip.current) tip.current.style.opacity = "0"
    }
    svg.addEventListener("pointermove", move)
    svg.addEventListener("pointerleave", leave)
    return () => { svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerleave", leave) }
  }, [data, unit])
  return (
    <div className="relative mt-1.5">
      <svg ref={ref} viewBox="0 0 200 48" width="100%" height="48" preserveAspectRatio="none" style={{ touchAction: "none" }} />
      <div ref={tip} className="pointer-events-none absolute -top-5 -translate-x-1/2 rounded bg-white px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-indigo-600 shadow ring-1 ring-gray-200 transition-opacity dark:bg-gray-900 dark:text-indigo-300 dark:ring-gray-700" style={{ opacity: 0 }} />
    </div>
  )
}

type Stat = { title: string; value: string; delta: string; good: boolean; prev: string; series: number[]; unit?: string; danger?: boolean }

function Badge({ good, text }: { good: boolean; text: string }) {
  return (
    <span className={"rounded px-1.5 py-0.5 text-xs font-medium " + (good ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400")}>{text}</span>
  )
}

function StatCard({ s }: { s: Stat }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{s.title}</span>
        <Badge good={s.good} text={s.delta} />
      </div>
      <p className={"mt-1 text-2xl font-semibold tabular-nums " + (s.danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-50")}>{s.value}</p>
      <p className="text-[11px] text-gray-400">{s.prev}</p>
      <Spark data={s.series} unit={s.unit} />
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
        const [m, fx, cci, oil, bci, imp, tv, nw] = await Promise.all([
          latestMacro(["INF_all_items", "consumer_confidence_index", "business_confidence_index", "imports_home_appliances", "BSP_policy_rate"]),
          exchangeRates(14),
          macroSeries("consumer_confidence_index", 8),
          oilSeries(8),
          macroSeries("business_confidence_index", 6),
          macroSeries("imports_home_appliances", 6),
          competitorTv(6),
          latestNews(5),
        ])
        const inf = await macroSeries("INF_all_items", 12)
        const fxv = fx.map((d) => d.value)
        const fxLast = fxv[fxv.length - 1], fxPrev = fxv[fxv.length - 2]
        const fxDelta = ((fxLast - fxPrev) / fxPrev) * 100
        const infLast = inf[inf.length - 1], infPrev = inf[inf.length - 2]
        const cciLast = cci[cci.length - 1], cciPrev = cci[cci.length - 2]
        const bciLast = bci[bci.length - 1], bciPrev = bci[bci.length - 2]
        const impLast = imp[imp.length - 1], impPrev = imp[imp.length - 2]
        const oilLast = oil[oil.length - 1], oilPrev = oil[oil.length - 2]
        setStats([
          { title: "환율 USD/PHP", value: round(fxLast, 2) + "", delta: (fxDelta <= 0 ? "▼ " : "▲ ") + Math.abs(round(fxDelta, 2)) + "%", good: fxDelta <= 0, prev: "전일 " + round(fxPrev, 2), series: fxv },
          { title: "물가상승률", value: round(infLast, 1) + "%", delta: (infLast <= infPrev ? "▼ " : "▲ ") + Math.abs(round(infLast - infPrev, 1)) + "%p", good: infLast <= infPrev, prev: "전월 " + round(infPrev, 1) + "%", series: inf, unit: "%", danger: infLast >= 4 },
          { title: "소비자신뢰 CCI", value: round(cciLast, 1) + "", delta: (cciLast >= cciPrev ? "▲ " : "▼ ") + Math.abs(round(cciLast - cciPrev, 1)) + "p", good: cciLast >= cciPrev, prev: "전분기 " + round(cciPrev, 1), series: cci, danger: true },
          { title: "유가 디젤", value: "₱" + round(oilLast, 1), delta: (oilLast <= oilPrev ? "▼ " : "▲ ") + Math.abs(round(oilLast - oilPrev, 1)), good: oilLast <= oilPrev, prev: "전주 ₱" + round(oilPrev, 1), series: oil },
          { title: "기업경기 BCI", value: round(bciLast, 1) + "", delta: (bciLast >= bciPrev ? "▲ " : "▼ ") + Math.abs(round(bciLast - bciPrev, 1)), good: bciLast >= bciPrev, prev: "전월 " + round(bciPrev, 1), series: bci, danger: bciLast < 0 },
          { title: "가전 수입(연)", value: "$" + Math.round(impLast / 1e6) + "M", delta: (impLast >= impPrev ? "▲ " : "▼ ") + Math.abs(round(((impLast - impPrev) / impPrev) * 100, 1)) + "%", good: impLast >= impPrev, prev: "전년 $" + Math.round(impPrev / 1e6) + "M", series: imp },
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
        <span className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">전주 대비</span>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-gray-400">데이터 불러오는 중…</p>
      ) : (
        <>
          <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
            <div className="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
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
