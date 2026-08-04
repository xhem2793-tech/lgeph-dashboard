"use client"

import WeatherView from "@/components/WeatherView"

/** 날씨·재난 — 냉방도일 CDD·기온·태풍·지진. 경제지표에서 분리한 별도 페이지(예정/실험). */
export default function WeatherPage() {
  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      {/* 히어로 — 날씨·재해 테마 그라디언트(냉방수요·리스크) */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50/60 p-5 dark:border-sky-500/20 dark:from-sky-500/10 dark:via-gray-950 dark:to-amber-500/5" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-500/10" />
        <div className="absolute -bottom-10 right-24 h-32 w-32 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
        <div className="relative flex flex-wrap items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-amber-500 shadow-sm ring-1 ring-sky-100 dark:bg-gray-900/70 dark:ring-sky-500/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">날씨·재난</h1>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">예정</span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">냉방도일(CDD)·월평균 기온·태풍 경보·지진 활동 — <b className="font-semibold text-gray-600 dark:text-gray-300">냉방 수요 선행</b>과 <b className="font-semibold text-gray-600 dark:text-gray-300">공급망·재해 리스크</b>를 함께</p>
          </div>
        </div>
      </div>
      <div style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both", animationDelay: "60ms" }}>
        <WeatherView />
      </div>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>
    </main>
  )
}
