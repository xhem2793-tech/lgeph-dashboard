"use client"

import { siteConfig } from "@/app/siteConfig"
import { exchangeRates, macroAll, rangeRows } from "@/lib/supabase"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"

function fmt(n: number, d = 1) {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

type TickItem = { name: string; value: string; chg: string; up: boolean; note: string; asof: string }

function lastOf<T>(a: T[]): T { return a[a.length - 1] }
function prevOf<T>(a: T[]): T { return a[a.length - 2] }
function isoDaysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const mLabel = (d: string) => Number(d.slice(5, 7)) + "월"
const qLabel = (d: string) => Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1 + "분기"
const dLabel = (d: string) => Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10))
const arw = (up: boolean) => (up ? "▲" : "▼")

function Ticker() {
  const [items, setItems] = React.useState<TickItem[]>([])
  React.useEffect(() => {
    let alive = true
    const iso = isoDaysAgo(0)
    ;(async () => {
      try {
        const [fx, oil, inf, cci, bci, imp] = await Promise.all([
          exchangeRates(2),
          rangeRows("oil_prices", "diesel", isoDaysAgo(30), iso),
          macroAll("INF_all_items"),
          macroAll("consumer_confidence_index"),
          macroAll("business_confidence_index"),
          macroAll("imports_home_appliances"),
        ])
        if (!alive) return
        const fxL = lastOf(fx), fxP = prevOf(fx)
        const oL = lastOf(oil), oP = prevOf(oil)
        const iL = lastOf(inf), iP = prevOf(inf)
        const cL = lastOf(cci), cP = prevOf(cci)
        const bL = lastOf(bci), bP = prevOf(bci)
        const mL = lastOf(imp), mP = prevOf(imp)
        const up = (a: number, b: number) => a >= b
        setItems([
          { name: "USD/PHP 환율", value: "₱" + fmt(fxL.value, 2), up: up(fxL.value, fxP.value),
            chg: "전일比 " + fmt(Math.abs(fxL.value - fxP.value), 2) + arw(up(fxL.value, fxP.value)),
            note: up(fxL.value, fxP.value) ? "페소 약세, 수입 원가 부담" : "페소 강세, 수입 원가 완화", asof: dLabel(fxL.date) + " 기준" },
          { name: "경유(디젤)", value: "₱" + fmt(oL.value, 1), up: up(oL.value, oP.value),
            chg: "전주比 " + fmt(Math.abs(oL.value - oP.value), 1) + arw(up(oL.value, oP.value)),
            note: up(oL.value, oP.value) ? "물류·배송비 부담" : "물류비 완화", asof: dLabel(oL.date) + " 기준" },
          { name: "소비자물가 CPI", value: fmt(iL.value, 1) + "%", up: up(iL.value, iP.value),
            chg: "전월比 " + fmt(Math.abs(iL.value - iP.value), 1) + "%p" + arw(up(iL.value, iP.value)),
            note: up(iL.value, iP.value) ? "물가 상방 압력" : "물가 둔화, 구매력 회복", asof: mLabel(iL.date) + " 기준" },
          { name: "소비자신뢰 CCI", value: String(fmt(cL.value, 1)), up: up(cL.value, cP.value),
            chg: "전분기比 " + fmt(Math.abs(cL.value - cP.value), 1) + "p" + arw(up(cL.value, cP.value)),
            note: up(cL.value, cP.value) ? "소비심리 개선" : "소비심리 위축", asof: qLabel(cL.date) + " 기준" },
          { name: "기업경기 BCI", value: String(fmt(bL.value, 1)), up: up(bL.value, bP.value),
            chg: "전월比 " + fmt(Math.abs(bL.value - bP.value), 1) + arw(up(bL.value, bP.value)),
            note: up(bL.value, bP.value) ? "기업경기 개선" : "기업경기 위축", asof: mLabel(bL.date) + " 기준" },
          { name: "가전 수입", value: "$" + Math.round(mL.value / 1e6) + "M", up: up(mL.value, mP.value),
            chg: "전년比 " + fmt(Math.abs(((mL.value - mP.value) / mP.value) * 100), 1) + "%" + arw(up(mL.value, mP.value)),
            note: up(mL.value, mP.value) ? "가전 수입 확대" : "가전 수입 둔화", asof: mL.date.slice(0, 4) + "년 기준" },
        ])
      } catch {
        /* 티커 데이터 실패 시 조용히 숨김 */
      }
    })()
    return () => { alive = false }
  }, [])

  if (!items.length) return null
  const loop = [...items, ...items]
  return (
    <div className="group overflow-hidden border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <style>{"@keyframes axmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}"}</style>
      <div className="flex w-max gap-2.5 py-2 group-hover:[animation-play-state:paused]" style={{ animation: "axmarquee 55s linear infinite" }}>
        {loop.map((it, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1 text-xs shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow dark:border-gray-700 dark:bg-gray-950"
          >
            <span className="font-semibold text-gray-800 dark:text-gray-100">{it.name}</span>
            <span className="tabular-nums font-medium text-gray-900 dark:text-gray-50">{it.value}</span>
            <span className={it.up ? "tabular-nums text-emerald-600 dark:text-emerald-500" : "tabular-nums text-red-600 dark:text-red-500"}>{it.chg}</span>
            <span className="text-gray-400">· {it.note}</span>
            <span className="text-gray-300 dark:text-gray-600">· {it.asof}</span>
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
          <button type="submit" aria-label="검색" className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-white transition-all duration-300 ease-out hover:scale-110 hover:bg-indigo-700 active:scale-95">
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
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
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
