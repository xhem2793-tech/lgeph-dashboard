"use client"

import React from "react"
import { homeBand } from "@/lib/supabase"

/** 경제지표 — 우측 sticky 레일.
 *  원가(환율·유가·전기요금) / 물가 / 수요(송금·소비심리·내구재의향) / 리스크(태풍)
 *
 *  색은 방향이 아니라 **사업영향** 기준 (BRANDING_GUIDE §4.1):
 *   dir='bad'  → 값↑이면 원가·물가 압력 = 로즈
 *   dir='good' → 값↑이면 수요·구매력 개선 = 에메랄드
 *  단순 상승=녹색 금지.
 */
type Card = Awaited<ReturnType<typeof homeBand>>[number]

function impact(c: Card): { cls: string; arrow: string } {
  if (c.delta == null || c.dir === "neutral" || c.delta === 0)
    return { cls: "text-gray-400", arrow: "" }
  const up = c.delta > 0
  const bad = c.dir === "bad" ? up : !up
  return { cls: bad ? "text-rose-600" : "text-emerald-600", arrow: up ? "↑" : "↓" }
}
const unit = (l: string) => (l.includes("%p") ? "%p" : "%")

export default function EconRail() {
  const [rows, setRows] = React.useState<Card[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    homeBand().then(setRows).catch(() => setErr(true))
  }, [])

  return (
    <section className="animate-[fadeUp_.5s_ease]">
      <header className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-[13px] font-bold tracking-tight text-gray-900">경제지표</h2>
        <a href="/economy" className="text-[9.5px] text-indigo-600 transition-colors duration-200 hover:text-indigo-700">
          상세 ›
        </a>
      </header>

      <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1">
        {err ? (
          <p className="py-4 text-center text-[10px] text-gray-400">불러오지 못함</p>
        ) : (
          (rows ?? Array.from({ length: 8 })).map((c, i) => {
            if (!c) return <div key={i} className="h-[26px] border-b border-gray-50" />
            const im = impact(c)
            return (
              <div
                key={c.key}
                className="flex items-baseline justify-between border-b border-gray-50 py-[5px] last:border-0"
                style={{ animation: "fadeUp .5s ease both", animationDelay: `${i * 0.03}s` }}
              >
                <span className="truncate text-[9.5px] text-gray-500">{c.label}</span>
                <span className="shrink-0 whitespace-nowrap">
                  <b className="text-[11px] font-bold text-gray-900">
                    {c.prefix}
                    {c.value}
                  </b>
                  <span className={"ml-1 text-[9px] " + im.cls}>
                    {c.delta == null || c.dir === "neutral" ? (
                      <span className="text-gray-400">
                        {c.deltaLabel} {c.delta ?? "—"}
                      </span>
                    ) : (
                      <>
                        {Math.abs(c.delta).toFixed(1)}
                        {unit(c.deltaLabel)}
                        {im.arrow}
                      </>
                    )}
                  </span>
                </span>
              </div>
            )
          })
        )}
      </div>

      <p className="mt-1.5 text-[8.5px] leading-relaxed text-gray-400">
        색은 <b className="font-semibold text-gray-500">사업영향</b> 기준 — 원가·물가↑는 로즈,
        수요·구매력 개선은 에메랄드. 단순 상승=녹색 아님
      </p>
    </section>
  )
}
