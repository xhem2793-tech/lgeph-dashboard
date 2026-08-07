"use client"

// 지역별 유통 매장망 표 — 지방(region)×거래선 매트릭스. 지역별 1위 유통 강조 + 합계.
// 데이터: v_store_counts(Google Places 가전매장 유니버스). "기타"=비추적 가전점·브랜드샵·지역딜러.
import React from "react"
import { T } from "@/lib/i18n"
import { storeCounts, type StoreCount } from "@/lib/supabase"

// geojson REGION(영문) → 한글 짧은 라벨
const REGION_KO: Record<string, string> = {
  "Metropolitan Manila": "메트로 마닐라", "Cordillera Administrative Region (CAR)": "코르디예라(CAR)",
  "Ilocos Region (Region I)": "일로코스", "Cagayan Valley (Region II)": "카가얀 밸리",
  "Central Luzon (Region III)": "중부 루손", "CALABARZON (Region IV-A)": "칼라바르손",
  "MIMAROPA (Region IV-B)": "미마로파", "Bicol Region (Region V)": "비콜",
  "Western Visayas (Region VI)": "서부 비사야", "Central Visayas (Region VII)": "중부 비사야",
  "Eastern Visayas (Region VIII)": "동부 비사야", "Zamboanga Peninsula (Region IX)": "삼보앙가",
  "Northern Mindanao (Region X)": "북부 민다나오", "Davao Region (Region XI)": "다바오",
  "SOCCSKSARGEN (Region XII)": "소크사르젠", "Caraga (Region XIII)": "카라가",
  "Autonomous Region of Muslim Mindanao (ARMM)": "방사모로(BARMM)",
}
// 추적 체인 표시 순서(기타는 항상 맨 끝)
const CHAIN_ORDER = ["SM Appliance", "Abenson", "Robinsons Appliances", "Anson's", "Western Appliances", "Emcor", "Imperial", "K-Servico", "Dueksam", "Desmark"]
const SHORT: Record<string, string> = { "SM Appliance": "SM", "Robinsons Appliances": "Robinsons", "Western Appliances": "Western", "Anson's": "Anson's" }

export default function RegionRetailTable() {
  const [rows, setRows] = React.useState<StoreCount[] | null>(null)
  React.useEffect(() => { storeCounts().then(setRows).catch(() => setRows([])) }, [])

  const model = React.useMemo(() => {
    const data = rows || []
    const byRegion: Record<string, Record<string, number>> = {}
    const retTotals: Record<string, number> = {}
    data.forEach((d) => {
      (byRegion[d.region] = byRegion[d.region] || {})[d.retailer] = (byRegion[d.region][d.retailer] || 0) + d.stores
      retTotals[d.retailer] = (retTotals[d.retailer] || 0) + d.stores
    })
    // 컬럼: 추적 체인(데이터 있는 것, 정해진 순서) + 기타
    const chains = CHAIN_ORDER.filter((c) => retTotals[c])
    const hasOther = !!retTotals["기타"]
    const regions = Object.keys(byRegion).map((r) => {
      const cells = byRegion[r]
      const total = Object.values(cells).reduce((a, b) => a + b, 0)
      // 지역 1위 = 최다 추적 체인(기타 제외)
      let top: string | null = null, topN = 0
      chains.forEach((c) => { if ((cells[c] || 0) > topN) { topN = cells[c] || 0; top = c } })
      return { region: r, cells, total, top, topN }
    }).sort((a, b) => b.total - a.total)
    const grand = regions.reduce((a, r) => a + r.total, 0)
    return { regions, chains, hasOther, retTotals, grand }
  }, [rows])

  if (rows && rows.length === 0) return null
  const { regions, chains, hasOther, retTotals, grand } = model
  const cols = [...chains, ...(hasOther ? ["기타"] : [])]
  const shortOf = (c: string) => c === "기타" ? T("기타", "Others") : (SHORT[c] || c)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden" style={{ animation: "fadeUp .5s ease both" }}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <span className="h-4 w-1 rounded bg-indigo-500" />
        <span className="text-[16px] font-bold text-gray-800 dark:text-gray-100">{T("지역별 유통 매장망", "Retail store network by region")}</span>
        <span className="text-[12px] text-gray-400 dark:text-gray-500">{T("지방별 최다 유통 · 거래선 분포", "Top retailer & distribution per region")}</span>
        <span className="ml-auto text-[12px] text-gray-500 dark:text-gray-400">{T("전체", "Total")} <b className="tabular-nums text-indigo-600 dark:text-indigo-400">{grand.toLocaleString()}</b> {T("개 가전매장", "stores")}</span>
      </header>
      {!rows ? (
        <div className="h-48 animate-pulse bg-gray-50 dark:bg-gray-800/40" />
      ) : (
        <div className="scroll-soft overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-left font-semibold">{T("지방", "Region")}</th>
                <th className="px-2 py-2 text-left font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{T("1위 유통", "Top")}</th>
                {cols.map((c) => (
                  <th key={c} className={"px-2 py-2 text-right font-semibold whitespace-nowrap " + (c === "기타" ? "text-gray-400" : "")}>{shortOf(c)}</th>
                ))}
                <th className="px-3 py-2 text-right font-bold text-gray-700 dark:text-gray-200">{T("합계", "Total")}</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region} className="border-t border-gray-100 dark:border-gray-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5">
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-1.5 font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">{REGION_KO[r.region] || r.region}</td>
                  <td className="px-2 py-1.5">
                    {r.top ? <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{shortOf(r.top)} <span className="tabular-nums font-semibold opacity-70">{r.topN}</span></span> : <span className="text-gray-300">—</span>}
                  </td>
                  {cols.map((c) => {
                    const v = r.cells[c] || 0
                    const isTop = c === r.top && v > 0
                    return <td key={c} className={"px-2 py-1.5 text-right tabular-nums " + (v === 0 ? "text-gray-300 dark:text-gray-600" : isTop ? "font-extrabold text-indigo-600 dark:text-indigo-300" : c === "기타" ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300")}>{v || "·"}</td>
                  })}
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums text-gray-800 dark:text-gray-100">{r.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-bold text-gray-700 dark:text-gray-200">
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">{T("합계", "Total")}</td>
                <td className="px-2 py-2" />
                {cols.map((c) => <td key={c} className="px-2 py-2 text-right tabular-nums">{(retTotals[c] || 0).toLocaleString()}</td>)}
                <td className="px-3 py-2 text-right tabular-nums text-indigo-600 dark:text-indigo-400">{grand.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="border-t border-gray-100 dark:border-gray-800 px-4 py-2 text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">
        {T("출처 ", "Source ")}<b>Google Places</b>{T(" · 필리핀 가전 매장 유니버스(브랜드 무관 전수) · ", " · PH appliance-store universe (all brands) · ")}<b>{T("기타", "Others")}</b>{T(" = 비추적 가전점·브랜드샵·지역 딜러 · 주1회 갱신", " = untracked stores, brand shops, local dealers · weekly refresh")}</p>
    </div>
  )
}
