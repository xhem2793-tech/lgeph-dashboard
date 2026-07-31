"use client"

import React, { useEffect, useState } from "react"
import { macroMonthly, upcomingAgenda, seaCompare, marketEstimates, regionMetric } from "@/lib/supabase"
import type { AgendaItem, CalEvent } from "@/lib/supabase"
import EventModal from "@/components/EventModal"
import type { MktEst } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"
import { ChartCard, Lg, SLine, fmtLabels } from "@/components/EconChart"
import GdpComposition from "@/components/GdpComposition"

/** 주요 지표 카테고리 뷰 — 전부 Supabase(macro_indicators, geo_level=national) 실측.
 *  환율(FxView)과 동일한 차트(평소 선만·호버 점·핵심요약 애니메이션) + 의미 + AI 분석(LGE-PH 관점) + 출처.
 *  각 카드는 지표 1~3계열을 한 축에 겹쳐 그림. 창(1Y/2Y/전체) 토글 공용. */

type Mon = Record<string, { dates: string[]; values: number[] }>
const WIN = [{ k: "1Y", n: 1 }, { k: "2Y", n: 2 }, { k: "5Y", n: 5 }, { k: "전체", n: 10 }] // n=표시 기간(년) · 전체=10년 기준

// 시리즈 팔레트(환율과 동일 계열)
const C = { ind: "#6366f1", rose: "#dc2626", blue: "#0284c7", emer: "#059669", amber: "#d99400", violet: "#7c3aed", teal: "#0f766e", brown: "#a1795b" }
// 배너 한 줄 요약용 숫자 포맷
const f1 = (v?: number) => (v == null ? "–" : v.toFixed(1))
const f0 = (v?: number) => (v == null ? "–" : v.toFixed(0))
const B = (s: React.ReactNode) => <b className="font-semibold text-gray-900 dark:text-gray-50">{s}</b> // 값 강조

type Spec = { key: string; name: string; color: string; w?: number; tf?: (v: number) => number; endLabel?: string }
/** 여러 지표를 한 카드에 정렬해 SLine[] + labels 생성. 시계열(2점 이상)만 라인으로.
 *  windowYears = 표시 기간(년). 포인트 수가 아니라 **실제 시간** 기준으로 잘라 분기·연간·월별이 섞여도 토글이 일관됨. */
function build(d: Mon, windowYears: number, specs: Spec[]): { series: SLine[]; labels: string[] } {
  const present = specs.filter((s) => d[s.key] && d[s.key].values.length >= 2) // 1점짜리는 라인 불가 → 제외(KPI 타일로 대체)
  if (!present.length) return { series: [], labels: [] }
  // 날짜 합집합을 공용 축으로 — 시리즈마다 축이 달라도(연간+분기 혼합 등) 라벨과 값이 어긋나지 않게 정렬. 결측은 NaN(선 끊김)
  const dateSet = new Set<string>()
  present.forEach((s) => d[s.key].dates.forEach((dt) => dateSet.add(dt)))
  const allDates = Array.from(dateSet).sort()
  // 최신 날짜 기준 windowYears 만큼만(오른쪽=실제 최신, 억지로 미래월 고정 안 함). 너무 적으면 최소 2점 보장
  const latest = allDates[allDates.length - 1]
  const cutoff = (Number(latest.slice(0, 4)) - windowYears) + latest.slice(4) // "YYYY-MM-DD" 문자열 비교
  let axis = allDates.filter((dt) => dt >= cutoff)
  if (axis.length < 2) axis = allDates.slice(-Math.min(2, allDates.length))
  const series = present.map((s) => {
    const m = new Map(d[s.key].dates.map((dt, i) => [dt, d[s.key].values[i]]))
    return { name: s.name, color: s.color, w: s.w, endLabel: s.endLabel, data: axis.map((dt) => { const v = m.get(dt); return v == null ? NaN : (s.tf ? s.tf(v) : v) }) }
  })
  const labels = fmtLabels(axis)
  return { series, labels }
}

// ── 최신값 KPI 타일(시계열이 짧아 차트 불가한 지표도 전부 연결) ─────────────
type KpiDef = { key: string; label: string; fmt: (v: number) => string; tone?: "rose" | "emerald" | "amber" }
function latestOf(d: Mon, key: string): { v: number; date: string } | null {
  const g = d[key]; if (!g || !g.values.length) return null
  return { v: g.values[g.values.length - 1], date: g.dates[g.dates.length - 1] }
}
function useMacro(keys: string[]) {
  const [d, setD] = useState<Mon>({})
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { macroMonthly(keys, 132).then((r) => { setD(r); setLoaded(true) }).catch(() => setLoaded(true)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { d, loaded }
}

// ── 접이식 배너 — 현재 지표값을 녹인 한 줄 요약(펼치면 LG 관점) ────────────
type Kv = Record<string, number>
type BannerDef = { headline: React.ReactNode; lg?: React.ReactNode; summary?: (kv: Kv, asOf: string) => React.ReactNode }
function Banner({ headline, lg, summary, d, kpiDefs }: BannerDef & { d: Mon; kpiDefs?: KpiDef[] }) {
  const [open, setOpen] = useState(false)
  const items = (kpiDefs ?? []).map((k) => ({ ...k, cur: latestOf(d, k.key) })).filter((k) => k.cur)
  const kv: Kv = {}; let asOf = ""
  items.forEach((k) => { kv[k.key] = k.cur!.v; if (!asOf || k.cur!.date > asOf) asOf = k.cur!.date })
  const now = new Date(); const nowLbl = String(now.getFullYear()).slice(2) + "." + (now.getMonth() + 1) // 현재 월 기준(지표가 과거여도)
  const line = summary && items.length ? summary(kv, asOf) : headline
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 dark:from-indigo-500/10 via-indigo-50/40 dark:via-transparent to-white dark:to-gray-900 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer select-none items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></svg>
        </div>
        <div className="min-w-0 flex-1 text-[15px] leading-snug text-gray-700 dark:text-gray-200">{line}</div>
        <span className="shrink-0 text-[12px] text-gray-400 dark:text-gray-500">{nowLbl} 기준</span>
        {lg && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-400 dark:text-indigo-300 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>}
      </div>
      {lg && (
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
          <div className="overflow-hidden">
            <div className="border-t border-indigo-100/70 dark:border-indigo-500/25 px-4 pb-3.5 pt-3">
              <p className="flex items-start gap-1.5 text-[14.5px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                <span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[11.5px] font-bold text-white">LG 관점</span>
                <span>{lg}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 우측 위젯: 경제 일정 (모든 카테고리 공통 위젯 하나) ────────────────────
export function AgendaCard() {
  // 캘린더 페이지 우측 '예정 일정'과 동일 소스(upcomingAgenda) — 완전 동기화.
  const [ev, setEv] = useState<AgendaItem[]>([])
  const [sel, setSel] = useState<CalEvent | null>(null) // 클릭 시 캘린더 페이지와 동일 상세 팝업
  useEffect(() => { upcomingAgenda().then(setEv).catch(() => setEv([])) }, [])
  if (!ev.length) return null
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dday = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - today0) / 86400000)
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both", animationDelay: "80ms" }}>
      <header className="flex items-baseline justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5">
        <h2 className="text-[18px] font-bold tracking-tight text-gray-900 dark:text-gray-50">예정 일정</h2>
        <span className="text-[13px] text-gray-400 dark:text-gray-500">2주간</span>
      </header>
      <div className="mt-2 flex flex-col">
        {ev.map((x, i) => {
          const dd = dday(x.date)
          return (
            <div key={x.label + x.date} onClick={() => x.ev && setSel(x.ev)} style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both", animationDelay: 40 + i * 24 + "ms" }} className={"flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-all duration-200 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10 " + (x.ev ? "cursor-pointer hover:-translate-y-px active:scale-[.99]" : "")}>
              <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + x.dot} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-gray-900 dark:text-gray-50">{x.label}</span>
                <span className="block text-[12.5px] text-gray-500 dark:text-gray-400">{x.note}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[13px] font-semibold text-gray-500 dark:text-gray-400">{dd === 0 ? "오늘" : dd > 0 ? "D-" + dd : "D+" + -dd}</span>
            </div>
          )
        })}
      </div>
      {sel && <EventModal event={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

// ── 공용 셸 — 환율 페이지와 동일 레이아웃(배너 + 좌 차트 | 우 위젯 286px) ──
type Section = { key: string; label: string; node: React.ReactNode }
// 도메인별 액센트 바(퍼지-세이프 전체 클래스)
const BARCLS: Record<string, string> = { indigo: "bg-indigo-500", blue: "bg-blue-500", violet: "bg-violet-500", amber: "bg-amber-500", emerald: "bg-emerald-500", teal: "bg-teal-500", rose: "bg-rose-500" }
function Shell({ title, sub, win, setWin, loaded, empty, banner, kpiDefs, d, children, sections, accent = "indigo" }: { title: string; sub: string; win: string; setWin: (k: string) => void; loaded: boolean; empty: boolean; banner?: BannerDef; kpiDefs?: KpiDef[]; d: Mon; children?: React.ReactNode; sections?: Section[]; accent?: string }) {
  const [activeSub, setActiveSub] = useState(sections?.[0]?.key ?? "")
  const curSub = sections?.find((s) => s.key === activeSub) ?? sections?.[0]
  // 적응형 토글 — 뷰의 실제 데이터 기간(년)보다 긴 창은 숨김(5년치 데이터 없는데 5Y 토글 노출 방지)
  // 기간 토글은 전 뷰 동일하게 1Y/2Y/5Y/전체(10Y) 고정 노출(데이터 부족해도 있는 만큼 표시)
  const winOpts = WIN
  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      {banner && <Banner {...banner} d={d} kpiDefs={loaded ? kpiDefs : undefined} />}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
          <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className={"h-[18px] w-1 rounded " + (BARCLS[accent] || BARCLS.indigo)} />
            <h2 className="text-[19px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h2>
            <span className="text-[13px] font-semibold text-gray-400 dark:text-gray-500">{sub}</span>
            <span className="ml-auto">
              <Segmented size="sm" value={win} onChange={setWin} options={winOpts.map((w) => ({ k: w.k, label: w.k }))} />
            </span>
          </header>
          {loaded && !empty && sections && sections.length > 1 && (
            <nav className="mb-3.5 flex flex-wrap gap-1.5">
              {sections.map((s) => (
                <button key={s.key} type="button" onClick={() => setActiveSub(s.key)}
                  className={"rounded-full border px-2 py-0.5 text-[13px] font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 " + (activeSub === s.key ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400")}>
                  {s.label}
                </button>
              ))}
            </nav>
          )}
          {!loaded ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" />)}
            </div>
          ) : empty ? (
            <div className="flex h-52 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 text-center">
              <div className="text-[16px] font-bold text-gray-500 dark:text-gray-400">데이터 적재 대기</div>
              <div className="text-[14px] text-gray-400 dark:text-gray-500">해당 지표가 아직 Supabase에 없음 · 수집 후 자동 표시</div>
            </div>
          ) : (
            <div key={activeSub} className="grid items-stretch gap-4 sm:grid-cols-2" style={{ animation: "fadeUp .35s cubic-bezier(.16,1,.3,1) both" }}>{sections ? curSub?.node : children}</div>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <AgendaCard />
        </aside>
      </div>
      <p className="text-[13px] leading-relaxed text-gray-400 dark:text-gray-500">출처 PSA·BSP 공식통계(Supabase macro_indicators) · 색=사업영향(원가·부담↑ rose, 수요·구매력↑ emerald)</p>
    </div>
  )
}

const src = (s: string) => (<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> {s}</>)

// ══════════════════════════════════════════════════════════════════════
// 가전 선행지표 — PPI·수입·가전물가·전기료
// ══════════════════════════════════════════════════════════════════════
const APPLIANCE_KEYS = ["PPI_domestic_appliances", "PPI_electrical", "PPI_electronics", "PPI_manufacturing", "imports_home_appliances", "imports_consumer_electronics", "imports_telecom", "INF_household_appliances", "INF_aircon", "INF_all_items", "meralco_residential_rate", "appl_own_ref", "appl_own_wash", "appl_own_tv", "appl_own_cool", "appl_own_mobile", "cdd_monthly", "temp_monthly", "energy_households", "appliance_market_usd", "appliance_market_cagr", "ecommerce_market_usd", "ecommerce_weekly_pct", "elec_consumption_pc", "elec_access_pct"]
// UN Comtrade 필리핀 가전 수입(HS 8415 에어컨·8418 냉장고·8450 세탁기·8528 TV/모니터) 2015~2024 · 백만$·원산지%(4품목 합산)
const HS_YRS = ["'15", "'16", "'17", "'18", "'19", "'20", "'21", "'22", "'23", "'24"]
const HS_TOTALS: Record<string, number[]> = { ac: [205, 329, 371, 398, 466, 358, 376, 458, 531, 666], ref: [245, 331, 358, 387, 426, 380, 428, 452, 452, 501], tv: [176, 338, 399, 471, 466, 382, 460, 418, 373, 383], wash: [43, 78, 102, 128, 120, 95, 128, 149, 159, 178] }
const HS_ORIGIN: Record<string, number[]> = { cn: [28.9, 27, 29.7, 35.1, 37.8, 41.8, 44.3, 43.2, 44.1, 48.7], th: [19.4, 16.3, 16.4, 15.6, 16.4, 16.1, 16.4, 17.5, 15.5, 14], vn: [4.8, 13, 12.8, 10.2, 9.6, 10.8, 12, 12.1, 12.8, 11.4], kr: [3.9, 6.7, 5.2, 4.4, 4.1, 2.9, 2.5, 2.6, 3, 3.1] }
// 품목별 원산지 점유%(4대 원산지) — 제품 필터 연동용
const HS_ORIGIN_CAT: Record<string, Record<string, number[]>> = {
  ref: { cn: [32.3, 35.0, 39.5, 43.6, 43.9, 47.1, 54.9, 53.9, 55.4, 57.5], th: [26.6, 20.5, 16.9, 14.0, 15.3, 13.3, 12.3, 14.1, 12.2, 13.1], vn: [0.4, 3.1, 8.4, 9.8, 9.7, 10.2, 8.3, 11.8, 11.5, 11.6], kr: [3.3, 5.4, 4.3, 3.6, 3.2, 2.5, 2.9, 1.8, 2.2, 2.2] },
  ac: { cn: [27.4, 29.8, 26.1, 30.2, 40.1, 39.3, 36.5, 34.2, 40.9, 48.9], th: [22.7, 24.8, 30.4, 32.1, 31.3, 34.4, 40.6, 37.2, 28.2, 22.0], vn: [6.5, 4.5, 4.3, 3.0, 0.4, 0.0, 0.1, 0.1, 0.1, 0.1], kr: [5.2, 7.8, 6.5, 5.5, 4.9, 3.9, 2.5, 2.7, 3.4, 3.5] },
  wash: { cn: [53.1, 39.1, 36.7, 36.8, 42.3, 44.7, 49.8, 53.6, 51.1, 53.4], th: [25.4, 29.9, 25.3, 23.5, 24.0, 22.3, 17.7, 15.7, 17.6, 14.8], vn: [3.8, 9.8, 10.9, 13.2, 15.3, 18.0, 20.7, 18.7, 15.6, 19.5], kr: [2.2, 7.2, 8.1, 9.4, 8.6, 6.1, 5.3, 6.5, 8.7, 9.6] },
  tv: { cn: [20.1, 13.6, 22.5, 31.8, 28.9, 38.2, 39.2, 37.6, 32.1, 34.8], th: [3.9, 0.8, 0.6, 0.7, 0.5, 0.3, 0.2, 0.4, 0.4, 0.9], vn: [9.2, 31.8, 25.3, 15.7, 17.3, 19.7, 22.8, 23.1, 31.3, 26.8], kr: [3.8, 6.8, 4.2, 2.9, 2.9, 1.6, 1.3, 2.0, 1.0, 0.5] },
}
const PROD_HS: Record<string, string> = { "냉장고": "ref", "세탁·건조": "wash", "에어컨(RAC)": "ac", "공조(B2B)": "ac", "TV·AV": "tv", "모니터·사이니지": "tv" }
// 가전 시장규모·이커머스 — 다중기관 추정 범위 + 근거(백데이터). 단일 숫자 아닌 삼각검증.
function MarketCard() {
  const [appl, setAppl] = useState<MktEst[]>([])
  const [ec, setEc] = useState<MktEst[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => { marketEstimates("appliance_market").then(setAppl).catch(() => {}); marketEstimates("ecommerce").then(setEc).catch(() => {}) }, [])
  if (!appl.length && !ec.length) return null
  const rng = (a: MktEst[]) => { const v = a.map((x) => x.value).sort((x, y) => x - y); return v.length ? { lo: v[0], hi: v[v.length - 1], med: v[Math.floor(v.length / 2)], n: v.length } : null }
  const ra = rng(appl.filter((x) => x.scope !== "주방가전만")), re = rng(ec)
  return (
    <div className="relative z-0 col-span-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">가전시장·이커머스 규모 (다중기관 추정)</h3>
        <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">추정·민간자료</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="ml-auto text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{open ? "근거 접기" : `근거 ${appl.length + ec.length}건 ▾`}</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ra && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
            <p className="text-[13px] text-gray-400 dark:text-gray-500">가전시장 규모(추정 범위, {ra.n}개 기관)</p>
            <p className="text-[26px] font-extrabold tabular-nums text-gray-900 dark:text-gray-50">${ra.lo.toFixed(1)}~{ra.hi.toFixed(1)}<span className="text-[14px] font-semibold text-gray-400">B</span> <span className="text-[14px] font-medium text-gray-400">중앙값 ${ra.med.toFixed(1)}B</span></p>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">주요 3사 Panasonic·Samsung·LG · 전자매장 47% · <b className="text-indigo-600 dark:text-indigo-400">LG ThinQ 프리미엄 50%</b></p>
          </div>
        )}
        {re && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
            <p className="text-[13px] text-gray-400 dark:text-gray-500">이커머스 규모(추정 범위, {re.n}개 기관)</p>
            <p className="text-[26px] font-extrabold tabular-nums text-gray-900 dark:text-gray-50">${re.lo.toFixed(1)}~{re.hi.toFixed(1)}<span className="text-[14px] font-semibold text-gray-400">B</span> <span className="text-[14px] font-medium text-gray-400">중앙값 ${re.med.toFixed(1)}B</span></p>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">주간 온라인구매 57% · Shopee·Lazada 양강 · 가전 온라인 침투 확대</p>
          </div>
        )}
      </div>
      {open && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[12px] uppercase text-gray-400 dark:text-gray-500"><th className="px-3 py-1.5">지표</th><th className="px-2 py-1.5">기관</th><th className="px-2 py-1.5 text-right">추정값</th><th className="px-2 py-1.5">범위/비고</th><th className="px-2 py-1.5 text-right">원본</th></tr></thead>
            <tbody>
              {[...appl, ...ec].map((e, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{e.metric === "ecommerce" ? "이커머스" : "가전시장"}</td>
                  <td className="px-2 py-1.5 font-medium text-gray-800 dark:text-gray-100">{e.source}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-800 dark:text-gray-100">${e.value}B{e.cagr ? ` · CAGR ${e.cagr}%` : ""}</td>
                  <td className="px-2 py-1.5 text-gray-400 dark:text-gray-500">{e.note || e.scope || "—"}</td>
                  <td className="px-2 py-1.5 text-right">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">↗</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 민간 리서치는 기관별 편차가 커 <b className="text-amber-600 dark:text-amber-400">단일 숫자보다 범위·중앙값</b>으로 판단 — 방향성(연 7%대 성장·프리미엄/온라인 확대)은 일치. 정밀 규모는 내부 셀아웃·GfK 실측 연동 시 확정.</p>
      <div className="mt-2 pt-1 text-[12px] text-gray-400 dark:text-gray-500">{src("Grand View Research·Statista·IMARC·Mordor·GII 등 다중기관 · 민간자료(추정)")}</div>
    </div>
  )
}
// 단면(cross-sectional) 바 카드 — 보유율·연령구조 등 시점 스냅샷용 공용
function CrossBarCard({ d, items, title, seg, unit, meaning, ai, source, sort = true }: { d: Mon; items: { key: string; name: string }[]; title: string; seg: string; unit: string; meaning: React.ReactNode; ai: React.ReactNode; source: string; sort?: boolean }) {
  let rows = items.map((it) => ({ ...it, v: latestOf(d, it.key)?.v ?? 0 })).filter((r) => r.v > 0)
  if (sort) rows = rows.sort((a, b) => b.v - a.v)
  if (!rows.length) return null
  return (
    <div className="relative z-0 flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{seg}</span>
        <span className="ml-auto shrink-0 text-[12.5px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px] text-gray-600 dark:text-gray-300">{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              <div className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-indigo-500 to-indigo-400" style={{ width: r.v + "%", transition: "width .8s cubic-bezier(.16,1,.3,1) " + (i * 0.06) + "s" }} />
            </div>
            <span className="w-11 shrink-0 text-right text-[14px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{r.v.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 min-h-[34px] text-[13px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {meaning}</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">LG 인사이트</b> {ai}</p></div>
      <div className="mt-auto pt-2.5 text-[12px] text-gray-400 dark:text-gray-500">{src(source)}</div>
    </div>
  )
}
// 가전 보유율(침투율) — PSA 2020 센서스 단면. 낮을수록 성장여력↑
const OWN_ITEMS: { key: string; name: string }[] = [
  { key: "appl_own_cool", name: "냉방·선풍기" }, { key: "appl_own_tv", name: "TV" },
  { key: "appl_own_ref", name: "냉장고" }, { key: "appl_own_wash", name: "세탁기" }, { key: "appl_own_mobile", name: "휴대폰" },
]
function OwnershipCard({ d }: { d: Mon }) {
  const rows = OWN_ITEMS.map((it) => ({ ...it, v: latestOf(d, it.key)?.v ?? 0 })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v)
  if (!rows.length) return null
  return (
    <div className="relative z-0 flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">가전 보유율 (침투율)</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">CE</span>
        <span className="ml-auto shrink-0 text-[12.5px] font-medium text-gray-400 dark:text-gray-500">가구 % · 2020</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px] text-gray-600 dark:text-gray-300">{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              <div className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-indigo-500 to-indigo-400" style={{ width: r.v + "%", transition: "width .8s cubic-bezier(.16,1,.3,1) " + (i * 0.06) + "s" }} />
            </div>
            <span className="w-11 shrink-0 text-right text-[14px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{r.v.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 min-h-[34px] text-[13px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 가구 보유율 = 시장 침투율. <b className="font-semibold text-emerald-600 dark:text-emerald-400">냉장고 46%·세탁기 43% = 성장여력 최대</b> (미보유 과반)</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">LG 인사이트</b> 저침투(냉장고·세탁기)는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">초도수요 헤드룸 = 보급형 볼륨존</b>, 고침투(TV·냉방)는 교체·프리미엄 업그레이드 시장</p></div>
      <div className="mt-auto pt-2.5 text-[12px] text-gray-400 dark:text-gray-500">{src("PSA 2020 인구주택총조사 · 가구편의")}</div>
    </div>
  )
}
// 지역 짧은 라벨 — "Region IV-A (...)"→RIV-A, "National Capital Region (NCR)"→NCR 등
const shortRegion = (g: string) => {
  const rm = g.match(/^Region ([\dIVX]+-?[AB]?)/); if (rm) return "R" + rm[1]
  const pm = g.match(/\(([^)]+)\)/); if (pm) return pm[1].replace(/\s*Region$/, "")
  return g.replace(/\s*Region$/, "").slice(0, 10)
}
// 지역별 가전 보유율(침투 격차) — 냉장고·TV 17개 지역. 전국 하회 = 침투 여력(기회).
function RegionOwnCard() {
  const [ap, setAp] = useState<"ref" | "tv">("ref")
  const [data, setData] = useState<Record<string, Record<string, number>>>({})
  useEffect(() => { regionMetric(["appl_own_ref_region", "appl_own_tv_region"]).then(setData).catch(() => {}) }, [])
  const key = ap === "ref" ? "appl_own_ref_region" : "appl_own_tv_region"
  const nat = ap === "ref" ? 46.2 : 75.7
  const rows = Object.entries(data[key] || {}).map(([g, v]) => ({ g, v, s: shortRegion(g) })).sort((a, b) => a.v - b.v)
  if (!rows.length) return null
  const max = Math.max(...rows.map((r) => r.v), nat, 1)
  const low = rows[0], high = rows[rows.length - 1]
  return (
    <div className="col-span-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">지역별 보유율 (침투 격차)</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">CE</span>
        <span className="ml-1 inline-flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 text-[13px] font-semibold">
          {([["ref", "냉장고"], ["tv", "TV"]] as const).map(([k, lbl]) => <button key={k} type="button" onClick={() => setAp(k)} className={"px-2.5 py-1 transition-colors " + (ap === k ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/15")}>{lbl}</button>)}
        </span>
        <span className="ml-auto shrink-0 text-[12.5px] font-medium text-gray-400 dark:text-gray-500">가구 % · 2022 · 전국 {nat}%</span>
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {rows.map((r, i) => { const below = r.v < nat
          return (
            <div key={r.g} className="flex items-center gap-2" title={`${r.g} · ${r.v}%`}>
              <span className="w-12 shrink-0 truncate text-right text-[12.5px] font-medium text-gray-500 dark:text-gray-400">{r.s}</span>
              <span className="relative h-4 min-w-0 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                <span className="block h-full rounded" style={{ width: (r.v / max * 100) + "%", background: below ? C.amber : C.ind, animation: "growX .6s cubic-bezier(.16,1,.3,1) both", animationDelay: (0.05 + i * 0.02) + "s", transformOrigin: "left center" }} />
                <span className="absolute inset-y-0" style={{ left: (nat / max * 100) + "%", width: "1px", background: "rgba(120,120,140,.55)" }} />
              </span>
              <span className={"w-8 shrink-0 text-right text-[12.5px] font-semibold tabular-nums " + (below ? "text-amber-600 dark:text-amber-400" : "text-gray-700 dark:text-gray-200")}>{r.v}%</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 지역별 가구 보유율 — <b className="text-amber-600 dark:text-amber-400">전국({nat}%) 하회(주황) = 침투 여력</b>, 세로선=전국 평균</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">LG 인사이트</b> {ap === "ref" ? "냉장고" : "TV"} 최저 <b className="font-semibold text-amber-600 dark:text-amber-400">{low.s}({low.v}%)</b> vs 최고 {high.s}({high.v}%) — <b className="font-semibold text-emerald-600 dark:text-emerald-400">저침투 지역(민다나오·MIMAROPA·비콜)은 보급형 볼륨존·유통망 확대 기회</b>, 고침투 지역(NCR·루손)은 교체·프리미엄 중심. 전기보급·소득과 함께 저침투 지역이 다음 성장축.</p></div>
      <p className="mt-2.5 border-t border-gray-100 dark:border-gray-800 pt-2 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> PSA 2022 가구 가전 보유(지역별) · 전국=2020 인구주택총조사</p>
    </div>
  )
}
const PRODS = ["전체", "냉장고", "세탁·건조", "에어컨(RAC)", "TV·AV", "공조(B2B)", "모니터·사이니지"]
export function ApplianceView() {
  const [win, setWin] = useState("2Y")
  const [prod, setProd] = useState("전체")
  const { d, loaded } = useMacro(APPLIANCE_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  // 제품 필터 — '전 제품' 태그(원가·수입·전기 등 공통지표)는 항상 표시, 제품특정 지표는 해당 제품 선택 시만
  const show = (tags: string[]) => prod === "전체" || tags.includes("전 제품") || tags.includes(prod)
  const ppi = build(d, n, [{ key: "PPI_domestic_appliances", name: "가전 PPI", color: C.ind, w: 2 }, { key: "PPI_electrical", name: "전기기기", color: C.rose }, { key: "PPI_electronics", name: "전자", color: C.blue }, { key: "PPI_manufacturing", name: "제조업 전체", color: C.brown }])
  const imp = build(d, n, [{ key: "imports_home_appliances", name: "가전", color: C.ind, w: 2, tf: (v) => v / 1e6 }, { key: "imports_consumer_electronics", name: "소비자전자", color: C.rose, tf: (v) => v / 1e6 }, { key: "imports_telecom", name: "통신기기", color: C.blue, tf: (v) => v / 1e6 }]) // USD→백만$ (연간 무역통계)
  const inf = build(d, n, [{ key: "INF_household_appliances", name: "가전 물가", color: C.ind, w: 2 }, { key: "INF_aircon", name: "에어컨", color: C.rose }, { key: "INF_all_items", name: "전체 CPI", color: C.brown }])
  const elec = build(d, n, [{ key: "meralco_residential_rate", name: "가정용 전기료", color: C.ind, w: 2 }])
  const cdd = build(d, n, [{ key: "cdd_monthly", name: "냉방도일 CDD", color: C.rose, w: 2 }]) // 에어컨 수요 선행
  const energy = build(d, n, [{ key: "energy_households", name: "가정용 에너지소비", color: C.ind, w: 2 }]) // ktoe, 연간
  const elecpc = build(d, n, [{ key: "elec_consumption_pc", name: "1인당 전력소비", color: C.ind, w: 2 }]) // kWh/인, 연간
  const empty = !ppi.series.length && !imp.series.length && !inf.series.length && !elec.series.length && !cdd.series.length
  return (
    <Shell title="가전 선행지표" sub="생산자물가·수입액·가전물가·전기료 — 원가·공급 선행" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="teal"
      banner={{ summary: (kv) => <>가전 물가 {B(f1(kv.INF_household_appliances) + "%")}·에어컨 {B(f1(kv.INF_aircon) + "%")}·가전 PPI {B(f1(kv.PPI_domestic_appliances) + "%")}, 전기료 {B("₱" + f1(kv.meralco_residential_rate))} — {(kv.PPI_domestic_appliances ?? 0) > 2 ? "원가·소매가 상방 압박" : "원가·가전물가 안정 국면"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">가전 원가·공급 선행지표</b></>, lg: <>PPI·수입 급등은 원가·중국계 물량 신호 → <b className="font-semibold">조달 헤지·프로모 타이밍</b> 선제 대응 · 전기료↑엔 고효율 프리미엄 소구</> }}
      kpiDefs={[
        { key: "INF_household_appliances", label: "가전 물가 YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_aircon", label: "에어컨 물가 YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "PPI_domestic_appliances", label: "가전 PPI YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "meralco_residential_rate", label: "전기료", fmt: (v) => "₱" + v.toFixed(2), tone: "amber" },
      ]}>
      {false && <MarketCard />}
      <div className="col-span-full -mt-1 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[12.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">제품</span>
        {PRODS.map((p) => <button key={p} type="button" onClick={() => setProd(p)} className={"rounded-lg px-2.5 py-1 text-[14px] font-semibold transition-all " + (prod === p ? "bg-teal-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-teal-500/15")}>{p}</button>)}
      </div>
      {show(["전 제품"]) && <OwnershipCard d={d} />}
      {false && <RegionOwnCard />}{/* 지역별 보유율 — 지도(RegionMap)에 반영 예정, 잠시 숨김 */}
      {show(["전 제품"]) && ppi.series.length > 0 && (
        <ChartCard seg="전 제품·CE·B2B" title="가전 생산자물가 PPI" unit="전년비 %" labels={ppi.labels} series={ppi.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="가전 PPI" b /><Lg c={C.rose} t="전기기기" /><Lg c={C.blue} t="전자" /><Lg c={C.brown} t="제조업 전체" /></>}
          meaning={<>생산단계 출고가격 상승률 — <b className="text-gray-700 dark:text-gray-200">소비자가·조달원가의 수개월 선행</b></>}
          ai={<>가전 PPI가 제조업 전체보다 높으면 <b className="font-semibold text-rose-600 dark:text-rose-400">가전 특이 원가압력</b> → 선제 판가·조달 대응·부품 헤지, 동행이면 경제 전반 원가 국면</>}
          tone="rose" src={src("PSA 생산자물가지수(PPI) · 월별")} />
      )}
      {show(["전 제품"]) && imp.series.length > 0 && (
        <ChartCard seg="전 제품·CE·B2B" title="가전·전자·통신 수입액" unit="백만$ · 연간" labels={imp.labels} series={imp.series} decimals={0} seriesUnit="백만$"
          legend={<><Lg c={C.ind} t="가전" b /><Lg c={C.rose} t="소비자전자" /><Lg c={C.blue} t="통신기기" /></>}
          meaning={<>가전·인접 카테고리 완제품 수입 규모 — <b className="text-gray-700 dark:text-gray-200">시장 공급량·경쟁 강도 선행</b></>}
          ai={<>수입 급증은 중국계 물량 유입 신호 → <b className="font-semibold text-amber-600 dark:text-amber-400">채널 재고·가격 경쟁 압박</b> · 소비자전자·통신 동반 확대는 스마트홈 연계 수요 신호</>}
          tone="amber" src={src("PSA 수출입통계 · 연간")} />
      )}
      {show(["전 제품", "에어컨(RAC)"]) && inf.series.length > 0 && (
        <ChartCard seg="가전·에어컨" title="가전 소비자물가 상승률" unit="전년비 %" labels={inf.labels} series={inf.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="가전 물가" b /><Lg c={C.rose} t="에어컨" /><Lg c={C.brown} t="전체 CPI" /></>}
          meaning={<>가전 소매물가 상승률 vs 전체 물가 — <b className="text-gray-700 dark:text-gray-200">가전의 실질 가격 매력</b></>}
          ai={<>가전 물가가 전체 CPI보다 낮으면 <b className="font-semibold text-emerald-600 dark:text-emerald-400">실질 저렴 → 구매 매력↑</b>, 높으면 구매 저항 → 보급형·프로모 강화</>}
          tone="rose" src={src("PSA CPI(가전·에어컨) · 전년비")} />
      )}
      {show(["전 제품", "에어컨(RAC)", "냉장고", "공조(B2B)"]) && elec.series.length > 0 && (
        <ChartCard seg="에어컨·냉장고·공조" title="가정용 전기요금 (Meralco)" unit="₱/kWh" labels={elec.labels} series={elec.series} decimals={2}
          legend={<Lg c={C.ind} t="가정용 전기료" b />}
          meaning={<>전기요금 = 가전 <b className="text-gray-700 dark:text-gray-200">사용비용·에너지효율 소구력</b> 결정</>}
          ai={<>전기료 상승기엔 <b className="font-semibold text-emerald-600 dark:text-emerald-400">인버터·고효율 프리미엄 소구</b>가 유리 → 에너지 절감액을 판매 메시지로 전환</>}
          tone="amber" src={src("Meralco 가정용 요금 · 월별")} />
      )}
      {show(["에어컨(RAC)"]) && cdd.series.length > 0 && (
        <ChartCard seg="에어컨" title="냉방도일 (에어컨 수요 선행)" unit="CDD · 월별 · 기준24℃" labels={cdd.labels} series={cdd.series} decimals={0} seriesUnit="CDD"
          legend={<Lg c={C.rose} t="냉방도일 CDD" b />}
          meaning={<>냉방도일 = Σ(일평균기온−24℃) — <b className="text-gray-700 dark:text-gray-200">에어컨·냉장고 사용강도·판매 성수기 직접 선행</b></>}
          ai={<>CDD 급등기(3~5월 혹서)는 <b className="font-semibold text-amber-600 dark:text-amber-400">에어컨·선풍기 판매 성수기</b> → 사전 재고·프로모 집중, 냉방 프리미엄(인버터) 소구 최적 · <b className="text-gray-500 dark:text-gray-400">Open-Meteo 기온</b></>}
          tone="amber" src={src("Open-Meteo 메트로마닐라 기온 · 냉방도일 월집계")} />
      )}
      {show(["전 제품"]) && energy.series.length > 0 && (
        <ChartCard seg="전 제품" title="가정용 에너지소비" unit="ktoe · 연간" labels={energy.labels} series={energy.series} decimals={0} seriesUnit="ktoe"
          legend={<Lg c={C.ind} t="가정용 에너지소비" b />}
          meaning={<>가구부문 최종에너지소비 — <b className="text-gray-700 dark:text-gray-200">가전 사용량·전력화 심화의 구조적 지표</b></>}
          ai={<>가정용 에너지소비 증가는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">가전 보유·사용 심화 = 시장 성숙</b> → 고효율·인버터 소구 여지 확대, 전력화 진전 지역 우선</>}
          tone="emerald" src={src("PSA 에너지통계 부문별 최종소비 · 연간")} />
      )}
      {show(["전 제품"]) && elecpc.series.length > 0 && (
        <ChartCard seg="전 제품" title="1인당 전력소비" unit="kWh/인 · 연간" labels={elecpc.labels} series={elecpc.series} decimals={0} seriesUnit="kWh"
          legend={<Lg c={C.ind} t="1인당 전력소비" b />}
          meaning={<>국민 1인당 연간 전력사용량 — <b className="text-gray-700 dark:text-gray-200">전력화·가전 보유 심화 프록시</b></>}
          ai={<>필리핀 1인당 전력소비는 <b className="font-semibold text-amber-600 dark:text-amber-400">900kWh대로 태국(약 3,000)·말련(약 5,000)의 1/3 이하</b> = <b className="font-semibold text-emerald-600 dark:text-emerald-400">가전 보급·대형화 성장여력이 큰 저변</b>. <b>트렌드</b>: 소득 증가와 함께 완만한 우상향 — 냉장고·에어컨 등 상시가동 가전 확산의 구조적 순풍, 다만 高전기료가 고효율 수요를 동시에 자극.</>}
          tone="emerald" src={src("World Bank WDI 1인당 전력소비(EG.USE.ELEC.KH.PC) · 연간")} />
      )}
      {show(["전 제품", "냉장고", "세탁기", "에어컨(RAC)", "TV"]) && (
        <ChartCard seg="전 제품·CE" title="품목별 가전 수입 규모 (HS)" unit="백만$ · 연간" labels={HS_YRS} series={[{ name: "에어컨", color: C.rose, w: 2, data: HS_TOTALS.ac }, { name: "냉장고", color: C.ind, w: 2, data: HS_TOTALS.ref }, { name: "TV·모니터", color: C.blue, data: HS_TOTALS.tv }, { name: "세탁기", color: C.emer, data: HS_TOTALS.wash }]} decimals={0} seriesUnit="백만$"
          legend={<><Lg c={C.rose} t="에어컨" b /><Lg c={C.ind} t="냉장고" b /><Lg c={C.blue} t="TV·모니터" /><Lg c={C.emer} t="세탁기" /></>}
          meaning={<>HS코드별 완제품 수입액 — <b className="text-gray-700 dark:text-gray-200">품목별 공급 규모·성장</b></>}
          ai={<>에어컨 수입이 <b className="font-semibold text-emerald-600 dark:text-emerald-400">2015 $205M→2024 $666M(3.2배)</b>로 최대·최고성장(냉방수요·기후) → 에어컨 라인 우선순위. 냉장고·세탁기도 견조, TV는 최근 정체. <b>트렌드</b>: 전 품목 우상향, 코로나(2020) 일시 조정 후 회복.</>}
          tone="amber" src={src("UN Comtrade 필리핀 수입액 HS 8415·8418·8450·8528 · 연간")} />
      )}
      {(() => {
        const hcat = PROD_HS[prod] // 전체=집계, 특정 제품=해당 HS 원산지
        const og = hcat ? HS_ORIGIN_CAT[hcat] : HS_ORIGIN
        const scope = hcat ? prod : "4품목 합산"
        const lastKr = og.kr[og.kr.length - 1], lastCn = og.cn[og.cn.length - 1], firstCn = og.cn[0]
        return (
        <ChartCard seg="전 제품·CE·B2B" title={"가전 수입 원산지 점유율" + (hcat ? " · " + prod : "")} unit={"% · 연간(" + scope + ")"} labels={HS_YRS} series={[{ name: "중국", color: C.rose, w: 2.4, data: og.cn }, { name: "태국", color: C.amber, data: og.th }, { name: "베트남", color: C.emer, data: og.vn }, { name: "한국", color: C.ind, w: 2, data: og.kr }]} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.rose} t="중국" b /><Lg c={C.amber} t="태국" /><Lg c={C.emer} t="베트남" /><Lg c={C.ind} t="한국" b /></>}
          meaning={<>{hcat ? prod : "가전"} 수입 원산지 구성 — <b className="text-gray-700 dark:text-gray-200">경쟁 원산지·조달 구조</b>{hcat ? "" : " · 제품 필터로 품목별 전환"}</>}
          ai={<>중국이 <b className="font-semibold text-rose-600 dark:text-rose-400">{firstCn}%→{lastCn}%</b>로 상승, <b className="font-semibold text-rose-600 dark:text-rose-400">한국은 {lastKr}%</b> = {hcat === "wash" ? "세탁기는 그나마 한국 9%대·베트남 급상승(20%)" : hcat === "tv" ? "TV는 베트남(27%)이 중국 다음 2위, 한국 0.5%로 최저" : hcat === "ac" ? "에어컨은 태국(22%)이 중국 다음 조달허브, 한국 3%대" : hcat === "ref" ? "냉장고는 중국 57%로 편중 최고, 한국 2%대 최저" : "필리핀 완제품 시장을 중국계가 장악"}. LG는 <b className="font-semibold">현지·역내(태국·베트남) 생산·조달로 원가·물류 대응</b>하거나 고효율·프리미엄 차별화가 관건.</>}
          tone="rose" src={src("UN Comtrade 원산지별 수입액 · 연간" + (hcat ? " (HS " + ({ ref: "8418", ac: "8415", wash: "8450", tv: "8528" }[hcat]) + ")" : " (4품목 합산)"))} />
        )
      })()}
    </Shell>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 통화·금리·신용 — 정책금리·M3·가계신용
// ══════════════════════════════════════════════════════════════════════
const RATES_KEYS = ["policy_rate_monthly", "BSP_policy_rate", "interbank_call_rate", "m3_growth_yoy", "broad_money_growth", "domestic_credit_pct_gdp", "bank_loan_growth_yoy", "consumer_loan_growth_yoy", "credit_card_loan_growth_yoy", "current_account_pct_gdp", "fdi_net_inflow_usd", "trade_balance_gdp", "exports_gdp", "imports_gdp", "govt_exp_gdp", "reserves_usd", "credit_card_ownership", "debit_card_ownership", "credit_card_used", "borrowed_any_pct", "saved_at_fi_pct", "account_ownership", "govt_debt_gdp", "tax_revenue_gdp", "gross_savings_gdp", "market_cap_gdp", "psei_index", "npl_ratio"]
export function RatesView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(RATES_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const pol = build(d, n, [{ key: "policy_rate_monthly", name: "정책금리 RRP", color: C.ind, w: 2 }, { key: "interbank_call_rate", name: "시장금리(콜)", color: C.rose }]) // 정책금리+시장금리 월별
  const loan = build(d, n, [{ key: "consumer_loan_growth_yoy", name: "소비자대출", color: C.ind, w: 2 }, { key: "bank_loan_growth_yoy", name: "은행 총대출", color: C.blue }])
  const m3 = build(d, n, [{ key: "m3_growth_yoy", name: "광의통화(M3)", color: C.ind, w: 2 }]) // IMF IFS 월별 YoY
  const credit = build(d, n, [{ key: "domestic_credit_pct_gdp", name: "민간신용(%GDP)", color: C.ind, w: 2 }])
  const cab = build(d, n, [{ key: "current_account_pct_gdp", name: "경상수지(%GDP)", color: C.ind, w: 2 }]) // 대외균형, 연간
  const fdi = build(d, n, [{ key: "fdi_net_inflow_usd", name: "FDI 순유입", color: C.emer, w: 2, tf: (v) => v / 1e9 }]) // USD→십억$, 연간
  const trade = build(d, n, [{ key: "exports_gdp", name: "수출", color: C.emer, w: 2 }, { key: "imports_gdp", name: "수입", color: C.rose }, { key: "trade_balance_gdp", name: "무역수지", color: C.ind, w: 2 }]) // %GDP
  const reserves = build(d, n, [{ key: "reserves_usd", name: "외환보유액", color: C.ind, w: 2, tf: (v) => v / 1e9 }]) // USD→십억$
  const govt = build(d, n, [{ key: "govt_exp_gdp", name: "정부지출", color: C.ind, w: 2 }, { key: "services_pct_gdp", name: "서비스업 비중", color: C.emer }]) // %GDP
  const cards = build(d, n, [{ key: "credit_card_ownership", name: "신용카드 보유", color: C.ind, w: 2 }, { key: "debit_card_ownership", name: "직불카드 보유", color: C.blue }, { key: "account_ownership", name: "계좌 보유", color: C.emer }]) // Findex 연간 %
  const finuse = build(d, n, [{ key: "borrowed_any_pct", name: "차입 경험", color: C.rose, w: 2 }, { key: "saved_at_fi_pct", name: "금융기관 저축", color: C.emer }]) // Findex 연간 %
  const fisc = build(d, n, [{ key: "govt_debt_gdp", name: "정부부채", color: C.rose, w: 2 }, { key: "gross_savings_gdp", name: "총저축률", color: C.emer }, { key: "tax_revenue_gdp", name: "조세수입", color: C.ind }]) // %GDP 연간
  const mktcap = build(d, n, [{ key: "market_cap_gdp", name: "주식 시가총액", color: C.ind, w: 2 }]) // %GDP 연간
  const psei = build(d, n, [{ key: "psei_index", name: "PSEi 지수", color: C.ind, w: 2 }]) // 월말 종가, 지수
  const npl = build(d, n, [{ key: "npl_ratio", name: "NPL 비율", color: C.rose, w: 2 }]) // 은행 부실채권비율 %, 연간
  const empty = !pol.series.length && !loan.series.length && !m3.series.length && !credit.series.length && !cab.series.length && !fdi.series.length && !trade.series.length && !reserves.series.length && !govt.series.length
  return (
    <Shell title="통화·금리·신용" sub="기준금리·통화량 M3·가계신용 — 할부·카드 구매력" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="blue"
      banner={{ summary: (kv) => <>정책금리 {B(f1(kv.BSP_policy_rate) + "%")}·M3 {B(f1(kv.m3_growth_yoy) + "%")}, 소비자대출 {B(f1(kv.consumer_loan_growth_yoy) + "%")}·카드 {B(f1(kv.credit_card_loan_growth_yoy) + "%")}·총대출 {B(f1(kv.bank_loan_growth_yoy) + "%")} — {(kv.BSP_policy_rate ?? 9) < 6 ? "금리 인하·신용 확장이 할부 수요 뒷받침" : "고금리로 할부 부담 지속"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">통화·신용 = 가전 구매력 엔진</b></>, lg: <>금리 인하·카드/소비자대출 확장기엔 <b className="font-semibold">무이자 할부·프리미엄 푸시</b>가 유효 · 콜금리 급등 시 유통 운전자금 부담 관찰</> }}
      kpiDefs={[
        { key: "BSP_policy_rate", label: "정책금리 RRP", fmt: (v) => v + "%", tone: "amber" },
        { key: "m3_growth_yoy", label: "통화량 M3", fmt: (v) => v + "%", tone: "emerald" },
        { key: "consumer_loan_growth_yoy", label: "소비자대출", fmt: (v) => v + "%", tone: "emerald" },
        { key: "credit_card_loan_growth_yoy", label: "신용카드 대출", fmt: (v) => v + "%", tone: "emerald" },
        { key: "credit_card_ownership", label: "신용카드 보유율", fmt: (v) => v + "%", tone: "rose" },
      ]}
      sections={[
        { key: "rate_credit", label: "금리·신용", node: <>
      {pol.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="정책금리·시장금리" unit="% · 월별" labels={pol.labels} series={pol.series} decimals={2} seriesUnit="%"
          legend={<><Lg c={C.ind} t="정책금리 RRP" b /><Lg c={C.rose} t="시장금리(콜)" /></>}
          meaning={<>정책금리 vs 시장금리 — <b className="text-gray-700 dark:text-gray-200">할부·소비자 금융비용의 기준·자금시장 긴장도</b></>}
          ai={<>금리 인하기엔 <b className="font-semibold text-emerald-600 dark:text-emerald-400">할부·카드 이자 부담↓ = 가전 구매력↑</b> · 시장금리 급등 시 유통 운전자금 부담 관찰. <b>트렌드</b>: BSP 정책금리 2022~23 급인상(2%→6.5%, 물가·페소 방어) 후 2024말~2025 인하 개시 = 할부 여건 개선 국면 진입.</>}
          tone="amber" src={src("BSP 정책금리(RRP) · IMF IFS 시장금리 · 월별")} />
      )}
      {loan.series.length > 0 && (
        <ChartCard seg="CE" title="가계·기업 대출 증가율" unit="전년비 % · 월별" labels={loan.labels} series={loan.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="소비자대출" b /><Lg c={C.blue} t="은행 총대출" /></>}
          meaning={<>소비자·총대출 증가율 — <b className="text-gray-700 dark:text-gray-200">가전 할부 구매의 직접 재원</b></>}
          ai={<>소비자대출 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">내구재 할부 수요 선행</b> → 신용 확장기에 프리미엄·대형 라인업 푸시</>}
          tone="emerald" src={src("BSP 대출통계(소비자·총대출) · 월별")} />
      )}
      {credit.series.length > 0 && (
        <ChartCard seg="CE" title="민간신용 침투 (% GDP)" unit="% GDP · 연간" labels={credit.labels} series={credit.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="민간신용(%GDP)" b />}
          meaning={<>GDP 대비 민간신용 잔액 — <b className="text-gray-700 dark:text-gray-200">가전 할부·카드 구매의 구조적 여력</b></>}
          ai={<>신용침투는 10년간 28%→50% 확대 = <b className="font-semibold text-emerald-600 dark:text-emerald-400">할부·카드 기반 내구재 구매 여력 구조적 상승</b> → 프리미엄 할부 프로모 지속 유효</>}
          tone="emerald" src={src("World Bank 민간신용(%GDP) · 연간 · 월별 대출증가율은 상단 KPI")} />
      )}
        </> },
        { key: "consumer_fin", label: "소비 금융·결제", node: <>
      {cards.series.length > 0 && (
        <ChartCard seg="CE" title="카드·계좌 보급률" unit="% 성인 · 연간" labels={cards.labels} series={cards.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="신용카드 보유" b /><Lg c={C.blue} t="직불카드 보유" /><Lg c={C.emer} t="계좌 보유" /></>}
          meaning={<>성인 카드·계좌 보유율(Findex) — <b className="text-gray-700 dark:text-gray-200">가전 결제·할부 수단의 구조</b></>}
          ai={<>계좌보유는 27%→50%로 급등했으나 <b className="font-semibold text-rose-600 dark:text-rose-400">신용카드는 3%대로 정체</b> → 카드 무이자할부보다 <b className="font-semibold text-emerald-600 dark:text-emerald-400">리테일러·핀테크 할부(BNPL)·현금·직불 중심</b> 판매금융 설계가 시장 특성에 부합. <b>트렌드</b>: 계좌·카드 모두 2021년 급등(팬데믹 정부지원금 계좌지급·디지털드라이브)했다가 카드는 2024년 반락 — 계좌는 유지, 결제는 e-wallet으로 이동.</>}
          tone="rose" src={src("World Bank Global Findex 카드·계좌 보유율 · 격년(2011~2024)")} />
      )}
      {finuse.series.length > 0 && (
        <ChartCard seg="CE" title="차입·저축 행태" unit="% 성인 · 연간" labels={finuse.labels} series={finuse.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.rose} t="차입 경험" b /><Lg c={C.emer} t="금융기관 저축" /></>}
          meaning={<>성인 차입·저축 경험율(Findex) — <b className="text-gray-700 dark:text-gray-200">가전 구매 자금조달 성향</b></>}
          ai={<>차입율 <b className="font-semibold">72%</b>로 높지만 대부분 <b className="font-semibold text-amber-600 dark:text-amber-400">가족·비공식 채널</b>(카드 3%뿐) → 저축률 상승기·송금 유입기에 대형가전 수요, <b className="font-semibold text-emerald-600 dark:text-emerald-400">유연 할부·계약금 낮춘 상품</b>이 전환 견인. <b>트렌드</b>: 차입율은 2017·2021 하락 후 2024년 72%로 재상승(물가·생활비 압박), 금융기관 저축률은 12%(2017)→24%(2024) 꾸준히 개선.</>}
          tone="emerald" src={src("World Bank Global Findex 차입·저축율 · 격년(2011~2024)")} />
      )}
        </> },
        { key: "fiscal_cap", label: "재정·자본시장", node: <>
      {fisc.series.length > 0 && (
        <ChartCard seg="B2B" title="정부재정 (부채·저축·조세)" unit="% GDP · 연간" labels={fisc.labels} series={fisc.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.rose} t="정부부채" b /><Lg c={C.emer} t="총저축률" /><Lg c={C.ind} t="조세수입" /></>}
          meaning={<>재정 건전성·저축여력 — <b className="text-gray-700 dark:text-gray-200">거시 안정성·중장기 소비기반</b></>}
          ai={<>총저축률 30%대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">내구재 구매 잠재재원</b>. <b>트렌드</b>: 정부부채 2018년 40%까지 하락했다가 <b className="font-semibold text-rose-600 dark:text-rose-400">코로나로 61%(2022) 급등</b> 후 유지 — 조세수입 14%대로 낮아 재정여력 제약, 증세·인프라 지출이 B2B 수요 변수.</>}
          tone="amber" src={src("World Bank WDI(저축·조세) · Bureau of Treasury(부채) · 연간")} />
      )}
      {mktcap.series.length > 0 && (
        <ChartCard seg="B2B" title="주식 시가총액 (자본시장)" unit="% GDP · 연간" labels={mktcap.labels} series={mktcap.series} decimals={0} seriesUnit="%"
          legend={<Lg c={C.ind} t="주식 시가총액(%GDP)" b />}
          meaning={<>상장주식 시총/GDP — <b className="text-gray-700 dark:text-gray-200">자본시장 깊이·자산효과</b></>}
          ai={<>시총/GDP는 <b className="font-semibold text-amber-600 dark:text-amber-400">2007 피크(~70%) 후 하락세(~48%)</b> = 자본시장 상대적 정체 → 소비는 자산효과보다 <b className="font-semibold text-emerald-600 dark:text-emerald-400">소득·송금 의존</b>이 구조적.</>}
          tone="amber" src={src("World Bank WDI 상장주식 시가총액(%GDP) · 연간")} />
      )}
      {psei.series.length > 0 && (
        <ChartCard seg="B2B" title="PSEi 주가지수 (월말)" unit="지수 · 월별" labels={psei.labels} series={psei.series} decimals={0} seriesUnit=""
          legend={<Lg c={C.ind} t="PSEi 종합지수" b />}
          meaning={<>필리핀 증시 종합지수 — <b className="text-gray-700 dark:text-gray-200">투자심리·자산효과·경기 선행</b></>}
          ai={<>PSEi는 <b className="font-semibold text-amber-600 dark:text-amber-400">2015년 7,700선 → 2026년 6,000대</b>로 장기 박스권·정체 = 자산효과 제한적. <b>트렌드</b>: 2020년 코로나 급락(4,000대) 후 회복했으나 고금리·외국인 이탈로 <b className="font-semibold text-rose-600 dark:text-rose-400">2026년 상반기 5,700대까지 재하락</b> 후 반등 — 증시보다 소득·송금이 소비 동력.</>}
          tone="amber" src={src("PSE(필리핀증권거래소) 종합지수 · Yahoo Finance 월말 종가")} />
      )}
      {npl.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="은행 부실채권(NPL) 비율" unit="% · 연간" labels={npl.labels} series={npl.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.rose} t="NPL 비율(총대출 대비)" b />}
          meaning={<>은행 총여신 중 부실채권 비중 — <b className="text-gray-700 dark:text-gray-200">가계·기업 상환능력·금융안정</b></>}
          ai={<>NPL이 <b className="font-semibold text-emerald-600 dark:text-emerald-400">3%대로 낮고 안정</b>이면 은행이 소비자·카드·할부 여신을 공격적으로 늘릴 여력 → <b className="font-semibold">무이자 할부·BNPL 확대에 우호적</b>. <b>트렌드</b>: 팬데믹기 2021년 4%대로 상승했다가 <b className="font-semibold">2025년 3.0%로 안정 복귀</b> — 신용 리스크 완화로 가전 할부 수요 뒷받침. 급등 반전 시 유통 여신·연체 선행 경보로 활용.</>}
          tone="emerald" src={src("World Bank WDI 은행 NPL 비율(FB.AST.NPER.ZS) · 연간")} />
      )}
        </> },
        { key: "money_ext", label: "통화·대외", node: <>
      {m3.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="통화량 M3 증가율" unit="전년비 % · 월별" labels={m3.labels} series={m3.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="광의통화(M3)" b />}
          meaning={<>시중 유동성(M3) 증가율 — <b className="text-gray-700 dark:text-gray-200">소비여력·신용 확대 여지</b></>}
          ai={<>M3 확대는 유동성·소비여력 개선 신호 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">수요 회복 국면</b> 판단의 거시 배경</>}
          tone="emerald" src={src("IMF IFS 광의통화(M3) · 월별 YoY")} />
      )}
      {cab.series.length > 0 && (
        <ChartCard seg="B2B" title="경상수지 (% GDP)" unit="% GDP · 연간" kind="bar" labels={cab.labels} series={cab.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="경상수지(%GDP)" b />}
          meaning={<>대외 경상수지 균형 — <b className="text-gray-700 dark:text-gray-200">페소 환율·수입원가의 구조적 압력</b></>}
          ai={<>경상수지 적자 확대는 <b className="font-semibold text-amber-600 dark:text-amber-400">페소 약세·수입 가전 원가 상승 압력</b> → 조달 헤지·판가 방어 점검, 흑자 전환 시 원가 여유</>}
          tone="amber" src={src("BSP·World Bank 경상수지(%GDP) · 연간")} />
      )}
      {fdi.series.length > 0 && (
        <ChartCard seg="B2B" title="외국인직접투자 순유입 (FDI)" unit="십억$ · 연간" kind="bar" labels={fdi.labels} series={fdi.series} decimals={1} seriesUnit="십억$"
          legend={<Lg c={C.emer} t="FDI 순유입" b />}
          meaning={<>FDI 순유입 규모 — <b className="text-gray-700 dark:text-gray-200">투자심리·중장기 소득·고용 기반</b></>}
          ai={<>FDI 확대는 고용·소득·소비 기반 강화 = <b className="font-semibold text-emerald-600 dark:text-emerald-400">중장기 가전 수요 저변 확장</b>, 급감 시 투자·내수 둔화 경계</>}
          tone="emerald" src={src("BSP·World Bank FDI 순유입 · 연간")} />
      )}
      {trade.series.length > 0 && (
        <ChartCard seg="B2B" title="대외거래 (수출·수입·무역수지)" unit="% GDP · 연간" labels={trade.labels} series={trade.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.emer} t="수출" b /><Lg c={C.rose} t="수입" /><Lg c={C.ind} t="무역수지" /></>}
          meaning={<>수출·수입·무역수지 — <b className="text-gray-700 dark:text-gray-200">페소 환율·수입 가전 원가의 구조적 압력</b></>}
          ai={<>수입 초과(무역적자 지속)은 <b className="font-semibold text-amber-600 dark:text-amber-400">페소 약세·수입가전 원가 상승 압력</b> → 현지조달·판가 헤지, 수출 회복 시 원가 완화</>}
          tone="amber" src={src("World Bank 수출입·무역수지(%GDP) · 연간")} />
      )}
      {reserves.series.length > 0 && (
        <ChartCard seg="B2B" title="외환보유액" unit="십억$ · 연간" labels={reserves.labels} series={reserves.series} decimals={0} seriesUnit="십억$"
          legend={<Lg c={C.ind} t="외환보유액" b />}
          meaning={<>외환보유고 — <b className="text-gray-700 dark:text-gray-200">페소 방어력·수입결제 안정성</b></>}
          ai={<>외환보유 충분은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">페소 안정·수입가전 원가 예측성</b> → 조달·판가 안정, 급감 시 환리스크·수입비용 변동성 경계</>}
          tone="emerald" src={src("World Bank·BSP 외환보유액 · 연간")} />
      )}
      {govt.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="정부지출·서비스업 비중" unit="% GDP · 연간" labels={govt.labels} series={govt.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="정부지출" b /><Lg c={C.emer} t="서비스업 비중" /></>}
          meaning={<>정부지출·서비스업 GDP비중 — <b className="text-gray-700 dark:text-gray-200">도시가구·B2B 수요 기반</b></>}
          ai={<>서비스업 비중 확대·정부 인프라 지출은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">도시화·사무실·상업용 가전 수요 저변</b> → B2B·프리미엄 도시시장 성장</>}
          tone="emerald" src={src("World Bank 정부지출·서비스업 비중(%GDP) · 연간")} />
      )}
        </> },
      ]} />
  )
}

// ══════════════════════════════════════════════════════════════════════
// 국민계정·성장 — GDP·소비·투자·건설·산업·유통
// ══════════════════════════════════════════════════════════════════════
const GROWTH_KEYS = ["gdp_growth_yoy", "household_consumption_yoy", "gross_capital_formation_yoy", "gfcf_growth", "construction_gva_growth", "construction_gfcf_growth", "permits_residential_value", "permits_total_value", "permits_nonresidential_floorarea", "industry_gva_yoy", "industry_va_growth", "manufacturing_va_growth", "services_va_growth", "capacity_utilization", "retail_gva_growth", "wholesale_retail_trade_yoy", "wholesale_gva_growth", "services_gva_yoy", "retail_sales_growth", "gdp_per_capita_usd", "office_vacancy_ncr", "residential_property_price_yoy", "residential_property_price_real_yoy", "tourism_arrivals"]
// 동남아 6개국 비교 — 필리핀 강조(굵은선+끝점 핀), 나머지 색 구분
const SEA_SPECS: Spec[] = [
  { key: "Philippines", name: "필리핀", color: C.ind, w: 2.4, endLabel: "필리핀" },
  { key: "Indonesia", name: "인니", color: C.rose },
  { key: "Thailand", name: "태국", color: C.blue },
  { key: "Vietnam", name: "베트남", color: C.emer },
  { key: "Malaysia", name: "말련", color: C.amber },
]
export function GrowthView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(GROWTH_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const [sea, setSea] = useState<Record<string, Mon>>({})
  useEffect(() => { Promise.all(["gdp_per_capita_ppp", "gdp_per_capita_usd", "gdp_total_ppp"].map((k) => seaCompare(k).then((r) => [k, r] as const))).then((rs) => setSea(Object.fromEntries(rs))) }, [])
  const seaPPP = build(sea.gdp_per_capita_ppp ?? {}, n, SEA_SPECS.map((s) => ({ ...s, tf: (v: number) => v / 1000 })))
  const seaNom = build(sea.gdp_per_capita_usd ?? {}, n, SEA_SPECS.map((s) => ({ ...s, tf: (v: number) => v / 1000 })))
  const seaTot = build(sea.gdp_total_ppp ?? {}, n, SEA_SPECS.map((s) => ({ ...s, tf: (v: number) => v / 1e9 })))
  // 같은 단위(전년비 %)끼리만 겹침 — 스케일 다른 지표(가동률 레벨·건축허가 금액)는 별도 카드로 분리
  const gdp = build(d, n, [{ key: "gdp_growth_yoy", name: "GDP 성장률", color: C.ind, w: 2 }]) // GDP 단독(COVID 저점 등 스케일 독립)
  const demand = build(d, n, [{ key: "household_consumption_yoy", name: "민간소비", color: C.ind, w: 2 }, { key: "gross_capital_formation_yoy", name: "총투자", color: C.blue }])
  const cons = build(d, n, [{ key: "construction_gva_growth", name: "건설 부가가치", color: C.ind, w: 2 }, { key: "construction_gfcf_growth", name: "건설 투자", color: C.violet }])
  const ind = build(d, n, [{ key: "industry_gva_yoy", name: "산업", color: C.ind, w: 2 }, { key: "manufacturing_va_growth", name: "제조업", color: C.rose }])
  const cap = build(d, n, [{ key: "capacity_utilization", name: "평균 가동률", color: C.amber, w: 2 }]) // 레벨(%) — 성장률과 축 분리
  const ret = build(d, n, [{ key: "wholesale_retail_trade_yoy", name: "도소매 거래", color: C.ind, w: 2 }, { key: "retail_gva_growth", name: "소매 부가가치", color: C.teal }, { key: "wholesale_gva_growth", name: "도매 부가가치", color: C.amber }])
  const permit = build(d, n, [{ key: "permits_nonresidential_floorarea", name: "비주거 착공면적", color: C.ind, w: 2, tf: (v) => v / 1e6 }])
  const permitV = build(d, n, [{ key: "permits_residential_value", name: "주거 건축허가액", color: C.violet, w: 2, tf: (v) => v / 1e6 }]) // 천PHP→십억₱
  const va = build(d, n, [{ key: "manufacturing_va_growth", name: "제조업", color: C.ind, w: 2 }, { key: "industry_gva_yoy", name: "산업", color: C.rose }, { key: "services_gva_yoy", name: "서비스", color: C.emer }]) // 산업·서비스는 최신 vintage(gva_yoy)로 통일 — 구 va_growth와 값 불일치 제거
  const rsale = build(d, n, [{ key: "retail_sales_growth", name: "소매판매 증가율", color: C.ind, w: 2 }]) // 연간 6년(COVID 저점)
  const pcap = build(d, n, [{ key: "gdp_per_capita_usd", name: "1인당 GDP", color: C.ind, w: 2 }]) // USD, 연간 — 구매력·시장규모
  const tour = build(d, n, [{ key: "tourism_arrivals", name: "국제 관광객", color: C.teal, w: 2 }]) // 백만명, 연간 — 서비스·소비 동력
  const office = build(d, n, [{ key: "office_vacancy_ncr", name: "오피스 공실률", color: C.rose, w: 2 }]) // 민간자료(Colliers)
  const rrepi = build(d, n, [{ key: "residential_property_price_yoy", name: "명목", color: C.ind, w: 2 }, { key: "residential_property_price_real_yoy", name: "실질", color: C.teal }]) // 주거용 부동산가격 상승률, 분기(BIS)
  const empty = !gdp.series.length && !demand.series.length && !cons.series.length && !ind.series.length && !cap.series.length && !ret.series.length && !permit.series.length && !permitV.series.length && !va.series.length && !rsale.series.length && !pcap.series.length && !office.series.length && !rrepi.series.length
  return (
    <Shell title="국민계정·성장" sub="GDP·소비·투자·건설허가·산업·유통 — 가전 수요 파이" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ summary: (kv) => <>GDP {B(f1(kv.gdp_growth_yoy) + "%")}·민간소비 {B(f1(kv.household_consumption_yoy) + "%")}·투자 {B(f1(kv.gross_capital_formation_yoy) + "%")}, 가동률 {B(f1(kv.capacity_utilization) + "%")} — {(kv.gdp_growth_yoy ?? 0) < 4 ? "성장 둔화로 가전 수요 파이 축소 국면" : "성장 견조, 수요 파이 확대 국면"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">국민계정으로 본 가전 수요 파이</b></>, lg: <>민간소비·주거 착공 회복은 <b className="font-semibold">가전 신규수요 선행</b> → 성장 밀집 지역 채널·재고 선점, 둔화 시 보급형 방어</> }}
      kpiDefs={[
        { key: "gdp_growth_yoy", label: "GDP 성장률", fmt: (v) => v + "%", tone: "emerald" },
        { key: "household_consumption_yoy", label: "민간소비", fmt: (v) => v + "%", tone: "emerald" },
        { key: "gross_capital_formation_yoy", label: "총투자", fmt: (v) => v + "%", tone: "emerald" },
        { key: "capacity_utilization", label: "가동률", fmt: (v) => v + "%", tone: "amber" },
      ]}
      sections={[
        { key: "demand", label: "수요·성장", node: <>
      {gdp.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="GDP 성장률" unit="전년비 %" kind="bar" labels={gdp.labels} series={gdp.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="GDP 성장률" b />}
          meaning={<>실질 GDP 성장률 — <b className="text-gray-700 dark:text-gray-200">가전 시장 전체 파이의 크기</b></>}
          ai={<>성장 둔화기엔 재량소비 위축 → <b className="font-semibold text-amber-600 dark:text-amber-400">보급형 방어</b>, 확장기엔 프리미엄·신규수요 가속. <b>트렌드</b>: 2020년 코로나로 <b className="font-semibold text-rose-600 dark:text-rose-400">-9.5% 급락</b>(역대 최악) 후 2022~2023 7%대 반등, 2024~ 5~6%대 안정 성장.</>}
          tone="emerald" src={src("PSA 국민계정 GDP · 분기/연")} />
      )}
      {demand.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="민간소비·총투자 성장률" unit="전년비 %" labels={demand.labels} series={demand.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="민간소비" b /><Lg c={C.blue} t="총투자" /></>}
          meaning={<>내수 소비·투자 성장 — <b className="text-gray-700 dark:text-gray-200">가전 수요와 직결되는 지출 축</b></>}
          ai={<>민간소비 성장은 가전 수요와 직결 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">소비 확장기에 시장 성장 가속</b>, 둔화 시 보급형 방어</>}
          tone="emerald" src={src("PSA 국민계정 GDE(소비·투자) · 분기/연")} />
      )}
      {pcap.series.length > 0 && (
        <ChartCard seg="CE" title="1인당 GDP" unit="US$ · 연간" labels={pcap.labels} series={pcap.series} decimals={0} seriesUnit="$"
          legend={<Lg c={C.ind} t="1인당 GDP" b />}
          meaning={<>1인당 명목 GDP — <b className="text-gray-700 dark:text-gray-200">가전 구매력·프리미엄 전환의 구조적 기반</b></>}
          ai={<>1인당 GDP는 10년간 2,163$→4,171$로 상승 = <b className="font-semibold text-emerald-600 dark:text-emerald-400">중산층 확대·프리미엄 가전 침투 여력↑</b> → 상위 라인업·신가전 카테고리 확장 기회</>}
          tone="emerald" src={src("World Bank 1인당 GDP(명목) · 연간")} />
      )}
      {tour.series.length > 0 && (
        <ChartCard seg="CE" title="국제 관광객 입국자수" unit="백만명 · 연간" labels={tour.labels} series={tour.series} decimals={1} seriesUnit="M"
          legend={<Lg c={C.teal} t="국제 관광객(백만명)" b />}
          meaning={<>연간 국제 방문객 수 — <b className="text-gray-700 dark:text-gray-200">서비스·소매·숙박·리조트 B2B 수요</b></>}
          ai={<>관광 회복은 호텔·리조트·요식 <b className="font-semibold text-emerald-600 dark:text-emerald-400">B2B 가전(에어컨·냉장·주방)</b> 및 관광지 소매 수요를 자극. <b>트렌드</b>: 2019년 <b>8.3M</b> 정점 → 2020~21 코로나로 <b className="font-semibold text-rose-600 dark:text-rose-400">0.2M까지 붕괴</b> → 2023 5.5M·2025 6.4M로 회복 중이나 아직 팬데믹 이전 미달 · 회복 지속 시 B2B·지방 소매 순풍.</>}
          tone="emerald" src={src("World Bank(2005~2020)·필리핀 DOT(2021~2025) 국제 관광객 · 연간")} />
      )}
        </> },
        { key: "industry", label: "산업·생산", node: <>
      <GdpComposition />
      {ind.series.length > 0 && (
        <ChartCard seg="B2B" title="산업·제조 성장률" unit="전년비 %" labels={ind.labels} series={ind.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="산업" b /><Lg c={C.rose} t="제조업" /></>}
          meaning={<>산업·제조 생산 성장 — <b className="text-gray-700 dark:text-gray-200">현지 조달·공급망·경기 국면</b></>}
          ai={<>제조업 둔화는 경기 하강 신호 → <b className="font-semibold text-amber-600 dark:text-amber-400">수요 위축 대비</b>, 재고·판가 보수적 운영</>}
          tone="amber" src={src("PSA 국민계정 산업·제조 GVA · 분기/연")} />
      )}
      {cap.series.length > 0 && (
        <ChartCard seg="B2B" title="평균 가동률" unit="% (레벨)" labels={cap.labels} series={cap.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.amber} t="평균 가동률" b />}
          meaning={<>산업·건설 평균 설비 가동률 — <b className="text-gray-700 dark:text-gray-200">공급 여력·경기 과열/둔화</b></>}
          ai={<>가동률 하락은 수요 둔화·유휴 신호 → <b className="font-semibold text-amber-600 dark:text-amber-400">보수적 재고·판가</b>, 상승 지속 시 공급 병목 대비. <b>트렌드</b>: 제조 가동률 2020년 코로나 저점 후 회복해 2024~ 77~79%대 안정(팬데믹 전 수준 상회).</>}
          tone="amber" src={src("PSA 산업생산조사 가동률 · 월")} />
      )}
      {va.series.length > 0 && (
        <ChartCard seg="B2B" title="부문별 부가가치 성장" unit="전년비 %" labels={va.labels} series={va.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="제조업" b /><Lg c={C.rose} t="산업" /><Lg c={C.emer} t="서비스" /></>}
          meaning={<>제조·산업·서비스 부문 성장 — <b className="text-gray-700 dark:text-gray-200">B2B 수요처 업황·설비투자 여력</b></>}
          ai={<>제조·서비스 업황 개선은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">기업 설비·시설 투자 여력</b> → B2B 상업용·산업용 수요 우호</>}
          tone="emerald" src={src("PSA 국민계정 부문별 GVA · 연간")} />
      )}
        </> },
        { key: "construction", label: "건설·투자", node: <>
      {cons.series.length > 0 && (
        <ChartCard seg="B2B" title="건설 부가가치·투자 성장" unit="전년비 %" labels={cons.labels} series={cons.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="건설 부가가치" b /><Lg c={C.violet} t="건설 투자" /></>}
          meaning={<>건설 부문 성장 — <b className="text-gray-700 dark:text-gray-200">빌트인·냉난방·신규 가전 수요의 6~12개월 선행</b></>}
          ai={<>건설 성장 가속은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">신규 가전·에어컨 수요 선행</b> → 착공 밀집 지역에 채널·재고 선제 배치</>}
          tone="emerald" src={src("PSA 국민계정 건설 GVA·GFCF · 분기")} />
      )}
      {permitV.series.length > 0 && (
        <ChartCard seg="B2B" title="주거 건축허가액" unit="십억₱ · 분기" kind="bar" labels={permitV.labels} series={permitV.series} decimals={1} seriesUnit="십억₱"
          legend={<Lg c={C.violet} t="주거 건축허가액" b />}
          meaning={<>주거 신축 허가 금액 — <b className="text-gray-700 dark:text-gray-200">주택·가전 신규수요의 선행 규모</b></>}
          ai={<>허가액 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">신규 주택 유입 = 가전 초도수요</b> → 착공 밀집 지역 채널 선점</>}
          tone="emerald" src={src("PSA 건축허가(주거) · 분기")} />
      )}
      {permit.series.length > 0 && (
        <ChartCard seg="B2B" title="비주거 건축허가(상업·산업)" unit="백만 ㎡ · 분기" kind="bar" labels={permit.labels} series={permit.series} decimals={2}
          legend={<Lg c={C.ind} t="비주거 착공면적" b />}
          meaning={<>상업·산업 신축 착공면적 — <b className="text-gray-700 dark:text-gray-200">B2B 냉난방·빌트인 수요의 선행</b></>}
          ai={<>비주거 착공 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">상업용 HVAC·빌트인 프로젝트 수요 선행</b> → B2B 파이프라인·입찰 선제 대응</>}
          tone="emerald" src={src("PSA 건축허가(비주거) · 분기")} />
      )}
      {office.series.length > 0 && (
        <ChartCard seg="B2B" title="오피스 공실률 (메트로 마닐라)" unit="% · 분기 · 민간자료" labels={office.labels} series={office.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.rose} t="오피스 공실률" b />}
          meaning={<>상업용 오피스 공실률 — <b className="text-gray-700 dark:text-gray-200">B2B 상업용 HVAC·빌트인 수요의 역지표</b></>}
          ai={<>공실률 하락은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">오피스 임대·신규 입주 회복 = 상업용 냉난방·가전 수요</b>, 상승 시 B2B 프로젝트 지연 경계 · <b className="text-gray-500 dark:text-gray-400">민간자료(Colliers)</b></>}
          tone="amber" src={src("Colliers PH Office · 분기 · 민간자료")} />
      )}
      {rrepi.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="주거용 부동산가격 상승률" unit="전년비 % · 분기" labels={rrepi.labels} series={rrepi.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="명목" b /><Lg c={C.teal} t="실질(물가조정)" /></>}
          meaning={<>주택가격 상승률(명목·실질) — <b className="text-gray-700 dark:text-gray-200">자산효과·프리미엄·초도수요 동인</b></>}
          ai={<>주택가격 상승은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">자산효과·신규 입주 = 프리미엄·빌트인 가전 수요</b>, 실질 하락(명목이 물가 하회) 시 소비여력 위축 경계 · <b className="text-gray-500 dark:text-gray-400">BIS(BSP RREPI 원천)</b>. <b>트렌드</b>: 2024년 명목 7~9%였으나 2025년 2%대로 급둔화, 실질은 마이너스 근접 — 주택경기 냉각 신호.</>}
          tone="emerald" src={src("BIS 주거용 부동산가격지수(BSP RREPI 원천) · 분기")} />
      )}
        </> },
        { key: "trade", label: "유통", node: <>
      {ret.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="도소매 유통 성장" unit="전년비 %" labels={ret.labels} series={ret.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="도소매 거래" b /><Lg c={C.teal} t="소매 부가가치" /><Lg c={C.amber} t="도매 부가가치" /></>}
          meaning={<>도소매업 성장률 — <b className="text-gray-700 dark:text-gray-200">유통 채널 활력·소비 실현</b></>}
          ai={<>도소매 성장 가속은 채널 판매 여건 개선 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">유통 프로모·진열 확대 적기</b>. <b>트렌드</b>: 2020년 코로나로 <b className="font-semibold text-rose-600 dark:text-rose-400">-14% 급락</b> 후 2021~2022 9%대 반등, 2024~ 5%대 안정 성장.</>}
          tone="emerald" src={src("PSA 국민계정 도소매업 · 분기")} />
      )}
      {rsale.series.length > 0 && (
        <ChartCard seg="CE" title="소매판매 증가율" unit="전년비 % · 연간" kind="bar" labels={rsale.labels} series={rsale.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="소매판매 증가율" b />}
          meaning={<>소매판매 성장률 — <b className="text-gray-700 dark:text-gray-200">가전 포함 소비재 실판매 대리지표</b></>}
          ai={<>소매판매 반등은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">가전 실수요 회복 신호</b> → 프로모·진열 확대 적기, 둔화 시 보급형 방어</>}
          tone="emerald" src={src("PSA 소매판매 · 연간")} />
      )}
        </> },
        { key: "sea", label: "동남아 비교", node: <>
      {seaPPP.series.length > 0 && (
        <ChartCard seg="CE" title="1인당 GDP (PPP) — 동남아 6개국" unit="천 int$ · 연간" labels={seaPPP.labels} series={seaPPP.series} decimals={1} seriesUnit="k"
          legend={<>{SEA_SPECS.map((s) => <Lg key={s.key} c={s.color} t={s.name} b={s.key === "Philippines"} />)}</>}
          meaning={<>구매력평가(PPP) 1인당 GDP — <b className="text-gray-700 dark:text-gray-200">역내 실질 생활수준·가전 구매력 순위</b></>}
          ai={<>필리핀은 역내 <b className="font-semibold text-amber-600 dark:text-amber-400">하위권(태국·말련 대비 낮음)</b>이나 성장 지속 → 보급형 주력 + 중산층 확대 구간 프리미엄 침투 여지</>}
          tone="amber" src={src("World Bank 1인당 GDP(PPP) · 연간")} />
      )}
      {seaNom.series.length > 0 && (
        <ChartCard seg="CE" title="1인당 GDP (명목) — 동남아 6개국" unit="천 US$ · 연간" labels={seaNom.labels} series={seaNom.series} decimals={1} seriesUnit="k"
          legend={<>{SEA_SPECS.map((s) => <Lg key={s.key} c={s.color} t={s.name} b={s.key === "Philippines"} />)}</>}
          meaning={<>명목 달러 1인당 GDP — <b className="text-gray-700 dark:text-gray-200">환율 반영 실제 달러 구매력·수입가전 접근성</b></>}
          ai={<>명목 기준 필리핀 위치는 <b className="font-semibold text-amber-600 dark:text-amber-400">환율(페소 약세)에 민감</b> → 페소 약세기 수입 프리미엄가 부담↑, 현지화·보급형 방어</>}
          tone="amber" src={src("World Bank 1인당 GDP(명목) · 연간")} />
      )}
      {seaTot.series.length > 0 && (
        <ChartCard seg="B2B" title="국가 GDP 규모 (PPP) — 동남아 6개국" unit="십억 int$ · 연간" labels={seaTot.labels} series={seaTot.series} decimals={0} seriesUnit="B"
          legend={<>{SEA_SPECS.map((s) => <Lg key={s.key} c={s.color} t={s.name} b={s.key === "Philippines"} />)}</>}
          meaning={<>경제 총규모(PPP) — <b className="text-gray-700 dark:text-gray-200">역내 시장 크기·잠재 수요 총량 순위</b></>}
          ai={<>필리핀은 인구 대국이나 총 GDP는 인니에 크게 못 미침 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">1억 인구 기반 성장 잠재력 = 중장기 가전 시장 확대 여력</b></>}
          tone="emerald" src={src("World Bank GDP(PPP) · 연간")} />
      )}
        </> },
      ]} />
  )
}

// ══════════════════════════════════════════════════════════════════════
// 고용·임금·소득 — 실업·참가·OFW 송금·인구
// ══════════════════════════════════════════════════════════════════════
const LABOR_KEYS = ["unemployment_rate", "underemployment_rate", "labor_force_participation_rate", "employed_persons", "ofw_cash_remittance", "ofw_cash_remittance_growth_yoy", "ofw_personal_remittance", "remittances_usd", "population", "urban_population_pct", "min_wage_php", "households_mn", "household_size", "internet_penetration", "electrification_rate", "poverty_rate", "fertility_rate", "median_age", "mobile_per100", "broadband_per100", "account_ownership", "gini_index", "hh_consumption_pc", "gni_per_capita", "life_expectancy", "secondary_enroll", "pop_share_child", "pop_share_youth", "pop_share_working", "pop_share_old", "emp_industry_pct", "emp_services_pct", "emp_agri_pct"]
export function LaborView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(LABOR_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const un = build(d, n, [{ key: "unemployment_rate", name: "실업률", color: C.ind, w: 2 }, { key: "underemployment_rate", name: "불완전고용", color: C.rose }])
  const lf = build(d, n, [{ key: "labor_force_participation_rate", name: "경제활동참가율", color: C.ind, w: 2 }])
  const emp = build(d, n, [{ key: "employed_persons", name: "취업자 수", color: C.emer, w: 2 }]) // 백만명, 월별 5년
  const rem = build(d, n, [{ key: "ofw_cash_remittance_growth_yoy", name: "송금 증가율", color: C.ind, w: 2 }])
  const remL = build(d, n, [{ key: "ofw_personal_remittance", name: "개인송금(현금+현물)", color: C.ind, w: 2 }, { key: "ofw_cash_remittance", name: "현금송금", color: C.emer, w: 2 }])
  const remY = build(d, n, [{ key: "remittances_usd", name: "연간 송금액", color: C.emer, w: 2, tf: (v) => v / 1e9 }]) // USD→십억$, 연간 장기(15년)
  const pop = build(d, n, [{ key: "population", name: "인구", color: C.ind, w: 2, tf: (v) => v / 1e6 }]) // 명→백만명, 연간
  const wage = build(d, n, [{ key: "min_wage_php", name: "최저임금(일급)", color: C.ind, w: 2 }]) // PHP/일, 11년
  const empShare = build(d, n, [{ key: "emp_services_pct", name: "서비스", color: C.ind, w: 2 }, { key: "emp_industry_pct", name: "산업", color: C.amber }, { key: "emp_agri_pct", name: "농업", color: C.emer }]) // 고용비중 %
  const hh = build(d, n, [{ key: "households_mn", name: "가구 수", color: C.ind, w: 2 }]) // 백만가구, 11년
  const infra = build(d, n, [{ key: "internet_penetration", name: "인터넷", color: C.ind, w: 2 }, { key: "electrification_rate", name: "전기", color: C.emer }]) // %, 보급률
  const pov = build(d, n, [{ key: "poverty_rate", name: "빈곤율", color: C.ind, w: 2 }]) // %, 소득계층
  const urban = build(d, n, [{ key: "urban_population_pct", name: "도시화율", color: C.ind, w: 2 }]) // %, 연간
  const age = build(d, n, [{ key: "median_age", name: "중위연령", color: C.ind, w: 2 }]) // 세, 연간
  const fam = build(d, n, [{ key: "household_size", name: "평균 가구원수", color: C.ind, w: 2 }, { key: "fertility_rate", name: "합계출산율", color: C.rose }]) // 명, 연간
  const ict = build(d, n, [{ key: "mobile_per100", name: "이동전화", color: C.ind, w: 2 }, { key: "broadband_per100", name: "초고속인터넷", color: C.emer }, { key: "internet_penetration", name: "인터넷 사용", color: C.blue }]) // 100명당·%
  const fin = build(d, n, [{ key: "account_ownership", name: "금융계좌 보유율", color: C.ind, w: 2 }]) // %, Findex
  const cons = build(d, n, [{ key: "hh_consumption_pc", name: "1인당 가계소비", color: C.ind, w: 2 }]) // 불변$
  const gni = build(d, n, [{ key: "gni_per_capita", name: "1인당 GNI", color: C.ind, w: 2 }]) // 명목$
  const gini = build(d, n, [{ key: "gini_index", name: "지니계수", color: C.rose, w: 2 }]) // 불평등
  const empty = !un.series.length && !lf.series.length && !emp.series.length && !rem.series.length && !remL.series.length && !remY.series.length && !pop.series.length && !wage.series.length && !hh.series.length && !infra.series.length && !pov.series.length && !urban.series.length && !age.series.length && !fam.series.length && !ict.series.length && !fin.series.length && !cons.series.length && !gni.series.length && !gini.series.length
  return (
    <Shell title="고용·임금·소득" sub="실업·경제활동참가·OFW 송금 — 가전 구매력" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="emerald"
      banner={{ summary: (kv) => <>실업률 {B(f1(kv.unemployment_rate) + "%")}·불완전고용 {B(f1(kv.underemployment_rate) + "%")}, OFW송금 {B(f1(kv.ofw_cash_remittance_growth_yoy) + "%")}·최저임금 {B("₱" + f0(kv.min_wage_php))}·빈곤율 {B(f1(kv.poverty_rate) + "%")} — {(kv.ofw_cash_remittance_growth_yoy ?? 0) > 0 ? "고용·송금이 구매력 뒷받침" : "구매력 모멘텀 둔화"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">고용·OFW 송금 = 가전 구매력의 원천</b></>, lg: <>실업 하락·송금 증가는 가처분소득↑ → <b className="font-semibold">송금 성수기(4Q·연말) 프리미엄 집중</b> · 페소 약세와 겹치면 환산 구매력 추가 상승</> }}
      kpiDefs={[
        { key: "unemployment_rate", label: "실업률", fmt: (v) => v + "%", tone: "rose" },
        { key: "underemployment_rate", label: "불완전고용", fmt: (v) => v + "%", tone: "rose" },
        { key: "ofw_cash_remittance_growth_yoy", label: "OFW 송금 YoY", fmt: (v) => v + "%", tone: "emerald" },
        { key: "min_wage_php", label: "최저임금", fmt: (v) => "₱" + v.toFixed(0), tone: "emerald" },
        { key: "households_mn", label: "가구 수", fmt: (v) => v.toFixed(1) + "백만", tone: "emerald" },
        { key: "poverty_rate", label: "빈곤율", fmt: (v) => v + "%", tone: "rose" },
      ]}
      sections={[
        { key: "emp_rem", label: "고용·송금", node: <>
      {un.series.length > 0 && (
        <ChartCard seg="CE" title="실업·불완전고용률" unit="%" labels={un.labels} series={un.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="실업률" b /><Lg c={C.rose} t="불완전고용" /></>}
          meaning={<>고용 여건 — <b className="text-gray-700 dark:text-gray-200">가처분소득·내구재 구매 여력</b></>}
          ai={<>실업·불완전고용 하락은 소득 안정 신호 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">가전 수요 우호</b>, 상승 시 필수·보급형 우선. <b>트렌드</b>: 실업률 2020년 코로나 <b className="font-semibold text-rose-600 dark:text-rose-400">17.6% 급등</b> 후 2024~ 3~5%로 정상화(역대 최저권), 불완전고용은 12%대 잔존.</>}
          tone="rose" src={src("PSA 노동력조사(LFS) · 월/분기")} />
      )}
      {remL.series.length > 0 && (
        <ChartCard seg="CE" title="OFW 송금액 (개인·현금)" unit="십억$ · 월별" labels={remL.labels} series={remL.series}
          legend={<><Lg c={C.ind} t="개인송금(현금+현물)" b /><Lg c={C.emer} t="현금송금" b /></>}
          meaning={<>해외근로자 송금 — <b className="text-gray-700 dark:text-gray-200">필리핀 가전·프리미엄 구매의 핵심 재원</b></>}
          ai={<>송금 유입은 가전 특히 <b className="font-semibold text-emerald-600 dark:text-emerald-400">프리미엄·대형 수요를 견인</b> → 송금 성수기(4Q·연말)에 프리미엄 캠페인 집중. <b>트렌드</b>: 2020년 코로나 소폭 위축 후 곧 회복, 개인송금 월 <b className="font-semibold">30억$대 사상 최고</b> — 연말(12월) 계절 급증 뚜렷.</>}
          tone="emerald" src={src("BSP OFW 개인·현금송금 · 월별(2005~)")} />
      )}
      {rem.series.length > 0 && (
        <ChartCard seg="CE" title="OFW 송금 증가율" unit="전년비 %" labels={rem.labels} series={rem.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="송금 증가율" b />}
          meaning={<>송금 증가율 — <b className="text-gray-700 dark:text-gray-200">구매력 모멘텀</b></>}
          ai={<>송금 증가율 가속은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">가처분소득 모멘텀</b> → 페소 약세와 겹치면 페소환산 송금 구매력 추가 상승</>}
          tone="emerald" src={src("BSP OFW 현금송금 · 전년비")} />
      )}
      {lf.series.length > 0 && (
        <ChartCard seg="CE" title="경제활동참가율" unit="%" labels={lf.labels} series={lf.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="경제활동참가율" b />}
          meaning={<>노동시장 참여율 — <b className="text-gray-700 dark:text-gray-200">소득 창출 인구 저변</b></>}
          ai={<>참가율 상승은 소득 기반 확대 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">중장기 수요 저변 확대</b> 신호</>}
          tone="emerald" src={src("PSA 노동력조사(LFS) · 월별")} />
      )}
      {emp.series.length > 0 && (
        <ChartCard seg="CE" title="취업자 수" unit="백만명 · 월별" labels={emp.labels} series={emp.series} decimals={1} seriesUnit="백만명"
          legend={<Lg c={C.emer} t="취업자 수" b />}
          meaning={<>총 취업자 수(월별) — <b className="text-gray-700 dark:text-gray-200">가전 구매 가능 소득인구의 절대 규모</b></>}
          ai={<>취업자 증가는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">가처분소득 창출 인구 확대 = 내구재 수요 저변 성장</b> → 고용 회복기 프리미엄·신규 라인업 확대 적기</>}
          tone="emerald" src={src("PSA 노동력조사(LFS) 취업자 수 · 월별")} />
      )}
      {empShare.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="산업별 고용비중" unit="% · 연간" labels={empShare.labels} series={empShare.series} decimals={0} seriesUnit="%"
          legend={<><Lg c={C.ind} t="서비스" b /><Lg c={C.amber} t="산업" /><Lg c={C.emer} t="농업" /></>}
          meaning={<>고용의 산업 구조 — <b className="text-gray-700 dark:text-gray-200">경제 구조 전환·소득 성격</b></>}
          ai={<><b className="font-semibold text-emerald-600 dark:text-emerald-400">서비스 60%·산업 20%·농업 20%</b> — 탈농업·서비스화 진행. <b>트렌드</b>: 농업 고용비중이 장기 하락(2005 35%→2024 20%대)하며 도시 서비스직 확대 = <b className="font-semibold">도시 중산층 가전수요 저변</b> 성장, 단 제조업 정체(20%)로 고소득 일자리는 제한.</>}
          tone="emerald" src={src("World Bank·PSA 산업별 고용비중 · 연간")} />
      )}
      {remY.series.length > 0 && (
        <ChartCard seg="CE" title="연간 해외송금액" unit="십억$ · 연간" labels={remY.labels} series={remY.series} decimals={1} seriesUnit="십억$"
          legend={<Lg c={C.emer} t="연간 송금액" b />}
          meaning={<>연간 총 해외송금(장기) — <b className="text-gray-700 dark:text-gray-200">가전 구매력의 구조적 성장 기반</b></>}
          ai={<>송금은 10년 넘게 <b className="font-semibold text-emerald-600 dark:text-emerald-400">우상향 = 내구재 구매력 구조적 확대</b> → 프리미엄 침투 여지 지속 확대</>}
          tone="emerald" src={src("World Bank · BSP 해외송금 · 연간")} />
      )}
        </> },
        { key: "income", label: "임금·가구", node: <>
      {pop.series.length > 0 && (
        <ChartCard seg="CE" title="인구" unit="백만명 · 연간" labels={pop.labels} series={pop.series} decimals={1} seriesUnit="백만명"
          legend={<Lg c={C.ind} t="인구" b />}
          meaning={<>총인구(장기) — <b className="text-gray-700 dark:text-gray-200">가구 형성·가전 보급 대수의 기저 수요</b></>}
          ai={<>인구·가구 증가는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">가전 대당 보급 여지의 지속 확대</b> → 신규 가구 겨냥 보급형·초도수요 전략</>}
          tone="emerald" src={src("World Bank 인구 · 연간")} />
      )}
      {wage.series.length > 0 && (
        <ChartCard seg="CE" title="최저임금 (일급)" unit="₱/일 · 연간" labels={wage.labels} series={wage.series} decimals={0} seriesUnit="₱"
          legend={<Lg c={C.ind} t="최저임금(일급)" b />}
          meaning={<>법정 최저임금 추이 — <b className="text-gray-700 dark:text-gray-200">저소득 가구의 가전 구매력 하한</b></>}
          ai={<>최저임금 인상은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">보급형·필수 가전 구매력 직접 확대</b> → 임금 인상기 진입가 라인업 프로모 효과적</>}
          tone="emerald" src={src("DOLE 지역별 최저임금(NCR) · 연간")} />
      )}
      {hh.series.length > 0 && (
        <ChartCard seg="CE" title="가구 수" unit="백만가구 · 연간" labels={hh.labels} series={hh.series} decimals={1} seriesUnit="백만"
          legend={<Lg c={C.ind} t="가구 수" b />}
          meaning={<>총 가구 수 — <b className="text-gray-700 dark:text-gray-200">가전 보급 대수의 직접 모수(1가구=1대 기준)</b></>}
          ai={<>가구 수 증가는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">신규 가전 초도수요의 구조적 확대</b> → 신혼·1인가구 겨냥 소형·보급형 라인업</>}
          tone="emerald" src={src("PSA 가구조사 · 연간")} />
      )}
        </> },
        { key: "demo", label: "인구·구조", node: <>
      {infra.series.length > 0 && (
        <ChartCard seg="CE" title="인터넷·전기 보급률" unit="% · 연간" labels={infra.labels} series={infra.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="인터넷" b /><Lg c={C.emer} t="전기" /></>}
          meaning={<>전기·인터넷 보급률 — <b className="text-gray-700 dark:text-gray-200">가전·스마트가전 보급의 인프라 전제</b></>}
          ai={<>전기·인터넷 보급 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">지방·저소득 신규 가전 시장 개방</b> → 미보급 지역 진입가 라인업·스마트가전 침투 여지</>}
          tone="emerald" src={src("World Bank 인프라 보급률 · 연간")} />
      )}
      {pov.series.length > 0 && (
        <ChartCard seg="CE" title="빈곤율" unit="% · 연간" labels={pov.labels} series={pov.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="빈곤율" b />}
          meaning={<>빈곤 인구 비율 — <b className="text-gray-700 dark:text-gray-200">가전 구매 가능 소비층 저변의 역지표</b></>}
          ai={<>빈곤율 하락은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">중산층 편입·가전 구매층 확대</b> → 진입가→중급 업그레이드 수요 확대 기대</>}
          tone="emerald" src={src("PSA 빈곤통계 · 연간")} />
      )}
      {urban.series.length > 0 && (
        <ChartCard seg="CE" title="도시화율" unit="% · 연간" labels={urban.labels} series={urban.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="도시화율" b />}
          meaning={<>도시 거주 인구 비율 — <b className="text-gray-700 dark:text-gray-200">가전 밀집 수요·프리미엄 채널의 지리적 기반</b></>}
          ai={<>도시화 진전은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">도시 가구 밀집 = 프리미엄·빌트인·에어컨 수요 집중</b> → 도시권 채널·프리미엄 라인 우선 배치</>}
          tone="emerald" src={src("World Bank 도시화율 · 연간")} />
      )}
      {age.series.length > 0 && (
        <ChartCard seg="CE" title="중위연령" unit="세 · 연간" labels={age.labels} series={age.series} decimals={1} seriesUnit="세"
          legend={<Lg c={C.ind} t="중위연령" b />}
          meaning={<>인구 중위연령 — <b className="text-gray-700 dark:text-gray-200">가전 교체·업그레이드 vs 초도수요의 세대 구성</b></>}
          ai={<>중위연령 상승은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">소득 성숙 세대 확대 = 교체·프리미엄 업그레이드 수요</b>, 여전히 젊은 인구는 초도수요 지속 이중 기회</>}
          tone="emerald" src={src("World Bank 중위연령 · 연간")} />
      )}
      {fam.series.length > 0 && (
        <ChartCard seg="CE" title="가구원수·합계출산율" unit="명 · 연간" labels={fam.labels} series={fam.series} decimals={2} seriesUnit="명"
          legend={<><Lg c={C.ind} t="평균 가구원수" b /><Lg c={C.rose} t="합계출산율" /></>}
          meaning={<>가구 규모·출산율 하락 — <b className="text-gray-700 dark:text-gray-200">가구 수↑·소형가전 수요 전환</b></>}
          ai={<>가구원수·출산율 하락은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">가구 분화 = 가구 수↑ = 소형·1인용 가전 대수 확대</b> → 소형·프리미엄 소가전 라인업 강화</>}
          tone="emerald" src={src("PSA·World Bank 가구·출산율 · 연간")} />
      )}
      <CrossBarCard d={d} seg="CE" unit="인구 % · 2020" title="인구 연령구조" sort={false}
        items={[{ key: "pop_share_child", name: "유소년 0-14" }, { key: "pop_share_youth", name: "청년 20-39" }, { key: "pop_share_working", name: "생산가능 15-64" }, { key: "pop_share_old", name: "고령 65+" }]}
        meaning={<>연령 구조 — <b className="text-gray-700 dark:text-gray-200">청년·유소년 비중 = 신규 가구형성·초도수요 런웨이</b></>}
        ai={<>청년(20-39) <b className="font-semibold text-emerald-600 dark:text-emerald-400">32% = 신혼·1인가구 초도 가전수요 대량</b>, 고령 4.5%로 아직 젊어 장기 볼륨 성장 · 유소년 31%는 향후 10년 수요 파이프라인</>}
        source="PSA 2020 인구주택총조사 · 연령별" />
        </> },
        { key: "adopt", label: "소비·기술·금융", node: <>
      {ict.series.length > 0 && (
        <ChartCard seg="CE" title="ICT 보급 (모바일·인터넷)" unit="100명당 · % · 연간" labels={ict.labels} series={ict.series} decimals={0} seriesUnit=""
          legend={<><Lg c={C.ind} t="이동전화/100명" b /><Lg c={C.emer} t="초고속인터넷/100명" /><Lg c={C.blue} t="인터넷 사용%" /></>}
          meaning={<>통신·인터넷 보급 — <b className="text-gray-700 dark:text-gray-200">스마트가전·IoT 연계 수요의 인프라 전제</b></>}
          ai={<>모바일·초고속인터넷 보급 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">스마트가전·앱연동 프리미엄 침투 여지</b> → 커넥티드 라인업·구독형 서비스 기회</>}
          tone="emerald" src={src("World Bank WDI ICT · 연간")} />
      )}
      {fin.series.length > 0 && (
        <ChartCard seg="CE" title="금융계좌 보유율 (금융포용)" unit="% · 연간" labels={fin.labels} series={fin.series} decimals={0} seriesUnit="%"
          legend={<Lg c={C.ind} t="금융계좌 보유율" b />}
          meaning={<>15세+ 금융계좌 보유율 — <b className="text-gray-700 dark:text-gray-200">할부·카드·디지털결제 기반 확대</b></>}
          ai={<>금융포용 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">무이자 할부·BNPL·카드 결제 저변 성장</b> → 핀테크 제휴 할부 프로모로 신규 구매층 확보</>}
          tone="emerald" src={src("World Bank Findex 금융계좌 · 연간")} />
      )}
      {cons.series.length > 0 && (
        <ChartCard seg="CE" title="1인당 가계소비" unit="불변 US$ · 연간" labels={cons.labels} series={cons.series} decimals={0} seriesUnit="$"
          legend={<Lg c={C.ind} t="1인당 가계소비" b />}
          meaning={<>실질 1인당 소비지출 — <b className="text-gray-700 dark:text-gray-200">가전 포함 재량소비의 구조적 성장</b></>}
          ai={<>1인당 소비 우상향은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">재량·프리미엄 지출 여력 구조적 확대</b> → 상위 라인업·신가전 카테고리 침투 기회</>}
          tone="emerald" src={src("World Bank 1인당 가계소비(불변) · 연간")} />
      )}
      {gni.series.length > 0 && (
        <ChartCard seg="CE" title="1인당 GNI (국민총소득)" unit="US$ · 연간" labels={gni.labels} series={gni.series} decimals={0} seriesUnit="$"
          legend={<Lg c={C.ind} t="1인당 GNI" b />}
          meaning={<>1인당 국민총소득 — <b className="text-gray-700 dark:text-gray-200">해외소득(OFW) 포함 실질 소득수준</b></>}
          ai={<>GNI는 GDP+해외소득(OFW) → <b className="font-semibold text-emerald-600 dark:text-emerald-400">송금 반영 실제 구매력 지표</b>, 중진국 상단 진입 시 프리미엄 전환 가속</>}
          tone="emerald" src={src("World Bank 1인당 GNI · 연간")} />
      )}
      {gini.series.length > 0 && (
        <ChartCard seg="CE" title="소득불평등 (지니계수)" unit="index · 연간" labels={gini.labels} series={gini.series} decimals={1} seriesUnit=""
          legend={<Lg c={C.rose} t="지니계수" b />}
          meaning={<>소득분배 불평등도 — <b className="text-gray-700 dark:text-gray-200">양극화 = 프리미엄·보급형 이원 시장 구조</b></>}
          ai={<>높은 지니(양극화)는 <b className="font-semibold text-amber-600 dark:text-amber-400">프리미엄(상위층)·초저가(하위층) 양극 전략</b> 필요 → 중간 공백 유의, 하락 시 중산층 볼륨존 확대</>}
          tone="amber" src={src("World Bank 지니계수 · 연간")} />
      )}
        </> },
      ]} />
  )
}

// ══════════════════════════════════════════════════════════════════════
// 기업·소비 심리 — CCI·BCI·내구재 구매의향
// ══════════════════════════════════════════════════════════════════════
const SENTIMENT_KEYS = ["economic_sentiment_composite", "consumer_confidence_index", "consumer_confidence_next12m", "business_confidence_index", "business_confidence_next12m", "durables_buying_intention", "bes_overall_ci", "bes_ci_next_q", "bes_ci_next12m", "bes_ci_manufacturing", "bes_ci_retail", "bes_ci_services", "bes_credit_access", "bes_financial_condition", "bes_capacity_util", "bes_employment_outlook", "bes_expansion_plans", "bes_con_competition", "bes_con_demand", "bes_con_interest", "bes_con_financial", "ces_durables_buy", "ces_durables_intent"]
// BSP BES 최신 분기(2025Q4) 사업 제약요인(%응답) — 리포트 정성 콘텐츠(확산지수 아님, 복수응답)
const BES_CONSTRAINTS: [string, number][] = [["경쟁 심화", 63.7], ["수요 부족", 34.7], ["기타", 27.6], ["고금리", 21.7], ["불명확 경제법령", 16.3], ["재무 문제", 14.4], ["노동 문제", 11.2], ["신용 접근난", 7.7], ["설비 부족", 7.2], ["원자재 부족", 3.9]]
// BES 사업 제약요인 카드 — 6개 기본 + 더보기, 접이식 LG 인사이트(다른 차트와 높이 일치)
function ConstraintsCard() {
  const [more, setMore] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const cmax = Math.max(...BES_CONSTRAINTS.map((x) => x[1]), 1)
  const shown = more ? BES_CONSTRAINTS : BES_CONSTRAINTS.slice(0, 6)
  return (
    <div className="flex h-full min-w-0 flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">기업 사업 제약요인</h3>
        <span className="shrink-0 rounded bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">B2B</span>
        <span className="ml-auto shrink-0 text-[12.5px] font-medium text-gray-400 dark:text-gray-500">%응답 · 25Q4 · 복수</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {shown.map((c, i) => (
          <div key={c[0]} className="flex items-center gap-2" title={`${c[0]} ${c[1]}%`}>
            <span className="w-[68px] shrink-0 truncate text-right text-[12.5px] text-gray-500 dark:text-gray-400">{c[0]}</span>
            <span className="h-3.5 min-w-0 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800"><span className="block h-full rounded" style={{ width: (c[1] / cmax * 100) + "%", background: i === 0 && !more ? C.rose : c[0] === "경쟁 심화" ? C.rose : i < 4 ? C.ind : "#94a3b8", animation: "growX .6s cubic-bezier(.16,1,.3,1) both", animationDelay: (0.1 + i * 0.05) + "s", transformOrigin: "left center" }} /></span>
            <span className="w-9 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">{c[1]}%</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setMore((v) => !v)} className="mt-1.5 self-start text-[12.5px] font-semibold text-violet-600 dark:text-violet-400 transition-colors hover:text-violet-700 dark:hover:text-violet-300">{more ? "접기 ▲" : `더보기 (+${BES_CONSTRAINTS.length - 6}) ▼`}</button>
      <p className="mt-2.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 기업이 꼽은 경영 애로 — 수요·금리·경쟁 압력 구조</p>
      <button type="button" onClick={() => setAiOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-[12.5px] font-bold text-violet-600 dark:text-violet-400 transition-colors hover:text-violet-700 dark:hover:text-violet-300">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>
        LG 인사이트
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: aiOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div style={{ display: "grid", gridTemplateRows: aiOpen ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(.16,1,.3,1)" }}>
        <div className="overflow-hidden"><div className="mt-1.5 border-l-2 border-violet-300 dark:border-violet-500/40 pl-2.5"><p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold">경쟁 심화(64%)·수요 부족(35%)</b>이 최대 애로 — 가전도 가격·프로모 경쟁 격화 예상. 고금리(22%)는 할부 설계·B2B 발주에 부담 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">무이자 할부·TCO 절감 소구로 방어</b>.</p></div></div>
      </div>
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[12px] leading-relaxed text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> BSP Business Expectations Survey 제약요인 · 최신분기</p>
    </div>
  )
}
export function SentimentView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(SENTIMENT_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const esi = build(d, n, [{ key: "economic_sentiment_composite", name: "경제심리지수", color: C.ind, w: 2 }])
  const cci = build(d, n, [{ key: "consumer_confidence_index", name: "현재 CCI", color: C.ind, w: 2 }, { key: "consumer_confidence_next12m", name: "향후 12개월", color: C.emer }])
  const bci = build(d, n, [{ key: "business_confidence_index", name: "현재 BCI", color: C.ind, w: 2 }, { key: "business_confidence_next12m", name: "향후 12개월", color: C.blue }])
  const dur = build(d, n, [{ key: "durables_buying_intention", name: "내구재 구매의향", color: C.ind, w: 2 }])
  // BES(기업경기전망조사) 분기 — 2001~2025
  const besOverall = build(d, n, [{ key: "bes_overall_ci", name: "당분기", color: C.ind, w: 2 }, { key: "bes_ci_next_q", name: "차분기 전망", color: C.emer }])
  const besSector = build(d, n, [{ key: "bes_ci_manufacturing", name: "제조업", color: C.rose, w: 2 }, { key: "bes_ci_retail", name: "도소매", color: C.ind }, { key: "bes_ci_services", name: "서비스", color: C.emer }])
  const besOps = build(d, n, [{ key: "bes_credit_access", name: "신용접근", color: C.ind, w: 2 }, { key: "bes_financial_condition", name: "재무여건", color: C.rose }])
  const besJob = build(d, n, [{ key: "bes_employment_outlook", name: "고용전망(차분기)", color: C.ind, w: 2 }, { key: "bes_expansion_plans", name: "설비확장 계획", color: C.emer }])
  const besCap = build(d, n, [{ key: "bes_capacity_util", name: "평균 가동률", color: C.amber, w: 2 }])
  const besCon = build(d, n, [{ key: "bes_con_competition", name: "경쟁 심화", color: C.rose, w: 2.4 }, { key: "bes_con_demand", name: "수요 부족", color: C.ind, w: 2 }, { key: "bes_con_interest", name: "고금리", color: C.amber }, { key: "bes_con_financial", name: "재무 문제", color: C.emer }])
  const cesDur = build(d, n, [{ key: "ces_durables_buy", name: "내구재 구매 가구%", color: C.emer, w: 2 }])
  const empty = !cci.series.length && !bci.series.length && !dur.series.length && !esi.series.length && !besOverall.series.length
  return (
    <Shell title="기업·소비 심리" sub="소비자심리 CCI·기업심리 BCI·BES 기업경기 — 수요 선행" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="violet"
      banner={{ summary: (kv) => <>소비자심리 CCI {B(f1(kv.consumer_confidence_index))}·기업심리 BCI {B(f1(kv.business_confidence_index))}·내구재 구매의향 {B(f1(kv.durables_buying_intention))} — {(kv.consumer_confidence_index ?? 0) < 0 ? "심리 위축, 수요 회복 지연 국면" : "심리 개선, 수요 회복 초입"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">소비·기업 심리 = 수요의 3~6개월 선행</b></>, lg: <>내구재 구매의향·CCI 반등 초입에 <b className="font-semibold">신제품·프리미엄 출시 타이밍</b> · 악화 시 가성비·필수형 우선</> }}
      kpiDefs={[
        { key: "consumer_confidence_index", label: "소비자심리 CCI", fmt: (v) => String(v), tone: "emerald" },
        { key: "business_confidence_index", label: "기업심리 BCI", fmt: (v) => String(v), tone: "emerald" },
        { key: "durables_buying_intention", label: "내구재 구매의향", fmt: (v) => String(v), tone: "emerald" },
      ]}
      sections={[
        { key: "summary", label: "심리 요약", node: <>
      {esi.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="경제심리지수 (자체산출·실험적)" unit="지수 · 평균100 · 분기" labels={esi.labels} series={esi.series} decimals={1}
          legend={<Lg c={C.ind} t="경제심리지수" b />}
          meaning={<>소비·기업심리 표준화 합성 — <b className="text-gray-700 dark:text-gray-200">경제 전반 심리 단일 게이지</b></>}
          ai={<>100 상회는 낙관·수요 확장, 하회는 위축 국면 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">단일 지표로 국면 전환 조기 포착</b> · <b className="text-gray-500 dark:text-gray-400">BOK 경제심리지수(ESI) 방식 · 자체산출, 기업심리 이력 확보 시 정식화</b></>}
          tone="emerald" src={src("자체산출: BSP CES/BES 표준화 합성(평균100·표준편차10) · 분기")} />
      )}
      {dur.series.length > 0 && (
        <ChartCard seg="CE" title="내구재 구매의향" unit="지수" labels={dur.labels} series={dur.series} decimals={1}
          legend={<Lg c={C.ind} t="내구재 구매의향" b />}
          meaning={<>가전 등 내구재 구매 의향 — <b className="text-gray-700 dark:text-gray-200">실판매의 3~6개월 직접 선행</b></>}
          ai={<>구매의향 반등은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">수개월 뒤 가전 실판매 회복</b>을 예고 → 반등 초입에 신제품·프리미엄 출시 타이밍. <b>트렌드</b>: 확산지수 대체로 마이너스(비관 우세), 2020 코로나 급락 후 회복했으나 2026년 재악화(-70) — 물가·금리 부담 반영.</>}
          tone="emerald" src={src("BSP 소비자기대조사 내구재 구매의향 · 분기")} />
      )}
      {cci.series.length > 0 && (
        <ChartCard seg="CE" title="소비자심리 CCI" unit="지수" labels={cci.labels} series={cci.series} decimals={1}
          legend={<><Lg c={C.ind} t="현재 CCI" b /><Lg c={C.emer} t="향후 12개월" /></>}
          meaning={<>소비자 신뢰지수 — <b className="text-gray-700 dark:text-gray-200">가계 지출 심리·수요 선행</b></>}
          ai={<>CCI 개선은 재량 지출 확대 신호 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">프리미엄 전환 수요</b>, 악화 시 가성비·필수형 우선</>}
          tone="emerald" src={src("BSP 소비자기대조사(CES) · 분기")} />
      )}
      {bci.series.length > 0 && (
        <ChartCard seg="B2B" title="기업심리 BCI" unit="지수" labels={bci.labels} series={bci.series} decimals={1}
          legend={<><Lg c={C.ind} t="현재 BCI" b /><Lg c={C.blue} t="향후 12개월" /></>}
          meaning={<>기업 신뢰지수 — <b className="text-gray-700 dark:text-gray-200">B2B·유통 투자·재고 심리</b></>}
          ai={<>BCI 개선은 유통·B2B 발주 확대 여건 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">채널 재고·프로젝트 수주</b> 우호</>}
          tone="emerald" src={src("BSP 기업기대조사(BES) · 분기")} />
      )}
        </> },
        { key: "bes", label: "기업경기(BES) 전체분석", node: <>
      {besOverall.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="BES 기업경기 종합지수" unit="확산지수 · 분기(2001~)" labels={besOverall.labels} series={besOverall.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.ind} t="당분기" b /><Lg c={C.emer} t="차분기 전망" /></>}
          meaning={<>기업의 경기 체감·전망 — <b className="text-gray-700 dark:text-gray-200">투자·발주·채용의 선행</b></>}
          ai={<>당분기 확산지수 <b className="font-semibold text-emerald-600 dark:text-emerald-400">플러스=낙관 우세</b>. <b>트렌드</b>: 2020 코로나 급락(-30대) 후 회복해 2025년 20~30대 낙관 유지, 차분기 전망은 통상 당분기보다 높음(개선 기대). 낙관 지속은 유통·B2B 발주 확대 여건 → 채널 재고·프로젝트 수주 우호.</>}
          tone="emerald" src={src("BSP Business Expectations Survey 종합 · 분기")} />
      )}
      {besSector.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="BES 업종별 신뢰" unit="확산지수 · 분기" labels={besSector.labels} series={besSector.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.rose} t="제조업" b /><Lg c={C.ind} t="도소매" /><Lg c={C.emer} t="서비스" /></>}
          meaning={<>업종별 경기 체감 — <b className="text-gray-700 dark:text-gray-200">가전 유통(도소매)·제조 업황</b></>}
          ai={<><b className="font-semibold">도소매 신뢰</b>가 가전 유통 채널 활력의 직접 프록시. <b>트렌드</b>: 제조업 신뢰가 도소매·서비스보다 낮게 지속(10대) — 고금리·수요불안 반영. 도소매 반등 시 오프라인 판매·발주 회복 신호.</>}
          tone="emerald" src={src("BSP BES 업종별(당분기) · 분기")} />
      )}
      {besJob.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="BES 고용전망·설비확장" unit="지수·% · 분기" labels={besJob.labels} series={besJob.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.ind} t="고용전망(차분기)" b /><Lg c={C.emer} t="설비확장 계획%" /></>}
          meaning={<>기업 채용·투자 의향 — <b className="text-gray-700 dark:text-gray-200">소득·B2B 수요의 중기 선행</b></>}
          ai={<>고용전망 상승은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">가계 소득·구매력 개선</b> → 가전 수요 저변 확대. 설비확장 계획은 B2B 냉난방·설비 수요 선행. <b>트렌드</b>: 고용전망 꾸준히 플러스나 2025말 둔화(12대), 확장계획 15% 안팎 유지.</>}
          tone="emerald" src={src("BSP BES 고용전망(차분기)·설비확장 · 분기")} />
      )}
      {besOps.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="BES 신용접근·재무여건" unit="확산지수 · 분기" labels={besOps.labels} series={besOps.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.ind} t="신용접근" b /><Lg c={C.rose} t="재무여건" /></>}
          meaning={<>기업 자금·재무 체감 — <b className="text-gray-700 dark:text-gray-200">유통 운전자금·발주 여력</b></>}
          ai={<>재무여건이 <b className="font-semibold text-rose-600 dark:text-rose-400">지속 마이너스</b>면 유통·협력사 자금난 → 발주·재고 보수화 위험. <b>트렌드</b>: 재무여건 -15~-18대 만성 부진, 신용접근도 0 부근/음(-)으로 하락 — 고금리 부담 반영, 유통 여신 모니터링 필요.</>}
          tone="rose" src={src("BSP BES 신용접근·재무여건 · 분기")} />
      )}
      {besCap.series.length > 0 && (
        <ChartCard seg="B2B" title="BES 평균 가동률" unit="% · 분기" labels={besCap.labels} series={besCap.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.amber} t="평균 가동률(산업·건설)" b />}
          meaning={<>설비 가동 수준 — <b className="text-gray-700 dark:text-gray-200">공급 여력·과열/둔화</b></>}
          ai={<>가동률 <b className="font-semibold">70%대</b>는 여유 있는 공급 국면 = 수요 확대 시 즉응 가능. <b>트렌드</b>: 코로나 저점 후 71% 안팎 안정 — 급격한 공급 병목 신호는 없음.</>}
          tone="amber" src={src("BSP BES 산업·건설 평균 가동률 · 분기")} />
      )}
      {besCon.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="사업 제약요인 추이" unit="%응답 · 분기(복수)" labels={besCon.labels} series={besCon.series} decimals={0} seriesUnit="%"
          legend={<><Lg c={C.rose} t="경쟁 심화" b /><Lg c={C.ind} t="수요 부족" /><Lg c={C.amber} t="고금리" /><Lg c={C.emer} t="재무 문제" /></>}
          meaning={<>기업 애로요인의 시간 변화 — <b className="text-gray-700 dark:text-gray-200">경쟁·수요·금리 압력의 추세</b></>}
          ai={<><b className="font-semibold text-rose-600 dark:text-rose-400">경쟁 심화가 60%대로 지속 상승</b>(가전도 가격·프로모전 격화), 수요 부족 30%대 고착. <b>트렌드</b>: 고금리 애로는 2023~24 급등 후 2025 완화(23→22%)로 금리 부담 정점 통과 시사, 재무 문제는 15%로 안정. 경쟁·수요가 구조적 최대 리스크.</>}
          tone="rose" src={src("BSP BES 사업 제약요인 · 분기 2001~")} />
      )}
      {cesDur.series.length > 0 && (
        <ChartCard seg="CE" title="소비자 내구재 구매 (CES)" unit="% 가구 · 분기" labels={cesDur.labels} series={cesDur.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.emer} t="내구재 구매 가구비중" b />}
          meaning={<>내구재(가전 등)를 실제 구매한 가구 비중 — <b className="text-gray-700 dark:text-gray-200">가전 실수요의 직접 지표</b></>}
          ai={<>BSP <b className="font-semibold">소비자기대조사(CES)</b>의 내구재 구매 가구비중 — 기존 구매‘의향’ 지수(2016 종료)를 대체하는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">2026Q2까지 최신 실구매 지표</b>. <b>트렌드</b>: 팬데믹 전 9%대→최근 <b className="font-semibold text-rose-600 dark:text-rose-400">4%대로 위축</b>(고물가·금리로 대형가전 구매 지연), 구매의향 확산지수도 -70대 비관 — 심리 반등 시점이 가전 실판매 회복 신호.</>}
          tone="emerald" src={src("BSP CES 내구재 구매 가구비중(Tab7) · 분기")} />
      )}
      <ConstraintsCard />
        </> },
      ]} />
  )
}

// ══════════════════════════════════════════════════════════════════════
// 물가 — 생활물가·에너지·주거/내구재 CPI 상승률 (환율과 동일 레이아웃)
// ══════════════════════════════════════════════════════════════════════
const PRICES_KEYS = ["INF_all_items", "INF_food", "INF_rice", "INF_electricity", "INF_lpg", "INF_transport", "INF_housing_utilities", "INF_household_appliances", "INF_aircon", "INF_restaurants", "meralco_residential_rate", "oil_diesel", "oil_gasoline", "oil_kerosene", "oil_ron95", "oil_ron91"]
export function PricesView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(PRICES_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const allI = build(d, n, [{ key: "INF_all_items", name: "전체", color: C.ind, w: 2 }])
  const food = build(d, n, [{ key: "INF_food", name: "식품", color: C.rose, w: 2 }])
  const rice = build(d, n, [{ key: "INF_rice", name: "쌀", color: C.amber, w: 2 }])
  const energy = build(d, n, [{ key: "INF_electricity", name: "전기", color: C.ind, w: 2 }, { key: "INF_lpg", name: "LPG", color: C.rose }, { key: "INF_transport", name: "운송", color: C.blue }])
  const home = build(d, n, [{ key: "INF_housing_utilities", name: "주거·공공요금", color: C.ind, w: 2 }, { key: "INF_household_appliances", name: "가전", color: C.emer }, { key: "INF_aircon", name: "에어컨", color: C.rose }])
  const dine = build(d, n, [{ key: "INF_restaurants", name: "외식·숙박", color: C.ind, w: 2 }, { key: "INF_all_items", name: "전체 물가", color: C.brown }])
  const elec = build(d, n, [{ key: "meralco_residential_rate", name: "가정용 전기료", color: C.ind, w: 2 }])
  const oil = build(d, n, [{ key: "oil_diesel", name: "경유", color: C.ind, w: 2 }, { key: "oil_gasoline", name: "휘발유", color: C.rose }, { key: "oil_kerosene", name: "등유", color: C.amber }])
  const gas = build(d, n, [{ key: "oil_ron95", name: "RON95", color: C.ind, w: 2 }, { key: "oil_ron91", name: "RON91", color: C.rose }]) // 휘발유 등급별 펌프가
  const empty = !allI.series.length && !food.series.length && !rice.series.length && !energy.series.length && !home.series.length && !dine.series.length && !elec.series.length && !oil.series.length && !gas.series.length
  return (
    <Shell title="물가" sub="생활물가·에너지·주거/내구재 CPI 상승률 — 실질 구매력·원가" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="rose"
      banner={{ summary: (kv) => <>전체 물가 {B(f1(kv.INF_all_items) + "%")}·식품 {B(f1(kv.INF_food) + "%")}·쌀 {B(f1(kv.INF_rice) + "%")}·전기 {B(f1(kv.INF_electricity) + "%")}, 경유 {B("₱" + f1(kv.oil_diesel))} — {(kv.INF_all_items ?? 0) > 4 ? "물가 압박 지속, 재량지출 위축" : "물가 둔화, 구매력 회복 국면"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">물가 = 가전 구매력의 실질 기준</b></>, lg: <>식품·전기 물가 급등기엔 가처분소득이 필수재로 쏠려 <b className="font-semibold">가전 구매 이연 → 보급형·프로모 방어</b> · 물가 둔화 국면엔 프리미엄 전환 수요 회복</> }}
      kpiDefs={[
        { key: "INF_all_items", label: "전체 물가", fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_food", label: "식품", fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_rice", label: "쌀", fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_electricity", label: "전기", fmt: (v) => v + "%", tone: "rose" },
        { key: "oil_diesel", label: "경유", fmt: (v) => "₱" + v.toFixed(1), tone: "amber" },
        { key: "meralco_residential_rate", label: "전기료", fmt: (v) => "₱" + v.toFixed(2), tone: "amber" },
      ]}
      sections={[
        { key: "cpi", label: "소비자물가", node: <>
      {allI.series.length > 0 && (
        <ChartCard seg="CE" title="전체 물가 (헤드라인 CPI)" unit="전년비 %" labels={allI.labels} series={allI.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="전체" b />}
          meaning={<>헤드라인 물가 상승률 — <b className="text-gray-700 dark:text-gray-200">가처분소득·재량지출 여력의 직접 결정</b></>}
          ai={<>전체 물가 4% 상회 시 필수재 쏠림 → <b className="font-semibold text-amber-600 dark:text-amber-400">가전 구매 이연</b>, 둔화 국면엔 재량소비·프리미엄 전환 회복. <b>트렌드</b>: 2018 6%대(쌀·유가)→2020~21 2%대 안정→2022~23 6~8% 재급등(식품·에너지)→2024초 둔화 후 2025 쌀·식품發 재상승.</>}
          tone="rose" src={src("PSA CPI 상승률(전체) · 월별")} />
      )}
      {food.series.length > 0 && (
        <ChartCard seg="CE" title="식품 물가" unit="전년비 %" labels={food.labels} series={food.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.rose} t="식품" b />}
          meaning={<>식품 물가 상승률 — <b className="text-gray-700 dark:text-gray-200">가계 필수지출의 최대 항목</b></>}
          ai={<>식품 물가 급등은 저·중소득 가처분소득을 직접 잠식 → <b className="font-semibold text-amber-600 dark:text-amber-400">보급형 가전 구매력 위축</b>, 둔화 시 회복 선행</>}
          tone="rose" src={src("PSA CPI 상승률(식품) · 월별")} />
      )}
      {rice.series.length > 0 && (
        <ChartCard seg="CE" title="쌀 물가" unit="전년비 %" labels={rice.labels} series={rice.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.amber} t="쌀" b />}
          meaning={<>주식(쌀) 물가 상승률 — <b className="text-gray-700 dark:text-gray-200">체감물가·정책 민감도 최고 품목</b></>}
          ai={<>쌀값 급등은 체감물가·정책개입(수입관세·상한제)을 촉발 → <b className="font-semibold text-amber-600 dark:text-amber-400">소비심리 위축 신호</b>, 안정 시 재량소비 여력 반등. <b>트렌드</b>: 2023~24 쌀값 두 자릿수 급등(엘니뇨·수출제한·관세) 후 2025 관세인하로 둔화 — 체감물가의 핵심 변동요인.</>}
          tone="amber" src={src("PSA CPI 상승률(쌀) · 월별")} />
      )}
      {dine.series.length > 0 && (
        <ChartCard seg="CE" title="외식·숙박 vs 전체 물가" unit="전년비 %" labels={dine.labels} series={dine.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="외식·숙박" b /><Lg c={C.brown} t="전체 물가" /></>}
          meaning={<>서비스 물가 대표(외식) — <b className="text-gray-700 dark:text-gray-200">서비스發 물가 압력·근원물가 방향</b></>}
          ai={<>외식 물가가 전체보다 높으면 <b className="font-semibold text-amber-600 dark:text-amber-400">서비스發 끈적한 물가</b> → 금리 인하 지연·구매력 회복 지체 신호</>}
          tone="rose" src={src("PSA CPI 상승률(외식·숙박) · 월별")} />
      )}
        </> },
        { key: "energy", label: "에너지·주거", node: <>
      {energy.series.length > 0 && (
        <ChartCard seg="CE" title="에너지·이동 물가 (전기·LPG·운송)" unit="전년비 %" labels={energy.labels} series={energy.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="전기" b /><Lg c={C.rose} t="LPG" /><Lg c={C.blue} t="운송" /></>}
          meaning={<>에너지·이동 비용 상승률 — <b className="text-gray-700 dark:text-gray-200">가전 사용비용·고효율 소구력</b></>}
          ai={<>전기·LPG 물가 상승기엔 <b className="font-semibold text-emerald-600 dark:text-emerald-400">인버터·고효율 프리미엄 소구</b> 유리 → 에너지 절감액을 판매 메시지로</>}
          tone="rose" src={src("PSA CPI 상승률(전기·LPG·운송) · 월별")} />
      )}
      {home.series.length > 0 && (
        <ChartCard seg="CE" title="주거·내구재 물가 (주거·가전·에어컨)" unit="전년비 %" labels={home.labels} series={home.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="주거·공공요금" b /><Lg c={C.emer} t="가전" /><Lg c={C.rose} t="에어컨" /></>}
          meaning={<>주거·가전 물가 상승률 — <b className="text-gray-700 dark:text-gray-200">가전의 상대적 가격 매력</b></>}
          ai={<>가전 물가가 전체·주거보다 낮으면 <b className="font-semibold text-emerald-600 dark:text-emerald-400">실질 저렴 → 구매 매력↑</b>, 높으면 보급형·프로모 강화</>}
          tone="rose" src={src("PSA CPI 상승률(주거·가전·에어컨) · 월별")} />
      )}
      {elec.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="가정용 전기요금 (Meralco)" unit="₱/kWh · 월별" labels={elec.labels} series={elec.series} decimals={2} seriesUnit="₱"
          legend={<Lg c={C.ind} t="가정용 전기료" b />}
          meaning={<>실제 전기요금 수준 — <b className="text-gray-700 dark:text-gray-200">가전 사용비용의 절대 기준</b></>}
          ai={<>전기료 상승 추세엔 <b className="font-semibold text-emerald-600 dark:text-emerald-400">고효율·인버터 프리미엄 소구</b>가 유효 → TCO(총소유비용) 절감 메시지 강화</>}
          tone="amber" src={src("Meralco 가정용 요금 · 월별")} />
      )}
        </> },
        { key: "oil", label: "유가", node: <>
      {oil.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="유가 (경유·휘발유·등유)" unit="₱/L · 월별" labels={oil.labels} series={oil.series} decimals={1} seriesUnit="₱"
          legend={<><Lg c={C.ind} t="경유" b /><Lg c={C.rose} t="휘발유" /><Lg c={C.amber} t="등유" /></>}
          meaning={<>국내 종류별 소매 유가 — <b className="text-gray-700 dark:text-gray-200">운송·물류·전기료·물가 상류 동인</b></>}
          ai={<>유가 상승은 운송·물류·전기료로 전이돼 <b className="font-semibold text-amber-600 dark:text-amber-400">가전 물류원가·소비자 물가 동반 압박</b> → 조달·판가 선제 점검, 하락기엔 원가 여유·프로모 여력</>}
          tone="amber" src={src("DOE 주간 유가(oil_prices) · 월평균")} />
      )}
      {gas.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="휘발유 등급별 (RON95·RON91)" unit="₱/L · 월별" labels={gas.labels} series={gas.series} decimals={1} seriesUnit="₱"
          legend={<><Lg c={C.ind} t="RON95" b /><Lg c={C.rose} t="RON91" /></>}
          meaning={<>휘발유 등급별 소매가 — <b className="text-gray-700 dark:text-gray-200">이동·물류비 세부 동인</b></>}
          ai={<>휘발유가 상승은 방문설치·A/S 물류비와 소비자 이동비용을 함께 압박 → <b className="font-semibold text-amber-600 dark:text-amber-400">서비스 물류원가·체감 구매력 점검</b>, 하락기엔 프로모 여력</>}
          tone="amber" src={src("DOE 주간 유가(RON95·RON91) · 월평균")} />
      )}
        </> },
      ]} />
  )
}
