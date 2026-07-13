"use client"

import { siteConfig } from "@/app/siteConfig"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { useLang } from "@/lib/i18n"

const NAV_KEY: Record<string, "nav_overview" | "nav_economy" | "nav_news" | "nav_competitors" | "nav_calendar" | "nav_appendix"> = {
  "/overview": "nav_overview",
  "/economy": "nav_economy",
  "/news": "nav_news",
  "/competitors": "nav_competitors",
  "/calendar": "nav_calendar",
  "/appendix": "nav_appendix",
}

export function TopNav() {
  const pathname = usePathname()
  const { lang, setLang, t } = useLang()
  const [today, setToday] = React.useState("")
  React.useEffect(() => {
    setToday(
      new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(new Date()),
    )
  }, [lang])
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <style>{"@keyframes axfade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}"}</style>
      <div className="mx-auto flex max-w-[1536px] items-center gap-4 px-4 py-3 sm:px-6" style={{ animation: "axfade .5s ease both" }}>
        {/* 워드마크 — 주소가 곧 브랜드. 아래 한 줄로 소속을 고정해 캡처가 돌아도 오해가 없다 */}
        <Link href="/overview" className="flex shrink-0 flex-col leading-none">
          <span className="text-[20px] font-extrabold tracking-tight">
            <span className="text-gray-900 dark:text-gray-50">axlgeph</span>
            <span className="text-indigo-600">.report</span>
          </span>
          <span className="mt-1 border-t border-gray-200 pt-0.5 text-[10px] font-semibold text-gray-400 dark:border-gray-700">
            LG전자 필리핀법인 · 경영기획
          </span>
        </Link>
        <form onSubmit={(e) => e.preventDefault()} className="relative mx-auto hidden w-full max-w-xl md:block">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </span>
          <input
            type="text"
            placeholder={t("search_ph")}
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-12 text-sm text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button type="submit" aria-label="검색" className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-white transition-all duration-300 ease-out hover:scale-110 hover:bg-indigo-700 active:scale-95">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </button>
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden text-xs tabular-nums text-gray-500 dark:text-gray-400 sm:block">{today}</span>
          {/* 언어 전환 — 선택은 브라우저에 저장된다 */}
          <div className="flex shrink-0 items-center rounded-md border border-gray-200 p-0.5 dark:border-gray-700">
            {(["ko", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={
                  "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase transition-all duration-200 " +
                  (lang === l ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-indigo-600")
                }
              >
                {l}
              </button>
            ))}
          </div>
          <span className="hidden rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 md:block">{t("org")}</span>
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1536px] items-center gap-1 overflow-x-auto border-t border-gray-100 px-4 py-1.5 dark:border-gray-800/60 sm:px-6" style={{ animation: "axfade .5s ease both", animationDelay: ".08s" }}>
        {siteConfig.nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              (isActive(item.href)
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 "
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50 ") +
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
            }
          >
            {t(NAV_KEY[item.href] ?? "nav_overview")}
          </Link>
        ))}
      </nav>
      {/* 상단 자동스크롤 티커 제거 (2026-07-12)
          이유: ① ▲▼ 표기 = BRANDING_GUIDE §2 위반(↑↓만 허용)
               ② 우측 경제지표 레일과 완전 중복
               ③ 무한 스크롤 = "시세판 금지" 원칙 위반 — 우리는 금융 시세판이 아니라 가전 법인 상황판
          지표는 홈 우측 sticky 레일(EconRail)로 이관 */}
    </header>
  )
}
