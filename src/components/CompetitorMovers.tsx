"use client"

import * as React from "react"
import { competitorMovers } from "@/lib/supabase"

const BRAND_LOGO: Record<string, string> = {
  LG: "/logos/LG-Logo.webp",
  Samsung: "/logos/samsung-company-logo-south-korean-260nw-2394493913.webp",
  Sony: "/logos/sony-logo-png_seeklogo-129420.png",
  TCL: "/logos/tcl-logo-png_seeklogo-434831.png",
  Hisense: "/logos/Hisense-Logo.png",
  Midea: "/logos/midea-logo-png_seeklogo-92432.png",
  Panasonic: "/logos/Panasonic-Logo.wine.png",
  Carrier: "/logos/Logo_of_the_Carrier_Corporation.svg.webp",
}

const BRAND_COLOR: Record<string, string> = {
  LG: "#a50034", Samsung: "#1428a0", Sony: "#111827", TCL: "#e60012",
  Hisense: "#00843d", Midea: "#1a9bd7", Panasonic: "#0b1f8f", Carrier: "#00549f",
  Toshiba: "#e60012", Sharp: "#b3121f", Condura: "#0b5c9e", Fujidenzo: "#1a5fb4",
}

function pesoK(n: number) {
  return "₱" + (Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k"
}

function cleanModel(s: string, brand: string) {
  let m = (s || "").replace(/&#821[12];/g, "–").replace(/&amp;/g, "&").replace(/&#\d+;/g, "")
  m = m.replace(/^\s*20\d{2}\s*Model\s*[–-]\s*/i, "")
  m = m.replace(new RegExp("^\\s*" + brand + "\\s*", "i"), "")
  m = m.replace(/\s+/g, " ").trim()
  return m.length > 42 ? m.slice(0, 40) + "…" : m
}

export default function CompetitorMovers() {
  const [movers, setMovers] = React.useState<Awaited<ReturnType<typeof competitorMovers>>>([])

  React.useEffect(() => {
    let alive = true
    competitorMovers(6)
      .then((r) => { if (alive) setMovers(r) })
      .catch((e) => console.error(e))
    return () => { alive = false }
  }, [])

  if (movers.length === 0) return null
  const asOf = movers[0]?.asOf

  return (
    <div
      className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:mt-8 sm:p-5"
      style={{ animation: "moversUp .95s ease both" }}
    >
      <style>{"@keyframes moversUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}"}</style>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="cursor-default text-lg font-bold tracking-tight text-gray-900 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600">
            오늘의 가격 무버
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            매일 갱신
          </span>
        </div>
        <span className="text-[10px] tabular-nums text-gray-400">{asOf} · 어제 대비</span>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-gray-100">
        {movers.map((m, i) => {
          const dn = m.pct < 0
          const logo = BRAND_LOGO[m.brand]
          return (
            <div
              key={i}
              className="group flex items-center gap-3 py-2.5 transition-all duration-300 ease-out hover:-translate-y-0.5"
            >
              <span className="flex h-5 w-12 shrink-0 items-center justify-center">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt={m.brand}
                    className="max-h-5 max-w-[46px] object-contain"
                    onError={(e) => {
                      const el = e.currentTarget
                      el.style.display = "none"
                      const sib = el.nextElementSibling as HTMLElement | null
                      if (sib) sib.style.display = "inline-block"
                    }}
                  />
                ) : null}
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                  style={{ display: logo ? "none" : "inline-block", background: BRAND_COLOR[m.brand] || "#6b7280" }}
                >
                  {m.brand}
                </span>
              </span>

              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] font-medium text-gray-700">
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">
                  {m.category}
                </span>
                <span className="truncate">{cleanModel(m.model, m.brand)}</span>
              </span>

              <span className="hidden shrink-0 text-[10.5px] tabular-nums text-gray-400 sm:inline">
                {pesoK(m.from)}
                {"→"}
                <b className="text-gray-700">{pesoK(m.to)}</b>
              </span>

              <span
                className={
                  "w-[64px] shrink-0 text-right text-[12.5px] font-extrabold tabular-nums " +
                  (dn ? "text-emerald-600" : "text-rose-600")
                }
              >
                {dn ? "▼" : "▲"} {Math.abs(m.pct)}%
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-gray-400">
        경쟁사 온라인 매장 스크래핑 · 어제 종가 대비 변동률 상위 ·{" "}
        <span className="text-emerald-600">{"▼"}인하</span> /{" "}
        <span className="text-rose-600">{"▲"}인상</span>
      </p>
    </div>
  )
}
