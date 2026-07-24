"use client"

import React, { useEffect, useMemo, useState } from "react"
import { pricesDomain } from "@/lib/supabase"
import type { PricesDomain } from "@/lib/supabase"

/** 지역 × 품목 물가 히트맵 + 지역 물가 분포 — 옛 물가 페이지에서 이관(임시).
 *  지역시장 지도 아래에 배치. 데이터 = pricesDomain().region(v_cost_of_living_regional). */

const num = (s: string | number | undefined) => {
  const v = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(v) ? v : 0
}

export default function RegionPriceExtras() {
  const [data, setData] = useState<PricesDomain | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    pricesDomain().then(setData).catch(() => setData({ idx: {}, forecast: [], policyRate: null, region: [] }))
  }, [])
  useEffect(() => {
    if (!data) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
    return () => cancelAnimationFrame(id)
  }, [data])

  const cols: [string, string][] = [["전체", "inf_all_items"], ["식품", "inf_food"], ["쌀", "inf_rice"], ["전기", "inf_electricity"], ["가전", "inf_appliances"], ["에어컨", "inf_aircon"]]
  const region = data?.region ?? []
  const rows = useMemo(() => [...region].sort((a, b) => num(b.inf_all_items) - num(a.inf_all_items)), [region])
  const regVals = rows.map((r) => num(r.inf_all_items)).filter((v) => v > 0)
  const rMean = regVals.length ? regVals.reduce((a, b) => a + b, 0) / regVals.length : 0
  const rLo = regVals.length ? Math.min(...regVals) : 0
  const rHi = regVals.length ? Math.max(...regVals) : 0
  const shade = (v: number) => "rgba(225,29,72," + (0.06 + Math.max(0, Math.min(1, v / 25)) * 0.82).toFixed(3) + ")"

  if (!data || !rows.length) return null

  return (
    <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 pb-2.5">
          <span className="h-[18px] w-1 rounded bg-indigo-500" />
          <h2 className="text-[15px] font-bold tracking-tight text-gray-900">지역 × 품목 물가</h2>
          <span className="text-[11px] font-semibold text-gray-400">전년비 % · 물가 높은 순 · 임시(지역 물가 상세)</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <div className="grid min-w-[440px] gap-1" style={{ gridTemplateColumns: "auto repeat(6,1fr)" }}>
            <div />
            {cols.map(([c]) => <div key={c} className="pb-1 text-center text-[11px] font-medium text-gray-400">{c}</div>)}
            {rows.map((r, ri) => (
              <React.Fragment key={ri}>
                <div className="flex items-center justify-end pr-2 text-right text-[11px] text-gray-600">{String(r.geo).replace(/\(.*/, "").replace("Region ", "").trim().slice(0, 12)}</div>
                {cols.map(([, key], ci) => {
                  const v = num(r[key])
                  const t = Math.max(0, Math.min(1, v / 25))
                  return <div key={key} className="flex h-7 items-center justify-center rounded text-[11px] font-medium tabular-nums" style={{ background: shade(v), color: t > 0.55 ? "#fff" : "#334155", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "scale(.9)", transition: "all .4s ease " + ((ri * 6 + ci) * 0.015) + "s" }}>{v.toFixed(1)}</div>
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <p className="mt-3 border-t border-gray-100 pt-2 text-[10px] text-gray-400">자료 PSA 지역별 CPI(v_cost_of_living_regional) · 전년비</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <h2 className="text-[15px] font-bold text-gray-900">지역 물가 분포 <span className="text-[11px] font-normal text-gray-400">전국 {rows.length}곳</span></h2>
        <div className="mt-3 flex gap-5">
          <div><p className="text-[11px] text-gray-400">평균</p><p className="text-[22px] font-bold tabular-nums text-gray-900">{rMean.toFixed(1)}<span className="text-[12px] text-gray-400">%</span></p></div>
          <div><p className="text-[11px] text-gray-400">범위</p><p className="text-[22px] font-bold tabular-nums text-gray-900">{rLo.toFixed(1)}–{rHi.toFixed(1)}</p></div>
        </div>
        <div className="relative mt-5 h-12">
          <div className="absolute inset-x-0 bottom-4 border-t border-gray-200" />
          <div className="absolute bottom-1 top-0 border-l border-dashed border-rose-400" style={{ left: (((rMean - rLo) / (rHi - rLo || 1)) * 100) + "%" }} />
          {regVals.map((v, i) => (
            <div key={i} className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-indigo-400/60" style={{ left: (((v - rLo) / (rHi - rLo || 1)) * 100) + "%", top: 8 + (i % 3) * 8, opacity: mounted ? 1 : 0, transform: mounted ? "none" : "scale(0)", transition: "all .45s cubic-bezier(.22,1,.36,1) " + (i * 0.03) + "s" }} />
          ))}
          <span className="absolute bottom-0 left-0 text-[10px] text-gray-400">{rLo.toFixed(1)}%</span>
          <span className="absolute bottom-0 right-0 text-[10px] text-gray-400">{rHi.toFixed(1)}%</span>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">지역 편차 {(rHi - rLo).toFixed(1)}%p · 점선=전국 평균</p>
      </section>
    </div>
  )
}
