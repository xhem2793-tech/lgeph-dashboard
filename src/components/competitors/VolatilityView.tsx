"use client"

// 유통 히트맵 — 스크래핑 커버리지(가로=거래선, 세로=브랜드). 셀=선택일 전시(스크랩)된 제품 수(=pN 존재).
// 지표: SKU총갯수·진열점유율(SOS)·활성화율·품절갯수·품절율 / 날짜 네비 / 제품 / 셀 클릭 드릴다운 / CSV / LG갭 KPI.
import React from "react"
import { T } from "@/lib/i18n"
import { fmtStamp, type PriceRow } from "@/lib/supabase"
import { md, peso, pmShopLabel, PmDrop, catLabel } from "@/components/competitors/shared"
import { canonCode } from "@/lib/classify"

const COV_P = ["p0", "p1", "p2", "p3"] as const
const COV_D = ["d0", "d1", "d2", "d3"] as const
// 거래선 매출 순위(필리핀 가전 유통, 큰 순) — 히트맵 열 좌→우 정렬 기준.
const RETAILER_RANK: Record<string, number> = { "SM Appliance": 1, "Abenson": 2, "Anson's": 3, "Robinsons Appliances": 4, "Western Appliances": 5, "Emcor": 6, "Addessa": 7, "Home Credit": 9 }
const retRank = (r: string) => RETAILER_RANK[r] ?? 8
const BRAND_DOMAIN: Record<string, string> = {
  LG: "lg.com", Samsung: "samsung.com", Panasonic: "panasonic.com", TCL: "tcl.com", Hisense: "hisense.com",
  Carrier: "carrier.com", Midea: "midea.com", Sony: "sony.com", Haier: "haier.com", Sharp: "sharp.com",
  Toshiba: "toshiba.com", Whirlpool: "whirlpool.com", Daikin: "daikin.com", Gree: "gree.com", Skyworth: "skyworth.com",
  Devant: "devant.com.ph", Kolin: "kolin.ph", Koppel: "koppel.com.ph", Condura: "condura.com",
  Fujidenzo: "fujidenzo.com.ph", Prestiz: "prestiz.com.ph",
}
const RETAILER_DOMAIN: Record<string, string> = {
  "SM Appliance": "smappliance.com", "Abenson": "abenson.com", "Anson's": "ansons.com.ph",
  "Robinsons Appliances": "robinsonsappliances.com.ph", "Western Appliances": "westernappliances.com.ph",
  "Emcor": "emcor.com.ph", "Addessa": "addessa.com.ph", "Home Credit": "homecredit.ph", "Imperial": "imperialappliance.com",
}
const IMPERIAL = "Imperial" // 9번 열 · 비활성(스크래핑 미연동)
const SOON = "__soon" // 10번 열 · 비활성(준비중)
// 로고 — Google 파비콘(정사각 128px)으로 전부 통일. 실패 시 이름 폴백.
const favi = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
const brandLogo = (b: string): string | null => BRAND_DOMAIN[b] ? favi(BRAND_DOMAIN[b]) : null
const retailerLogo = (r: string): string | null => RETAILER_DOMAIN[r] ? favi(RETAILER_DOMAIN[r]) : null
const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = "none" }

type Metric = "count" | "sos" | "actRate" | "oosCnt" | "oosRate"

function CoverageHeatmap({ rows: allRows, stamp }: { rows: PriceRow[]; stamp: string | null }) {
  const [di, setDi] = React.useState(0)
  const [cat, setCat] = React.useState("전체")
  const [metric, setMetric] = React.useState<Metric>("count")
  const [norm, setNorm] = React.useState<"global" | "col">("global") // 색 기준(전체/거래선별)
  const [sel, setSel] = React.useState<{ b: string; ret: string } | null>(null) // 셀 드릴다운
  const [moreBrands, setMoreBrands] = React.useState(false) // 브랜드 10개 이후 더보기
  const cats = ["냉장고", "세탁기", "에어컨", "TV"]
  const rows = React.useMemo(() => cat === "전체" ? allRows : allRows.filter((r) => r.category === cat), [allRows, cat])
  const listedOn = (r: PriceRow, slot: number) => slot >= 0 && slot <= 3 && r[COV_P[slot]] != null
  const dates = React.useMemo(() => [0, 1, 2, 3].map((i) => { const m = new Map<string, number>(); rows.forEach((r) => { const v = r[COV_D[i]] as string | null; if (v) m.set(v, (m.get(v) || 0) + 1) }); let best: string | null = null, bc = 0; m.forEach((c, d) => { if (c > bc) { bc = c; best = d } }); return best }), [rows])
  const oosLive = di === 0 // 품절·활성율은 오늘 스냅샷만 유효
  const data = React.useMemo(() => {
    const retM = new Map<string, number>(), brM = new Map<string, number>()
    rows.forEach((r) => { if (listedOn(r, di)) { if (r.retailer) retM.set(r.retailer, (retM.get(r.retailer) || 0) + 1); if (r.brand) brM.set(r.brand, (brM.get(r.brand) || 0) + 1) } })
    const retailers = Array.from(retM.entries()).sort((a, b) => retRank(a[0]) - retRank(b[0]) || b[1] - a[1]).map((x) => x[0])
    const brands = Array.from(brM.entries()).sort((a, b) => (a[0] === "LG" ? -1 : b[0] === "LG" ? 1 : 0) || b[1] - a[1]).map((x) => x[0])
    const today = new Map<string, number>(), oos = new Map<string, number>(), series = new Map<string, number[]>()
    const K = (b: string, ret: string) => b + "|" + ret
    rows.forEach((r) => { if (!r.brand || !r.retailer) return; const k = K(r.brand, r.retailer)
      if (listedOn(r, di)) { today.set(k, (today.get(k) || 0) + 1); if (di === 0 && r.availability === "OutOfStock") oos.set(k, (oos.get(k) || 0) + 1) }
      let sv = series.get(k); if (!sv) { sv = [0, 0, 0, 0]; series.set(k, sv) } // 4일(d0~d3) 전시 수 추이
      for (let s = 0; s < 4; s++) if (listedOn(r, s)) sv[s]++
    })
    let maxT = 1; today.forEach((v) => { if (v > maxT) maxT = v })
    let maxOos = 1; oos.forEach((v) => { if (v > maxOos) maxOos = v })
    const colTot: Record<string, number> = {}, rowTot: Record<string, number> = {}, colMax: Record<string, number> = {}
    today.forEach((v, k) => { const [b, ret] = k.split("|"); colTot[ret] = (colTot[ret] || 0) + v; rowTot[b] = (rowTot[b] || 0) + v; if (v > (colMax[ret] || 0)) colMax[ret] = v })
    const grand = Array.from(today.values()).reduce((a, b) => a + b, 0)
    return { retailers, brands, today, oos, series, maxT, maxOos, colTot, rowTot, colMax, grand, K }
  }, [rows, di])
  const slots = [0, 1, 2, 3].filter((i) => dates[i])
  const slotPos = slots.indexOf(di)
  const pickDate = (v: string) => { const idx = [0, 1, 2, 3].find((i) => dates[i] === v); if (idx != null) setDi(idx) }
  const retSlots: (string | null)[] = []
  { let ai = 0; for (let i = 0; i < 10; i++) { if (i === 8) retSlots.push(IMPERIAL); else if (i === 9) retSlots.push(SOON); else { retSlots.push(data.retailers[ai] ?? null); ai++ } } }
  const brSlots: (string | null)[] = moreBrands ? data.brands : Array.from({ length: 10 }, (_, i) => data.brands[i] ?? null)

  // 지표별 셀 수치(원시값) — null=해당 없음/미측정
  const rawVal = (t: number, oo: number, tot: number): number | null => {
    if (metric === "count") return t || null
    if (metric === "sos") return tot > 0 ? (t / tot) * 100 : null
    if (!oosLive) return null // 과거일: 품절/활성율 미측정
    if (metric === "actRate") return t > 0 ? ((t - oo) / t) * 100 : null
    if (metric === "oosCnt") return t ? oo : null
    return t > 0 ? (oo / t) * 100 : null // oosRate
  }
  const isPct = metric === "sos" || metric === "actRate" || metric === "oosRate"
  const teal = !(metric === "oosCnt" || metric === "oosRate")
  const dispOf = (v: number | null): string => v == null ? ((metric === "oosCnt" || metric === "actRate" || metric === "oosRate") && !oosLive ? "—" : "·") : isPct ? Math.round(v) + "%" : String(v)
  const alphaOf = (v: number | null, t: number, ret: string): number => {
    if (v == null || v === 0) return 0
    if (metric === "count") { const denom = norm === "col" ? (data.colMax[ret] || 1) : data.maxT; return Math.max(0.12, Math.min(1, t / denom)) }
    if (metric === "oosCnt") return Math.max(0.18, Math.min(1, v / data.maxOos))
    return Math.max(0.08, Math.min(1, v / 100)) // 퍼센트 계열
  }

  // LG 커버리지 갭(경쟁 평균 대비)
  const lgGap = React.useMemo(() => {
    const lg = data.rowTot["LG"] || 0
    const comp = data.brands.filter((b) => b !== "LG").map((b) => data.rowTot[b] || 0)
    const avg = comp.length ? comp.reduce((a, b) => a + b, 0) / comp.length : 0
    return { lg, avg: Math.round(avg), gap: Math.round(lg - avg), hasLG: data.brands.includes("LG") }
  }, [data])

  // CSV — 현재 지표 매트릭스(브랜드×거래선)
  const exportCsv = () => {
    const head = [T("브랜드", "Brand"), ...data.retailers, T("합계", "Total")]
    const lines: (string | number)[][] = [head]
    for (const b of data.brands) {
      const row: (string | number)[] = [b]
      for (const ret of data.retailers) { const k = data.K(b, ret); const t = data.today.get(k) || 0; const oo = oosLive ? (data.oos.get(k) || 0) : 0; const v = rawVal(t, oo, data.colTot[ret] || 0); row.push(v == null ? "" : isPct ? Math.round(v) + "%" : v) }
      row.push(data.rowTot[b] || 0); lines.push(row)
    }
    const csv = "﻿" + lines.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n")
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `유통커버리지_${dates[di] || ""}_${metric}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  // 드릴다운: 선택 셀의 실제 모델 리스트
  const drill = React.useMemo(() => {
    if (!sel) return []
    return rows.filter((r) => r.brand === sel.b && r.retailer === sel.ret && listedOn(r, di))
      .map((r) => ({ code: r.code && r.code.length >= 4 && r.code !== "N/A" ? r.code : canonCode(r.model, r.code), cap: r.capacity, price: r[COV_P[di]] as number | null, oos: r.availability === "OutOfStock", url: r.url }))
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
  }, [sel, rows, di]) // eslint-disable-line

  return (
    <div className="flex flex-col gap-2.5">
      {sel ? (
        // 드릴다운 — 별도 페이지(인라인 전체화면)
        <div style={{ animation: "fadeUp .3s ease both" }}>
          <button type="button" onClick={() => setSel(null)} className="mb-3 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 transition-all duration-300 ease-out hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300 active:scale-95"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>{T("히트맵으로", "Back to heatmap")}</button>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              {brandLogo(sel.b) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogo(sel.b) as string} alt={sel.b} onError={hideOnError} className="h-7 w-7 rounded-sm object-contain" />
              )}
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-50">{sel.b} · {pmShopLabel(sel.ret)}</h3>
              <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-px text-[11px] font-semibold text-gray-500 dark:text-gray-400">{drill.length}{T("개 모델", " models")} · {md(dates[di])}</span>
              {RETAILER_DOMAIN[sel.ret] && <a href={`https://${RETAILER_DOMAIN[sel.ret]}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{T("사이트 열기", "Open site")} →</a>}
            </div>
            <div className="mt-3 max-h-[64vh] overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
              {drill.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-[12px] text-gray-400">{T("모델 정보 없음", "No model data")}</div>
              ) : (
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900"><tr className="text-left text-[10.5px] font-semibold text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-2">{T("모델", "Model")}</th><th className="px-2 py-2">{T("스펙", "Spec")}</th><th className="px-3 py-2 text-right">{T("가격", "Price")}</th><th className="px-3 py-2 text-center">{T("재고", "Stock")}</th>
                  </tr></thead>
                  <tbody>
                    {drill.map((m, i) => (
                      <tr key={i} className="border-t border-gray-50 dark:border-gray-800/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5">
                        <td className="px-4 py-1.5 font-medium text-gray-800 dark:text-gray-100">{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">{m.code}</a> : m.code}</td>
                        <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{m.cap || "—"}</td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-50">{m.price != null ? peso(m.price) : "—"}</td>
                        <td className="px-3 py-1.5 text-center">{m.oos ? <span className="rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:text-amber-300">{T("품절", "OOS")}</span> : <span className="rounded bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">{T("재고", "In")}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (<>
      {/* 한 줄 필터바 — 제품·지표·날짜네비·색기준 + 최신·CSV */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <PmDrop label={T("제품", "Div")} sel={cat} options={[{ k: "전체", t: T("전체", "All") }, ...cats.map((c) => ({ k: c, t: c === "에어컨" ? "RAC" : catLabel(c) }))]} onSelect={setCat} />
        <PmDrop label={T("지표", "Metric")} sel={metric} options={[{ k: "count", t: T("전시 SKU 수", "Listed SKUs") }, { k: "sos", t: T("진열 점유율", "Share of shelf") }, { k: "actRate", t: T("재고 활성율", "In-stock %") }, { k: "oosCnt", t: T("품절 수", "OOS count") }, { k: "oosRate", t: T("품절률", "OOS %") }]} onSelect={(k) => setMetric(k as Metric)} />
        {metric === "count" && <button type="button" onClick={() => setNorm((n) => n === "global" ? "col" : "global")} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 transition hover:text-indigo-600 dark:hover:text-indigo-300" title={T("색 농도 기준", "Color scale basis")}>{T("색: ", "Scale: ")}{norm === "global" ? T("전체", "Global") : T("거래선별", "Per-retailer")}</button>}
        {/* 날짜 네비게이터(BoardView 스타일) */}
        {slots.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-1 py-0.5">
            <button type="button" onClick={() => slotPos < slots.length - 1 && setDi(slots[slotPos + 1])} disabled={slotPos >= slots.length - 1} aria-label={T("이전 날짜", "Previous date")} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <span className="min-w-[74px] text-center text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{md(dates[di])}{di === 0 && <span className="ml-1 rounded bg-emerald-50 dark:bg-emerald-500/10 px-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">{T("최신", "Latest")}</span>}</span>
            <button type="button" onClick={() => slotPos > 0 && setDi(slots[slotPos - 1])} disabled={slotPos <= 0} aria-label={T("다음 날짜", "Next date")} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
            <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400" title={T("달력에서 날짜 선택", "Pick a date from the calendar")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <input type="date" value={dates[di] ?? ""} min={dates[slots[slots.length - 1]] ?? undefined} max={dates[slots[0]] ?? undefined} onChange={(e) => pickDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={T("날짜 선택", "Select date")} />
            </label>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          <button type="button" onClick={exportCsv} title={T("현재 매트릭스 CSV 다운로드", "Download matrix CSV")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 transition hover:-translate-y-0.5 active:scale-95"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>{T("엑셀", "CSV")}</button>
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
        </div>
      </div>

      {(metric === "oosCnt" || metric === "oosRate" || metric === "actRate") && !oosLive && (
        <div className="text-[11px]"><span className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">{T("품절·활성율은 오늘만 측정 — 과거일은 —로 표시", "OOS/active rate measured today only — past days show —")}</span></div>
      )}

      {/* 히트맵 카드(바둑판) */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3">
        {data.brands.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-[12px] text-gray-400 dark:text-gray-500">{T("해당 조건의 전시 데이터가 없습니다.", "No listing data for this filter.")}</div>
        ) : (<>
          <div className="max-h-[72vh] overflow-auto px-0.5 pb-1 pt-2">
            <div key={cat + "-" + di + "-" + metric} className="grid w-full gap-[5px] text-[11px]" style={{ minWidth: 620, gridTemplateColumns: `repeat(11, minmax(52px,1fr))` }}>
              {/* 헤더 행 — 좌상단 코너에 LG 갭 KPI 카드 */}
              <div className="sticky left-0 top-0 z-30 flex h-[70px] w-full flex-col items-center justify-center gap-0.5 rounded-md border border-indigo-100 bg-indigo-50 px-1 text-center transition-all duration-300 ease-out hover:scale-[1.04] hover:shadow-md dark:border-indigo-500/20 dark:bg-indigo-500/20" title={T("LG 전시 vs 경쟁 평균", "LG listed vs rival avg")}>
                {lgGap.hasLG ? (<>
                  <span className="text-[8.5px] font-semibold uppercase tracking-wide text-indigo-500/80 dark:text-indigo-300/70">LG {T("전시", "listed")}</span>
                  <span className="text-[16px] font-bold leading-none text-indigo-700 dark:text-indigo-300">{lgGap.lg}</span>
                  <span className="text-[8.5px] font-semibold text-gray-500 dark:text-gray-400">{T("경쟁 평균", "avg")} {lgGap.avg} · <span className={lgGap.gap >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>{lgGap.gap >= 0 ? "+" : ""}{lgGap.gap}</span></span>
                </>) : <span className="text-[9px] text-gray-400">—</span>}
              </div>
              {retSlots.map((ret, ci) => (ret === IMPERIAL || ret === SOON) ? (
                <div key={ci} className="sticky top-0 z-20 flex h-[70px] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-200 bg-gray-100 px-0.5 text-center opacity-80 dark:border-gray-700 dark:bg-gray-800" title={T("준비 중 · 스크래핑 미연동", "Coming soon · not connected")}>
                  <span className="w-full break-words px-0.5 text-center text-[10.5px] font-semibold leading-tight text-gray-400 dark:text-gray-500">{ret === IMPERIAL ? "Imperial" : T("준비중", "Soon")}</span>
                  <span className="rounded bg-gray-100 px-1 text-[8px] font-semibold text-gray-400 dark:bg-gray-700 dark:text-gray-500">{T("준비중", "soon")}</span>
                </div>
              ) : ret ? (
                <a key={ci} href={RETAILER_DOMAIN[ret] ? `https://${RETAILER_DOMAIN[ret]}` : undefined} target="_blank" rel="noopener noreferrer" title={pmShopLabel(ret) + (RETAILER_DOMAIN[ret] ? " · " + T("사이트 열기", "open site") : "")} className="sticky top-0 z-20 flex h-[70px] w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-gray-100 bg-gray-100 px-0.5 text-center transition-all duration-300 ease-out hover:scale-[1.03] hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-800 dark:hover:border-indigo-500/40" style={{ animation: "covPop .6s cubic-bezier(.22,1,.36,1) backwards", animationDelay: "0s" }}>
                  {retailerLogo(ret) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={retailerLogo(ret) as string} alt={pmShopLabel(ret)} loading="lazy" onError={hideOnError} className="h-6 w-6 rounded-sm object-contain" />
                  )}
                  <span className="w-full break-words px-0.5 text-center text-[11px] font-semibold leading-tight text-gray-700 dark:text-gray-200" title={pmShopLabel(ret)}>{pmShopLabel(ret)}</span>
                  <span className="text-[10px] font-normal tabular-nums text-gray-400">{data.colTot[ret] || 0}</span>
                </a>
              ) : <div key={ci} />)}
              {/* 본문 — 브랜드 10행 × 거래선 10열 */}
              {brSlots.map((b, bi) => (
                <React.Fragment key={bi}>
                  <div className={"sticky left-0 z-10 flex h-[70px] w-full flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 text-center text-[11px] font-bold transition-all duration-300 ease-out hover:z-20 hover:scale-[1.03] hover:shadow-md " + (b == null ? "border-transparent bg-transparent" : b === "LG" ? "border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-gray-100 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-200")} style={b == null ? undefined : { animation: "covPop .6s cubic-bezier(.22,1,.36,1) backwards", animationDelay: "0s" }}>
                    {b && brandLogo(b) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brandLogo(b) as string} alt={b} loading="lazy" onError={hideOnError} className="h-6 w-6 rounded-sm object-contain" />
                    )}
                    <span className="w-full break-words leading-tight">{b ?? ""}</span>
                    {b && <span className="text-[10px] font-normal tabular-nums text-gray-400">{data.rowTot[b] || 0}</span>}
                  </div>
                  {retSlots.map((ret, ci) => {
                    if (ret === IMPERIAL || ret === SOON) return <div key={ci} className="flex h-[70px] w-full items-center justify-center rounded-md border border-dashed border-gray-200 text-[9px] text-gray-300 dark:border-gray-700 dark:text-gray-600" style={{ background: "var(--cov-empty)", opacity: 0.45 }}>{b ? "—" : ""}</div>
                    if (!b || !ret) return <div key={ci} className="h-[70px] w-full rounded-md" style={{ background: "var(--cov-empty)", opacity: 0.5 }} />
                    const k = data.K(b, ret); const t = data.today.get(k) || 0; const oo = oosLive ? (data.oos.get(k) || 0) : 0; const tot = data.colTot[ret] || 0
                    const v = rawVal(t, oo, tot); const disp = dispOf(v); const alpha = alphaOf(v, t, ret)
                    const rgb = teal ? "99,102,241" : "244,63,94"; const light = alpha > 0.55; const clickable = metric === "oosCnt" && t > 0
                    return (
                      <button key={ci} type="button" disabled={!clickable} onClick={() => clickable && setSel({ b, ret })} title={`${b} · ${pmShopLabel(ret)}\n${T("전시", "Listed")} ${t}${tot ? ` · ${T("점유", "SOS")} ${Math.round(t / tot * 100)}%` : ""}${oosLive && oo ? ` · ${T("품절", "OOS")} ${oo}` : ""}${oosLive && t > 0 ? ` · ${T("활성율", "live")} ${Math.round(((t - oo) / t) * 100)}%` : ""}${clickable ? "\n" + T("클릭=품절 모델 보기", "click for OOS models") : ""}`}
                        className={"flex h-[70px] w-full flex-col items-center justify-center gap-0.5 rounded-md text-center transition-all duration-300 ease-out " + (clickable ? "cursor-pointer hover:z-10 hover:scale-[1.03] hover:shadow-lg hover:ring-2 hover:ring-indigo-400/70 dark:hover:ring-indigo-300/60" : "cursor-default")} style={{ background: alpha > 0 ? `rgba(${rgb},${alpha})` : "var(--cov-empty)", animation: "covPop .6s cubic-bezier(.22,1,.36,1) backwards", animationDelay: "0s" }}>
                        <span className={"text-[16px] font-bold leading-none tabular-nums " + (alpha > 0 ? (light ? "text-white" : "text-gray-900 dark:text-white") : "text-gray-300 dark:text-gray-600")}>{disp}{v != null && (metric === "count" || metric === "oosCnt") ? <span className="ml-px text-[9px] font-semibold opacity-60">{T("개", "")}</span> : null}</span>
                      </button>
                    ) })}
                </React.Fragment>
              ))}
            </div>
          </div>
          {data.brands.length > 10 && (
            <div className="mt-2 flex justify-center">
              <button type="button" onClick={() => setMoreBrands((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 transition-all duration-300 ease-out hover:-translate-y-px hover:border-indigo-300 hover:shadow-sm active:scale-95">{moreBrands ? T("접기", "Show less") : `+${data.brands.length - 10}${T("개 더보기", " more")}`}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: moreBrands ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg></button>
            </div>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-gray-400 dark:text-gray-500">
            <span>{metric === "count" ? T("셀=활성 SKU(전시 제품 수)", "Cell = active SKUs (listed)") : metric === "sos" ? T("셀=진열 점유율(그 거래선 내 브랜드 비중)", "Cell = share of shelf (brand share in retailer)") : metric === "actRate" ? T("셀=활성화율=(활성−품절)/활성", "Cell = active rate = (active−OOS)/active") : metric === "oosCnt" ? T("셀=오늘 품절 수", "Cell = OOS count today") : T("셀=품절율=품절/활성", "Cell = OOS rate = OOS/active")} · {T("색 진할수록 큼 · 셀 클릭=모델 목록", "darker = higher · click a cell for models")}</span>
            <span className="ml-auto tabular-nums">{T("총 활성 SKU", "Total active")} <b className="text-gray-600 dark:text-gray-300">{data.grand.toLocaleString()}</b></span>
          </p>
        </>)}
      </div>

      </>)}

      <style>{":root{--cov-empty:#f1f5f9}.dark{--cov-empty:#0f172a}@keyframes covPop{from{opacity:0;transform:translateY(7px) scale(.97)}to{opacity:1;transform:none}}"}</style>
    </div>
  )
}

export function VolatilityView({ rows, stamp }: { rows: PriceRow[] | null; stamp: string | null }) {
  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("불러오는 중", "Loading")}</div>
  return (
    <div className="mt-3" style={{ animation: "fadeUp .5s ease both" }}>
      <CoverageHeatmap rows={rows} stamp={stamp} />
    </div>
  )
}
