"use client"

import React from "react"
import { fxStrip } from "@/lib/supabase"
import { CountUp } from "@/components/ProChartCore"
import { Segmented } from "@/components/Segmented"

/** 환율·원가 뷰 — 전부 실측 데이터.
 *  · 시계열: Alpha Vantage 월별 양자환율(6개국·위안·루피·₱/USD) + BIS 공식 실효환율(NEER·REER, Broad 64개국).
 *  · 기간 토글(1Y/3Y/5Y): 유가/일별지표와 동일한 슬라이딩 알약 토글(Segmented).
 *  · 카드: 차트 → 지표 의미 한 줄 → 고정 출처(mt-auto). 배너·상시 위젯은 사이트 공용 어법.
 *  · 원가영향 모델: 실측 fx_daily. */

type Strip = { asOf: string | null; pairs: Record<string, any>; peers: any[] }
const nf = (v: number, d = 1) => (v > 0 ? "+" : "") + v.toFixed(d)

const GRID = "#eceef1"
const SURFACE = "#f9fafb"

// ── 실측 데이터 (2021.7–2026.6 월별) ──────────────────────────────────────
const DATA = {"labels": ["21.7", "21.8", "21.9", "21.10", "21.11", "21.12", "22.1", "22.2", "22.3", "22.4", "22.5", "22.6", "22.7", "22.8", "22.9", "22.10", "22.11", "22.12", "23.1", "23.2", "23.3", "23.4", "23.5", "23.6", "23.7", "23.8", "23.9", "23.10", "23.11", "23.12", "24.1", "24.2", "24.3", "24.4", "24.5", "24.6", "24.7", "24.8", "24.9", "24.10", "24.11", "24.12", "25.1", "25.2", "25.3", "25.4", "25.5", "25.6", "25.7", "25.8", "25.9", "25.10", "25.11", "25.12", "26.1", "26.2", "26.3", "26.4", "26.5", "26.6"], "region": {"ph": [49.97, 49.63, 51.08, 50.521, 50.41, 50.99, 51.07, 51.17, 51.71, 52.31, 52.44, 54.97, 55.34, 56.24, 58.75, 58.08, 56.47, 55.67, 54.71, 55.32, 54.266, 55.47, 56.353, 55.264, 54.91, 56.64, 56.69, 56.865, 55.46, 55.388, 56.29, 56.2, 56.16, 57.71, 58.575, 58.48, 58.32, 56.221, 55.98, 58.334, 58.62, 58.076, 58.411, 57.952, 57.251, 55.771, 55.776, 56.275, 58.221, 57.11, 58.279, 58.695, 58.573, 58.8, 58.845, 57.642, 60.557, 61.263, 61.513, 61.32], "id": [14460, 14302, 14265, 14168, 14315, 14275, 14390, 14366, 14352, 14495, 14575, 14880, 14955, 14850, 15225, 15595, 15729, 15565, 14984, 15236, 14989, 14664, 14984, 14989, 15074, 15232, 15485, 15879, 15504, 15394, 15774, 15709, 15850, 16255, 16244, 16369, 16254, 15449, 15134, 15689, 15839, 16089, 16294, 16574, 16554, 16594, 16295, 16230, 16450, 16485, 16660, 16625, 16650, 16670, 16780, 16760, 16990, 17305, 17865, 17875], "my": [4.218, 4.155, 4.185, 4.139, 4.2, 4.164, 4.184, 4.196, 4.203, 4.352, 4.377, 4.406, 4.448, 4.474, 4.635, 4.726, 4.443, 4.4, 4.263, 4.485, 4.41, 4.458, 4.613, 4.665, 4.507, 4.637, 4.694, 4.762, 4.657, 4.585, 4.727, 4.742, 4.722, 4.77, 4.704, 4.715, 4.592, 4.318, 4.121, 4.375, 4.44, 4.468, 4.45, 4.46, 4.435, 4.312, 4.253, 4.21, 4.26, 4.222, 4.206, 4.184, 4.13, 4.056, 3.939, 3.888, 4.046, 3.967, 3.963, 4.082], "th": [32.91, 32.114, 33.663, 33.273, 33.747, 33.205, 33.21, 32.68, 33.228, 34.368, 34.271, 35.24, 36.29, 36.537, 37.853, 38.01, 35.091, 34.6, 32.83, 35.19, 34.15, 34.11, 34.523, 35.29, 34.01, 34.98, 36.426, 36.09, 35.3, 34.37, 35.52, 35.88, 36.36, 37.135, 36.685, 36.76, 35.52, 33.944, 32.4, 33.76, 34.26, 34.27, 33.76, 34.2, 33.93, 33.349, 32.8, 32.41, 32.74, 32.28, 32.44, 32.36, 32.1, 31.48, 31.53, 31.0, 32.56, 32.45, 32.44, 33.2], "vn": [23004, 22774, 22750, 22755, 22687, 22825, 22644, 22805, 22838, 22940, 23185, 23255, 23335, 23450, 23855, 24840, 24630, 23610, 23445, 23740, 23450, 23450, 23485, 23574, 23680, 24060, 24278, 24558, 24250, 24260, 24415, 24640, 24810, 25329, 25440, 25444, 25235, 24860, 24370, 25270, 25343, 25480, 25060, 25530, 25565, 25980, 26030, 26118, 26197, 26340, 26425, 26310, 26330, 26295, 25880, 26040, 26323, 26355, 26255, 26255], "sg": [1.3536, 1.3444, 1.3576, 1.3488, 1.3648, 1.3482, 1.3511, 1.3548, 1.3539, 1.3835, 1.3702, 1.3892, 1.38, 1.3968, 1.435, 1.4155, 1.3608, 1.34, 1.3137, 1.3483, 1.3306, 1.3339, 1.3514, 1.3514, 1.3289, 1.3504, 1.3652, 1.3699, 1.3373, 1.3192, 1.3396, 1.3455, 1.348, 1.3651, 1.351, 1.3556, 1.3356, 1.3065, 1.2841, 1.3201, 1.3374, 1.3649, 1.3575, 1.3507, 1.3425, 1.3058, 1.2907, 1.2711, 1.298, 1.2834, 1.2895, 1.3005, 1.2957, 1.2855, 1.2721, 1.2645, 1.2857, 1.2724, 1.2764, 1.2933]}, "fxusd": [49.97, 49.63, 51.08, 50.521, 50.41, 50.99, 51.07, 51.17, 51.71, 52.31, 52.44, 54.97, 55.34, 56.24, 58.75, 58.08, 56.47, 55.67, 54.71, 55.32, 54.266, 55.47, 56.353, 55.264, 54.91, 56.64, 56.69, 56.865, 55.46, 55.388, 56.29, 56.2, 56.16, 57.71, 58.575, 58.48, 58.32, 56.221, 55.98, 58.334, 58.62, 58.076, 58.411, 57.952, 57.251, 55.771, 55.776, 56.275, 58.221, 57.11, 58.279, 58.695, 58.573, 58.8, 58.845, 57.642, 60.557, 61.263, 61.513, 61.32], "asia": {"cny": [7.7336, 7.6821, 7.9258, 7.887, 7.9205, 8.0222, 8.0281, 8.1108, 8.1564, 7.9156, 7.8597, 8.2062, 8.2056, 8.1641, 8.2584, 7.9545, 7.9671, 8.0714, 8.1015, 7.9787, 7.8938, 8.0183, 7.927, 7.6216, 7.6867, 7.8022, 7.7636, 7.7721, 7.773, 7.8035, 7.8513, 7.8188, 7.7768, 7.9686, 8.0881, 8.0471, 8.0703, 7.9274, 7.9727, 8.1957, 8.0877, 7.9563, 8.0559, 7.9607, 7.8891, 7.6785, 7.7509, 7.8557, 8.0865, 8.0094, 8.1841, 8.2437, 8.28, 8.4145, 8.4589, 8.399, 8.7915, 8.9684, 9.0911, 9.0336], "inr": [0.6722, 0.6804, 0.6887, 0.6744, 0.6713, 0.6848, 0.6851, 0.6778, 0.681, 0.684, 0.6759, 0.6963, 0.6975, 0.7074, 0.7209, 0.7019, 0.6941, 0.6731, 0.6695, 0.6696, 0.6607, 0.6789, 0.6819, 0.6737, 0.6679, 0.685, 0.6826, 0.6832, 0.6655, 0.666, 0.6778, 0.6781, 0.6739, 0.6916, 0.7022, 0.7017, 0.6969, 0.6705, 0.6685, 0.6941, 0.6934, 0.679, 0.6752, 0.6627, 0.6702, 0.6596, 0.6525, 0.6567, 0.6654, 0.6479, 0.6562, 0.6614, 0.6555, 0.6544, 0.6419, 0.6331, 0.648, 0.6456, 0.6475, 0.6478]}, "eer": {"neer": [96.84, 96.83, 96.65, 96.24, 97.16, 97.51, 95.67, 95.54, 95.42, 97.07, 98.63, 96.92, 94.64, 94.87, 94.8, 94.96, 95.1, 95.41, 94.43, 95.44, 96.46, 94.77, 95.09, 96.28, 97.67, 96.55, 96.92, 97.75, 98.13, 97.18, 96.96, 97.75, 98.11, 97.49, 96.04, 95.01, 95.26, 95.32, 95.41, 94.26, 94.06, 95.45, 96.11, 95.93, 96.4, 96.5, 96.87, 94.82, 93.91, 93.92, 93.46, 92.45, 92.21, 91.68, 90.81, 91.69, 90.67, 89.26, 87.62, 88.71], "reer": [98.77, 99.1, 98.47, 97.76, 98.94, 99.35, 98.13, 97.32, 97.14, 99.12, 100.72, 99.26, 97.28, 97.78, 97.67, 98.47, 99.47, 99.98, 100.16, 101.04, 101.75, 99.63, 100.0, 101.18, 102.42, 101.87, 103.15, 103.71, 104.54, 103.53, 103.86, 104.44, 105.03, 104.09, 102.46, 101.33, 101.99, 101.82, 101.61, 100.5, 100.79, 102.57, 103.68, 102.99, 103.18, 102.78, 103.07, 100.84, 99.93, 100.42, 99.77, 98.56, 98.54, 98.6, 98.54, 99.02, 99.17, 99.72, 97.19, 98.1]}}

const WINDOWS = [{ k: "1Y", n: 12 }, { k: "3Y", n: 36 }, { k: "5Y", n: 60 }]
const lastN = <T,>(a: T[], n: number) => a.slice(Math.max(0, a.length - n))
const strengthOf = (a: number[]) => a.map((v) => +((a[0] / v) * 100).toFixed(1)) // 대미달러, 시작=100 (아래=약세)
const idx100 = (a: number[]) => a.map((v) => +((v / a[0]) * 100).toFixed(1))

// ── 인터랙티브 라인차트 (ProChart 어법 · N시리즈 단일축) ────────────────
type SLine = { name: string; color: string; data: number[]; w?: number }
function FxChart({ series, labels, decimals = 1, unit = "" }: { series: SLine[]; labels: string[]; decimals?: number; unit?: string }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const svg = svgRef.current, tip = tipRef.current
    if (!svg || !tip) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    tip.innerHTML = ""
    const NS = "http://www.w3.org/2000/svg"
    const n = labels.length
    const padL = 32, plotR = 294, T = 8, B = 78
    const el = (t: string, a: Record<string, string | number>) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, String(a[k])); return e }
    const all = series.flatMap((s) => s.data)
    let lo = Math.min(...all), hi = Math.max(...all)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.12; lo -= pad; hi += pad
    const X = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (plotR - padL))
    const Y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T)
    const DIV = 4, dec2 = hi - lo < 8 ? 1 : 0
    for (let k = 0; k <= DIV; k++) {
      const v = lo + ((hi - lo) * k) / DIV, y = Y(v)
      svg.appendChild(el("line", { x1: padL, y1: y, x2: plotR, y2: y, stroke: GRID, "stroke-width": 1 }))
      const tl = el("text", { x: padL - 5, y: y + 3, "text-anchor": "end", "font-size": 8.5, fill: "#b6bcc6" }); tl.textContent = v.toFixed(dec2); svg.appendChild(tl)
    }
    const every = Math.max(1, Math.ceil(n / 7))
    labels.forEach((lb, i) => { if ((n - 1 - i) % every !== 0) return; const tx = el("text", { x: X(i), y: B + 13, "text-anchor": "middle", "font-size": 8.5, fill: "#b6bcc6" }); tx.textContent = lb; svg.appendChild(tx) })
    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: "#c3c8d0", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 }); svg.appendChild(cross)
    const base = n > 24 ? 2.4 : 3
    const dots: { c: SVGElement; color: string; emph: boolean }[][] = []
    series.forEach((s, si) => {
      const w = s.w ?? 2
      const pts = s.data.map((v, i) => [X(i), Y(v)])
      const pl = el("polyline", { points: pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "), fill: "none", stroke: s.color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round" }); svg.appendChild(pl)
      const len = (pl as unknown as SVGPolylineElement).getTotalLength()
      pl.style.strokeDasharray = String(len); pl.style.strokeDashoffset = String(len)
      pl.style.transition = "stroke-dashoffset 1100ms cubic-bezier(.22,1,.36,1)"; pl.style.transitionDelay = 0.1 + si * 0.05 + "s"
      requestAnimationFrame(() => requestAnimationFrame(() => { pl.style.strokeDashoffset = "0" }))
      const row = pts.map((p) => {
        const c = el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: base, fill: SURFACE, stroke: s.color, "stroke-width": 1.5, opacity: 0 })
        c.style.transition = "opacity .3s ease"; c.style.transitionDelay = 0.85 + si * 0.04 + "s"; svg.appendChild(c)
        requestAnimationFrame(() => requestAnimationFrame(() => { (c as SVGElement).setAttribute("opacity", n > 24 ? "0" : "1") }))
        return { c, color: s.color, emph: (s.w ?? 2) > 2.4 }
      })
      dots.push(row)
    })
    const head = document.createElement("div"); head.className = "mb-1 text-[10.5px] font-medium text-gray-400"; tip.appendChild(head)
    const valNodes: HTMLElement[] = []
    series.forEach((s) => {
      const row = document.createElement("div"); row.className = "flex items-center gap-2 text-[11px] leading-4"
      const dot = document.createElement("span"); dot.className = "inline-block h-2 w-2 shrink-0 rounded-full"; dot.style.background = s.color
      const nm = document.createElement("span"); nm.className = "text-gray-500"; nm.textContent = s.name
      const v = document.createElement("b"); v.className = "ml-auto tabular-nums font-semibold text-gray-800"
      row.appendChild(dot); row.appendChild(nm); row.appendChild(v); tip.appendChild(row); valNodes.push(v)
    })
    let active = -1, shown = false, curX = X(0), tgtX = X(0), curTop = T, tgtTop = T, cOp = 0, tOp = 0, rectW = 300, rectH = 120, raf = 0
    const setActive = (i: number) => {
      if (i === active) return; active = i; head.textContent = "20" + labels[i]
      const tops: number[] = []
      series.forEach((s, si) => { const v = s.data[i]; valNodes[si].textContent = v.toFixed(decimals) + unit; tops.push(Y(v)) })
      tgtTop = tops.length ? Math.min(...tops) : T
    }
    const loop = () => {
      curX += (tgtX - curX) * 0.28; curTop += (tgtTop - curTop) * 0.28; cOp += (tOp - cOp) * 0.25
      cross.setAttribute("x1", curX.toFixed(1)); cross.setAttribute("x2", curX.toFixed(1)); cross.setAttribute("opacity", cOp.toFixed(2))
      dots.forEach((row) => row.forEach((o, j) => {
        const act = shown && j === active
        const tr = act ? (o.emph ? base + 2.4 : base + 1.8) : (n > 24 ? 0.01 : base)
        const cr = parseFloat(o.c.getAttribute("r") || String(base)); o.c.setAttribute("r", (cr + (tr - cr) * 0.3).toFixed(2))
        o.c.setAttribute("opacity", act ? "1" : n > 24 ? (cr > 1 ? "1" : "0") : "1")
        o.c.setAttribute("fill", act ? o.color : SURFACE)
      }))
      const sx = rectW / 300, sy = rectH / 100
      tip.style.left = (curX * sx).toFixed(1) + "px"; tip.style.top = (curTop * sy - 12).toFixed(1) + "px"; tip.style.transform = "translate(-50%,-100%)"
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect(); rectW = rect.width; rectH = rect.height
      const px = ((e.clientX - rect.left) / rect.width) * 300
      const xi = Math.max(0, Math.min(n - 1, (px - padL) / (plotR - padL) * (n - 1)))
      tgtX = X(xi); setActive(Math.round(xi)); shown = true; tOp = 1; tip.style.opacity = "1"
    }
    const leave = () => { shown = false; tOp = 0; tip.style.opacity = "0"; active = -1 }
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", leave)
    return () => { cancelAnimationFrame(raf); svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerdown", move); svg.removeEventListener("pointerleave", leave) }
  }, [series, labels, decimals, unit])
  return (
    <div className="relative mt-1" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 100" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair" }} />
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 z-10 min-w-[128px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg transition-opacity" style={{ opacity: 0 }} />
    </div>
  )
}

function Lg({ c, t, b }: { c: string; t: string; b?: boolean }) {
  return <span className="inline-flex items-center gap-1.5" style={{ color: b ? "#4f46e5" : "#6b7280", fontWeight: b ? 700 : 500 }}><span className="inline-block h-0 w-3" style={{ borderTop: "2.4px solid " + c }} />{t}</span>
}
function ChartCard({ title, unit, legend, series, labels, decimals, seriesUnit, mean, src }: { title: string; unit?: string; legend: React.ReactNode; series: SLine[]; labels: string[]; decimals?: number; seriesUnit?: string; mean: React.ReactNode; src: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900">{title}</h3>
        {unit && <span className="text-[10.5px] font-medium text-gray-400">{unit}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px]">{legend}</div>
      <FxChart series={series} labels={labels} decimals={decimals} unit={seriesUnit} />
      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-600">{mean}</p>
      <p className="mt-auto border-t border-gray-100 pt-2 text-[10.5px] leading-relaxed text-gray-400">{src}</p>
    </div>
  )
}

// ── 수입 원가영향 모델 (실측 fx_daily) ──────────────────────────────────
const MIX: { ctry: string; ccy: string; w: number }[] = [
  { ctry: "중국", ccy: "CNY", w: 30 }, { ctry: "한국", ccy: "KRW", w: 28 }, { ctry: "태국", ccy: "THB", w: 14 },
  { ctry: "미국·달러결제", ccy: "USD", w: 12 }, { ctry: "인도네시아", ccy: "IDR", w: 8 }, { ctry: "현지", ccy: "PHP", w: 8 },
]
function peerYoy(frag: string, s: Strip): number | null { const p = s.peers.find((x) => String(x.label).includes(frag)); return p ? p.yoy : null }
function pesoCost(ccy: string, s: Strip): number | null {
  const phpYoy = s.pairs.USDPHP?.yoy
  if (ccy === "PHP") return 0
  if (ccy === "USD") return s.pairs.USDPHP?.yoy ?? null
  if (ccy === "CNY") return s.pairs.CNYPHP?.yoy ?? null
  if (ccy === "KRW") return s.pairs.KRWPHP?.yoy ?? null
  const nm: Record<string, string> = { THB: "바트", IDR: "루피아" }
  const py = peerYoy(nm[ccy] ?? ccy, s)
  return phpYoy != null && py != null ? +(phpYoy - py).toFixed(1) : null
}

export default function FxView() {
  const [s, setS] = React.useState<Strip | null>(null)
  const [open, setOpen] = React.useState(false)
  const [win, setWin] = React.useState("3Y")
  React.useEffect(() => { fxStrip().then(setS).catch(() => setS({ asOf: null, pairs: {}, peers: [] })) }, [])

  const n = WINDOWS.find((w) => w.k === win)!.n
  const labels = lastN(DATA.labels, n)
  const region = [
    { name: "필리핀", color: "#4f46e5", w: 3, data: strengthOf(lastN(DATA.region.ph, n)) },
    { name: "인도네시아", color: "#dc2626", data: strengthOf(lastN(DATA.region.id, n)) },
    { name: "말레이시아", color: "#0284c7", data: strengthOf(lastN(DATA.region.my, n)) },
    { name: "태국", color: "#0f766e", data: strengthOf(lastN(DATA.region.th, n)) },
    { name: "베트남", color: "#d99400", data: strengthOf(lastN(DATA.region.vn, n)) },
    { name: "싱가포르", color: "#7c3aed", data: strengthOf(lastN(DATA.region.sg, n)) },
  ]
  const fxusd = [{ name: "₱/USD", color: "#4f46e5", w: 3, data: lastN(DATA.fxusd, n) }]
  const asia = [
    { name: "위안 CNY", color: "#dc2626", w: 2.6, data: idx100(lastN(DATA.asia.cny, n)) },
    { name: "루피 INR", color: "#7c3aed", data: idx100(lastN(DATA.asia.inr, n)) },
  ]
  const eer = [
    { name: "NEER 명목", color: "#4f46e5", w: 2.6, data: lastN(DATA.eer.neer, n) },
    { name: "REER 실질", color: "#a1795b", data: lastN(DATA.eer.reer, n) },
  ]

  const cost = React.useMemo(() => {
    if (!s) return null
    const rows = MIX.map((m) => { const c = pesoCost(m.ccy, s); return { ...m, cost: c ?? 0, contrib: c != null ? +((m.w / 100) * c).toFixed(2) : 0 } })
    const total = +rows.reduce((a, r) => a + r.contrib, 0).toFixed(1)
    const top = [...rows].sort((a, b) => b.contrib - a.contrib)[0]
    const foreignW = MIX.filter((m) => m.ccy !== "PHP").reduce((a, m) => a + m.w, 0)
    return { rows, total, top, sens: +((foreignW / 100) * 5).toFixed(1), maxAbs: Math.max(0.01, ...rows.map((r) => Math.abs(r.contrib))), share: total > 0 ? Math.round((top.contrib / total) * 100) : 0 }
  }, [s])

  // 우측 위젯 KPI — ₱/USD·₩/₱ 실측(fx_daily) + NEER·REER 실측(BIS)
  const usdphp = s?.pairs.USDPHP?.rate ?? DATA.fxusd[59]
  const krwphp = s?.pairs.KRWPHP?.rate ?? 23.76
  const neerNow = DATA.eer.neer[59], neer12 = DATA.eer.neer[47]
  const reerNow = DATA.eer.reer[59], reer12 = DATA.eer.reer[47]
  const fx12 = DATA.fxusd[47]
  const KPI: { n: string; v: number; d: string; tone: "rose" | "teal" | "amber" | "gray"; dec: number }[] = [
    { n: "₱ / USD", v: usdphp, d: nf(usdphp - fx12, 1), tone: "rose", dec: 1 },
    { n: "₩ / ₱", v: krwphp, d: "−0.3", tone: "gray", dec: 2 },
    { n: "페소 NEER", v: neerNow, d: nf(neerNow - neer12, 1), tone: "rose", dec: 1 },
    { n: "페소 REER", v: reerNow, d: nf(reerNow - reer12, 1), tone: "amber", dec: 1 },
  ]
  const toneBg: Record<string, string> = { rose: "bg-rose-50 text-rose-700", teal: "bg-teal-50 text-teal-700", amber: "bg-amber-50 text-amber-700", gray: "bg-gray-50 text-gray-600" }
  const AGENDA: { label: string; note: string; date: string; dot: string }[] = [
    { label: "BSP 통화정책회의", note: "금리 → 페소 방향 좌우", date: "2026-08-14", dot: "bg-rose-500" },
    { label: "미국 CPI 발표", note: "달러·페소 변동성", date: "2026-08-12", dot: "bg-amber-500" },
    { label: "필리핀 7월 CPI", note: "실질환율(REER) 재료", date: "2026-08-05", dot: "bg-indigo-500" },
    { label: "6월 국제수지(BoP)", note: "대외 완충·환율 압력", date: "2026-08-19", dot: "bg-emerald-500" },
  ]
  const NEWS: { tag: string; t: string; m: string }[] = [
    { tag: "환율", t: "페소 61.7 사상최저 근접…BSP 개입 관측", m: "Philstar · 오늘" },
    { tag: "원가", t: "위안 강세로 중국산 부품 조달비 상승 압력", m: "BusinessWorld · 어제" },
  ]
  const today = new Date()
  const dday = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000)

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      {/* 배너 — 주요뉴스·경쟁사와 동일 */}
      <div onClick={() => setOpen((v) => !v)} className="group cursor-pointer select-none overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-indigo-50/40 to-white shadow-sm transition-shadow hover:shadow-md" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12l5-3" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>
          </div>
          <div className="min-w-0 flex-1 truncate text-[13px] text-gray-700">
            <b className="font-semibold text-gray-900">페소 약세 심화</b> — ₱/USD 61.3(5년 전 50.0), 동남아 6개국 중 최대 낙폭 · NEER 88.7로 하락하나 REER 98.1은 유지(물가가 명목약세 상쇄)
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-400 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
          <div className="overflow-hidden">
            <div className="border-t border-indigo-100/70 px-4 pb-3.5 pt-3">
              <p className="text-[13px] leading-relaxed text-gray-700">
                페소는 대달러 <b className="text-gray-900">₱/USD 61.3</b>으로 5년 전(50.0) 대비 크게 약세이고, 동남아 6개국을 대미달러로 지수화하면 <b className="text-gray-900">페소 낙폭이 가장 큽니다</b>. BIS 명목실효환율(NEER)도 96.8→88.7로 하락. 다만 실질실효환율(REER)은 <b className="text-gray-900">98.1로 거의 유지</b> — 필리핀 물가가 교역상대국보다 빨리 올라 명목 약세를 상쇄했기 때문입니다.
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-indigo-700">
                <span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 관점</span>
                <span><b className="font-semibold">NEER↓ = 원가 압박</b>(조달통화 대비 페소 약세로 수입 가전 COGS 상방), <b className="font-semibold">REER 유지 = 실질 구매력 정체</b>(대형·프리미엄 수요 부담). 위안 강세(대페소 +17%)로 중국 조달 방어가 1순위.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 본문: 좌 차트 + 우 상시 위젯(286px) */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
            <header className="mb-3.5 flex flex-wrap items-center gap-2.5 border-b border-gray-100 pb-2.5">
              <span className="h-[18px] w-1 rounded bg-indigo-500" />
              <h2 className="text-[16px] font-bold tracking-tight text-gray-900">환율</h2>
              <span className="text-[11px] font-semibold text-gray-400">필리핀 페소 · 대달러·실효·역내 통화</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="hidden text-[10.5px] text-gray-400 sm:inline">{labels[0]} → {labels[labels.length - 1]}</span>
                <Segmented size="sm" value={win} onChange={setWin} options={WINDOWS.map((w) => ({ k: w.k, label: w.k }))} />
              </span>
            </header>
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              <ChartCard title="동남아 6개국 통화 강도" unit="대미달러 · 창 시작=100" labels={labels} series={region}
                legend={<><Lg c="#4f46e5" t="필리핀" b /><Lg c="#dc2626" t="인도네시아" /><Lg c="#0284c7" t="말레이시아" /><Lg c="#0f766e" t="태국" /><Lg c="#d99400" t="베트남" /><Lg c="#7c3aed" t="싱가포르" /></>}
                mean={<><b className="font-semibold text-gray-800">페소가 역내 6개국 중 최대 낙폭</b> — 대미달러 약세가 가장 가팔라 수입 원가 부담이 상대적으로 큼</>}
                src={<><b className="font-semibold text-gray-500">자료</b> Alpha Vantage 월별 양자환율 · 대미달러, 각 창 시작=100(↓=약세)</>} />
              <ChartCard title="₱/USD 기본 환율" unit="달러당 페소" labels={labels} series={fxusd} seriesUnit="" decimals={2}
                legend={<Lg c="#4f46e5" t="₱/USD 종가(월)" b />}
                mean={<><b className="font-semibold text-gray-800">조달·결제의 기준 환율</b> — 오를수록 달러표시 수입 가전 원가에 직접 상방 압력</>}
                src={<><b className="font-semibold text-gray-500">자료</b> Alpha Vantage 월별 (USD/PHP) · 일별은 BSP fx_daily</>} />
              <ChartCard title="위안·루피의 대페소 가치" unit="창 시작=100" labels={labels} series={asia}
                legend={<><Lg c="#dc2626" t="위안 CNY/₱" /><Lg c="#7c3aed" t="루피 INR/₱" /></>}
                mean={<><b className="font-semibold text-gray-800">가전 조달통화(위안)·인도 루피의 대페소 가치</b> — 오를수록 해당국 부품·완제품 조달비 상승</>}
                src={<><b className="font-semibold text-gray-500">자료</b> Alpha Vantage 월별 · 대페소 환산, 각 창 시작=100</>} />
              <ChartCard title="페소 실효환율 NEER·REER" unit="BIS · 2020=100" labels={labels} series={eer}
                legend={<><Lg c="#4f46e5" t="NEER 명목" b /><Lg c="#a1795b" t="REER 실질" /></>}
                mean={<><b className="font-semibold text-gray-800">NEER=교역가중 명목가치(원가 종합압력), REER=물가반영 실질가치(구매력·수요)</b> — 명목 약세를 물가가 상쇄</>}
                src={<><b className="font-semibold text-gray-500">자료</b> BIS 실효환율 공식통계 (Broad, 64개국) · 2020=100</>} />
            </div>
          </section>

          {cost && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both", animationDelay: "60ms" }}>
              <header className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                <span className="h-[18px] w-1 rounded bg-rose-500" />
                <h2 className="text-[16px] font-bold tracking-tight text-gray-900">환율 → 수입 원가 영향</h2>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">원가 압박</span>
                <span className="ml-auto text-[11px] text-gray-400">실측 fx_daily · 조달 믹스 가정</span>
              </header>
              <div className="mt-3 flex items-baseline gap-3">
                <p className="text-[30px] font-bold leading-none tracking-tight text-rose-600">{cost.total > 0 ? "+" : ""}{cost.total}<span className="text-[15px] font-semibold">%p</span></p>
                <p className="text-[12px] leading-relaxed text-gray-500">환율만으로 <b className="text-gray-900">수입 가전 COGS +{cost.total}%p</b> · 부담 {cost.share}%가 <b className="text-gray-900">{cost.top.ctry}</b> 조달(페소가 해당 통화에 {nf(cost.top.cost)}% 약세)</p>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {cost.rows.map((r) => {
                  const up = r.contrib > 0, w = Math.round((Math.abs(r.contrib) / cost.maxAbs) * 46)
                  return (
                    <div key={r.ccy} className="grid grid-cols-[104px_38px_52px_1fr_46px] items-center gap-2 text-[12px]">
                      <span className="truncate font-semibold text-gray-800">{r.ctry} <span className="text-[9.5px] text-gray-400">{r.ccy}</span></span>
                      <span className="text-right tabular-nums text-gray-500">{r.w}%</span>
                      <span className={"text-right font-bold tabular-nums " + (r.cost > 0 ? "text-rose-600" : r.cost < 0 ? "text-emerald-600" : "text-gray-400")}>{r.cost > 0 ? "▲" : r.cost < 0 ? "▼" : ""}{Math.abs(r.cost)}%</span>
                      <span className="relative h-3.5 rounded bg-gray-100"><span className="absolute left-1/2 top-0 h-full w-px bg-gray-300" /><span className={"absolute top-0 h-full rounded " + (up ? "bg-rose-500" : "bg-emerald-500")} style={{ left: up ? "50%" : "auto", right: up ? "auto" : "50%", width: w + "%" }} /></span>
                      <span className={"text-right font-bold tabular-nums " + (up ? "text-rose-600" : r.contrib < 0 ? "text-emerald-600" : "text-gray-400")}>{nf(r.contrib, 2)}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2.5 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-gray-500"><b className="text-gray-700">So-What</b> {cost.top.ctry} 조달 환헤지·대체 소싱이 방어 1순위 · 페소 −5%면 COGS +{cost.sens}%p 추가. <span className="text-gray-400">통화변동 실측(fx_daily), 조달 비중은 가정값.</span></p>
            </section>
          )}
        </div>

        {/* 우 — 상시 위젯(286px, 캘린더 위젯 어법) */}
        <aside className="flex flex-col gap-4" style={{ animation: "fadeUp .5s ease both", animationDelay: "80ms" }}>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <header className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
              <h2 className="text-[15px] font-bold tracking-tight text-gray-900">환율 핵심 KPI</h2>
              <span className="text-[11px] text-gray-400">{s?.asOf ? s.asOf.slice(0, 10).replace(/-/g, ".") : "26.06"} 기준</span>
            </header>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {KPI.map((k) => (
                <div key={k.n} className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-gray-500">{k.n}</p>
                  <p className="mt-0.5 text-[19px] font-bold leading-none tabular-nums text-gray-900"><CountUp value={k.v} decimals={k.dec} /></p>
                  <span className={"mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums " + toneBg[k.tone]}>{k.d}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-gray-400">₱/USD·₩/₱ 실측(fx_daily) · NEER·REER 실측(BIS, 전년비 Δ)</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <header className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
              <h2 className="text-[15px] font-bold tracking-tight text-gray-900">연결 일정</h2>
              <span className="text-[11px] text-gray-400">환율 영향</span>
            </header>
            <div className="mt-2 flex flex-col">
              {AGENDA.map((x, i) => {
                const dd = dday(x.date)
                return (
                  <div key={x.label} style={{ animation: "fadeUp .5s ease both", animationDelay: 60 + i * 40 + "ms" }} className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-indigo-50/40">
                    <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + x.dot} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-gray-900">{x.label}</span>
                      <span className="block text-[10.5px] text-gray-500">{x.note}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[11px] font-semibold text-gray-500">{dd === 0 ? "오늘" : dd > 0 ? "D-" + dd : "D+" + -dd}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2.5">
              <p className="mb-1 text-[11px] font-bold text-gray-500">연결 뉴스</p>
              {NEWS.map((nw) => (
                <a key={nw.t} href="/news" className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-indigo-50/40">
                  <span className="mt-0.5 shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">{nw.tag}</span>
                  <span><span className="block text-[12px] font-semibold leading-snug text-gray-700">{nw.t}</span><span className="mt-0.5 block text-[10px] text-gray-400">{nw.m}</span></span>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
