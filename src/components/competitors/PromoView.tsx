"use client"

// 프로모 강도 — 브랜드별 프로모 인텐시티·캠페인 타임라인.
import React from "react"
import type { PromoIntensity, PromoCampaign } from "@/lib/supabase"
import { T } from "@/lib/i18n"

export function PromoView({ rows, camps }: { rows: PromoIntensity[] | null; camps: PromoCampaign[] }) {
  if (rows === null) {
    return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("불러오는 중", "Loading")}</div>
  }
  if (rows.length === 0) {
    return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("데이터 없음", "No data")}</div>
  }
  const wow = (n: number) => (n > 0 ? "+" + n : String(n))
  const tone = (n: number) =>
    n > 0 ? "text-rose-600 dark:text-rose-400" : n < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 text-left">{T("브랜드", "Brand")}</th>
              <th className="px-3 py-2 text-left">{T("유통", "Retailer")}</th>
              <th className="px-3 py-2 text-right">{T("프로모 모델", "Promo models")}</th>
              <th className="px-3 py-2 text-right">{T("전주 대비", "WoW")}</th>
              <th className="px-3 py-2 text-right">{T("평균 할인율", "Avg. discount")}</th>
              <th className="px-3 py-2 text-right">{T("전주 대비", "WoW")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.brand + r.retailer}
                className="border-b border-gray-50 dark:border-gray-800 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10"
                style={{ animation: "rowIn .3s cubic-bezier(.22,1,.36,1) both", animationDelay: i * 22 + "ms" }}
              >
                <td className={"px-3 py-2 font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>
                  {r.brand}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.retailer}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                  {r.promoModels}
                  <span className="text-[10px] text-gray-400 dark:text-gray-500"> / {r.listedModels}</span>
                </td>
                <td className={"px-3 py-2 text-right tabular-nums font-semibold " + tone(r.promoModelsWow)}>
                  {wow(r.promoModelsWow)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                  {r.avgDiscount === null ? "—" : r.avgDiscount.toFixed(1) + "%"}
                </td>
                <td className={"px-3 py-2 text-right tabular-nums font-semibold " + tone(r.avgDiscountWowPp ?? 0)}>
                  {r.avgDiscountWowPp === null ? "—" : wow(r.avgDiscountWowPp) + "%p"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {camps.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-200">{T("유통 캠페인 (진행 중)", "Retailer campaigns (live)")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {camps.map((c) => (
              <a
                key={c.retailer + c.title}
                href={c.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-sm active:scale-[.99]"
              >
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{c.retailer}</p>
                <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-50">{c.title}</p>
                <p className="mt-1 text-[11.5px] text-gray-600 dark:text-gray-300">
                  {c.liveDiscounted !== null && <span>{T("할인 ", "Disc. ")}{c.liveDiscounted}{T("종 · 평균 ", " SKUs · avg ")}{c.avgDiscount}{T("% · 최대 ", "% · max ")}{c.maxDiscount}%</span>}
                  {c.onSaleCount !== null && <span>{T("세일 중 ", "On sale ")}{c.onSaleCount.toLocaleString()}{T("종", " SKUs")}</span>}
                </p>
                {c.brands.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500">{c.brands.join(" · ")}</p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        {T("프로모 모델 = 할인가 또는 프로모 문구가 걸린 리스팅 · 전주 대비는 7일 전 대비 변화", "Promo models = listings with a discounted price or promo copy · WoW = change vs 7 days ago")}
        <br />
        Anson&apos;s{T("는 정가 필드가 세일가로 표기돼 비중이 항상 100% — 판단은 전주 대비 변화와 평균 할인율 기준", " lists its regular-price field as the sale price, so its share is always 100% — assess by WoW change and average discount")}
      </p>
    </div>
  )
}

/** 프로모 딜 — v_competitor_promo 실딜 리스트. 유통별 프로모(할인율·무료배송·쿠폰·번들·할부)를
 *  태그로 분류해 필터·정렬. 브랜드 화이트리스트만. 카드 클릭 → 원문. */
// 프로모 종류(컬럼 순서 고정): 쿠폰·번들·할부·배송·사은품
// 프로모 종류(컬럼 순서 고정): 쿠폰·번들·할부·배송·사은품
