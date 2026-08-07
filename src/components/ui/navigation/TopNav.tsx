"use client"

import { siteConfig } from "@/app/siteConfig"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { useTheme } from "next-themes"
import { useLang, T } from "@/lib/i18n"
import { useAccessIdentity } from "@/lib/useAccessIdentity"
import { signOut } from "@/lib/authClient"

const NAV_KEY: Record<string, "nav_overview" | "nav_economy" | "nav_news" | "nav_competitors" | "nav_competitor_ads" | "nav_calendar" | "nav_appendix" | "nav_reports" | "nav_weather"> = {
  "/overview": "nav_overview",
  "/economy": "nav_economy",
  "/news": "nav_news",
  "/competitors": "nav_competitors",
  "/competitor-ads": "nav_competitor_ads",
  "/calendar": "nav_calendar",
  "/appendix": "nav_appendix",
  "/reports": "nav_reports",
  "/weather": "nav_weather",
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
        className="absolute bottom-[3px] top-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.04)] transition-transform duration-[420ms] ease-[cubic-bezier(.34,1.42,.64,1)] dark:bg-gray-950 dark:shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const MoonIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)

export function TopNav() {
  const pathname = usePathname()
  const { lang, setLang, t } = useLang()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const me = useAccessIdentity()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")
  const cur = (theme === "system" ? resolvedTheme : theme) === "dark" ? "dark" : "light"

  // 로그인 화면은 nav 없이 독립 렌더
  if (pathname?.startsWith("/login")) return null

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <style>{"@keyframes axfade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}"}</style>
      <div className="mx-auto flex items-center gap-6 px-6 py-3.5 sm:px-8 lg:px-10" style={{ animation: "axfade .5s ease both" }}>
        <Link href="/news" className="flex shrink-0 items-start leading-none">
          <span className="text-[21.5px] font-extrabold tracking-tight leading-none">
            <span className="text-gray-900 dark:text-gray-50">axlgeph</span>
            <span className="text-indigo-600 dark:text-indigo-400">.report</span>
          </span>
          <span className="ml-1 mt-0.5 text-[11px] font-semibold italic leading-none text-gray-400 dark:text-gray-500">beta</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5 overflow-x-auto">
          {siteConfig.nav.map((item) => (
            <React.Fragment key={item.href}>
              {item.divider && <span aria-hidden className="mx-1.5 h-4 w-px shrink-0 rounded bg-gray-200 dark:bg-gray-700" />}
              <Link
                href={item.href}
                className={
                  (isActive(item.href)
                    ? "text-indigo-700 dark:text-indigo-400 "
                    : "text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400 ") +
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-out active:scale-95"
                }
              >
                {t(NAV_KEY[item.href] ?? "nav_overview")}
                {item.soon && <span className="rounded-full border border-amber-200 bg-amber-50 px-1 py-px text-[8.5px] font-bold uppercase leading-none tracking-wide text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">{T("예정", "Soon")}</span>}
              </Link>
            </React.Fragment>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {/* 소개(웰컴) 다시 보기 — 전구 아이콘. 클릭 시 웰컴 모달 재노출 */}
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new Event("ax:open-welcome")) }}
            aria-label="소개 다시 보기"
            title="소개 다시 보기"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:-translate-y-px hover:bg-indigo-50 hover:text-indigo-600 active:scale-90 dark:text-gray-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" /></svg>
          </button>
          {/* 개선 요청·문의 창구 — 클릭 시 피드백 모달(ax:open-feedback) */}
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new Event("ax:open-feedback")) }}
            aria-label={T("개선 요청·문의", "Improvement request")}
            title={T("개선 요청·문의", "Improvement request / feedback")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:-translate-y-px hover:bg-indigo-50 hover:text-indigo-600 active:scale-90 dark:text-gray-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </button>
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
          {/* 로그인 사용자(Cloudflare Access 신원) — 이니셜 칩 + 호버 시 이메일·로그아웃 */}
          {me && (
            <div className="group relative">
              <button type="button" aria-label="내 계정" className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold uppercase text-white shadow-sm ring-1 ring-indigo-200/60 transition-transform hover:-translate-y-px active:scale-95 dark:ring-indigo-500/30">
                {me.name.slice(0, 1)}
              </button>
              <div className="invisible absolute right-0 top-[calc(100%+6px)] z-50 w-[212px] rounded-xl border border-gray-200 bg-white p-1.5 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2 px-2 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[12px] font-bold uppercase text-white">{me.name.slice(0, 1)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-bold text-gray-900 dark:text-gray-50">{me.name}</span>
                    <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">{me.email}</span>
                  </span>
                </div>
                <Link href="/me" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
                  내 설정
                </Link>
                <button type="button" onClick={() => { signOut(); if (typeof window !== "undefined") window.location.replace("/login/") }} className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-gray-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
