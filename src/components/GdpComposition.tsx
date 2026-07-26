"use client"

import React, { useEffect, useMemo, useState } from "react"
import { annualGroup } from "@/lib/supabase"
import { useIsDark } from "@/components/EconChart"

/** GDP 산업구조 — 3대 산업(서비스·산업·농림어) 100% 비중 세로 누적막대. 값은 비율(0~1). */

const MAJ = [
  { key: "서비스업", color: "#4f46e5" },
  { key: "산업", color: "#2563eb" },
  { key: "농·임·어업", color: "#059669" },
]

export default function GdpComposition() {
  const [rows, setRows] = useState<{ indicator: string; year: number; value: number }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [hover, setHover] = useState<{ year: number; x: number } | null>(null)
  const dark = useIsDark()
  useEffect(() => { annualGroup("3대 산업 GDP 비중").then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const years = useMemo(() => Array.from(new Set(rows.filter((r) => MAJ.some((m) => m.key === r.indicator)).map((r) => r.year))).sort(), [rows])
  const byYear = useMemo(() => {
    const m: Record<number, Record<string, number>> = {}
    for (const r of rows) if (MAJ.some((x) => x.key === r.indicator)) (m[r.year] = m[r.year] || {})[r.indicator] = r.value
    return m
  }, [rows])

  const W = 720, H = 300, L = 34, R = 14, T = 14, B = 30
  const bw = years.length ? Math.min(46, (W - L - R) / years.length * 0.62) : 20
  const X = (i: number) => L + (W - L - R) * (years.length === 1 ? 0.5 : (i + 0.5) / years.length)
  const gray = dark ? "#9ca3af" : "#6b7280"

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">GDP 산업구조 (3대 산업 비중)</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CE·B2B</span>
        <span className="ml-auto text-[10.5px] font-medium text-gray-400 dark:text-gray-500">% · 연간 · 합계 100%</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
        {MAJ.map((m) => <span key={m.key} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: m.color }} /><span className="text-gray-600 dark:text-gray-300">{m.key}</span></span>)}
      </div>
      {!loaded ? <div className="mt-2 h-[300px] animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" /> : (
        <div className="relative mt-2">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }} onMouseLeave={() => setHover(null)}>
            {[0, 25, 50, 75, 100].map((p) => { const y = T + (H - T - B) * (1 - p / 100); return (
              <g key={p}><line x1={L} y1={y} x2={W - R} y2={y} stroke={dark ? "#1f2937" : "#eef1f5"} strokeWidth="1" /><text x={L - 5} y={y + 3} textAnchor="end" fontSize="10" fill={gray}>{p}</text></g>
            ) })}
            {years.map((yr, i) => {
              const d = byYear[yr] || {}; const total = MAJ.reduce((s, m) => s + (d[m.key] || 0), 0) || 1
              let acc = 0
              return (
                <g key={yr} onMouseEnter={() => setHover({ year: yr, x: X(i) })}>
                  <rect x={X(i) - bw / 2 - 3} y={T} width={bw + 6} height={H - T - B} fill="transparent" />
                  {MAJ.map((m) => {
                    const frac = (d[m.key] || 0) / total, h = (H - T - B) * frac
                    const y = T + (H - T - B) * (1 - acc - frac); acc += frac
                    return <rect key={m.key} x={X(i) - bw / 2} y={y} width={bw} height={Math.max(0, h - 0.5)} fill={m.color} rx="1" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(i, 10) * 0.03 + "s" }} />
                  })}
                  <text x={X(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={gray}>{String(yr).slice(2)}</text>
                </g>
              )
            })}
          </svg>
          {hover && byYear[hover.year] && (
            <div className="pointer-events-none absolute top-2 z-10 min-w-[130px] rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 shadow-lg" style={{ left: Math.min(78, Math.max(0, (hover.x / W) * 100 - 9)) + "%" }}>
              <div className="mb-1 text-[11px] font-bold text-gray-900 dark:text-gray-50">{hover.year}년</div>
              {MAJ.map((m) => <div key={m.key} className="flex items-center justify-between gap-3 text-[11px]"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: m.color }} /><span className="text-gray-500 dark:text-gray-400">{m.key}</span></span><span className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{((byYear[hover.year][m.key] || 0) * 100).toFixed(1)}%</span></div>)}
            </div>
          )}
        </div>
      )}
      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 서비스업 비중 확대·산업 정체 = 서비스 중심 경제 · 도시 사무직·중산층 소비 저변</p>
      <p className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">서비스화 심화는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">도시 가구·사무공간 가전(냉난방·소형가전) 수요 저변</b> → 도시 프리미엄·B2B 채널 강화</p>
      <p className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">출처 PSA 국민계정 산업별 GDP 비중 · 연간 · 3대 산업 합계 100%</p>
    </section>
  )
}
