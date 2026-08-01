"use client"

import Link from "next/link"

/** 상세 뷰 — 현재 별도 상세 화면은 각 페이지 모달·팝업으로 대체됨.
 *  라우트 자체는 유지하되, 대시보드 톤의 안내 화면으로 통일(구 Tremor 템플릿 잔재 제거). */
export default function Details() {
  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
        <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
        </div>
        <h1 className="mt-5 text-[19px] font-bold tracking-tight text-gray-900 dark:text-gray-50">상세 화면 준비 중</h1>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
          지표·뉴스·경쟁사 상세는 각 화면의 카드를 클릭하면 팝업으로 열립니다.
        </p>
        <Link href="/overview" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[12.5px] font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-95">
          대시보드로 이동
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
      </div>
    </main>
  )
}
