"use client"

// 일일 가격 변동 — 오늘/1·2·3일전 날짜열·전일비(₱↔% 토글)·할인율·최근7일 스파크라인·★DOE등급.
import React from "react"
import { fmtStamp, type PriceRow, type EnergyRow } from "@/lib/supabase"
import { canonCode, PM_CATS, pmFormsFor, pmFormHit } from "@/lib/classify"
import { peso, md, pmShopLabel, pmStarCls, DOE_CODE, doeNorm, PmDrop } from "@/components/competitors/shared"

function MvCountUp({ value, decimals = 1, suffix = "", fmt }: { value: number; decimals?: number; suffix?: string; fmt?: (n: number) => string }) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const render = (n: number) => (fmt ? fmt(n) : n.toFixed(decimals) + suffix)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const to = Number.isFinite(value) ? value : 0
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min((t - t0) / 900, 1)
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
function MvDelta({ php, pct }: { php: number | null; pct: number | null }) {
  const [mode, setMode] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setMode((m) => (m === 0 ? 1 : 0)), 4000)
    return () => clearInterval(id)
  }, [])
  if (pct == null || pct === 0 || php == null) return <span className="text-gray-300 dark:text-gray-600">—</span>
  const dn = pct < 0
  return (
    <span className={"inline-flex w-[74px] items-center rounded px-1 py-0.5 text-[12.5px] font-semibold tabular-nums transition-all duration-300 ease-out hover:-translate-y-0.5 " + (dn ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400")}>
      <span className="w-[10px] shrink-0 text-left">{dn ? "↓" : "↑"}</span>
      <span key={mode} className="flex-1 text-right" style={{ animation: "badgeSwap .45s cubic-bezier(.22,1,.36,1) both" }}>
        {mode === 1
          ? <MvCountUp value={Math.abs(php)} fmt={(n) => "₱" + Math.round(n).toLocaleString("en-US")} />
          : <MvCountUp value={Math.abs(pct)} decimals={1} suffix="%" />}
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
      <span className={"text-[12px] font-semibold tabular-nums " + (dn ? "text-emerald-600 dark:text-emerald-400" : up ? "text-rose-600 dark:text-rose-400" : "text-gray-400 dark:text-gray-500")}>{chg > 0 ? "+" : ""}{chg.toFixed(1)}%</span>
    </span>
  )
}

export function MoversView({ rows, elabels, stamp }: { rows: PriceRow[] | null; elabels: EnergyRow[] | null; stamp: string | null }) {
  const R = rows ?? []
  const cats = React.useMemo(() => { const av = PM_CATS.filter((c) => R.some((r) => r.category === c)); return av.length ? av : PM_CATS }, [R])
  const [cat, setCat] = React.useState("냉장고")
  const [brand, setBrand] = React.useState("전체")
  const [form, setForm] = React.useState("전체")
  const [shop, setShop] = React.useState("전체")
  const [sortDir, setSortDir] = React.useState<"down" | "up">("down")
  const [q, setQ] = React.useState("")
  const [focused, setFocused] = React.useState(false)
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
    const f = R.filter((r) => r.p0 != null && r.category === effCat && (brand === "전체" || r.brand === brand) && (effShop === "전체" || r.retailer === effShop) && pmFormHit(effCat, r.model + " " + (r.capacity || ""), effForm, r.brand) && (!kw || (r.brand + " " + r.model + " " + (r.code || "")).toLowerCase().includes(kw)))
    // 전일비 있는 것 우선, 방향순
    return f.slice().sort((a, b) => {
      const da = a.deltaPct, db = b.deltaPct
      const va = da == null ? (sortDir === "down" ? 1 : -1) * 9e9 : da
      const vb = db == null ? (sortDir === "down" ? 1 : -1) * 9e9 : db
      return sortDir === "down" ? va - vb : vb - va
    })
  }, [R, effCat, brand, effForm, effShop, kw, sortDir]) // eslint-disable-line
  const moved = list.filter((r) => r.deltaPct != null && r.deltaPct !== 0).length
  // 컬럼 헤더용 대표 날짜(최빈값) — 유통별 수집일이 달라도 다수 기준으로 표기
  const repDates = React.useMemo(() => {
    const mode = (key: "d0" | "d1" | "d2" | "d3") => { const m = new Map<string, number>(); list.forEach((r) => { const v = r[key]; if (v) m.set(v, (m.get(v) || 0) + 1) }); let best: string | null = null, bc = 0; m.forEach((c, d) => { if (c > bc) { bc = c; best = d } }); return best }
    return { d0: mode("d0"), d1: mode("d1"), d2: mode("d2"), d3: mode("d3") }
  }, [list])
  const dHead = (d: string | null) => <span className="tabular-nums text-gray-700 dark:text-gray-200">{d ? md(d) : "—"}</span>

  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[15px] text-gray-400 dark:text-gray-500">불러오는 중</div>

  return (
    <div className="flex flex-col gap-2.5">
      {/* 필터바 — 채널별 가격 비교와 동일: 브랜드·제품·유형·용량 + 인하/인상 알약토글 + 검색 + 최종갱신 */}
      <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <div className="w-fit"><PmDrop label="브랜드" sel={brand} options={brandsL.map((b) => ({ k: b, t: b }))} onSelect={setBrand} /></div>
        <div className="w-fit"><PmDrop label="제품" sel={effCat} options={cats.map((c) => ({ k: c, t: c }))} onSelect={(k) => { setCat(k); setBrand("전체"); setForm("전체"); setShop("전체") }} /></div>
        <div className="w-fit"><PmDrop label="유형" sel={effForm} options={[{ k: "전체", t: "전체" }, ...forms.map((t) => ({ k: t, t }))]} onSelect={setForm} /></div>
        <div className="w-fit"><PmDrop label="거래선" sel={effShop} options={shopsL.map((s) => ({ k: s, t: s === "전체" ? "전체" : pmShopLabel(s) }))} onSelect={setShop} /></div>
        {/* 인하순/인상순 — 슬라이딩 알약 토글(초록↔빨강) */}
        <div className="relative flex items-center rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-0.5 text-[13px] font-semibold shadow-sm">
          <span aria-hidden className={"absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full transition-all duration-[340ms] ease-[cubic-bezier(.22,1,.36,1)] " + (sortDir === "down" ? "translate-x-0 bg-emerald-50 dark:bg-emerald-500/15" : "translate-x-full bg-rose-50 dark:bg-rose-500/15")} />
          <button type="button" onClick={() => setSortDir("down")} className={"relative z-10 rounded-full px-3 py-0.5 transition-colors duration-200 active:scale-95 " + (sortDir === "down" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400")}>인하순</button>
          <button type="button" onClick={() => setSortDir("up")} className={"relative z-10 rounded-full px-3 py-0.5 transition-colors duration-200 active:scale-95 " + (sortDir === "up" ? "text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400")}>인상순</button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className={"group relative transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-[300px]" : "w-[200px]")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="모델·브랜드 검색"
              className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[14px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] text-gray-400 dark:text-gray-500 sm:flex">최종 {stamp ? fmtStamp(stamp) : repDates.d0 ? md(repDates.d0) : "—"}<span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">CONFIRMED</span></span>
        </div>
      </div>
      {/* 매트릭스 — 브랜드·분류·모델·★·SRP·오늘·할인율·전일비·날짜3열·최근7일변동·유통 */}
      <div className="max-h-[1040px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[1290px] table-fixed border-collapse text-[14px]">
          <colgroup>
            <col style={{ width: 138 }} /><col style={{ width: 58 }} /><col style={{ width: 128 }} /><col style={{ width: 32 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 82 }} /><col style={{ width: 92 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 140 }} /><col style={{ width: 120 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-300">
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">브랜드</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">분류</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">모델</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-1 py-2 text-center" title="New DOE 에너지등급">★</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">SRP</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d0)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">할인율</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">전일비</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d1)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d2)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{dHead(repDates.d3)}</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">최근 7일 변동</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">유통</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={13} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">조건에 맞는 모델 없음</td></tr>
            ) : list.slice(0, 400).map((r, ri) => {
              const star = starFor(r.category, r.model)
              return (
              <tr key={r.retailer + r.model + ri} style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(ri, 20) * 0.018 + "s" }} className="border-b border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5">
                <td className={"truncate whitespace-nowrap px-2 py-1.5 text-center text-[13.5px] font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")} title={r.brand}>{r.brand}</td>
                <td className="px-2 py-1.5 text-center text-[12.5px] text-gray-500 dark:text-gray-400">{r.category}</td>
                <td className="truncate px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200" title={r.model}>{r.code && r.code.length >= 4 && r.code !== "N/A" ? r.code : canonCode(r.model, r.code)}</td>
                <td className="px-1 py-1.5 text-center">{star != null ? <span className={"rounded px-1 text-[11px] font-bold " + pmStarCls(star)}>★{star}</span> : <span className="text-gray-300 dark:text-gray-600">·</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.srp != null ? peso(r.srp) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-gray-900 hover:underline dark:text-gray-50">{peso(r.p0)}</a> : <span className="font-bold text-gray-900 dark:text-gray-50">{peso(r.p0)}</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums">{r.discountPct != null && r.discountPct > 0 ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.discountPct.toFixed(0)}%</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-center"><MvDelta php={r.deltaPhp} pct={r.deltaPct} /></td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.p1 != null ? peso(r.p1) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.p2 != null ? peso(r.p2) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.p3 != null ? peso(r.p3) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-center"><MvSpark series={r.prices7} /></td>
                <td className="whitespace-nowrap border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-center text-[13px] text-gray-500 dark:text-gray-400">{pmShopLabel(r.retailer)}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-gray-400 dark:text-gray-500">★=New DOE 에너지등급 · SRP=권장소비자가 · 할인율=SRP 대비 · 오늘·날짜열=최근 4일(3일전까지) 실판매가 · 전일비=(오늘−어제)/어제, ↓ 인하(초록)·↑ 인상(빨강)·₱↔% 토글 · 최근 7일 변동=7일 추이 스파크라인 · {effCat} · 오늘 변동 {moved}건 · 상위 400건</p>
    </div>
  )
}

