"use client"

import { siteConfig } from "@/app/siteConfig"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import React from "react"
import { useTheme } from "next-themes"
import { useLang } from "@/lib/i18n"

const NAV_KEY: Record<string, "nav_overview" | "nav_economy" | "nav_news" | "nav_competitors" | "nav_competitor_ads" | "nav_calendar" | "nav_appendix" | "nav_reports"> = {
  "/overview": "nav_overview",
  "/economy": "nav_economy",
  "/news": "nav_news",
  "/competitors": "nav_competitors",
  "/competitor-ads": "nav_competitor_ads",
  "/calendar": "nav_calendar",
  "/appendix": "nav_appendix",
  "/reports": "nav_reports",
}

/** 슬라이딩 알약 토글 — 활성 옵션 뒤로 흰 스위치가 부드럽게 이동(cubic-bezier).
 *  옵션 2개 이상 균등폭. 언어·테마 공용. */
function PillToggle<T extends string>({ options, value, onChange, ariaLabel }: {
  options: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; ariaLabel: string
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="group" aria-label={ariaLabel} className="relative flex items-center rounded-full border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-700 dark:bg-gray-800">
      <span
        aria-hidden
        className="absolute bottom-0.5 top-0.5 rounded-full bg-white ring-1 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] dark:bg-gray-950 dark:ring-white/10"
        style={{ width: `calc((100% - 4px) / ${options.length})`, left: 2, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={
            "relative z-10 flex h-6 min-w-8 flex-1 items-center justify-center rounded-full px-2 text-[11px] font-semibold transition-colors duration-200 " +
            (value === o.value ? "text-indigo-600 dark:text-indigo-300" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const SunIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const MoonIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchRef.current?.value.trim()
    if (q) router.push("/news?q=" + encodeURIComponent(q))
  }
  const { lang, setLang, t } = useLang()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")
  const cur = (theme === "system" ? resolvedTheme : theme) === "dark" ? "dark" : "light"

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <style>{"@keyframes axfade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}"}</style>
      <div className="mx-auto flex items-center gap-6 px-6 py-3.5 sm:px-8 lg:px-10" style={{ animation: "axfade .5s ease both" }}>
        <Link href="/overview" className="flex shrink-0 items-center leading-none">
          <span className="text-[21.5px] font-extrabold tracking-tight leading-none">
            <span className="text-gray-900 dark:text-gray-50">axlgeph</span>
            <span className="text-indigo-600 dark:text-indigo-400">.report</span>
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

        <form onSubmit={onSearch} className="relative ml-auto hidden md:block">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="뉴스·지표·경쟁사 검색"
            aria-label="통합 검색"
            className="w-[210px] rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2 pl-9 pr-3.5 text-[13px] outline-none transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 focus:w-[300px] focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900"
          />
        </form>

        <div className="flex shrink-0 items-center gap-2.5">
          <PillToggle
            ariaLabel="언어 선택"
            value={lang}
            onChange={(v) => setLang(v)}
            options={[{ value: "ko", label: "KO" }, { value: "en", label: "EN" }]}
          />
          {mounted && (
            <PillToggle
              ariaLabel="테마 선택"
              value={cur}
              onChange={(v) => setTheme(v)}
              options={[{ value: "light", label: SunIcon }, { value: "dark", label: MoonIcon }]}
            />
          )}
        </div>
      </div>
    </header>
  )
}
