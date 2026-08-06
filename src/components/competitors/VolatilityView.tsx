"use client"

// 가격 변동성 — 스크래핑 커버리지 히트맵(가로=거래선, 세로=브랜드).
// 셀=선택일 전시(스크랩)된 제품 수(=pN 존재). 각 셀: 당일 수(색농도)·어제대비 Δ·신규(어제 없던 것)·품절(오늘 OOS). 상단 날짜 토글.
import React from "react"
import { T } from "@/lib/i18n"
import { fmtStamp, type PriceRow } from "@/lib/supabase"
import { md, pmShopLabel } from "@/components/competitors/shared"

const COV_P = ["p0", "p1", "p2", "p3"] as const
const COV_D = ["d0", "d1", "d2", "d3"] as const

function CoverageHeatmap({ rows }: { rows: PriceRow[] }) {
  const [di, setDi] = React.useState(0)
  const listedOn = (r: PriceRow, slot: number) => slot >= 0 && slot <= 3 && r[COV_P[slot]] != null
  const dates = React.useMemo(() => [0, 1, 2, 3].map((i) => { const m = new Map<string, number>(); rows.forEach((r) => { const v = r[COV_D[i]] as string | null; if (v) m.set(v, (m.get(v) || 0) + 1) }); let best: string | null = null, bc = 0; m.forEach((c, d) => { if (c > bc) { bc = c; best = d } }); return best }), [rows])
  const data = React.useMemo(() => {
    const retM = new Map<string, number>(), brM = new Map<string, number>()
    rows.forEach((r) => { if (listedOn(r, di)) { if (r.retailer) retM.set(r.retailer, (retM.get(r.retailer) || 0) + 1); if (r.brand) brM.set(r.brand, (brM.get(r.brand) || 0) + 1) } })
    const retailers = Array.from(retM.entries()).sort((a, b) => b[1] - a[1]).map((x) => x[0])
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
  if (!rows.length) return null
  const slots = [0, 1, 2, 3].filter((i) => dates[i])
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="h-[15px] w-1 rounded bg-indigo-500" />
        <h4 className="text-[13px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("전시 커버리지", "Listing coverage")}</h4>
        <span className="text-[10.5px] text-gray-400 dark:text-gray-500">{T("거래선 × 브랜드 · 스크랩된 전시 제품 수", "Retailer × brand · listed (scraped) SKUs")}</span>
        {/* 날짜 토글 */}
        <div className="ml-auto flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-0.5">
          {slots.map((i) => (
            <button key={i} type="button" onClick={() => setDi(i)} className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors " + (di === i ? "bg-indigo-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300")}>{md(dates[i])}{i === 0 ? T(" 오늘", " today") : ""}</button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate text-[11px]" style={{ borderSpacing: "3px" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white dark:bg-gray-900/40 px-1.5 py-1 text-left text-[10px] font-semibold text-gray-400 dark:text-gray-500">{T("브랜드＼거래선", "Brand＼Retailer")}</th>
              {data.retailers.map((ret) => <th key={ret} className="px-1 py-1 text-center text-[10px] font-semibold text-gray-600 dark:text-gray-300"><div className="truncate" title={pmShopLabel(ret)} style={{ maxWidth: 74 }}>{pmShopLabel(ret)}</div><div className="text-[9px] font-normal tabular-nums text-gray-400">{data.colTot[ret] || 0}</div></th>)}
              <th className="px-1 py-1 text-center text-[10px] font-semibold text-indigo-500 dark:text-indigo-300">{T("합계", "Total")}</th>
            </tr>
          </thead>
          <tbody>
            {data.brands.map((b) => (
              <tr key={b}>
                <td className={"sticky left-0 z-10 whitespace-nowrap bg-white px-1.5 py-1 text-left text-[11px] font-bold dark:bg-gray-900/40 " + (b === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-200")}>{b}</td>
                {data.retailers.map((ret) => { const k = data.K(b, ret); const t = data.today.get(k) || 0; const p = di < 3 ? (data.prev.get(k) || 0) : null; const d = p != null ? t - p : null; const fr = data.fresh.get(k) || 0; const oo = di === 0 ? (data.oos.get(k) || 0) : 0
                  const alpha = t ? Math.max(0.12, Math.min(1, t / data.maxT)) : 0; const light = alpha > 0.55
                  return (
                    <td key={ret} className="p-0" title={`${b} · ${pmShopLabel(ret)}\n${T("전시", "Listed")} ${t}${d != null ? ` · ${T("어제대비", "vs prev")} ${d > 0 ? "+" : ""}${d}` : ""}${fr ? ` · ${T("신규", "new")} ${fr}` : ""}${oo ? ` · ${T("품절", "OOS")} ${oo}` : ""}`}>
                      <div className="flex min-h-[46px] flex-col items-center justify-center rounded-md px-1 py-1" style={{ background: t ? `rgba(13,148,136,${alpha})` : "var(--cov-empty)", color: t ? (light ? "#fff" : "#0f766e") : "#cbd5e1" }}>
                        <span className="text-[14px] font-bold tabular-nums leading-none">{t || "·"}</span>
                        {(d != null || fr > 0 || oo > 0) && (
                          <span className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1 text-[8px] font-semibold leading-tight" style={{ color: light ? "rgba(255,255,255,0.9)" : undefined }}>
                            {d != null && d !== 0 && <span className={light ? "" : d > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>{d > 0 ? "▲" + d : "▼" + -d}</span>}
                            {fr > 0 && <span className={light ? "" : "text-indigo-600 dark:text-indigo-300"}>+{fr}{T("신", "n")}</span>}
                            {oo > 0 && <span className={light ? "" : "text-amber-600 dark:text-amber-400"}>{oo}{T("품", "x")}</span>}
                          </span>
                        )}
                      </div>
                    </td>
                  ) })}
                <td className="px-1 text-center text-[11px] font-bold tabular-nums text-indigo-600 dark:text-indigo-300">{data.rowTot[b] || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{":root{--cov-empty:#f1f5f9}.dark{--cov-empty:#0f172a}"}</style>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-gray-400 dark:text-gray-500">
        <span>{T("셀 큰 숫자=해당일 전시(스크랩)된 제품 수 · 색 진할수록 많음", "Big number = SKUs listed (scraped) that day · darker = more")}</span>
        <span><b className="text-emerald-600 dark:text-emerald-400">▲</b>/<b className="text-rose-500 dark:text-rose-400">▼</b> {T("어제대비", "vs prev")}</span>
        <span><b className="text-indigo-600 dark:text-indigo-300">＋n신</b> {T("신규 전시", "new listings")}</span>
        <span><b className="text-amber-600 dark:text-amber-400">품</b> {T("오늘 품절", "OOS today")}</span>
        <span className="ml-auto tabular-nums">{T("총 전시", "Total listed")} <b className="text-gray-600 dark:text-gray-300">{data.grand.toLocaleString()}</b></span>
      </p>
    </div>
  )
}

export function VolatilityView({ rows, stamp }: { rows: PriceRow[] | null; stamp: string | null }) {
  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("불러오는 중", "Loading")}</div>
  return (
    <div className="mt-3 flex flex-col gap-3" style={{ animation: "fadeUp .5s ease both" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] text-gray-500 dark:text-gray-400">{T("각 거래선 사이트에 브랜드별로 몇 개 제품이 전시(스크랩)되는지 — 취급·노출 커버리지를 한눈에.", "How many SKUs each retailer lists per brand — listing & exposure coverage at a glance.")}</p>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
      </div>
      <CoverageHeatmap rows={rows} />
    </div>
  )
}
