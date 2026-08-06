"use client"

// 신제품 · EOL 감지 — 경쟁사 관측 데이터(v_competitor_daily)에서 신규 SKU 등장 / 미노출(단종 후보)을 파생.
// 3뷰(피드/보드/테이블) 세그먼트 전환 + 카테고리 필터 + KPI + 드릴다운 모달. 시안: design_handoff_eol_detection.
import React from "react"
import { fmtStamp, type DailyRow } from "@/lib/supabase"
import { canonCode, PM_CATS, pmFormOf } from "@/lib/classify"
import { peso, catLabel, PmDrop } from "@/components/competitors/shared"
import { Segmented } from "@/components/Segmented"
import { T } from "@/lib/i18n"

type Kind = "new" | "eol"
type Ev = {
  id: string; kind: Kind; cat: string; brand: string; model: string; form: string | null; spec: string | null
  firstSeen: string; lastSeen: string; daysMissing: number; price: number | null; channels: number
  conf: "높음" | "중간" | "낮음"; status: string; date: string; hist: { d: string; net: number | null }[]
}

const CATS = ["전체", "에어컨", "냉장고", "세탁기", "TV"]
const dayNum = (d: string) => Math.floor(new Date(d + "T00:00:00").getTime() / 86400000)
const eolStatus = (m: number) => (m >= 14 ? "단종 유력" : m >= 7 ? "관찰중" : "주의")
const STATUS_C: Record<string, { dot: string; chip: string; soft: string }> = {
  "단종 유력": { dot: "bg-rose-500", chip: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400", soft: "bg-rose-50/70 dark:bg-rose-500/10" },
  "관찰중": { dot: "bg-amber-500", chip: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300", soft: "bg-amber-50/70 dark:bg-amber-500/10" },
  "주의": { dot: "bg-gray-400", chip: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", soft: "bg-gray-50 dark:bg-gray-800/40" },
  "신제품": { dot: "bg-emerald-500", chip: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", soft: "bg-emerald-50/70 dark:bg-emerald-500/10" },
}
const md = (d: string) => { const p = (d || "").split("-"); return p.length === 3 ? `${+p[1]}/${+p[2]}` : d }
const catNorm = (c: string) => (/에어컨|rac|sac/i.test(c) ? "에어컨" : /냉장고/.test(c) ? "냉장고" : /세탁/.test(c) ? "세탁기" : /tv/i.test(c) ? "TV" : c)

export function EolView({ daily, stamp }: { daily: DailyRow[] | null; stamp: string | null }) {
  const [view, setView] = React.useState<"feed" | "board" | "table">("feed")
  const [cat, setCat] = React.useState("전체")
  const [subF, setSubF] = React.useState("전체") // 전체/신제품/EOL 후보 — 피드·테이블 공용
  const [sel, setSel] = React.useState<Ev | null>(null)

  const events = React.useMemo<Ev[]>(() => {
    const D = daily ?? []
    if (!D.length) return []
    // 기준일 = 오늘(8/4). 신제품 등장·미노출(EOL) 경과일을 '관측 최종일'이 아니라 '오늘' 기준으로 산정
    const T = dayNum(new Date().toISOString().slice(0, 10))
    const g: Record<string, DailyRow[]> = {}
    D.forEach((r) => { if (!PM_CATS.includes(r.category)) return; const cc = canonCode(r.model, r.code); if (cc.length < 5) return; (g[cc] = g[cc] || []).push(r) })
    const out: Ev[] = []
    for (const [cc, list] of Object.entries(g)) {
      const ds = list.map((r) => r.d)
      const firstSeen = ds.reduce((a, b) => (a < b ? a : b))
      const lastSeen = ds.reduce((a, b) => (a > b ? a : b))
      const daysMissing = T - dayNum(lastSeen)
      const r0 = list.find((r) => r.d === lastSeen) ?? list[0]
      const cN = catNorm(r0.category)
      const model = r0.code && r0.code.length >= 4 && r0.code !== "N/A" ? r0.code : cc
      const form = pmFormOf(r0.category, (r0.model || "") + " " + (r0.capacity || ""), r0.brand)
      const spec = r0.capacity ?? null
      const lastRows = list.filter((r) => r.d === lastSeen)
      const channels = new Set(lastRows.map((r) => r.retailer)).size
      const lastPrices = lastRows.map((r) => r.price).filter((v): v is number => v != null)
      const netPrice = lastPrices.length ? Math.min(...lastPrices) : null
      const conf: Ev["conf"] = channels >= 2 && ds.length >= 3 ? "높음" : channels >= 1 && ds.length >= 2 ? "중간" : "낮음"
      // 관측 히스토리(모델별 일자 최저가)
      const byDay: Record<string, number[]> = {}
      list.forEach((r) => { if (r.price != null) (byDay[r.d] = byDay[r.d] || []).push(r.price) })
      const hist = Object.entries(byDay).map(([d, ps]) => ({ d, net: Math.min(...ps) })).sort((a, b) => a.d.localeCompare(b.d))
      // 기간대조 + 지속성(균형 기준) — 모델명 노이즈로 하루만 스친 유령 SKU를 걸러내기 위해 '며칠 지속 관측'을 필수 조건화.
      //   신제품 = 최근 4일(T-3~T) 중 2일↑ 등장 AND 직전 2주(T-17~T-4) 전무  → '없던 게 새로 지속 등장'
      //   단종  = 과거(T-7 이전) 3일↑ 관측 AND 최근 7일(T-6~T) 전무           → '있던 게 사라짐'
      const dayNums = Array.from(new Set(ds.map((d) => dayNum(d))))
      const cnt = (lo: number, hi: number) => dayNums.reduce((n, dn) => n + (dn >= lo && dn <= hi ? 1 : 0), 0)
      const recentN = cnt(T - 3, T)      // 최근 4일
      const priorN = cnt(T - 17, T - 4)  // 직전 2주(신제품 대조 기준)
      const last7N = cnt(T - 6, T)       // 최근 7일
      const earlierN = cnt(T - 3650, T - 7) // 7일 이전 전체
      if (recentN >= 2 && priorN === 0) {
        const firstRows = list.filter((r) => r.d === firstSeen).map((r) => r.price).filter((v): v is number => v != null)
        out.push({ id: "new-" + cc, kind: "new", cat: cN, brand: r0.brand, model, form, spec, firstSeen, lastSeen, daysMissing, price: firstRows.length ? Math.min(...firstRows) : netPrice, channels, conf, status: "신제품", date: firstSeen, hist })
      } else if (earlierN >= 3 && last7N === 0) {
        out.push({ id: "eol-" + cc, kind: "eol", cat: cN, brand: r0.brand, model, form, spec, firstSeen, lastSeen, daysMissing, price: netPrice, channels, conf, status: eolStatus(daysMissing), date: lastSeen, hist })
      }
    }
    return out
  }, [daily])

  const filtered = React.useMemo(() => events.filter((e) => cat === "전체" || e.cat === cat), [events, cat])
  const kpi = React.useMemo(() => ({
    neo: filtered.filter((e) => e.kind === "new").length,
    dead: filtered.filter((e) => e.kind === "eol" && e.daysMissing >= 14).length,
    watch: filtered.filter((e) => e.kind === "eol" && e.daysMissing < 14).length,
  }), [filtered])
  const catCounts = React.useMemo(() => { const c: Record<string, number> = {}; events.forEach((e) => { c[e.cat] = (c[e.cat] || 0) + 1 }); return c }, [events])

  if (daily === null) return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("불러오는 중", "Loading")}</div>

  return (
    <div className="mt-3 flex flex-col gap-3" style={{ animation: "fadeUp .5s ease both" }}>
      {/* 컨트롤 바 — 한 줄: 제품(좌) · 서브필터 · 시그널(KPI) · 피드/보드/테이블(우) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <PmDrop label={T("제품", "Div")} sel={cat} options={CATS.filter((c) => c === "전체" || (catCounts[c] ?? 0) > 0).map((c) => ({ k: c, t: c === "전체" ? T("전체", "All") : catLabel(c) }))} onSelect={setCat} />
        {view !== "board" && <SubTabs f={subF} setF={setSubF} />}
        <span className="hidden h-4 w-px bg-gray-200 dark:bg-gray-700 sm:block" />
        <div className="flex items-center gap-3.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />{T("신제품", "New")} <b className="tabular-nums text-gray-800 dark:text-gray-100">{kpi.neo}</b></span>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className="h-2 w-2 rounded-full bg-rose-500" />{T("단종 유력", "Likely EOL")} <b className="tabular-nums text-gray-800 dark:text-gray-100">{kpi.dead}</b></span>
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className="h-2 w-2 rounded-full bg-amber-500" />{T("관찰중", "Watching")} <b className="tabular-nums text-gray-800 dark:text-gray-100">{kpi.watch}</b></span>
          <span className="hidden text-[11px] text-gray-400 dark:text-gray-500 lg:inline">{T("최신 ", "Updated ")}{stamp ? fmtStamp(stamp) : "—"}</span>
        </div>
        <div className="ml-auto">
          <Segmented value={view} onChange={(k) => setView(k as "feed" | "board" | "table")} options={[{ k: "feed", label: T("피드", "Feed") }, { k: "board", label: T("보드", "Board") }, { k: "table", label: T("테이블", "Table") }]} />
        </div>
      </div>

      {view === "feed" && <FeedView events={filtered} f={subF} onSel={setSel} />}
      {view === "board" && <BoardKanban events={filtered} onSel={setSel} />}
      {view === "table" && <TableView events={filtered} f={subF} onSel={setSel} />}

      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("신제품=최근 4일 중 2일↑ 지속 등장 & 직전 2주 전무(하루만 스친 스크랩 노이즈 제외) · EOL 후보=과거 3일↑ 관측되던 모델이 최근 7일 미노출 — 14일↑ 단종 유력, 7~13일 관찰중 · 데이터 v_competitor_daily(관측)", "New = seen ≥2 of last 4 days & absent the prior 2 weeks (filters one-day scrape noise) · EOL candidate = model observed ≥3 days before but absent the last 7 days — 14d+ likely EOL, 7–13d watching · data v_competitor_daily (observed)")}</p>

      {sel && <EolModal e={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

function SubTabs({ f, setF }: { f: string; setF: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {["전체", "신제품", "EOL 후보"].map((t) => (
        <button key={t} type="button" onClick={() => setF(t)} className={"rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors " + (f === t ? "bg-indigo-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300")}>{t}</button>
      ))}
    </div>
  )
}
const passF = (e: Ev, f: string) => f === "전체" || (f === "신제품" ? e.kind === "new" : e.kind === "eol")

function FeedView({ events, f, onSel }: { events: Ev[]; f: string; onSel: (e: Ev) => void }) {
  const list = events.filter((e) => passF(e, f)).sort((a, b) => b.date.localeCompare(a.date))
  const byDay: Record<string, Ev[]> = {}
  list.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e) })
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a)).slice(0, 8)
  return (
    <div className="flex flex-col gap-4">
      {days.length === 0 ? <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-16 text-center text-[12.5px] text-gray-400">{T("해당 이벤트가 없습니다.", "No matching events.")}</div> : days.map((d, gi) => {
        // 날짜 안에서 신호종류(신제품/EOL 후보) 카드로 그룹 — 이상치 알림과 동일 패턴
        const groups = [
          { key: "new", label: T("신제품 등장", "New products"), items: byDay[d].filter((e) => e.kind === "new") },
          { key: "eol", label: T("EOL 후보", "EOL candidates"), items: byDay[d].filter((e) => e.kind === "eol").sort((a, b) => b.daysMissing - a.daysMissing) },
        ].filter((g) => g.items.length > 0)
        return (
        <div key={d} style={{ animation: "viewIn .42s cubic-bezier(.22,1,.36,1) both", animationDelay: gi * 0.04 + "s" }}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold " + (gi === 0 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-200")}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{gi === 0 ? T("오늘", "Today") : gi === 1 ? T("어제", "Yesterday") : md(d)}</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{byDay[d].length}{T("건", "")}</span>
          </div>
          <div className="ml-1 flex flex-col gap-2 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
            {groups.map((g) => (
              <div key={g.key} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900/40">
                  <span className={"-ml-[19px] h-2 w-2 rounded-full ring-2 ring-white dark:ring-gray-950 " + (g.key === "new" ? "bg-emerald-500" : "bg-rose-500")} />
                  <span className={"inline-flex items-center rounded px-1.5 py-px text-[11px] font-bold " + (g.key === "new" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400")}>{g.label}</span>
                  <span className="text-[10.5px] text-gray-400 dark:text-gray-500">{g.items.length}{T("개 제품", "")}</span>
                </div>
                {g.items.map((e, i) => (
                  <button key={e.id} type="button" onClick={() => onSel(e)} className="flex w-full items-center gap-2 border-b border-gray-100 dark:border-gray-800/60 px-3 py-2 text-left transition-colors last:border-0 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10" style={{ animation: "rowIn .4s cubic-bezier(.22,1,.36,1) both", animationDelay: Math.min(i, 10) * 0.02 + "s" }}>
                    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                      {(e.kind === "new" || e.status === "단종 유력") && <span className={"absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 " + STATUS_C[e.status].dot} />}
                      <span className={"relative h-2 w-2 rounded-full " + STATUS_C[e.status].dot} />
                    </span>
                    <span className={"whitespace-nowrap text-[12.5px] font-bold uppercase " + (e.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-gray-50")}>{e.brand}</span>
                    <span className="whitespace-nowrap text-[12px] font-semibold text-gray-700 dark:text-gray-200">{e.cat}</span>
                    {e.form ? <span className="hidden whitespace-nowrap text-[12px] text-gray-600 dark:text-gray-300 sm:inline">{e.form}</span> : null}
                    {e.spec ? <span className="hidden whitespace-nowrap text-[11.5px] text-gray-500 dark:text-gray-400 md:inline">{e.spec}</span> : null}
                    <span className="hidden whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 lg:inline">({e.model})</span>
                    <span className="ml-auto shrink-0 text-right text-[11.5px] tabular-nums">{e.kind === "new" ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{T("등장가 ", "Launch ")}{peso(e.price)}</span> : <span className="text-gray-500 dark:text-gray-400">{T("미노출 ", "Absent ")}<b className={e.daysMissing >= 14 ? "text-rose-600 dark:text-rose-400" : "text-gray-800 dark:text-gray-100"}>D+{e.daysMissing}</b></span>}</span>
                    <span className="hidden w-12 shrink-0 text-right text-[11px] text-gray-400 dark:text-gray-500 md:block">{e.channels}{T("/곳", "/ch")}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 dark:text-gray-600"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}

// 카테고리 썸네일 — 실제 제품 이미지 URL이 데이터에 없어 카테고리 아이콘 타일로 대체(추후 og:image 저장 시 <img>로 교체).
const CAT_ICON: Record<string, string> = {
  "냉장고": '<rect x="6" y="2.5" width="12" height="19" rx="2.2"/><path d="M6 10h12"/><path d="M9 5.5v2.5M9 12.5v3.5"/>',
  "세탁기": '<rect x="4" y="2.5" width="16" height="19" rx="2.2"/><circle cx="12" cy="14" r="4.2"/><path d="M7 6h.01M10 6h.01"/>',
  "TV": '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  "에어컨": '<rect x="2.5" y="5" width="19" height="7" rx="2.2"/><path d="M6 8.5h9M6 16c0 1.5 1 2 2.2 2M12 16c0 2 1.4 2.6 3 2.6M18 16c0 1.3-.8 1.8-1.8 1.8"/>',
}
function CatThumb({ cat, brand }: { cat: string; brand: string }) {
  const lg = /^lg$/i.test(brand)
  const d = CAT_ICON[cat] ?? '<rect x="4" y="4" width="16" height="16" rx="2"/>'
  return (
    <span className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-lg " + (lg ? "bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300" : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500")} title={cat}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
    </span>
  )
}
function BoardKanban({ events, onSel }: { events: Ev[]; onSel: (e: Ev) => void }) {
  const cols: { key: string; title: string; items: Ev[] }[] = [
    { key: "신제품", title: T("신제품 등장", "New products"), items: events.filter((e) => e.kind === "new").sort((a, b) => b.date.localeCompare(a.date)) },
    { key: "관찰중", title: T("EOL 관찰중", "EOL watching"), items: events.filter((e) => e.kind === "eol" && e.daysMissing < 14).sort((a, b) => b.daysMissing - a.daysMissing) },
    { key: "단종 유력", title: T("단종 유력", "Likely EOL"), items: events.filter((e) => e.kind === "eol" && e.daysMissing >= 14).sort((a, b) => b.daysMissing - a.daysMissing) },
  ]
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cols.map((col) => (
        <div key={col.key} className="flex flex-col gap-2 rounded-xl bg-gray-100/70 dark:bg-gray-900/40 p-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className={"h-2 w-2 rounded-full " + STATUS_C[col.key].dot} />
            <span className="text-[12.5px] font-bold text-gray-800 dark:text-gray-100">{col.title}</span>
            <span className="rounded-full bg-white dark:bg-gray-800 px-1.5 py-px text-[10px] font-bold tabular-nums text-gray-500 dark:text-gray-400">{col.items.length}</span>
          </div>
          {col.items.length === 0 ? <p className="px-1 py-6 text-center text-[11.5px] text-gray-400 dark:text-gray-500">{T("없음", "None")}</p> : col.items.slice(0, 40).map((e, i) => (
            <button key={e.id} type="button" onClick={() => onSel(e)} className="group flex gap-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md" style={{ animation: "rowIn .4s cubic-bezier(.22,1,.36,1) both", animationDelay: Math.min(i, 12) * 0.03 + "s" }}>
              <CatThumb cat={e.cat} brand={e.brand} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-gray-100 px-1.5 py-px text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{e.cat}</span>
                {e.form ? <span className="rounded bg-gray-100 px-1.5 py-px text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{e.form}</span> : null}
                <span className="ml-auto text-[9.5px] font-semibold text-gray-400 dark:text-gray-500">{T("신뢰 ", "Conf. ")}{e.conf}</span>
              </div>
              <span className="truncate text-[12.5px] font-bold text-gray-900 dark:text-gray-50">{e.brand} {e.model}</span>
              <span className={"rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums " + STATUS_C[col.key].soft + (col.key === "신제품" ? " text-emerald-700 dark:text-emerald-300" : col.key === "단종 유력" ? " text-rose-700 dark:text-rose-300" : " text-amber-700 dark:text-amber-300")}>{e.kind === "new" ? T("등장가 ", "Launch ") + peso(e.price) : T("미노출 ", "Absent ") + "D+" + e.daysMissing}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{T("최초 ", "First ")}{md(e.firstSeen)}{T(" · 최종 ", " · last ")}{md(e.lastSeen)}{e.price != null ? " · " + peso(e.price) : ""}</span>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function TableView({ events, f, onSel }: { events: Ev[]; f: string; onSel: (e: Ev) => void }) {
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "absent", asc: false })
  const setS = (k: string) => setSort((s) => (s.k === k ? { k, asc: !s.asc } : { k, asc: true }))
  const arrow = (k: string) => (sort.k === k ? <span className="ml-0.5 text-indigo-500">{sort.asc ? "▲" : "▼"}</span> : <span className="ml-0.5 text-[8px] text-gray-300 dark:text-gray-600">⇅</span>)
  const sv = (e: Ev, k: string): number | string | null => {
    if (k === "absent") return e.kind === "eol" ? e.daysMissing : -1
    if (k === "model") return e.model; if (k === "brand") return e.brand; if (k === "cat") return e.cat
    if (k === "form") return e.form ?? ""; if (k === "first") return e.firstSeen; if (k === "last") return e.lastSeen
    if (k === "price") return e.price; if (k === "status") return e.kind === "new" ? "0" : e.status
    return null
  }
  const list = events.filter((e) => passF(e, f)).sort((a, b) => {
    const x = sv(a, sort.k), y = sv(b, sort.k)
    if (x == null) return 1; if (y == null) return -1
    const c = typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y))
    return (c !== 0 ? c : b.date.localeCompare(a.date)) * (sort.asc ? 1 : -1)
  })
  const Th = ({ k, label, align = "left" }: { k: string; label: string; align?: string }) => (
    <th onClick={() => setS(k)} className={"cursor-pointer select-none border-b border-gray-200 dark:border-gray-800 px-2 py-2 hover:text-indigo-600 dark:hover:text-indigo-400 " + (align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left")}>{label}{arrow(k)}</th>
  )
  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[930px] table-fixed text-[12px]">
          <colgroup><col style={{ width: 108 }} /><col /><col style={{ width: 88 }} /><col style={{ width: 72 }} /><col style={{ width: 74 }} /><col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 70 }} /><col style={{ width: 92 }} /><col style={{ width: 56 }} /></colgroup>
          <thead className="bg-gray-50 dark:bg-gray-900"><tr className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
            <th onClick={() => setS("status")} className="cursor-pointer select-none border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-left hover:text-indigo-600">{T("상태", "Status")}{arrow("status")}</th>
            <Th k="model" label={T("제품", "Product")} />
            <Th k="brand" label={T("경쟁사", "Rival")} />
            <Th k="cat" label={T("카테고리", "Category")} />
            <Th k="form" label={T("유형", "Type")} />
            <Th k="first" label={T("최초 관측", "First seen")} />
            <Th k="last" label={T("최종 관측", "Last seen")} />
            <Th k="absent" label={T("미노출", "Absent")} align="center" />
            <Th k="price" label={T("등록가", "Price")} align="right" />
            <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-center">{T("상세", "Details")}</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={10} className="px-4 py-10 text-center text-[12px] text-gray-400">{T("해당 이벤트가 없습니다.", "No matching events.")}</td></tr> : list.slice(0, 200).map((e, i) => (
              <tr key={e.id} onClick={() => onSel(e)} className="cursor-pointer border-b border-gray-100 dark:border-gray-800/60 last:border-0 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10" style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(i, 16) * 0.015 + "s" }}>
                <td className="px-3 py-2"><span className={"inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold " + (e.kind === "new" ? STATUS_C["신제품"].chip : STATUS_C[e.status].chip)}><span className={"h-1.5 w-1.5 rounded-full " + (e.kind === "new" ? "bg-emerald-500" : STATUS_C[e.status].dot)} />{e.kind === "new" ? T("신제품", "New") : e.status}</span></td>
                <td className="truncate px-2 py-2 font-semibold text-gray-800 dark:text-gray-100" title={e.model}>{e.model}</td>
                <td className="truncate px-2 py-2 text-gray-600 dark:text-gray-300">{e.brand}</td>
                <td className="px-2 py-2 text-gray-500 dark:text-gray-400">{e.cat}</td>
                <td className="truncate px-2 py-2 text-gray-500 dark:text-gray-400" title={e.form || undefined}>{e.form || "—"}</td>
                <td className="px-2 py-2 tabular-nums text-gray-500 dark:text-gray-400">{md(e.firstSeen)}</td>
                <td className="px-2 py-2 tabular-nums text-gray-500 dark:text-gray-400">{md(e.lastSeen)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{e.kind === "new" ? <span className="text-gray-300 dark:text-gray-600">—</span> : <span className={"font-bold " + (e.daysMissing >= 14 ? "text-rose-600 dark:text-rose-400" : e.daysMissing >= 7 ? "text-amber-600 dark:text-amber-400" : "text-gray-500")}>D+{e.daysMissing}</span>}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-50">{e.price != null ? peso(e.price) : "—"}</td>
                <td className="px-2 py-2 text-center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-300 dark:text-gray-600"><path d="M9 6l6 6-6 6" /></svg></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("미노출 D+ 는 마지막 관측 이후 경과일 · 14일 이상이면 단종 유력으로 분류.", "Absent D+ is days since last sighting · 14+ days classified as likely EOL.")}</p>
    </div>
  )
}

function EolModal({ e, onClose }: { e: Ev; onClose: () => void }) {
  const [closing, setClosing] = React.useState(false)
  const close = () => { setClosing(true); setTimeout(onClose, 220) }
  React.useEffect(() => { const k = (ev: KeyboardEvent) => { if (ev.key === "Escape") close() }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k) }, [])
  // 최근 21일 관측 히스토리(노출/미노출)
  const seen = new Set(e.hist.map((h) => h.d))
  const lastDay = dayNum(e.lastSeen)
  const cells = Array.from({ length: 21 }, (_, i) => { const d = new Date((lastDay - (20 - i)) * 86400000).toISOString().slice(0, 10); return seen.has(d) })
  // 가격 스파크라인
  const pts = e.hist.map((h) => h.net).filter((v): v is number => v != null)
  const spark = () => {
    if (pts.length < 2) return null
    const w = 180, h = 44, pad = 3, min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1
    const d = pts.map((v, i) => (i ? "L" : "M") + (pad + (i / (pts.length - 1)) * (w - 2 * pad)).toFixed(1) + " " + (pad + (1 - (v - min) / rng) * (h - 2 * pad)).toFixed(1)).join(" ")
    return <svg width={w} height={h} className="mt-1.5"><path d={d} fill="none" stroke="#4f46e5" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
  }
  const KV = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 dark:border-gray-800/60 py-1.5 last:border-0"><span className="text-[11.5px] text-gray-400 dark:text-gray-500">{k}</span><span className="text-[12.5px] font-semibold tabular-nums text-gray-800 dark:text-gray-100">{v}</span></div>
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-md" style={{ animation: closing ? "veilOut .22s ease both" : "veilIn .22s ease both" }} onClick={close}>
      <div className="relative flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06] shadow-2xl dark:bg-gray-900 dark:ring-white/10" style={{ animation: closing ? "popOut .22s ease both" : "popIn .44s cubic-bezier(.34,1.42,.64,1) both" }} onClick={(ev) => ev.stopPropagation()}>
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {e.kind === "new" ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">＋ {T("신제품", "New")}</span> : <span className={"rounded px-1.5 py-0.5 text-[10px] font-bold " + STATUS_C[e.status].chip}>EOL · {e.status}</span>}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{e.cat}</span>
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">{T("신뢰도 ", "Confidence ")}{e.conf}</span>
            <button type="button" onClick={close} aria-label={T("닫기", "Close")} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] active:scale-90 dark:bg-white/10"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </div>
          <h3 className="mt-2 text-[16px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">{e.brand} {e.model}</h3>
        </div>
        <div className="grid gap-5 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("관측 히스토리 · 최근 21일", "Observation history · last 21 days")}</p>
            <div className="mt-2 flex flex-wrap gap-1">{cells.map((on, i) => <span key={i} className={"h-2 w-2 rounded-sm " + (on ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700")} />)}</div>
            <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-gray-400 dark:text-gray-500"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" />{T("노출", "Seen")}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-200 dark:bg-gray-700" />{T("미노출", "Absent")}</span></div>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("가격 추이", "Price trend")}</p>
            {pts.length >= 2 ? spark() : <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">{T("관측 이력 축적 중", "Accumulating observations")}</p>}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("감지 상세", "Detection")}</p>
            <KV k={T("상태", "Status")} v={e.kind === "new" ? T("신제품", "New") : e.status} />
            <KV k={T("최초 관측", "First seen")} v={md(e.firstSeen)} />
            <KV k={e.kind === "new" ? T("등장가", "Launch") : T("최종 관측", "Last seen")} v={e.kind === "new" ? peso(e.price) : md(e.lastSeen)} />
            <KV k={e.kind === "new" ? T("노출 채널", "Channels") : T("미노출", "Absent")} v={e.kind === "new" ? e.channels + T("개 거래선", " dealers") : "D+" + e.daysMissing} />
            <KV k={T("등록가", "Price")} v={e.price != null ? peso(e.price) : "—"} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 px-6 py-3.5">
          <span className="text-[11.5px] text-gray-400 dark:text-gray-500">{T("v_competitor_daily 관측 기반", "Based on v_competitor_daily observations")}</span>
          <button type="button" onClick={close} className="rounded-lg bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-95">{e.kind === "new" ? T("대응 검토 등록", "Log for review") : T("EOL 확정 처리", "Confirm EOL")}</button>
        </div>
      </div>
    </div>
  )
}
