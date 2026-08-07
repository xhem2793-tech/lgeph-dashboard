"use client"

// 모니터링 — LG 전용 권장가 준수 점검. LG모델 × 거래선 실판가를 우리가 준 '권장가'와 비교해
//   유통이 권장가를 지키는지(초과 여부·초과액)를 표시. 행을 펼치면 거래선별 프로모션(SRP 대비 할인)도 표기.
import React from "react"
import { fmtStamp, lgRecommendedPrices, type DailyRow, type EnergyRow, type RecPrice } from "@/lib/supabase"
import { canonCode, isAC, PM_CATS, pmFormOf, pmFormsFor, pmFormHit, pmSizeList, pmSizeHit } from "@/lib/classify"
import { peso, md, deltaCol, pmStarCls, DOE_CODE, doeNorm, PmDrop, ListSearch, catLabel } from "@/components/competitors/shared"
import { T } from "@/lib/i18n"

const MON_SHOPS: { k: string; label: string }[] = [
  { k: "Abenson", label: "Abenson" },
  { k: "SM Appliance", label: "SM" },
  { k: "Anson's", label: "Anson's" },
  { k: "Robinsons Appliances", label: "Robinsons" },
  { k: "Western Appliances", label: "Western" },
  { k: "Emcor", label: "Emcor" },
  { k: "Addessa", label: "Addessa" },
]

type Cell = { price: number; srp: number | null; delta: number | null; url: string | null } | null
type MonRow = { cat: string; code: string; model: string; form: string | null; srp: number | null; rec: number | null; recNote: string | null; cells: Cell[]; min: number | null; overCount: number; overMax: number; star: number | null }

export function MonitoringView({ daily, stamp, elabels }: { daily: DailyRow[] | null; stamp: string | null; elabels: EnergyRow[] | null }) {
  const [cat, setCat] = React.useState("전체")
  const [form, setForm] = React.useState("전체")
  const [size, setSize] = React.useState("전체")
  const [q, setQ] = React.useState("")
  const [selDate, setSelDate] = React.useState<string | null>(null)
  const [onlyOver, setOnlyOver] = React.useState(false) // 권장가 초과 유통이 있는 모델만
  const [open, setOpen] = React.useState<Set<string>>(new Set()) // 펼친 행(프로모션)
  const [recs, setRecs] = React.useState<RecPrice[] | null>(null)
  React.useEffect(() => { lgRecommendedPrices().then(setRecs).catch(() => setRecs([])) }, [])
  const recMap = React.useMemo(() => {
    const m: Record<string, RecPrice> = {}
    for (const r of recs || []) { const c = canonCode(r.model_code, null); if (c) m[c] = r }
    return m
  }, [recs])

  const D = React.useMemo(() => (daily ?? []).filter((r) => r.brand === "LG"), [daily]) // LG 전용
  const loading = daily === null
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
  const forms = cat === "전체" ? [] : pmFormsFor(cat)
  const effForm = form === "전체" || forms.includes(form) ? form : "전체"
  const sizes = cat === "전체" ? [] : pmSizeList(cat)
  const effSize = size === "전체" || sizes.includes(size) ? size : "전체"

  const starIdx = React.useMemo(() => {
    const m: Record<string, { codeN: string; star: number | null }[]> = {}
    ;(elabels || []).forEach((e) => { if (e.model && e.model.length >= 5) (m[e.category] = m[e.category] || []).push({ codeN: doeNorm(e.category, e.model), star: e.star }) })
    return m
  }, [elabels])
  const starFor = (c: string, model: string) => { const code = DOE_CODE[c]; const idx = code ? starIdx[code] : null; if (!idx) return null; const mm = doeNorm(code, model); const cc = doeNorm(code, canonCode(model, null)); for (const e of idx) { if (e.codeN.length < 5) continue; if (mm.includes(e.codeN)) return e.star; if (cc.length >= 8 && e.codeN.includes(cc)) return e.star } return null }

  const data = React.useMemo(() => {
    const kw = q.trim().toLowerCase()
    const prevIdx: Record<string, number> = {}
    D.filter((r) => r.d === prevDate && r.price != null).forEach((r) => { const cc = canonCode(r.model, r.code); if (!cc) return; const k = cc + "|" + r.retailer; prevIdx[k] = Math.min(prevIdx[k] ?? Infinity, r.price as number) })
    const f = D.filter((r) => r.d === curDate && r.price != null && PM_CATS.includes(r.category) && (cat === "전체" || r.category === cat) && pmFormHit(cat, r.model + " " + (r.capacity || ""), effForm, r.brand) && pmSizeHit(cat, r.model, r.capacity, effSize) && canonCode(r.model, r.code).length >= 5 && (!kw || (r.code + " " + r.model + " " + canonCode(r.model, r.code)).toLowerCase().includes(kw)))
    const g: Record<string, DailyRow[]> = {}
    f.forEach((r) => { const cc = canonCode(r.model, r.code); (g[cc] = g[cc] || []).push(r) })
    const out: MonRow[] = Object.entries(g).map(([cc, list]) => {
      const r0 = list[0]
      const rec = recMap[cc] ?? null
      const cells: Cell[] = MON_SHOPS.map((s) => {
        const ms = list.filter((r) => r.retailer === s.k)
        if (!ms.length) return null
        const best = ms.reduce((a, b) => ((b.price as number) < (a.price as number) ? b : a))
        const pv = prevIdx[cc + "|" + s.k]
        return { price: best.price as number, srp: best.srp ?? null, delta: pv != null ? (best.price as number) - pv : null, url: best.url ?? null }
      })
      const prices = cells.filter((c): c is NonNullable<Cell> => c != null).map((c) => c.price)
      const min = prices.length ? Math.min(...prices) : null
      const recP = rec?.price ?? null
      let overCount = 0, overMax = 0
      if (recP != null) cells.forEach((c) => { if (c && c.price > recP) { overCount++; overMax = Math.max(overMax, c.price - recP) } })
      const srps = list.map((x) => x.srp).filter((v): v is number => v != null)
      const _form = pmFormOf(r0.category, r0.model + " " + (r0.capacity || ""), r0.brand)
      return { cat: r0.category, code: cc || r0.code, model: r0.model, form: _form, srp: srps.length ? Math.max(...srps) : null, rec: recP, recNote: rec?.note ?? null, cells, min, overCount, overMax, star: starFor(r0.category, r0.model) }
    })
    out.sort((a, b) => (b.overCount - a.overCount) || (b.overMax - a.overMax) || String(a.code).localeCompare(String(b.code)))
    return onlyOver ? out.filter((r) => r.overCount > 0) : out
  }, [D, curDate, prevDate, cat, effForm, effSize, q, recMap, onlyOver]) // eslint-disable-line

  const recCount = recs?.length ?? 0
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <div className="w-fit"><PmDrop label={T("제품", "Div")} sel={cat} options={[{ k: "전체", t: T("전체", "All") }, ...cats.map((c) => ({ k: c, t: catLabel(c) }))]} onSelect={(k) => { setCat(k); setForm("전체"); setSize("전체") }} /></div>
        <div className="w-fit"><PmDrop label={T("유형", "Type")} sel={effForm} options={[{ k: "전체", t: T("전체", "All") }, ...forms.map((t) => ({ k: t, t }))]} onSelect={setForm} /></div>
        <div className="w-fit"><PmDrop label={isAC(cat) ? T("마력", "HP") : cat === "TV" ? T("화면", "Screen") : T("용량", "Cap.")} sel={effSize} options={[{ k: "전체", t: T("전체", "All") }, ...sizes.map((t) => ({ k: t, t }))]} onSelect={setSize} /></div>
        <button type="button" onClick={() => setOnlyOver((v) => !v)} className={"rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-all duration-200 active:scale-95 " + (onlyOver ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-rose-300 hover:text-rose-600")} title={T("권장가 초과 유통이 있는 모델만", "Only models where a retailer exceeds the recommended price")}>{T("초과만", "Over only")}</button>
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
        </div>
      </div>

      {recs != null && recCount === 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-800 dark:text-amber-200">{T("권장가 목록이 아직 업로드되지 않았습니다 — 권장가 열은 목록 업로드 후 채워집니다(모델코드·권장가).", "The recommended-price list hasn't been uploaded yet — the 권장가 column fills in once the list (model code · recommended price) is uploaded.")}</div>
      )}

      <div className="max-h-[1040px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[1240px] table-fixed border-collapse text-[12px]">
          <colgroup>
            <col style={{ width: 26 }} /><col style={{ width: 70 }} /><col style={{ width: 116 }} /><col style={{ width: 128 }} /><col style={{ width: 30 }} /><col style={{ width: 92 }} /><col style={{ width: 96 }} />
            {MON_SHOPS.map((s) => <col key={s.k} style={{ width: 100 }} />)}
            <col style={{ width: 92 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr className="text-[10.5px] font-semibold text-gray-600 dark:text-gray-300">
              <th className="border-b border-gray-200 dark:border-gray-800 px-1 py-2" />
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("제품", "Div")}</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("유형", "Type")}</th>
              <th className="whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("모델", "Model")}</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-1 py-2 text-center" title={T("New DOE 에너지등급", "New DOE energy rating")}>★</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center text-gray-400 dark:text-gray-500">SRP</th>
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center text-indigo-600 dark:text-indigo-300">{T("권장가", "Rec.")}</th>
              {MON_SHOPS.map((s) => (
                <th key={s.k} className="whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-2 py-2 text-center">{s.label}</th>
              ))}
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-2 py-2 text-center" title={T("권장가 초과 유통 수·최대 초과액", "Retailers over the recommended price · max overage")}>{T("초과", "Over")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={MON_SHOPS.length + 8} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">{T("불러오는 중…", "Loading…")}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={MON_SHOPS.length + 8} className="px-3 py-12 text-center text-gray-400 dark:text-gray-500">{T("조건에 맞는 LG 모델 없음", "No LG models match the filters")}</td></tr>
            ) : data.slice(0, 300).map((r, ri) => {
              const k = curDate + r.code + ri
              const isOpen = open.has(k)
              return (
                <React.Fragment key={k}>
                  <tr style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(ri, 20) * 0.018 + "s" }} className={"cursor-pointer border-b border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 " + (r.overCount > 0 ? "bg-rose-50/40 dark:bg-rose-500/[0.06]" : "")} onClick={() => toggle(k)}>
                    <td className="px-1 py-1.5 text-center text-gray-400"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="inline transition-transform duration-200" style={{ transform: isOpen ? "rotate(90deg)" : "none" }}><path d="M9 6l6 6-6 6" /></svg></td>
                    <td className="px-2 py-1.5 text-center text-[10.5px] text-gray-500 dark:text-gray-400">{catLabel(r.cat)}</td>
                    <td className="truncate px-2 py-1.5 text-center text-[10.5px] text-gray-500 dark:text-gray-400" title={r.form || undefined}>{r.form || "—"}</td>
                    <td className="truncate px-2 py-1.5 font-medium text-gray-700 dark:text-gray-200" title={r.model}>{r.code}</td>
                    <td className="px-1 py-1.5 text-center">{r.star != null ? <span className={"rounded px-1 text-[9px] font-bold " + pmStarCls(r.star)}>★{r.star}</span> : <span className="text-gray-300 dark:text-gray-600">·</span>}</td>
                    <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{r.srp != null ? peso(r.srp) : "—"}</td>
                    <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right font-bold tabular-nums text-indigo-700 dark:text-indigo-300" title={r.recNote || undefined}>{r.rec != null ? peso(r.rec) : "—"}</td>
                    {r.cells.map((c, i) => {
                      const over = c && r.rec != null && c.price > r.rec
                      const under = c && r.rec != null && c.price <= r.rec
                      return (
                        <td key={i} className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right tabular-nums" style={over ? { background: "rgba(244,63,94,0.10)" } : under ? { background: "rgba(16,185,129,0.07)" } : undefined}>
                          {!c ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                            <div className="flex flex-col items-end leading-tight">
                              <span className={"font-bold " + (over ? "text-rose-700 dark:text-rose-300" : under ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-gray-50")}>{peso(c.price)}{c.delta != null && c.delta !== 0 && <span className={"ml-1 text-[9px] " + deltaCol(c.delta)}>{c.delta < 0 ? "▼" : "▲"}</span>}</span>
                              {over && <span className="text-[9px] font-semibold text-rose-600 dark:text-rose-400">+{peso((c.price as number) - (r.rec as number))} {T("초과", "over")}</span>}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-center tabular-nums">{r.rec == null ? <span className="text-gray-300 dark:text-gray-600">—</span> : r.overCount === 0 ? <span className="rounded bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">{T("준수", "OK")}</span> : <span className="rounded bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">{r.overCount}{T("곳", "")} · +{peso(r.overMax)}</span>}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/60 dark:bg-gray-900/40" style={{ animation: "fadeUp .2s ease both" }}>
                      <td className="px-1" />
                      <td colSpan={MON_SHOPS.length + 7} className="px-3 py-2.5">
                        <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{T("거래선별 프로모션·권장가 준수", "Promotions & recommended-price compliance by retailer")}</div>
                        <div className="flex flex-wrap gap-2">
                          {r.cells.map((c, i) => {
                            if (!c) return null
                            const disc = c.srp != null && c.srp > 0 && c.price < c.srp ? Math.round((1 - c.price / c.srp) * 100) : null
                            const over = r.rec != null && c.price > r.rec
                            return (
                              <div key={i} className={"flex min-w-[150px] flex-col gap-0.5 rounded-lg border px-2.5 py-2 " + (over ? "border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/[0.08]" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900")}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{MON_SHOPS[i].label}</span>
                                  {disc != null ? <span className="rounded bg-violet-50 dark:bg-violet-500/10 px-1 py-px text-[9.5px] font-bold text-violet-700 dark:text-violet-300">-{disc}%</span> : <span className="text-[9.5px] text-gray-400">{T("프로모 없음", "no promo")}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                                  {c.srp != null && disc != null && <span className="text-gray-400 line-through dark:text-gray-500">{peso(c.srp)}</span>}
                                  {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="font-bold text-gray-900 hover:underline dark:text-gray-50">{peso(c.price)}</a> : <span className="font-bold text-gray-900 dark:text-gray-50">{peso(c.price)}</span>}
                                </div>
                                {r.rec != null && <span className={"text-[10px] font-semibold " + (over ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{over ? `${T("권장가 +", "rec +")}${peso(c.price - r.rec)} ${T("초과", "over")}` : T("권장가 준수", "within rec.")}</span>}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("LG 모델 × ", "LG models × ")}{MON_SHOPS.length}{T("개 거래선 — 유통 실판가를 우리가 준 권장가와 비교(초과 유통·초과액 표시). 셀 빨강=권장가 초과·초록=준수 · 행 클릭 시 거래선별 프로모션(SRP 대비 할인) 펼침 · 권장가 목록 ", " retailers — retailer street prices vs. our recommended price (over-retailers & overage shown). Red cell = over rec · green = within · click a row to expand per-retailer promotions (discount vs SRP) · rec list ")}{recCount}{T("개 로드", " loaded")}{stamp ? " · " + T("최신", "Updated") + " " + fmtStamp(stamp) : ""}</p>
    </div>
  )
}
