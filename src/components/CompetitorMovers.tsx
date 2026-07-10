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
  Toshiba: "#e60012", Sharp: "#b3121f",
}

const HOV = "inline-block cursor-default transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600"
const HOVM = "inline-block cursor-default transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-500"

function peso(n: number | null) {
  return n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US")
}
function pesoSigned(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  return sign + "₱" + Math.round(Math.abs(n)).toLocaleString("en-US")
}
function cleanModel(s: string, brand: string) {
  let m = (s || "").replace(/&#821[12];/g, "–").replace(/&amp;/g, "&").replace(/&#\d+;/g, "")
  m = m.replace(/^\s*20\d{2}\s*Model\s*[–-]\s*/i, "")
  m = m.replace(new RegExp("^\\s*" + brand + "\\s*", "i"), "")
  return m.replace(/\s+/g, " ").trim()
}

function BrandLogo({ brand }: { brand: string }) {
  const logo = BRAND_LOGO[brand]
  return (
    <span className="flex h-12 w-[104px] items-center justify-start transition-all duration-300 ease-out hover:-translate-y-0.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={brand}
          className="max-h-11 max-w-[100px] object-contain"
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = "none"
            const sib = el.nextElementSibling as HTMLElement | null
            if (sib) sib.style.display = "inline-block"
          }}
        />
      ) : null}
      <span
        className="rounded px-2 py-1 text-[13px] font-bold text-white"
        style={{ display: logo ? "none" : "inline-block", background: BRAND_COLOR[brand] || "#6b7280" }}
      >
        {brand}
      </span>
    </span>
  )
}

export default function CompetitorMovers() {
  const [rows, setRows] = React.useState<Awaited<ReturnType<typeof competitorMovers>>>([])
  const [exp, setExp] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    competitorMovers(10)
      .then((r) => { if (alive) setRows(r) })
      .catch((e) => console.error(e))
    return () => { alive = false }
  }, [])

  if (rows.length === 0) return null
  const asOf = rows[0]?.asOf
  const shown = exp ? rows : rows.slice(0, 5)

  const th = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400"
  const td = "px-3 py-3 align-middle"

  return (
    <div className="mt-6 h-full sm:mt-8" style={{ animation: "fadeUp .95s cubic-bezier(.22,1,.36,1) both", animationDelay: "0.6s" }}>
      <div className="flex h-full flex-col rounded-xl bg-[#f9fafb] p-3.5 transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white hover:shadow-[0_12px_34px_-12px_rgba(99,102,241,0.4)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={HOV + " text-lg font-bold tracking-tight text-gray-900"}>일일 가격 변동</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              매일 갱신
            </span>
          </div>
          <span className={HOVM + " text-[10px] tabular-nums text-gray-400"}>{asOf} · 어제 대비 · 6개 브랜드</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={th}>로고</th>
                <th className={th}>제품</th>
                <th className={th}>이름</th>
                <th className={th}>모델</th>
                <th className={th + " text-right"}>SRP</th>
                <th className={th + " text-right"}>프로모션</th>
                <th className={th + " text-right"}>변동가격</th>
                <th className={th + " text-right"}>변동률</th>
                <th className={th}>변동사유</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const dn = r.pct < 0
                const cc = dn ? "text-emerald-600" : "text-rose-600"
                const promoEnd = r.reason === "프로모션 종료"
                return (
                  <tr key={i} className="border-b border-gray-100 transition-colors duration-200 hover:bg-indigo-50/40">
                    <td className={td}><BrandLogo brand={r.brand} /></td>
                    <td className={td}>
                      <span className={HOVM + " whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500"}>{r.category}</span>
                    </td>
                    <td className={td}><span className={HOV + " font-semibold text-gray-800"}>{r.brand}</span></td>
                    <td className={td + " max-w-[240px]"}>
                      <span className={HOV + " block max-w-[240px] truncate text-gray-600"} title={cleanModel(r.model, r.brand)}>{cleanModel(r.model, r.brand)}</span>
                    </td>
                    <td className={td + " text-right"}><span className={HOVM + " tabular-nums text-gray-400"}>{peso(r.srp)}</span></td>
                    <td className={td + " text-right"}><span className={HOV + " font-bold tabular-nums text-gray-900"}>{peso(r.promo)}</span></td>
                    <td className={td + " text-right"}><span className={HOV + " font-semibold tabular-nums " + cc}>{pesoSigned(r.delta)}</span></td>
                    <td className={td + " text-right"}><span className={HOV + " font-extrabold tabular-nums " + cc}>{dn ? "▼" : "▲"} {Math.abs(r.pct)}%</span></td>
                    <td className={td}>
                      <span className={"inline-block cursor-default whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all duration-300 ease-out hover:-translate-y-0.5 " + (promoEnd ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:text-amber-800" : "bg-slate-100 text-slate-500 hover:text-indigo-600")}>{r.reason}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {rows.length > 5 ? (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setExp((v) => !v)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold text-gray-500 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white hover:text-indigo-600"
            >
              {exp ? "접기 ▲" : `펼치기 +${rows.length - 5} ▼`}
            </button>
          </div>
        ) : null}

        <p className="mt-auto pt-2 text-[10.5px] leading-relaxed text-gray-400">
          <span className={HOVM}>경쟁사 온라인 매장 스크래핑 · 변동률 높은순 · <span className="text-rose-600">▲인상</span> / <span className="text-emerald-600">▼인하</span> · 변동사유: SRP 복귀 시 <b className="text-amber-700">프로모션 종료</b>, 그 외 <b>파악필요</b></span>
        </p>
      </div>
    </div>
  )
}
