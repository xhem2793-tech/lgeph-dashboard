"use client"

import React, { useEffect, useMemo, useState } from "react"
import { energyLabels, type EnergyRow } from "@/lib/supabase"

/** 에너지 라벨 — DOE 에너지효율 라벨(에어컨·TV·냉장고·세탁기) 브랜드별 효율·별점.
 *  LG vs 경쟁사 에너지효율 포지셔닝 = '고효율 프리미엄' 소구의 근거. */

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF", unit: "", betterHigh: true },
  { key: "ref", label: "냉장고", metric: "EEF", unit: "", betterHigh: true },
  { key: "tvl", label: "TV", metric: "EER", unit: "", betterHigh: true },
  { key: "cwm", label: "세탁기", metric: "EER", unit: "", betterHigh: true },
]

type Agg = { brand: string; n: number; eff: number | null; star5: number; kwh: number | null }

export default function EnergyLabelView() {
  const [rows, setRows] = useState<EnergyRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cat, setCat] = useState("acu")
  useEffect(() => { energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const cur = CATS.find((c) => c.key === cat)!
  const agg = useMemo<Agg[]>(() => {
    const by: Record<string, EnergyRow[]> = {}
    for (const r of rows) if (r.category === cat && r.brand) (by[r.brand] = by[r.brand] || []).push(r)
    const out: Agg[] = Object.entries(by).map(([brand, rs]) => {
      const effs = rs.map((r) => r.eff).filter((v): v is number => v != null && v > 0)
      const kwhs = rs.map((r) => r.kwh).filter((v): v is number => v != null && v > 0)
      const star5 = rs.filter((r) => (r.star ?? 0) >= 5).length
      return { brand, n: rs.length, eff: effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null, star5: rs.length ? (star5 / rs.length) * 100 : 0, kwh: kwhs.length ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : null }
    })
    return out.filter((a) => a.n >= 3).sort((a, b) => b.n - a.n)
  }, [rows, cat])

  const maxEff = Math.max(...agg.map((a) => a.eff ?? 0), 1)
  const totalModels = agg.reduce((s, a) => s + a.n, 0)
  const lg = agg.find((a) => /^lg$/i.test(a.brand))
  const lgRank = lg ? [...agg].sort((a, b) => (b.eff ?? 0) - (a.eff ?? 0)).findIndex((a) => a === lg) + 1 : 0

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      <div className="rounded-xl border border-teal-100 dark:border-teal-500/25 bg-gradient-to-r from-teal-50 dark:from-teal-500/10 via-teal-50/40 dark:via-transparent to-white dark:to-gray-900 px-4 py-3 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
          </div>
          <div className="text-[13px] leading-snug text-gray-700 dark:text-gray-200">
            <b className="font-semibold text-gray-900 dark:text-gray-50">에너지 라벨</b> — DOE 에너지효율 라벨 {totalModels.toLocaleString()}개 모델(선택 카테고리) · {lg ? <>LG {cur.label} 효율 <b className="text-teal-700 dark:text-teal-300">{lgRank}위</b>·5성비중 <b className="text-teal-700 dark:text-teal-300">{lg.star5.toFixed(0)}%</b></> : "브랜드별 효율·별점"} — 고효율 프리미엄 소구 근거
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={"rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all " + (cat === c.key ? "bg-teal-600 text-white shadow-sm" : "border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-teal-300 dark:hover:border-teal-500/40")}>{c.label}</button>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
        <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
          <span className="h-[18px] w-1 rounded bg-teal-500" />
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{cur.label} 브랜드별 에너지효율</h2>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">평균 {cur.metric}·5성 비중·모델수 (모델 3개 이상) · 높을수록 고효율</span>
        </header>
        {!loaded ? (
          <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12px]">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">
                <th className="px-2 py-1.5">브랜드</th><th className="px-2 py-1.5">모델수</th><th className="px-2 py-1.5">평균 {cur.metric}</th><th className="px-2 py-1.5 text-right">5성 비중</th><th className="px-2 py-1.5 text-right">평균 월kWh</th>
              </tr></thead>
              <tbody>
                {agg.map((a, i) => {
                  const isLG = /^lg$/i.test(a.brand)
                  return (
                    <tr key={a.brand} className={"border-b border-gray-50 dark:border-gray-800/50 " + (isLG ? "bg-teal-50/60 dark:bg-teal-500/10" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30")} style={{ animation: "fadeUp .3s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(i, 12) * 0.02 + "s" }}>
                      <td className={"px-2 py-1.5 font-bold " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{a.brand}{isLG && <span className="ml-1 rounded bg-teal-600 px-1 py-px text-[8.5px] font-bold text-white">LG</span>}</td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{a.n}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className={"w-10 shrink-0 tabular-nums font-semibold " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{a.eff != null ? a.eff.toFixed(2) : "—"}</span>
                          <span className="h-1.5 flex-1 min-w-[60px] max-w-[140px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><span className={"block h-full rounded-full " + (isLG ? "bg-teal-500" : "bg-gray-400 dark:bg-gray-600")} style={{ width: ((a.eff ?? 0) / maxEff * 100) + "%" }} /></span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{a.star5.toFixed(0)}%</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{a.kwh != null ? Math.round(a.kwh) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
          출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · {cur.metric}={cur.label === "에어컨" ? "냉방성능계수(높을수록 고효율)" : "에너지효율지수(높을수록 고효율)"} · 5성=최고효율 등급 비중
        </p>
      </section>
    </div>
  )
}
