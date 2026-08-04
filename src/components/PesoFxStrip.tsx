"use client"

import * as React from "react"
import { fxStrip } from "@/lib/supabase"
import { T } from "@/lib/i18n"

const ORDER = ["USDPHP", "CNYPHP", "KRWPHP", "USDKRW"]

function fmt(pair: string, v: number | null) {
  if (v == null) return "-"
  if (pair === "USDPHP" || pair === "CNYPHP") return "₱" + v.toFixed(pair === "CNYPHP" ? 2 : 1)
  if (pair === "USDKRW") return "₩" + Math.round(v).toLocaleString("en-US")
  return v.toFixed(1)
}

export default function PesoFxStrip() {
  const [data, setData] = React.useState<any>(null)
  React.useEffect(() => {
    fxStrip().then(setData).catch(() => setData({ asOf: null, pairs: {}, peers: [] }))
  }, [])

  const pairs = data?.pairs || {}
  const peers: any[] = data?.peers || []
  const peerMax = Math.max(1, ...peers.map((p) => Math.abs(p.yoy || 0)))
  const asOf = data?.asOf ? data.asOf.slice(5).replace("-", "/") : ""

  const cell = "bg-[#f9fafb] px-3 py-2 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white dark:hover:bg-gray-900 hover:shadow-[0_6px_20px_-8px_rgba(99,102,241,0.45)]"

  return (
    <div style={{ animation: "fadeUp .8s ease both" }}>
      <p className="mb-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        {T("페소 약세 · 수입원가 환경", "Peso weakness · import cost environment")} <span className="text-gray-400 dark:text-gray-500">· {asOf} {T("기준 · 전년비 절하율", "as of · YoY depreciation")}</span>
      </p>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 sm:grid-cols-3 lg:grid-cols-[repeat(4,1fr)_1.5fr]">
        {ORDER.map((k) => {
          const p = pairs[k]
          if (!p) return <div key={k} className={cell} />
          const down = p.biz === "절하" || p.biz === "원약세"
          const col = down ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
          return (
            <div key={k} className={cell}>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">{p.label}</div>
              <div className="my-0.5 text-[14.5px] font-semibold tabular-nums text-gray-900 dark:text-gray-50">{fmt(k, p.rate)}</div>
              <div className={"text-[10px] font-medium tabular-nums " + col}>
                {Math.abs(p.yoy).toFixed(1)}%{down ? "↓" : "↑"} {p.biz}
              </div>
            </div>
          )
        })}
        <div className={cell}>
          <div className="mb-1 text-[10px] text-gray-500 dark:text-gray-400">
            {T("역내 절하 비교", "Regional depreciation")} <span className="text-gray-400 dark:text-gray-500">{T("전년비 vs USD", "YoY vs USD")}</span>
          </div>
          {peers.map((p, i) => {
            const hl = /페소|PHP/.test(p.label)
            const w = Math.round((Math.abs(p.yoy || 0) / peerMax) * 100)
            const dep = (p.yoy || 0) > 0
            return (
              <div key={i} className="my-[3px] flex items-center gap-1.5">
                <span className={"w-9 shrink-0 text-[9px] " + (hl ? "font-medium text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400")}>{p.label}</span>
                <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="block h-full rounded-full" style={{ width: w + "%", background: hl ? "#e11d48" : "#b4b2a9" }} />
                </span>
                <span className={"w-8 shrink-0 text-right text-[9px] tabular-nums " + (hl ? "text-rose-600 dark:text-rose-400" : "text-gray-400 dark:text-gray-500")}>
                  {dep ? "" : "+"}{(-(p.yoy || 0)).toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
