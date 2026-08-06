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
// 브랜드/거래선 로고 — Clearbit 로고 API(도메인 기반)로 전부 통일(크기 일관·object-contain). 실패 시 이름 폴백.
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
// 로고 — Google 파비콘(정사각 128px)으로 전부 통일(크기 일관). 실패 시 이름 폴백.
const favi = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
const brandLogo = (b: string): string | null => BRAND_DOMAIN[b] ? favi(BRAND_DOMAIN[b]) : null
const retailerLogo = (r: string): string | null => RETAILER_DOMAIN[r] ? favi(RETAILER_DOMAIN[r]) : null
const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = "none" }

function CoverageHeatmap({ rows: allRows, stamp }: { rows: PriceRow[]; stamp: string | null }) {
  const [di, setDi] = React.useState(0)
  const [cat, setCat] = React.useState("전체")
  const [metric, setMetric] = React.useState<"count" | "actRate" | "oosCnt" | "oosRate">("count") // 셀 표시 지표
  // 제품 4개 고정: 냉장고·세탁기·에어컨(RAC)·TV (항상 노출)
  const cats = ["냉장고", "세탁기", "에어컨", "TV"]
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
    let maxOos = 1; oos.forEach((v) => { if (v > maxOos) maxOos = v })
    const colTot: Record<string, number> = {}, rowTot: Record<string, number> = {}
    today.forEach((v, k) => { const [b, ret] = k.split("|"); colTot[ret] = (colTot[ret] || 0) + v; rowTot[b] = (rowTot[b] || 0) + v })
    const grand = Array.from(today.values()).reduce((a, b) => a + b, 0)
    return { retailers, brands, today, prev, fresh, oos, maxT, maxOos, colTot, rowTot, grand, K }
  }, [rows, di])
  const slots = [0, 1, 2, 3].filter((i) => dates[i])
  const slotPos = slots.indexOf(di)
  const pickDate = (v: string) => { const idx = [0, 1, 2, 3].find((i) => dates[i] === v); if (idx != null) setDi(idx) }
  // 거래선 10열 고정 — 9번(index 8)은 Imperial(비활성) 고정, 나머지는 활성 거래선 순서대로
  const retSlots: (string | null)[] = []
  { let ai = 0; for (let i = 0; i < 10; i++) { if (i === 8) retSlots.push(IMPERIAL); else { retSlots.push(data.retailers[ai] ?? null); ai++ } } }
  const brSlots = Array.from({ length: 10 }, (_, i) => data.brands[i] ?? null) // 브랜드 10행 고정
  return (
    <div className="flex flex-col gap-2.5">
      {/* 한 줄 필터바 — 채널별 가격비교식(제품 드롭다운 + 날짜 토글 + 최신) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <PmDrop label={T("제품", "Div")} sel={cat} options={[{ k: "전체", t: T("전체", "All") }, ...cats.map((c) => ({ k: c, t: c === "에어컨" ? "RAC" : catLabel(c) }))]} onSelect={setCat} />
        <PmDrop label={T("지표", "Metric")} sel={metric} options={[{ k: "count", t: T("SKU 총갯수", "Total SKUs") }, { k: "actRate", t: T("활성화율", "Active %") }, { k: "oosCnt", t: T("품절 갯수", "OOS count") }, { k: "oosRate", t: T("품절율", "OOS %") }]} onSelect={(k) => setMetric(k as "count" | "actRate" | "oosCnt" | "oosRate")} />
        {/* 날짜 네비게이터(왼쪽 붙임) — 채널별 가격비교(BoardView) 스타일: ◀ 이전 · ▶ 다음 · 📅 달력 */}
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
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
      </div>
      {/* 히트맵 카드(바둑판) */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3">
        {data.brands.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-[12px] text-gray-400 dark:text-gray-500">{T("해당 조건의 전시 데이터가 없습니다.", "No listing data for this filter.")}</div>
        ) : (<>
      <div className="overflow-x-auto px-0.5 pb-1 pt-2">
        {/* 10×10 고정 매트릭스 — 거래선 10열·브랜드 10행. 부족분은 빈 칸. 폭에 맞춰 늘어나는 정사각 셀. */}
        <div key={cat + "-" + di + "-" + metric} className="grid w-full gap-[5px] text-[11px]" style={{ minWidth: 660, gridTemplateColumns: `minmax(96px,0.9fr) repeat(10, minmax(50px,1fr))` }}>
          {/* 헤더 행 */}
          <div className="sticky left-0 z-10 bg-white dark:bg-gray-900/40" />
          {retSlots.map((ret, ci) => ret === IMPERIAL ? (
            <div key={ci} className="flex h-[70px] w-full flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-gray-200 bg-gray-50/40 px-0.5 text-center opacity-70 dark:border-gray-700 dark:bg-gray-800/20" title={T("준비 중 · 스크래핑 미연동", "Coming soon · not connected")}>
              <span className="rounded-full bg-gray-100 px-1 text-[8px] font-bold tabular-nums text-gray-400 dark:bg-gray-700 dark:text-gray-400">#9</span>
              <span className="w-full break-words px-0.5 text-center text-[10.5px] font-semibold leading-tight text-gray-400 dark:text-gray-500">Imperial</span>
              <span className="rounded bg-gray-100 px-1 text-[8px] font-semibold text-gray-400 dark:bg-gray-700 dark:text-gray-500">{T("준비중", "soon")}</span>
            </div>
          ) : ret ? (
            <a key={ci} href={RETAILER_DOMAIN[ret] ? `https://${RETAILER_DOMAIN[ret]}` : undefined} target="_blank" rel="noopener noreferrer" title={pmShopLabel(ret) + (RETAILER_DOMAIN[ret] ? " · " + T("사이트 열기", "open site") : "")} className="flex h-[70px] w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-gray-100 bg-gray-50 px-0.5 text-center transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:z-10 hover:-translate-y-0.5 hover:scale-[1.06] hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-indigo-500/40" style={{ animation: "covPop .6s cubic-bezier(.22,1,.36,1) backwards", animationDelay: ci * 0.02 + "s" }}>
              <span className="rounded-full bg-indigo-50 px-1 text-[8px] font-bold tabular-nums text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300" title={T("매출 순위", "Sales rank")}>#{ci + 1}</span>
              {retailerLogo(ret) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={retailerLogo(ret) as string} alt={pmShopLabel(ret)} loading="lazy" onError={hideOnError} className="h-6 w-6 rounded-sm object-contain" />
              )}
              <span className="w-full break-words px-0.5 text-center text-[10.5px] font-semibold leading-tight text-gray-700 dark:text-gray-200" title={pmShopLabel(ret)}>{pmShopLabel(ret)}</span>
              <span className="text-[10px] font-normal tabular-nums text-gray-400">{data.colTot[ret] || 0}</span>
            </a>
          ) : <div key={ci} />)}
          {/* 본문 — 브랜드 10행(부족분 빈 칸) × 거래선 10열 */}
          {brSlots.map((b, bi) => (
            <React.Fragment key={bi}>
              <div className={"sticky left-0 z-10 flex h-[70px] w-full flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 text-center text-[12px] font-bold transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:z-20 hover:-translate-y-0.5 hover:scale-[1.05] hover:shadow-md " + (b == null ? "border-transparent bg-transparent" : b === "LG" ? "border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-gray-100 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-200")} style={b == null ? undefined : { animation: "covPop .6s cubic-bezier(.22,1,.36,1) backwards", animationDelay: bi * 0.02 + "s" }}>
                {b && brandLogo(b) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogo(b) as string} alt={b} loading="lazy" onError={hideOnError} className="h-6 w-6 rounded-sm object-contain" />
                )}
                <span className="w-full break-words leading-tight">{b ?? ""}</span>
                {b && <span className="text-[10px] font-normal tabular-nums text-gray-400">{data.rowTot[b] || 0}</span>}
              </div>
              {retSlots.map((ret, ci) => {
                if (ret === IMPERIAL) return <div key={ci} className="flex h-[70px] w-full items-center justify-center rounded-md border border-dashed border-gray-200 text-[9px] text-gray-300 dark:border-gray-700 dark:text-gray-600" style={{ background: "var(--cov-empty)", opacity: 0.45 }}>{b ? "—" : ""}</div>
                if (!b || !ret) return <div key={ci} className="h-[70px] w-full rounded-md" style={{ background: "var(--cov-empty)", opacity: 0.5 }} />
                const k = data.K(b, ret); const t = data.today.get(k) || 0; const oo = di === 0 ? (data.oos.get(k) || 0) : 0; const p = di < 3 ? (data.prev.get(k) || 0) : null; const dlt = p != null ? t - p : null
                let disp: string, alpha: number, teal = true
                if (metric === "count") { disp = t ? String(t) : "·"; alpha = t ? Math.max(0.12, Math.min(1, t / data.maxT)) : 0 }
                else if (metric === "actRate") { const r = t > 0 ? ((t - oo) / t) * 100 : null; disp = r == null ? "·" : Math.round(r) + "%"; alpha = r != null ? Math.max(0.12, r / 100) : 0 }
                else if (metric === "oosCnt") { teal = false; disp = oo ? String(oo) : (t ? "0" : "·"); alpha = oo ? Math.max(0.18, Math.min(1, oo / data.maxOos)) : 0 }
                else { teal = false; const r = t > 0 ? (oo / t) * 100 : null; disp = r == null ? "·" : Math.round(r) + "%"; alpha = r != null ? Math.max(0.08, r / 100) : 0 }
                const rgb = teal ? "13,148,136" : "244,63,94"; const light = alpha > 0.55
                return (
                  <div key={ci} title={`${b} · ${pmShopLabel(ret)}\n${T("활성 SKU", "Active")} ${t}${dlt != null ? ` · ${T("어제대비", "vs prev")} ${dlt > 0 ? "+" : ""}${dlt}` : ""}${oo ? ` · ${T("품절", "OOS")} ${oo}` : ""}${t > 0 ? ` · ${T("활성율", "live")} ${Math.round(((t - oo) / t) * 100)}%` : ""}`}
                    className="flex h-[70px] w-full items-center justify-center rounded-md text-center transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:z-10 hover:-translate-y-0.5 hover:scale-[1.06] hover:shadow-lg hover:ring-2 hover:ring-teal-400/70 dark:hover:ring-teal-300/60" style={{ background: alpha > 0 ? `rgba(${rgb},${alpha})` : "var(--cov-empty)", color: alpha > 0 ? (light ? "#fff" : teal ? "#0f766e" : "#9f1239") : "#cbd5e1", animation: "covPop .6s cubic-bezier(.22,1,.36,1) backwards", animationDelay: Math.min(bi * 10 + ci, 44) * 0.012 + "s" }}>
                    <span className="text-[19px] font-bold tabular-nums xl:text-[23px]">{disp}</span>
                  </div>
                ) })}
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
