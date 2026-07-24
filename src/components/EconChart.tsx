"use client"

import React from "react"

/** 경제지표 공용 차트 — 환율(FxView)과 동일한 시각언어.
 *  · 라인만 상시 표시(선굵기 주 2 / 보조 1.6), 점은 호버 시에만(활성점 + 크로스헤어 + 툴팁).
 *  · 선 그리기 애니메이션 1500ms cubic-bezier(.22,1,.36,1) delay .18s — 핵심요약 ProChart와 동일.
 *  · 색=신호(DESIGN): AI 분석은 indigo 좌측바 + 신호 dot(rose/amber/emerald), 틴트 카드 금지. */

const GRID = "#eceef1"
export const IND = "#6366f1" // 주 시리즈(핵심요약 동일)

export type SLine = { name: string; color: string; data: number[]; w?: number; endLabel?: string }

// ── 인터랙티브 라인차트 (N시리즈 단일축, 평소 선만·호버 시 점) ──
export function LineChart({ series, labels, decimals = 1, unit = "" }: { series: SLine[]; labels: string[]; decimals?: number; unit?: string }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const svg = svgRef.current, tip = tipRef.current
    if (!svg || !tip) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    tip.innerHTML = ""
    const NS = "http://www.w3.org/2000/svg"
    const n = labels.length
    const hasEnd = series.some((s) => s.endLabel) // 끝점 라벨 카드 있으면 우측 여백 확보
    const L = 36, R = hasEnd ? 250 : 292, T = 8, B = 80
    const el = (t: string, a: Record<string, string | number>) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, String(a[k])); return e }
    const all = series.flatMap((s) => s.data).filter((v) => Number.isFinite(v))
    if (!all.length) return
    let lo = Math.min(...all), hi = Math.max(...all)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad
    const X = (i: number) => (n <= 1 ? (L + R) / 2 : L + (i / (n - 1)) * (R - L))
    const Y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T)
    const dec2 = hi - lo < 20 ? 1 : 0
    for (let k = 0; k <= 5; k++) {
      const v = lo + ((hi - lo) * k) / 5, y = Y(v)
      svg.appendChild(el("line", { x1: L, y1: y, x2: R, y2: y, stroke: GRID, "stroke-width": 1 }))
      const tl = el("text", { x: L - 6, y: y + 3, "text-anchor": "end", "font-size": 9, fill: "#9ca3af" }); tl.textContent = v.toFixed(dec2); svg.appendChild(tl)
    }
    const everyN = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 7)
    labels.forEach((lb, i) => { if ((n - 1 - i) % everyN !== 0) return; const tx = el("text", { x: X(i), y: B + 13, "text-anchor": "middle", "font-size": 9, fill: "#9ca3af" }); tx.textContent = lb; svg.appendChild(tx) })
    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: "#c3c8d0", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 }); svg.appendChild(cross)
    // 라인만 상시 표시. 선 그리기 애니메이션은 핵심요약과 동일.
    series.forEach((s) => {
      const w = s.w ?? 1.6
      const pts = s.data.map((v, i) => [X(i), Y(v)])
      const pl = el("polyline", { points: pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "), fill: "none", stroke: s.color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round" }); svg.appendChild(pl)
      const len = (pl as unknown as SVGPolylineElement).getTotalLength()
      pl.style.strokeDasharray = String(len); pl.style.strokeDashoffset = String(len)
      void (pl as unknown as SVGGraphicsElement).getBoundingClientRect() // 강제 reflow로 시작 상태 확정(async 로드 시 첫 페인트 누락 방지)
      pl.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.22,1,.36,1)"; pl.style.transitionDelay = "0.18s"
      pl.style.strokeDashoffset = "0"
    })
    // 끝점 라벨 카드 — 특정 시리즈(예: 필리핀)의 우측 끝 위치를 소형 핀 카드로 표기(굵은선 강조 대체)
    series.forEach((s) => {
      if (!s.endLabel) return
      let li = -1; for (let i = s.data.length - 1; i >= 0; i--) { if (Number.isFinite(s.data[i])) { li = i; break } }
      if (li < 0) return
      const ex = X(li), ey = Y(s.data[li])
      const py = Math.max(T + 7, Math.min(B - 7, ey)) // 상하 클램프
      const tw = s.endLabel.length * 6.2 + 12
      const g = el("g", {}); g.style.opacity = "0"; g.style.transition = "opacity .5s ease"; g.style.transitionDelay = "1.4s" // 인라인 style로 페이드(폴리라인과 동일 패턴)
      g.appendChild(el("circle", { cx: ex, cy: ey, r: 2.4, fill: s.color, stroke: "#fff", "stroke-width": 1.2 }))
      if (Math.abs(py - ey) > 1) g.appendChild(el("line", { x1: ex, y1: ey, x2: ex + 5, y2: py, stroke: s.color, "stroke-width": 1, opacity: 0.5 }))
      g.appendChild(el("rect", { x: ex + 5, y: py - 7, width: tw, height: 14, rx: 4, fill: "#fff", stroke: s.color, "stroke-width": 1.1 }))
      const t = el("text", { x: ex + 5 + tw / 2, y: py + 2.9, "text-anchor": "middle", "font-size": 8.4, "font-weight": 800, fill: s.color }); t.textContent = s.endLabel
      g.appendChild(t); svg.appendChild(g)
      void (g as unknown as SVGGraphicsElement).getBoundingClientRect(); g.style.opacity = "1"
    })
    // 호버 활성점: 시리즈당 1개, 평소 opacity 0
    const adots: SVGElement[] = series.map((s) => {
      const c = el("circle", { r: 4.2, fill: s.color, stroke: "#fff", "stroke-width": 1.6, opacity: 0 }); svg.appendChild(c); return c
    })
    const head = document.createElement("div"); head.className = "mb-1 text-[11px] font-medium text-gray-400"; tip.appendChild(head)
    const valNodes: HTMLElement[] = []
    series.forEach((s) => {
      const row = document.createElement("div"); row.className = "flex items-center gap-2 text-[11px] leading-4"
      const dot = document.createElement("span"); dot.className = "inline-block h-2 w-2 shrink-0 rounded-full"; dot.style.background = s.color
      const nm = document.createElement("span"); nm.className = "text-gray-500"; nm.textContent = s.name
      const v = document.createElement("b"); v.className = "ml-auto tabular-nums font-semibold text-gray-800"
      row.appendChild(dot); row.appendChild(nm); row.appendChild(v); tip.appendChild(row); valNodes.push(v)
    })
    let active = -1, curX = X(0), tgtX = X(0), cOp = 0, tOp = 0, curTop = T, tgtTop = T, rectW = 300, rectH = 120, raf = 0
    const place = (i: number) => {
      active = i; head.textContent = labels[i] ?? ""
      const tops: number[] = []
      series.forEach((s, si) => {
        const v = s.data[i]; valNodes[si].textContent = (Number.isFinite(v) ? v.toFixed(decimals) : "–") + unit; const y = Y(v); tops.push(y)
        adots[si].setAttribute("cx", X(i).toFixed(1)); adots[si].setAttribute("cy", y.toFixed(1))
      })
      tgtTop = tops.length ? Math.min(...tops) : T
    }
    const loop = () => {
      curX += (tgtX - curX) * 0.3; curTop += (tgtTop - curTop) * 0.3; cOp += (tOp - cOp) * 0.3
      cross.setAttribute("x1", curX.toFixed(1)); cross.setAttribute("x2", curX.toFixed(1)); cross.setAttribute("opacity", cOp.toFixed(2))
      adots.forEach((d) => d.setAttribute("opacity", cOp.toFixed(2)))
      const sx = rectW / 300, sy = rectH / 100
      tip.style.left = (curX * sx).toFixed(1) + "px"; tip.style.top = (curTop * sy - 12).toFixed(1) + "px"; tip.style.transform = "translate(-50%,-100%)"
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect(); rectW = rect.width; rectH = rect.height
      const px = ((e.clientX - rect.left) / rect.width) * 300
      const i = Math.max(0, Math.min(n - 1, Math.round((px - L) / (R - L) * (n - 1))))
      tgtX = X(i); if (i !== active) place(i); tOp = 1; tip.style.opacity = "1"
    }
    const leave = () => { tOp = 0; tip.style.opacity = "0"; active = -1 }
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

// 범례 칩(환율과 동일)
export function Lg({ c, t, b }: { c: string; t: string; b?: boolean }) {
  return <span className="inline-flex items-center gap-1.5" style={{ color: b ? "#4f46e5" : "#6b7280", fontWeight: b ? 700 : 500 }}><span className="inline-block h-0 w-3" style={{ borderTop: "2.4px solid " + c }} />{t}</span>
}

// ── 정부 표준 막대차트 — 증가율·수입액 등 이산값(0 기준선·양수 indigo/음수 rose·호버) ──
export function BarChart({ data, labels, color = IND, decimals = 1, unit = "" }: { data: number[]; labels: string[]; color?: string; decimals?: number; unit?: string }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const svg = svgRef.current, tip = tipRef.current
    if (!svg || !tip) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    tip.innerHTML = ""
    const NS = "http://www.w3.org/2000/svg"
    const n = data.length
    if (!n) return
    const L = 36, R = 292, T = 8, B = 80
    const el = (t: string, a: Record<string, string | number>) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, String(a[k])); return e }
    const vals = data.filter((v) => Number.isFinite(v))
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals)
    if (lo === hi) hi += 1
    const span = hi - lo; lo -= span * 0.06; hi += span * 0.12
    const X = (i: number) => L + ((i + 0.5) / n) * (R - L)
    const Y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T)
    const bw = Math.max(2, ((R - L) / n) * 0.62)
    const y0 = Y(0)
    const dec2 = hi - lo < 20 ? 1 : 0
    for (let k = 0; k <= 5; k++) {
      const v = lo + ((hi - lo) * k) / 5, y = Y(v)
      svg.appendChild(el("line", { x1: L, y1: y, x2: R, y2: y, stroke: GRID, "stroke-width": 1 }))
      const tl = el("text", { x: L - 6, y: y + 3, "text-anchor": "end", "font-size": 9, fill: "#9ca3af" }); tl.textContent = v.toFixed(dec2); svg.appendChild(tl)
    }
    svg.appendChild(el("line", { x1: L, y1: y0, x2: R, y2: y0, stroke: "#9ca3af", "stroke-width": 1 })) // 0 기준선
    const everyN = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 7)
    labels.forEach((lb, i) => { if ((n - 1 - i) % everyN !== 0) return; const tx = el("text", { x: X(i), y: B + 13, "text-anchor": "middle", "font-size": 9, fill: "#9ca3af" }); tx.textContent = lb; svg.appendChild(tx) })
    const bars = data.map((v, i) => {
      const x = X(i) - bw / 2
      const top = Math.min(Y(v), y0), h = Math.abs(Y(v) - y0)
      const c = v >= 0 ? color : "#e11d48"
      const r = el("rect", { x: x.toFixed(1), y: y0.toFixed(1), width: bw.toFixed(1), height: 0, rx: 1.4, fill: c, opacity: 0.9 })
      r.style.transition = "height .7s cubic-bezier(.16,1,.3,1), y .7s cubic-bezier(.16,1,.3,1)"; r.style.transitionDelay = 0.1 + Math.min(i, 24) * 0.012 + "s"
      svg.appendChild(r)
      void (r as unknown as SVGGraphicsElement).getBoundingClientRect()
      r.setAttribute("y", top.toFixed(1)); r.setAttribute("height", h.toFixed(1))
      return { r, c }
    })
    const head = document.createElement("div"); head.className = "mb-0.5 text-[11px] font-medium text-gray-400"; tip.appendChild(head)
    const valRow = document.createElement("div"); valRow.className = "text-[13px] font-bold tabular-nums"; tip.appendChild(valRow)
    let rectW = 300, rectH = 120, active = -1
    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect(); rectW = rect.width; rectH = rect.height
      const px = ((e.clientX - rect.left) / rect.width) * 300
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - L) / ((R - L) / n))))
      if (i !== active) {
        active = i
        bars.forEach((b, j) => b.r.setAttribute("opacity", j === i ? "1" : "0.32"))
        head.textContent = labels[i]; valRow.textContent = (Number.isFinite(data[i]) ? data[i].toFixed(decimals) : "–") + unit; valRow.style.color = bars[i].c
      }
      const sx = rectW / 300, sy = rectH / 100
      tip.style.left = (X(i) * sx).toFixed(1) + "px"; tip.style.top = (Math.min(Y(data[i]), y0) * sy - 10).toFixed(1) + "px"; tip.style.transform = "translate(-50%,-100%)"; tip.style.opacity = "1"
    }
    const leave = () => { active = -1; bars.forEach((b) => b.r.setAttribute("opacity", "0.9")); tip.style.opacity = "0" }
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", leave)
    return () => { svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerdown", move); svg.removeEventListener("pointerleave", leave) }
  }, [data, labels, color, decimals, unit])
  return (
    <div className="relative mt-1" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 100" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair" }} />
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 z-10 min-w-[80px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-center shadow-lg transition-opacity" style={{ opacity: 0 }} />
    </div>
  )
}

// 색=신호(DESIGN §1): 채운 배지·틴트 카드 금지 — 강조는 indigo 좌측바
export type Tone = "rose" | "amber" | "emerald"

// 차트 카드(환율과 동일): 차트 → 의미 → AI 분석 → 고정 출처
export function ChartCard({ title, unit, legend, series, labels, decimals, seriesUnit, meaning, ai, src, idx = 0, kind = "line", seg }: {
  title: string; unit?: string; legend: React.ReactNode; series: SLine[]; labels: string[]; decimals?: number; seriesUnit?: string
  meaning: React.ReactNode; ai: React.ReactNode; tone?: Tone; src: React.ReactNode; idx?: number; kind?: "line" | "bar"; seg?: "CE" | "B2B" | "CE·B2B"
}) {
  return (
    <div
      className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
      style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(idx, 6) * 0.06 + "s" }}
    >
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900">{title}</h3>
        {seg && <span className={"shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold " + (seg === "B2B" ? "bg-amber-50 text-amber-700" : seg === "CE" ? "bg-indigo-50 text-indigo-700" : "bg-violet-50 text-violet-700")}>{seg}</span>}
        {unit && <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400">{unit}</span>}
      </div>
      <div className="mt-1.5 flex min-h-[30px] flex-wrap items-start gap-x-3 gap-y-1 text-[10.5px]">{legend}</div>
      {kind === "bar"
        ? <BarChart data={series[0]?.data ?? []} labels={labels} color={series[0]?.color} decimals={decimals} unit={seriesUnit} />
        : <LineChart series={series} labels={labels} decimals={decimals} unit={seriesUnit} />}
      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500"><b className="font-semibold text-gray-700">의미</b> {meaning}</p>
      <div className="mt-2 border-l-2 border-indigo-300 pl-2.5">
        <p className="text-[11px] leading-relaxed text-gray-600">{ai}</p>
      </div>
      <p className="mt-auto border-t border-gray-100 pt-2 text-[10px] leading-relaxed text-gray-400">{src}</p>
    </div>
  )
}

// ── 데이터 헬퍼 ─────────────────────────────────────────────────────────
/** ISO date → "YY.M" 라벨 (분기·월 공용) */
export function moLabel(iso: string): string {
  const y = iso.slice(2, 4), m = Number(iso.slice(5, 7))
  return y + "." + m
}
/** 최근 n개만 */
export const tail = <T,>(a: T[], n: number) => a.slice(Math.max(0, a.length - n))
