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
  const SUBPAL = ["#4f46e5", "#f59e0b", "#10b981", "#0ea5e9", "#e11d48", "#8b5cf6"]
  const subTS = useMemo(() => {
    const all = Object.keys(SUB).flatMap((p) => SUB[p])
    const latest: Record<string, number> = {}; for (const r of rows) if (r.year === latestYr && all.includes(r.indicator)) latest[r.indicator] = r.value
    const top = Object.entries(latest).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n)
    const yrs = Array.from(new Set(rows.filter((r) => all.includes(r.indicator)).map((r) => r.year))).sort()
    const lines = top.map((name, i) => ({ name, color: SUBPAL[i % SUBPAL.length], pts: yrs.map((y) => { const rr = rows.find((r) => r.indicator === name && r.year === y); return rr ? rr.value * 100 : null }) }))
    return { yrs, lines }
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
          <p className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">LG 인사이트</b> 서비스화·도시화 심화는 <b>사무공간·도시가구 냉난방·소형가전</b> 수요 저변 → 도시 프리미엄·B2B 채널 우선</p>
        </>
      ) : (
        <>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9.5px]">
            {subTS.lines.map((l, i) => <span key={l.name} className="inline-flex items-center gap-1" onMouseEnter={() => setHsub(i)} onMouseLeave={() => setHsub(null)}><span className="h-2 w-2 rounded-sm" style={{ background: l.color }} /><span className={"text-gray-600 dark:text-gray-300 " + (hsub === i ? "font-bold" : "")}>{l.name}</span></span>)}
          </div>
          {!loaded ? <div className="mt-2 h-[150px] animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" /> : (() => {
            const yrs = subTS.yrs, W = 300, H = 150, L = 22, R = 8, T = 8, B = 16
            const allV = subTS.lines.flatMap((l) => l.pts.filter((v): v is number => v != null))
            const mx = Math.max(...allV, 1), mn = Math.min(...allV, 0)
            const X = (i: number) => L + (W - L - R) * (yrs.length <= 1 ? 0.5 : i / (yrs.length - 1))
            const Y = (v: number) => T + (H - T - B) * (1 - (v - mn) / ((mx - mn) || 1))
            return (
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }} onMouseLeave={() => setHsub(null)}>
                {[0, 0.5, 1].map((f) => { const y = T + (H - T - B) * f; return <line key={f} x1={L} y1={y} x2={W - R} y2={y} stroke={dark ? "#1f2937" : "#f1f3f6"} strokeWidth="1" /> })}
                {yrs.map((yr, i) => (i % 2 === 0 || i === yrs.length - 1) ? <text key={yr} x={X(i)} y={H - 4} textAnchor="middle" fontSize="7.5" fill="#94a3b8">{String(yr).slice(2)}</text> : null)}
                {subTS.lines.map((l, li) => {
                  const d = l.pts.map((v, i) => v == null ? null : `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).filter(Boolean).map((p, i) => (i ? "L" : "M") + p).join(" ")
                  const dim = hsub != null && hsub !== li
                  return <g key={l.name} opacity={dim ? 0.25 : 1} style={{ transition: "opacity .18s" }}><path d={d} fill="none" stroke={l.color} strokeWidth={hsub === li ? 2.6 : 1.8} strokeLinejoin="round" style={{ animation: "fadeIn .6s ease both", animationDelay: li * 0.05 + "s" }} />{l.pts.map((v, i) => v == null ? null : <circle key={i} cx={X(i)} cy={Y(v)} r={i === l.pts.length - 1 ? 2.4 : 1.3} fill={l.color} />)}</g>
                })}
              </svg>
            )
          })()}
          <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 세부산업 시계열 — 정보통신(BPO)·금융·부동산 상승세가 도시 사무·중산층 확장 신호</p>
          <p className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">LG 인사이트</b> BPO·금융 성장 지역(메트로마닐라·세부)에 <b>사무용 냉방·프리미엄 가전</b> 집중, 제조업 회복 시 B2B 파이프 확대</p>
        </>
      )}
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">출처 PSA 국민계정 산업별 GDP 비중 · 연간</p>
    </div>
  )
}
