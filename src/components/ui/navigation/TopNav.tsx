"use client"

import { siteConfig } from "@/app/siteConfig"
import { exchangeRates, macroAll } from "@/lib/supabase"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"

function fmt(n: number, d = 1) {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

type TickItem = { name: string; value: string; chg: string; up: boolean; note: string; asof: string }
type Freq = "D" | "M" | "Q" | "Y"
type Kind = "fx" | "inflation" | "confidence" | "growth" | "import" | "ppi" | "unemp"
type Cfg = { name: string; ind: string; freq: Freq; kind: Kind; vk: "fx" | "pct" | "idx" | "usd" }

const CFG: Cfg[] = [
  { name: "페소 환율 (USD/PHP)", ind: "FX", freq: "D", kind: "fx", vk: "fx" },
  { name: "소비자물가 상승률", ind: "INF_all_items", freq: "M", kind: "inflation", vk: "pct" },
  { name: "전기요금 물가 상승률", ind: "INF_electricity", freq: "M", kind: "inflation", vk: "pct" },
  { name: "실질 GDP 성장률", ind: "GDP_growth", freq: "Y", kind: "growth", vk: "pct" },
  { name: "실업률", ind: "unemployment_rate", freq: "Y", kind: "unemp", vk: "pct" },
  { name: "소비자신뢰지수", ind: "consumer_confidence_index", freq: "Q", kind: "confidence", vk: "idx" },
  { name: "내구재 구매심리지수", ind: "durables_buying_intention", freq: "Q", kind: "confidence", vk: "idx" },
  { name: "생활가전 물가 상승률", ind: "INF_household_appliances", freq: "M", kind: "inflation", vk: "pct" },
  { name: "에어컨 물가 상승률", ind: "INF_aircon", freq: "M", kind: "inflation", vk: "pct" },
  { name: "가전 수입액", ind: "imports_home_appliances", freq: "Y", kind: "import", vk: "usd" },
  { name: "기업경기실사지수", ind: "business_confidence_index", freq: "M", kind: "confidence", vk: "idx" },
  { name: "가전 생산자물가 상승률", ind: "PPI_domestic_appliances", freq: "M", kind: "ppi", vk: "pct" },
  { name: "건설업 성장률", ind: "construction_gva_growth", freq: "Q", kind: "growth", vk: "pct" },
]
const arw = (up: boolean) => (up ? "▲" : "▼")
const WORD: Record<Kind, [string, string]> = {
  fx: ["상승", "하락"], inflation: ["가속", "둔화"], confidence: ["개선", "악화"],
  growth: ["개선", "둔화"], import: ["증가", "감소"], ppi: ["상승", "하락"], unemp: ["상승", "하락"],
}
const OUT: Record<string, string> = {
  "fx|true": "수입 원가 부담 지속", "fx|false": "수입 원가 완화 기대",
  "inflation|true": "물가 압력 지속 전망", "inflation|false": "하향 안정 흐름",
  "confidence|true": "수요 회복 조짐", "confidence|false": "수요 위축 우려",
  "growth|true": "성장 모멘텀 유지", "growth|false": "성장 둔화 우려",
  "import|true": "가전 수요 확대", "import|false": "가전 수요 위축",
  "ppi|true": "제조원가 상승 압력", "ppi|false": "제조원가 완화",
  "unemp|true": "고용 여건 악화", "unemp|false": "고용 여건 개선",
}
function streakOf(vals: number[]): { len: number; up: boolean } {
  if (vals.length < 2) return { len: 0, up: true }
  const d: number[] = []
  for (let i = 1; i < vals.length; i++) d.push(vals[i] - vals[i - 1])
  const last = d[d.length - 1]
  const sign = last > 0 ? 1 : last < 0 ? -1 : 0
  if (sign === 0) return { len: 0, up: true }
  let len = 0
  for (let i = d.length - 1; i >= 0; i--) {
    const sg = d[i] > 0 ? 1 : d[i] < 0 ? -1 : 0
    if (sg === sign) len++
    else break
  }
  return { len, up: sign > 0 }
}
function unitOf(f: Freq) { return f === "D" ? "일" : f === "M" ? "개월" : f === "Q" ? "분기" : "년" }
function prefixOf(f: Freq) { return f === "D" ? "전일比" : f === "M" ? "전월比" : f === "Q" ? "전분기比" : "전년比" }
function asofOf(f: Freq, d: string) {
  const t = f === "D" ? Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10))
    : f === "M" ? Number(d.slice(5, 7)) + "월"
    : f === "Q" ? Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1 + "분기"
    : d.slice(0, 4) + "년"
  return t + " 기준"
}

function Ticker() {
  const [items, setItems] = React.useState<TickItem[]>([])
  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const series = await Promise.all(
          CFG.map((c) => (c.ind === "FX" ? exchangeRates(20) : macroAll(c.ind))),
        )
        if (!alive) return
        const list: TickItem[] = []
        CFG.forEach((c, idx) => {
          const s = series[idx]
          if (!s || s.length === 0) return
          const last = s[s.length - 1]
          const prev = s.length > 1 ? s[s.length - 2] : last
          const rawUp = last.value >= prev.value
          const value =
            c.vk === "fx" ? "₱" + fmt(last.value, 2)
            : c.vk === "pct" ? fmt(last.value, 1) + "%"
            : c.vk === "usd" ? "$" + Math.round(last.value / 1e6) + "M"
            : String(fmt(last.value, 1))
          let chgNum: number, csuf: string
          if (c.kind === "import") { chgNum = prev.value ? Math.abs(((last.value - prev.value) / prev.value) * 100) : 0; csuf = "%" }
          else if (c.vk === "idx") { chgNum = Math.abs(last.value - prev.value); csuf = "p" }
          else if (c.vk === "fx") { chgNum = Math.abs(last.value - prev.value); csuf = "" }
          else { chgNum = Math.abs(last.value - prev.value); csuf = "%p" }
          const chg = prefixOf(c.freq) + " " + fmt(chgNum, c.vk === "fx" ? 2 : 1) + csuf + arw(rawUp)
          const st = streakOf(s.map((x) => x.value))
          const word = st.up ? WORD[c.kind][0] : WORD[c.kind][1]
          const out = OUT[c.kind + "|" + st.up]
          const note = st.len >= 2 ? `${st.len}${unitOf(c.freq)} 연속 ${word}, ${out}`
            : st.len === 1 ? `${word} 전환, ${out}` : out
          list.push({ name: c.name, value, chg, up: rawUp, note, asof: asofOf(c.freq, last.date) })
        })
        setItems(list)
      } catch {
        /* 티커 데이터 실패 시 조용히 숨김 */
      }
    })()
    return () => { alive = false }
  }, [])

  if (!items.length) return null
  const loop = [...items, ...items]
  return (
    <div className="axm-wrap overflow-hidden border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" style={{ animation: "axfade .5s ease both", animationDelay: ".16s" }}>
      <style>{"@keyframes axmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.axm-track{animation:axmarquee 78s linear infinite}.axm-wrap:hover .axm-track{animation-play-state:paused}"}</style>
      <div className="axm-track flex w-max gap-2.5 py-2">
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
      <style>{"@keyframes axfade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}"}</style>
      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8" style={{ animation: "axfade .5s ease both" }}>
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
      <nav className="mx-auto flex max-w-screen-2xl items-center gap-1 overflow-x-auto border-t border-gray-100 px-4 py-1.5 dark:border-gray-800/60 sm:px-6 lg:px-8" style={{ animation: "axfade .5s ease both", animationDelay: ".08s" }}>
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
