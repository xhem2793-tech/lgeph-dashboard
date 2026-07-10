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
const CAT_ORDER = ["냉장고", "TV", "에어컨", "세탁기", "에어케어", "정수기"]
const COLLAPSED = 262

function peso(n: number | null) {
  return n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US")
}
function pesoSigned(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  return sign + "₱" + Math.round(Math.abs(n)).toLocaleString("en-US")
}
function fmtDate(s: string) {
  if (!s) return ""
  const p = s.split("-")
  return p.length === 3 ? `${+p[1]}월${+p[2]}일` : s
}
function shopName(r: string) {
  if (!r) return "—"
  if (/sm/i.test(r)) return "SM"
  return r
}
function specType(model: string, category: string) {
  const m = (model || "").toLowerCase()
  if (category === "TV") {
    if (m.includes("oled")) return "OLED"
    if (m.includes("rgb-mini") || m.includes("rgb mini")) return "RGB-Mini"
    if (m.includes("mini led") || m.includes("mini-led") || m.includes("miniled")) return "Mini-LED"
    if (m.includes("qled")) return "QLED"
    if (m.includes("uhd") || m.includes("4k")) return "UHD"
    if (m.includes("qd")) return "QD-LED"
    return "LED"
  }
  if (category === "냉장고") {
    if (m.includes("side by side") || m.includes("side-by-side") || /\bsxs\b/.test(m)) return "SxS"
    if (m.includes("french") || m.includes("multi door") || m.includes("multi-door") || m.includes("4 door") || m.includes("4-door")) return "FDR"
    if (m.includes("bottom")) return "BMF"
    if (m.includes("two door") || m.includes("2 door") || m.includes("double door") || m.includes("2-door") || m.includes("top mount")) return "2도어"
    if (m.includes("single") || m.includes("one door")) return "1도어"
    if (m.includes("inverter")) return "인버터"
    return "냉장고"
  }
  if (category === "세탁기") {
    if (m.includes("front load") || m.includes("front-load") || /\bf\/?l\b/.test(m)) return "F/L"
    if (m.includes("top load") || m.includes("top-load") || /\bt\/?l\b/.test(m)) return "T/L"
    if (m.includes("twin")) return "Twin"
    if (m.includes("dryer")) return "건조기"
    return "세탁기"
  }
  if (category === "에어컨") {
    if (m.includes("window") || m.includes("wdw")) return "창문형"
    if (m.includes("split")) return "스플릿"
    if (m.includes("floor")) return "스탠드"
    if (m.includes("inverter") || /\binv\b/.test(m)) return "인버터"
    return "에어컨"
  }
  return category
}
function modelCode(s: string, brand: string) {
  let m = (s || "").replace(/&#821[12];/g, "–").replace(/&amp;/g, "&").replace(/&#\d+;/g, "")
  m = m.replace(/^\s*20\d{2}\s*Model\s*[–-]\s*/i, "")
  m = m.replace(new RegExp("^\\s*" + brand + "\\s*", "i"), "")
  m = m.replace(/\s+/g, " ").trim()
  const toks = m.split(" ")
  const code: string[] = []
  for (const t of toks) {
    if (/^[A-Z0-9][A-Z0-9-]*$/.test(t) && /[0-9-]/.test(t)) code.push(t)
    else if (code.length === 0 && /^[A-Z]{1,3}$/.test(t)) code.push(t)
    else break
  }
  return code.length ? code.join(" ") : (m.length > 16 ? m.slice(0, 14) + "…" : m)
}

function BrandLogo({ brand }: { brand: string }) {
  const logo = BRAND_LOGO[brand]
  return (
    <span className="flex h-6 w-14 items-center justify-center transition-all duration-300 ease-out hover:-translate-y-0.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={brand}
          className="max-h-[18px] max-w-[50px] object-contain"
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = "none"
            const sib = el.nextElementSibling as HTMLElement | null
            if (sib) sib.style.display = "inline-block"
          }}
        />
      ) : null}
      <span
        className="rounded px-1 py-0.5 text-[8px] font-bold text-white"
        style={{ display: logo ? "none" : "inline-block", background: BRAND_COLOR[brand] || "#6b7280" }}
      >
        {brand}
      </span>
    </span>
  )
}

export default function CompetitorMovers() {
  const [rows, setRows] = React.useState<Awaited<ReturnType<typeof competitorMovers>>>([])
  const [cat, setCat] = React.useState("전체")
  const [exp, setExp] = React.useState(false)
  const [fullH, setFullH] = React.useState<number>()
  const listRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    let alive = true
    competitorMovers(40)
      .then((r) => { if (alive) setRows(r) })
      .catch((e) => console.error(e))
    return () => { alive = false }
  }, [])

  if (rows.length === 0) return null
  const asOf = rows[0]?.asOf

  const cats = ["전체", ...Array.from(new Set(rows.map((r) => r.category))).sort(
    (a, b) => (CAT_ORDER.indexOf(a) < 0 ? 99 : CAT_ORDER.indexOf(a)) - (CAT_ORDER.indexOf(b) < 0 ? 99 : CAT_ORDER.indexOf(b)),
  )]
  const view = cat === "전체" ? rows : rows.filter((r) => r.category === cat)
  const canExp = view.length > 8

  const pick = (c: string) => { setCat(c); setExp(false); setFullH(undefined) }

  const th = "px-2 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-gray-400"
  const td = "px-2 py-0.5 align-middle"

  return (
    <div className="mt-6 sm:mt-8" style={{ animation: "fadeUp .95s cubic-bezier(.22,1,.36,1) both", animationDelay: "0.6s" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="cursor-default text-lg font-bold tracking-tight text-gray-900 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600">일일 가격 변동</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            매일 갱신
          </span>
        </div>
        <span className={HOVM + " text-[10px] text-gray-400"}>{fmtDate(asOf)} 오전 9시 기준 · 6개 브랜드</span>
      </div>

      <div className="flex h-full flex-col rounded-xl bg-[#f9fafb] p-3 transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white hover:shadow-[0_12px_34px_-12px_rgba(99,102,241,0.4)]">
        <div className="flex flex-wrap gap-1">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              className={"shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-medium transition-all duration-200 active:scale-95 " + (cat === c ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:-translate-y-0.5 hover:bg-gray-200 hover:text-indigo-600")}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative mt-2">
          <div
            ref={listRef}
            className="overflow-hidden transition-[max-height] duration-500 ease-in-out"
            style={{ maxHeight: !canExp || exp ? (exp ? (fullH ?? 3000) : 3000) : COLLAPSED }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={th + " text-center"}>브랜드</th>
                    <th className={th}>유통</th>
                    <th className={th}>제품</th>
                    <th className={th}>유형</th>
                    <th className={th}>모델</th>
                    <th className={th + " text-right"}>SRP</th>
                    <th className={th + " text-right"}>프로모션(오늘)</th>
                    <th className={th + " text-right"}>프로모션(어제)</th>
                    <th className={th + " text-right"}>전일비</th>
                    <th className={th + " text-right"}>전일비(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((r, i) => {
                    const dn = r.pct < 0
                    const cc = dn ? "text-emerald-600" : "text-rose-600"
                    return (
                      <tr key={i} className="border-b border-gray-100 transition-colors duration-200 hover:bg-indigo-50/40">
                        <td className={td + " text-center"}><BrandLogo brand={r.brand} /></td>
                        <td className={td}><span className={HOVM + " whitespace-nowrap text-[10px] text-gray-500"}>{shopName(r.retailer)}</span></td>
                        <td className={td}><span className={HOVM + " whitespace-nowrap text-[10px] font-medium text-gray-600"}>{r.category}</span></td>
                        <td className={td}>
                          <span className={HOVM + " whitespace-nowrap rounded bg-gray-100 px-1 py-0.5 text-[9px] font-semibold text-gray-500"}>{specType(r.model, r.category)}</span>
                        </td>
                        <td className={td}>
                          <span className={HOV + " block max-w-[130px] truncate font-medium text-gray-700"} title={r.model}>{modelCode(r.model, r.brand)}</span>
                        </td>
                        <td className={td + " text-right"}><span className={HOVM + " tabular-nums text-gray-400"}>{peso(r.srp)}</span></td>
                        <td className={td + " text-right"}><span className={HOV + " font-bold tabular-nums text-gray-900"}>{peso(r.promo)}</span></td>
                        <td className={td + " text-right"}><span className={HOVM + " tabular-nums text-gray-400"}>{peso(r.yPromo)}</span></td>
                        <td className={td + " text-right"}><span className={HOV + " whitespace-nowrap font-semibold tabular-nums " + cc}>{pesoSigned(r.delta)}</span></td>
                        <td className={td + " text-right"}><span className={HOV + " whitespace-nowrap font-extrabold tabular-nums " + cc}>{dn ? "▼" : "▲"} {Math.abs(r.pct).toFixed(1)}%</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {canExp && !exp ? (
            <button
              type="button"
              onClick={() => { const el = listRef.current; setFullH(el ? el.scrollHeight : 3000); setExp(true) }}
              className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-[#f9fafb] via-[#f9fafb]/85 to-transparent pb-1 backdrop-blur-[1.5px]"
            >
              <span className="rounded-full border border-gray-200 bg-white px-3.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600">펼치기 +{view.length - 8}</span>
            </button>
          ) : null}
        </div>

        {canExp && exp ? (
          <button
            type="button"
            onClick={() => { const el = listRef.current; if (el) setFullH(el.scrollHeight); requestAnimationFrame(() => setExp(false)) }}
            className="mt-2 flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white py-1.5 text-[11px] font-medium text-gray-500 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600"
          >
            접기
          </button>
        ) : null}

        <p className="mt-auto pt-1.5 text-[9.5px] leading-relaxed text-gray-400">
          <span className={HOVM}>경쟁사 온라인 매장 스크래핑 · 변동률 높은순 · <span className="text-rose-600">▲인상</span> / <span className="text-emerald-600">▼인하</span> · 유통: Anson&#39;s · Abenson · SM</span>
        </p>
      </div>
    </div>
  )
}
