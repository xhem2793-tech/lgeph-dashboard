"use client"

import React, { useEffect, useMemo, useState } from "react"
import { energyLabels, type EnergyRow } from "@/lib/supabase"

/** 에너지 라벨 — 미니멀. 사용자 질문: "LG가 어디에 서 있나". 단일 hero 차트(브랜드 효율 랭킹) + 핵심 인사이트 1줄 + 벤치마크. */

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF" },
  { key: "ref", label: "냉장고", metric: "EEF" },
  { key: "tvl", label: "TV", metric: "EER" },
  { key: "cwm", label: "세탁기", metric: "EER" },
]
type Agg = { brand: string; n: number; eff: number; s5: number }

export default function EnergyLabelView() {
  const [rows, setRows] = useState<EnergyRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cat, setCat] = useState("acu")
  useEffect(() => { energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const cur = CATS.find((c) => c.key === cat)!
  const catRows = useMemo(() => rows.filter((r) => r.category === cat && r.brand), [rows, cat])
  const baseline5 = useMemo(() => { const s = catRows.filter((r) => r.star != null); return s.length ? s.filter((r) => (r.star ?? 0) >= 5).length / s.length * 100 : 0 }, [catRows])
  const agg = useMemo<Agg[]>(() => {
    const by: Record<string, EnergyRow[]> = {}
    for (const r of catRows) (by[r.brand] = by[r.brand] || []).push(r)
    return Object.entries(by).map(([brand, rs]) => {
      const effs = rs.map((r) => r.eff).filter((v): v is number => v != null && v > 0)
      const st = rs.filter((r) => r.star != null)
      return { brand, n: rs.length, eff: effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : 0, s5: st.length ? st.filter((r) => (r.star ?? 0) >= 5).length / st.length * 100 : 0 }
    }).filter((a) => a.n >= 5).sort((a, b) => b.eff - a.eff)
  }, [catRows])

  const lg = agg.find((a) => /^lg$/i.test(a.brand))
  const lgRank = lg ? agg.indexOf(lg) + 1 : 0
  const leader = agg[0]
  const gap = lg && leader ? ((leader.eff - lg.eff) / lg.eff) * 100 : null
  const avg = agg.length ? agg.reduce((s, a) => s + a.eff, 0) / agg.length : 0
  const maxEff = Math.max(...agg.map((a) => a.eff), 1)
  const top = agg.slice(0, 12)
  const topModels = useMemo(() => [...catRows].filter((r) => r.eff != null && r.eff > 0).sort((a, b) => (b.eff ?? 0) - (a.eff ?? 0)).slice(0, 3), [catRows])

  const rowH = 30, padL = 96, padR = 52, W = 760, H = top.length * rowH + 8
  const bx = (v: number) => padL + (W - padL - padR) * (v / maxEff)

  return (
    <div className="flex flex-col gap-5">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>

      {/* 헤더 + 카테고리 탭 */}
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both" }}>
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">에너지 효율</h1>
          <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">DOE 에너지효율 라벨 · 브랜드별 {cur.metric}(높을수록 고효율)</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-800 p-0.5">
          {CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)} className={"rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all " + (cat === c.key ? "bg-teal-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400")}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* LG 한 줄 요약 */}
      {loaded && lg && leader && (
        <p className="text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-200" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".04s" }}>
          LG {cur.label} 효율 <b className="text-teal-600 dark:text-teal-400">{agg.length}개사 중 {lgRank}위</b> · 리더 {leader.brand}({leader.eff.toFixed(2)}) 대비 <b>{gap != null ? gap.toFixed(0) : "—"}% 낮음</b> · 5성 <b className="text-teal-600 dark:text-teal-400">{lg.s5.toFixed(0)}%</b>{lg.s5 >= baseline5 ? " (시장평균 이상)" : " (시장평균 " + baseline5.toFixed(0) + "% 미만)"}
        </p>
      )}

      {/* HERO — 브랜드 효율 랭킹 */}
      <div style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".08s" }}>
        {!loaded ? <div className="h-[360px] animate-pulse rounded-xl bg-gray-50 dark:bg-gray-800/40" /> : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }}>
            <line x1={bx(avg)} y1="0" x2={bx(avg)} y2={H - 4} stroke={"#cbd5e1"} strokeWidth="1" strokeDasharray="3 3" />
            <text x={bx(avg)} y={H} textAnchor="middle" fontSize="9.5" fill="#94a3b8">평균 {avg.toFixed(2)}</text>
            {top.map((a, i) => {
              const isLG = /^lg$/i.test(a.brand), y = i * rowH, col = isLG ? "#0d9488" : i === 0 ? "#5eead4" : "#e2e8f0"
              return (
                <g key={a.brand}>
                  <text x={padL - 8} y={y + rowH / 2 + 4} textAnchor="end" fontSize="12" fontWeight={isLG ? 800 : 500} className={isLG ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{a.brand}</text>
                  <rect x={padL} y={y + 5} width={Math.max(2, bx(a.eff) - padL)} height={rowH - 12} rx="4" fill={col} className={isLG ? "" : "dark:opacity-30"} style={{ animation: "grow .5s cubic-bezier(.16,1,.3,1) both", animationDelay: (i * 0.03) + "s", transformOrigin: `${padL}px 0` }} />
                  <text x={bx(a.eff) + 6} y={y + rowH / 2 + 4} fontSize="12" fontWeight={isLG ? 800 : 600} className={isLG ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-600 dark:fill-gray-300"}>{a.eff.toFixed(2)}{isLG ? "  ★LG" : ""}</text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* 인사이트 1줄 (왜) */}
      {loaded && lg && (
        <p className="rounded-lg bg-gray-50 dark:bg-gray-800/40 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".12s" }}>
          <b className="text-gray-800 dark:text-gray-100">읽는 법</b> · {cur.label} 시장 5성 비중은 <b>{baseline5.toFixed(0)}%</b>{baseline5 < 25 ? "로 5성이 원래 드묾" : baseline5 >= 60 ? "로 5성이 사실상 표준" : ""}. LG는 {lg.n}개 풀라인업(보급~프리미엄)이라 5성% 절대값보다 <b className="text-teal-600 dark:text-teal-400">시장평균 대비·최고효율 격차</b>로 판단 → 플래그십에서 리더 격차 {gap != null ? gap.toFixed(0) : "—"}% 축소가 목표.
        </p>
      )}

      {/* 벤치마크 모델 (컴팩트) */}
      {loaded && topModels.length > 0 && (
        <div style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".16s" }}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">최고효율 벤치마크</p>
          <div className="flex flex-wrap gap-2">
            {topModels.map((m, i) => { const isLG = /^lg$/i.test(m.brand); return (
              <div key={i} className={"flex items-center gap-2 rounded-lg border px-3 py-1.5 " + (isLG ? "border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/10" : "border-gray-200 dark:border-gray-800")}>
                <span className={"text-[12px] font-bold " + (isLG ? "text-teal-600 dark:text-teal-400" : "text-gray-700 dark:text-gray-200")}>{m.brand}</span>
                <span className="text-[13px] font-extrabold tabular-nums text-gray-900 dark:text-gray-50">{m.eff?.toFixed(2)}</span>
                <span className="text-[10.5px] text-gray-400 dark:text-gray-500">{cur.metric}</span>
              </div>
            ) })}
          </div>
        </div>
      )}

      <p className="text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · {cur.metric} 높을수록 고효율</p>
    </div>
  )
}
