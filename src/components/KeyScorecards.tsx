"use client"

import React, { useEffect, useState } from "react"
import { latestMacro } from "@/lib/supabase"

/** 대표 지표 스코어카드 — 핵심 요약의 '한 화면' 거시 요약. 상세는 각 도메인 뷰로. */

type Card = { key: string; label: string; unit?: string; pre?: string; dec?: number; accent: string; tf?: (v: number) => number }
type Group = { title: string; cards: Card[] }

const GROUPS: Group[] = [
  {
    title: "성장·소비",
    cards: [
      { key: "gdp_growth_yoy", label: "GDP 성장률", unit: "%", dec: 1, accent: "indigo" },
      { key: "household_consumption_yoy", label: "민간소비", unit: "%", dec: 1, accent: "indigo" },
      { key: "gdp_per_capita_usd", label: "1인당 GDP", pre: "$", dec: 0, accent: "indigo" },
      { key: "residential_property_price_yoy", label: "주택가격", unit: "%", dec: 1, accent: "indigo" },
    ],
  },
  {
    title: "물가·원가",
    cards: [
      { key: "INF_all_items", label: "소비자물가", unit: "%", dec: 1, accent: "rose" },
      { key: "INF_household_appliances", label: "가전 물가", unit: "%", dec: 1, accent: "rose" },
      { key: "PPI_domestic_appliances", label: "가전 PPI", unit: "%", dec: 1, accent: "rose" },
    ],
  },
  {
    title: "금융·대외",
    cards: [
      { key: "policy_rate_monthly", label: "정책금리", unit: "%", dec: 2, accent: "blue" },
      { key: "consumer_loan_growth_yoy", label: "소비자대출", unit: "%", dec: 1, accent: "blue" },
      { key: "reserves_usd", label: "외환보유액", pre: "$", unit: "B", dec: 0, accent: "blue", tf: (v) => v / 1e9 },
    ],
  },
  {
    title: "고용·심리",
    cards: [
      { key: "unemployment_rate", label: "실업률", unit: "%", dec: 1, accent: "emerald" },
      { key: "ofw_cash_remittance_growth_yoy", label: "OFW 송금", unit: "%", dec: 1, accent: "emerald" },
      { key: "consumer_confidence_index", label: "소비자심리", dec: 1, accent: "violet" },
      { key: "economic_sentiment_composite", label: "경제심리지수", dec: 1, accent: "violet" },
    ],
  },
]

const DOT: Record<string, string> = { indigo: "bg-indigo-500", rose: "bg-rose-500", blue: "bg-blue-500", emerald: "bg-emerald-500", violet: "bg-violet-500" }
const ALL_KEYS = GROUPS.flatMap((g) => g.cards.map((c) => c.key))

function ym(d?: string) { return d ? d.slice(2, 4) + "." + Number(d.slice(5, 7)) : "" }

export default function KeyScorecards() {
  const [data, setData] = useState<Record<string, { value: number; date: string }>>({})
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { latestMacro(ALL_KEYS).then((m) => { setData(m); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  return (
    <section className="mt-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
        <span className="h-[18px] w-1 rounded bg-indigo-500" />
        <h2 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-gray-50">대표 지표 요약</h2>
        <span className="text-[12px] font-semibold text-gray-400 dark:text-gray-500">거시 핵심지표 최신값 한 화면 — 상세는 좌측 각 도메인 뷰</span>
      </header>
      <div className="flex flex-col gap-3.5">
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{g.title}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {g.cards.map((c, i) => {
                const d = data[c.key]
                const v = d ? (c.tf ? c.tf(d.value) : d.value) : null
                return (
                  <div key={c.key} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both", animationDelay: (gi * 4 + i) * 0.02 + "s" }}>
                    <div className="flex items-center gap-1.5">
                      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (DOT[c.accent] || DOT.indigo)} />
                      <span className="truncate text-[12px] font-medium text-gray-500 dark:text-gray-400">{c.label}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1 tabular-nums">
                      <span className="text-[20px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
                        {!loaded ? "—" : v == null ? "—" : (c.pre ?? "") + v.toLocaleString(undefined, { maximumFractionDigits: c.dec ?? 1, minimumFractionDigits: c.dec ?? 0 }) + (c.unit ?? "")}
                      </span>
                      {d && <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{ym(d.date)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        출처 PSA·BSP·World Bank·IMF·BIS 공식통계 · 최신 발표값 기준 · 각 지표 상세·시계열은 좌측 도메인 뷰에서
      </p>
    </section>
  )
}
