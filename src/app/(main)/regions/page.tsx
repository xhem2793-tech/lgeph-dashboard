"use client"

import RegionMapView from "@/components/RegionMapView"
import RegionPriceExtras from "@/components/RegionPriceExtras"

/** 필리핀 지역시장 지도 — 경제지표에서 분리한 별도 페이지(우측 위젯 없음).
 *  17개 지역 셀아웃·경제 choropleth + 지역 물가 히트맵. */
export default function RegionsPage() {
  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      {/* 히어로 — 지역 인텔리전스 테마 */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50/60 p-5 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-gray-950 dark:to-violet-500/5" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-violet-200/30 blur-3xl dark:bg-violet-500/10" />
        <div className="absolute -bottom-10 right-24 h-32 w-32 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/10" />
        <div className="relative flex flex-wrap items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-indigo-500 shadow-sm ring-1 ring-indigo-100 dark:bg-gray-900/70 dark:ring-indigo-500/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-6-3V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4m0 0L9 7" /></svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">필리핀 지역시장 지도</h1>
            <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">17개 지역 셀아웃·경제 <b className="font-semibold text-gray-600 dark:text-gray-300">choropleth</b>와 <b className="font-semibold text-gray-600 dark:text-gray-300">지역 물가 히트맵</b> — 권역별 수요·구매력 편차</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both", animationDelay: "60ms" }}>
        <RegionMapView />
        <RegionPriceExtras />
      </div>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>
    </main>
  )
}
