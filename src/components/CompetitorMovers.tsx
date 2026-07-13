"use client"

import * as React from "react"
import { competitorMovers, freshness, fmtStamp } from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

const BRAND_LOGO: Record<string, string> = {
  LG: "/logos/lg.png",
  Samsung: "/logos/samsung-company-logo-south-korean-260nw-2394493913.webp",
  Sony: "/logos/sony.png",
  TCL: "/logos/tcl.png",
  Hisense: "/logos/Hisense-Logo.png",
  Midea: "/logos/midea.png",
  Panasonic: "/logos/panasonic.png",
  Carrier: "/logos/carrier.png",
}

const BRAND_COLOR: Record<string, string> = {
  LG: "#a50034", Samsung: "#1428a0", Sony: "#111827", TCL: "#e60012",
  Hisense: "#00843d", Midea: "#1a9bd7", Panasonic: "#0b1f8f", Carrier: "#00549f",
  Toshiba: "#e60012", Sharp: "#b3121f",
}

const HOV = "inline-block transition-colors duration-200"
const HOVM = "inline-block transition-colors duration-200"
const CAT_ORDER = ["냉장고", "세탁기", "TV", "에어컨"]
const WD = ["일", "월", "화", "수", "목", "금", "토"]

function peso(n: number | null) {
  return n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US")
}
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
function fmtDate(s: string, en = false) {
  if (!s) return ""
  const p = s.split("-")
  if (p.length !== 3) return s
  return en ? `${MON[+p[1] - 1]} ${+p[2]}` : `${+p[1]}월${+p[2]}일`
}
function fmtHdr(s: string, en = false) {
  if (!s) return ""
  const p = s.split("-").map(Number)
  if (p.length !== 3) return s
  if (en) return `${p[1]}/${p[2]}`
  const wd = WD[new Date(p[0], p[1] - 1, p[2]).getDay()]
  return `${p[1]}/${p[2]}일(${wd})`
}
function shopName(r: string) {
  if (!r) return "—"
  if (/sm/i.test(r)) return "SM"
  return r
}
function modelCode(s: string, brand: string) {
  const raw = (s || "")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
  const bad = /^(KG|CU|FT|INCH|HP|TON|LED|OLED|QNED|SMART|TV|BUNDLE|MODEL|LG|SAMSUNG|SHARP|HISENSE|TCL|PANASONIC)$/i
  const cands = raw
    .split(/[\s(),/]+/)
    .map((x) => x.replace(/[^A-Za-z0-9.-]/g, ""))
    .filter((u) => {
      if (u.length < 4 || u.length > 22) return false
      if (!/[A-Za-z]/.test(u) || !/\d/.test(u)) return false
      if (/^\d/.test(u)) return false
      if (bad.test(u)) return false
      return (u.match(/\d/g) || []).length >= 2
    })
  if (cands.length) return cands[cands.length - 1]
  return raw.replace(new RegExp("^\\d{4}\\s*Model\\s*-\\s*", "i"), "").replace(new RegExp("^" + brand + "\\s*", "i"), "").trim()
}

function CountUp({ value, decimals = 1, suffix = "", fmt }: { value: number; decimals?: number; suffix?: string; fmt?: (n: number) => string }) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const render = (n: number) => (fmt ? fmt(n) : n.toFixed(decimals) + suffix)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const to = Number.isFinite(value) ? value : 0
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min((t - t0) / 1000, 1)
      const e = 1 - Math.pow(1 - k, 3)
      node.textContent = render(to * e)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <span ref={ref}>{render(Number.isFinite(value) ? value : 0)}</span>
}

function MoverDelta({ delta, pct }: { delta: number; pct: number }) {
  const dn = pct < 0
  const [mode, setMode] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setMode((m) => (m === 0 ? 1 : 0)), 4000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className={"inline-flex w-[66px] items-center rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums transition-all duration-300 ease-out hover:-translate-y-0.5 " + (dn ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
      <span className="w-[9px] shrink-0 text-left">{dn ? "↓" : "↑"}</span>
      <span key={mode} className="flex-1 text-right" style={{ animation: "badgeSwap .45s cubic-bezier(.22,1,.36,1) both" }}>
        {mode === 1
          ? <CountUp value={Math.abs(delta)} fmt={(n) => "₱" + Math.round(n).toLocaleString("en-US")} />
          : <CountUp value={Math.abs(pct)} decimals={1} suffix="%" />}
      </span>
    </span>
  )
}

function BrandLogo({ brand }: { brand: string }) {
  const logo = BRAND_LOGO[brand]
  const big = brand === "LG"
  return (
    <span className="inline-flex h-7 w-[54px] items-center justify-center align-middle transition-all duration-300 ease-out hover:-translate-y-0.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={brand}
          className={(big ? "max-h-[20px] max-w-[48px]" : "max-h-[15px] max-w-[40px]") + " object-contain"}
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = "none"
            const sib = el.nextElementSibling as HTMLElement | null
            if (sib) sib.style.display = "inline-block"
          }}
        />
      ) : null}
      <span
        className="rounded px-1 py-0.5 text-[10px] font-bold text-white"
        style={{ display: logo ? "none" : "inline-block", background: BRAND_COLOR[brand] || "#6b7280" }}
      >
        {brand}
      </span>
    </span>
  )
}

export default function CompetitorMovers() {
  const { t, lang } = useLang()
  const [stamp, setStamp] = React.useState<string | null>(null)
  React.useEffect(() => {
    freshness()
      .then((f) => setStamp(f.prices ?? null))
      .catch(() => {})
  }, [])
  const [rows, setRows] = React.useState<Awaited<ReturnType<typeof competitorMovers>>>([])
  const [cat, setCat] = React.useState("전체")
  const [sortDir, setSortDir] = React.useState<"up" | "down">("down")
  React.useEffect(() => {
    let alive = true
    competitorMovers(500)
      .then((r) => { if (alive) setRows(r) })
      .catch((e) => console.error(e))
    return () => { alive = false }
  }, [])

  if (rows.length === 0) return null
  const asOf = rows[0]?.asOf

  // 탭은 항상 고정 — 데이터가 없는 날에도 카테고리는 사라지지 않는다(자리가 곧 관측 대상)
  const CAT_LABEL: Record<string, string> = { "전체": t("price_all"), "냉장고": t("cat_ref"), "세탁기": t("cat_wash"), "TV": t("cat_tv"), "에어컨": t("cat_ac") }
  const cats = ["전체", ...CAT_ORDER]
  const view = cat === "전체" ? rows : rows.filter((r) => r.category === cat)
  const cardRows = (sortDir === "up" ? view.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct) : view.filter((r) => r.pct < 0).sort((a, b) => a.pct - b.pct)).slice(0, 5)

  const pick = (c: string) => { setCat(c) }

  const th = "px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400"
  const td = "h-[21px] p-0 align-middle"
  // 셀 내용은 26px 박스 안에서만 산다 — 로고·배지 때문에 행이 커지지 않도록 고정
  const cell = "flex h-[21px] items-center justify-center overflow-hidden px-0.5"

  return (
    <section className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-300 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both", animationDelay: "0.6s" }}>
      <style>{"@keyframes calIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes badgeSwap{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}"}</style>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0.5">
        <div className="flex items-center gap-2">
          <a href="/competitors" className="group flex items-baseline gap-1">
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">{t("price_title")}</h2>
            <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
          </a>
          <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 transition-all duration-300 ease-out hover:text-emerald-700">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {t("price_daily")}
          </span>
        </div>
        <span className={HOVM + " flex items-center gap-1.5 text-[10px] text-gray-400"}>
          {t("news_updated")} {stamp ? fmtStamp(stamp, lang === "en") : fmtDate(asOf, lang === "en")}
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700">CONFIRMED</span>
        </span>
      </div>

      <div className="flex h-full flex-col rounded-xl bg-[#f9fafb] p-2.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pick(c)}
                className={"shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium transition-all duration-200 active:scale-95 " + (cat === c ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:-translate-y-0.5 hover:bg-gray-200 hover:text-indigo-600")}
              >
                {CAT_LABEL[c] ?? c}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setSortDir("down")}
              className={"shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 " + (sortDir === "down" ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-white text-gray-500 hover:border-emerald-200 hover:text-emerald-600")}
            >
              {t("price_down")}
            </button>
            <button
              type="button"
              onClick={() => setSortDir("up")}
              className={"shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 " + (sortDir === "up" ? "border-rose-300 bg-rose-50 text-rose-600" : "border-gray-200 bg-white text-gray-500 hover:border-rose-200 hover:text-rose-600")}
            >
              {t("price_up")}
            </button>
          </div>
        </div>

        <div className="mt-1 rounded-lg border border-indigo-100/70 bg-white/70 px-2 py-1.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white">
          <div>
            <div
              className="overflow-hidden"
            >
              <div className="w-full max-w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-[11px]">
                  {/* 비율 폭 — 카드가 좁아져도 표가 테두리를 뚫지 않는다(가로 스크롤 금지) */}
                  <colgroup>
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className={th}>{t("th_brand")}</th>
                      <th className={th}>{t("th_category")}</th>
                      <th className={th}>{t("th_model")}</th>
                      <th className={th}>{t("th_srp")}</th>
                      <th className={th}>{fmtHdr(asOf, lang === "en")}</th>
                      <th className={th}>{t("th_delta")}</th>
                      <th className={th}>{t("th_retail")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardRows.length === 0 ? (
                      <tr className="border-b border-gray-100">
                        <td className={td} colSpan={7}><div className={cell + " text-[11px] text-gray-400"}>{t("price_none")}</div></td>
                      </tr>
                    ) : null}
                    {cardRows.map((r, i) => (
                      <tr key={`${cat}-${sortDir}-${i}`} style={{ animation: "calIn .5s cubic-bezier(.16,1,.3,1) backwards", animationDelay: i * 0.1 + "s" }} className="border-b border-gray-100 transition-colors duration-200 hover:bg-indigo-50/40">
                        <td className={td}><div className={cell}><BrandLogo brand={r.brand} /></div></td>
                        <td className={td}>
                          <div className={cell}>
                            <span className={HOVM + " whitespace-nowrap rounded bg-gray-100 px-1 text-[10px] font-semibold leading-[16px] text-gray-500"}>{CAT_LABEL[r.category] ?? r.category}</span>
                          </div>
                        </td>
                        <td className={td}>
                          <div className={cell}>
                            <span className={HOV + " truncate font-medium leading-none text-gray-700"} title={r.model}>{modelCode(r.model, r.brand)}</span>
                          </div>
                        </td>
                        <td className={td}><div className={cell}><span className={HOVM + " tabular-nums leading-none text-gray-400"}>{peso(r.srp)}</span></div></td>
                        <td className={td}><div className={cell}><span className={HOV + " font-bold tabular-nums leading-none text-gray-900"}>{peso(r.promo)}</span></div></td>
                        <td className={td}><div className={cell}><MoverDelta delta={r.delta} pct={r.pct} /></div></td>
                        <td className={td}><div className={cell}><span className={HOVM + " whitespace-nowrap text-[10px] leading-none text-gray-500"}>{shopName(r.retailer)}</span></div></td>
                      </tr>
                    ))}
                    {/* 행 수는 항상 5줄 — 표 높이가 날마다 출렁이면 눈이 위치를 다시 찾는다 */}
                    {Array.from({ length: Math.max(0, (cardRows.length === 0 ? 4 : 5) - cardRows.length) }).map((_, j) => (
                      <tr key={`pad-${cat}-${sortDir}-${j}`} aria-hidden className="border-b border-gray-100">
                        <td className={td} colSpan={7}><div className={cell}>&nbsp;</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-1 text-[10px] leading-snug text-gray-400">
          <span className={HOVM}>{lang === "en" ? "LG · Samsung · Panasonic · TCL · Midea · Hisense · Retail: Anson's · Abenson · SM" : "LG · Samsung · Panasonic · TCL · Midea · Hisense 기준 · 유통: Anson's · Abenson · SM"}</span>
        </p>
      </div>
    </section>
  )
}
