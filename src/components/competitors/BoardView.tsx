"use client"

// 채널별 가격 비교 — LG모델 × 거래선 매트릭스(날짜 네비·전일대비·스프레드·★DOE등급).
import React from "react"
import { fmtStamp, type DailyRow, type EnergyRow } from "@/lib/supabase"
import { canonCode, isAC, PM_CATS, pmFormOf, pmFormsFor, pmFormHit, pmSizeList, pmSizeHit, pmSizeBucket, acHpLabel } from "@/lib/classify"
import { peso, md, deltaCol, pmStarCls, DOE_CODE, doeNorm, PmDrop, PmMultiDrop, ListSearch, catLabel } from "@/components/competitors/shared"
import { T } from "@/lib/i18n"

// 분류 영문 약자 — REF/WM/TV/RAC/SAC/AUDIO. 냉동고→REF, 오디오(사운드바·스피커) 감지, 에어컨은 RAC/SAC 휴리스틱
const CAT_EN: Record<string, string> = { 냉장고: "REF", 세탁기: "W/M", TV: "TV" }
const CAT_KO: Record<string, string> = { REF: "냉장고", "W/M": "세탁기", TV: "TV", RAC: "RAC", SAC: "SAC", AUDIO: "오디오" }
const catAbbr = (cat: string, model: string) => {
  const m = model || ""
  if (/soundbar|사운드바|xboom|\bspeaker\b|스피커|home ?theat|홈시어터|\bAV\b/i.test(m)) return "AUDIO"
  if (/냉동고|\bfreezer\b/i.test(m)) return "REF"   // 냉동고 → 냉장고(REF)로 편입
  if (CAT_EN[cat]) return CAT_EN[cat]
  if (/에어컨|aircon|air ?con|\brac\b|\bsac\b/i.test(cat)) return /스탠드|시스템|천장|카세트|멀티|floor|ceiling|cassette|multi|system|inverter ?floor|\bAPN|\bAPU|\bAPW|\bAUW/i.test(m) ? "SAC" : "RAC"
  return cat
}
// 사이니지·상업용 디스플레이(TV로 오분류) — CSV에서 제외
const isSignage = (model: string) => /signage|사이니지|interactive|video ?wall|led ?wall|commercial ?(display|tv)|디지털 ?사이니지|\bTR3\b|one ?quick|createboard/i.test(model || "")

const BOARD_SHOPS: { k: string; label: string; live: boolean }[] = [
  { k: "Abenson", label: "Abenson", live: true },
  { k: "SM Appliance", label: "SM", live: true },
  { k: "Anson's", label: "Anson's", live: true },
  { k: "Robinsons Appliances", label: "Robinsons", live: true },
  { k: "Western Appliances", label: "Western", live: true },
  { k: "Emcor", label: "Emcor", live: true },
  { k: "Addessa", label: "Addessa", live: true },
]

type PivRow = { cat: string; brand: string; code: string; model: string; form: string | null; size: string | null; srp: number | null; cells: ({ price: number; delta: number | null; url: string | null } | null)[]; min: number | null; spread: number | null; star: number | null }
export function BoardView({ daily, stamp, elabels }: { daily: DailyRow[] | null; stamp: string | null; elabels: EnergyRow[] | null }) {
  const [cat, setCat] = React.useState("냉장고")
  const [brands, setBrands] = React.useState<string[]>([])
  const [form, setForm] = React.useState("전체")
  const [size, setSize] = React.useState("전체")
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "min", asc: false })
  const [selDate, setSelDate] = React.useState<string | null>(null)
  const D = daily ?? []
  const loading = daily === null
  // 이력 날짜(내림차순) — 달력·이전/다음 이동은 실제 데이터가 있는 날짜만 대상
  const dates = React.useMemo(() => Array.from(new Set(D.map((r) => r.d))).sort((a, b) => b.localeCompare(a)), [D])
  const curDate = selDate && dates.includes(selDate) ? selDate : dates[0] ?? null
  const curIdx = curDate ? dates.indexOf(curDate) : -1
  const prevDate = curIdx >= 0 && curIdx < dates.length - 1 ? dates[curIdx + 1] : null
  const isLatest = curIdx <= 0
  const isOldest = curIdx < 0 || curIdx >= dates.length - 1
  const goOlder = () => { if (!isOldest) setSelDate(dates[curIdx + 1]) }
  const goNewer = () => { if (!isLatest) setSelDate(dates[curIdx - 1]) }
  const pickDate = (v: string) => { if (!v) return; setSelDate(dates.find((d) => d <= v) ?? dates[dates.length - 1] ?? null) }
  const cats = React.useMemo(() => { const av = PM_CATS.filter((c) => D.some((r) => r.category === c)); return av.length ? av : PM_CATS }, [D])
  const brandsL = React.useMemo(() => {
    const m = new Map<string, number>()
    D.forEach((r) => { if (r.brand) m.set(r.brand, (m.get(r.brand) || 0) + 1) })
    const others = Array.from(m.entries()).filter(([b]) => b !== "LG").sort((a, b) => b[1] - a[1]).map((x) => x[0])
    return ["전체", "LG", ...others]
  }, [D])
  const forms = cat === "전체" ? [] : pmFormsFor(cat)
  const effForm = form === "전체" || forms.includes(form) ? form : "전체"
  const sizes = cat === "전체" ? [] : pmSizeList(cat)
  const effSize = size === "전체" || sizes.includes(size) ? size : "전체"
  // DOE ★ 인덱스(카테고리별)
  const starIdx = React.useMemo(() => {
    const m: Record<string, { codeN: string; star: number | null }[]> = {}
    ;(elabels || []).forEach((e) => { if (e.model && e.model.length >= 5) (m[e.category] = m[e.category] || []).push({ codeN: doeNorm(e.category, e.model), star: e.star }) })
    return m
  }, [elabels])
  const starFor = (c: string, model: string) => { const code = DOE_CODE[c]; const idx = code ? starIdx[code] : null; if (!idx) return null; const mm = doeNorm(code, model); const cc = doeNorm(code, canonCode(model, null)); for (const e of idx) { if (e.codeN.length < 5) continue; if (mm.includes(e.codeN)) return e.star; if (cc.length >= 8 && e.codeN.includes(cc)) return e.star } return null }

  const data = React.useMemo(() => {
    const kw = q.trim().toLowerCase()
    // 전일(직전 데이터일) 최저가 인덱스 — canonCode|거래선 → 가격(▼▲ 전일 대비)
    const prevIdx: Record<string, number> = {}
    D.filter((r) => r.d === prevDate && r.price != null).forEach((r) => { const cc = canonCode(r.model, r.code); if (!cc) return; const k = cc + "|" + r.retailer; prevIdx[k] = Math.min(prevIdx[k] ?? Infinity, r.price as number) })
    const f = D.filter((r) => r.d === curDate && r.price != null && (brands.length === 0 || brands.includes(r.brand)) && PM_CATS.includes(r.category) && (cat === "전체" || r.category === cat) && pmFormHit(cat, r.model + " " + (r.capacity || ""), effForm, r.brand) && pmSizeHit(cat, r.model, r.capacity, effSize) && canonCode(r.model, r.code).length >= 5 && (!kw || (r.code + " " + r.model + " " + canonCode(r.model, r.code)).toLowerCase().includes(kw)))
    const g: Record<string, DailyRow[]> = {}
    f.forEach((r) => { const cc = canonCode(r.model, r.code); (g[r.brand + "|" + cc] = g[r.brand + "|" + cc] || []).push(r) })
    const out: PivRow[] = Object.values(g).map((list) => {
      const r0 = list[0]
      const cc = canonCode(r0.model, r0.code)
      const cells = BOARD_SHOPS.map((s) => {
        const ms = list.filter((r) => r.retailer === s.k)
        if (!ms.length) return null
        const best = ms.reduce((a, b) => ((b.price as number) < (a.price as number) ? b : a))
        const pv = prevIdx[cc + "|" + s.k]
        return { price: best.price as number, delta: pv != null ? (best.price as number) - pv : null, url: best.url ?? null }
      })
      const prices = cells.filter((c): c is { price: number; delta: number | null; url: string | null } => c != null).map((c) => c.price)
      const min = prices.length ? Math.min(...prices) : null
      const max = prices.length ? Math.max(...prices) : null
      const spread = min != null && max != null && min > 0 && max > min ? ((max - min) / min) * 100 : null
      const srps = list.map((x) => x.srp).filter((v): v is number => v != null)
      const _form = pmFormOf(r0.category, r0.model + " " + (r0.capacity || ""), r0.brand)
      const _size = isAC(r0.category) ? acHpLabel(r0.model || "") : pmSizeBucket(r0.category, r0.model, r0.capacity)
      return { cat: r0.category, brand: r0.brand, code: cc || r0.code, model: r0.model, form: _form, size: _size, srp: srps.length ? Math.max(...srps) : null, cells, min, spread, star: starFor(r0.category, r0.model) }
    })
    const dir = sort.asc ? 1 : -1
    const shopIdx = BOARD_SHOPS.findIndex((s) => s.k === sort.k)
    out.sort((a, b) => {
      let x: number | string | null = null, y: number | string | null = null
      if (sort.k === "min") { x = a.min; y = b.min } else if (sort.k === "spread") { x = a.spread; y = b.spread } else if (sort.k === "brand") { x = a.brand; y = b.brand } else if (sort.k === "code") { x = a.code; y = b.code } else if (shopIdx >= 0) { x = a.cells[shopIdx]?.price ?? null; y = b.cells[shopIdx]?.price ?? null }
      if (x == null) return 1; if (y == null) return -1
      return (typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y))) * dir
    })
    return out
  }, [D, curDate, prevDate, cat, brands, effForm, effSize, q, sort]) // eslint-disable-line
  const setS = (k: string) => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))
  const arrow = (k: string) => (sort.k === k ? <span className="ml-0.5 text-indigo-500">{sort.asc ? "▲" : "▼"}</span> : null)

  // 원본(raw) 일일 거래선 가격 CSV — 수집 원본 9컬럼 전부 + 편의 파생(분류약자·유형·용량·모델코드).
  //  실제 수집: d·retailer·brand·category·model·capacity(상세 스펙 원문)·price·srp·url. onDate=해당 날짜만, null=전체. 엑셀 호환(BOM+CRLF)
  const dlRaw = (onDate: string | null) => {
    if (!D.length) return
    // 사이니지·상업용 디스플레이(TV 오분류) 제외 + 선택 날짜(onDate) 필터
    let rows = D.filter((r) => !isSignage(r.model))
    if (onDate) rows = rows.filter((r) => r.d === onDate)
    const head = ["Date", "Retailer", "Brand", "Category", "Type", "Size", "ModelCode", "ModelName", "Spec", "Price", "SRP", "URL"]
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const body = rows.map((r) => {
      const catE = catAbbr(r.category, r.model || "")
      const catK = CAT_KO[catE] ?? r.category
      const type = pmFormOf(catK, (r.model || "") + " " + (r.capacity || ""), r.brand) ?? ""
      const size = isAC(catK) ? acHpLabel(r.model || "") : (pmSizeBucket(catK, r.model, r.capacity) ?? "")
      // Date, Retailer, Brand, Category(약자), Type, Size, ModelCode, ModelName, Spec(=capacity 원문), Price, SRP, URL
      return [r.d, r.retailer, r.brand, catE, type, size, canonCode(r.model, r.code), r.model, r.capacity, r.price, r.srp, r.url].map(esc).join(",")
    })
    const csv = "﻿" + [head.join(","), ...body].join("\r\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    a.download = "channel_prices_" + (onDate ?? "all") + ".csv"
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* 검색·필터 — LG 기본 · 제품/스펙 호버 드롭다운 · 뉴스형 검색 · 최종갱신(맨오른쪽) */}
      <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <div className="w-fit"><PmMultiDrop label={T("브랜드", "Brand")} sel={brands} options={brandsL.filter((b) => b !== "전체").map((b) => ({ k: b, t: b }))} onToggle={(k) => setBrands((v) => v.includes(k) ? v.filter((x) => x !== k) : [...v, k])} onClear={() => setBrands([])} /></div>
        <div className="w-fit"><PmDrop label={T("제품", "Product")} sel={cat} options={cats.map((c) => ({ k: c, t: catLabel(c) }))} onSelect={(k) => { setCat(k); setForm("전체"); setSize("전체") }} /></div>
        <div className="w-fit"><PmDrop label={T("유형", "Type")} sel={effForm} options={[{ k: "전체", t: T("전체", "All") }, ...forms.map((t) => ({ k: t, t }))]} onSelect={setForm} /></div>
        <div className="w-fit"><PmDrop label={isAC(cat) ? T("마력", "HP") : cat === "TV" ? T("화면", "Screen") : T("용량", "Capacity")} sel={effSize} options={[{ k: "전체", t: T("전체", "All") }, ...sizes.map((t) => ({ k: t, t }))]} onSelect={setSize} /></div>
        {/* 날짜 네비게이터 — 과거 특정일 스냅샷(◀ 이전일 · ▶ 다음일 · 📅 달력에서 선택) */}
        {dates.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-1 py-0.5">
            <button type="button" onClick={goOlder} disabled={isOldest} aria-label={T("이전 날짜", "Previous date")} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <span className="min-w-[74px] text-center text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{curDate ? md(curDate) : "—"}{isLatest && <span className="ml-1 rounded bg-emerald-50 dark:bg-emerald-500/10 px-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">{T("최신", "Latest")}</span>}</span>
            <button type="button" onClick={goNewer} disabled={isLatest} aria-label={T("다음 날짜", "Next date")} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
            <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400" title={T("달력에서 날짜 선택", "Pick a date from the calendar")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <input type="date" value={curDate ?? ""} min={dates[dates.length - 1]} max={dates[0]} onChange={(e) => pickDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={T("날짜 선택", "Select date")} />
            </label>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          <ListSearch value={q} onChange={setQ} placeholder={T("모델·코드 검색", "Search model or code")} />
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : curDate ? md(curDate) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
          {/* 원본 CSV — 현재 선택한 날짜(curDate) 스냅샷 다운로드(맨오른쪽 · C 옆) */}
          <button type="button" onClick={() => dlRaw(curDate)} disabled={!D.length} aria-label={T("선택 날짜 원본 데이터(CSV) 다운로드", "Download raw data (CSV) for the selected date")} title={T("원본 데이터(CSV) 다운로드 · ", "Download raw data (CSV) · ") + (curDate ? md(curDate) : "—")} className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 transition-all duration-200 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300 active:scale-95 disabled:opacity-40">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
          </button>
        </div>
      </div>

      <div className="max-h-[1040px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[1290px] table-fixed border-collapse text-[12px]">
          <colgroup>
            <col style={{ width: 138 }} /><col style={{ width: 58 }} /><col style={{ width: 128 }} /><col style={{ width: 32 }} /><col style={{ width: 100 }} />
            {BOARD_SHOPS.map((s) => <col key={s.k} style={{ width: 100 }} />)}
            <col style={{ width: 86 }} /><col style={{ width: 70 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr className="text-[10.5px] font-semibold text-gray-600 dark:text-gray-300">
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("브랜드", "Brand")}</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("분류", "Category")}</th>
              <th className="cursor-pointer whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("code")}>{T("모델", "Model")}{arrow("code")}</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-1 py-2 text-center" title={T("New DOE 에너지등급", "New DOE energy rating")}>★</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">SRP</th>
              {BOARD_SHOPS.map((s) => (
                <th key={s.k} onClick={() => setS(s.k)} className={"cursor-pointer whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center " + (s.live ? "" : "text-gray-400 dark:text-gray-600")}>{s.label}{arrow(s.k)}</th>
              ))}
              <th className="cursor-pointer whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("min")}>{T("최저", "Lowest")}{arrow("min")}</th>
              <th className="cursor-pointer whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("spread")}>{T("스프레드", "Spread")}{arrow("spread")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={BOARD_SHOPS.length + 8} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">{T("불러오는 중…", "Loading…")}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={BOARD_SHOPS.length + 7} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">{T("조건에 맞는 모델 없음", "No models match the filters")}</td></tr>
            ) : data.slice(0, 300).map((r, ri) => (
              <tr key={curDate + r.brand + r.code + ri} style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(ri, 20) * 0.018 + "s" }} className="border-b border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5">
                <td className={"truncate whitespace-nowrap px-2 py-1.5 text-center text-[11.5px] font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")} title={r.brand}>{r.brand}</td>
                <td className="px-2 py-1.5 text-center text-[10.5px] text-gray-500 dark:text-gray-400">{catLabel(r.cat)}</td>
                <td className="truncate px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200" title={r.model}>{r.code}</td>
                <td className="px-1 py-1.5 text-center">{r.star != null ? <span className={"rounded px-1 text-[9px] font-bold " + pmStarCls(r.star)}>★{r.star}</span> : <span className="text-gray-300 dark:text-gray-600">·</span>}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.srp != null ? peso(r.srp) : "—"}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums" style={c && r.min != null && c.price === r.min ? { background: "rgba(16,185,129,0.08)" } : undefined}>
                    {!c ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                      <a href={c.url ?? undefined} target={c.url ? "_blank" : undefined} rel="noreferrer" className={c.url ? "cursor-pointer hover:underline" : ""}>
                        <span className={"font-bold " + (r.min != null && c.price === r.min ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-gray-50")}>{peso(c.price)}</span>
                        {c.delta != null && c.delta !== 0 && <span className={"ml-1 text-[9px] " + deltaCol(c.delta)}>{c.delta < 0 ? "▼" : "▲"}</span>}
                      </a>
                    )}
                  </td>
                ))}
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{r.min != null ? peso(r.min) : "—"}</td>
                <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums">{r.spread == null ? <span className="text-gray-300 dark:text-gray-600">—</span> : <span className={"font-semibold " + (r.spread >= 5 ? "text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400")}>{r.spread.toFixed(1)}%</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("LG 모델 × ", "LG models × ")}{BOARD_SHOPS.length}{T("개 거래선 ", " retailers ")}{curDate ? md(curDate) : ""}{T(" 스냅샷(경쟁사 제외·유통별 가격차 점검) · 셀=거래선 최저 현금가(클릭→원문)·행 최저가 초록·고가순 정렬 · ▼▲=", " snapshot (competitors excluded · cross-retailer price-gap check) · cell = retailer's lowest cash price (click → source) · row-low in green · sorted high-to-low · ▼▲ = ")}{prevDate ? md(prevDate) + T(" 대비", " vs") : T("전일 대비", "vs previous day")}{T(" · 스프레드=(최고−최저)/최저 ≥5% 적색 · ★=New DOE 등급 · ", " · spread = (max−min)/min ≥5% in red · ★ = New DOE rating · ")}{Math.min(data.length, 300)}/{data.length}{T("행", " rows")}{stamp ? " · " + T("최신", "Updated") + " " + fmtStamp(stamp) : ""}</p>
    </div>
  )
}

/* ─── 가격 포지셔닝 매트릭스(ASP) — 실데이터 기반 ────────────────────────────────
 *  세로=5개 유통 평균 단가(위=고가), 가로=브랜드(좌 저가→우 고가). 카드=브랜드×가격
 *  세그먼트(프리미엄/미드/엔트리) 평균가·가격지수·취급 유통수. 자사(LG) 인디고 강조.
 *  제품(카테고리)·스펙(세그먼트) 선택. New DOE ★는 미수집 → 가격 세그먼트로 대체.   */
// RAC(창문·벽걸이) / SAC(스탠드·천장·카세트·멀티·시스템) 분리. 건조기는 세탁기 안에 포함(유형으로 구분)
