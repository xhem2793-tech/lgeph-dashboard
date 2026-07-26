"use client"

import React, { useEffect, useMemo, useState } from "react"
import { energyLabels, type EnergyRow } from "@/lib/supabase"

/** 에너지 효율 — 스펙(용량·화면)별 세그먼트 내에서 브랜드 효율 비교. 전체 평균은 왜곡되므로 같은 스펙끼리 비교. */

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF", specUnit: "냉방용량" },
  { key: "ref", label: "냉장고", metric: "EEF", specUnit: "용량" },
  { key: "tvl", label: "TV", metric: "EER", specUnit: "화면" },
  { key: "cwm", label: "세탁기", metric: "EER", specUnit: "" },
]
const SEG: Record<string, { k: string; lo: number; hi: number }[]> = {
  acu: [{ k: "1HP급", lo: 0, hi: 3.4 }, { k: "1.5HP급", lo: 3.4, hi: 5.2 }, { k: "2HP급", lo: 5.2, hi: 6.9 }, { k: "2.5HP+", lo: 6.9, hi: Infinity }],
  ref: [{ k: "~200L", lo: 0, hi: 200 }, { k: "200~299L", lo: 200, hi: 300 }, { k: "300~399L", lo: 300, hi: 400 }, { k: "400L+", lo: 400, hi: Infinity }],
  tvl: [{ k: '~32"', lo: 0, hi: 33 }, { k: '39~43"', lo: 33, hi: 44 }, { k: '48~50"', lo: 44, hi: 51 }, { k: '55"+', lo: 51, hi: Infinity }],
  cwm: [{ k: "전체", lo: 0, hi: Infinity }],
}
type Agg = { brand: string; n: number; eff: number }

export default function EnergyLabelView() {
  const [rows, setRows] = useState<EnergyRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cat, setCat] = useState("acu")
  const [segIdx, setSegIdx] = useState(0)
  useEffect(() => { energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const cur = CATS.find((c) => c.key === cat)!
  const segs = SEG[cat] || SEG.cwm
  const catRows = useMemo(() => rows.filter((r) => r.category === cat && r.brand && r.eff != null && r.eff > 0), [rows, cat])
  const segCounts = useMemo(() => segs.map((s) => catRows.filter((r) => r.spec != null && r.spec >= s.lo && r.spec < s.hi).length), [catRows, segs])

  // 카테고리 변경 시 모델 가장 많은 세그먼트로
  useEffect(() => { if (!segCounts.length) return; const best = segCounts.indexOf(Math.max(...segCounts)); setSegIdx(best < 0 ? 0 : best) }, [cat, loaded]) // eslint-disable-line

  const seg = segs[segIdx] || segs[0]
  const segRows = useMemo(() => catRows.filter((r) => cat === "cwm" || (r.spec != null && r.spec >= seg.lo && r.spec < seg.hi)), [catRows, seg, cat])
  const agg = useMemo<Agg[]>(() => {
    const by: Record<string, EnergyRow[]> = {}
    for (const r of segRows) (by[r.brand] = by[r.brand] || []).push(r)
    return Object.entries(by).map(([brand, rs]) => ({ brand, n: rs.length, eff: rs.reduce((a, b) => a + (b.eff ?? 0), 0) / rs.length })).filter((a) => a.n >= 2).sort((a, b) => b.eff - a.eff)
  }, [segRows])

  const lg = agg.find((a) => /^lg$/i.test(a.brand))
  const lgRank = lg ? agg.indexOf(lg) + 1 : 0
  const leader = agg[0]
  const gap = lg && leader ? ((leader.eff - lg.eff) / lg.eff) * 100 : null
  const avg = agg.length ? agg.reduce((s, a) => s + a.eff, 0) / agg.length : 0
  const maxEff = Math.max(...agg.map((a) => a.eff), 1)
  const top = agg.slice(0, 10)
  const topModels = useMemo(() => [...segRows].sort((a, b) => (b.eff ?? 0) - (a.eff ?? 0)).slice(0, 3), [segRows])

  const rowH = 30, padL = 92, padR = 50, W = 760, H = Math.max(1, top.length) * rowH + 8
  const bx = (v: number) => padL + (W - padL - padR) * (v / maxEff)

  return (
    <div className="flex flex-col gap-5">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>

      <div className="flex flex-wrap items-center justify-between gap-3" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both" }}>
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">에너지 효율</h1>
          <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">DOE 에너지효율 라벨 · <b className="text-gray-600 dark:text-gray-300">같은 {cur.specUnit || "스펙"} 세그먼트 내</b> 브랜드 {cur.metric} 비교(높을수록 고효율)</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-800 p-0.5">
          {CATS.map((c) => (<button key={c.key} onClick={() => setCat(c.key)} className={"rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all " + (cat === c.key ? "bg-teal-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400")}>{c.label}</button>))}
        </div>
      </div>

      {/* 스펙 세그먼트 선택 */}
      {cat !== "cwm" && (
        <div className="flex flex-wrap items-center gap-1.5" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".03s" }}>
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{cur.specUnit}</span>
          {segs.map((s, i) => (
            <button key={s.k} onClick={() => setSegIdx(i)} disabled={!segCounts[i]} className={"rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all disabled:opacity-30 " + (segIdx === i ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600")}>{s.k}<span className="ml-1 text-[10px] font-normal opacity-60">{segCounts[i]}</span></button>
          ))}
        </div>
      )}

      {loaded && lg && leader ? (
        <p className="text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-200" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".05s" }}>
          <b className="text-gray-900 dark:text-gray-50">{cur.label} · {seg.k}</b> — LG 효율 <b className="text-teal-600 dark:text-teal-400">{agg.length}개사 중 {lgRank}위</b>({lg.eff.toFixed(2)}), 세그먼트 리더 {leader.brand}({leader.eff.toFixed(2)}) 대비 <b>{gap != null ? gap.toFixed(0) : "—"}% {gap != null && gap > 0 ? "낮음" : "높음"}</b>
        </p>
      ) : loaded ? (
        <p className="text-[13px] text-gray-500 dark:text-gray-400">이 세그먼트에 LG 등록 모델 없음 · 브랜드 비교만 표시</p>
      ) : null}

      {/* HERO — 세그먼트 내 브랜드 효율 랭킹 */}
      <div style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".08s" }}>
        {!loaded ? <div className="h-[320px] animate-pulse rounded-xl bg-gray-50 dark:bg-gray-800/40" /> : top.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[13px] text-gray-400">이 세그먼트 데이터 부족</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }}>
            <line x1={bx(avg)} y1="0" x2={bx(avg)} y2={H - 4} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
            <text x={bx(avg)} y={H} textAnchor="middle" fontSize="9.5" fill="#94a3b8">세그먼트 평균 {avg.toFixed(2)}</text>
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

      {loaded && agg.length > 0 && (
        <p className="rounded-lg bg-gray-50 dark:bg-gray-800/40 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".12s" }}>
          <b className="text-gray-800 dark:text-gray-100">왜 세그먼트별인가</b> · {cur.metric}는 {cur.specUnit || "스펙"}에 따라 기준이 달라 전체 평균은 왜곡됨. <b>같은 {seg.k}</b>끼리 비교해야 실제 경쟁력 — 이 세그먼트에서 {lg ? <>LG는 리더 대비 {gap != null ? Math.abs(gap).toFixed(0) : "—"}% {gap != null && gap > 0 ? "뒤처져 차기 개선 타깃" : "앞서 프리미엄 소구 가능"}</> : "LG 라인업 보강 여지"}.
        </p>
      )}

      {loaded && topModels.length > 0 && (
        <div style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".16s" }}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{seg.k} 최고효율 모델</p>
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

      <p className="text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · 세그먼트=냉방용량(에어컨)·용량(냉장고)·화면(TV) · 같은 세그먼트 내 브랜드 평균 {cur.metric}</p>
    </div>
  )
}
