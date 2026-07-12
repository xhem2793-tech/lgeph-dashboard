"use client"

import React from "react"
import { watchlist } from "@/lib/supabase"

/** 우리 위치 — 순위표가 아니라 **액션 목록**.
 *
 *  왜 순위표를 버렸나:
 *   · 선반 점유 16.1% = SKU 개수 기준. **매출 점유율이 아니다.**
 *     "우리 점유율 16%"로 읽히는 순간 사고다.
 *   · ASP 프리미엄 합산 평균은 폐기 — TV +77% / 에어컨 +9%를 평균 내면 무의미.
 *  남는 것은 품절 격차 · 할인 격차 — 둘 다 유통별 담당자가 바로 손댈 수 있는 단위.
 *
 *  ⚠️ 유통 × 카테고리로 쪼갤 것. 세탁기 전체 품절격차는 +5.6%p지만
 *     Abenson만 떼면 +25.2%p — 문제는 카테고리가 아니라 특정 유통에 있다.
 */
type Row = Awaited<ReturnType<typeof watchlist>>[number]

const fmtDate = (s?: string | null) => (s ? s.slice(5).replace("-", "/") : "—")
const pp = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%p`

export default function Watchlist() {
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    watchlist(4).then(setRows).catch(() => setErr(true))
  }, [])

  const asOf = rows?.[0]?.asOf ?? null

  return (
    <section className="animate-[fadeUp_.5s_ease]">
      <header className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-[14px] font-bold tracking-tight text-gray-900">우리 위치</h2>
        <span className="text-[10px] text-gray-300">{fmtDate(asOf)} · 주간 성격</span>
      </header>

      <div className="rounded-lg border border-gray-200 bg-white p-2">
        {err ? (
          <p className="py-4 text-center text-[10px] text-gray-400">불러오지 못함</p>
        ) : rows && rows.length === 0 ? (
          <p className="py-4 text-center text-[10px] text-gray-400">열위 셀 없음</p>
        ) : (
          (rows ?? Array.from({ length: 3 })).map((r, i) =>
            !r ? (
              <div key={i} className="h-[42px] border-b border-gray-50" />
            ) : (
              <div
                key={i}
                className={
                  "border-l-[3px] py-1.5 pl-2 " +
                  (i > 0 ? "mt-1.5 border-t border-t-gray-50 pt-2 " : "") +
                  (r.verdict === "risk"
                    ? "border-l-rose-500"
                    : r.verdict === "chance"
                      ? "border-l-emerald-500"
                      : "border-l-gray-200")
                }
              >
                <p className="flex items-baseline justify-between text-[11px] font-bold text-gray-900">
                  <span>
                    {r.retailer} · {r.category}
                  </span>
                  <span
                    className={
                      "text-[11px] " +
                      (r.verdict === "risk"
                        ? "text-rose-600"
                        : r.verdict === "chance"
                          ? "text-emerald-600"
                          : "text-gray-500")
                    }
                  >
                    {r.oosGap != null && Math.abs(r.oosGap) >= 3
                      ? pp(r.oosGap)
                      : pp(r.discGap)}
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-gray-500">
                  {r.oosGap != null && r.oosGap >= 3
                    ? `품절 LG ${r.lgOos?.toFixed(0)}% vs 시장 ${r.mktOos?.toFixed(0)}% — 우리가 비움`
                    : r.oosGap != null && r.oosGap <= -8
                      ? `시장 품절 ${r.mktOos?.toFixed(0)}% vs LG ${r.lgOos?.toFixed(0)}% — 공략 창`
                      : r.discGap != null && r.discGap < 0
                        ? `할인 LG ${r.lgDisc?.toFixed(0)}% vs 중국계 ${r.cnDisc?.toFixed(0)}%`
                        : `선반 ${r.shelf.toFixed(1)}% — 취급 확대 여지`}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-300">
                  표본 LG {r.lgN} / 전체 {r.totalN} SKU
                </p>
              </div>
            ),
          )
        )}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400">
        선반 점유는 <b className="font-semibold text-gray-500">SKU 개수 기준</b> — 매출 점유율 아님
        <br />
        웹 리스팅 기준(실매장 진열 아님) · 판매량 데이터 없음
      </p>
    </section>
  )
}
