"use client"

import React, { useEffect, useMemo, useState } from "react"
import { annualGroup } from "@/lib/supabase"
import { useIsDark } from "@/components/EconChart"

/** GDP 산업구조 — 3대 산업(100% 누적막대·연도별) ↔ 세부 종목(최신연도 비중, 상위산업 색). */

const MAJ = [
  { key: "서비스업", color: "#6366f1" },
  { key: "산업", color: "#f59e0b" },
  { key: "농·임·어업", color: "#10b981" },
]
const SUB: Record<string, string[]> = {
  "서비스업": ["무역(도·소매)", "금융·부동산", "정보통신(BPO)", "관광(직접)", "그 외 서비스"],
  "산업": ["제조업", "건설업", "광업·채석", "전기·가스·수도"],
  "농·임·어업": ["작물", "축산·가금", "수산·양식", "임업·지원"],
}
const parentOf = (ind: string) => Object.keys(SUB).find((p) => SUB[p].includes(ind)) || ""

export default function GdpComposition() {
  const [rows, setRows] = useState<{ indicator: string; year: number; value: number }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [mode, setMode] = useState<"maj" | "sub">("maj")
  const [hi, setHi] = useState<number | null>(null)
  const [hsub, setHsub] = useState<number | null>(null)
  const dark = useIsDark()
  useEffect(() => { annualGroup("3대 산업 GDP 비중").then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const years = useMemo(() => Array.from(new Set(rows.filter((r) => MAJ.some((m) => m.key === r.indicator)).map((r) => r.year))).sort(), [rows])
  const byYear = useMemo(() => { const m: Record<number, Record<string, number>> = {}; for (const r of rows) if (MAJ.some((x) => x.key === r.indicator)) (m[r.year] = m[r.year] || {})[r.indicator] = r.value; return m }, [rows])
  const latestYr = years[years.length - 1]
  const SHADES: Record<string, string[]> = {
    "서비스업": ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"],
    "산업": ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d"],
    "농·임·어업": ["#059669", "#10b981", "#34d399", "#6ee7b7"],
  }
  const subPie = useMemo(() => {
    const all = Object.keys(SUB).flatMap((p) => SUB[p])
    const list = rows.filter((r) => r.year === latestYr && all.includes(r.indicator)).map((r) => ({ name: r.indicator, value: r.value })).sort((a, b) => b.value - a.value)
    const tot = list.reduce((s, x) => s + x.value, 0) || 1
    const ipar: Record<string, number> = {}; let ang = -Math.PI / 2
    return list.map((s) => {
      const p = parentOf(s.name); const ii = (ipar[p] = (ipar[p] ?? -1) + 1)
      const col = (SHADES[p] || ["#94a3b8"])[ii % (SHADES[p]?.length || 1)]
      const frac = s.value / tot, a0 = ang, a1 = ang + frac * 2 * Math.PI; ang = a1
      return { ...s, col, a0, a1, pct: frac * 100, parent: p }
    })
  }, [rows, latestYr])

  const gray = "#94a3b8"

  // ── 3대: 연도별 100% 누적막대(컴팩트) ──
  const W = 300, H = 132, L = 20, R = 6, T = 6, B = 16
  const bw = years.length ? Math.min(20, (W - L - R) / years.length * 0.66) : 12
  const X = (i: number) => L + (W - L - R) * (years.length === 1 ? 0.5 : (i + 0.5) / years.length)
  const Y = (frac: number) => T + (H - T - B) * (1 - frac)

  return (
    <div className="relative z-0 flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <style>{"@keyframes growBar{from{transform:scaleY(0);opacity:.3}to{transform:scaleY(1);opacity:1}}@keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}"}</style>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">GDP 산업구조</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CE·B2B</span>
        <span className="ml-auto flex gap-0.5 rounded-md border border-gray-200 dark:border-gray-800 p-0.5">
          {[["maj", "3대"], ["sub", "세부"]].map(([k, l]) => <button key={k} onClick={() => setMode(k as any)} className={"rounded px-2 py-0.5 text-[10px] font-bold transition-all " + (mode === k ? "bg-indigo-600 text-white" : "text-gray-400 dark:text-gray-500 hover:text-indigo-600")}>{l}</button>)}
        </span>
      </div>

      {mode === "maj" ? (
        <>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
            {MAJ.map((m) => <span key={m.key} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: m.color }} /><span className="text-gray-600 dark:text-gray-300">{m.key}</span></span>)}
          </div>
          {!loaded ? <div className="mt-2 h-[150px] animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" /> : (
            <div className="relative mt-2">
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }} onMouseLeave={() => setHi(null)}>
                {[0, 50, 100].map((p) => { const y = Y(p / 100); return <line key={p} x1={L} y1={y} x2={W - R} y2={y} stroke={dark ? "#1f2937" : "#f1f3f6"} strokeWidth="1" /> })}
                {years.map((yr, i) => {
                  const d = byYear[yr] || {}; const total = MAJ.reduce((s, m) => s + (d[m.key] || 0), 0) || 1; let acc = 0
                  return (
                    <g key={yr} onMouseEnter={() => setHi(yr)} opacity={hi == null || hi === yr ? 1 : 0.45} style={{ transition: "opacity .2s" }}>
                      <rect x={X(i) - bw / 2 - 2} y={T} width={bw + 4} height={H - T - B} fill="transparent" />
                      {MAJ.map((m, mi) => { const frac = (d[m.key] || 0) / total, h = (H - T - B) * frac, y = Y(acc + frac); acc += frac
                        return <rect key={m.key} x={X(i) - bw / 2} y={y} width={bw} height={Math.max(0, h - 0.6)} fill={m.color} rx="0.5" style={{ animation: "growBar .5s cubic-bezier(.16,1,.3,1) both", animationDelay: (i * 0.02 + mi * 0.04) + "s", transformOrigin: `center ${H - B}px` }} /> })}
                      {(i % 2 === 0 || i === years.length - 1) && <text x={X(i)} y={H - 5} textAnchor="middle" fontSize="7.5" fill={gray}>{String(yr).slice(2)}</text>}
                    </g>
                  )
                })}
              </svg>
              {hi != null && byYear[hi] && (
                <div className="pointer-events-none absolute -top-1 right-0 z-10 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1 shadow-lg">
                  <div className="mb-0.5 text-[10px] font-bold text-gray-900 dark:text-gray-50">{hi}년</div>
                  {MAJ.map((m) => <div key={m.key} className="flex items-center justify-between gap-2.5 text-[10px]"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm" style={{ background: m.color }} /><span className="text-gray-500 dark:text-gray-400">{m.key}</span></span><span className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{((byYear[hi][m.key] || 0) * 100).toFixed(1)}%</span></div>)}
                </div>
              )}
            </div>
          )}
          <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 서비스업 비중 확대 = 서비스 중심 경제 · 도시 중산층 소비 저변</p>
        </>
      ) : (
        <>
          <div className="mt-1.5 text-[10.5px] text-gray-400 dark:text-gray-500">{latestYr}년 세부 산업 비중 · 색=상위산업</div>
          {!loaded ? <div className="mt-2 h-[150px] animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" /> : (() => {
            const cx = 74, cy = 74, R = 58, ri = 34
            const arc = (a0: number, a1: number) => {
              const p = (a: number, r: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
              const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [xi1, yi1] = p(a1, ri), [xi0, yi0] = p(a0, ri)
              const lg = a1 - a0 > Math.PI ? 1 : 0
              return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${lg} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${xi1.toFixed(1)} ${yi1.toFixed(1)} A${ri} ${ri} 0 ${lg} 0 ${xi0.toFixed(1)} ${yi0.toFixed(1)} Z`
            }
            const foc = hsub != null ? subPie[hsub] : null
            return (
              <div className="mt-2 flex items-center justify-center gap-4">
                <svg viewBox="0 0 150 150" width="128" style={{ display: "block", flexShrink: 0 }} onMouseLeave={() => setHsub(null)}>
                  {subPie.map((s, i) => (
                    <path key={s.name} d={arc(s.a0, s.a1)} fill={s.col} opacity={hsub == null || hsub === i ? 1 : 0.35} onMouseEnter={() => setHsub(i)} style={{ transition: "opacity .18s", cursor: "default", animation: "fadeIn .5s ease both", animationDelay: i * 0.02 + "s" }} />
                  ))}
                  <text x={cx} y={cy - 3} textAnchor="middle" fontSize="12" fontWeight="800" className="fill-gray-900 dark:fill-gray-50">{foc ? foc.pct.toFixed(1) + "%" : latestYr}</text>
                  <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7.5" className="fill-gray-400">{foc ? foc.name.slice(0, 7) : "세부 비중"}</text>
                </svg>
                <div className="grid flex-1 grid-cols-2 gap-x-2 gap-y-0.5 self-center text-[9px]">
                  {subPie.slice(0, 12).map((s, i) => (
                    <span key={s.name} className="flex items-center gap-1 truncate" onMouseEnter={() => setHsub(i)} onMouseLeave={() => setHsub(null)}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: s.col }} /><span className="truncate text-gray-600 dark:text-gray-300" title={s.name}>{s.name}</span><span className="ml-auto shrink-0 font-semibold tabular-nums text-gray-500 dark:text-gray-400">{s.pct.toFixed(1)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
          <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 제조업·무역·금융·BPO가 GDP 핵심 — 도시 사무직·상업 인프라 = B2B·프리미엄 가전 수요축</p>
        </>
      )}
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">출처 PSA 국민계정 산업별 GDP 비중 · 연간</p>
    </div>
  )
}
