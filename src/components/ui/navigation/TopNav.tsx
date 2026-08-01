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
    <div role="group" aria-label={ariaLabel} className="relative flex items-center rounded-full bg-gray-200/80 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] dark:bg-gray-800/80 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
      <span
        aria-hidden
        className="absolute bottom-[3px] top-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.04)] transition-transform duration-[420ms] ease-[cubic-bezier(.34,1.56,.64,1)] dark:bg-gray-950 dark:shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
        style={{ width: `calc((100% - 6px) / ${options.length})`, left: 3, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={
            "relative z-10 flex h-7 min-w-9 flex-1 items-center justify-center rounded-full px-2.5 text-[11.5px] font-semibold transition-colors duration-200 active:scale-[.93] " +
            (value === o.value ? "text-gray-900 dark:text-gray-50" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200")
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

/** 전역 검색 — 포커스 시 폭이 부드럽게 확장(cubic-bezier), 제출하면 /news?q= 로.
 *  "/" 로 어디서든 포커스, Esc 로 해제·비우기. 모든 페이지 상단에 상시. */
function SearchBox() {
  const router = useRouter()
  const ref = React.useRef<HTMLInputElement | null>(null)
  const [q, setQ] = React.useState("")
  const [focused, setFocused] = React.useState(false)

  // "/" 단축키 — 입력 중이 아닐 때 어디서든 검색으로
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      if (e.key === "/" && !typing) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = q.trim()
    if (v) router.push("/news?q=" + encodeURIComponent(v))
  }

  const open = focused || q.length > 0

  return (
    <form
      onSubmit={submit}
      role="search"
      className={
        "group relative ml-auto hidden shrink-0 transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)] md:block " +
        (open ? "w-[384px]" : "w-[248px]")
      }
    >
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"
      >
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); ref.current?.blur() } }}
        placeholder="뉴스 · 지표 · 경쟁사 검색"
        aria-label="통합 검색"
        className="w-full rounded-full border border-gray-200 bg-gray-50/80 py-2 pl-10 pr-10 text-[13px] text-gray-900 outline-none transition-all duration-300 ease-out placeholder:text-gray-400 hover:border-gray-300 hover:bg-white focus:border-indigo-400 focus:bg-white focus:shadow-[0_0_0_3.5px_rgba(99,102,241,0.12)] dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-gray-700 dark:focus:border-indigo-500/50 dark:focus:bg-gray-900 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {/* 우측: 비어있으면 단축키 힌트, 입력 중이면 지우기 버튼 */}
      {q ? (
        <button
          type="button"
          onClick={() => { setQ(""); ref.current?.focus() }}
          aria-label="검색어 지우기"
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-indigo-600 active:scale-90 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none rounded border border-gray-200 bg-white px-1.5 py-px font-sans text-[11px] font-semibold text-gray-400 opacity-100 transition-opacity duration-300 group-focus-within:opacity-0 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 lg:block"
        >
          /
        </kbd>
      )}
    </form>
  )
}

export function TopNav() {
  const pathname = usePathname()
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
                  ? "bg-indigo-50/70 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 "
                  : "text-gray-900 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-100 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 ") +
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-out hover:-translate-y-px active:scale-95"
              }
            >
              {t(NAV_KEY[item.href] ?? "nav_overview")}
            </Link>
          ))}
        </nav>

        <SearchBox />

        <div className="flex shrink-0 items-center gap-2.5 max-md:ml-auto">
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
