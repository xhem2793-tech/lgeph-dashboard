"use client"

// 가격 변동성 — 스크래핑 커버리지 히트맵(가로=거래선, 세로=브랜드).
// 셀=선택일 전시(스크랩)된 제품 수(=pN 존재). 각 셀: 당일 수(색농도)·어제대비 Δ·신규(어제 없던 것)·품절(오늘 OOS). 상단 날짜 토글.
import React from "react"
import { T } from "@/lib/i18n"
import { fmtStamp, type PriceRow } from "@/lib/supabase"
import { md, pmShopLabel, PmDrop, catLabel } from "@/components/competitors/shared"

const COV_P = ["p0", "p1", "p2", "p3"] as const
const COV_D = ["d0", "d1", "d2", "d3"] as const
// 거래선 매출 순위(필리핀 가전 유통, 큰 순) — 히트맵 열 좌→우 정렬 기준.
const RETAILER_RANK: Record<string, number> = { "SM Appliance": 1, "Abenson": 2, "Anson's": 3, "Robinsons Appliances": 4, "Western Appliances": 5, "Emcor": 6, "Addessa": 7, "Home Credit": 9 }
const retRank = (r: string) => RETAILER_RANK[r] ?? 8
// 브랜드 로고 — 로컬(public/logos) 우선, 없으면 Clearbit 로고 API(도메인 기반). 실패 시 이름 폴백.
const BRAND_LOGO: Record<string, string> = {
  LG: "/logos/lg.png",
  Samsung: "/logos/samsung-company-logo-south-korean-260nw-2394493913.webp",
  Panasonic: "/logos/panasonic.png",
  TCL: "/logos/tcl.png",
  Hisense: "/logos/Hisense-Logo.png",
  Carrier: "/logos/carrier.png",
  Midea: "/logos/midea.png",
  Sony: "/logos/sony.png",
}
const BRAND_DOMAIN: Record<string, string> = {
  Haier: "haier.com", Sharp: "sharp.com", Toshiba: "toshiba.com", Whirlpool: "whirlpool.com", Daikin: "daikin.com",
  Gree: "gree.com", Skyworth: "skyworth.com", Devant: "devant.com.ph", Kolin: "kolin.ph", Koppel: "koppel.com.ph",
  Condura: "condura.com", Fujidenzo: "fujidenzo.com.ph", Prestiz: "prestiz.com.ph",
}
const RETAILER_DOMAIN: Record<string, string> = {
  "SM Appliance": "smappliance.com", "Abenson": "abenson.com", "Anson's": "ansons.com.ph",
  "Robinsons Appliances": "robinsonsappliances.com.ph", "Western Appliances": "westernappliances.com.ph",
  "Emcor": "emcor.com.ph", "Addessa": "addessa.com.ph", "Home Credit": "homecredit.ph",
}
const brandLogo = (b: string): string | null => BRAND_LOGO[b] ?? (BRAND_DOMAIN[b] ? `https://logo.clearbit.com/${BRAND_DOMAIN[b]}` : null)
const retailerLogo = (r: string): string | null => RETAILER_DOMAIN[r] ? `https://logo.clearbit.com/${RETAILER_DOMAIN[r]}` : null
const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = "none" }

function CoverageHeatmap({ rows: allRows, stamp }: { rows: PriceRow[]; stamp: string | null }) {
  const [di, setDi] = React.useState(0)
  const [cat, setCat] = React.useState("전체")
  // 제품 4개 고정: 냉장고·세탁기·에어컨(RAC)·TV (있는 것만)
  const cats = React.useMemo(() => ["냉장고", "세탁기", "에어컨", "TV"].filter((c) => allRows.some((r) => r.category === c)), [allRows])
  const rows = React.useMemo(() => cat === "전체" ? allRows : allRows.filter((r) => r.category === cat), [allRows, cat])
  const listedOn = (r: PriceRow, slot: number) => slot >= 0 && slot <= 3 && r[COV_P[slot]] != null
  const dates = React.useMemo(() => [0, 1, 2, 3].map((i) => { const m = new Map<string, number>(); rows.forEach((r) => { const v = r[COV_D[i]] as string | null; if (v) m.set(v, (m.get(v) || 0) + 1) }); let best: string | null = null, bc = 0; m.forEach((c, d) => { if (c > bc) { bc = c; best = d } }); return best }), [rows])
  const data = React.useMemo(() => {
    const retM = new Map<string, number>(), brM = new Map<string, number>()
    rows.forEach((r) => { if (listedOn(r, di)) { if (r.retailer) retM.set(r.retailer, (retM.get(r.retailer) || 0) + 1); if (r.brand) brM.set(r.brand, (brM.get(r.brand) || 0) + 1) } })
    const retailers = Array.from(retM.entries()).sort((a, b) => retRank(a[0]) - retRank(b[0]) || b[1] - a[1]).map((x) => x[0])
    const brands = Array.from(brM.entries()).sort((a, b) => (a[0] === "LG" ? -1 : b[0] === "LG" ? 1 : 0) || b[1] - a[1]).map((x) => x[0])
    const today = new Map<string, number>(), prev = new Map<string, number>(), fresh = new Map<string, number>(), oos = new Map<string, number>()
    const K = (b: string, ret: string) => b + "|" + ret
    rows.forEach((r) => { if (!r.brand || !r.retailer) return; const k = K(r.brand, r.retailer)
      if (listedOn(r, di)) { today.set(k, (today.get(k) || 0) + 1); if (di === 0 && r.availability === "OutOfStock") oos.set(k, (oos.get(k) || 0) + 1); if (di < 3 && !listedOn(r, di + 1)) fresh.set(k, (fresh.get(k) || 0) + 1) }
      if (di < 3 && listedOn(r, di + 1)) prev.set(k, (prev.get(k) || 0) + 1)
    })
    let maxT = 1; today.forEach((v) => { if (v > maxT) maxT = v })
    const colTot: Record<string, number> = {}, rowTot: Record<string, number> = {}
    today.forEach((v, k) => { const [b, ret] = k.split("|"); colTot[ret] = (colTot[ret] || 0) + v; rowTot[b] = (rowTot[b] || 0) + v })
    const grand = Array.from(today.values()).reduce((a, b) => a + b, 0)
    return { retailers, brands, today, prev, fresh, oos, maxT, colTot, rowTot, grand, K }
  }, [rows, di])
  const slots = [0, 1, 2, 3].filter((i) => dates[i])
  const retSlots = Array.from({ length: 10 }, (_, i) => data.retailers[i] ?? null) // 거래선 10열 고정
  const brSlots = Array.from({ length: 10 }, (_, i) => data.brands[i] ?? null) // 브랜드 10행 고정
  return (
    <div className="flex flex-col gap-2.5">
      {/* 한 줄 필터바 — 채널별 가격비교식(제품 드롭다운 + 날짜 토글 + 최신) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <PmDrop label={T("제품", "Div")} sel={cat} options={[{ k: "전체", t: T("전체", "All") }, ...cats.map((c) => ({ k: c, t: c === "에어컨" ? "RAC" : catLabel(c) }))]} onSelect={setCat} />
        <div className="ml-auto flex items-center gap-2.5">
          <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-0.5">
            {slots.map((i) => (
              <button key={i} type="button" onClick={() => setDi(i)} className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors " + (di === i ? "bg-indigo-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300")}>{md(dates[i])}{i === 0 ? T(" 오늘", " today") : ""}</button>
            ))}
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
        </div>
      </div>
      {/* 히트맵 카드(바둑판) */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3">
        {data.brands.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-[12px] text-gray-400 dark:text-gray-500">{T("해당 조건의 전시 데이터가 없습니다.", "No listing data for this filter.")}</div>
        ) : (<>
      <div className="overflow-x-auto pb-1">
        {/* 10×10 고정 매트릭스 — 거래선 10열·브랜드 10행. 부족분은 빈 칸. 폭에 맞춰 늘어나는 정사각 셀. */}
        <div key={cat + "-" + di} className="grid w-full gap-[4px] text-[11px]" style={{ minWidth: 640, gridTemplateColumns: `minmax(80px,0.7fr) repeat(10, minmax(44px,1fr)) minmax(36px,0.5fr)` }}>
          {/* 헤더 행 */}
          <div className="sticky left-0 z-10 bg-white dark:bg-gray-900/40" />
          {retSlots.map((ret, ci) => ret ? (
            <div key={ci} className="flex w-full flex-col items-center justify-center gap-0.5 rounded-md border border-gray-100 bg-gray-50 px-0.5 py-1.5 text-center dark:border-gray-800 dark:bg-gray-800/40">
              <span className="rounded-full bg-indigo-50 px-1 text-[8px] font-bold tabular-nums text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300" title={T("매출 순위", "Sales rank")}>#{ci + 1}</span>
              {retailerLogo(ret) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={retailerLogo(ret) as string} alt={pmShopLabel(ret)} loading="lazy" onError={hideOnError} className="h-3.5 w-auto max-w-[52px] object-contain" />
              )}
              <span className="w-full truncate px-0.5 text-center text-[9.5px] font-semibold text-gray-700 dark:text-gray-200" title={pmShopLabel(ret)}>{pmShopLabel(ret)}</span>
              <span className="text-[9px] font-normal tabular-nums text-gray-400">{data.colTot[ret] || 0}</span>
            </div>
          ) : <div key={ci} />)}
          <div className="flex w-full items-center justify-center rounded-md border border-indigo-100 bg-indigo-50/60 text-[10px] font-bold text-indigo-500 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">Σ</div>
          {/* 본문 — 브랜드 10행(부족분 빈 칸) × 거래선 10열 */}
          {brSlots.map((b, bi) => (
            <React.Fragment key={bi}>
              <div className={"sticky left-0 z-10 flex w-full flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-md border px-1 py-1 text-center text-[11px] font-bold " + (b == null ? "border-transparent bg-transparent" : b === "LG" ? "border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-gray-100 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-200")}>
                {b && brandLogo(b) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogo(b) as string} alt={b} loading="lazy" onError={hideOnError} className="h-4 w-auto max-w-[56px] object-contain" />
                )}
                <span className="max-w-full truncate">{b ?? ""}</span>
              </div>
              {retSlots.map((ret, ci) => {
                if (!b || !ret) return <div key={ci} className="aspect-square w-full rounded-md" style={{ background: "var(--cov-empty)", opacity: 0.5 }} />
                const k = data.K(b, ret); const t = data.today.get(k) || 0; const p = di < 3 ? (data.prev.get(k) || 0) : null; const d = p != null ? t - p : null; const fr = data.fresh.get(k) || 0; const oo = di === 0 ? (data.oos.get(k) || 0) : 0
                const alpha = t ? Math.max(0.12, Math.min(1, t / data.maxT)) : 0; const light = alpha > 0.55
                return (
                  <div key={ci} title={`${b} · ${pmShopLabel(ret)}\n${T("활성 SKU", "Active")} ${t}${d != null ? ` · ${T("어제대비", "vs prev")} ${d > 0 ? "+" : ""}${d}` : ""}${fr ? ` · ${T("신규", "new")} ${fr}` : ""}${oo ? ` · ${T("품절", "OOS")} ${oo}` : ""}`}
                    className="flex aspect-square w-full flex-col items-center justify-center rounded-md text-center transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] hover:z-10 hover:-translate-y-0.5 hover:scale-[1.22] hover:shadow-xl hover:ring-2 hover:ring-teal-400/80 dark:hover:ring-teal-300/70" style={{ background: t ? `rgba(13,148,136,${alpha})` : "var(--cov-empty)", color: t ? (light ? "#fff" : "#0f766e") : "#cbd5e1", animation: "covPop .4s cubic-bezier(.34,1.56,.64,1) backwards", animationDelay: Math.min(bi * 10 + ci, 44) * 0.012 + "s" }}>
                    <span className="text-[15px] font-bold tabular-nums leading-none">{t || "·"}</span>
                    {t > 0 && (
                      <span className="mt-0.5 flex flex-col items-center gap-0 text-[8.5px] font-semibold leading-tight" style={{ color: light ? "rgba(255,255,255,0.92)" : undefined }}>
                        {di === 0 && <span className={light ? "" : "text-teal-700 dark:text-teal-300"}>{T("활성 ", "live ")}{Math.round(((t - oo) / t) * 100)}%</span>}
                        {d != null && <span className={light ? "" : d > 0 ? "text-emerald-600 dark:text-emerald-400" : d < 0 ? "text-rose-500 dark:text-rose-400" : "text-gray-400 dark:text-gray-500"}>{T("어제 ", "vs ")}{d > 0 ? "▲" + d : d < 0 ? "▼" + -d : "±0"}</span>}
                        {oo > 0 && <span className={light ? "" : "text-amber-600 dark:text-amber-400"}>{T("품절 ", "OOS ")}{oo}</span>}
                      </span>
                    )}
                  </div>
                ) })}
              <div className={"flex w-full items-center justify-center rounded-md text-[11px] font-bold tabular-nums " + (b == null ? "" : "border border-indigo-100 bg-indigo-50/60 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300")}>{b ? (data.rowTot[b] || 0) : ""}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-gray-400 dark:text-gray-500">
        <span>{T("셀 큰 숫자=활성 SKU(전시 제품 수) · 색 진할수록 많음", "Big number = active SKUs (listed) · darker = more")}</span>
        <span><b className="text-teal-700 dark:text-teal-300">{T("활성 %", "live %")}</b> {T("전시 중 재고 비율=(활성−품절)/활성", "in-stock share = (active−OOS)/active")}</span>
        <span><b className="text-emerald-600 dark:text-emerald-400">어제 ▲</b>/<b className="text-rose-500 dark:text-rose-400">▼</b> {T("어제대비 증감", "vs prev")}</span>
        <span><b className="text-amber-600 dark:text-amber-400">{T("품절 n", "OOS n")}</b> {T("오늘 품절 수", "OOS today")}</span>
        <span className="ml-auto tabular-nums">{T("총 활성 SKU", "Total active")} <b className="text-gray-600 dark:text-gray-300">{data.grand.toLocaleString()}</b></span>
      </p>
        </>)}
      </div>
      <style>{":root{--cov-empty:#f1f5f9}.dark{--cov-empty:#0f172a}@keyframes covPop{0%{opacity:0;transform:scale(.55)}62%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}"}</style>
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
