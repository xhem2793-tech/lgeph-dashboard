"use client"

import WeatherView from "@/components/WeatherView"

/** 날씨·재난 — 냉방도일 CDD·기온·태풍·지진. 경제지표에서 분리한 별도 페이지(예정/실험). */
export default function WeatherPage() {
  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <div className="mb-3 flex items-baseline gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
        <h1 className="text-[18px] font-bold tracking-tight text-gray-900 dark:text-gray-50">날씨·재난</h1>
        <span className="text-[12px] text-gray-400 dark:text-gray-500">냉방도일 CDD·월평균 기온·태풍·지진 — 냉방 수요·재해 리스크</span>
        <span className="ml-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">예정</span>
      </div>
      <div style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
        <WeatherView />
      </div>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>
    </main>
  )
}
