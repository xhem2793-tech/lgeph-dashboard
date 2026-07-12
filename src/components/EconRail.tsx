"use client"

import React from "react"
import { homeBand, econSpark, competitorMovers } from "@/lib/supabase"

/** 경제지표 + 가격 레일 — 야후 Trending tickers 어법(테두리 카드 · 미니차트 · 변화폭).
 *
 *  ■ 색은 방향이 아니라 **사업영향** 기준 (BRANDING_GUIDE §4.1)
 *   dir='bad'  : 오르면 나쁜 지표(환율·유가·물가) → 상승 = 로즈
 *   dir='good' : 오르면 좋은 지표(송금·소비심리) → 하락 = 로즈
 *   단순 상승=녹색 금지.
 *
 *  ■ 미니차트는 최근 12개 관측치. 축·눈금 없음(장식 아님, 추세만 읽는 용도).
 *  ■ 지표만으로는 "우리 시장"이 안 보여 오늘의 가격 변화를 같은 카드에 붙임.
 */
type Card = Awaited<ReturnType<typeof homeBand>>[number]
type Mover = Awaited<ReturnType<typeof competitorMovers>>[number]

function impact(c: Card): { cls: string; arrow: string; bad: boolean } {
  if (c.delta == null || c.dir === "neutral" || c.delta === 0)
    return { cls: "text-gray-400", arrow: "", bad: false }
  const up = c.delta > 0
  const bad = c.dir === "bad" ? up : !up
  return {
    cls: bad ? "text-rose-600" : "text-emerald-600",
    arrow: up ? "↑" : "↓",
    bad,
  }
}
const unit = (l: string) => (l.includes("%p") ? "%p" : "%")

/** 미니 스파크라인 — 값 그대로, 스케일만 정규화 */
function Spark({ pts, bad }: { pts: number[]; bad: boolean }) {
  if (!pts || pts.length < 2) return <div className="h-[22px] w-[56px]" />
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const W = 56
  const H = 22
  const step = W / (pts.length - 1)
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(H - ((v - min) / span) * (H - 4) - 2).toFixed(1)}`)
    .join(" ")
  const stroke = bad ? "#e11d48" : "#059669"
  const fill = bad ? "rgba(225,29,72,.10)" : "rgba(5,150,105,.10)"
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export default function EconRail() {
  const [rows, setRows] = React.useState<Card[] | null>(null)
  const [spark, setSpark] = React.useState<Record<string, number[]>>({})
  const [movers, setMovers] = React.useState<Mover[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    Promise.all([homeBand(), econSpark(), competitorMovers(40)])
      .then(([b, s, m]) => {
        setRows(b)
        setSpark(s)
        // 오늘 실제로 움직인 것만, 변동폭 큰 순
        setMovers(
          m
            .filter((x) => x.pct != null && x.pct !== 0)
            .sort((a, b2) => Math.abs(b2.pct) - Math.abs(a.pct))
            .slice(0, 5),
        )
      })
      .catch(() => setErr(true))
  }, [])

  return (
    <section className="rounded-xl border border-gray-200 bg-white" style={{ animation: "fadeUp .5s ease both" }}>
      <header className="flex items-baseline justify-between border-b border-gray-100 px-3 py-2.5">
        <h2 className="text-[16px] font-bold tracking-tight text-gray-900">경제지표</h2>
        <a
          href="/economy"
          className="text-[11px] text-gray-400 transition-colors duration-200 hover:text-indigo-600"
        >
          상세 ›
        </a>
      </header>

      {err ? (
        <p className="px-3 py-6 text-center text-[12px] text-gray-400">지표를 불러오지 못함 · 확인 필요</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {(rows ?? Array.from({ length: 8 })).map((c, i) =>
            !c ? (
              <div key={i} className="h-[42px]" />
            ) : (
              <div key={c.key} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-gray-700">{c.label}</p>
                  <p className="text-[10px] text-gray-400">
                    {c.asOf?.slice(5).replace("-", "/")} · {c.freq}
                  </p>
                </div>

                <Spark pts={spark[c.key] ?? []} bad={impact(c).bad} />

                <div className="w-[92px] shrink-0 text-right">
                  <p className="text-[14px] font-bold tabular-nums text-gray-900">
                    {c.prefix}
                    {c.value}
                  </p>
                  {c.delta != null && c.delta !== 0 ? (
                    <p className={"text-[11px] font-semibold tabular-nums " + impact(c).cls}>
                      {Math.abs(c.delta).toFixed(1)}
                      {unit(c.deltaLabel ?? "")}
                      {impact(c).arrow}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">보합</p>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* 가격 변화 — 지표만 보면 우리 시장이 안 보인다 */}
      <div className="border-t border-gray-200">
        <header className="flex items-baseline justify-between px-3 py-2.5">
          <h3 className="text-[14px] font-bold tracking-tight text-gray-900">오늘의 가격 변화</h3>
          <a
            href="/competitors"
            className="text-[11px] text-gray-400 transition-colors duration-200 hover:text-indigo-600"
          >
            전체 ›
          </a>
        </header>

        {movers && movers.length === 0 ? (
          <p className="px-3 pb-3 text-[12px] text-gray-400">오늘 가격 변동 없음</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {(movers ?? Array.from({ length: 3 })).map((m, i) =>
              !m ? (
                <div key={i} className="h-[38px]" />
              ) : (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-gray-700">
                      {m.brand} {m.category}
                    </p>
                    <p className="truncate text-[10px] text-gray-400">{m.retailer}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-bold tabular-nums text-gray-900">
                      ₱{Number(m.promo).toLocaleString()}
                    </p>
                    <p
                      className={
                        "text-[11px] font-semibold tabular-nums " +
                        (m.pct < 0 ? "text-emerald-600" : "text-rose-600")
                      }
                    >
                      {Math.abs(m.pct).toFixed(1)}%{m.pct < 0 ? "↓" : "↑"}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <p className="border-t border-gray-100 px-3 py-2 text-[10px] leading-snug text-gray-400">
        색은 <b className="font-semibold text-gray-500">사업영향</b> 기준 · 원가·물가↑는 로즈,
        수요·구매력 개선은 에메랄드 (단순 상승=녹색 아님)
      </p>
    </section>
  )
}
