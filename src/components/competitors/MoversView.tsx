"use client"

// 일일 가격 변동 — 오늘/1·2·3일전 날짜열·전일비(₱↔% 토글)·할인율·최근7일 스파크라인·★DOE등급.
import React from "react"
import { T } from "@/lib/i18n"
import { fmtStamp, type PriceRow, type EnergyRow } from "@/lib/supabase"
import { canonCode, PM_CATS, pmFormsFor, pmFormHit, pmFormOf } from "@/lib/classify"
import { peso, md, pmShopLabel, pmStarCls, DOE_CODE, doeNorm, PmDrop, PmMultiDrop, ListSearch, catLabel } from "@/components/competitors/shared"

// 전일비 — 주변과 통일한 ▼▲ 컬러 텍스트. 4초마다 %↔₱ 토글(badgeSwap 애니메이션).
function MvDelta({ php, pct }: { php: number | null; pct: number | null }) {
  const [mode, setMode] = React.useState(0)
  React.useEffect(() => { const id = setInterval(() => setMode((m) => (m === 0 ? 1 : 0)), 4000); return () => clearInterval(id) }, [])
  if (pct == null || pct === 0 || php == null) return <span className="text-gray-300 dark:text-gray-600">—</span>
  const dn = pct < 0
  return (
    <span className={"inline-flex items-center gap-1 tabular-nums " + (dn ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      <span className="text-[10px]">{dn ? "▼" : "▲"}</span>
      <span key={mode} className="text-[11.5px] font-semibold" style={{ animation: "badgeSwap .42s cubic-bezier(.22,1,.36,1) both" }}>
        {mode === 1 ? "₱" + Math.round(Math.abs(php)).toLocaleString("en-US") : Math.abs(pct).toFixed(1) + "%"}
      </span>
    </span>
  )
}
/* 최근 7일 변동 — 실판매가 시계열 스파크라인(그리기 애니메이션) + 7일 변동률 */
function MvSpark({ series }: { series: number[] | null }) {
  const pts = (series || []).filter((n) => Number.isFinite(n) && n > 0)
  if (pts.length < 2) return <span className="text-gray-300 dark:text-gray-600">—</span>
  const first = pts[0], last = pts[pts.length - 1]
  const chg = first > 0 ? ((last - first) / first) * 100 : 0
  const up = chg > 0.05, dn = chg < -0.05
  const stroke = dn ? "#059669" : up ? "#e11d48" : "#94a3b8"
  const W = 56, H = 20, min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1
  const step = W / (pts.length - 1)
  const xy = pts.map((p, i) => [i * step, H - 3 - ((p - min) / rng) * (H - 6)] as [number, number])
  const d = xy.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ")
  const [ex, ey] = xy[xy.length - 1]
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible">
        <path d={d} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" style={{ strokeDasharray: 220, strokeDashoffset: 220, animation: "sparkDraw 1.1s cubic-bezier(.22,1,.36,1) forwards" }} />
        <circle cx={ex} cy={ey} r="1.8" fill={stroke} style={{ animation: "fadeUp .5s ease .9s both" }} />
      </svg>
      <span className={"text-[10px] font-semibold tabular-nums " + (dn ? "text-emerald-600 dark:text-emerald-400" : up ? "text-rose-600 dark:text-rose-400" : "text-gray-400 dark:text-gray-500")}>{chg > 0 ? "+" : ""}{chg.toFixed(1)}%</span>
    </span>
  )
}

export function MoversView({ rows, elabels, stamp }: { rows: PriceRow[] | null; elabels: EnergyRow[] | null; stamp: string | null }) {
  const R = rows ?? []
  const cats = React.useMemo(() => { const av = PM_CATS.filter((c) => R.some((r) => r.category === c)); return av.length ? av : PM_CATS }, [R])
  const [cat, setCat] = React.useState("냉장고")
  const [brands, setBrands] = React.useState<string[]>([])
  const [form, setForm] = React.useState("전체")
  const [shop, setShop] = React.useState("전체")
  const [sortDir, setSortDir] = React.useState<"down" | "up">("down")
  const [q, setQ] = React.useState("")
  const effCat = cats.includes(cat) ? cat : cats[0]
  const brandsL = React.useMemo(() => {
    const m = new Map<string, number>()
    R.filter((r) => r.category === effCat).forEach((r) => { if (r.brand) m.set(r.brand, (m.get(r.brand) || 0) + 1) })
    return ["전체", "LG", ...Array.from(m.entries()).filter(([b]) => b !== "LG").sort((a, b) => b[1] - a[1]).map((x) => x[0])]
  }, [R, effCat])
  const forms = pmFormsFor(effCat)
  const effForm = form === "전체" || forms.includes(form) ? form : "전체"
  const shopsL = React.useMemo(() => {
    const m = new Map<string, number>()
    R.filter((r) => r.category === effCat).forEach((r) => { if (r.retailer) m.set(r.retailer, (m.get(r.retailer) || 0) + 1) })
    return ["전체", ...Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map((x) => x[0])]
  }, [R, effCat])
  const effShop = shopsL.includes(shop) ? shop : "전체"
  // DOE ★ 인덱스 — 채널별 가격 비교와 동일 매칭
  const starIdx = React.useMemo(() => {
    const m: Record<string, { codeN: string; star: number | null }[]> = {}
    ;(elabels || []).forEach((e) => { if (e.model && e.model.length >= 5) (m[e.category] = m[e.category] || []).push({ codeN: doeNorm(e.category, e.model), star: e.star }) })
    return m
  }, [elabels])
  const starFor = (c: string, model: string) => { const code = DOE_CODE[c]; const idx = code ? starIdx[code] : null; if (!idx) return null; const mm = doeNorm(code, model); const cc = doeNorm(code, canonCode(model, null)); for (const e of idx) { if (e.codeN.length < 5) continue; if (mm.includes(e.codeN)) return e.star; if (cc.length >= 8 && e.codeN.includes(cc)) return e.star } return null }
  const kw = q.trim().toLowerCase()
  const list = React.useMemo(() => {
    const f = R.filter((r) => r.p0 != null && r.category === effCat && (brands.length === 0 || brands.includes(r.brand)) && (effShop === "전체" || r.retailer === effShop) && pmFormHit(effCat, r.model + " " + (r.capacity || ""), effForm, r.brand) && (!kw || (r.brand + " " + r.model + " " + (r.code || "")).toLowerCase().includes(kw)))
    // 전일비 있는 것 우선, 방향순
    return f.slice().sort((a, b) => {
      const da = a.deltaPct, db = b.deltaPct
      const va = da == null ? (sortDir === "down" ? 1 : -1) * 9e9 : da
      const vb = db == null ? (sortDir === "down" ? 1 : -1) * 9e9 : db
      return sortDir === "down" ? va - vb : vb - va
    })
  }, [R, effCat, brands, effForm, effShop, kw, sortDir]) // eslint-disable-line
  const moved = list.filter((r) => r.deltaPct != null && r.deltaPct !== 0).length
  // 컬럼 헤더용 대표 날짜(최빈값) — 유통별 수집일이 달라도 다수 기준으로 표기
  const repDates = React.useMemo(() => {
    const mode = (key: "d0" | "d1" | "d2" | "d3") => { const m = new Map<string, number>(); list.forEach((r) => { const v = r[key]; if (v) m.set(v, (m.get(v) || 0) + 1) }); let best: string | null = null, bc = 0; m.forEach((c, d) => { if (c > bc) { bc = c; best = d } }); return best }
    return { d0: mode("d0"), d1: mode("d1"), d2: mode("d2"), d3: mode("d3") }
  }, [list])
  const dHead = (d: string | null) => <span className="tabular-nums text-gray-700 dark:text-gray-200">{d ? md(d) : "—"}</span>

  // 현재 필터된 일일 변동 목록 CSV — 화면 표와 동일 컬럼(브랜드·분류·모델·SRP·오늘가·할인·전일비·최근일자·7일변동·유통). 엑셀 호환(BOM+CRLF)
  const dlRaw = () => {
    if (!list.length) return
    const head = ["Brand", "Category", "ModelCode", "ModelName", "SRP", "Price", "Discount%", "DoD%", "DoD_PHP", "P-1", "P-2", "P-3", "Change7d%", "Retailer", "URL"]
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const ch7 = (s: number[] | null) => { const p = (s || []).filter((n) => Number.isFinite(n) && n > 0); if (p.length < 2) return ""; const f = p[0], l = p[p.length - 1]; return f > 0 ? (((l - f) / f) * 100).toFixed(1) : "" }
    const body = list.map((r) => [r.brand, r.category, r.code && r.code.length >= 4 && r.code !== "N/A" ? r.code : canonCode(r.model, r.code), r.model, r.srp, r.p0, r.discountPct != null ? r.discountPct.toFixed(0) : "", r.deltaPct != null ? r.deltaPct.toFixed(1) : "", r.deltaPhp != null ? Math.round(r.deltaPhp) : "", r.p1, r.p2, r.p3, ch7(r.prices7), r.retailer, r.url].map(esc).join(","))
    const csv = "﻿" + [head.join(","), ...body].join("\r\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    a.download = "daily_moves_" + effCat + (repDates.d0 ? "_" + repDates.d0 : "") + ".csv"
    a.click(); URL.revokeObjectURL(a.href)
  }

  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("불러오는 중", "Loading")}</div>

  return (
    <div className="flex flex-col gap-2.5">
      {/* 필터바 — 채널별 가격 비교와 동일: 브랜드·제품·유형·용량 + 인하/인상 알약토글 + 검색 + 최종갱신 */}
      <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <div className="w-fit"><PmMultiDrop label={T("브랜드", "Brand")} sel={brands} options={brandsL.filter((b) => b !== "전체").map((b) => ({ k: b, t: b }))} onToggle={(k) => setBrands((v) => v.includes(k) ? v.filter((x) => x !== k) : [...v, k])} onClear={() => setBrands([])} /></div>
        <div className="w-fit"><PmDrop label={T("제품", "Div")} sel={effCat} options={cats.map((c) => ({ k: c, t: catLabel(c) }))} onSelect={(k) => { setCat(k); setBrands([]); setForm("전체"); setShop("전체") }} /></div>
        <div className="w-fit"><PmDrop label={T("유형", "Type")} sel={effForm} options={[{ k: "전체", t: T("전체", "All") }, ...forms.map((t) => ({ k: t, t }))]} onSelect={setForm} /></div>
        <div className="w-fit"><PmDrop label={T("거래선", "Retailer")} sel={effShop} options={shopsL.map((s) => ({ k: s, t: s === "전체" ? T("전체", "All") : pmShopLabel(s) }))} onSelect={setShop} /></div>
        {/* 인하순/인상순 — 슬라이딩 알약 토글(초록↔빨강) */}
        <div className="relative flex items-center rounded-full bg-gray-200/80 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] dark:bg-gray-800/80 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] text-[11px] font-semibold">
          <span aria-hidden className={"absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.04)] transition-all duration-[420ms] ease-[cubic-bezier(.34,1.42,.64,1)] " + (sortDir === "down" ? "translate-x-0 bg-emerald-100 dark:bg-emerald-500/25" : "translate-x-full bg-rose-100 dark:bg-rose-500/25")} />
          <button type="button" onClick={() => setSortDir("down")} className={"relative z-10 rounded-full px-3 py-0.5 transition-colors duration-200 active:scale-95 " + (sortDir === "down" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400")}>{T("인하순", "Cuts")}</button>
          <button type="button" onClick={() => setSortDir("up")} className={"relative z-10 rounded-full px-3 py-0.5 transition-colors duration-200 active:scale-95 " + (sortDir === "up" ? "text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400")}>{T("인상순", "Hikes")}</button>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <ListSearch value={q} onChange={setQ} placeholder={T("모델·브랜드 검색", "Search model or brand")} />
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Latest")} {stamp ? fmtStamp(stamp) : repDates.d0 ? md(repDates.d0) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
          {/* 원본 CSV — 현재 필터된 일일 변동 목록(맨오른쪽 · C 옆) */}
          <button type="button" onClick={dlRaw} disabled={!list.length} aria-label={T("일일 가격 변동(CSV) 다운로드", "Download daily price moves (CSV)")} title={T("일일 가격 변동(CSV) 다운로드", "Download daily price moves (CSV)")} className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 transition-all duration-200 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300 active:scale-95 disabled:opacity-40">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
          </button>
        </div>
      </div>
      {/* 매트릭스 — 브랜드·분류·모델·★·SRP·오늘·할인율·전일비·날짜3열·최근7일변동·유통 */}
      <div className="max-h-[1040px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[1360px] table-fixed border-collapse text-[12px]">
          <colgroup>
            <col style={{ width: 138 }} /><col style={{ width: 58 }} /><col style={{ width: 70 }} /><col style={{ width: 128 }} /><col style={{ width: 32 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 82 }} /><col style={{ width: 92 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 140 }} /><col style={{ width: 120 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr className="text-[10.5px] font-semibold text-gray-600 dark:text-gray-300">
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("브랜드", "Brand")}</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("제품", "Div")}</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("유형", "Type")}</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("모델", "Model")}</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-1 py-2 text-center" title={T("New DOE 에너지등급", "New DOE energy rating")}>★</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">SRP</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d0)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{T("할인율", "Discount")}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{T("전일비", "DoD")}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d1)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d2)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d3)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("최근 7일 변동", "7-day trend")}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("유통", "Retailer")}</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={14} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">{T("조건에 맞는 모델 없음", "No models match the filters")}</td></tr>
            ) : list.slice(0, 400).map((r, ri) => {
              const star = starFor(r.category, r.model)
              return (
              <tr key={r.retailer + r.model + ri} style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(ri, 20) * 0.018 + "s" }} className="border-b border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5">
                <td className={"truncate whitespace-nowrap px-2 py-1.5 text-center text-[11.5px] font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")} title={r.brand}>{r.brand}</td>
                <td className="px-2 py-1.5 text-center text-[10.5px] text-gray-500 dark:text-gray-400">{catLabel(r.category)}</td>
                <td className="truncate px-2 py-1.5 text-center text-[10.5px] text-gray-500 dark:text-gray-400" title={pmFormOf(r.category, (r.model||"")+" "+(r.capacity||""), r.brand) || undefined}>{pmFormOf(r.category, (r.model||"")+" "+(r.capacity||""), r.brand) || "—"}</td>
                <td className="truncate px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200" title={r.model}>{r.code && r.code.length >= 4 && r.code !== "N/A" ? r.code : canonCode(r.model, r.code)}</td>
                <td className="px-1 py-1.5 text-center">{star != null ? <span className={"rounded px-1 text-[9px] font-bold " + pmStarCls(star)}>★{star}</span> : <span className="text-gray-300 dark:text-gray-600">·</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.srp != null ? peso(r.srp) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-gray-900 hover:underline dark:text-gray-50">{peso(r.p0)}</a> : <span className="font-bold text-gray-900 dark:text-gray-50">{peso(r.p0)}</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums">{r.discountPct != null && r.discountPct > 0 ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.discountPct.toFixed(0)}%</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-center"><MvDelta php={r.deltaPhp} pct={r.deltaPct} /></td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.p1 != null ? peso(r.p1) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.p2 != null ? peso(r.p2) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.p3 != null ? peso(r.p3) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-center"><MvSpark series={r.prices7} /></td>
                <td className="whitespace-nowrap border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-center text-[11px] text-gray-500 dark:text-gray-400">{pmShopLabel(r.retailer)}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("★=New DOE 에너지등급 · SRP=권장소비자가 · 할인율=SRP 대비 · 오늘·날짜열=최근 4일(3일전까지) 실판매가 · 전일비=(오늘−어제)/어제, ↓ 인하(초록)·↑ 인상(빨강)·₱↔% 토글 · 최근 7일 변동=7일 추이 스파크라인 · ", "★ = New DOE energy rating · SRP = suggested retail price · Discount = vs. SRP · Today/date columns = actual selling price over the last 4 days (through 3 days ago) · DoD = (today − yesterday) / yesterday, ↓ cut (green) · ↑ hike (red) · ₱↔% toggle · 7-day trend = 7-day trend sparkline · ")}{effCat}{T(" · 오늘 변동 ", " · ")}{moved}{T("건 · 상위 400건", " changes today · Top 400")}</p>
    </div>
  )
}

