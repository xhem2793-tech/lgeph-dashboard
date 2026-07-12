"use client"

import React from "react"

/** 경제지표 페이지(DailyIndicators)와 완전히 동일한 차트·숫자 어법.
 *  레일과 페이지가 같은 코드를 쓰면 두 화면의 시각 언어가 어긋날 수 없다. */
const IND = "#6366f1"
const GRY = "#b4b2a9"
const SURFACE = "#f9fafb"
const GRID = "#eceef1"

export function niceScale(vals: number[], div = 5) {
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

export type Series = {
  cur: number[]
  prev?: number[]
  labels: string[]
  unit?: string
  curName?: string
  prevName?: string
  decimals?: number
}

export function ProChart(p: Series) {
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

export function CountUp({ value, prefix = "", suffix = "", decimals = 1 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
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
