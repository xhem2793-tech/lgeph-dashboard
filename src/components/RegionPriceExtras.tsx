"use client"

import React, { useEffect, useMemo, useState } from "react"
import { pricesDomain, regionMetric } from "@/lib/supabase"
import type { PricesDomain } from "@/lib/supabase"

/** 지역시장 지도 아래 지역별 상세 — 카테고리(물가·인구)별로 크게 나누고 그 안에서 세부 표시.
 *  물가 = pricesDomain().region(v_cost_of_living_regional). 인구 = macro_indicators(geo_level=region, 2020 센서스). */

const num = (s: string | number | undefined) => {
  const v = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(v) ? v : 0
}
const shortGeo = (g: string | number) => String(g).replace(/\(.*/, "").replace("Region ", "").trim().slice(0, 14)

type Cat = "price" | "pop" | "income"
const CATS: { k: Cat; label: string; sub: string }[] = [
  { k: "price", label: "지역 물가", sub: "지역×품목 CPI·물가 분포" },
  { k: "pop", label: "인구·가구", sub: "지역별 인구·가구수 (2020 센서스)" },
  { k: "income", label: "소득·빈곤", sub: "지역별 빈곤율 (2023 FIES)" },
]

export default function RegionPriceExtras() {
  const [data, setData] = useState<PricesDomain | null>(null)
  const [pop, setPop] = useState<Record<string, Record<string, number>>>({})
  const [cat, setCat] = useState<Cat>("price")
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    pricesDomain().then(setData).catch(() => setData({ idx: {}, forecast: [], policyRate: null, region: [] }))
    regionMetric(["population_region", "households_region", "poverty_rate_region", "household_income_region"]).then(setPop).catch(() => setPop({}))
  }, [])
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
    return () => cancelAnimationFrame(id)
  }, [cat])

  const cols: [string, string][] = [["전체", "inf_all_items"], ["식품", "inf_food"], ["쌀", "inf_rice"], ["전기", "inf_electricity"], ["가전", "inf_appliances"], ["에어컨", "inf_aircon"]]
  const region = data?.region ?? []
  const rows = useMemo(() => [...region].sort((a, b) => num(b.inf_all_items) - num(a.inf_all_items)), [region])
  const regVals = rows.map((r) => num(r.inf_all_items)).filter((v) => v > 0)
  const rMean = regVals.length ? regVals.reduce((a, b) => a + b, 0) / regVals.length : 0
  const rLo = regVals.length ? Math.min(...regVals) : 0
  const rHi = regVals.length ? Math.max(...regVals) : 0
  const shade = (v: number) => "rgba(225,29,72," + (0.06 + Math.max(0, Math.min(1, v / 25)) * 0.82).toFixed(3) + ")"

  // 인구 랭킹
  const popData = pop.population_region ?? {}
  const popRows = useMemo(() => Object.entries(popData).map(([geo, v]) => ({ geo, pop: v, hh: (pop.households_region ?? {})[geo] ?? 0 })).sort((a, b) => b.pop - a.pop), [pop])
  const popMax = popRows.length ? popRows[0].pop : 1
  const popTotal = popRows.reduce((a, b) => a + b.pop, 0)
  const hhTotal = popRows.reduce((a, b) => a + b.hh, 0)

  // 소득·빈곤 랭킹(빈곤율 낮은 순 = 소득 상위) + 평균 가구소득
  const povData = pop.poverty_rate_region ?? {}
  const incData = pop.household_income_region ?? {}
  const povRows = useMemo(() => Object.entries(povData).map(([geo, v]) => ({ geo, pov: v, inc: incData[geo] ?? 0 })).sort((a, b) => a.pov - b.pov), [pop]) // eslint-disable-line react-hooks/exhaustive-deps
  const povMax = povRows.length ? Math.max(...povRows.map((r) => r.pov)) : 1
  const povNat = povRows.length ? povRows.reduce((a, b) => a + b.pov, 0) / povRows.length : 0

  if (!data) return null

  return (
    <div className="flex flex-col gap-3">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      {/* 카테고리 탭 */}
      <nav className="flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button key={c.k} type="button" onClick={() => setCat(c.k)}
            className={"flex flex-col items-start rounded-lg px-3.5 py-1.5 text-left transition-all duration-200 active:scale-[.98] " + (cat === c.k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300")}>
            <span className="text-[12.5px] font-bold">{c.label}</span>
            <span className={"text-[10px] " + (cat === c.k ? "text-indigo-100" : "text-gray-400 dark:text-gray-500")}>{c.sub}</span>
          </button>
        ))}
      </nav>

      {cat === "price" && rows.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <section className="min-w-0 overflow-hidden rounded-xl p-4" style={{ animation: "fadeUp .5s ease both" }}>
            <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
              <span className="h-[18px] w-1 rounded bg-indigo-500" />
              <h2 className="text-[14.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">지역 × 품목 물가</h2>
              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">전년비 % · 물가 높은 순</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="grid min-w-[440px] gap-1" style={{ gridTemplateColumns: "auto repeat(6,1fr)" }}>
                <div />
                {cols.map(([c]) => <div key={c} className="pb-1 text-center text-[11px] font-medium text-gray-400 dark:text-gray-500">{c}</div>)}
                {rows.map((r, ri) => (
                  <React.Fragment key={ri}>
                    <div className="flex items-center justify-end pr-2 text-right text-[11px] text-gray-600 dark:text-gray-300">{shortGeo(r.geo)}</div>
                    {cols.map(([, key], ci) => {
                      const v = num(r[key])
                      const t = Math.max(0, Math.min(1, v / 25))
                      return <div key={key} className="flex h-7 items-center justify-center rounded text-[11px] font-medium tabular-nums" style={{ background: shade(v), color: t > 0.55 ? "#fff" : "#334155", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "scale(.9)", transition: "all .4s ease " + ((ri * 6 + ci) * 0.015) + "s" }}>{v.toFixed(1)}</div>
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <p className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] text-gray-400 dark:text-gray-500">자료 PSA 지역별 CPI(v_cost_of_living_regional) · 전년비</p>
          </section>

          <section className="rounded-xl p-4" style={{ animation: "fadeUp .5s ease both" }}>
            <h2 className="text-[14.5px] font-bold text-gray-900 dark:text-gray-50">지역 물가 분포 <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">전국 {rows.length}곳</span></h2>
            <div className="mt-3 flex gap-5">
              <div><p className="text-[11px] text-gray-400 dark:text-gray-500">평균</p><p className="text-[21.5px] font-bold tabular-nums text-gray-900 dark:text-gray-50">{rMean.toFixed(1)}<span className="text-[12px] text-gray-400 dark:text-gray-500">%</span></p></div>
              <div><p className="text-[11px] text-gray-400 dark:text-gray-500">범위</p><p className="text-[21.5px] font-bold tabular-nums text-gray-900 dark:text-gray-50">{rLo.toFixed(1)}–{rHi.toFixed(1)}</p></div>
            </div>
            <div className="relative mt-5 h-12">
              <div className="absolute inset-x-0 bottom-4 border-t border-gray-200 dark:border-gray-800" />
              <div className="absolute bottom-1 top-0 border-l border-dashed border-rose-400" style={{ left: (((rMean - rLo) / (rHi - rLo || 1)) * 100) + "%" }} />
              {regVals.map((v, i) => (
                <div key={i} className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-indigo-400/60" style={{ left: (((v - rLo) / (rHi - rLo || 1)) * 100) + "%", top: 8 + (i % 3) * 8, opacity: mounted ? 1 : 0, transform: mounted ? "none" : "scale(0)", transition: "all .45s cubic-bezier(.22,1,.36,1) " + (i * 0.03) + "s" }} />
              ))}
              <span className="absolute bottom-0 left-0 text-[10px] text-gray-400 dark:text-gray-500">{rLo.toFixed(1)}%</span>
              <span className="absolute bottom-0 right-0 text-[10px] text-gray-400 dark:text-gray-500">{rHi.toFixed(1)}%</span>
            </div>
            <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">지역 편차 {(rHi - rLo).toFixed(1)}%p · 점선=전국 평균</p>
          </section>
        </div>
      )}

      {cat === "pop" && popRows.length > 0 && (
        <section className="min-w-0 overflow-hidden rounded-xl p-4" style={{ animation: "fadeUp .5s ease both" }}>
          <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[14.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">지역별 인구·가구</h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">2020 센서스 · 인구 많은 순</span>
            <span className="ml-auto text-[11px] font-semibold text-gray-500 dark:text-gray-400">전국 {(popTotal / 1e6).toFixed(1)}백만명 · {(hhTotal / 1e6).toFixed(1)}백만가구</span>
          </div>
          <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {popRows.map((r, i) => (
              <div key={r.geo} className="flex items-center gap-2" style={{ opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateX(-6px)", transition: "all .4s ease " + (i * 0.02) + "s" }}>
                <span className="w-24 shrink-0 truncate text-[11px] text-gray-600 dark:text-gray-300">{shortGeo(r.geo)}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                  <div className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-indigo-500 to-indigo-400" style={{ width: mounted ? (r.pop / popMax * 100) + "%" : "0%", transition: "width .7s cubic-bezier(.22,1,.36,1) " + (i * 0.02) + "s" }} />
                </div>
                <span className="w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums text-gray-800 dark:text-gray-100">{(r.pop / 1e6).toFixed(1)}M</span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] text-gray-400 dark:text-gray-500">자료 PSA 2020 인구주택총조사(CPH) · 지역별 총인구·가구수 · <b className="text-gray-500 dark:text-gray-400">인구 밀집 지역 = 가전 수요 최대 시장</b></p>
        </section>
      )}

      {cat === "income" && povRows.length > 0 && (
        <section className="min-w-0 overflow-hidden rounded-xl p-4" style={{ animation: "fadeUp .5s ease both" }}>
          <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[14.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">지역별 소득·빈곤</h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">2023 빈곤율(%) · 낮을수록 소득 상위</span>
            <span className="ml-auto text-[11px] font-semibold text-gray-500 dark:text-gray-400">전국 평균 {povNat.toFixed(1)}%</span>
          </div>
          <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {povRows.map((r, i) => {
              const t = Math.max(0, Math.min(1, r.pov / povMax))
              return (
                <div key={r.geo} className="flex items-center gap-2" style={{ opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateX(-6px)", transition: "all .4s ease " + (i * 0.02) + "s" }}>
                  <span className="w-24 shrink-0 truncate text-[11px] text-gray-600 dark:text-gray-300">{shortGeo(r.geo)}</span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                    <div className="absolute inset-y-0 left-0 rounded" style={{ width: mounted ? (r.pov / povMax * 100) + "%" : "0%", background: "rgba(225,29,72," + (0.35 + t * 0.5).toFixed(2) + ")", transition: "width .7s cubic-bezier(.22,1,.36,1) " + (i * 0.02) + "s" }} />
                  </div>
                  {r.inc > 0 && <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-gray-400 dark:text-gray-500">₱{Math.round(r.inc / 1000)}천</span>}
                  <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-gray-800 dark:text-gray-100">{r.pov.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] text-gray-400 dark:text-gray-500">자료 PSA FIES 빈곤통계(2023) · 지역별 빈곤율 · <b className="text-gray-500 dark:text-gray-400">저빈곤(고소득) 지역 = 프리미엄 가전 우선 시장</b></p>
        </section>
      )}
    </div>
  )
}
