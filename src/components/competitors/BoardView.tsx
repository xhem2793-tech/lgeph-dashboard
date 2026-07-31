"use client"

// 채널별 가격 비교 — LG모델 × 거래선 매트릭스(날짜 네비·전일대비·스프레드·★DOE등급).
import React from "react"
import { fmtStamp, type DailyRow, type EnergyRow } from "@/lib/supabase"
import { canonCode, isAC, PM_CATS, pmFormOf, pmFormsFor, pmFormHit, pmSizeList, pmSizeHit, pmSizeBucket, acHpLabel } from "@/lib/classify"
import { peso, md, deltaCol, pmStarCls, DOE_CODE, doeNorm, PmDrop } from "@/components/competitors/shared"

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
  const [brand, setBrand] = React.useState("전체")
  const [form, setForm] = React.useState("전체")
  const [size, setSize] = React.useState("전체")
  const [q, setQ] = React.useState("")
  const [focused, setFocused] = React.useState(false)
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
    const f = D.filter((r) => r.d === curDate && r.price != null && (brand === "전체" || r.brand === brand) && PM_CATS.includes(r.category) && (cat === "전체" || r.category === cat) && pmFormHit(cat, r.model + " " + (r.capacity || ""), effForm, r.brand) && pmSizeHit(cat, r.model, r.capacity, effSize) && canonCode(r.model, r.code).length >= 5 && (!kw || (r.code + " " + r.model + " " + canonCode(r.model, r.code)).toLowerCase().includes(kw)))
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
  }, [D, curDate, prevDate, cat, brand, effForm, effSize, q, sort]) // eslint-disable-line
  const setS = (k: string) => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))
  const arrow = (k: string) => (sort.k === k ? <span className="ml-0.5 text-indigo-500">{sort.asc ? "▲" : "▼"}</span> : null)

  return (
    <div className="flex flex-col gap-2.5">
      {/* 검색·필터 — LG 기본 · 제품/스펙 호버 드롭다운 · 뉴스형 검색 · 최종갱신(맨오른쪽) */}
      <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <div className="w-fit"><PmDrop label="브랜드" sel={brand} options={brandsL.map((b) => ({ k: b, t: b }))} onSelect={setBrand} /></div>
        <div className="w-fit"><PmDrop label="제품" sel={cat} options={cats.map((c) => ({ k: c, t: c }))} onSelect={(k) => { setCat(k); setForm("전체"); setSize("전체") }} /></div>
        <div className="w-fit"><PmDrop label="유형" sel={effForm} options={[{ k: "전체", t: "전체" }, ...forms.map((t) => ({ k: t, t }))]} onSelect={setForm} /></div>
        <div className="w-fit"><PmDrop label={isAC(cat) ? "마력" : cat === "TV" ? "화면" : "용량"} sel={effSize} options={[{ k: "전체", t: "전체" }, ...sizes.map((t) => ({ k: t, t }))]} onSelect={setSize} /></div>
        {/* 날짜 네비게이터 — 과거 특정일 스냅샷(◀ 이전일 · ▶ 다음일 · 📅 달력에서 선택) */}
        {dates.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-1 py-0.5">
            <button type="button" onClick={goOlder} disabled={isOldest} aria-label="이전 날짜" className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <span className="min-w-[74px] text-center text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{curDate ? md(curDate) : "—"}{isLatest && <span className="ml-1 rounded bg-emerald-50 dark:bg-emerald-500/10 px-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">최신</span>}</span>
            <button type="button" onClick={goNewer} disabled={isLatest} aria-label="다음 날짜" className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
            <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400" title="달력에서 날짜 선택">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <input type="date" value={curDate ?? ""} min={dates[dates.length - 1]} max={dates[0]} onChange={(e) => pickDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="날짜 선택" />
            </label>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className={"group relative transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-[320px]" : "w-[220px]")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="모델·코드 검색"
              className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">최종 {stamp ? fmtStamp(stamp) : curDate ? md(curDate) : "—"}<span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">CONFIRMED</span></span>
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
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">브랜드</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">분류</th>
              <th className="cursor-pointer whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("code")}>모델{arrow("code")}</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-1 py-2 text-center" title="New DOE 에너지등급">★</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center">SRP</th>
              {BOARD_SHOPS.map((s) => (
                <th key={s.k} onClick={() => setS(s.k)} className={"cursor-pointer whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center " + (s.live ? "" : "text-gray-400 dark:text-gray-600")}>{s.label}{arrow(s.k)}</th>
              ))}
              <th className="cursor-pointer whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("min")}>최저{arrow("min")}</th>
              <th className="cursor-pointer whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center" onClick={() => setS("spread")}>스프레드{arrow("spread")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={BOARD_SHOPS.length + 8} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">불러오는 중…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={BOARD_SHOPS.length + 7} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">조건에 맞는 모델 없음</td></tr>
            ) : data.slice(0, 300).map((r, ri) => (
              <tr key={curDate + r.brand + r.code + ri} style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(ri, 20) * 0.018 + "s" }} className="border-b border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5">
                <td className={"truncate whitespace-nowrap px-2 py-1.5 text-center text-[11.5px] font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")} title={r.brand}>{r.brand}</td>
                <td className="px-2 py-1.5 text-center text-[10.5px] text-gray-500 dark:text-gray-400">{r.cat}</td>
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
      <p className="text-[10px] text-gray-400 dark:text-gray-500">LG 모델 × {BOARD_SHOPS.length}개 거래선 {curDate ? md(curDate) : ""} 스냅샷(경쟁사 제외·유통별 가격차 점검) · 셀=거래선 최저 현금가(클릭→원문)·행 최저가 초록·고가순 정렬 · ▼▲={prevDate ? md(prevDate) + " 대비" : "전일 대비"} · 스프레드=(최고−최저)/최저 ≥5% 적색 · ★=New DOE 등급 · {Math.min(data.length, 300)}/{data.length}행{stamp ? " · 최종 " + fmtStamp(stamp) : ""}</p>
    </div>
  )
}

/* ─── 가격 포지셔닝 매트릭스(ASP) — 실데이터 기반 ────────────────────────────────
 *  세로=5개 유통 평균 단가(위=고가), 가로=브랜드(좌 저가→우 고가). 카드=브랜드×가격
 *  세그먼트(프리미엄/미드/엔트리) 평균가·가격지수·취급 유통수. 자사(LG) 인디고 강조.
 *  제품(카테고리)·스펙(세그먼트) 선택. New DOE ★는 미수집 → 가격 세그먼트로 대체.   */
// RAC(창문·벽걸이) / SAC(스탠드·천장·카세트·멀티·시스템) 분리. 건조기는 세탁기 안에 포함(유형으로 구분)
