"use client"

import React from "react"

/** 경제지표 공용 차트 — 환율(FxView)과 동일한 시각언어.
 *  · 라인만 상시 표시(선굵기 주 2 / 보조 1.6), 점은 호버 시에만(활성점 + 크로스헤어 + 툴팁).
 *  · 선 그리기 애니메이션 1500ms cubic-bezier(.22,1,.36,1) delay .18s — 핵심요약 ProChart와 동일.
 *  · 색=신호(DESIGN): AI 분석은 indigo 좌측바 + 신호 dot(rose/amber/emerald), 틴트 카드 금지. */

const GRID = "#eceef1"
export const IND = "#6366f1" // 주 시리즈(핵심요약 동일)

// .dark 클래스를 감시해 SVG 내부 하드코딩 색(그리드·흰 핀·크로스헤어)을 테마 반응형으로 — 토글 시 재그리기
export function useIsDark() {
  const [dark, setDark] = React.useState(false)
  React.useEffect(() => {
    const root = document.documentElement
    const upd = () => setDark(root.classList.contains("dark"))
    upd()
    const mo = new MutationObserver(upd)
    mo.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [])
  return dark
}
export const chartColors = (dark: boolean) => ({
  grid: dark ? "#232a33" : GRID,       // 그리드선
  halo: dark ? "#0b0f16" : "#fff",     // 점·핀 배경(카드색 컷아웃)
  cross: dark ? "#4b5563" : "#c3c8d0", // 크로스헤어
})

export type SLine = { name: string; color: string; data: number[]; w?: number; endLabel?: string }

// ── 인터랙티브 라인차트 (N시리즈 단일축, 평소 선만·호버 시 점) ──
export function LineChart({ series, labels, decimals = 1, unit = "" }: { series: SLine[]; labels: string[]; decimals?: number; unit?: string }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)
  const dark = useIsDark()
  React.useEffect(() => {
    const svg = svgRef.current, tip = tipRef.current
    if (!svg || !tip) return
    const CO = chartColors(dark); const axisCol = dark ? "#9ca3af" : "#6b7280"
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    tip.innerHTML = ""
    const NS = "http://www.w3.org/2000/svg"
    const n = labels.length
    const L = 36, R = 292, T = 8, B = 80 // 끝점 라벨은 차트 밖으로 넘김(overflow visible)
    const el = (t: string, a: Record<string, string | number>) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, String(a[k])); return e }
    const all = series.flatMap((s) => s.data).filter((v) => Number.isFinite(v))
    if (!all.length) return
    let lo = Math.min(...all), hi = Math.max(...all)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad
    // x축은 index가 아니라 **실제 시간** 비례 — 연간+분기/월별 혼합 시 라벨·점이 시간에 맞게 배치(한쪽 몰림 방지)
    const tms = labels.map((lb) => { const s = String(lb).replace("'", ""); const [y, rest] = s.split("."); let m = 1; if (rest) m = rest[0] === "Q" ? (Number(rest.slice(1)) - 1) * 3 + 1 : (Number(rest) || 1); return Number(y) * 12 + m })
    const t0 = tms[0], tspan = (tms[n - 1] - t0) || 1
    const X = (i: number) => (n <= 1 ? (L + R) / 2 : L + ((tms[i] - t0) / tspan) * (R - L))
    const Y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T)
    const dec2 = hi - lo < 20 ? 1 : 0
    for (let k = 0; k <= 5; k++) {
      const v = lo + ((hi - lo) * k) / 5, y = Y(v)
      svg.appendChild(el("line", { x1: L, y1: y, x2: R, y2: y, stroke: CO.grid, "stroke-width": 1 }))
      const tl = el("text", { x: L - 6, y: y + 3, "text-anchor": "end", "font-size": 10, fill: axisCol }); tl.textContent = v.toFixed(dec2); svg.appendChild(tl)
    }
    // 가로축 라벨: 연도 경계 기준(시간 균등). 오른쪽 최신점을 억지로 고정하지 않음. 연도가 적으면 균등 분산.
    const yearFirst: number[] = []; let ly = ""
    labels.forEach((lb, i) => { const y = String(lb || "").replace("'", "").split(".")[0]; if (y && y !== ly) { yearFirst.push(i); ly = y } })
    let showIdx: number[]
    if (yearFirst.length >= 3) { const step = Math.max(1, Math.ceil(yearFirst.length / 8)); showIdx = yearFirst.filter((_, k) => k % step === 0) }
    else { const k = Math.min(5, n); showIdx = Array.from({ length: k }, (_, j) => Math.round((j * (n - 1)) / (k - 1 || 1))) }
    // 최소 픽셀 간격 강제 — 시간비례 X에서 라벨이 겹치지 않도록(장기·혼합빈도 시계열 대응)
    { const MINPX = 34; const kept: number[] = []; for (const idx of [...showIdx].sort((a, b) => a - b)) { if (!kept.length || X(idx) - X(kept[kept.length - 1]) >= MINPX) kept.push(idx) } showIdx = kept }
    const showSet = new Set(showIdx)
    labels.forEach((lb, i) => { if (!showSet.has(i)) return; const an = i <= 1 ? "start" : i >= n - 2 ? "end" : "middle"; const tx = el("text", { x: X(i), y: B + 13, "text-anchor": an, "font-size": 10, fill: axisCol }); tx.textContent = lb; svg.appendChild(tx) })
    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: CO.cross, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 }); svg.appendChild(cross)
    // 라인 + 주 시리즈 그라디언트 면적 + 적응형 점(희소 구간만) — 1Y는 풍부, 3~5Y는 깔끔
    const gid = "ecg" + Math.random().toString(36).slice(2, 8)
    const showDots = n <= 16 // 점 개수 적을 때만 정적 마커(≈1Y). 조밀하면 라인+면적만
    const prim = series.find((s) => (s.w ?? 1.6) >= 2) ?? series[0] // 주 시리즈(굵은 선)
    if (prim) { const defs = el("defs", {}); defs.innerHTML = '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + prim.color + '" stop-opacity="0.16"/><stop offset="100%" stop-color="' + prim.color + '" stop-opacity="0"/></linearGradient>'; svg.appendChild(defs) }
    series.forEach((s) => {
      const w = s.w ?? 1.6, isPrim = s === prim
      // 결측(NaN)은 건너뛰고 실제 값이 있는 점만 연결(connect-nulls) — 연간+분기/월별 혼합 시리즈도 끊기지 않고 하나의 선으로
      const pts: number[][] = []
      s.data.forEach((v, i) => { if (Number.isFinite(v)) pts.push([X(i), Y(v)]) })
      if (!pts.length) return
      if (pts.length === 1) { svg.appendChild(el("circle", { cx: pts[0][0].toFixed(1), cy: pts[0][1].toFixed(1), r: Math.max(1.8, w), fill: s.color })); return }
      if (isPrim) { // 주 시리즈 아래 그라디언트 면적(라인이 심심해 보이지 않게)
        const ar = el("polygon", { points: pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + " " + pts[pts.length - 1][0].toFixed(1) + "," + B + " " + pts[0][0].toFixed(1) + "," + B, fill: "url(#" + gid + ")", stroke: "none" })
        ar.style.opacity = "0"; svg.appendChild(ar); void (ar as unknown as SVGGraphicsElement).getBoundingClientRect(); ar.style.transition = "opacity .8s ease .55s"; ar.style.opacity = "1"
      }
      const pl = el("polyline", { points: pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "), fill: "none", stroke: s.color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round" }); svg.appendChild(pl)
      const len = (pl as unknown as SVGPolylineElement).getTotalLength()
      pl.style.strokeDasharray = String(len); pl.style.strokeDashoffset = String(len)
      void (pl as unknown as SVGGraphicsElement).getBoundingClientRect() // 강제 reflow로 시작 상태 확정(async 로드 시 첫 페인트 누락 방지)
      pl.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.22,1,.36,1)"; pl.style.transitionDelay = "0.18s"
      pl.style.strokeDashoffset = "0"
      if (showDots) pts.forEach((p) => { // 희소 구간 정적 마커 — 라인색 테두리·카드색 채움(할로), 라인 그린 뒤 페이드인
        const c = el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: w >= 2 ? 2.5 : 2.1, fill: CO.halo, stroke: s.color, "stroke-width": 1.3 }); c.style.opacity = "0"; svg.appendChild(c)
        void (c as unknown as SVGGraphicsElement).getBoundingClientRect(); c.style.transition = "opacity .5s ease 1.5s"; c.style.opacity = "1"
      })
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
      g.appendChild(el("circle", { cx: ex, cy: ey, r: 2.4, fill: s.color, stroke: CO.halo, "stroke-width": 1.2 }))
      if (Math.abs(py - ey) > 1) g.appendChild(el("line", { x1: ex, y1: ey, x2: ex + 5, y2: py, stroke: s.color, "stroke-width": 1, opacity: 0.5 }))
      g.appendChild(el("rect", { x: ex + 5, y: py - 7, width: tw, height: 14, rx: 4, fill: CO.halo, stroke: s.color, "stroke-width": 1.1 }))
      const t = el("text", { x: ex + 5 + tw / 2, y: py + 2.9, "text-anchor": "middle", "font-size": 8.4, "font-weight": 800, fill: s.color }); t.textContent = s.endLabel
      g.appendChild(t); svg.appendChild(g)
      void (g as unknown as SVGGraphicsElement).getBoundingClientRect(); g.style.opacity = "1"
    })
    // 호버 활성점: 시리즈당 1개, 평소 opacity 0
    const adots: SVGElement[] = series.map((s) => {
      const c = el("circle", { r: 4.2, fill: s.color, stroke: CO.halo, "stroke-width": 1.6, opacity: 0 }); svg.appendChild(c); return c
    })
    const head = document.createElement("div"); head.className = "mb-1 text-[12px] font-medium text-gray-400 dark:text-gray-500"; tip.appendChild(head)
    const valNodes: HTMLElement[] = []
    series.forEach((s) => {
      const row = document.createElement("div"); row.className = "flex items-center gap-2 whitespace-nowrap text-[12px] leading-4"
      const dot = document.createElement("span"); dot.className = "inline-block h-2 w-2 shrink-0 rounded-full"; dot.style.background = s.color
      const nm = document.createElement("span"); nm.className = "text-gray-500 dark:text-gray-400"; nm.textContent = s.name
      const v = document.createElement("b"); v.className = "ml-auto tabular-nums font-semibold text-gray-800 dark:text-gray-100"
      row.appendChild(dot); row.appendChild(nm); row.appendChild(v); tip.appendChild(row); valNodes.push(v)
    })
    let active = -1, curX = X(0), tgtX = X(0), cOp = 0, tOp = 0, curTop = T, tgtTop = T, rectW = 300, rectH = 120, raf = 0
    const place = (i: number) => {
      active = i; head.textContent = labels[i] ?? ""
      const tops: number[] = []
      series.forEach((s, si) => {
        const v = s.data[i]; const fin = Number.isFinite(v)
        valNodes[si].textContent = (fin ? v.toFixed(decimals) : "–") + unit
        if (fin) { const y = Y(v); tops.push(y); adots[si].setAttribute("cx", X(i).toFixed(1)); adots[si].setAttribute("cy", y.toFixed(1)); adots[si].dataset.on = "1" }
        else adots[si].dataset.on = "" // 결측점은 활성점 숨김
      })
      tgtTop = tops.length ? Math.min(...tops) : T
    }
    const loop = () => {
      curX += (tgtX - curX) * 0.3; curTop += (tgtTop - curTop) * 0.3; cOp += (tOp - cOp) * 0.3
      cross.setAttribute("x1", curX.toFixed(1)); cross.setAttribute("x2", curX.toFixed(1)); cross.setAttribute("opacity", cOp.toFixed(2))
      adots.forEach((d) => d.setAttribute("opacity", (d.dataset.on ? cOp : 0).toFixed(2)))
      const sx = rectW / 300, sy = rectH / 100
      tip.style.left = (curX * sx).toFixed(1) + "px"; tip.style.top = (curTop * sy - 12).toFixed(1) + "px"; tip.style.transform = "translate(-50%,-100%)"
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect(); rectW = rect.width; rectH = rect.height
      const px = ((e.clientX - rect.left) / rect.width) * 300
      let i = 0, best = Infinity; for (let k = 0; k < n; k++) { const dx = Math.abs(X(k) - px); if (dx < best) { best = dx; i = k } } // 시간축 → 최근접 점
      tgtX = X(i); if (i !== active) place(i); tOp = 1; tip.style.opacity = "1"
    }
    const leave = () => { tOp = 0; tip.style.opacity = "0"; active = -1 }
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", leave)
    return () => { cancelAnimationFrame(raf); svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerdown", move); svg.removeEventListener("pointerleave", leave) }
  }, [series, labels, decimals, unit, dark])
  return (
    <div className="relative mt-1" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 100" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair", overflow: "visible" }} />
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 z-10 w-max whitespace-nowrap rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 shadow-lg transition-opacity" style={{ opacity: 0 }} />
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
  const dark = useIsDark()
  React.useEffect(() => {
    const svg = svgRef.current, tip = tipRef.current
    if (!svg || !tip) return
    const CO = chartColors(dark); const axisCol = dark ? "#9ca3af" : "#6b7280"
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
      svg.appendChild(el("line", { x1: L, y1: y, x2: R, y2: y, stroke: CO.grid, "stroke-width": 1 }))
      const tl = el("text", { x: L - 6, y: y + 3, "text-anchor": "end", "font-size": 10, fill: axisCol }); tl.textContent = v.toFixed(dec2); svg.appendChild(tl)
    }
    svg.appendChild(el("line", { x1: L, y1: y0, x2: R, y2: y0, stroke: "#9ca3af", "stroke-width": 1 })) // 0 기준선
    // 막대는 index 균등 배치 → 라벨도 index 균등 분산(연간+분기 혼합 시 몰림 방지)
    const kL = Math.min(6, n)
    const showSet = new Set(Array.from({ length: kL }, (_, j) => Math.round((j * (n - 1)) / (kL - 1 || 1))))
    labels.forEach((lb, i) => { if (!showSet.has(i)) return; const an = i <= 1 ? "start" : i >= n - 2 ? "end" : "middle"; const tx = el("text", { x: X(i), y: B + 13, "text-anchor": an, "font-size": 10, fill: axisCol }); tx.textContent = lb; svg.appendChild(tx) })
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
    const head = document.createElement("div"); head.className = "mb-0.5 text-[12px] font-medium text-gray-400 dark:text-gray-500"; tip.appendChild(head)
    const valRow = document.createElement("div"); valRow.className = "text-[14px] font-bold tabular-nums"; tip.appendChild(valRow)
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
  }, [data, labels, color, decimals, unit, dark])
  return (
    <div className="relative mt-1" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 100" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair" }} />
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 z-10 min-w-[80px] rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-center shadow-lg transition-opacity" style={{ opacity: 0 }} />
    </div>
  )
}

// 색=신호(DESIGN §1): 채운 배지·틴트 카드 금지 — 강조는 indigo 좌측바
export type Tone = "rose" | "amber" | "emerald"

// 차트 카드(환율과 동일): 차트 → 의미 → AI 분석 → 고정 출처
export function ChartCard({ title, unit, legend, series, labels, decimals, seriesUnit, meaning, ai, src, idx = 0, kind = "line", seg }: {
  title: string; unit?: string; legend: React.ReactNode; series: SLine[]; labels: string[]; decimals?: number; seriesUnit?: string
  meaning: React.ReactNode; ai: React.ReactNode; tone?: Tone; src: React.ReactNode; idx?: number; kind?: "line" | "bar"; seg?: string
}) {
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  const [aiOpen, setAiOpen] = React.useState(false)
  const safe = title.replace(/[^\w가-힣]+/g, "_")
  const dlCsv = () => { // 데이터 CSV 다운로드
    const head = ["기간", ...series.map((s) => s.name)].join(",")
    const rows = labels.map((lb, i) => [lb, ...series.map((s) => (Number.isFinite(s.data[i]) ? s.data[i] : ""))].join(","))
    const blob = new Blob(["﻿" + [head, ...rows].join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = safe + ".csv"; a.click(); URL.revokeObjectURL(a.href)
  }
  const dlImg = async () => { // 카드 전체를 PNG 이미지로 저장(제목·범례·차트·의미·인사이트·출처 포함)
    const node = cardRef.current; if (!node) return
    try {
      const { toPng } = await import("html-to-image")
      const url = await toPng(node, {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        cacheBust: true,
        // 다운로드 버튼(아이콘)은 캡처에서 제외
        filter: (n) => !(n instanceof HTMLElement && n.dataset && n.dataset.noexport === "1"),
      })
      const a = document.createElement("a"); a.href = url; a.download = safe + ".png"
      document.body.appendChild(a); a.click(); a.remove()
    } catch (e) { console.error("[chart] PNG export failed for", safe, e) }
  }
  return (
    <div ref={cardRef}
      className="group/card relative z-0 flex h-full flex-col rounded-xl p-3.5 transition-all duration-300 ease-out hover:z-30 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(idx, 8) * 0.025 + "s" }}
    >
      <div className="flex items-center gap-1.5">
        <h3 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        {seg && <span className={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold " + (seg === "B2B" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : seg === "CE" ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "bg-violet-50 dark:bg-violet-500/10 text-violet-700")}>{seg}</span>}
        {unit && <span className="ml-auto shrink-0 text-[11.5px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>}
        <span data-noexport="1" className={"flex shrink-0 items-center gap-0.5 " + (unit ? "ml-1.5" : "ml-auto")}>
          <button type="button" onClick={dlImg} title="이미지(PNG) 다운로드" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          </button>
          <button type="button" onClick={dlCsv} title="데이터(CSV) 다운로드" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 21h16" /></svg>
          </button>
        </span>
      </div>
      <div className="mt-1.5 flex min-h-[30px] flex-wrap items-start gap-x-3 gap-y-1 text-[11.5px]">{legend}</div>
      {kind === "bar"
        ? <BarChart data={series[0]?.data ?? []} labels={labels} color={series[0]?.color} decimals={decimals} unit={seriesUnit} />
        : <LineChart series={series} labels={labels} decimals={decimals} unit={seriesUnit} />}
      <p className="mt-2.5 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {meaning}</p>
      {ai && (
        <>
          <button type="button" onClick={() => setAiOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-[11.5px] font-bold text-indigo-600 dark:text-indigo-400 transition-colors hover:text-indigo-700 dark:hover:text-indigo-300">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>
            LG 인사이트
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: aiOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div style={{ display: "grid", gridTemplateRows: aiOpen ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(.16,1,.3,1)" }}>
            <div className="overflow-hidden">
              <div className="mt-1.5 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5">
                <p className="text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">{ai}</p>
              </div>
            </div>
          </div>
        </>
      )}
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">{src}</p>
    </div>
  )
}

// ── 데이터 헬퍼 ─────────────────────────────────────────────────────────
/** ISO date → "YY.M" 라벨 (분기·월 공용) */
// 월간="25.1", 분기="25.Q1", 연간="'25" — 컴팩트(겹침 방지). 빈도는 축 날짜 간격으로 자동 감지.
export function moLabel(iso: string): string {
  const yy = iso.slice(2, 4), m = Number(iso.slice(5, 7))
  return yy + "." + m
}
export function fmtLabels(iso: string[]): string[] {
  const toM = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7))
  const gaps: number[] = []
  for (let i = 1; i < iso.length; i++) { const g = toM(iso[i]) - toM(iso[i - 1]); if (g > 0) gaps.push(g) }
  const minGap = gaps.length ? Math.min(...gaps) : 1
  const freq = minGap >= 12 ? "Y" : minGap >= 3 ? "Q" : "M"
  return iso.map((s) => {
    const yy = s.slice(2, 4), m = Number(s.slice(5, 7))
    if (freq === "Y") return "'" + yy
    if (freq === "Q") return yy + ".Q" + (Math.floor((m - 1) / 3) + 1)
    return yy + "." + m
  })
}
/** 최근 n개만 */
export const tail = <T,>(a: T[], n: number) => a.slice(Math.max(0, a.length - n))
