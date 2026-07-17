"use client"

import React from "react"

/** 경량 SVG 차트 세트 — 지표 성격에 맞춰 골라 쓰는 공용 차트. */

const IND = "#6366f1"
const IND_SOFT = "#c7d2fe"
const ROSE = "#e11d48"
const EMER = "#059669"
const GRID = "#eef1f4"
const swap = "cubic-bezier(.22,1,.36,1)"

export const CHART_COLORS = { ind: IND, indSoft: IND_SOFT, rose: ROSE, emer: EMER }

const fmt = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : "–"

type Datum = { label: string; value: number }

export function Bars({
  data,
  height = 132,
  decimals = 1,
  pos = IND,
  neg,
  unit = "",
}: {
  data: Datum[]
  height?: number
  decimals?: number
  pos?: string
  neg?: string
  unit?: string
}) {
  const W = 320
  const H = height
  const vals = data.map((d) => d.value)
  const max = Math.max(0.0001, ...vals)
  const min = Math.min(0, ...vals)
  const span = max - min || 1
  const chartH = H - 30
  const y0 = 6 + (max / span) * chartH
  const step = W / data.length
  const bw = Math.min(38, step * 0.56)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden>
      <line x1="0" y1={y0} x2={W} y2={y0} stroke={GRID} strokeWidth="1" />
      {data.map((d, i) => {
        const cx = step * i + step / 2
        const bh = (Math.abs(d.value) / span) * chartH
        const up = d.value >= 0
        const y = up ? y0 - bh : y0
        const col = up ? pos : neg ?? pos
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={y} width={bw} height={Math.max(1.5, bh)} rx="2.5" fill={col} opacity="0.92" style={{ transition: `height .5s ${swap}, y .5s ${swap}` }} />
            <text x={cx} y={up ? y - 3 : y + bh + 9} textAnchor="middle" fontSize="8.5" fill="#64748b" className="tabular-nums">
              {fmt(d.value, decimals)}
              {unit}
            </text>
            <text x={cx} y={H - 3} textAnchor="middle" fontSize="8.5" fill="#94a3b8">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function HBars({
  data,
  unit = "",
  highlight,
  decimals = 0,
  color = IND,
}: {
  data: Datum[]
  unit?: string
  highlight?: string
  decimals?: number
  color?: string
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1)
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const on = highlight && d.label === highlight
        return (
          <div key={i} className="flex items-center gap-2">
            <span className={"w-20 shrink-0 truncate text-[11px] " + (on ? "font-bold text-indigo-700" : "text-gray-600")}>{d.label}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100">
              <div className="h-full rounded" style={{ width: `${(Math.abs(d.value) / max) * 100}%`, background: on ? color : IND_SOFT, transition: `width .5s ${swap}` }} />
            </div>
            <span className={"w-16 shrink-0 text-right text-[11px] tabular-nums " + (on ? "font-bold text-gray-900" : "text-gray-500")}>
              {fmt(d.value, decimals)}
              {unit}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function StackedBars({
  rows,
  keys,
  colors,
  height = 140,
  unit = "",
}: {
  rows: { label: string; parts: number[] }[]
  keys: string[]
  colors: string[]
  height?: number
  unit?: string
}) {
  const totals = rows.map((r) => r.parts.reduce((a, b) => a + b, 0))
  const max = Math.max(...totals, 1)
  const H = height
  const chartH = H - 20
  const step = 100 / rows.length
  return (
    <div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }} aria-hidden>
        {rows.map((r, i) => {
          const x = step * i + step * 0.2
          const w = step * 0.6
          let acc = 0
          return (
            <g key={i}>
              {r.parts.map((p, k) => {
                const h = (p / max) * chartH
                const y = 4 + chartH - acc - h
                acc += h
                return <rect key={k} x={x} y={y} width={w} height={Math.max(0.5, h)} fill={colors[k]} />
              })}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex">
        {rows.map((r, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-gray-400">
            {r.label}
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1 text-[9.5px] text-gray-500">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: colors[i] }} />
            {k}
          </span>
        ))}
        {unit && <span className="text-[9px] text-gray-400">({unit})</span>}
      </div>
    </div>
  )
}

export function Donut({ value, color = IND, sub }: { value: number; color?: string; sub?: string }) {
  const r = 32
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100)
  return (
    <div className="inline-flex flex-col items-center">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#eef2ff" strokeWidth="9" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 46 46)" style={{ transition: `stroke-dashoffset .6s ${swap}` }} />
        <text x="46" y="44" textAnchor="middle" fontSize="17" fontWeight="700" fill="#111827" className="tabular-nums">
          {fmt(value, 1)}
        </text>
        <text x="46" y="58" textAnchor="middle" fontSize="9" fill="#9ca3af">
          %
        </text>
      </svg>
      {sub && <span className="mt-0.5 text-[10px] text-gray-500">{sub}</span>}
    </div>
  )
}

export function Gauge({
  value,
  min = 0,
  max = 100,
  color = IND,
  unit = "",
  sub,
}: {
  value: number
  min?: number
  max?: number
  color?: string
  unit?: string
  sub?: string
}) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)))
  const a = Math.PI * (1 - t)
  const cx = 60
  const cy = 54
  const r = 44
  const x = cx + r * Math.cos(a)
  const y = cy - r * Math.sin(a)
  const arc = Math.PI * r
  return (
    <div className="inline-flex flex-col items-center">
      <svg width="120" height="66" viewBox="0 0 120 66">
        <path d={`M16,54 A44,44 0 0 1 104,54`} fill="none" stroke="#eef2ff" strokeWidth="9" strokeLinecap="round" />
        <path d={`M16,54 A44,44 0 0 1 ${x},${y}`} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={arc} style={{ transition: `stroke-dasharray .6s ${swap}` }} />
        <text x="60" y="48" textAnchor="middle" fontSize="19" fontWeight="700" fill="#111827" className="tabular-nums">
          {fmt(value, 1)}
          <tspan fontSize="10" fontWeight="500" fill="#6b7280">
            {unit}
          </tspan>
        </text>
      </svg>
      {sub && <span className="-mt-1 text-[10px] text-gray-500">{sub}</span>}
    </div>
  )
}

export function Scatter({
  points,
  highlight,
  xlab = "",
  ylab = "",
}: {
  points: { x: number; y: number; label: string }[]
  highlight?: string
  xlab?: string
  ylab?: string
}) {
  const W = 300
  const H = 150
  const pad = 24
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xmin = Math.min(...xs)
  const xmax = Math.max(...xs)
  const ymin = Math.min(...ys)
  const ymax = Math.max(...ys)
  const sx = (v: number) => pad + ((v - xmin) / (xmax - xmin || 1)) * (W - pad - 8)
  const sy = (v: number) => H - pad - ((v - ymin) / (ymax - ymin || 1)) * (H - pad - 8)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden>
        <line x1={pad} y1={H - pad} x2={W} y2={H - pad} stroke={GRID} />
        <line x1={pad} y1="4" x2={pad} y2={H - pad} stroke={GRID} />
        {points.map((p, i) => {
          const on = highlight && p.label === highlight
          return (
            <g key={i}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={on ? 6 : 4} fill={on ? IND : IND_SOFT} stroke={on ? "#fff" : "none"} strokeWidth="1.5" />
              {on && (
                <text x={sx(p.x)} y={sy(p.y) - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={IND}>
                  {p.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between px-1 text-[9px] text-gray-400">
        <span>{xlab}</span>
        <span>{ylab}</span>
      </div>
    </div>
  )
}

export function Heatmap({
  rows,
  cols,
  matrix,
  min,
  max,
}: {
  rows: string[]
  cols: string[]
  matrix: number[][]
  min?: number
  max?: number
}) {
  const flat = matrix.flat().filter((v) => Number.isFinite(v))
  const lo = min ?? Math.min(...flat)
  const hi = max ?? Math.max(...flat)
  const shade = (v: number) => {
    if (!Number.isFinite(v)) return "#f8fafc"
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)))
    return "rgba(225,29,72," + (0.08 + t * 0.82).toFixed(3) + ")"
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-white" />
            {cols.map((c, i) => (
              <th key={i} className="px-1 pb-1 text-[9px] font-medium text-gray-400">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <td className="sticky left-0 whitespace-nowrap bg-white pr-2 text-[10px] text-gray-600">{r}</td>
              {cols.map((_, ci) => {
                const v = matrix[ri]?.[ci]
                const tt = Number.isFinite(v) ? (v - lo) / (hi - lo || 1) : 0
                return (
                  <td key={ci} className="text-center">
                    <div className="flex h-6 min-w-[26px] items-center justify-center rounded text-[9px] tabular-nums" style={{ background: shade(v), color: tt > 0.55 ? "#fff" : "#334155" }}>
                      {Number.isFinite(v) ? fmt(v, 1) : ""}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
