"use client"

// 프로모 강도 — 브랜드별 프로모 인텐시티·캠페인 타임라인.
import React from "react"
import type { PromoIntensity, PromoCampaign } from "@/lib/supabase"

export function PromoView({ rows, camps }: { rows: PromoIntensity[] | null; camps: PromoCampaign[] }) {
  if (rows === null) {
    return <div className="flex min-h-[440px] items-center justify-center text-[14px] text-gray-400 dark:text-gray-500">불러오는 중</div>
  }
  if (rows.length === 0) {
    return <div className="flex min-h-[440px] items-center justify-center text-[14px] text-gray-400 dark:text-gray-500">데이터 없음</div>
  }
  const wow = (n: number) => (n > 0 ? "+" + n : String(n))
  const tone = (n: number) =>
    n > 0 ? "text-rose-600 dark:text-rose-400" : n < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/70 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 text-left">브랜드</th>
              <th className="px-3 py-2 text-left">유통</th>
              <th className="px-3 py-2 text-right">프로모 모델</th>
              <th className="px-3 py-2 text-right">전주 대비</th>
              <th className="px-3 py-2 text-right">평균 할인율</th>
              <th className="px-3 py-2 text-right">전주 대비</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.brand + r.retailer}
                className="border-b border-gray-50 dark:border-gray-800 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
                style={{ animation: "rowIn .3s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 22 + "ms" }}
              >
                <td className={"px-3 py-2 font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>
                  {r.brand}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.retailer}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                  {r.promoModels}
                  <span className="text-[11px] text-gray-400 dark:text-gray-500"> / {r.listedModels}</span>
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
          <p className="mb-1.5 text-[13px] font-semibold text-gray-700 dark:text-gray-200">유통 캠페인 (진행 중)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {camps.map((c) => (
              <a
                key={c.retailer + c.title}
                href={c.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 transition-all duration-200 hover:-translate-y-px hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-sm"
              >
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{c.retailer}</p>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-50">{c.title}</p>
                <p className="mt-1 text-[12.5px] text-gray-600 dark:text-gray-300">
                  {c.liveDiscounted !== null && <span>할인 {c.liveDiscounted}종 · 평균 {c.avgDiscount}% · 최대 {c.maxDiscount}%</span>}
                  {c.onSaleCount !== null && <span>세일 중 {c.onSaleCount.toLocaleString()}종</span>}
                </p>
                {c.brands.length > 0 && (
                  <p className="mt-1 truncate text-[12px] text-gray-400 dark:text-gray-500">{c.brands.join(" · ")}</p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">
        프로모 모델 = 할인가 또는 프로모 문구가 걸린 리스팅 · 전주 대비는 7일 전 대비 변화
        <br />
        Anson&apos;s는 정가 필드가 세일가로 표기돼 비중이 항상 100% — 판단은 전주 대비 변화와 평균 할인율 기준
      </p>
    </div>
  )
}

/** 프로모 딜 — v_competitor_promo 실딜 리스트. 유통별 프로모(할인율·무료배송·쿠폰·번들·할부)를
 *  태그로 분류해 필터·정렬. 브랜드 화이트리스트만. 카드 클릭 → 원문. */
// 프로모 종류(컬럼 순서 고정): 쿠폰·번들·할부·배송·사은품
// 프로모 종류(컬럼 순서 고정): 쿠폰·번들·할부·배송·사은품
