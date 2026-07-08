"use client"

import { siteConfig } from "@/app/siteConfig"
import { exchangeRates, macroSeries, oilSeries } from "@/lib/supabase"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"

function fmt(n: number, d = 1) {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

type TickItem = { label: string; value: string; delta: string; up: boolean }

function Ticker() {
  const [items, setItems] = React.useState<TickItem[]>([])
  React.useEffect(() => {
    let alive = true
    const last = (a: number[]) => (a.length ? a[a.length - 1] : 0)
    const prev = (a: number[]) => (a.length > 1 ? a[a.length - 2] : last(a))
    ;(async () => {
      try {
        const [fx, oil, inf, cci, bci, imp] = await Promise.all([
          exchangeRates(2),
          oilSeries(2),
          macroSeries("INF_all_items", 2),
          macroSeries("consumer_confidence_index", 2),
          macroSeries("business_confidence_index", 2),
          macroSeries("imports_home_appliances", 2),
        ])
        if (!alive) return
        const fxV = fx.map((r) => r.value)
        const mk = (
          label: string,
          value: string,
          cur: number,
          pv: number,
          suffix = "",
        ): TickItem => ({
          label,
          value,
          delta: (cur >= pv ? "+" : "") + fmt(cur - pv, 2) + suffix,
          up: cur >= pv,
        })
        setItems([
          mk("USD/PHP", "₱" + fmt(last(fxV), 2), last(fxV), prev(fxV)),
          mk("디젤유가", "₱" + fmt(last(oil), 2), last(oil), prev(oil)),
          mk("물가상승률", fmt(last(inf)) + "%", last(inf), prev(inf), "%p"),
          mk("소비자신뢰", fmt(last(cci)) + "", last(cci), prev(cci), "p"),
          mk("기업경기", fmt(last(bci)) + "", last(bci), prev(bci)),
          mk(
            "가전수입",
            fmt(last(imp) / 1e6) + "M",
            last(imp) / 1e6,
            prev(imp) / 1e6,
            "M",
          ),
        ])
      } catch {
        /* 티커 데이터 실패 시 조용히 숨김 */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!items.length) return null
  return (
    <div className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-8 overflow-x-auto px-4 py-2.5 text-xs sm:px-6 lg:px-8">
        {items.map((it) => (
          <div key={it.label} className="flex shrink-0 items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400">{it.label}</span>
            <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
              {it.value}
            </span>
            <span
              className={
                it.up
                  ? "tabular-nums text-emerald-600 dark:text-emerald-500"
                  : "tabular-nums text-red-600 dark:text-red-500"
              }
            >
              {it.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TopNav() {
  const pathname = usePathname()
  const [today, setToday] = React.useState("")
  React.useEffect(() => {
    setToday(
      new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(new Date()),
    )
  }, [])
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/overview" className="flex shrink-0 items-baseline gap-2">
          <span className="hidden text-[11px] font-semibold text-gray-400 sm:inline">필리핀법인</span>
          <span className="text-2xl font-extrabold leading-none tracking-tight">
            <span className="text-indigo-600">AX</span>
            <span className="text-gray-900 dark:text-gray-50"> Dashboard</span>
          </span>
        </Link>
        <form onSubmit={(e) => e.preventDefault()} className="relative mx-auto hidden w-full max-w-xl md:block">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </span>
          <input
            type="text"
            placeholder="지표·뉴스·키워드 검색"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-12 text-sm text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button type="submit" aria-label="검색" className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </button>
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden text-xs tabular-nums text-gray-500 dark:text-gray-400 sm:block">{today}</span>
          <span className="hidden rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 md:block">LGE-PH 경영기획</span>
        </div>
      </div>
      <nav className="mx-auto flex max-w-screen-2xl items-center gap-1 overflow-x-auto border-t border-gray-100 px-4 py-1.5 dark:border-gray-800/60 sm:px-6 lg:px-8">
        {siteConfig.nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              (isActive(item.href)
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 "
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50 ") +
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            }
          >
            {item.name}
          </Link>
        ))}
      </nav>
      <Ticker />
    </header>
  )
}
