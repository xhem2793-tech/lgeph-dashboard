"use client"

import React, { useEffect, useMemo, useState } from "react"
import { annualGroup } from "@/lib/supabase"
import { useIsDark } from "@/components/EconChart"

/** GDP 산업구조 — 3대 산업(서비스·산업·농림어) 100% 비중 세로 누적막대. 표준 차트카드 크기(300×100) + 다운로드. */

const MAJ = [
  { key: "서비스업", color: "#6366f1" },
  { key: "산업", color: "#f59e0b" },
  { key: "농·임·어업", color: "#10b981" },
]

export default function GdpComposition() {
  const [rows, setRows] = useState<{ indicator: string; year: number; value: number }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [hi, setHi] = useState<number | null>(null)
  const dark = useIsDark()
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  useEffect(() => { annualGroup("3대 산업 GDP 비중").then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const years = useMemo(() => Array.from(new Set(rows.filter((r) => MAJ.some((m) => m.key === r.indicator)).map((r) => r.year))).sort(), [rows])
  const byYear = useMemo(() => { const m: Record<number, Record<string, number>> = {}; for (const r of rows) if (MAJ.some((x) => x.key === r.indicator)) (m[r.year] = m[r.year] || {})[r.indicator] = r.value; return m }, [rows])

  const dlImg = () => { const svg = cardRef.current?.querySelector("svg"); if (!svg) return; const c = svg.cloneNode(true) as SVGElement; c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); const b = new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "GDP_산업구조.svg"; a.click(); URL.revokeObjectURL(a.href) }
  const dlCsv = () => { const head = ["연도", ...MAJ.map((m) => m.key)].join(","); const lines = years.map((y) => [y, ...MAJ.map((m) => ((byYear[y]?.[m.key] || 0) * 100).toFixed(1))].join(",")); const b = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "GDP_산업구조.csv"; a.click(); URL.revokeObjectURL(a.href) }

  const W = 300, H = 100, L = 16, R = 4, T = 4, B = 12
  const bw = years.length ? Math.min(16, (W - L - R) / years.length * 0.66) : 10
  const X = (i: number) => L + (W - L - R) * (years.length === 1 ? 0.5 : (i + 0.5) / years.length)
  const Y = (frac: number) => T + (H - T - B) * (1 - frac)
  const gray = "#94a3b8"

  return (
    <div ref={cardRef} className="group/card relative z-0 flex h-full flex-col rounded-xl p-3.5 transition-all duration-300 ease-out hover:z-30 hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both" }}>
      <style>{"@keyframes growBar{from{transform:scaleY(0);opacity:.3}to{transform:scaleY(1);opacity:1}}"}</style>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">GDP 산업구조</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CE·B2B</span>
        <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">% · 합계 100%</span>
        <span className="flex shrink-0 items-center gap-0.5 ml-1.5">
          <button type="button" onClick={dlImg} title="이미지(SVG) 다운로드" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg></button>
          <button type="button" onClick={dlCsv} title="데이터(CSV) 다운로드" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 21h16" /></svg></button>
        </span>
      </div>
      <div className="mt-1.5 flex min-h-[30px] flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
        {MAJ.map((m) => <span key={m.key} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: m.color }} /><span className="text-gray-600 dark:text-gray-300">{m.key}</span></span>)}
      </div>
      {!loaded ? <div className="mt-1 h-[150px] animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" /> : (
        <div className="relative mt-1">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }} onMouseLeave={() => setHi(null)}>
            {[0, 50, 100].map((p) => { const y = Y(p / 100); return <line key={p} x1={L} y1={y} x2={W - R} y2={y} stroke={dark ? "#1f2937" : "#f1f3f6"} strokeWidth="0.8" /> })}
            {years.map((yr, i) => {
              const d = byYear[yr] || {}; const total = MAJ.reduce((s, m) => s + (d[m.key] || 0), 0) || 1; let acc = 0
              return (
                <g key={yr} onMouseEnter={() => setHi(yr)} opacity={hi == null || hi === yr ? 1 : 0.45} style={{ transition: "opacity .2s" }}>
                  <rect x={X(i) - bw / 2 - 1.5} y={T} width={bw + 3} height={H - T - B} fill="transparent" />
                  {MAJ.map((m, mi) => { const frac = (d[m.key] || 0) / total, h = (H - T - B) * frac, y = Y(acc + frac); acc += frac
                    return <rect key={m.key} x={X(i) - bw / 2} y={y} width={bw} height={Math.max(0, h - 0.5)} fill={m.color} rx="0.4" style={{ animation: "growBar .5s cubic-bezier(.16,1,.3,1) both", animationDelay: (i * 0.02 + mi * 0.04) + "s", transformOrigin: `center ${H - B}px` }} /> })}
                  {(i % 2 === 0 || i === years.length - 1) && <text x={X(i)} y={H - 3.5} textAnchor="middle" fontSize="6" fill={gray}>{String(yr).slice(2)}</text>}
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
      <p className="mt-2.5 line-clamp-2 min-h-[34px] text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 서비스업 비중 확대 = 서비스 중심 경제 · 도시 중산층 소비 저변</p>
      <p className="mt-2 line-clamp-2 min-h-[34px] border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">LG 인사이트</b> 서비스화·도시화 심화는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">도시가구·사무공간 냉난방·소형가전 수요 저변</b> → 도시 프리미엄·B2B 채널 우선</p>
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> PSA 국민계정 산업별 GDP 비중 · 연간 · 3대 산업 합계 100%</p>
    </div>
  )
}
