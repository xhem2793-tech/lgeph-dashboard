"use client"

import { siteConfig } from "@/app/siteConfig"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { useLang } from "@/lib/i18n"

const NAV_KEY: Record<string, "nav_overview" | "nav_economy" | "nav_news" | "nav_competitors" | "nav_competitor_ads" | "nav_calendar" | "nav_appendix"> = {
  "/overview": "nav_overview",
  "/economy": "nav_economy",
  "/news": "nav_news",
  "/competitors": "nav_competitors",
  "/competitor-ads": "nav_competitor_ads",
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
      <div className="mx-auto flex max-w-[1536px] items-center gap-5 px-4 py-2.5 sm:px-6" style={{ animation: "axfade .5s ease both" }}>
        <Link href="/overview" className="flex shrink-0 flex-col leading-none">
          <span className="text-[20px] font-extrabold tracking-tight">
            <span className="text-gray-900 dark:text-gray-50">axlgeph</span>
            <span className="text-indigo-600">.report</span>
          </span>
          <span className="mt-0.5 text-[10px] font-semibold text-gray-400">
            LG전자 필리핀법인 · 경영기획
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5 overflow-x-auto">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                (isActive(item.href)
                  ? "text-indigo-700 dark:text-indigo-400 "
                  : "text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400 ") +
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-out active:scale-95"
              }
            >
              {t(NAV_KEY[item.href] ?? "nav_overview")}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <form onSubmit={(e) => e.preventDefault()} className="relative hidden w-56 lg:block xl:w-64">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            </span>
            <input
              type="text"
              placeholder={t("search_ph")}
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-[13px] text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </form>
          <span className="hidden text-xs tabular-nums text-gray-500 dark:text-gray-400 lg:block">{today}</span>
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
          <span className="hidden rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 xl:block">{t("org")}</span>
        </div>
      </div>
    </header>
  )
}
