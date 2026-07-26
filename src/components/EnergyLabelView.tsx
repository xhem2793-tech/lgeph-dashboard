"use client"

import React, { useEffect, useMemo, useState } from "react"
import { energyLabels, type EnergyRow } from "@/lib/supabase"

/** 에너지 라벨 — DOE 에너지효율 라벨. 제품담당 관점: LG가 카테고리에서 어디에 서 있나(효율 순위·리더 격차·5성 비중) + 벤치마크 모델. */

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF" },
  { key: "ref", label: "냉장고", metric: "EEF" },
  { key: "tvl", label: "TV", metric: "EER" },
  { key: "cwm", label: "세탁기", metric: "EER" },
]

type Agg = { brand: string; n: number; eff: number; star5: number; kwh: number | null }

export default function EnergyLabelView() {
  const [rows, setRows] = useState<EnergyRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cat, setCat] = useState("acu")
  useEffect(() => { energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const cur = CATS.find((c) => c.key === cat)!
  const catRows = useMemo(() => rows.filter((r) => r.category === cat && r.brand), [rows, cat])

  const agg = useMemo<Agg[]>(() => {
    const by: Record<string, EnergyRow[]> = {}
    for (const r of catRows) (by[r.brand] = by[r.brand] || []).push(r)
    return Object.entries(by).map(([brand, rs]) => {
      const effs = rs.map((r) => r.eff).filter((v): v is number => v != null && v > 0)
      const kwhs = rs.map((r) => r.kwh).filter((v): v is number => v != null && v > 0)
      return { brand, n: rs.length, eff: effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : 0, star5: rs.length ? rs.filter((r) => (r.star ?? 0) >= 5).length / rs.length * 100 : 0, kwh: kwhs.length ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : null }
    }).filter((a) => a.n >= 5)
  }, [catRows])

  const byEff = useMemo(() => [...agg].sort((a, b) => b.eff - a.eff), [agg])
  const by5 = useMemo(() => [...agg].sort((a, b) => b.star5 - a.star5), [agg])
  const lg = agg.find((a) => /^lg$/i.test(a.brand))
  const lgEffRank = lg ? byEff.findIndex((a) => a === lg) + 1 : 0
  const lg5Rank = lg ? by5.findIndex((a) => a === lg) + 1 : 0
  const leader = byEff[0]
  const gap = lg && leader ? ((leader.eff - lg.eff) / lg.eff) * 100 : null
  const maxEff = Math.max(...agg.map((a) => a.eff), 1)
  const topModels = useMemo(() => [...catRows].filter((r) => r.eff != null && r.eff > 0).sort((a, b) => (b.eff ?? 0) - (a.eff ?? 0)).slice(0, 6), [catRows])

  const Stat = ({ label, value, sub, accent }: { label: string; value: string; sub?: React.ReactNode; accent?: boolean }) => (
    <div className={"flex-1 rounded-lg border px-3.5 py-2.5 " + (accent ? "border-teal-200 dark:border-teal-500/30 bg-teal-50/60 dark:bg-teal-500/10" : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30")}>
      <div className="text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</div>
      <div className={"mt-0.5 text-[20px] font-extrabold tabular-nums tracking-tight " + (accent ? "text-teal-700 dark:text-teal-300" : "text-gray-900 dark:text-gray-50")}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      <div className="rounded-xl border border-teal-100 dark:border-teal-500/25 bg-gradient-to-r from-teal-50 dark:from-teal-500/10 via-teal-50/40 dark:via-transparent to-white dark:to-gray-900 px-4 py-3 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
          </div>
          <div className="text-[13px] leading-snug text-gray-700 dark:text-gray-200">
            <b className="font-semibold text-gray-900 dark:text-gray-50">에너지 라벨 · {cur.label}</b> — {lg && leader ? <>LG 효율 <b className="text-teal-700 dark:text-teal-300">{agg.length}개사 중 {lgEffRank}위</b>(평균 {cur.metric} {lg.eff.toFixed(2)}), 리더 <b>{leader.brand} {leader.eff.toFixed(2)}</b> 대비 {gap != null ? gap.toFixed(0) : "—"}% 낮음 · 5성 비중 <b className="text-teal-700 dark:text-teal-300">{lg.star5.toFixed(0)}%({lg5Rank}위)</b></> : "DOE 에너지효율 라벨 브랜드별 포지션"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={"rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all " + (cat === c.key ? "bg-teal-600 text-white shadow-sm" : "border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-teal-300 dark:hover:border-teal-500/40")}>{c.label}</button>
        ))}
      </div>

      {/* LG 포지션 요약 */}
      {loaded && lg && (
        <div className="flex flex-wrap gap-2.5" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
          <Stat label={"LG 평균 " + cur.metric} value={lg.eff.toFixed(2)} sub={<>효율 <b className="text-gray-700 dark:text-gray-300">{lgEffRank}위</b> / {agg.length}개사</>} accent />
          <Stat label="LG 5성 비중" value={lg.star5.toFixed(0) + "%"} sub={<>프리미엄효율 <b className="text-gray-700 dark:text-gray-300">{lg5Rank}위</b></>} accent />
          <Stat label={"카테고리 리더"} value={leader ? leader.brand : "—"} sub={leader ? <>{cur.metric} {leader.eff.toFixed(2)} · LG 대비 <b className="text-rose-600 dark:text-rose-400">+{gap != null ? gap.toFixed(0) : "—"}%</b></> : undefined} />
          <Stat label="LG 모델 수" value={String(lg.n)} sub={<>{cur.label} 등록 모델</>} />
        </div>
      )}

      {/* 브랜드 효율 리더보드 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
        <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
          <span className="h-[18px] w-1 rounded bg-teal-500" />
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{cur.label} 브랜드 효율 리더보드</h2>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">평균 {cur.metric} 높은 순 · 모델 5개 이상 · 높을수록 고효율</span>
        </header>
        {!loaded ? (
          <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-[12px]">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">
                <th className="px-2 py-1.5 w-8">#</th><th className="px-2 py-1.5">브랜드</th><th className="px-2 py-1.5">모델</th><th className="px-2 py-1.5">평균 {cur.metric}</th><th className="px-2 py-1.5 text-right">5성 비중</th><th className="px-2 py-1.5 text-right">평균 월kWh</th>
              </tr></thead>
              <tbody>
                {byEff.map((a, i) => {
                  const isLG = /^lg$/i.test(a.brand)
                  return (
                    <tr key={a.brand} className={"border-b border-gray-50 dark:border-gray-800/50 " + (isLG ? "bg-teal-50/60 dark:bg-teal-500/10" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30")} style={{ animation: "fadeUp .3s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(i, 14) * 0.018 + "s" }}>
                      <td className="px-2 py-1.5 tabular-nums font-bold text-gray-400 dark:text-gray-500">{i + 1}</td>
                      <td className={"px-2 py-1.5 font-bold " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{a.brand}{isLG && <span className="ml-1 rounded bg-teal-600 px-1 py-px text-[8.5px] font-bold text-white">LG</span>}{i === 0 && <span className="ml-1 rounded bg-amber-100 dark:bg-amber-500/20 px-1 py-px text-[8.5px] font-bold text-amber-700 dark:text-amber-300">리더</span>}</td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{a.n}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className={"w-11 shrink-0 tabular-nums font-semibold " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{a.eff.toFixed(2)}</span>
                          <span className="h-1.5 flex-1 min-w-[60px] max-w-[150px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><span className={"block h-full rounded-full " + (isLG ? "bg-teal-500" : i === 0 ? "bg-amber-400" : "bg-gray-400 dark:bg-gray-600")} style={{ width: (a.eff / maxEff * 100) + "%" }} /></span>
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
      </section>

      {/* 최고효율 벤치마크 모델 */}
      {loaded && topModels.length > 0 && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
          <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-amber-500" />
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">최고효율 벤치마크 모델</h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{cur.label} 시장 최고 {cur.metric} 상위 모델 — 목표 스펙 벤치마크</span>
          </header>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topModels.map((m, i) => {
              const isLG = /^lg$/i.test(m.brand)
              return (
                <div key={i} className={"rounded-lg border px-3 py-2 " + (isLG ? "border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/10" : "border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={"text-[12px] font-bold " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{m.brand}</span>
                    <span className="text-[13px] font-extrabold tabular-nums text-gray-900 dark:text-gray-50">{m.eff?.toFixed(2)}<span className="ml-0.5 text-[9px] font-medium text-gray-400">{cur.metric}</span></span>
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-gray-500 dark:text-gray-400" title={m.model}>{m.model || "—"} · {m.kwh != null ? Math.round(m.kwh) + "kWh/월" : ""}</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p className="text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">
        출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · {cur.metric} 높을수록 고효율 · 5성=최고효율 등급 비중 · <b className="text-gray-500 dark:text-gray-400">활용</b> LG 효율 순위·리더 격차로 차기 모델 목표 스펙·프리미엄 소구 포인트 도출
      </p>
    </div>
  )
}
