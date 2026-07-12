"use client"

import React from "react"
import { categoryKpi } from "@/lib/supabase"

/** 상황판 매트릭스 — 대시보드 홈의 분류(triage) 화면.
 *  30초 안에 "어디가 문제인가"를 스캔 → 셀 클릭 시 드릴다운.
 *
 *  ⚠️ 하드룰: 시장 품절률은 LG의 유통 믹스로 보정된 값(v_category_kpi).
 *     합산 평균으로 브랜드를 비교하면 심슨의 역설에 빠진다.
 */

type Row = Awaited<ReturnType<typeof categoryKpi>>[number]
type Tone = "bad" | "warn" | "ok" | "neu"

const TONE: Record<Tone, string> = {
  bad: "bg-rose-50 text-rose-700",
  warn: "bg-amber-50 text-amber-700",
  ok: "bg-emerald-50 text-emerald-700",
  neu: "bg-gray-50 text-gray-600",
}

const fmtDate = (s?: string | null) =>
  s ? s.slice(5).replace("-", "/") : "—"
const pp = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%p`
const peso = (v: number | null) =>
  v == null ? "—" : `₱${Math.round(v / 1000)}k`

/** 선반 점유 — 낮을수록 불리 */
function toneShelf(v: number): Tone {
  if (v < 12) return "bad"
  if (v < 20) return "warn"
  return "ok"
}
/** 품절 격차 — 양수 = LG가 더 많이 품절(불리) / 음수 = 경쟁사가 비움(기회) */
function toneOos(gap: number | null): Tone {
  if (gap == null) return "neu"
  if (gap >= 5) return "bad"
  if (gap >= 2) return "warn"
  if (gap <= -5) return "ok"
  return "neu"
}
/** 할인 격차 — 음수 = 중국계가 더 공격적(불리) */
function toneDisc(gap: number | null): Tone {
  if (gap == null) return "neu"
  if (gap <= -4) return "warn"
  if (gap < 0) return "warn"
  return "ok"
}

export default function TriageMatrix() {
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    categoryKpi()
      .then(setRows)
      .catch(() => setErr(true))
  }, [])

  if (err)
    return (
      <p className="text-[12px] text-gray-400">
        상황판 데이터를 불러오지 못함 — 확인 필요
      </p>
    )

  const asOf = rows?.[0]?.asOf ?? null

  return (
    <section className="animate-[fadeUp_.5s_ease] rounded-xl bg-[#f9fafb] p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900">상황판</h2>
          <span className="text-[11px] text-gray-400">
            카테고리 × KPI — 어디가 문제인가
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700">
            CONFIRMED
          </span>
          {fmtDate(asOf)} 기준 · 3개 유통
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="text-[10px] font-medium text-gray-400">
              <th className="w-[74px] pb-2 text-left">카테고리</th>
              <th className="pb-2 text-center">
                선반 점유
                <span className="block text-[9px] font-normal text-gray-300">
                  LG SKU / 전체
                </span>
              </th>
              <th className="pb-2 text-center">
                품절 격차
                <span className="block text-[9px] font-normal text-gray-300">
                  LG vs 시장 (믹스보정)
                </span>
              </th>
              <th className="pb-2 text-center">
                가격 경쟁력
                <span className="block text-[9px] font-normal text-gray-300">
                  LG 할인 vs 중국계
                </span>
              </th>
              <th className="pb-2 text-center">
                프리미엄
                <span className="block text-[9px] font-normal text-gray-300">
                  LG ASP vs 시장
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? Array.from({ length: 4 })).map((r, i) => {
              if (!r)
                return (
                  <tr key={i} className="border-t border-gray-100">
                    <td colSpan={5} className="h-[54px]" />
                  </tr>
                )
              return (
                <tr key={r.category} className="border-t border-gray-100">
                  <td className="py-1 pl-0.5 text-[12.5px] font-bold text-gray-900">
                    {r.category}
                  </td>

                  <Cell tone={toneShelf(r.shelfShare)}
                        value={`${r.shelfShare.toFixed(1)}%`}
                        cap={`${r.lgSku} / ${r.totalSku}`} />

                  <Cell tone={toneOos(r.oosGap)}
                        value={pp(r.oosGap)}
                        cap={r.oosGap == null ? "—"
                          : r.oosGap > 0 ? `LG ${r.lgOos?.toFixed(1)}% — 우리가 비움`
                          : `시장 ${r.mktOos?.toFixed(1)}% — 공략 기회`} />

                  <Cell tone={toneDisc(r.discGap)}
                        value={`${r.lgDisc?.toFixed(1)}%`}
                        cap={r.discGap == null ? "—"
                          : `중국계 ${r.cnDisc?.toFixed(1)}% · ${pp(r.discGap)}`} />

                  <Cell tone="neu"
                        value={r.premium == null ? "—" : `+${r.premium}%`}
                        cap={`${peso(r.lgAsp)} vs ${peso(r.mktAsp)}`} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-400">
        <Legend c="bg-rose-100" t="즉시 대응" />
        <Legend c="bg-amber-100" t="주시" />
        <Legend c="bg-emerald-100" t="양호·기회" />
        <Legend c="bg-gray-200" t="참고" />
      </div>

      <p className="mt-3 border-t border-gray-200 pt-2.5 text-[10.5px] leading-relaxed text-gray-400">
        품절 격차는 <b className="font-semibold text-gray-500">LG의 유통 분포로 보정</b>한 값 —
        합산 평균 비교는 매장 믹스에 왜곡됨
        <br />
        품절은 잘 팔려서일 수도, 공급이 끊겨서일 수도 있음 — 단정 금지. 판매량(sell-out) 데이터 없음
      </p>
    </section>
  )
}

function Cell({ tone, value, cap }: { tone: Tone; value: string; cap: string }) {
  return (
    <td className="px-1 py-1">
      <div
        className={
          "flex flex-col items-center justify-center rounded-md px-1.5 py-2 " +
          TONE[tone]
        }
      >
        <span className="text-[16px] font-bold leading-none tracking-tight">
          {value}
        </span>
        <span className="mt-1 text-[9.5px] opacity-80">{cap}</span>
      </div>
    </td>
  )
}

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1">
      <i className={"inline-block h-2 w-2 rounded-sm " + c} />
      {t}
    </span>
  )
}
