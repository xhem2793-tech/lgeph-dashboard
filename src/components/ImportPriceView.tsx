"use client"

import React, { useEffect, useMemo, useState } from "react"
import { importPriceSeries, importOrigins, type ImpSeries, type ImpOrigin } from "@/lib/supabase"
import { ChartCard, Lg, fmtLabels, type SLine } from "@/components/EconChart"
import { Segmented } from "@/components/Segmented"
import { T } from "@/lib/i18n"

/** 수입 단가 — UN Comtrade 필리핀 가전 수입(HS 8418/8415/8450/8528)의 월별 단가($/kg)와 원산지 점유·단가.
 *  조달원가·수입가전 경쟁 구도(중국 저가·한국 프리미엄)를 추적. 무역데이터 특성상 최신 확보월 기준. */

const C = { ind: "#6366f1", rose: "#dc2626", emer: "#059669", amber: "#d99400", blue: "#0284c7", violet: "#7c3aed", teal: "#0f766e" }
// HS는 컴포넌트 내부에서 생성(렌더 시점 언어 반영)
const OCOL: Record<string, string> = { 중국: C.rose, 한국: C.ind, 태국: C.emer, 베트남: C.amber, 일본: C.violet, 말레이시아: C.blue, 인도네시아: C.teal, 전체: "#94a3b8" }

function toSeries(s: ImpSeries[string] | undefined, years: number, color: string): { series: SLine[]; labels: string[] } {
  if (!s || s.values.length < 2) return { series: [], labels: [] }
  const latest = s.dates[s.dates.length - 1]
  const cutoff = (Number(latest.slice(0, 4)) - years) + latest.slice(4)
  const idx = s.dates.map((dt, i) => ({ dt, i })).filter((x) => x.dt >= cutoff)
  const use = idx.length >= 2 ? idx : s.dates.map((dt, i) => ({ dt, i })).slice(-Math.min(2, s.dates.length))
  return { series: [{ name: T("수입 단가", "Import unit price"), color, data: use.map((x) => s.values[x.i]), w: 2 }], labels: fmtLabels(use.map((x) => x.dt)) }
}
const fmtMonth = (d: string) => d.slice(0, 4) + "." + Number(d.slice(5, 7)) + T("월", "")

export default function ImportPriceView() {
  const HS = [{ hs: "8418", label: T("냉장고", "Refrigerator") }, { hs: "8415", label: T("에어컨", "Air conditioner") }, { hs: "8450", label: T("세탁기", "Washer") }, { hs: "8528", label: T("TV·모니터", "TV · Monitor") }]
  const [win, setWin] = useState("2Y")
  const [hs, setHs] = useState("8418")
  const [ser, setSer] = useState<ImpSeries>({})
  const [orig, setOrig] = useState<{ date: string; origins: ImpOrigin[] } | null>(null)

  useEffect(() => { importPriceSeries().then(setSer).catch(() => {}) }, [])
  useEffect(() => { setOrig(null); importOrigins(hs).then(setOrig).catch(() => {}) }, [hs])

  const years = win === "1Y" ? 1 : win === "5Y" ? 5 : win === "전체" ? 10 : 2
  const cur = HS.find((h) => h.hs === hs)!
  const chart = useMemo(() => toSeries(ser[hs], years, C.ind), [ser, hs, years])

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

      <div className="grid items-start gap-4">
      <section className="min-w-0 rounded-xl p-4" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
        {/* 제품 + 기간 토글 — 타 경제지표 뷰와 동일하게 카드 헤더 내부에 배치 */}
        <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
          <Segmented value={hs} onChange={setHs} options={HS.map((h) => ({ k: h.hs, label: h.label }))} size="sm" />
          <span className="ml-auto"><Segmented size="sm" value={win} onChange={setWin} options={[{ k: "1Y", label: "1Y" }, { k: "2Y", label: "2Y" }, { k: "5Y", label: "5Y" }, { k: "전체", label: T("전체", "All") }]} /></span>
        </header>
        <div className="grid items-stretch gap-4 sm:grid-cols-2">
        {/* 단가 추이 */}
        {chart.series.length ? (
          <ChartCard
            title={cur.label + T(" 수입 단가 추이", " import unit price trend")} seg={T("조달", "Sourcing")} unit="$/kg · 월" decimals={2}
            legend={<Lg c={C.ind} t={cur.label + T(" 단가($/kg)", " unit price ($/kg)")} b />}
            series={chart.series} labels={chart.labels}
            meaning={<>{T("월 수입액÷중량 = ", "Monthly import value ÷ weight = ")}<b className="text-gray-700 dark:text-gray-200">{T("평균 수입단가", "avg unit price")}</b>{T(" — 상승 시 조달원가·소매가 상방 압력", " — a rise pressures procurement and retail prices upward")}</>}
            ai={<>{T("수입단가 상승은 ", "A rise in import unit prices is ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("COGS·소비자가 인상 압력", "upward pressure on COGS and consumer prices")}</b>{T("이자 국내 조립·현지화 이점 확대 신호. 페소 약세와 겹치면 원가 이중 부담 — ", ", while widening the edge of local assembly and localization. Overlapping with peso weakness, it becomes a double cost burden — ")}<b className="font-semibold">{T("고효율 프리미엄 가격 정당화", "justifying high-efficiency premium pricing")}</b>{T("와 조달통화 헤지가 대응 축.", " and procurement-currency hedging are the key levers.")}</>}
            src="UN Comtrade(HS 84/85) · CIF÷순중량"
          />
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 text-[12px] text-gray-400">{Object.keys(ser).length ? T("해당 품목 데이터 부족", "Insufficient data for this item") : T("불러오는 중", "Loading")}</div>
        )}

        {/* 원산지 점유·단가 */}
        <div className="flex h-full flex-col rounded-xl p-3.5" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{cur.label} {T("원산지 점유·단가", "origin · unit price")}</h3>
            <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{T("조달", "Sourcing")}</span>
            {orig && <span className="ml-auto text-[10.5px] text-gray-400 dark:text-gray-500">{fmtMonth(orig.date)}</span>}
          </div>
          <div className="mt-2.5 min-h-0 flex-1">
            {!orig ? <div className="flex h-40 items-center justify-center text-[12px] text-gray-400">{T("불러오는 중", "Loading")}</div> : orig.origins.length === 0 ? <div className="flex h-40 items-center justify-center text-[12px] text-gray-400">{T("원산지 데이터 없음", "No origin data")}</div> : (
              (() => {
                const items = orig.origins.slice(0, 7)
                const total = items.reduce((s, o) => s + o.share, 0) || 1
                const R = 46, SW = 20, C = 2 * Math.PI * R, cx = 60, cy = 60
                let acc = 0
                return (
                  <div className="flex items-center gap-4">
                    <svg width="126" height="126" viewBox="0 0 120 120" className="-rotate-90 shrink-0">
                      <circle cx={cx} cy={cy} r={R} fill="none" strokeWidth={SW} className="stroke-gray-100 dark:stroke-gray-800" />
                      {items.map((o, i) => { const frac = o.share / total, off = -C * acc; acc += frac
                        return <circle key={o.partner} cx={cx} cy={cy} r={R} fill="none" stroke={OCOL[o.partner] || "#94a3b8"} strokeWidth={SW} strokeDasharray={`${C * frac} ${C * (1 - frac)}`} strokeDashoffset={off} style={{ animation: "growX .6s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.08 + i * 0.06) + "s" }} /> })}
                      <text x={cx} y={cy - 3} textAnchor="middle" className="rotate-90 fill-gray-400 dark:fill-gray-500" style={{ transformOrigin: `${cx}px ${cy}px` }} fontSize="9" fontWeight="700">{T("점유", "Share")}</text>
                      <text x={cx} y={cy + 9} textAnchor="middle" className="rotate-90 fill-gray-700 dark:fill-gray-100" style={{ transformOrigin: `${cx}px ${cy}px` }} fontSize="12" fontWeight="800">{items[0]?.partner}</text>
                    </svg>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {items.map((o) => (
                        <div key={o.partner} className="flex items-center gap-1.5 text-[11.5px]">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: OCOL[o.partner] || "#94a3b8" }} />
                          <span className="font-semibold text-gray-700 dark:text-gray-200">{o.partner}</span>
                          <span className="tabular-nums text-gray-500 dark:text-gray-400">{o.share.toFixed(0)}%</span>
                          <span className="ml-auto tabular-nums text-gray-400 dark:text-gray-500">${o.unit.toFixed(2)}/kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b>{T(" 도넛=원산지별 수입액 점유, 범례 우측=단가($/kg) — ", " Donut = import value share by origin, legend right = unit price ($/kg) — ")}<b className="text-gray-700 dark:text-gray-200">{T("중국 저가 대량·한국 고단가", "China high-volume low-price · Korea high unit price")}</b>{T(" 구도 확인", " structure")}</p>
          <p className="mt-auto pt-2 text-[10px] text-gray-400 dark:text-gray-500">{T("UN Comtrade · 최신 확보월 원산지별 CIF 점유·단가", "UN Comtrade · CIF share and unit price by origin, latest available month")}</p>
        </div>
      </div>
      </section>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">{T("UN Comtrade 필리핀 수입 통계(HS 8418 냉장고·8415 에어컨·8450 세탁기·8528 TV) · 단가=CIF÷순중량($/kg) · 무역데이터 특성상 발표 지연(최신 확보월 기준) · 연간 수입액은 ", "UN Comtrade Philippine import statistics (HS 8418 refrigerators · 8415 air conditioners · 8450 washing machines · 8528 TV) · unit price = CIF ÷ net weight ($/kg) · trade data published with a lag (latest available month) · for annual import value see ")}&lt;{T("가전 선행지표", "Appliance Leading Indicators")}&gt;{T(" 참조", "")}</p>
    </div>
  )
}
