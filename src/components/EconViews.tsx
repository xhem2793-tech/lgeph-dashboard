"use client"

import React, { useEffect, useState } from "react"
import { macroMonthly, upcomingAgenda, seaCompare, marketEstimates, regionMetric } from "@/lib/supabase"
import type { AgendaItem, CalEvent } from "@/lib/supabase"
import EventModal from "@/components/EventModal"
import type { MktEst } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"
import { ChartCard, Lg, SLine, fmtLabels } from "@/components/EconChart"
import GdpComposition from "@/components/GdpComposition"
import { T } from "@/lib/i18n"

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
type BannerDef = { headline?: React.ReactNode; lg?: React.ReactNode; summary?: (kv: Kv, asOf: string) => React.ReactNode }
function Banner({ headline, lg, summary, d, kpiDefs }: BannerDef & { d: Mon; kpiDefs?: KpiDef[] }) {
  const [open, setOpen] = useState(false)
  const items = (kpiDefs ?? []).map((k) => ({ ...k, cur: latestOf(d, k.key) })).filter((k) => k.cur)
  const kv: Kv = {}; let asOf = ""
  items.forEach((k) => { kv[k.key] = k.cur!.v; if (!asOf || k.cur!.date > asOf) asOf = k.cur!.date })
  const now = new Date(); const nowLbl = String(now.getFullYear()).slice(2) + "." + (now.getMonth() + 1) // 현재 월 기준(지표가 과거여도)
  const line = summary && items.length ? summary(kv, asOf) : headline
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50/60 dark:bg-indigo-500/[0.08]" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
      <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer select-none items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-gray-700 dark:text-gray-200">{line}</div>
        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{T("기준", "As of")} {nowLbl}</span>
        {lg && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-400 dark:text-indigo-300 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>}
      </div>
      {lg && (
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.22,1,.36,1)" }}>
          <div className="overflow-hidden">
            <div className="border-t border-indigo-100/70 dark:border-indigo-500/25 px-4 pb-3.5 pt-3">
              <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                <span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">{T("LG 관점", "LG View")}</span>
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
    <div className="rounded-xl p-4" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both", animationDelay: "80ms" }}>
      <header className="flex items-baseline justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5">
        <h2 className="text-[14.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("예정 일정", "Upcoming Schedule")}</h2>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{T("2주간", "2 weeks")}</span>
      </header>
      <div className="mt-2 flex flex-col">
        {ev.map((x, i) => {
          const dd = dday(x.date)
          return (
            <div key={x.label + x.date} onClick={() => x.ev && setSel(x.ev)} style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both", animationDelay: 40 + i * 24 + "ms" }} className={"flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-all duration-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 " + (x.ev ? "cursor-pointer hover:-translate-y-px active:scale-[.99]" : "")}>
              <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + x.dot} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-gray-900 dark:text-gray-50">{x.label}</span>
                <span className="block text-[10.5px] text-gray-500 dark:text-gray-400">{x.note}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[11px] font-semibold text-gray-500 dark:text-gray-400">{dd === 0 ? T("오늘", "Today") : dd > 0 ? "D-" + dd : "D+" + -dd}</span>
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
function Shell({ title, win, setWin, loaded, empty, banner, kpiDefs, d, children, sections }: { title: string; sub?: string; win: string; setWin: (k: string) => void; loaded: boolean; empty: boolean; banner?: BannerDef; kpiDefs?: KpiDef[]; d: Mon; children?: React.ReactNode; sections?: Section[]; accent?: string }) {
  const [activeSub, setActiveSub] = useState(sections?.[0]?.key ?? "")
  const curSub = sections?.find((s) => s.key === activeSub) ?? sections?.[0]
  // 적응형 토글 — 뷰의 실제 데이터 기간(년)보다 긴 창은 숨김(5년치 데이터 없는데 5Y 토글 노출 방지)
  // 기간 토글은 전 뷰 동일하게 1Y/2Y/5Y/전체(10Y) 고정 노출(데이터 부족해도 있는 만큼 표시)
  const winOpts = WIN
  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      {/* 카테고리별 인사이트 배너 — 잠깐 숨김(추후 재노출 시 false 제거) */}
      {false && banner && <Banner {...banner} d={d} kpiDefs={loaded ? kpiDefs : undefined} />}
      <div className="grid items-start gap-4">
        <section className="min-w-0" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
          {/* 헤더 라인 — 좌: 하위 카테고리 선택 버튼, 우: 기간토글(동일 선상). 카테고리명은 위 섹션 헤더와 중복이라 sr-only */}
          <header className="mb-3.5 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <h2 className="sr-only">{title}</h2>
            {loaded && !empty && sections && sections.length > 1 && (
              <nav className="flex flex-wrap gap-1.5">
                {sections.map((s) => (
                  <button key={s.key} type="button" onClick={() => setActiveSub(s.key)}
                    className={"rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 " + (activeSub === s.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400")}>
                    {s.label}
                  </button>
                ))}
              </nav>
            )}
            <span className="ml-auto">
              <Segmented size="sm" value={win} onChange={setWin} options={winOpts.map((w) => ({ k: w.k, label: w.k === "전체" ? T("전체", "All") : w.k }))} />
            </span>
          </header>
          {!loaded ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" />)}
            </div>
          ) : empty ? (
            <div className="flex h-52 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 text-center">
              <div className="text-[13.5px] font-bold text-gray-500 dark:text-gray-400">{T("데이터 적재 대기", "Awaiting Data Load")}</div>
              <div className="text-[12px] text-gray-400 dark:text-gray-500">{T("해당 지표가 아직 Supabase에 없음 · 수집 후 자동 표시", "Indicator not yet in Supabase · Auto-displays once collected")}</div>
            </div>
          ) : (
            <div key={activeSub} className="grid items-stretch gap-4 sm:grid-cols-2" style={{ animation: "fadeUp .35s cubic-bezier(.22,1,.36,1) both" }}>{sections ? curSub?.node : children}</div>
          )}
        </section>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">{T("출처 PSA·BSP 공식통계(Supabase macro_indicators) · 색=사업영향(원가·부담↑ rose, 수요·구매력↑ emerald)", "Source: PSA·BSP official statistics (Supabase macro_indicators) · Color = business impact (cost/burden↑ rose, demand/purchasing power↑ emerald)")}</p>
    </div>
  )
}

const src = (s: string) => (<><b className="font-semibold text-gray-500 dark:text-gray-400">{T("자료", "Source")}</b> {s}</>)

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
    <div className="relative z-0 col-span-full flex flex-col rounded-xl p-3.5" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("가전시장·이커머스 규모 (다중기관 추정)", "Appliance Market & E-commerce Size (Multi-source Estimates)")}</h3>
        <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">{T("추정·민간자료", "Estimate · Private")}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="ml-auto text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{open ? T("근거 접기", "Hide Sources") : `${T("근거", "Sources")} ${appl.length + ec.length}${T("건 ▾", " ▾")}`}</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ra && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{T("가전시장 규모(추정 범위, ", "Appliance Market Size (est. range, ")}{ra.n}{T("개 기관)", " sources)")}</p>
            <p className="text-[21.5px] font-extrabold tabular-nums text-gray-900 dark:text-gray-50">${ra.lo.toFixed(1)}~{ra.hi.toFixed(1)}<span className="text-[12px] font-semibold text-gray-400">B</span> <span className="text-[12px] font-medium text-gray-400">{T("중앙값", "Median")} ${ra.med.toFixed(1)}B</span></p>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{T("주요 3사 Panasonic·Samsung·LG · 전자매장 47% · ", "Top 3: Panasonic·Samsung·LG · Electronics stores 47% · ")}<b className="text-indigo-600 dark:text-indigo-400">{T("LG ThinQ 프리미엄 50%", "LG ThinQ premium 50%")}</b></p>
          </div>
        )}
        {re && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{T("이커머스 규모(추정 범위, ", "E-commerce Size (est. range, ")}{re.n}{T("개 기관)", " sources)")}</p>
            <p className="text-[21.5px] font-extrabold tabular-nums text-gray-900 dark:text-gray-50">${re.lo.toFixed(1)}~{re.hi.toFixed(1)}<span className="text-[12px] font-semibold text-gray-400">B</span> <span className="text-[12px] font-medium text-gray-400">{T("중앙값", "Median")} ${re.med.toFixed(1)}B</span></p>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{T("주간 온라인구매 57% · Shopee·Lazada 양강 · 가전 온라인 침투 확대", "Weekly online purchases 57% · Shopee·Lazada duopoly · Appliance online penetration rising")}</p>
          </div>
        )}
      </div>
      {open && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
          <table className="w-full min-w-[520px] text-[11px]">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10px] uppercase text-gray-400 dark:text-gray-500"><th className="px-3 py-1.5">{T("지표", "Indicator")}</th><th className="px-2 py-1.5">{T("기관", "Source")}</th><th className="px-2 py-1.5 text-right">{T("추정값", "Estimate")}</th><th className="px-2 py-1.5">{T("범위/비고", "Range/Note")}</th><th className="px-2 py-1.5 text-right">{T("원본", "Link")}</th></tr></thead>
            <tbody>
              {[...appl, ...ec].map((e, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{e.metric === "ecommerce" ? T("이커머스", "E-commerce") : T("가전시장", "Appliances")}</td>
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
      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {T("민간 리서치는 기관별 편차가 커 ", "Private research varies widely by firm, so judge by ")}<b className="text-amber-600 dark:text-amber-400">{T("단일 숫자보다 범위·중앙값", "range & median rather than a single figure")}</b>{T("으로 판단 — 방향성(연 7%대 성장·프리미엄/온라인 확대)은 일치. 정밀 규모는 내부 셀아웃·GfK 실측 연동 시 확정.", " — direction (~7% annual growth, premium/online expansion) is consistent. Precise size to be confirmed once linked to internal sell-out & GfK actuals.")}</p>
      <div className="mt-2 pt-1 text-[10px] text-gray-400 dark:text-gray-500">{src(T("Grand View Research·Statista·IMARC·Mordor·GII 등 다중기관 · 민간자료(추정)", "Grand View Research·Statista·IMARC·Mordor·GII et al. (multi-source) · Private data (estimate)"))}</div>
    </div>
  )
}
// 단면(cross-sectional) 바 카드 — 보유율·연령구조 등 시점 스냅샷용 공용
function CrossBarCard({ d, items, title, seg, unit, meaning, ai, source, sort = true }: { d: Mon; items: { key: string; name: string }[]; title: string; seg: string; unit: string; meaning: React.ReactNode; ai: React.ReactNode; source: string; sort?: boolean }) {
  let rows = items.map((it) => ({ ...it, v: latestOf(d, it.key)?.v ?? 0 })).filter((r) => r.v > 0)
  if (sort) rows = rows.sort((a, b) => b.v - a.v)
  if (!rows.length) return null
  return (
    <div className="relative z-0 flex h-full flex-col rounded-xl p-3.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{seg}</span>
        <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-gray-600 dark:text-gray-300">{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              <div className="absolute inset-y-0 left-0 rounded bg-indigo-500" style={{ width: r.v + "%", transition: "width .8s cubic-bezier(.22,1,.36,1) " + (i * 0.06) + "s" }} />
            </div>
            <span className="w-11 shrink-0 text-right text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{r.v.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 min-h-[34px] text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {meaning}</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">{T("LG 인사이트", "LG Insight")}</b> {ai}</p></div>
      <div className="mt-auto pt-2.5 text-[10px] text-gray-400 dark:text-gray-500">{src(source)}</div>
    </div>
  )
}
// 가전 보유율(침투율) — PSA 2020 센서스 단면. 낮을수록 성장여력↑
// 렌더 시점 생성(언어 토글 반영) — 모듈 최상위 T()는 import 시 굳음
const buildOwnItems = (): { key: string; name: string }[] => [
  { key: "appl_own_cool", name: T("냉방·선풍기", "Cooling·Fans") }, { key: "appl_own_tv", name: "TV" },
  { key: "appl_own_ref", name: T("냉장고", "Refrigerator") }, { key: "appl_own_wash", name: T("세탁기", "Washer") }, { key: "appl_own_mobile", name: T("휴대폰", "Mobile Phone") },
]
function OwnershipCard({ d }: { d: Mon }) {
  const rows = buildOwnItems().map((it) => ({ ...it, v: latestOf(d, it.key)?.v ?? 0 })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v)
  if (!rows.length) return null
  return (
    <div className="relative z-0 flex h-full flex-col rounded-xl p-3.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("가전 보유율 (침투율)", "Appliance Ownership (Penetration)")}</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CE</span>
        <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{T("가구 % · 2020", "% of households · 2020")}</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-gray-600 dark:text-gray-300">{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              <div className="absolute inset-y-0 left-0 rounded bg-indigo-500" style={{ width: r.v + "%", transition: "width .8s cubic-bezier(.22,1,.36,1) " + (i * 0.06) + "s" }} />
            </div>
            <span className="w-11 shrink-0 text-right text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{r.v.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 min-h-[34px] text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {T("가구 보유율 = 시장 침투율. ", "Household ownership = market penetration. ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("냉장고 46%·세탁기 43% = 성장여력 최대", "Refrigerator 46% · Washer 43% = greatest growth headroom")}</b> {T("(미보유 과반)", "(majority not yet owning)")}</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">{T("LG 인사이트", "LG Insight")}</b> {T("저침투(냉장고·세탁기)는 ", "Low penetration (refrigerator·washer) means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("초도수요 헤드룸 = 보급형 볼륨존", "first-purchase headroom = entry-level volume zone")}</b>{T(", 고침투(TV·냉방)는 교체·프리미엄 업그레이드 시장", "; high penetration (TV·cooling) is a replacement/premium-upgrade market")}</p></div>
      <div className="mt-auto pt-2.5 text-[10px] text-gray-400 dark:text-gray-500">{src(T("PSA 2020 인구주택총조사 · 가구편의", "PSA 2020 Census of Population & Housing · Household amenities"))}</div>
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
    <div className="col-span-full flex flex-col rounded-xl p-3.5" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("지역별 보유율 (침투 격차)", "Ownership by Region (Penetration Gap)")}</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CE</span>
        <span className="ml-1 inline-flex items-center rounded-full bg-gray-200/80 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] dark:bg-gray-800/80 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] text-[11px] font-semibold">
          {([["ref", T("냉장고", "Refrigerator")], ["tv", "TV"]] as const).map(([k, lbl]) => <button key={k} type="button" onClick={() => setAp(k)} className={"rounded-full px-2.5 py-0.5 transition-all duration-200 active:scale-[.93] " + (ap === k ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.04)] text-gray-900 dark:bg-gray-950 dark:text-gray-50" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>{lbl}</button>)}
        </span>
        <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{T("가구 % · 2022 · 전국 ", "% of households · 2022 · National ")}{nat}%</span>
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {rows.map((r, i) => { const below = r.v < nat
          return (
            <div key={r.g} className="flex items-center gap-2" title={`${r.g} · ${r.v}%`}>
              <span className="w-12 shrink-0 truncate text-right text-[10.5px] font-medium text-gray-500 dark:text-gray-400">{r.s}</span>
              <span className="relative h-4 min-w-0 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                <span className="block h-full rounded" style={{ width: (r.v / max * 100) + "%", background: below ? C.amber : C.ind, animation: "growX .6s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.05 + i * 0.02) + "s", transformOrigin: "left center" }} />
                <span className="absolute inset-y-0" style={{ left: (nat / max * 100) + "%", width: "1px", background: "rgba(120,120,140,.55)" }} />
              </span>
              <span className={"w-8 shrink-0 text-right text-[10.5px] font-semibold tabular-nums " + (below ? "text-amber-600 dark:text-amber-400" : "text-gray-700 dark:text-gray-200")}>{r.v}%</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {T("지역별 가구 보유율 — ", "Household ownership by region — ")}<b className="text-amber-600 dark:text-amber-400">{T("전국(", "below national (")}{nat}{T("%) 하회(주황) = 침투 여력", "%) (amber) = penetration headroom")}</b>{T(", 세로선=전국 평균", "; vertical line = national average")}</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">{T("LG 인사이트", "LG Insight")}</b> {ap === "ref" ? T("냉장고", "Refrigerator") : "TV"} {T("최저 ", "lowest ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{low.s}({low.v}%)</b> {T("vs 최고 ", "vs highest ")}{high.s}({high.v}%) — <b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("저침투 지역(민다나오·MIMAROPA·비콜)은 보급형 볼륨존·유통망 확대 기회", "Low-penetration regions (Mindanao·MIMAROPA·Bicol) are entry-level volume zones with channel-expansion opportunity")}</b>{T(", 고침투 지역(NCR·루손)은 교체·프리미엄 중심. 전기보급·소득과 함께 저침투 지역이 다음 성장축.", "; high-penetration regions (NCR·Luzon) center on replacement/premium. Alongside electrification & income, low-penetration regions are the next growth axis.")}</p></div>
      <p className="mt-2.5 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-500 dark:text-gray-400">{T("자료", "Source")}</b> {T("PSA 2022 가구 가전 보유(지역별) · 전국=2020 인구주택총조사", "PSA 2022 Household Appliance Ownership (by region) · National = 2020 Census of Population & Housing")}</p>
    </div>
  )
}
const PRODS = ["전체", "냉장고", "세탁·건조", "에어컨(RAC)", "TV·AV", "공조(B2B)", "모니터·사이니지"]
// 제품 필터 표시 라벨 — 키(한글)는 로직 유지, EN 표시만(함수라 렌더 시점 반영)
const PROD_EN: Record<string, string> = { "전체": "All", "냉장고": "REF", "세탁·건조": "Laundry", "에어컨(RAC)": "RAC", "TV·AV": "TV·AV", "공조(B2B)": "HVAC (B2B)", "모니터·사이니지": "Monitor·Signage" }
const prodLabel = (p: string) => T(p, PROD_EN[p] ?? p)
export function ApplianceView() {
  const [win, setWin] = useState("2Y")
  const [prod, setProd] = useState("전체")
  const { d, loaded } = useMacro(APPLIANCE_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  // 제품 필터 — '전 제품' 태그(원가·수입·전기 등 공통지표)는 항상 표시, 제품특정 지표는 해당 제품 선택 시만
  const show = (tags: string[]) => prod === "전체" || tags.includes("전 제품") || tags.includes(prod)
  const ppi = build(d, n, [{ key: "PPI_domestic_appliances", name: T("가전 PPI", "Appliance PPI"), color: C.ind, w: 2 }, { key: "PPI_electrical", name: T("전기기기", "Electrical equipment"), color: C.rose }, { key: "PPI_electronics", name: T("전자", "Electronics"), color: C.blue }, { key: "PPI_manufacturing", name: T("제조업 전체", "Total manufacturing"), color: C.brown }])
  const imp = build(d, n, [{ key: "imports_home_appliances", name: T("가전", "Appliances"), color: C.ind, w: 2, tf: (v) => v / 1e6 }, { key: "imports_consumer_electronics", name: T("소비자전자", "Consumer electronics"), color: C.rose, tf: (v) => v / 1e6 }, { key: "imports_telecom", name: T("통신기기", "Telecom equipment"), color: C.blue, tf: (v) => v / 1e6 }]) // USD→백만$ (연간 무역통계)
  const inf = build(d, n, [{ key: "INF_household_appliances", name: T("가전 물가", "Appliance CPI"), color: C.ind, w: 2 }, { key: "INF_aircon", name: T("에어컨", "Air conditioner"), color: C.rose }, { key: "INF_all_items", name: T("전체 CPI", "Headline CPI"), color: C.brown }])
  const elec = build(d, n, [{ key: "meralco_residential_rate", name: T("가정용 전기료", "Residential electricity rate"), color: C.ind, w: 2 }])
  const cdd = build(d, n, [{ key: "cdd_monthly", name: T("냉방도일 CDD", "Cooling Degree Days (CDD)"), color: C.rose, w: 2 }]) // 에어컨 수요 선행
  const energy = build(d, n, [{ key: "energy_households", name: T("가정용 에너지소비", "Household energy consumption"), color: C.ind, w: 2 }]) // ktoe, 연간
  const elecpc = build(d, n, [{ key: "elec_consumption_pc", name: T("1인당 전력소비", "Electricity use per capita"), color: C.ind, w: 2 }]) // kWh/인, 연간
  const empty = !ppi.series.length && !imp.series.length && !inf.series.length && !elec.series.length && !cdd.series.length
  return (
    <Shell title={T("가전 선행지표", "Appliance Leading Indicators")} sub={T("생산자물가·수입액·가전물가·전기료 — 원가·공급 선행", "PPI · Imports · Appliance CPI · Electricity — cost & supply leading")} win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="indigo"
      banner={{ summary: (kv) => <>{T("가전 물가 ", "Appliance CPI ")}{B(f1(kv.INF_household_appliances) + "%")}{T("·에어컨 ", " · AC ")}{B(f1(kv.INF_aircon) + "%")}{T("·가전 PPI ", " · Appliance PPI ")}{B(f1(kv.PPI_domestic_appliances) + "%")}{T(", 전기료 ", ", Electricity ")}{B("₱" + f1(kv.meralco_residential_rate))} — {(kv.PPI_domestic_appliances ?? 0) > 2 ? T("원가·소매가 상방 압박", "Upward pressure on cost & retail price") : T("원가·가전물가 안정 국면", "Cost & appliance prices stable")}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">{T("가전 원가·공급 선행지표", "Appliance Cost & Supply Leading Indicators")}</b></>, lg: <>{T("PPI·수입 급등은 원가·중국계 물량 신호 → ", "PPI/import spikes signal cost pressure & Chinese-brand volume → ")}<b className="font-semibold">{T("조달 헤지·프로모 타이밍", "procurement hedging & promo timing")}</b>{T(" 선제 대응 · 전기료↑엔 고효율 프리미엄 소구", " pre-emptively · when electricity rises, pitch high-efficiency premium")}</> }}
      kpiDefs={[
        { key: "INF_household_appliances", label: T("가전 물가 YoY", "Appliance CPI YoY"), fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_aircon", label: T("에어컨 물가 YoY", "AC CPI YoY"), fmt: (v) => v + "%", tone: "rose" },
        { key: "PPI_domestic_appliances", label: T("가전 PPI YoY", "Appliance PPI YoY"), fmt: (v) => v + "%", tone: "rose" },
        { key: "meralco_residential_rate", label: T("전기료", "Electricity"), fmt: (v) => "₱" + v.toFixed(2), tone: "amber" },
      ]}>
      {false && <MarketCard />}
      <div className="col-span-full -mt-1 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("제품", "Product")}</span>
        {PRODS.map((p) => <button key={p} type="button" onClick={() => setProd(p)} className={"rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all " + (prod === p ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-teal-500/15")}>{prodLabel(p)}</button>)}
      </div>
      {show(["전 제품"]) && <OwnershipCard d={d} />}
      {false && <RegionOwnCard />}{/* 지역별 보유율 — 지도(RegionMap)에 반영 예정, 잠시 숨김 */}
      {show(["전 제품"]) && ppi.series.length > 0 && (
        <ChartCard seg={T("전 제품·CE·B2B", "All Products·CE·B2B")} title={T("가전 생산자물가 PPI", "Appliance Producer Price Index (PPI)")} unit={T("전년비 %", "YoY %")} labels={ppi.labels} series={ppi.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("가전 PPI", "Appliance PPI")} b /><Lg c={C.rose} t={T("전기기기", "Electrical equipment")} /><Lg c={C.blue} t={T("전자", "Electronics")} /><Lg c={C.brown} t={T("제조업 전체", "Total manufacturing")} /></>}
          meaning={<>{T("생산단계 출고가격 상승률 — ", "Factory-gate price growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("소비자가·조달원가의 수개월 선행", "leads retail price & procurement cost by several months")}</b></>}
          ai={<>{T("가전 PPI가 제조업 전체보다 높으면 ", "When appliance PPI exceeds total manufacturing, ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("가전 특이 원가압력", "appliance-specific cost pressure")}</b>{T(" → 선제 판가·조달 대응·부품 헤지, 동행이면 경제 전반 원가 국면", " → pre-empt with pricing/procurement moves & component hedging; if in line, it is an economy-wide cost phase")}</>}
          tone="rose" src={src(T("PSA 생산자물가지수(PPI) · 월별", "PSA Producer Price Index (PPI) · Monthly"))} />
      )}
      {show(["전 제품"]) && imp.series.length > 0 && (
        <ChartCard seg={T("전 제품·CE·B2B", "All Products·CE·B2B")} title={T("가전·전자·통신 수입액", "Appliance/Electronics/Telecom Imports")} unit={T("백만$ · 연간", "US$M · Annual")} labels={imp.labels} series={imp.series} decimals={0} seriesUnit={T("백만$", "US$M")}
          legend={<><Lg c={C.ind} t={T("가전", "Appliances")} b /><Lg c={C.rose} t={T("소비자전자", "Consumer electronics")} /><Lg c={C.blue} t={T("통신기기", "Telecom equipment")} /></>}
          meaning={<>{T("가전·인접 카테고리 완제품 수입 규모 — ", "Finished-goods imports of appliances & adjacent categories — ")}<b className="text-gray-700 dark:text-gray-200">{T("시장 공급량·경쟁 강도 선행", "leads market supply & competitive intensity")}</b></>}
          ai={<>{T("수입 급증은 중국계 물량 유입 신호 → ", "Import surges signal an influx of Chinese-brand volume → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("채널 재고·가격 경쟁 압박", "pressure on channel inventory & price competition")}</b>{T(" · 소비자전자·통신 동반 확대는 스마트홈 연계 수요 신호", " · concurrent electronics/telecom growth signals smart-home-linked demand")}</>}
          tone="amber" src={src(T("PSA 수출입통계 · 연간", "PSA Foreign Trade Statistics · Annual"))} />
      )}
      {show(["전 제품", "에어컨(RAC)"]) && inf.series.length > 0 && (
        <ChartCard seg={T("가전·에어컨", "Appliances·AC")} title={T("가전 소비자물가 상승률", "Appliance Consumer Price Growth")} unit={T("전년비 %", "YoY %")} labels={inf.labels} series={inf.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("가전 물가", "Appliance CPI")} b /><Lg c={C.rose} t={T("에어컨", "Air conditioner")} /><Lg c={C.brown} t={T("전체 CPI", "Headline CPI")} /></>}
          meaning={<>{T("가전 소매물가 상승률 vs 전체 물가 — ", "Appliance retail price growth vs headline — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전의 실질 가격 매력", "real price appeal of appliances")}</b></>}
          ai={<>{T("가전 물가가 전체 CPI보다 낮으면 ", "When appliance CPI runs below headline, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("실질 저렴 → 구매 매력↑", "relatively cheaper → purchase appeal↑")}</b>{T(", 높으면 구매 저항 → 보급형·프로모 강화", "; when higher, purchase resistance → strengthen entry-level & promos")}</>}
          tone="rose" src={src(T("PSA CPI(가전·에어컨) · 전년비", "PSA CPI (appliances·AC) · YoY"))} />
      )}
      {show(["전 제품", "에어컨(RAC)", "냉장고", "공조(B2B)"]) && elec.series.length > 0 && (
        <ChartCard seg={T("에어컨·냉장고·공조", "AC·Ref·HVAC")} title={T("가정용 전기요금 (Meralco)", "Residential Electricity Rate (Meralco)")} unit="₱/kWh" labels={elec.labels} series={elec.series} decimals={2}
          legend={<Lg c={C.ind} t={T("가정용 전기료", "Residential electricity rate")} b />}
          meaning={<>{T("전기요금 = 가전 ", "Electricity rate determines appliance ")}<b className="text-gray-700 dark:text-gray-200">{T("사용비용·에너지효율 소구력", "running cost & energy-efficiency appeal")}</b> {T("결정", "")}</>}
          ai={<>{T("전기료 상승기엔 ", "During rising electricity rates, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("인버터·고효율 프리미엄 소구", "pitch inverter/high-efficiency premium")}</b>{T("가 유리 → 에너지 절감액을 판매 메시지로 전환", " works best → convert energy savings into a sales message")}</>}
          tone="amber" src={src(T("Meralco 가정용 요금 · 월별", "Meralco residential rate · Monthly"))} />
      )}
      {show(["에어컨(RAC)"]) && cdd.series.length > 0 && (
        <ChartCard seg={T("에어컨", "Air Conditioner")} title={T("냉방도일 (에어컨 수요 선행)", "Cooling Degree Days (AC Demand Leading)")} unit={T("CDD · 월별 · 기준24℃", "CDD · Monthly · Base 24°C")} labels={cdd.labels} series={cdd.series} decimals={0} seriesUnit="CDD"
          legend={<Lg c={C.rose} t={T("냉방도일 CDD", "Cooling Degree Days (CDD)")} b />}
          meaning={<>{T("냉방도일 = Σ(일평균기온−24℃) — ", "CDD = Σ(daily mean temp − 24°C) — ")}<b className="text-gray-700 dark:text-gray-200">{T("에어컨·냉장고 사용강도·판매 성수기 직접 선행", "directly leads AC/refrigerator usage intensity & the sales peak season")}</b></>}
          ai={<>{T("CDD 급등기(3~5월 혹서)는 ", "CDD spikes (Mar–May heat) mark the ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("에어컨·선풍기 판매 성수기", "AC/fan peak sales season")}</b>{T(" → 사전 재고·프로모 집중, 냉방 프리미엄(인버터) 소구 최적 · ", " → concentrate pre-stocking & promos; optimal window to pitch cooling premium (inverter) · ")}<b className="text-gray-500 dark:text-gray-400">{T("Open-Meteo 기온", "Open-Meteo temperature")}</b></>}
          tone="amber" src={src(T("Open-Meteo 메트로마닐라 기온 · 냉방도일 월집계", "Open-Meteo Metro Manila temperature · CDD monthly aggregation"))} />
      )}
      {show(["전 제품"]) && energy.series.length > 0 && (
        <ChartCard seg={T("전 제품", "All Products")} title={T("가정용 에너지소비", "Household Energy Consumption")} unit={T("ktoe · 연간", "ktoe · Annual")} kind="bar" labels={energy.labels} series={energy.series} decimals={0} seriesUnit="ktoe"
          legend={<Lg c={C.ind} t={T("가정용 에너지소비", "Household energy consumption")} b />}
          meaning={<>{T("가구부문 최종에너지소비 — ", "Household-sector final energy consumption — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 사용량·전력화 심화의 구조적 지표", "structural gauge of appliance usage & deepening electrification")}</b></>}
          ai={<>{T("가정용 에너지소비 증가는 ", "Rising household energy use means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가전 보유·사용 심화 = 시장 성숙", "deeper appliance ownership/use = market maturing")}</b>{T(" → 고효율·인버터 소구 여지 확대, 전력화 진전 지역 우선", " → wider room to pitch high-efficiency/inverter; prioritize regions advancing in electrification")}</>}
          tone="emerald" src={src(T("PSA 에너지통계 부문별 최종소비 · 연간", "PSA Energy Statistics final consumption by sector · Annual"))} />
      )}
      {show(["전 제품"]) && elecpc.series.length > 0 && (
        <ChartCard seg={T("전 제품", "All Products")} title={T("1인당 전력소비", "Electricity Use per Capita")} unit={T("kWh/인 · 연간", "kWh/person · Annual")} labels={elecpc.labels} series={elecpc.series} decimals={0} seriesUnit="kWh"
          legend={<Lg c={C.ind} t={T("1인당 전력소비", "Electricity use per capita")} b />}
          meaning={<>{T("국민 1인당 연간 전력사용량 — ", "Annual electricity use per capita — ")}<b className="text-gray-700 dark:text-gray-200">{T("전력화·가전 보유 심화 프록시", "proxy for electrification & deepening appliance ownership")}</b></>}
          ai={<>{T("필리핀 1인당 전력소비는 ", "Philippine per-capita electricity use is ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("900kWh대로 태국(약 3,000)·말련(약 5,000)의 1/3 이하", "around 900 kWh, under 1/3 of Thailand (~3,000) or Malaysia (~5,000)")}</b> = <b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가전 보급·대형화 성장여력이 큰 저변", "a base with large headroom for appliance uptake & up-sizing")}</b>{T(". ", ". ")}<b>{T("트렌드", "Trend")}</b>{T(": 소득 증가와 함께 완만한 우상향 — 냉장고·에어컨 등 상시가동 가전 확산의 구조적 순풍, 다만 高전기료가 고효율 수요를 동시에 자극.", ": gently rising with income — a structural tailwind for the spread of always-on appliances (refrigerators, AC), though high electricity rates simultaneously stoke demand for high efficiency.")}</>}
          tone="emerald" src={src(T("World Bank WDI 1인당 전력소비(EG.USE.ELEC.KH.PC) · 연간", "World Bank WDI electricity use per capita (EG.USE.ELEC.KH.PC) · Annual"))} />
      )}
      {show(["전 제품", "냉장고", "세탁기", "에어컨(RAC)", "TV"]) && (
        <ChartCard seg={T("전 제품·CE", "All Products·CE")} title={T("품목별 가전 수입 규모 (HS)", "Appliance Imports by Category (HS)")} unit={T("백만$ · 연간", "US$M · Annual")} labels={HS_YRS} series={[{ name: T("에어컨", "Air conditioner"), color: C.rose, w: 2, data: HS_TOTALS.ac }, { name: T("냉장고", "Refrigerator"), color: C.ind, w: 2, data: HS_TOTALS.ref }, { name: T("TV·모니터", "TV·Monitor"), color: C.blue, data: HS_TOTALS.tv }, { name: T("세탁기", "Washer"), color: C.emer, data: HS_TOTALS.wash }]} decimals={0} seriesUnit={T("백만$", "US$M")}
          legend={<><Lg c={C.rose} t={T("에어컨", "Air conditioner")} b /><Lg c={C.ind} t={T("냉장고", "Refrigerator")} b /><Lg c={C.blue} t={T("TV·모니터", "TV·Monitor")} /><Lg c={C.emer} t={T("세탁기", "Washer")} /></>}
          meaning={<>{T("HS코드별 완제품 수입액 — ", "Finished-goods imports by HS code — ")}<b className="text-gray-700 dark:text-gray-200">{T("품목별 공급 규모·성장", "supply size & growth by category")}</b></>}
          ai={<>{T("에어컨 수입이 ", "AC imports grew ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("2015 $205M→2024 $666M(3.2배)", "$205M (2015) → $666M (2024), 3.2×")}</b>{T("로 최대·최고성장(냉방수요·기후) → 에어컨 라인 우선순위. 냉장고·세탁기도 견조, TV는 최근 정체. ", " — the largest & fastest (cooling demand & climate) → prioritize the AC line. Refrigerator/washer also solid; TV recently flat. ")}<b>{T("트렌드", "Trend")}</b>{T(": 전 품목 우상향, 코로나(2020) 일시 조정 후 회복.", ": all categories trend up, recovering after a temporary 2020 (COVID) dip.")}</>}
          tone="amber" src={src(T("UN Comtrade 필리핀 수입액 HS 8415·8418·8450·8528 · 연간", "UN Comtrade Philippine imports HS 8415·8418·8450·8528 · Annual"))} />
      )}
      {(() => {
        const hcat = PROD_HS[prod] // 전체=집계, 특정 제품=해당 HS 원산지
        const og = hcat ? HS_ORIGIN_CAT[hcat] : HS_ORIGIN
        const scope = hcat ? prod : T("4품목 합산", "4-item total")
        const lastKr = og.kr[og.kr.length - 1], lastCn = og.cn[og.cn.length - 1], firstCn = og.cn[0]
        return (
        <ChartCard seg={T("전 제품·CE·B2B", "All Products·CE·B2B")} title={T("가전 수입 원산지 점유율", "Appliance Import Origin Share") + (hcat ? " · " + prod : "")} unit={T("% · 연간(", "% · Annual(") + scope + ")"} labels={HS_YRS} series={[{ name: T("중국", "China"), color: C.rose, w: 2.4, data: og.cn }, { name: T("태국", "Thailand"), color: C.amber, data: og.th }, { name: T("베트남", "Vietnam"), color: C.emer, data: og.vn }, { name: T("한국", "Korea"), color: C.ind, w: 2, data: og.kr }]} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.rose} t={T("중국", "China")} b /><Lg c={C.amber} t={T("태국", "Thailand")} /><Lg c={C.emer} t={T("베트남", "Vietnam")} /><Lg c={C.ind} t={T("한국", "Korea")} b /></>}
          meaning={<>{hcat ? prod : T("가전", "Appliances")} {T("수입 원산지 구성 — ", "import origin mix — ")}<b className="text-gray-700 dark:text-gray-200">{T("경쟁 원산지·조달 구조", "competing origins & sourcing structure")}</b>{hcat ? "" : T(" · 제품 필터로 품목별 전환", " · switch by category via the product filter")}</>}
          ai={<>{T("중국이 ", "China rose ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{firstCn}%→{lastCn}%</b>{T("로 상승, ", ", while ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("한국은 ", "Korea is ")}{lastKr}%</b> = {hcat === "wash" ? T("세탁기는 그나마 한국 9%대·베트남 급상승(20%)", "for washers Korea holds ~9% while Vietnam surges (20%)") : hcat === "tv" ? T("TV는 베트남(27%)이 중국 다음 2위, 한국 0.5%로 최저", "for TVs Vietnam (27%) is #2 after China, Korea lowest at 0.5%") : hcat === "ac" ? T("에어컨은 태국(22%)이 중국 다음 조달허브, 한국 3%대", "for AC Thailand (22%) is the sourcing hub after China, Korea ~3%") : hcat === "ref" ? T("냉장고는 중국 57%로 편중 최고, 한국 2%대 최저", "refrigerators are most China-concentrated at 57%, Korea lowest ~2%") : T("필리핀 완제품 시장을 중국계가 장악", "Chinese brands dominate the Philippine finished-goods market")}{T(". LG는 ", ". LG must either ")}<b className="font-semibold">{T("현지·역내(태국·베트남) 생산·조달로 원가·물류 대응", "manage cost/logistics via local/regional (Thailand·Vietnam) production & sourcing")}</b>{T("하거나 고효율·프리미엄 차별화가 관건.", " or differentiate on high-efficiency/premium — that is the key.")}</>}
          tone="rose" src={src(T("UN Comtrade 원산지별 수입액 · 연간", "UN Comtrade imports by origin · Annual") + (hcat ? " (HS " + ({ ref: "8418", ac: "8415", wash: "8450", tv: "8528" }[hcat]) + ")" : T(" (4품목 합산)", " (4-item total)")))} />
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
  const pol = build(d, n, [{ key: "policy_rate_monthly", name: T("정책금리 RRP", "Policy rate (RRP)"), color: C.ind, w: 2 }, { key: "interbank_call_rate", name: T("시장금리(콜)", "Market rate (call)"), color: C.rose }]) // 정책금리+시장금리 월별
  const loan = build(d, n, [{ key: "consumer_loan_growth_yoy", name: T("소비자대출", "Consumer loans"), color: C.ind, w: 2 }, { key: "bank_loan_growth_yoy", name: T("은행 총대출", "Total bank loans"), color: C.blue }])
  const m3 = build(d, n, [{ key: "m3_growth_yoy", name: T("광의통화(M3)", "Broad money (M3)"), color: C.ind, w: 2 }]) // IMF IFS 월별 YoY
  const credit = build(d, n, [{ key: "domestic_credit_pct_gdp", name: T("민간신용(%GDP)", "Private credit (%GDP)"), color: C.ind, w: 2 }])
  const cab = build(d, n, [{ key: "current_account_pct_gdp", name: T("경상수지(%GDP)", "Current account (%GDP)"), color: C.ind, w: 2 }]) // 대외균형, 연간
  const fdi = build(d, n, [{ key: "fdi_net_inflow_usd", name: T("FDI 순유입", "FDI net inflow"), color: C.emer, w: 2, tf: (v) => v / 1e9 }]) // USD→십억$, 연간
  const trade = build(d, n, [{ key: "exports_gdp", name: T("수출", "Exports"), color: C.emer, w: 2 }, { key: "imports_gdp", name: T("수입", "Imports"), color: C.rose }, { key: "trade_balance_gdp", name: T("무역수지", "Trade balance"), color: C.ind, w: 2 }]) // %GDP
  const reserves = build(d, n, [{ key: "reserves_usd", name: T("외환보유액", "FX reserves"), color: C.ind, w: 2, tf: (v) => v / 1e9 }]) // USD→십억$
  const govt = build(d, n, [{ key: "govt_exp_gdp", name: T("정부지출", "Govt expenditure"), color: C.ind, w: 2 }, { key: "services_pct_gdp", name: T("서비스업 비중", "Services share"), color: C.emer }]) // %GDP
  const cards = build(d, n, [{ key: "credit_card_ownership", name: T("신용카드 보유", "Credit card ownership"), color: C.ind, w: 2 }, { key: "debit_card_ownership", name: T("직불카드 보유", "Debit card ownership"), color: C.blue }, { key: "account_ownership", name: T("계좌 보유", "Account ownership"), color: C.emer }]) // Findex 연간 %
  const finuse = build(d, n, [{ key: "borrowed_any_pct", name: T("차입 경험", "Borrowed (any)"), color: C.rose, w: 2 }, { key: "saved_at_fi_pct", name: T("금융기관 저축", "Saved at a financial institution"), color: C.emer }]) // Findex 연간 %
  const fisc = build(d, n, [{ key: "govt_debt_gdp", name: T("정부부채", "Govt debt"), color: C.rose, w: 2 }, { key: "gross_savings_gdp", name: T("총저축률", "Gross savings"), color: C.emer }, { key: "tax_revenue_gdp", name: T("조세수입", "Tax revenue"), color: C.ind }]) // %GDP 연간
  const mktcap = build(d, n, [{ key: "market_cap_gdp", name: T("주식 시가총액", "Market cap"), color: C.ind, w: 2 }]) // %GDP 연간
  const psei = build(d, n, [{ key: "psei_index", name: T("PSEi 지수", "PSEi index"), color: C.ind, w: 2 }]) // 월말 종가, 지수
  const npl = build(d, n, [{ key: "npl_ratio", name: T("NPL 비율", "NPL ratio"), color: C.rose, w: 2 }]) // 은행 부실채권비율 %, 연간
  const empty = !pol.series.length && !loan.series.length && !m3.series.length && !credit.series.length && !cab.series.length && !fdi.series.length && !trade.series.length && !reserves.series.length && !govt.series.length
  return (
    <Shell title={T("통화·금리·신용", "Money, Rates & Credit")} sub={T("기준금리·통화량 M3·가계신용 — 할부·카드 구매력", "Policy rate · M3 · Household credit — installment/card purchasing power")} win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="indigo"
      banner={{ summary: (kv) => <>{T("정책금리 ", "Policy rate ")}{B(f1(kv.BSP_policy_rate) + "%")}·M3 {B(f1(kv.m3_growth_yoy) + "%")}{T(", 소비자대출 ", ", Consumer loans ")}{B(f1(kv.consumer_loan_growth_yoy) + "%")}{T("·카드 ", " · Card ")}{B(f1(kv.credit_card_loan_growth_yoy) + "%")}{T("·총대출 ", " · Total loans ")}{B(f1(kv.bank_loan_growth_yoy) + "%")} — {(kv.BSP_policy_rate ?? 9) < 6 ? T("금리 인하·신용 확장이 할부 수요 뒷받침", "Rate cuts & credit expansion support installment demand") : T("고금리로 할부 부담 지속", "High rates keep installment burden elevated")}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">{T("통화·신용 = 가전 구매력 엔진", "Money & Credit = the Appliance Purchasing-Power Engine")}</b></>, lg: <>{T("금리 인하·카드/소비자대출 확장기엔 ", "During rate cuts & card/consumer-loan expansion, ")}<b className="font-semibold">{T("무이자 할부·프리미엄 푸시", "0% installments & premium push")}</b>{T("가 유효 · 콜금리 급등 시 유통 운전자금 부담 관찰", " work well · watch channel working-capital strain when call rates spike")}</> }}
      kpiDefs={[
        { key: "BSP_policy_rate", label: T("정책금리 RRP", "Policy rate (RRP)"), fmt: (v) => v + "%", tone: "amber" },
        { key: "m3_growth_yoy", label: T("통화량 M3", "Money supply M3"), fmt: (v) => v + "%", tone: "emerald" },
        { key: "consumer_loan_growth_yoy", label: T("소비자대출", "Consumer loans"), fmt: (v) => v + "%", tone: "emerald" },
        { key: "credit_card_loan_growth_yoy", label: T("신용카드 대출", "Credit card loans"), fmt: (v) => v + "%", tone: "emerald" },
        { key: "credit_card_ownership", label: T("신용카드 보유율", "Credit card ownership"), fmt: (v) => v + "%", tone: "rose" },
      ]}
      sections={[
        { key: "rate_credit", label: T("금리·신용", "Rates·Credit"), node: <>
      {pol.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("정책금리·시장금리", "Policy Rate vs Market Rate")} unit={T("% · 월별", "% · Monthly")} labels={pol.labels} series={pol.series} decimals={2} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("정책금리 RRP", "Policy rate (RRP)")} b /><Lg c={C.rose} t={T("시장금리(콜)", "Market rate (call)")} /></>}
          meaning={<>{T("정책금리 vs 시장금리 — ", "Policy vs market rate — ")}<b className="text-gray-700 dark:text-gray-200">{T("할부·소비자 금융비용의 기준·자금시장 긴장도", "the benchmark for installment/consumer financing cost & funding-market stress")}</b></>}
          ai={<>{T("금리 인하기엔 ", "During rate cuts, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("할부·카드 이자 부담↓ = 가전 구매력↑", "installment/card interest burden↓ = appliance purchasing power↑")}</b>{T(" · 시장금리 급등 시 유통 운전자금 부담 관찰. ", " · watch channel working-capital strain when market rates spike. ")}<b>{T("트렌드", "Trend")}</b>{T(": BSP 정책금리 2022~23 급인상(2%→6.5%, 물가·페소 방어) 후 2024말~2025 인하 개시 = 할부 여건 개선 국면 진입.", ": BSP hiked sharply in 2022–23 (2%→6.5%, defending prices & the peso), then began cutting from late-2024 into 2025 = entering a phase of improving installment conditions.")}</>}
          tone="amber" src={src(T("BSP 정책금리(RRP) · IMF IFS 시장금리 · 월별", "BSP policy rate (RRP) · IMF IFS market rate · Monthly"))} />
      )}
      {loan.series.length > 0 && (
        <ChartCard seg="CE" title={T("가계·기업 대출 증가율", "Household & Corporate Loan Growth")} unit={T("전년비 % · 월별", "YoY % · Monthly")} labels={loan.labels} series={loan.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("소비자대출", "Consumer loans")} b /><Lg c={C.blue} t={T("은행 총대출", "Total bank loans")} /></>}
          meaning={<>{T("소비자·총대출 증가율 — ", "Consumer & total loan growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 할부 구매의 직접 재원", "the direct funding for appliance installment purchases")}</b></>}
          ai={<>{T("소비자대출 확대는 ", "Rising consumer loans ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("내구재 할부 수요 선행", "lead durable-goods installment demand")}</b>{T(" → 신용 확장기에 프리미엄·대형 라인업 푸시", " → push premium/large lineups during credit expansion")}</>}
          tone="emerald" src={src(T("BSP 대출통계(소비자·총대출) · 월별", "BSP loan statistics (consumer·total) · Monthly"))} />
      )}
      {credit.series.length > 0 && (
        <ChartCard seg="CE" title={T("민간신용 침투 (% GDP)", "Private Credit Penetration (% GDP)")} unit={T("% GDP · 연간", "% GDP · Annual")} labels={credit.labels} series={credit.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("민간신용(%GDP)", "Private credit (%GDP)")} b />}
          meaning={<>{T("GDP 대비 민간신용 잔액 — ", "Private credit outstanding vs GDP — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 할부·카드 구매의 구조적 여력", "structural capacity for appliance installment/card purchases")}</b></>}
          ai={<>{T("신용침투는 10년간 28%→50% 확대 = ", "Credit penetration widened 28%→50% over a decade = ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("할부·카드 기반 내구재 구매 여력 구조적 상승", "a structural rise in installment/card-based durable-goods capacity")}</b>{T(" → 프리미엄 할부 프로모 지속 유효", " → premium installment promos remain effective")}</>}
          tone="emerald" src={src(T("World Bank 민간신용(%GDP) · 연간 · 월별 대출증가율은 상단 KPI", "World Bank private credit (%GDP) · Annual · monthly loan growth in top KPIs"))} />
      )}
        </> },
        { key: "consumer_fin", label: T("소비 금융·결제", "Consumer Finance·Payments"), node: <>
      {cards.series.length > 0 && (
        <ChartCard seg="CE" title={T("카드·계좌 보급률", "Card & Account Ownership")} unit={T("% 성인 · 연간", "% of adults · Annual")} labels={cards.labels} series={cards.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("신용카드 보유", "Credit card ownership")} b /><Lg c={C.blue} t={T("직불카드 보유", "Debit card ownership")} /><Lg c={C.emer} t={T("계좌 보유", "Account ownership")} /></>}
          meaning={<>{T("성인 카드·계좌 보유율(Findex) — ", "Adult card & account ownership (Findex) — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 결제·할부 수단의 구조", "the structure of appliance payment/installment channels")}</b></>}
          ai={<>{T("계좌보유는 27%→50%로 급등했으나 ", "Account ownership jumped 27%→50%, but ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("신용카드는 3%대로 정체", "credit cards stall at ~3%")}</b>{T(" → 카드 무이자할부보다 ", " → rather than card 0% installments, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("리테일러·핀테크 할부(BNPL)·현금·직불 중심", "retailer/fintech installments (BNPL), cash & debit-centric")}</b>{T(" 판매금융 설계가 시장 특성에 부합. ", " sales financing fits the market. ")}<b>{T("트렌드", "Trend")}</b>{T(": 계좌·카드 모두 2021년 급등(팬데믹 정부지원금 계좌지급·디지털드라이브)했다가 카드는 2024년 반락 — 계좌는 유지, 결제는 e-wallet으로 이동.", ": both surged in 2021 (pandemic subsidy account disbursement & digital drive); cards fell back by 2024 — accounts held, payments shifting to e-wallets.")}</>}
          tone="rose" src={src(T("World Bank Global Findex 카드·계좌 보유율 · 격년(2011~2024)", "World Bank Global Findex card & account ownership · Biennial (2011–2024)"))} />
      )}
      {finuse.series.length > 0 && (
        <ChartCard seg="CE" title={T("차입·저축 행태", "Borrowing & Saving Behavior")} unit={T("% 성인 · 연간", "% of adults · Annual")} labels={finuse.labels} series={finuse.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.rose} t={T("차입 경험", "Borrowed (any)")} b /><Lg c={C.emer} t={T("금융기관 저축", "Saved at a financial institution")} /></>}
          meaning={<>{T("성인 차입·저축 경험율(Findex) — ", "Adult borrowing & saving incidence (Findex) — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 구매 자금조달 성향", "how appliance purchases are financed")}</b></>}
          ai={<>{T("차입율 ", "Borrowing is high at ")}<b className="font-semibold">72%</b>{T("로 높지만 대부분 ", ", but mostly via ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("가족·비공식 채널", "family/informal channels")}</b>{T("(카드 3%뿐) → 저축률 상승기·송금 유입기에 대형가전 수요, ", " (cards only 3%) → big-appliance demand rises with savings & remittance inflows; ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("유연 할부·계약금 낮춘 상품", "flexible installments & low-down-payment offers")}</b>{T("이 전환 견인. ", " drive conversion. ")}<b>{T("트렌드", "Trend")}</b>{T(": 차입율은 2017·2021 하락 후 2024년 72%로 재상승(물가·생활비 압박), 금융기관 저축률은 12%(2017)→24%(2024) 꾸준히 개선.", ": borrowing fell in 2017/2021 then rebounded to 72% in 2024 (price/cost-of-living pressure); saving at institutions steadily improved 12% (2017) → 24% (2024).")}</>}
          tone="emerald" src={src(T("World Bank Global Findex 차입·저축율 · 격년(2011~2024)", "World Bank Global Findex borrowing & saving rates · Biennial (2011–2024)"))} />
      )}
        </> },
        { key: "fiscal_cap", label: T("재정·자본시장", "Fiscal·Capital Markets"), node: <>
      {fisc.series.length > 0 && (
        <ChartCard seg="B2B" title={T("정부재정 (부채·저축·조세)", "Public Finance (Debt·Savings·Tax)")} unit={T("% GDP · 연간", "% GDP · Annual")} labels={fisc.labels} series={fisc.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.rose} t={T("정부부채", "Govt debt")} b /><Lg c={C.emer} t={T("총저축률", "Gross savings")} /><Lg c={C.ind} t={T("조세수입", "Tax revenue")} /></>}
          meaning={<>{T("재정 건전성·저축여력 — ", "Fiscal health & saving capacity — ")}<b className="text-gray-700 dark:text-gray-200">{T("거시 안정성·중장기 소비기반", "macro stability & the medium-term consumption base")}</b></>}
          ai={<>{T("총저축률 30%대는 ", "Gross savings around 30% is a ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("내구재 구매 잠재재원", "latent funding pool for durable purchases")}</b>{T(". ", ". ")}<b>{T("트렌드", "Trend")}</b>{T(": 정부부채 2018년 40%까지 하락했다가 ", ": govt debt fell to 40% by 2018, then ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("코로나로 61%(2022) 급등", "spiked to 61% (2022) on COVID")}</b>{T(" 후 유지 — 조세수입 14%대로 낮아 재정여력 제약, 증세·인프라 지출이 B2B 수요 변수.", " and held — tax revenue is low (~14%), constraining fiscal room; tax hikes & infra spending are swing factors for B2B demand.")}</>}
          tone="amber" src={src(T("World Bank WDI(저축·조세) · Bureau of Treasury(부채) · 연간", "World Bank WDI (savings·tax) · Bureau of Treasury (debt) · Annual"))} />
      )}
      {mktcap.series.length > 0 && (
        <ChartCard seg="B2B" title={T("주식 시가총액 (자본시장)", "Stock Market Cap (Capital Markets)")} unit={T("% GDP · 연간", "% GDP · Annual")} labels={mktcap.labels} series={mktcap.series} decimals={0} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("주식 시가총액(%GDP)", "Market cap (%GDP)")} b />}
          meaning={<>{T("상장주식 시총/GDP — ", "Listed market cap / GDP — ")}<b className="text-gray-700 dark:text-gray-200">{T("자본시장 깊이·자산효과", "capital-market depth & wealth effect")}</b></>}
          ai={<>{T("시총/GDP는 ", "Market cap/GDP has been ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("2007 피크(~70%) 후 하락세(~48%)", "declining (~48%) since its 2007 peak (~70%)")}</b>{T(" = 자본시장 상대적 정체 → 소비는 자산효과보다 ", " = relative capital-market stagnation → consumption relies structurally on ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("소득·송금 의존", "income & remittances")}</b>{T("이 구조적.", " more than the wealth effect.")}</>}
          tone="amber" src={src(T("World Bank WDI 상장주식 시가총액(%GDP) · 연간", "World Bank WDI listed market cap (%GDP) · Annual"))} />
      )}
      {psei.series.length > 0 && (
        <ChartCard seg="B2B" title={T("PSEi 주가지수 (월말)", "PSEi Stock Index (Month-end)")} unit={T("지수 · 월별", "Index · Monthly")} labels={psei.labels} series={psei.series} decimals={0} seriesUnit=""
          legend={<Lg c={C.ind} t={T("PSEi 종합지수", "PSEi composite index")} b />}
          meaning={<>{T("필리핀 증시 종합지수 — ", "Philippine composite stock index — ")}<b className="text-gray-700 dark:text-gray-200">{T("투자심리·자산효과·경기 선행", "investor sentiment, wealth effect & cycle leading")}</b></>}
          ai={<>{T("PSEi는 ", "The PSEi has been ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("2015년 7,700선 → 2026년 6,000대", "range-bound: ~7,700 (2015) → ~6,000 (2026)")}</b>{T("로 장기 박스권·정체 = 자산효과 제한적. ", ", a long stagnation = limited wealth effect. ")}<b>{T("트렌드", "Trend")}</b>{T(": 2020년 코로나 급락(4,000대) 후 회복했으나 고금리·외국인 이탈로 ", ": it recovered from the 2020 COVID plunge (~4,000) but, on high rates & foreign outflows, ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("2026년 상반기 5,700대까지 재하락", "fell again to ~5,700 in H1 2026")}</b>{T(" 후 반등 — 증시보다 소득·송금이 소비 동력.", " before rebounding — income & remittances, not equities, drive consumption.")}</>}
          tone="amber" src={src(T("PSE(필리핀증권거래소) 종합지수 · Yahoo Finance 월말 종가", "PSE (Philippine Stock Exchange) composite · Yahoo Finance month-end close"))} />
      )}
      {npl.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("은행 부실채권(NPL) 비율", "Bank Non-Performing Loan (NPL) Ratio")} unit={T("% · 연간", "% · Annual")} labels={npl.labels} series={npl.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.rose} t={T("NPL 비율(총대출 대비)", "NPL ratio (of total loans)")} b />}
          meaning={<>{T("은행 총여신 중 부실채권 비중 — ", "Share of non-performing loans in total bank credit — ")}<b className="text-gray-700 dark:text-gray-200">{T("가계·기업 상환능력·금융안정", "household/corporate repayment capacity & financial stability")}</b></>}
          ai={<>{T("NPL이 ", "When NPLs are ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("3%대로 낮고 안정", "low & stable around 3%")}</b>{T("이면 은행이 소비자·카드·할부 여신을 공격적으로 늘릴 여력 → ", ", banks have room to expand consumer/card/installment credit → ")}<b className="font-semibold">{T("무이자 할부·BNPL 확대에 우호적", "favorable to expanding 0% installments & BNPL")}</b>{T(". ", ". ")}<b>{T("트렌드", "Trend")}</b>{T(": 팬데믹기 2021년 4%대로 상승했다가 ", ": rose to ~4% in pandemic-era 2021, then ")}<b className="font-semibold">{T("2025년 3.0%로 안정 복귀", "returned to a stable 3.0% in 2025")}</b>{T(" — 신용 리스크 완화로 가전 할부 수요 뒷받침. 급등 반전 시 유통 여신·연체 선행 경보로 활용.", " — easing credit risk supports appliance installment demand. A sharp reversal serves as an early warning for channel credit & delinquencies.")}</>}
          tone="emerald" src={src(T("World Bank WDI 은행 NPL 비율(FB.AST.NPER.ZS) · 연간", "World Bank WDI bank NPL ratio (FB.AST.NPER.ZS) · Annual"))} />
      )}
        </> },
        { key: "money_ext", label: T("통화·대외", "Money·External"), node: <>
      {m3.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("통화량 M3 증가율", "Money Supply M3 Growth")} unit={T("전년비 % · 월별", "YoY % · Monthly")} labels={m3.labels} series={m3.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("광의통화(M3)", "Broad money (M3)")} b />}
          meaning={<>{T("시중 유동성(M3) 증가율 — ", "Liquidity (M3) growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("소비여력·신용 확대 여지", "room for consumption capacity & credit expansion")}</b></>}
          ai={<>{T("M3 확대는 유동성·소비여력 개선 신호 → ", "M3 expansion signals improving liquidity & spending capacity → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("수요 회복 국면", "a demand-recovery phase")}</b>{T(" 판단의 거시 배경", " as macro backdrop")}</>}
          tone="emerald" src={src(T("IMF IFS 광의통화(M3) · 월별 YoY", "IMF IFS broad money (M3) · Monthly YoY"))} />
      )}
      {cab.series.length > 0 && (
        <ChartCard seg="B2B" title={T("경상수지 (% GDP)", "Current Account (% GDP)")} unit={T("% GDP · 연간", "% GDP · Annual")} kind="bar" labels={cab.labels} series={cab.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("경상수지(%GDP)", "Current account (%GDP)")} b />}
          meaning={<>{T("대외 경상수지 균형 — ", "External current-account balance — ")}<b className="text-gray-700 dark:text-gray-200">{T("페소 환율·수입원가의 구조적 압력", "structural pressure on the peso & import costs")}</b></>}
          ai={<>{T("경상수지 적자 확대는 ", "A widening current-account deficit means ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("페소 약세·수입 가전 원가 상승 압력", "peso weakness & upward pressure on imported-appliance costs")}</b>{T(" → 조달 헤지·판가 방어 점검, 흑자 전환 시 원가 여유", " → review procurement hedging & price defense; a surplus eases cost pressure")}</>}
          tone="amber" src={src(T("BSP·World Bank 경상수지(%GDP) · 연간", "BSP·World Bank current account (%GDP) · Annual"))} />
      )}
      {fdi.series.length > 0 && (
        <ChartCard seg="B2B" title={T("외국인직접투자 순유입 (FDI)", "Net Foreign Direct Investment (FDI)")} unit={T("십억$ · 연간", "US$B · Annual")} kind="bar" labels={fdi.labels} series={fdi.series} decimals={1} seriesUnit={T("십억$", "US$B")}
          legend={<Lg c={C.emer} t={T("FDI 순유입", "FDI net inflow")} b />}
          meaning={<>{T("FDI 순유입 규모 — ", "Net FDI inflow — ")}<b className="text-gray-700 dark:text-gray-200">{T("투자심리·중장기 소득·고용 기반", "investor sentiment & the medium-term income/employment base")}</b></>}
          ai={<>{T("FDI 확대는 고용·소득·소비 기반 강화 = ", "Rising FDI strengthens the jobs/income/consumption base = ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("중장기 가전 수요 저변 확장", "expanding the medium-term appliance demand base")}</b>{T(", 급감 시 투자·내수 둔화 경계", "; a sharp drop warns of slowing investment & domestic demand")}</>}
          tone="emerald" src={src(T("BSP·World Bank FDI 순유입 · 연간", "BSP·World Bank net FDI inflow · Annual"))} />
      )}
      {trade.series.length > 0 && (
        <ChartCard seg="B2B" title={T("대외거래 (수출·수입·무역수지)", "External Trade (Exports·Imports·Balance)")} unit={T("% GDP · 연간", "% GDP · Annual")} labels={trade.labels} series={trade.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.emer} t={T("수출", "Exports")} b /><Lg c={C.rose} t={T("수입", "Imports")} /><Lg c={C.ind} t={T("무역수지", "Trade balance")} /></>}
          meaning={<>{T("수출·수입·무역수지 — ", "Exports, imports & trade balance — ")}<b className="text-gray-700 dark:text-gray-200">{T("페소 환율·수입 가전 원가의 구조적 압력", "structural pressure on the peso & imported-appliance costs")}</b></>}
          ai={<>{T("수입 초과(무역적자 지속)은 ", "A persistent trade deficit (import surplus) means ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("페소 약세·수입가전 원가 상승 압력", "peso weakness & rising imported-appliance costs")}</b>{T(" → 현지조달·판가 헤지, 수출 회복 시 원가 완화", " → localize sourcing & hedge pricing; an export recovery eases costs")}</>}
          tone="amber" src={src(T("World Bank 수출입·무역수지(%GDP) · 연간", "World Bank trade & balance (%GDP) · Annual"))} />
      )}
      {reserves.series.length > 0 && (
        <ChartCard seg="B2B" title={T("외환보유액", "FX Reserves")} unit={T("십억$ · 연간", "US$B · Annual")} kind="bar" labels={reserves.labels} series={reserves.series} decimals={0} seriesUnit={T("십억$", "US$B")}
          legend={<Lg c={C.ind} t={T("외환보유액", "FX reserves")} b />}
          meaning={<>{T("외환보유고 — ", "Foreign-exchange reserves — ")}<b className="text-gray-700 dark:text-gray-200">{T("페소 방어력·수입결제 안정성", "peso defense capacity & import-payment stability")}</b></>}
          ai={<>{T("외환보유 충분은 ", "Ample reserves mean ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("페소 안정·수입가전 원가 예측성", "peso stability & predictable imported-appliance costs")}</b>{T(" → 조달·판가 안정, 급감 시 환리스크·수입비용 변동성 경계", " → stable sourcing & pricing; a sharp drop warns of FX risk & import-cost volatility")}</>}
          tone="emerald" src={src(T("World Bank·BSP 외환보유액 · 연간", "World Bank·BSP FX reserves · Annual"))} />
      )}
      {govt.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("정부지출·서비스업 비중", "Govt Spending & Services Share")} unit={T("% GDP · 연간", "% GDP · Annual")} labels={govt.labels} series={govt.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("정부지출", "Govt expenditure")} b /><Lg c={C.emer} t={T("서비스업 비중", "Services share")} /></>}
          meaning={<>{T("정부지출·서비스업 GDP비중 — ", "Govt spending & services' GDP share — ")}<b className="text-gray-700 dark:text-gray-200">{T("도시가구·B2B 수요 기반", "the urban-household & B2B demand base")}</b></>}
          ai={<>{T("서비스업 비중 확대·정부 인프라 지출은 ", "A rising services share & govt infrastructure spending underpin ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("도시화·사무실·상업용 가전 수요 저변", "urbanization and office/commercial appliance demand")}</b>{T(" → B2B·프리미엄 도시시장 성장", " → growth in B2B & premium urban markets")}</>}
          tone="emerald" src={src(T("World Bank 정부지출·서비스업 비중(%GDP) · 연간", "World Bank govt spending & services share (%GDP) · Annual"))} />
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
// 렌더 시점 생성(언어 토글 반영) — 모듈 최상위 T()는 import 시 굳음
const buildSeaSpecs = (): Spec[] => [
  { key: "Philippines", name: T("필리핀", "Philippines"), color: C.ind, w: 2.4, endLabel: T("필리핀", "Philippines") },
  { key: "Indonesia", name: T("인니", "Indonesia"), color: C.rose },
  { key: "Thailand", name: T("태국", "Thailand"), color: C.blue },
  { key: "Vietnam", name: T("베트남", "Vietnam"), color: C.emer },
  { key: "Malaysia", name: T("말련", "Malaysia"), color: C.amber },
]
export function GrowthView() {
  const SEA_SPECS = buildSeaSpecs()
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(GROWTH_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const [sea, setSea] = useState<Record<string, Mon>>({})
  useEffect(() => { Promise.all(["gdp_per_capita_ppp", "gdp_per_capita_usd", "gdp_total_ppp"].map((k) => seaCompare(k).then((r) => [k, r] as const))).then((rs) => setSea(Object.fromEntries(rs))) }, [])
  const seaPPP = build(sea.gdp_per_capita_ppp ?? {}, n, SEA_SPECS.map((s) => ({ ...s, tf: (v: number) => v / 1000 })))
  const seaNom = build(sea.gdp_per_capita_usd ?? {}, n, SEA_SPECS.map((s) => ({ ...s, tf: (v: number) => v / 1000 })))
  const seaTot = build(sea.gdp_total_ppp ?? {}, n, SEA_SPECS.map((s) => ({ ...s, tf: (v: number) => v / 1e9 })))
  // 같은 단위(전년비 %)끼리만 겹침 — 스케일 다른 지표(가동률 레벨·건축허가 금액)는 별도 카드로 분리
  const gdp = build(d, n, [{ key: "gdp_growth_yoy", name: T("GDP 성장률", "GDP growth"), color: C.ind, w: 2 }]) // GDP 단독(COVID 저점 등 스케일 독립)
  const demand = build(d, n, [{ key: "household_consumption_yoy", name: T("민간소비", "Private consumption"), color: C.ind, w: 2 }, { key: "gross_capital_formation_yoy", name: T("총투자", "Gross investment"), color: C.blue }])
  const cons = build(d, n, [{ key: "construction_gva_growth", name: T("건설 부가가치", "Construction GVA"), color: C.ind, w: 2 }, { key: "construction_gfcf_growth", name: T("건설 투자", "Construction investment"), color: C.violet }])
  const ind = build(d, n, [{ key: "industry_gva_yoy", name: T("산업", "Industry"), color: C.ind, w: 2 }, { key: "manufacturing_va_growth", name: T("제조업", "Manufacturing"), color: C.rose }])
  const cap = build(d, n, [{ key: "capacity_utilization", name: T("평균 가동률", "Avg capacity utilization"), color: C.amber, w: 2 }]) // 레벨(%) — 성장률과 축 분리
  const ret = build(d, n, [{ key: "wholesale_retail_trade_yoy", name: T("도소매 거래", "Wholesale & retail trade"), color: C.ind, w: 2 }, { key: "retail_gva_growth", name: T("소매 부가가치", "Retail GVA"), color: C.teal }, { key: "wholesale_gva_growth", name: T("도매 부가가치", "Wholesale GVA"), color: C.amber }])
  const permit = build(d, n, [{ key: "permits_nonresidential_floorarea", name: T("비주거 착공면적", "Non-residential floor area"), color: C.ind, w: 2, tf: (v) => v / 1e6 }])
  const permitV = build(d, n, [{ key: "permits_residential_value", name: T("주거 건축허가액", "Residential permit value"), color: C.violet, w: 2, tf: (v) => v / 1e6 }]) // 천PHP→십억₱
  const va = build(d, n, [{ key: "manufacturing_va_growth", name: T("제조업", "Manufacturing"), color: C.ind, w: 2 }, { key: "industry_gva_yoy", name: T("산업", "Industry"), color: C.rose }, { key: "services_gva_yoy", name: T("서비스", "Services"), color: C.emer }]) // 산업·서비스는 최신 vintage(gva_yoy)로 통일 — 구 va_growth와 값 불일치 제거
  const rsale = build(d, n, [{ key: "retail_sales_growth", name: T("소매판매 증가율", "Retail sales growth"), color: C.ind, w: 2 }]) // 연간 6년(COVID 저점)
  const pcap = build(d, n, [{ key: "gdp_per_capita_usd", name: T("1인당 GDP", "GDP per capita"), color: C.ind, w: 2 }]) // USD, 연간 — 구매력·시장규모
  const tour = build(d, n, [{ key: "tourism_arrivals", name: T("국제 관광객", "International tourists"), color: C.teal, w: 2 }]) // 백만명, 연간 — 서비스·소비 동력
  const office = build(d, n, [{ key: "office_vacancy_ncr", name: T("오피스 공실률", "Office vacancy rate"), color: C.rose, w: 2 }]) // 민간자료(Colliers)
  const rrepi = build(d, n, [{ key: "residential_property_price_yoy", name: T("명목", "Nominal"), color: C.ind, w: 2 }, { key: "residential_property_price_real_yoy", name: T("실질", "Real"), color: C.teal }]) // 주거용 부동산가격 상승률, 분기(BIS)
  const empty = !gdp.series.length && !demand.series.length && !cons.series.length && !ind.series.length && !cap.series.length && !ret.series.length && !permit.series.length && !permitV.series.length && !va.series.length && !rsale.series.length && !pcap.series.length && !office.series.length && !rrepi.series.length
  return (
    <Shell title={T("국민계정·성장", "National Accounts & Growth")} sub={T("GDP·소비·투자·건설허가·산업·유통 — 가전 수요 파이", "GDP · Consumption · Investment · Permits · Industry · Trade — the appliance demand pie")} win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ summary: (kv) => <>GDP {B(f1(kv.gdp_growth_yoy) + "%")}{T("·민간소비 ", " · Private consumption ")}{B(f1(kv.household_consumption_yoy) + "%")}{T("·투자 ", " · Investment ")}{B(f1(kv.gross_capital_formation_yoy) + "%")}{T(", 가동률 ", ", Capacity utilization ")}{B(f1(kv.capacity_utilization) + "%")} — {(kv.gdp_growth_yoy ?? 0) < 4 ? T("성장 둔화로 가전 수요 파이 축소 국면", "Slowing growth shrinks the appliance demand pie") : T("성장 견조, 수요 파이 확대 국면", "Solid growth, expanding demand pie")}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">{T("국민계정으로 본 가전 수요 파이", "The Appliance Demand Pie via National Accounts")}</b></>, lg: <>{T("민간소비·주거 착공 회복은 ", "Recovering private consumption & housing starts ")}<b className="font-semibold">{T("가전 신규수요 선행", "lead new appliance demand")}</b>{T(" → 성장 밀집 지역 채널·재고 선점, 둔화 시 보급형 방어", " → secure channels/inventory in growth-dense areas; during slowdowns, defend with entry-level")}</> }}
      kpiDefs={[
        { key: "gdp_growth_yoy", label: T("GDP 성장률", "GDP growth"), fmt: (v) => v + "%", tone: "emerald" },
        { key: "household_consumption_yoy", label: T("민간소비", "Private consumption"), fmt: (v) => v + "%", tone: "emerald" },
        { key: "gross_capital_formation_yoy", label: T("총투자", "Gross investment"), fmt: (v) => v + "%", tone: "emerald" },
        { key: "capacity_utilization", label: T("가동률", "Capacity utilization"), fmt: (v) => v + "%", tone: "amber" },
      ]}
      sections={[
        { key: "demand", label: T("수요·성장", "Demand·Growth"), node: <>
      {gdp.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("GDP 성장률", "GDP Growth")} unit={T("전년비 %", "YoY %")} kind="bar" labels={gdp.labels} series={gdp.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("GDP 성장률", "GDP growth")} b />}
          meaning={<>{T("실질 GDP 성장률 — ", "Real GDP growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 시장 전체 파이의 크기", "the size of the entire appliance-market pie")}</b></>}
          ai={<>{T("성장 둔화기엔 재량소비 위축 → ", "Slowdowns curb discretionary spending → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("보급형 방어", "defend with entry-level")}</b>{T(", 확장기엔 프리미엄·신규수요 가속. ", "; expansions accelerate premium & new demand. ")}<b>{T("트렌드", "Trend")}</b>{T(": 2020년 코로나로 ", ": on COVID in 2020 it ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("-9.5% 급락", "plunged -9.5%")}</b>{T("(역대 최악) 후 2022~2023 7%대 반등, 2024~ 5~6%대 안정 성장.", " (worst on record), then rebounded ~7% in 2022–23 and settled into steady 5–6% growth from 2024.")}</>}
          tone="emerald" src={src(T("PSA 국민계정 GDP · 분기/연", "PSA National Accounts GDP · Quarterly/Annual"))} />
      )}
      {demand.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("민간소비·총투자 성장률", "Private Consumption & Gross Investment Growth")} unit={T("전년비 %", "YoY %")} labels={demand.labels} series={demand.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("민간소비", "Private consumption")} b /><Lg c={C.blue} t={T("총투자", "Gross investment")} /></>}
          meaning={<>{T("내수 소비·투자 성장 — ", "Domestic consumption & investment growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 수요와 직결되는 지출 축", "the spending axis directly tied to appliance demand")}</b></>}
          ai={<>{T("민간소비 성장은 가전 수요와 직결 → ", "Private-consumption growth is directly tied to appliance demand → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("소비 확장기에 시장 성장 가속", "market growth accelerates during consumption expansion")}</b>{T(", 둔화 시 보급형 방어", "; defend with entry-level during slowdowns")}</>}
          tone="emerald" src={src(T("PSA 국민계정 GDE(소비·투자) · 분기/연", "PSA National Accounts GDE (consumption·investment) · Quarterly/Annual"))} />
      )}
      {pcap.series.length > 0 && (
        <ChartCard seg="CE" title={T("1인당 GDP", "GDP per Capita")} unit={T("US$ · 연간", "US$ · Annual")} kind="bar" labels={pcap.labels} series={pcap.series} decimals={0} seriesUnit="$"
          legend={<Lg c={C.ind} t={T("1인당 GDP", "GDP per capita")} b />}
          meaning={<>{T("1인당 명목 GDP — ", "Nominal GDP per capita — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 구매력·프리미엄 전환의 구조적 기반", "the structural base for appliance purchasing power & premium shift")}</b></>}
          ai={<>{T("1인당 GDP는 10년간 2,163$→4,171$로 상승 = ", "GDP per capita rose $2,163 → $4,171 over a decade = ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("중산층 확대·프리미엄 가전 침투 여력↑", "a growing middle class & rising room for premium-appliance penetration")}</b>{T(" → 상위 라인업·신가전 카테고리 확장 기회", " → opportunity to expand upper lineups & new appliance categories")}</>}
          tone="emerald" src={src(T("World Bank 1인당 GDP(명목) · 연간", "World Bank GDP per capita (nominal) · Annual"))} />
      )}
      {tour.series.length > 0 && (
        <ChartCard seg="CE" title={T("국제 관광객 입국자수", "International Tourist Arrivals")} unit={T("백만명 · 연간", "Million · Annual")} kind="bar" labels={tour.labels} series={tour.series} decimals={1} seriesUnit="M"
          legend={<Lg c={C.teal} t={T("국제 관광객(백만명)", "International tourists (million)")} b />}
          meaning={<>{T("연간 국제 방문객 수 — ", "Annual international visitors — ")}<b className="text-gray-700 dark:text-gray-200">{T("서비스·소매·숙박·리조트 B2B 수요", "services, retail, hospitality & resort B2B demand")}</b></>}
          ai={<>{T("관광 회복은 호텔·리조트·요식 ", "A tourism recovery stimulates hotel/resort/foodservice ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("B2B 가전(에어컨·냉장·주방)", "B2B appliances (AC, refrigeration, kitchen)")}</b>{T(" 및 관광지 소매 수요를 자극. ", " and destination retail demand. ")}<b>{T("트렌드", "Trend")}</b>{T(": 2019년 ", ": peaked at ")}<b>8.3M</b>{T(" 정점 → 2020~21 코로나로 ", " in 2019 → on COVID in 2020–21 it ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("0.2M까지 붕괴", "collapsed to 0.2M")}</b>{T(" → 2023 5.5M·2025 6.4M로 회복 중이나 아직 팬데믹 이전 미달 · 회복 지속 시 B2B·지방 소매 순풍.", " → recovering to 5.5M (2023) & 6.4M (2025) but still below pre-pandemic · continued recovery is a tailwind for B2B & provincial retail.")}</>}
          tone="emerald" src={src(T("World Bank(2005~2020)·필리핀 DOT(2021~2025) 국제 관광객 · 연간", "World Bank (2005–2020)·Philippine DOT (2021–2025) international tourists · Annual"))} />
      )}
        </> },
        { key: "industry", label: T("산업·생산", "Industry·Output"), node: <>
      <GdpComposition />
      {ind.series.length > 0 && (
        <ChartCard seg="B2B" title={T("산업·제조 성장률", "Industry & Manufacturing Growth")} unit={T("전년비 %", "YoY %")} labels={ind.labels} series={ind.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("산업", "Industry")} b /><Lg c={C.rose} t={T("제조업", "Manufacturing")} /></>}
          meaning={<>{T("산업·제조 생산 성장 — ", "Industrial & manufacturing output growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("현지 조달·공급망·경기 국면", "local sourcing, supply chain & cycle phase")}</b></>}
          ai={<>{T("제조업 둔화는 경기 하강 신호 → ", "A manufacturing slowdown signals a downturn → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("수요 위축 대비", "prepare for softening demand")}</b>{T(", 재고·판가 보수적 운영", "; run inventory & pricing conservatively")}</>}
          tone="amber" src={src(T("PSA 국민계정 산업·제조 GVA · 분기/연", "PSA National Accounts industry & manufacturing GVA · Quarterly/Annual"))} />
      )}
      {cap.series.length > 0 && (
        <ChartCard seg="B2B" title={T("평균 가동률", "Average Capacity Utilization")} unit={T("% (레벨)", "% (level)")} labels={cap.labels} series={cap.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.amber} t={T("평균 가동률", "Avg capacity utilization")} b />}
          meaning={<>{T("산업·건설 평균 설비 가동률 — ", "Average industry & construction capacity utilization — ")}<b className="text-gray-700 dark:text-gray-200">{T("공급 여력·경기 과열/둔화", "supply slack & overheating/slowdown")}</b></>}
          ai={<>{T("가동률 하락은 수요 둔화·유휴 신호 → ", "Falling utilization signals softening demand & idle capacity → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("보수적 재고·판가", "conservative inventory & pricing")}</b>{T(", 상승 지속 시 공급 병목 대비. ", "; sustained rises call for supply-bottleneck readiness. ")}<b>{T("트렌드", "Trend")}</b>{T(": 제조 가동률 2020년 코로나 저점 후 회복해 2024~ 77~79%대 안정(팬데믹 전 수준 상회).", ": manufacturing utilization recovered from the 2020 COVID trough to a stable 77–79% from 2024 (above pre-pandemic).")}</>}
          tone="amber" src={src(T("PSA 산업생산조사 가동률 · 월", "PSA Industry Production Survey utilization · Monthly"))} />
      )}
      {va.series.length > 0 && (
        <ChartCard seg="B2B" title={T("부문별 부가가치 성장", "Sector Value-Added Growth")} unit={T("전년비 %", "YoY %")} labels={va.labels} series={va.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("제조업", "Manufacturing")} b /><Lg c={C.rose} t={T("산업", "Industry")} /><Lg c={C.emer} t={T("서비스", "Services")} /></>}
          meaning={<>{T("제조·산업·서비스 부문 성장 — ", "Manufacturing, industry & services growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("B2B 수요처 업황·설비투자 여력", "B2B customer conditions & capex capacity")}</b></>}
          ai={<>{T("제조·서비스 업황 개선은 ", "Improving manufacturing & services conditions mean ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("기업 설비·시설 투자 여력", "corporate capex & facility-investment capacity")}</b>{T(" → B2B 상업용·산업용 수요 우호", " → favorable for B2B commercial/industrial demand")}</>}
          tone="emerald" src={src(T("PSA 국민계정 부문별 GVA · 연간", "PSA National Accounts sector GVA · Annual"))} />
      )}
        </> },
        { key: "construction", label: T("건설·투자", "Construction·Investment"), node: <>
      {cons.series.length > 0 && (
        <ChartCard seg="B2B" title={T("건설 부가가치·투자 성장", "Construction GVA & Investment Growth")} unit={T("전년비 %", "YoY %")} labels={cons.labels} series={cons.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("건설 부가가치", "Construction GVA")} b /><Lg c={C.violet} t={T("건설 투자", "Construction investment")} /></>}
          meaning={<>{T("건설 부문 성장 — ", "Construction-sector growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("빌트인·냉난방·신규 가전 수요의 6~12개월 선행", "leads built-in/HVAC/new-appliance demand by 6–12 months")}</b></>}
          ai={<>{T("건설 성장 가속은 ", "Accelerating construction ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("신규 가전·에어컨 수요 선행", "leads new appliance/AC demand")}</b>{T(" → 착공 밀집 지역에 채널·재고 선제 배치", " → pre-position channels/inventory in start-dense areas")}</>}
          tone="emerald" src={src(T("PSA 국민계정 건설 GVA·GFCF · 분기", "PSA National Accounts construction GVA·GFCF · Quarterly"))} />
      )}
      {permitV.series.length > 0 && (
        <ChartCard seg="B2B" title={T("주거 건축허가액", "Residential Building Permit Value")} unit={T("십억₱ · 분기", "₱B · Quarterly")} kind="bar" labels={permitV.labels} series={permitV.series} decimals={1} seriesUnit={T("십억₱", "₱B")}
          legend={<Lg c={C.violet} t={T("주거 건축허가액", "Residential permit value")} b />}
          meaning={<>{T("주거 신축 허가 금액 — ", "Value of new residential permits — ")}<b className="text-gray-700 dark:text-gray-200">{T("주택·가전 신규수요의 선행 규모", "the leading scale of new housing & appliance demand")}</b></>}
          ai={<>{T("허가액 확대는 ", "Rising permit value means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("신규 주택 유입 = 가전 초도수요", "new-housing inflow = first-purchase appliance demand")}</b>{T(" → 착공 밀집 지역 채널 선점", " → secure channels in start-dense areas")}</>}
          tone="emerald" src={src(T("PSA 건축허가(주거) · 분기", "PSA building permits (residential) · Quarterly"))} />
      )}
      {permit.series.length > 0 && (
        <ChartCard seg="B2B" title={T("비주거 건축허가(상업·산업)", "Non-Residential Permits (Commercial·Industrial)")} unit={T("백만 ㎡ · 분기", "Million ㎡ · Quarterly")} kind="bar" labels={permit.labels} series={permit.series} decimals={2}
          legend={<Lg c={C.ind} t={T("비주거 착공면적", "Non-residential floor area")} b />}
          meaning={<>{T("상업·산업 신축 착공면적 — ", "New commercial/industrial floor area — ")}<b className="text-gray-700 dark:text-gray-200">{T("B2B 냉난방·빌트인 수요의 선행", "leads B2B HVAC & built-in demand")}</b></>}
          ai={<>{T("비주거 착공 확대는 ", "More non-residential starts ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("상업용 HVAC·빌트인 프로젝트 수요 선행", "lead commercial HVAC & built-in project demand")}</b>{T(" → B2B 파이프라인·입찰 선제 대응", " → get ahead on the B2B pipeline & bids")}</>}
          tone="emerald" src={src(T("PSA 건축허가(비주거) · 분기", "PSA building permits (non-residential) · Quarterly"))} />
      )}
      {office.series.length > 0 && (
        <ChartCard seg="B2B" title={T("오피스 공실률 (메트로 마닐라)", "Office Vacancy Rate (Metro Manila)")} unit={T("% · 분기 · 민간자료", "% · Quarterly · Private data")} labels={office.labels} series={office.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.rose} t={T("오피스 공실률", "Office vacancy rate")} b />}
          meaning={<>{T("상업용 오피스 공실률 — ", "Commercial office vacancy — ")}<b className="text-gray-700 dark:text-gray-200">{T("B2B 상업용 HVAC·빌트인 수요의 역지표", "an inverse indicator of B2B commercial HVAC & built-in demand")}</b></>}
          ai={<>{T("공실률 하락은 ", "Falling vacancy means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("오피스 임대·신규 입주 회복 = 상업용 냉난방·가전 수요", "recovering leasing/move-ins = commercial HVAC & appliance demand")}</b>{T(", 상승 시 B2B 프로젝트 지연 경계 · ", "; rising vacancy warns of B2B project delays · ")}<b className="text-gray-500 dark:text-gray-400">{T("민간자료(Colliers)", "Private data (Colliers)")}</b></>}
          tone="amber" src={src(T("Colliers PH Office · 분기 · 민간자료", "Colliers PH Office · Quarterly · Private data"))} />
      )}
      {rrepi.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("주거용 부동산가격 상승률", "Residential Property Price Growth")} unit={T("전년비 % · 분기", "YoY % · Quarterly")} labels={rrepi.labels} series={rrepi.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("명목", "Nominal")} b /><Lg c={C.teal} t={T("실질(물가조정)", "Real (inflation-adjusted)")} /></>}
          meaning={<>{T("주택가격 상승률(명목·실질) — ", "House-price growth (nominal·real) — ")}<b className="text-gray-700 dark:text-gray-200">{T("자산효과·프리미엄·초도수요 동인", "a driver of wealth effect, premium & first-purchase demand")}</b></>}
          ai={<>{T("주택가격 상승은 ", "Rising house prices mean ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("자산효과·신규 입주 = 프리미엄·빌트인 가전 수요", "wealth effect & move-ins = premium/built-in appliance demand")}</b>{T(", 실질 하락(명목이 물가 하회) 시 소비여력 위축 경계 · ", "; a real decline (nominal below inflation) warns of weakening spending capacity · ")}<b className="text-gray-500 dark:text-gray-400">{T("BIS(BSP RREPI 원천)", "BIS (BSP RREPI source)")}</b>{T(". ", ". ")}<b>{T("트렌드", "Trend")}</b>{T(": 2024년 명목 7~9%였으나 2025년 2%대로 급둔화, 실질은 마이너스 근접 — 주택경기 냉각 신호.", ": nominal was 7–9% in 2024 but slowed sharply to ~2% in 2025, with real near negative — a signal of cooling housing.")}</>}
          tone="emerald" src={src(T("BIS 주거용 부동산가격지수(BSP RREPI 원천) · 분기", "BIS Residential Property Price Index (BSP RREPI source) · Quarterly"))} />
      )}
        </> },
        { key: "trade", label: T("유통", "Trade"), node: <>
      {ret.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("도소매 유통 성장", "Wholesale & Retail Trade Growth")} unit={T("전년비 %", "YoY %")} labels={ret.labels} series={ret.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("도소매 거래", "Wholesale & retail trade")} b /><Lg c={C.teal} t={T("소매 부가가치", "Retail GVA")} /><Lg c={C.amber} t={T("도매 부가가치", "Wholesale GVA")} /></>}
          meaning={<>{T("도소매업 성장률 — ", "Wholesale & retail growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("유통 채널 활력·소비 실현", "channel vitality & realized consumption")}</b></>}
          ai={<>{T("도소매 성장 가속은 채널 판매 여건 개선 → ", "Accelerating trade improves channel selling conditions → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("유통 프로모·진열 확대 적기", "prime time to scale channel promos & displays")}</b>{T(". ", ". ")}<b>{T("트렌드", "Trend")}</b>{T(": 2020년 코로나로 ", ": on COVID in 2020 it ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("-14% 급락", "plunged -14%")}</b>{T(" 후 2021~2022 9%대 반등, 2024~ 5%대 안정 성장.", ", rebounded ~9% in 2021–22, then steadied at ~5% from 2024.")}</>}
          tone="emerald" src={src(T("PSA 국민계정 도소매업 · 분기", "PSA National Accounts wholesale & retail · Quarterly"))} />
      )}
      {rsale.series.length > 0 && (
        <ChartCard seg="CE" title={T("소매판매 증가율", "Retail Sales Growth")} unit={T("전년비 % · 연간", "YoY % · Annual")} kind="bar" labels={rsale.labels} series={rsale.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("소매판매 증가율", "Retail sales growth")} b />}
          meaning={<>{T("소매판매 성장률 — ", "Retail sales growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 포함 소비재 실판매 대리지표", "a proxy for actual consumer-goods sales including appliances")}</b></>}
          ai={<>{T("소매판매 반등은 ", "A retail-sales rebound is a ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가전 실수요 회복 신호", "signal of recovering real appliance demand")}</b>{T(" → 프로모·진열 확대 적기, 둔화 시 보급형 방어", " → prime time to scale promos/displays; defend with entry-level during slowdowns")}</>}
          tone="emerald" src={src(T("PSA 소매판매 · 연간", "PSA retail sales · Annual"))} />
      )}
        </> },
        { key: "sea", label: T("동남아 비교", "SEA Comparison"), node: <>
      {seaPPP.series.length > 0 && (
        <ChartCard seg="CE" title={T("1인당 GDP (PPP) — 동남아 6개국", "GDP per Capita (PPP) — 6 SEA Countries")} unit={T("천 int$ · 연간", "Thousand int$ · Annual")} labels={seaPPP.labels} series={seaPPP.series} decimals={1} seriesUnit="k"
          legend={<>{SEA_SPECS.map((s) => <Lg key={s.key} c={s.color} t={s.name} b={s.key === "Philippines"} />)}</>}
          meaning={<>{T("구매력평가(PPP) 1인당 GDP — ", "PPP GDP per capita — ")}<b className="text-gray-700 dark:text-gray-200">{T("역내 실질 생활수준·가전 구매력 순위", "regional real living standards & appliance purchasing-power ranking")}</b></>}
          ai={<>{T("필리핀은 역내 ", "The Philippines sits in the region's ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("하위권(태국·말련 대비 낮음)", "lower tier (below Thailand & Malaysia)")}</b>{T("이나 성장 지속 → 보급형 주력 + 중산층 확대 구간 프리미엄 침투 여지", " but keeps growing → lead with entry-level while premium penetration widens as the middle class expands")}</>}
          tone="amber" src={src(T("World Bank 1인당 GDP(PPP) · 연간", "World Bank GDP per capita (PPP) · Annual"))} />
      )}
      {seaNom.series.length > 0 && (
        <ChartCard seg="CE" title={T("1인당 GDP (명목) — 동남아 6개국", "GDP per Capita (Nominal) — 6 SEA Countries")} unit={T("천 US$ · 연간", "Thousand US$ · Annual")} labels={seaNom.labels} series={seaNom.series} decimals={1} seriesUnit="k"
          legend={<>{SEA_SPECS.map((s) => <Lg key={s.key} c={s.color} t={s.name} b={s.key === "Philippines"} />)}</>}
          meaning={<>{T("명목 달러 1인당 GDP — ", "Nominal-dollar GDP per capita — ")}<b className="text-gray-700 dark:text-gray-200">{T("환율 반영 실제 달러 구매력·수입가전 접근성", "FX-adjusted real dollar purchasing power & imported-appliance affordability")}</b></>}
          ai={<>{T("명목 기준 필리핀 위치는 ", "In nominal terms, the Philippines' position is ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("환율(페소 약세)에 민감", "sensitive to FX (peso weakness)")}</b>{T(" → 페소 약세기 수입 프리미엄가 부담↑, 현지화·보급형 방어", " → peso weakness raises imported premium prices; localize & defend with entry-level")}</>}
          tone="amber" src={src(T("World Bank 1인당 GDP(명목) · 연간", "World Bank GDP per capita (nominal) · Annual"))} />
      )}
      {seaTot.series.length > 0 && (
        <ChartCard seg="B2B" title={T("국가 GDP 규모 (PPP) — 동남아 6개국", "Total GDP Size (PPP) — 6 SEA Countries")} unit={T("십억 int$ · 연간", "Billion int$ · Annual")} labels={seaTot.labels} series={seaTot.series} decimals={0} seriesUnit="B"
          legend={<>{SEA_SPECS.map((s) => <Lg key={s.key} c={s.color} t={s.name} b={s.key === "Philippines"} />)}</>}
          meaning={<>{T("경제 총규모(PPP) — ", "Total economy size (PPP) — ")}<b className="text-gray-700 dark:text-gray-200">{T("역내 시장 크기·잠재 수요 총량 순위", "regional market size & total potential-demand ranking")}</b></>}
          ai={<>{T("필리핀은 인구 대국이나 총 GDP는 인니에 크게 못 미침 → ", "The Philippines is populous but total GDP trails Indonesia by far → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("1억 인구 기반 성장 잠재력 = 중장기 가전 시장 확대 여력", "100M-population growth potential = medium-term appliance-market headroom")}</b></>}
          tone="emerald" src={src(T("World Bank GDP(PPP) · 연간", "World Bank GDP (PPP) · Annual"))} />
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
  const un = build(d, n, [{ key: "unemployment_rate", name: T("실업률", "Unemployment rate"), color: C.ind, w: 2 }, { key: "underemployment_rate", name: T("불완전고용", "Underemployment"), color: C.rose }])
  const lf = build(d, n, [{ key: "labor_force_participation_rate", name: T("경제활동참가율", "Labor force participation"), color: C.ind, w: 2 }])
  const emp = build(d, n, [{ key: "employed_persons", name: T("취업자 수", "Employed persons"), color: C.emer, w: 2 }]) // 백만명, 월별 5년
  const rem = build(d, n, [{ key: "ofw_cash_remittance_growth_yoy", name: T("송금 증가율", "Remittance growth"), color: C.ind, w: 2 }])
  const remL = build(d, n, [{ key: "ofw_personal_remittance", name: T("개인송금(현금+현물)", "Personal remittances (cash+in-kind)"), color: C.ind, w: 2 }, { key: "ofw_cash_remittance", name: T("현금송금", "Cash remittances"), color: C.emer, w: 2 }])
  const remY = build(d, n, [{ key: "remittances_usd", name: T("연간 송금액", "Annual remittances"), color: C.emer, w: 2, tf: (v) => v / 1e9 }]) // USD→십억$, 연간 장기(15년)
  const pop = build(d, n, [{ key: "population", name: T("인구", "Population"), color: C.ind, w: 2, tf: (v) => v / 1e6 }]) // 명→백만명, 연간
  const wage = build(d, n, [{ key: "min_wage_php", name: T("최저임금(일급)", "Minimum wage (daily)"), color: C.ind, w: 2 }]) // PHP/일, 11년
  const empShare = build(d, n, [{ key: "emp_services_pct", name: T("서비스", "Services"), color: C.ind, w: 2 }, { key: "emp_industry_pct", name: T("산업", "Industry"), color: C.amber }, { key: "emp_agri_pct", name: T("농업", "Agriculture"), color: C.emer }]) // 고용비중 %
  const hh = build(d, n, [{ key: "households_mn", name: T("가구 수", "Households"), color: C.ind, w: 2 }]) // 백만가구, 11년
  const infra = build(d, n, [{ key: "internet_penetration", name: T("인터넷", "Internet"), color: C.ind, w: 2 }, { key: "electrification_rate", name: T("전기", "Electricity"), color: C.emer }]) // %, 보급률
  const pov = build(d, n, [{ key: "poverty_rate", name: T("빈곤율", "Poverty rate"), color: C.ind, w: 2 }]) // %, 소득계층
  const urban = build(d, n, [{ key: "urban_population_pct", name: T("도시화율", "Urbanization rate"), color: C.ind, w: 2 }]) // %, 연간
  const age = build(d, n, [{ key: "median_age", name: T("중위연령", "Median age"), color: C.ind, w: 2 }]) // 세, 연간
  const fam = build(d, n, [{ key: "household_size", name: T("평균 가구원수", "Avg household size"), color: C.ind, w: 2 }, { key: "fertility_rate", name: T("합계출산율", "Total fertility rate"), color: C.rose }]) // 명, 연간
  const ict = build(d, n, [{ key: "mobile_per100", name: T("이동전화", "Mobile phones"), color: C.ind, w: 2 }, { key: "broadband_per100", name: T("초고속인터넷", "Broadband"), color: C.emer }, { key: "internet_penetration", name: T("인터넷 사용", "Internet use"), color: C.blue }]) // 100명당·%
  const fin = build(d, n, [{ key: "account_ownership", name: T("금융계좌 보유율", "Account ownership"), color: C.ind, w: 2 }]) // %, Findex
  const cons = build(d, n, [{ key: "hh_consumption_pc", name: T("1인당 가계소비", "Household consumption per capita"), color: C.ind, w: 2 }]) // 불변$
  const gni = build(d, n, [{ key: "gni_per_capita", name: T("1인당 GNI", "GNI per capita"), color: C.ind, w: 2 }]) // 명목$
  const gini = build(d, n, [{ key: "gini_index", name: T("지니계수", "Gini index"), color: C.rose, w: 2 }]) // 불평등
  const empty = !un.series.length && !lf.series.length && !emp.series.length && !rem.series.length && !remL.series.length && !remY.series.length && !pop.series.length && !wage.series.length && !hh.series.length && !infra.series.length && !pov.series.length && !urban.series.length && !age.series.length && !fam.series.length && !ict.series.length && !fin.series.length && !cons.series.length && !gni.series.length && !gini.series.length
  return (
    <Shell title={T("고용·임금·소득", "Employment, Wages & Income")} sub={T("실업·경제활동참가·OFW 송금 — 가전 구매력", "Unemployment · Participation · OFW remittances — appliance purchasing power")} win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="indigo"
      banner={{ summary: (kv) => <>{T("실업률 ", "Unemployment ")}{B(f1(kv.unemployment_rate) + "%")}{T("·불완전고용 ", " · Underemployment ")}{B(f1(kv.underemployment_rate) + "%")}{T(", OFW송금 ", ", OFW remittances ")}{B(f1(kv.ofw_cash_remittance_growth_yoy) + "%")}{T("·최저임금 ", " · Min wage ")}{B("₱" + f0(kv.min_wage_php))}{T("·빈곤율 ", " · Poverty ")}{B(f1(kv.poverty_rate) + "%")} — {(kv.ofw_cash_remittance_growth_yoy ?? 0) > 0 ? T("고용·송금이 구매력 뒷받침", "Jobs & remittances support purchasing power") : T("구매력 모멘텀 둔화", "Purchasing-power momentum softening")}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">{T("고용·OFW 송금 = 가전 구매력의 원천", "Jobs & OFW Remittances = the Source of Appliance Purchasing Power")}</b></>, lg: <>{T("실업 하락·송금 증가는 가처분소득↑ → ", "Falling unemployment & rising remittances lift disposable income → ")}<b className="font-semibold">{T("송금 성수기(4Q·연말) 프리미엄 집중", "concentrate premium during remittance peak (Q4/year-end)")}</b>{T(" · 페소 약세와 겹치면 환산 구매력 추가 상승", " · when paired with peso weakness, converted purchasing power rises further")}</> }}
      kpiDefs={[
        { key: "unemployment_rate", label: T("실업률", "Unemployment rate"), fmt: (v) => v + "%", tone: "rose" },
        { key: "underemployment_rate", label: T("불완전고용", "Underemployment"), fmt: (v) => v + "%", tone: "rose" },
        { key: "ofw_cash_remittance_growth_yoy", label: T("OFW 송금 YoY", "OFW remittances YoY"), fmt: (v) => v + "%", tone: "emerald" },
        { key: "min_wage_php", label: T("최저임금", "Minimum wage"), fmt: (v) => "₱" + v.toFixed(0), tone: "emerald" },
        { key: "households_mn", label: T("가구 수", "Households"), fmt: (v) => v.toFixed(1) + T("백만", "M"), tone: "emerald" },
        { key: "poverty_rate", label: T("빈곤율", "Poverty rate"), fmt: (v) => v + "%", tone: "rose" },
      ]}
      sections={[
        { key: "emp_rem", label: T("고용·송금", "Employment·Remittances"), node: <>
      {un.series.length > 0 && (
        <ChartCard seg="CE" title={T("실업·불완전고용률", "Unemployment & Underemployment Rate")} unit="%" labels={un.labels} series={un.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("실업률", "Unemployment rate")} b /><Lg c={C.rose} t={T("불완전고용", "Underemployment")} /></>}
          meaning={<>{T("고용 여건 — ", "Employment conditions — ")}<b className="text-gray-700 dark:text-gray-200">{T("가처분소득·내구재 구매 여력", "disposable income & durable-purchase capacity")}</b></>}
          ai={<>{T("실업·불완전고용 하락은 소득 안정 신호 → ", "Falling unemployment/underemployment signals income stability → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가전 수요 우호", "favorable for appliance demand")}</b>{T(", 상승 시 필수·보급형 우선. ", "; when rising, prioritize essential/entry-level. ")}<b>{T("트렌드", "Trend")}</b>{T(": 실업률 2020년 코로나 ", ": unemployment ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("17.6% 급등", "spiked to 17.6% on COVID (2020)")}</b>{T(" 후 2024~ 3~5%로 정상화(역대 최저권), 불완전고용은 12%대 잔존.", ", then normalized to 3–5% from 2024 (near record lows); underemployment persists around 12%.")}</>}
          tone="rose" src={src(T("PSA 노동력조사(LFS) · 월/분기", "PSA Labor Force Survey (LFS) · Monthly/Quarterly"))} />
      )}
      {remL.series.length > 0 && (
        <ChartCard seg="CE" title={T("OFW 송금액 (개인·현금)", "OFW Remittances (Personal·Cash)")} unit={T("십억$ · 월별", "US$B · Monthly")} labels={remL.labels} series={remL.series}
          legend={<><Lg c={C.ind} t={T("개인송금(현금+현물)", "Personal remittances (cash+in-kind)")} b /><Lg c={C.emer} t={T("현금송금", "Cash remittances")} b /></>}
          meaning={<>{T("해외근로자 송금 — ", "Overseas-worker remittances — ")}<b className="text-gray-700 dark:text-gray-200">{T("필리핀 가전·프리미엄 구매의 핵심 재원", "the key funding for Philippine appliance & premium purchases")}</b></>}
          ai={<>{T("송금 유입은 가전 특히 ", "Remittance inflows drive appliance demand, especially ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("프리미엄·대형 수요를 견인", "premium/large-format demand")}</b>{T(" → 송금 성수기(4Q·연말)에 프리미엄 캠페인 집중. ", " → concentrate premium campaigns in the remittance peak (Q4/year-end). ")}<b>{T("트렌드", "Trend")}</b>{T(": 2020년 코로나 소폭 위축 후 곧 회복, 개인송금 월 ", ": after a mild 2020 (COVID) dip it quickly recovered, with personal remittances at a ")}<b className="font-semibold">{T("30억$대 사상 최고", "record ~$3B/month")}</b>{T(" — 연말(12월) 계절 급증 뚜렷.", " — a clear year-end (December) seasonal surge.")}</>}
          tone="emerald" src={src(T("BSP OFW 개인·현금송금 · 월별(2005~)", "BSP OFW personal & cash remittances · Monthly (2005–)"))} />
      )}
      {rem.series.length > 0 && (
        <ChartCard seg="CE" title={T("OFW 송금 증가율", "OFW Remittance Growth")} unit={T("전년비 %", "YoY %")} labels={rem.labels} series={rem.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("송금 증가율", "Remittance growth")} b />}
          meaning={<>{T("송금 증가율 — ", "Remittance growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("구매력 모멘텀", "purchasing-power momentum")}</b></>}
          ai={<>{T("송금 증가율 가속은 ", "Accelerating remittance growth is ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가처분소득 모멘텀", "disposable-income momentum")}</b>{T(" → 페소 약세와 겹치면 페소환산 송금 구매력 추가 상승", " → paired with peso weakness, peso-converted remittance purchasing power rises further")}</>}
          tone="emerald" src={src(T("BSP OFW 현금송금 · 전년비", "BSP OFW cash remittances · YoY"))} />
      )}
      {lf.series.length > 0 && (
        <ChartCard seg="CE" title={T("경제활동참가율", "Labor Force Participation")} unit="%" labels={lf.labels} series={lf.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("경제활동참가율", "Labor force participation")} b />}
          meaning={<>{T("노동시장 참여율 — ", "Labor-market participation — ")}<b className="text-gray-700 dark:text-gray-200">{T("소득 창출 인구 저변", "the income-generating population base")}</b></>}
          ai={<>{T("참가율 상승은 소득 기반 확대 → ", "Rising participation widens the income base → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("중장기 수요 저변 확대", "expanding the medium-term demand base")}</b>{T(" 신호", "")}</>}
          tone="emerald" src={src(T("PSA 노동력조사(LFS) · 월별", "PSA Labor Force Survey (LFS) · Monthly"))} />
      )}
      {emp.series.length > 0 && (
        <ChartCard seg="CE" title={T("취업자 수", "Employed Persons")} unit={T("백만명 · 월별", "Million · Monthly")} labels={emp.labels} series={emp.series} decimals={1} seriesUnit={T("백만명", "Million")}
          legend={<Lg c={C.emer} t={T("취업자 수", "Employed persons")} b />}
          meaning={<>{T("총 취업자 수(월별) — ", "Total employed (monthly) — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 구매 가능 소득인구의 절대 규모", "the absolute size of the income population able to buy appliances")}</b></>}
          ai={<>{T("취업자 증가는 ", "More employed persons means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가처분소득 창출 인구 확대 = 내구재 수요 저변 성장", "a growing disposable-income population = a widening durable-demand base")}</b>{T(" → 고용 회복기 프리미엄·신규 라인업 확대 적기", " → in employment recoveries, prime time to expand premium/new lineups")}</>}
          tone="emerald" src={src(T("PSA 노동력조사(LFS) 취업자 수 · 월별", "PSA Labor Force Survey (LFS) employed persons · Monthly"))} />
      )}
      {empShare.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("산업별 고용비중", "Employment Share by Sector")} unit={T("% · 연간", "% · Annual")} labels={empShare.labels} series={empShare.series} decimals={0} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("서비스", "Services")} b /><Lg c={C.amber} t={T("산업", "Industry")} /><Lg c={C.emer} t={T("농업", "Agriculture")} /></>}
          meaning={<>{T("고용의 산업 구조 — ", "Sectoral structure of employment — ")}<b className="text-gray-700 dark:text-gray-200">{T("경제 구조 전환·소득 성격", "structural shift & the nature of income")}</b></>}
          ai={<><b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("서비스 60%·산업 20%·농업 20%", "Services 60% · Industry 20% · Agriculture 20%")}</b>{T(" — 탈농업·서비스화 진행. ", " — de-agriculturalization & servicification underway. ")}<b>{T("트렌드", "Trend")}</b>{T(": 농업 고용비중이 장기 하락(2005 35%→2024 20%대)하며 도시 서비스직 확대 = ", ": agriculture's share fell long-term (35% in 2005 → ~20% in 2024) as urban service jobs grew = ")}<b className="font-semibold">{T("도시 중산층 가전수요 저변", "an urban middle-class appliance-demand base")}</b>{T(" 성장, 단 제조업 정체(20%)로 고소득 일자리는 제한.", " growing, though flat manufacturing (20%) limits high-income jobs.")}</>}
          tone="emerald" src={src(T("World Bank·PSA 산업별 고용비중 · 연간", "World Bank·PSA employment share by sector · Annual"))} />
      )}
      {remY.series.length > 0 && (
        <ChartCard seg="CE" title={T("연간 해외송금액", "Annual Remittances")} unit={T("십억$ · 연간", "US$B · Annual")} kind="bar" labels={remY.labels} series={remY.series} decimals={1} seriesUnit={T("십억$", "US$B")}
          legend={<Lg c={C.emer} t={T("연간 송금액", "Annual remittances")} b />}
          meaning={<>{T("연간 총 해외송금(장기) — ", "Total annual remittances (long-term) — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 구매력의 구조적 성장 기반", "the structural growth base of appliance purchasing power")}</b></>}
          ai={<>{T("송금은 10년 넘게 ", "Remittances have trended ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("우상향 = 내구재 구매력 구조적 확대", "upward for over a decade = structural expansion of durable purchasing power")}</b>{T(" → 프리미엄 침투 여지 지속 확대", " → premium-penetration headroom keeps widening")}</>}
          tone="emerald" src={src(T("World Bank · BSP 해외송금 · 연간", "World Bank · BSP remittances · Annual"))} />
      )}
        </> },
        { key: "income", label: T("임금·가구", "Wages·Households"), node: <>
      {pop.series.length > 0 && (
        <ChartCard seg="CE" title={T("인구", "Population")} unit={T("백만명 · 연간", "Million · Annual")} labels={pop.labels} series={pop.series} decimals={1} seriesUnit={T("백만명", "Million")}
          legend={<Lg c={C.ind} t={T("인구", "Population")} b />}
          meaning={<>{T("총인구(장기) — ", "Total population (long-term) — ")}<b className="text-gray-700 dark:text-gray-200">{T("가구 형성·가전 보급 대수의 기저 수요", "the base demand behind household formation & appliance unit uptake")}</b></>}
          ai={<>{T("인구·가구 증가는 ", "Population & household growth ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가전 대당 보급 여지의 지속 확대", "continuously widen appliance unit-uptake room")}</b>{T(" → 신규 가구 겨냥 보급형·초도수요 전략", " → target new households with entry-level & first-purchase strategy")}</>}
          tone="emerald" src={src(T("World Bank 인구 · 연간", "World Bank population · Annual"))} />
      )}
      {wage.series.length > 0 && (
        <ChartCard seg="CE" title={T("최저임금 (일급)", "Minimum Wage (Daily)")} unit={T("₱/일 · 연간", "₱/day · Annual")} kind="bar" labels={wage.labels} series={wage.series} decimals={0} seriesUnit="₱"
          legend={<Lg c={C.ind} t={T("최저임금(일급)", "Minimum wage (daily)")} b />}
          meaning={<>{T("법정 최저임금 추이 — ", "Statutory minimum-wage trend — ")}<b className="text-gray-700 dark:text-gray-200">{T("저소득 가구의 가전 구매력 하한", "the purchasing-power floor for low-income households")}</b></>}
          ai={<>{T("최저임금 인상은 ", "Minimum-wage hikes ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("보급형·필수 가전 구매력 직접 확대", "directly boost entry-level/essential appliance purchasing power")}</b>{T(" → 임금 인상기 진입가 라인업 프로모 효과적", " → entry-price lineup promos are effective during wage hikes")}</>}
          tone="emerald" src={src(T("DOLE 지역별 최저임금(NCR) · 연간", "DOLE regional minimum wage (NCR) · Annual"))} />
      )}
      {hh.series.length > 0 && (
        <ChartCard seg="CE" title={T("가구 수", "Households")} unit={T("백만가구 · 연간", "Million households · Annual")} labels={hh.labels} series={hh.series} decimals={1} seriesUnit={T("백만", "Million")}
          legend={<Lg c={C.ind} t={T("가구 수", "Households")} b />}
          meaning={<>{T("총 가구 수 — ", "Total households — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 보급 대수의 직접 모수(1가구=1대 기준)", "the direct denominator for appliance units (1 household = 1 unit)")}</b></>}
          ai={<>{T("가구 수 증가는 ", "Household growth is ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("신규 가전 초도수요의 구조적 확대", "structural expansion of first-purchase appliance demand")}</b>{T(" → 신혼·1인가구 겨냥 소형·보급형 라인업", " → target newlywed/single-person households with compact & entry-level lineups")}</>}
          tone="emerald" src={src(T("PSA 가구조사 · 연간", "PSA household survey · Annual"))} />
      )}
        </> },
        { key: "demo", label: T("인구·구조", "Demographics·Structure"), node: <>
      {infra.series.length > 0 && (
        <ChartCard seg="CE" title={T("인터넷·전기 보급률", "Internet & Electricity Access")} unit={T("% · 연간", "% · Annual")} labels={infra.labels} series={infra.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("인터넷", "Internet")} b /><Lg c={C.emer} t={T("전기", "Electricity")} /></>}
          meaning={<>{T("전기·인터넷 보급률 — ", "Electricity & internet access — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전·스마트가전 보급의 인프라 전제", "the infrastructure precondition for appliance & smart-appliance uptake")}</b></>}
          ai={<>{T("전기·인터넷 보급 확대는 ", "Wider electricity/internet access ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("지방·저소득 신규 가전 시장 개방", "opens new provincial/low-income appliance markets")}</b>{T(" → 미보급 지역 진입가 라인업·스마트가전 침투 여지", " → entry-price lineups & smart-appliance penetration room in underserved areas")}</>}
          tone="emerald" src={src(T("World Bank 인프라 보급률 · 연간", "World Bank infrastructure access · Annual"))} />
      )}
      {pov.series.length > 0 && (
        <ChartCard seg="CE" title={T("빈곤율", "Poverty Rate")} unit={T("% · 연간", "% · Annual")} labels={pov.labels} series={pov.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("빈곤율", "Poverty rate")} b />}
          meaning={<>{T("빈곤 인구 비율 — ", "Share of population in poverty — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 구매 가능 소비층 저변의 역지표", "an inverse indicator of the appliance-capable consumer base")}</b></>}
          ai={<>{T("빈곤율 하락은 ", "Falling poverty means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("중산층 편입·가전 구매층 확대", "middle-class entry & a widening appliance-buying segment")}</b>{T(" → 진입가→중급 업그레이드 수요 확대 기대", " → expect entry-to-mid upgrade demand to expand")}</>}
          tone="emerald" src={src(T("PSA 빈곤통계 · 연간", "PSA poverty statistics · Annual"))} />
      )}
      {urban.series.length > 0 && (
        <ChartCard seg="CE" title={T("도시화율", "Urbanization Rate")} unit={T("% · 연간", "% · Annual")} labels={urban.labels} series={urban.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("도시화율", "Urbanization rate")} b />}
          meaning={<>{T("도시 거주 인구 비율 — ", "Share of urban population — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 밀집 수요·프리미엄 채널의 지리적 기반", "the geographic base for dense appliance demand & premium channels")}</b></>}
          ai={<>{T("도시화 진전은 ", "Advancing urbanization means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("도시 가구 밀집 = 프리미엄·빌트인·에어컨 수요 집중", "urban household density = concentrated premium/built-in/AC demand")}</b>{T(" → 도시권 채널·프리미엄 라인 우선 배치", " → prioritize urban channels & premium lines")}</>}
          tone="emerald" src={src(T("World Bank 도시화율 · 연간", "World Bank urbanization rate · Annual"))} />
      )}
      {age.series.length > 0 && (
        <ChartCard seg="CE" title={T("중위연령", "Median Age")} unit={T("세 · 연간", "Years · Annual")} labels={age.labels} series={age.series} decimals={1} seriesUnit={T("세", "yrs")}
          legend={<Lg c={C.ind} t={T("중위연령", "Median age")} b />}
          meaning={<>{T("인구 중위연령 — ", "Population median age — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 교체·업그레이드 vs 초도수요의 세대 구성", "the generational mix of replacement/upgrade vs first-purchase demand")}</b></>}
          ai={<>{T("중위연령 상승은 ", "A rising median age means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("소득 성숙 세대 확대 = 교체·프리미엄 업그레이드 수요", "a larger income-mature cohort = replacement/premium-upgrade demand")}</b>{T(", 여전히 젊은 인구는 초도수요 지속 이중 기회", "; a still-young population sustains first-purchase demand — a dual opportunity")}</>}
          tone="emerald" src={src(T("World Bank 중위연령 · 연간", "World Bank median age · Annual"))} />
      )}
      {fam.series.length > 0 && (
        <ChartCard seg="CE" title={T("가구원수·합계출산율", "Household Size & Fertility Rate")} unit={T("명 · 연간", "Persons · Annual")} labels={fam.labels} series={fam.series} decimals={2} seriesUnit={T("명", "persons")}
          legend={<><Lg c={C.ind} t={T("평균 가구원수", "Avg household size")} b /><Lg c={C.rose} t={T("합계출산율", "Total fertility rate")} /></>}
          meaning={<>{T("가구 규모·출산율 하락 — ", "Falling household size & fertility — ")}<b className="text-gray-700 dark:text-gray-200">{T("가구 수↑·소형가전 수요 전환", "more households & a shift toward compact appliances")}</b></>}
          ai={<>{T("가구원수·출산율 하락은 ", "Falling household size & fertility mean ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가구 분화 = 가구 수↑ = 소형·1인용 가전 대수 확대", "household splitting = more households = more compact/single-use appliance units")}</b>{T(" → 소형·프리미엄 소가전 라인업 강화", " → strengthen compact & premium small-appliance lineups")}</>}
          tone="emerald" src={src(T("PSA·World Bank 가구·출산율 · 연간", "PSA·World Bank household & fertility · Annual"))} />
      )}
      <CrossBarCard d={d} seg="CE" unit={T("인구 % · 2020", "% of population · 2020")} title={T("인구 연령구조", "Population Age Structure")} sort={false}
        items={[{ key: "pop_share_child", name: T("유소년 0-14", "Children 0-14") }, { key: "pop_share_youth", name: T("청년 20-39", "Youth 20-39") }, { key: "pop_share_working", name: T("생산가능 15-64", "Working-age 15-64") }, { key: "pop_share_old", name: T("고령 65+", "Elderly 65+") }]}
        meaning={<>{T("연령 구조 — ", "Age structure — ")}<b className="text-gray-700 dark:text-gray-200">{T("청년·유소년 비중 = 신규 가구형성·초도수요 런웨이", "youth/child share = runway for household formation & first-purchase demand")}</b></>}
        ai={<>{T("청년(20-39) ", "Youth (20-39) ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("32% = 신혼·1인가구 초도 가전수요 대량", "32% = a large pool of newlywed/single-household first-purchase demand")}</b>{T(", 고령 4.5%로 아직 젊어 장기 볼륨 성장 · 유소년 31%는 향후 10년 수요 파이프라인", "; elderly only 4.5% — still young, supporting long-term volume growth · children 31% are the next-decade demand pipeline")}</>}
        source={T("PSA 2020 인구주택총조사 · 연령별", "PSA 2020 Census of Population & Housing · by age")} />
        </> },
        { key: "adopt", label: T("소비·기술·금융", "Consumption·Tech·Finance"), node: <>
      {ict.series.length > 0 && (
        <ChartCard seg="CE" title={T("ICT 보급 (모바일·인터넷)", "ICT Adoption (Mobile·Internet)")} unit={T("100명당 · % · 연간", "Per 100 · % · Annual")} labels={ict.labels} series={ict.series} decimals={0} seriesUnit=""
          legend={<><Lg c={C.ind} t={T("이동전화/100명", "Mobile/100")} b /><Lg c={C.emer} t={T("초고속인터넷/100명", "Broadband/100")} /><Lg c={C.blue} t={T("인터넷 사용%", "Internet use %")} /></>}
          meaning={<>{T("통신·인터넷 보급 — ", "Telecom & internet adoption — ")}<b className="text-gray-700 dark:text-gray-200">{T("스마트가전·IoT 연계 수요의 인프라 전제", "the infrastructure precondition for smart-appliance/IoT-linked demand")}</b></>}
          ai={<>{T("모바일·초고속인터넷 보급 확대는 ", "Wider mobile & broadband adoption opens ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("스마트가전·앱연동 프리미엄 침투 여지", "room for smart-appliance & app-linked premium penetration")}</b>{T(" → 커넥티드 라인업·구독형 서비스 기회", " → opportunity for connected lineups & subscription services")}</>}
          tone="emerald" src={src(T("World Bank WDI ICT · 연간", "World Bank WDI ICT · Annual"))} />
      )}
      {fin.series.length > 0 && (
        <ChartCard seg="CE" title={T("금융계좌 보유율 (금융포용)", "Account Ownership (Financial Inclusion)")} unit={T("% · 연간", "% · Annual")} labels={fin.labels} series={fin.series} decimals={0} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("금융계좌 보유율", "Account ownership")} b />}
          meaning={<>{T("15세+ 금융계좌 보유율 — ", "Account ownership (age 15+) — ")}<b className="text-gray-700 dark:text-gray-200">{T("할부·카드·디지털결제 기반 확대", "expanding the base for installments, cards & digital payments")}</b></>}
          ai={<>{T("금융포용 확대는 ", "Growing financial inclusion means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("무이자 할부·BNPL·카드 결제 저변 성장", "a growing base for 0% installments, BNPL & card payments")}</b>{T(" → 핀테크 제휴 할부 프로모로 신규 구매층 확보", " → capture new buyers via fintech-partnered installment promos")}</>}
          tone="emerald" src={src(T("World Bank Findex 금융계좌 · 연간", "World Bank Findex account ownership · Annual"))} />
      )}
      {cons.series.length > 0 && (
        <ChartCard seg="CE" title={T("1인당 가계소비", "Household Consumption per Capita")} unit={T("불변 US$ · 연간", "Constant US$ · Annual")} kind="bar" labels={cons.labels} series={cons.series} decimals={0} seriesUnit="$"
          legend={<Lg c={C.ind} t={T("1인당 가계소비", "Household consumption per capita")} b />}
          meaning={<>{T("실질 1인당 소비지출 — ", "Real per-capita consumption spending — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 포함 재량소비의 구조적 성장", "structural growth in discretionary spending including appliances")}</b></>}
          ai={<>{T("1인당 소비 우상향은 ", "Rising per-capita consumption is ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("재량·프리미엄 지출 여력 구조적 확대", "structural expansion of discretionary/premium spending capacity")}</b>{T(" → 상위 라인업·신가전 카테고리 침투 기회", " → opportunity to penetrate upper lineups & new appliance categories")}</>}
          tone="emerald" src={src(T("World Bank 1인당 가계소비(불변) · 연간", "World Bank household consumption per capita (constant) · Annual"))} />
      )}
      {gni.series.length > 0 && (
        <ChartCard seg="CE" title={T("1인당 GNI (국민총소득)", "GNI per Capita (Gross National Income)")} unit={T("US$ · 연간", "US$ · Annual")} kind="bar" labels={gni.labels} series={gni.series} decimals={0} seriesUnit="$"
          legend={<Lg c={C.ind} t={T("1인당 GNI", "GNI per capita")} b />}
          meaning={<>{T("1인당 국민총소득 — ", "Gross national income per capita — ")}<b className="text-gray-700 dark:text-gray-200">{T("해외소득(OFW) 포함 실질 소득수준", "the real income level including overseas (OFW) income")}</b></>}
          ai={<>{T("GNI는 GDP+해외소득(OFW) → ", "GNI = GDP + overseas (OFW) income → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("송금 반영 실제 구매력 지표", "a remittance-inclusive real purchasing-power gauge")}</b>{T(", 중진국 상단 진입 시 프리미엄 전환 가속", "; entering the upper-middle-income band accelerates the premium shift")}</>}
          tone="emerald" src={src(T("World Bank 1인당 GNI · 연간", "World Bank GNI per capita · Annual"))} />
      )}
      {gini.series.length > 0 && (
        <ChartCard seg="CE" title={T("소득불평등 (지니계수)", "Income Inequality (Gini Index)")} unit={T("index · 연간", "Index · Annual")} labels={gini.labels} series={gini.series} decimals={1} seriesUnit=""
          legend={<Lg c={C.rose} t={T("지니계수", "Gini index")} b />}
          meaning={<>{T("소득분배 불평등도 — ", "Income-distribution inequality — ")}<b className="text-gray-700 dark:text-gray-200">{T("양극화 = 프리미엄·보급형 이원 시장 구조", "polarization = a dual premium/entry-level market structure")}</b></>}
          ai={<>{T("높은 지니(양극화)는 ", "A high Gini (polarization) calls for a ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("프리미엄(상위층)·초저가(하위층) 양극 전략", "barbell strategy: premium (top) & ultra-low-price (bottom)")}</b>{T(" 필요 → 중간 공백 유의, 하락 시 중산층 볼륨존 확대", " → mind the middle gap; a decline widens the middle-class volume zone")}</>}
          tone="amber" src={src(T("World Bank 지니계수 · 연간", "World Bank Gini index · Annual"))} />
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
    <div className="flex h-full min-w-0 flex-col rounded-xl p-3.5" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("기업 사업 제약요인", "Business Constraints")}</h3>
        <span className="shrink-0 rounded bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300">B2B</span>
        <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{T("%응답 · 25Q4 · 복수", "% responses · 25Q4 · Multiple")}</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {shown.map((c, i) => (
          <div key={c[0]} className="flex items-center gap-2" title={`${c[0]} ${c[1]}%`}>
            <span className="w-[68px] shrink-0 truncate text-right text-[10.5px] text-gray-500 dark:text-gray-400">{c[0]}</span>
            <span className="h-3.5 min-w-0 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800"><span className="block h-full rounded" style={{ width: (c[1] / cmax * 100) + "%", background: i === 0 && !more ? C.rose : c[0] === "경쟁 심화" ? C.rose : i < 4 ? C.ind : "#94a3b8", animation: "growX .6s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.1 + i * 0.05) + "s", transformOrigin: "left center" }} /></span>
            <span className="w-9 shrink-0 text-right text-[10.5px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">{c[1]}%</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setMore((v) => !v)} className="mt-1.5 self-start text-[10.5px] font-semibold text-violet-600 dark:text-violet-400 transition-colors hover:text-violet-700 dark:hover:text-violet-300">{more ? T("접기 ▲", "Collapse ▲") : `${T("더보기", "More")} (+${BES_CONSTRAINTS.length - 6}) ▼`}</button>
      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {T("기업이 꼽은 경영 애로 — 수요·금리·경쟁 압력 구조", "Top business pain points cited by firms — the structure of demand, rate & competition pressure")}</p>
      <button type="button" onClick={() => setAiOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-violet-600 dark:text-violet-400 transition-colors hover:text-violet-700 dark:hover:text-violet-300">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>
        {T("LG 인사이트", "LG Insight")}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: aiOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div style={{ display: "grid", gridTemplateRows: aiOpen ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(.22,1,.36,1)" }}>
        <div className="overflow-hidden"><div className="mt-1.5 border-l-2 border-violet-300 dark:border-violet-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold">{T("경쟁 심화(64%)·수요 부족(35%)", "Intensified competition (64%) & weak demand (35%)")}</b>{T("이 최대 애로 — 가전도 가격·프로모 경쟁 격화 예상. 고금리(22%)는 할부 설계·B2B 발주에 부담 → ", " are the top pain points — expect fiercer price/promo competition in appliances too. High rates (22%) burden installment design & B2B ordering → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("무이자 할부·TCO 절감 소구로 방어", "defend with 0% installments & TCO-savings messaging")}</b>{T(".", ".")}</p></div></div>
      </div>
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-500 dark:text-gray-400">{T("자료", "Source")}</b> {T("BSP Business Expectations Survey 제약요인 · 최신분기", "BSP Business Expectations Survey constraints · Latest quarter")}</p>
    </div>
  )
}
export function SentimentView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(SENTIMENT_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const esi = build(d, n, [{ key: "economic_sentiment_composite", name: T("경제심리지수", "Economic Sentiment Index"), color: C.ind, w: 2 }])
  const cci = build(d, n, [{ key: "consumer_confidence_index", name: T("현재 CCI", "Current CCI"), color: C.ind, w: 2 }, { key: "consumer_confidence_next12m", name: T("향후 12개월", "Next 12 months"), color: C.emer }])
  const bci = build(d, n, [{ key: "business_confidence_index", name: T("현재 BCI", "Current BCI"), color: C.ind, w: 2 }, { key: "business_confidence_next12m", name: T("향후 12개월", "Next 12 months"), color: C.blue }])
  const dur = build(d, n, [{ key: "durables_buying_intention", name: T("내구재 구매의향", "Durables buying intention"), color: C.ind, w: 2 }])
  // BES(기업경기전망조사) 분기 — 2001~2025
  const besOverall = build(d, n, [{ key: "bes_overall_ci", name: T("당분기", "Current quarter"), color: C.ind, w: 2 }, { key: "bes_ci_next_q", name: T("차분기 전망", "Next-quarter outlook"), color: C.emer }])
  const besSector = build(d, n, [{ key: "bes_ci_manufacturing", name: T("제조업", "Manufacturing"), color: C.rose, w: 2 }, { key: "bes_ci_retail", name: T("도소매", "Wholesale & retail"), color: C.ind }, { key: "bes_ci_services", name: T("서비스", "Services"), color: C.emer }])
  const besOps = build(d, n, [{ key: "bes_credit_access", name: T("신용접근", "Credit access"), color: C.ind, w: 2 }, { key: "bes_financial_condition", name: T("재무여건", "Financial condition"), color: C.rose }])
  const besJob = build(d, n, [{ key: "bes_employment_outlook", name: T("고용전망(차분기)", "Employment outlook (next Q)"), color: C.ind, w: 2 }, { key: "bes_expansion_plans", name: T("설비확장 계획", "Expansion plans"), color: C.emer }])
  const besCap = build(d, n, [{ key: "bes_capacity_util", name: T("평균 가동률", "Avg capacity utilization"), color: C.amber, w: 2 }])
  const besCon = build(d, n, [{ key: "bes_con_competition", name: T("경쟁 심화", "Intensified competition"), color: C.rose, w: 2.4 }, { key: "bes_con_demand", name: T("수요 부족", "Weak demand"), color: C.ind, w: 2 }, { key: "bes_con_interest", name: T("고금리", "High interest rates"), color: C.amber }, { key: "bes_con_financial", name: T("재무 문제", "Financial problems"), color: C.emer }])
  const cesDur = build(d, n, [{ key: "ces_durables_buy", name: T("내구재 구매 가구%", "Durables-buying households %"), color: C.emer, w: 2 }])
  const empty = !cci.series.length && !bci.series.length && !dur.series.length && !esi.series.length && !besOverall.series.length
  return (
    <Shell title={T("기업·소비 심리", "Business & Consumer Sentiment")} sub={T("소비자심리 CCI·기업심리 BCI·BES 기업경기 — 수요 선행", "Consumer CCI · Business BCI · BES business cycle — demand leading")} win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="indigo"
      banner={{ summary: (kv) => <>{T("소비자심리 CCI ", "Consumer CCI ")}{B(f1(kv.consumer_confidence_index))}{T("·기업심리 BCI ", " · Business BCI ")}{B(f1(kv.business_confidence_index))}{T("·내구재 구매의향 ", " · Durables buying intention ")}{B(f1(kv.durables_buying_intention))} — {(kv.consumer_confidence_index ?? 0) < 0 ? T("심리 위축, 수요 회복 지연 국면", "Sentiment contracting, demand recovery delayed") : T("심리 개선, 수요 회복 초입", "Sentiment improving, early demand recovery")}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">{T("소비·기업 심리 = 수요의 3~6개월 선행", "Consumer & Business Sentiment = a 3–6 Month Lead on Demand")}</b></>, lg: <>{T("내구재 구매의향·CCI 반등 초입에 ", "At the early rebound of durables intention & CCI, time ")}<b className="font-semibold">{T("신제품·프리미엄 출시 타이밍", "new-product & premium launches")}</b>{T(" · 악화 시 가성비·필수형 우선", " · when deteriorating, prioritize value/essential")}</> }}
      kpiDefs={[
        { key: "consumer_confidence_index", label: T("소비자심리 CCI", "Consumer CCI"), fmt: (v) => String(v), tone: "emerald" },
        { key: "business_confidence_index", label: T("기업심리 BCI", "Business BCI"), fmt: (v) => String(v), tone: "emerald" },
        { key: "durables_buying_intention", label: T("내구재 구매의향", "Durables buying intention"), fmt: (v) => String(v), tone: "emerald" },
      ]}
      sections={[
        { key: "summary", label: T("심리 요약", "Sentiment Summary"), node: <>
      {esi.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("경제심리지수 (자체산출·실험적)", "Economic Sentiment Index (In-house·Experimental)")} unit={T("지수 · 평균100 · 분기", "Index · Mean 100 · Quarterly")} labels={esi.labels} series={esi.series} decimals={1}
          legend={<Lg c={C.ind} t={T("경제심리지수", "Economic Sentiment Index")} b />}
          meaning={<>{T("소비·기업심리 표준화 합성 — ", "Standardized composite of consumer & business sentiment — ")}<b className="text-gray-700 dark:text-gray-200">{T("경제 전반 심리 단일 게이지", "a single gauge of economy-wide sentiment")}</b></>}
          ai={<>{T("100 상회는 낙관·수요 확장, 하회는 위축 국면 → ", "Above 100 = optimism/demand expansion, below = contraction → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("단일 지표로 국면 전환 조기 포착", "catch phase shifts early with one indicator")}</b>{T(" · ", " · ")}<b className="text-gray-500 dark:text-gray-400">{T("BOK 경제심리지수(ESI) 방식 · 자체산출, 기업심리 이력 확보 시 정식화", "BOK ESI methodology · in-house; to be formalized once business-sentiment history is complete")}</b></>}
          tone="emerald" src={src(T("자체산출: BSP CES/BES 표준화 합성(평균100·표준편차10) · 분기", "In-house: standardized BSP CES/BES composite (mean 100 · SD 10) · Quarterly"))} />
      )}
      {dur.series.length > 0 && (
        <ChartCard seg="CE" title={T("내구재 구매의향", "Durables Buying Intention")} unit={T("지수", "Index")} labels={dur.labels} series={dur.series} decimals={1}
          legend={<Lg c={C.ind} t={T("내구재 구매의향", "Durables buying intention")} b />}
          meaning={<>{T("가전 등 내구재 구매 의향 — ", "Intention to buy durables (e.g. appliances) — ")}<b className="text-gray-700 dark:text-gray-200">{T("실판매의 3~6개월 직접 선행", "a direct 3–6 month lead on actual sales")}</b></>}
          ai={<>{T("구매의향 반등은 ", "A rebound in buying intention foreshadows ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("수개월 뒤 가전 실판매 회복", "an appliance sales recovery months later")}</b>{T("을 예고 → 반등 초입에 신제품·프리미엄 출시 타이밍. ", " → time new-product/premium launches at the early rebound. ")}<b>{T("트렌드", "Trend")}</b>{T(": 확산지수 대체로 마이너스(비관 우세), 2020 코로나 급락 후 회복했으나 2026년 재악화(-70) — 물가·금리 부담 반영.", ": the diffusion index is mostly negative (pessimism prevails); it recovered after the 2020 COVID plunge but worsened again in 2026 (-70) — reflecting price/rate burdens.")}</>}
          tone="emerald" src={src(T("BSP 소비자기대조사 내구재 구매의향 · 분기", "BSP Consumer Expectations Survey durables buying intention · Quarterly"))} />
      )}
      {cci.series.length > 0 && (
        <ChartCard seg="CE" title={T("소비자심리 CCI", "Consumer Confidence (CCI)")} unit={T("지수", "Index")} labels={cci.labels} series={cci.series} decimals={1}
          legend={<><Lg c={C.ind} t={T("현재 CCI", "Current CCI")} b /><Lg c={C.emer} t={T("향후 12개월", "Next 12 months")} /></>}
          meaning={<>{T("소비자 신뢰지수 — ", "Consumer confidence index — ")}<b className="text-gray-700 dark:text-gray-200">{T("가계 지출 심리·수요 선행", "household spending sentiment & demand leading")}</b></>}
          ai={<>{T("CCI 개선은 재량 지출 확대 신호 → ", "Improving CCI signals wider discretionary spending → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("프리미엄 전환 수요", "premium-shift demand")}</b>{T(", 악화 시 가성비·필수형 우선", "; when deteriorating, prioritize value/essential")}</>}
          tone="emerald" src={src(T("BSP 소비자기대조사(CES) · 분기", "BSP Consumer Expectations Survey (CES) · Quarterly"))} />
      )}
      {bci.series.length > 0 && (
        <ChartCard seg="B2B" title={T("기업심리 BCI", "Business Confidence (BCI)")} unit={T("지수", "Index")} labels={bci.labels} series={bci.series} decimals={1}
          legend={<><Lg c={C.ind} t={T("현재 BCI", "Current BCI")} b /><Lg c={C.blue} t={T("향후 12개월", "Next 12 months")} /></>}
          meaning={<>{T("기업 신뢰지수 — ", "Business confidence index — ")}<b className="text-gray-700 dark:text-gray-200">{T("B2B·유통 투자·재고 심리", "B2B/channel investment & inventory sentiment")}</b></>}
          ai={<>{T("BCI 개선은 유통·B2B 발주 확대 여건 → ", "Improving BCI creates conditions for wider channel/B2B ordering → ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("채널 재고·프로젝트 수주", "channel inventory & project wins")}</b>{T(" 우호", " favorable")}</>}
          tone="emerald" src={src(T("BSP 기업기대조사(BES) · 분기", "BSP Business Expectations Survey (BES) · Quarterly"))} />
      )}
        </> },
        { key: "bes", label: T("기업경기(BES) 전체분석", "Business Cycle (BES) Full Analysis"), node: <>
      {besOverall.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("BES 기업경기 종합지수", "BES Overall Business Cycle Index")} unit={T("확산지수 · 분기(2001~)", "Diffusion index · Quarterly (2001–)")} labels={besOverall.labels} series={besOverall.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.ind} t={T("당분기", "Current quarter")} b /><Lg c={C.emer} t={T("차분기 전망", "Next-quarter outlook")} /></>}
          meaning={<>{T("기업의 경기 체감·전망 — ", "Firms' perceived & expected conditions — ")}<b className="text-gray-700 dark:text-gray-200">{T("투자·발주·채용의 선행", "leading investment, ordering & hiring")}</b></>}
          ai={<>{T("당분기 확산지수 ", "A current-quarter diffusion index that is ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("플러스=낙관 우세", "positive = optimism prevails")}</b>{T(". ", ". ")}<b>{T("트렌드", "Trend")}</b>{T(": 2020 코로나 급락(-30대) 후 회복해 2025년 20~30대 낙관 유지, 차분기 전망은 통상 당분기보다 높음(개선 기대). 낙관 지속은 유통·B2B 발주 확대 여건 → 채널 재고·프로젝트 수주 우호.", ": after the 2020 COVID plunge (~-30) it recovered and held optimism in the 20–30s through 2025; the next-quarter outlook typically exceeds the current (improvement expected). Sustained optimism supports wider channel/B2B ordering → favorable for channel inventory & project wins.")}</>}
          tone="emerald" src={src(T("BSP Business Expectations Survey 종합 · 분기", "BSP Business Expectations Survey overall · Quarterly"))} />
      )}
      {besSector.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("BES 업종별 신뢰", "BES Confidence by Sector")} unit={T("확산지수 · 분기", "Diffusion index · Quarterly")} labels={besSector.labels} series={besSector.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.rose} t={T("제조업", "Manufacturing")} b /><Lg c={C.ind} t={T("도소매", "Wholesale & retail")} /><Lg c={C.emer} t={T("서비스", "Services")} /></>}
          meaning={<>{T("업종별 경기 체감 — ", "Perceived conditions by sector — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 유통(도소매)·제조 업황", "appliance channel (wholesale/retail) & manufacturing conditions")}</b></>}
          ai={<><b className="font-semibold">{T("도소매 신뢰", "Wholesale/retail confidence")}</b>{T("가 가전 유통 채널 활력의 직접 프록시. ", " is a direct proxy for appliance channel vitality. ")}<b>{T("트렌드", "Trend")}</b>{T(": 제조업 신뢰가 도소매·서비스보다 낮게 지속(10대) — 고금리·수요불안 반영. 도소매 반등 시 오프라인 판매·발주 회복 신호.", ": manufacturing confidence stays below wholesale/retail & services (in the teens) — reflecting high rates & demand uncertainty. A wholesale/retail rebound signals recovering offline sales & ordering.")}</>}
          tone="emerald" src={src(T("BSP BES 업종별(당분기) · 분기", "BSP BES by sector (current quarter) · Quarterly"))} />
      )}
      {besJob.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("BES 고용전망·설비확장", "BES Employment Outlook & Expansion")} unit={T("지수·% · 분기", "Index·% · Quarterly")} labels={besJob.labels} series={besJob.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.ind} t={T("고용전망(차분기)", "Employment outlook (next Q)")} b /><Lg c={C.emer} t={T("설비확장 계획%", "Expansion plans %")} /></>}
          meaning={<>{T("기업 채용·투자 의향 — ", "Firms' hiring & investment intentions — ")}<b className="text-gray-700 dark:text-gray-200">{T("소득·B2B 수요의 중기 선행", "a medium-term lead on income & B2B demand")}</b></>}
          ai={<>{T("고용전망 상승은 ", "A rising employment outlook means ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("가계 소득·구매력 개선", "improving household income & purchasing power")}</b>{T(" → 가전 수요 저변 확대. 설비확장 계획은 B2B 냉난방·설비 수요 선행. ", " → a widening appliance-demand base. Expansion plans lead B2B HVAC/equipment demand. ")}<b>{T("트렌드", "Trend")}</b>{T(": 고용전망 꾸준히 플러스나 2025말 둔화(12대), 확장계획 15% 안팎 유지.", ": the employment outlook stays positive but softened by late 2025 (~12); expansion plans hold around 15%.")}</>}
          tone="emerald" src={src(T("BSP BES 고용전망(차분기)·설비확장 · 분기", "BSP BES employment outlook (next Q) & expansion · Quarterly"))} />
      )}
      {besOps.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("BES 신용접근·재무여건", "BES Credit Access & Financial Condition")} unit={T("확산지수 · 분기", "Diffusion index · Quarterly")} labels={besOps.labels} series={besOps.series} decimals={1} seriesUnit=""
          legend={<><Lg c={C.ind} t={T("신용접근", "Credit access")} b /><Lg c={C.rose} t={T("재무여건", "Financial condition")} /></>}
          meaning={<>{T("기업 자금·재무 체감 — ", "Firms' funding & financial perception — ")}<b className="text-gray-700 dark:text-gray-200">{T("유통 운전자금·발주 여력", "channel working capital & ordering capacity")}</b></>}
          ai={<>{T("재무여건이 ", "If financial condition is ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("지속 마이너스", "persistently negative")}</b>{T("면 유통·협력사 자금난 → 발주·재고 보수화 위험. ", ", channels/partners face funding strain → risk of conservative ordering & inventory. ")}<b>{T("트렌드", "Trend")}</b>{T(": 재무여건 -15~-18대 만성 부진, 신용접근도 0 부근/음(-)으로 하락 — 고금리 부담 반영, 유통 여신 모니터링 필요.", ": financial condition is chronically weak (-15 to -18) and credit access has slipped to around zero/negative — reflecting high-rate burdens; monitor channel credit.")}</>}
          tone="rose" src={src(T("BSP BES 신용접근·재무여건 · 분기", "BSP BES credit access & financial condition · Quarterly"))} />
      )}
      {besCap.series.length > 0 && (
        <ChartCard seg="B2B" title={T("BES 평균 가동률", "BES Avg Capacity Utilization")} unit={T("% · 분기", "% · Quarterly")} labels={besCap.labels} series={besCap.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.amber} t={T("평균 가동률(산업·건설)", "Avg capacity utilization (industry·construction)")} b />}
          meaning={<>{T("설비 가동 수준 — ", "Capacity-utilization level — ")}<b className="text-gray-700 dark:text-gray-200">{T("공급 여력·과열/둔화", "supply slack & overheating/slowdown")}</b></>}
          ai={<>{T("가동률 ", "Utilization in the ")}<b className="font-semibold">{T("70%대", "70s%")}</b>{T("는 여유 있는 공급 국면 = 수요 확대 시 즉응 가능. ", " means a comfortable supply phase = can respond quickly to demand upturns. ")}<b>{T("트렌드", "Trend")}</b>{T(": 코로나 저점 후 71% 안팎 안정 — 급격한 공급 병목 신호는 없음.", ": stable around 71% after the COVID trough — no sign of sharp supply bottlenecks.")}</>}
          tone="amber" src={src(T("BSP BES 산업·건설 평균 가동률 · 분기", "BSP BES industry & construction avg capacity utilization · Quarterly"))} />
      )}
      {besCon.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("사업 제약요인 추이", "Business Constraints Trend")} unit={T("%응답 · 분기(복수)", "% responses · Quarterly (multiple)")} labels={besCon.labels} series={besCon.series} decimals={0} seriesUnit="%"
          legend={<><Lg c={C.rose} t={T("경쟁 심화", "Intensified competition")} b /><Lg c={C.ind} t={T("수요 부족", "Weak demand")} /><Lg c={C.amber} t={T("고금리", "High interest rates")} /><Lg c={C.emer} t={T("재무 문제", "Financial problems")} /></>}
          meaning={<>{T("기업 애로요인의 시간 변화 — ", "How firms' pain points change over time — ")}<b className="text-gray-700 dark:text-gray-200">{T("경쟁·수요·금리 압력의 추세", "the trend in competition/demand/rate pressure")}</b></>}
          ai={<><b className="font-semibold text-rose-600 dark:text-rose-400">{T("경쟁 심화가 60%대로 지속 상승", "Intensified competition keeps rising to ~60%")}</b>{T("(가전도 가격·프로모전 격화), 수요 부족 30%대 고착. ", " (fiercer price/promo wars in appliances too); weak demand entrenched at ~30%. ")}<b>{T("트렌드", "Trend")}</b>{T(": 고금리 애로는 2023~24 급등 후 2025 완화(23→22%)로 금리 부담 정점 통과 시사, 재무 문제는 15%로 안정. 경쟁·수요가 구조적 최대 리스크.", ": the high-rate pain point spiked in 2023–24 then eased in 2025 (23→22%), suggesting the rate burden has peaked; financial problems stable at 15%. Competition & demand are the biggest structural risks.")}</>}
          tone="rose" src={src(T("BSP BES 사업 제약요인 · 분기 2001~", "BSP BES business constraints · Quarterly 2001–"))} />
      )}
      {cesDur.series.length > 0 && (
        <ChartCard seg="CE" title={T("소비자 내구재 구매 (CES)", "Consumer Durables Purchase (CES)")} unit={T("% 가구 · 분기", "% of households · Quarterly")} labels={cesDur.labels} series={cesDur.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.emer} t={T("내구재 구매 가구비중", "Share of durables-buying households")} b />}
          meaning={<>{T("내구재(가전 등)를 실제 구매한 가구 비중 — ", "Share of households that actually bought durables (appliances etc.) — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 실수요의 직접 지표", "a direct indicator of real appliance demand")}</b></>}
          ai={<>{T("BSP ", "BSP ")}<b className="font-semibold">{T("소비자기대조사(CES)", "Consumer Expectations Survey (CES)")}</b>{T("의 내구재 구매 가구비중 — 기존 구매‘의향’ 지수(2016 종료)를 대체하는 ", " durables-buying household share — replacing the old buying-'intention' index (ended 2016), it is the ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("2026Q2까지 최신 실구매 지표", "latest actual-purchase metric through 2026Q2")}</b>{T(". ", ". ")}<b>{T("트렌드", "Trend")}</b>{T(": 팬데믹 전 9%대→최근 ", ": pre-pandemic ~9% → recently ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{T("4%대로 위축", "contracted to ~4%")}</b>{T("(고물가·금리로 대형가전 구매 지연), 구매의향 확산지수도 -70대 비관 — 심리 반등 시점이 가전 실판매 회복 신호.", " (high prices/rates delay big-appliance purchases); the buying-intention diffusion index is also pessimistic at ~-70 — a sentiment rebound signals recovering appliance sales.")}</>}
          tone="emerald" src={src(T("BSP CES 내구재 구매 가구비중(Tab7) · 분기", "BSP CES durables-buying household share (Tab7) · Quarterly"))} />
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
  const allI = build(d, n, [{ key: "INF_all_items", name: T("전체", "Headline"), color: C.ind, w: 2 }])
  const food = build(d, n, [{ key: "INF_food", name: T("식품", "Food"), color: C.rose, w: 2 }])
  const rice = build(d, n, [{ key: "INF_rice", name: T("쌀", "Rice"), color: C.amber, w: 2 }])
  const energy = build(d, n, [{ key: "INF_electricity", name: T("전기", "Electricity"), color: C.ind, w: 2 }, { key: "INF_lpg", name: "LPG", color: C.rose }, { key: "INF_transport", name: T("운송", "Transport"), color: C.blue }])
  const home = build(d, n, [{ key: "INF_housing_utilities", name: T("주거·공공요금", "Housing & utilities"), color: C.ind, w: 2 }, { key: "INF_household_appliances", name: T("가전", "Appliances"), color: C.emer }, { key: "INF_aircon", name: T("에어컨", "Air conditioner"), color: C.rose }])
  const dine = build(d, n, [{ key: "INF_restaurants", name: T("외식·숙박", "Dining & accommodation"), color: C.ind, w: 2 }, { key: "INF_all_items", name: T("전체 물가", "Headline CPI"), color: C.brown }])
  const elec = build(d, n, [{ key: "meralco_residential_rate", name: T("가정용 전기료", "Residential electricity rate"), color: C.ind, w: 2 }])
  const oil = build(d, n, [{ key: "oil_diesel", name: T("경유", "Diesel"), color: C.ind, w: 2 }, { key: "oil_gasoline", name: T("휘발유", "Gasoline"), color: C.rose }, { key: "oil_kerosene", name: T("등유", "Kerosene"), color: C.amber }])
  const gas = build(d, n, [{ key: "oil_ron95", name: "RON95", color: C.ind, w: 2 }, { key: "oil_ron91", name: "RON91", color: C.rose }]) // 휘발유 등급별 펌프가
  const empty = !allI.series.length && !food.series.length && !rice.series.length && !energy.series.length && !home.series.length && !dine.series.length && !elec.series.length && !oil.series.length && !gas.series.length
  return (
    <Shell title={T("물가", "Prices")} sub={T("생활물가·에너지·주거/내구재 CPI 상승률 — 실질 구매력·원가", "Cost-of-living, energy & housing/durables CPI growth — real purchasing power & cost")} win={win} setWin={setWin} loaded={loaded} empty={empty} d={d} accent="indigo"
      banner={{ summary: (kv) => <>{T("전체 물가 ", "Headline CPI ")}{B(f1(kv.INF_all_items) + "%")}{T("·식품 ", " · Food ")}{B(f1(kv.INF_food) + "%")}{T("·쌀 ", " · Rice ")}{B(f1(kv.INF_rice) + "%")}{T("·전기 ", " · Electricity ")}{B(f1(kv.INF_electricity) + "%")}{T(", 경유 ", ", Diesel ")}{B("₱" + f1(kv.oil_diesel))} — {(kv.INF_all_items ?? 0) > 4 ? T("물가 압박 지속, 재량지출 위축", "Persistent price pressure, discretionary spending weak") : T("물가 둔화, 구매력 회복 국면", "Inflation easing, purchasing power recovering")}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">{T("물가 = 가전 구매력의 실질 기준", "Prices = the Real Benchmark for Appliance Purchasing Power")}</b></>, lg: <>{T("식품·전기 물가 급등기엔 가처분소득이 필수재로 쏠려 ", "When food/electricity prices spike, disposable income shifts to essentials → ")}<b className="font-semibold">{T("가전 구매 이연 → 보급형·프로모 방어", "appliance purchases deferred → defend with entry-level & promos")}</b>{T(" · 물가 둔화 국면엔 프리미엄 전환 수요 회복", " · when inflation eases, premium-shift demand recovers")}</> }}
      kpiDefs={[
        { key: "INF_all_items", label: T("전체 물가", "Headline CPI"), fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_food", label: T("식품", "Food"), fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_rice", label: T("쌀", "Rice"), fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_electricity", label: T("전기", "Electricity"), fmt: (v) => v + "%", tone: "rose" },
        { key: "oil_diesel", label: T("경유", "Diesel"), fmt: (v) => "₱" + v.toFixed(1), tone: "amber" },
        { key: "meralco_residential_rate", label: T("전기료", "Electricity rate"), fmt: (v) => "₱" + v.toFixed(2), tone: "amber" },
      ]}
      sections={[
        { key: "cpi", label: T("소비자물가", "Consumer Prices"), node: <>
      {allI.series.length > 0 && (
        <ChartCard seg="CE" title={T("전체 물가 (헤드라인 CPI)", "Headline CPI")} unit={T("전년비 %", "YoY %")} labels={allI.labels} series={allI.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t={T("전체", "Headline")} b />}
          meaning={<>{T("헤드라인 물가 상승률 — ", "Headline inflation — ")}<b className="text-gray-700 dark:text-gray-200">{T("가처분소득·재량지출 여력의 직접 결정", "directly sets disposable income & discretionary-spending capacity")}</b></>}
          ai={<>{T("전체 물가 4% 상회 시 필수재 쏠림 → ", "Above 4% headline, spending tilts to essentials → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("가전 구매 이연", "appliance purchases deferred")}</b>{T(", 둔화 국면엔 재량소비·프리미엄 전환 회복. ", "; easing restores discretionary & premium-shift demand. ")}<b>{T("트렌드", "Trend")}</b>{T(": 2018 6%대(쌀·유가)→2020~21 2%대 안정→2022~23 6~8% 재급등(식품·에너지)→2024초 둔화 후 2025 쌀·식품發 재상승.", ": ~6% in 2018 (rice/oil) → stable ~2% in 2020–21 → re-surged 6–8% in 2022–23 (food/energy) → eased in early 2024, then rose again in 2025 on rice/food.")}</>}
          tone="rose" src={src(T("PSA CPI 상승률(전체) · 월별", "PSA CPI growth (headline) · Monthly"))} />
      )}
      {food.series.length > 0 && (
        <ChartCard seg="CE" title={T("식품 물가", "Food Inflation")} unit={T("전년비 %", "YoY %")} labels={food.labels} series={food.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.rose} t={T("식품", "Food")} b />}
          meaning={<>{T("식품 물가 상승률 — ", "Food inflation — ")}<b className="text-gray-700 dark:text-gray-200">{T("가계 필수지출의 최대 항목", "the largest item in household essential spending")}</b></>}
          ai={<>{T("식품 물가 급등은 저·중소득 가처분소득을 직접 잠식 → ", "Food-price surges directly erode low/middle-income disposable income → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("보급형 가전 구매력 위축", "weakening entry-level appliance purchasing power")}</b>{T(", 둔화 시 회복 선행", "; easing leads the recovery")}</>}
          tone="rose" src={src(T("PSA CPI 상승률(식품) · 월별", "PSA CPI growth (food) · Monthly"))} />
      )}
      {rice.series.length > 0 && (
        <ChartCard seg="CE" title={T("쌀 물가", "Rice Inflation")} unit={T("전년비 %", "YoY %")} labels={rice.labels} series={rice.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.amber} t={T("쌀", "Rice")} b />}
          meaning={<>{T("주식(쌀) 물가 상승률 — ", "Staple (rice) inflation — ")}<b className="text-gray-700 dark:text-gray-200">{T("체감물가·정책 민감도 최고 품목", "the item with the highest perceived-inflation & policy sensitivity")}</b></>}
          ai={<>{T("쌀값 급등은 체감물가·정책개입(수입관세·상한제)을 촉발 → ", "Rice-price surges trigger perceived inflation & policy intervention (import tariffs, price caps) → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("소비심리 위축 신호", "a signal of weakening consumer sentiment")}</b>{T(", 안정 시 재량소비 여력 반등. ", "; stabilization rebounds discretionary capacity. ")}<b>{T("트렌드", "Trend")}</b>{T(": 2023~24 쌀값 두 자릿수 급등(엘니뇨·수출제한·관세) 후 2025 관세인하로 둔화 — 체감물가의 핵심 변동요인.", ": rice prices spiked double-digits in 2023–24 (El Niño, export bans, tariffs), then eased in 2025 on tariff cuts — a key driver of perceived inflation.")}</>}
          tone="amber" src={src(T("PSA CPI 상승률(쌀) · 월별", "PSA CPI growth (rice) · Monthly"))} />
      )}
      {dine.series.length > 0 && (
        <ChartCard seg="CE" title={T("외식·숙박 vs 전체 물가", "Dining & Accommodation vs Headline")} unit={T("전년비 %", "YoY %")} labels={dine.labels} series={dine.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("외식·숙박", "Dining & accommodation")} b /><Lg c={C.brown} t={T("전체 물가", "Headline CPI")} /></>}
          meaning={<>{T("서비스 물가 대표(외식) — ", "A proxy for services prices (dining) — ")}<b className="text-gray-700 dark:text-gray-200">{T("서비스發 물가 압력·근원물가 방향", "services-driven price pressure & core-inflation direction")}</b></>}
          ai={<>{T("외식 물가가 전체보다 높으면 ", "When dining runs above headline, ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("서비스發 끈적한 물가", "sticky services-driven inflation")}</b>{T(" → 금리 인하 지연·구매력 회복 지체 신호", " → a signal of delayed rate cuts & slower purchasing-power recovery")}</>}
          tone="rose" src={src(T("PSA CPI 상승률(외식·숙박) · 월별", "PSA CPI growth (dining & accommodation) · Monthly"))} />
      )}
        </> },
        { key: "energy", label: T("에너지·주거", "Energy·Housing"), node: <>
      {energy.series.length > 0 && (
        <ChartCard seg="CE" title={T("에너지·이동 물가 (전기·LPG·운송)", "Energy & Mobility Prices (Electricity·LPG·Transport)")} unit={T("전년비 %", "YoY %")} labels={energy.labels} series={energy.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("전기", "Electricity")} b /><Lg c={C.rose} t="LPG" /><Lg c={C.blue} t={T("운송", "Transport")} /></>}
          meaning={<>{T("에너지·이동 비용 상승률 — ", "Energy & mobility cost growth — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 사용비용·고효율 소구력", "appliance running cost & high-efficiency appeal")}</b></>}
          ai={<>{T("전기·LPG 물가 상승기엔 ", "During rising electricity/LPG prices, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("인버터·고효율 프리미엄 소구", "pitch inverter/high-efficiency premium")}</b>{T(" 유리 → 에너지 절감액을 판매 메시지로", " works well → turn energy savings into a sales message")}</>}
          tone="rose" src={src(T("PSA CPI 상승률(전기·LPG·운송) · 월별", "PSA CPI growth (electricity·LPG·transport) · Monthly"))} />
      )}
      {home.series.length > 0 && (
        <ChartCard seg="CE" title={T("주거·내구재 물가 (주거·가전·에어컨)", "Housing & Durables Prices (Housing·Appliances·AC)")} unit={T("전년비 %", "YoY %")} labels={home.labels} series={home.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t={T("주거·공공요금", "Housing & utilities")} b /><Lg c={C.emer} t={T("가전", "Appliances")} /><Lg c={C.rose} t={T("에어컨", "Air conditioner")} /></>}
          meaning={<>{T("주거·가전 물가 상승률 — ", "Housing & appliance inflation — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전의 상대적 가격 매력", "the relative price appeal of appliances")}</b></>}
          ai={<>{T("가전 물가가 전체·주거보다 낮으면 ", "When appliance prices run below headline/housing, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("실질 저렴 → 구매 매력↑", "relatively cheap → purchase appeal↑")}</b>{T(", 높으면 보급형·프로모 강화", "; when higher, strengthen entry-level & promos")}</>}
          tone="rose" src={src(T("PSA CPI 상승률(주거·가전·에어컨) · 월별", "PSA CPI growth (housing·appliances·AC) · Monthly"))} />
      )}
      {elec.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("가정용 전기요금 (Meralco)", "Residential Electricity Rate (Meralco)")} unit={T("₱/kWh · 월별", "₱/kWh · Monthly")} labels={elec.labels} series={elec.series} decimals={2} seriesUnit="₱"
          legend={<Lg c={C.ind} t={T("가정용 전기료", "Residential electricity rate")} b />}
          meaning={<>{T("실제 전기요금 수준 — ", "Actual electricity-rate level — ")}<b className="text-gray-700 dark:text-gray-200">{T("가전 사용비용의 절대 기준", "the absolute benchmark for appliance running cost")}</b></>}
          ai={<>{T("전기료 상승 추세엔 ", "In a rising-rate trend, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("고효율·인버터 프리미엄 소구", "pitching high-efficiency/inverter premium")}</b>{T("가 유효 → TCO(총소유비용) 절감 메시지 강화", " is effective → strengthen the TCO (total cost of ownership) savings message")}</>}
          tone="amber" src={src(T("Meralco 가정용 요금 · 월별", "Meralco residential rate · Monthly"))} />
      )}
        </> },
        { key: "oil", label: T("유가", "Fuel Prices"), node: <>
      {oil.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("유가 (경유·휘발유·등유)", "Fuel Prices (Diesel·Gasoline·Kerosene)")} unit={T("₱/L · 월별", "₱/L · Monthly")} labels={oil.labels} series={oil.series} decimals={1} seriesUnit="₱"
          legend={<><Lg c={C.ind} t={T("경유", "Diesel")} b /><Lg c={C.rose} t={T("휘발유", "Gasoline")} /><Lg c={C.amber} t={T("등유", "Kerosene")} /></>}
          meaning={<>{T("국내 종류별 소매 유가 — ", "Domestic retail fuel prices by type — ")}<b className="text-gray-700 dark:text-gray-200">{T("운송·물류·전기료·물가 상류 동인", "an upstream driver of transport, logistics, electricity & prices")}</b></>}
          ai={<>{T("유가 상승은 운송·물류·전기료로 전이돼 ", "Rising fuel prices pass through to transport, logistics & electricity, ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("가전 물류원가·소비자 물가 동반 압박", "pressuring both appliance logistics cost & consumer prices")}</b>{T(" → 조달·판가 선제 점검, 하락기엔 원가 여유·프로모 여력", " → review procurement/pricing early; declines free up cost & promo room")}</>}
          tone="amber" src={src(T("DOE 주간 유가(oil_prices) · 월평균", "DOE weekly fuel prices (oil_prices) · Monthly avg"))} />
      )}
      {gas.series.length > 0 && (
        <ChartCard seg="CE·B2B" title={T("휘발유 등급별 (RON95·RON91)", "Gasoline by Grade (RON95·RON91)")} unit={T("₱/L · 월별", "₱/L · Monthly")} labels={gas.labels} series={gas.series} decimals={1} seriesUnit="₱"
          legend={<><Lg c={C.ind} t="RON95" b /><Lg c={C.rose} t="RON91" /></>}
          meaning={<>{T("휘발유 등급별 소매가 — ", "Retail gasoline price by grade — ")}<b className="text-gray-700 dark:text-gray-200">{T("이동·물류비 세부 동인", "a granular driver of mobility & logistics cost")}</b></>}
          ai={<>{T("휘발유가 상승은 방문설치·A/S 물류비와 소비자 이동비용을 함께 압박 → ", "Rising gasoline pressures both installation/after-sales logistics and consumer mobility costs → ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("서비스 물류원가·체감 구매력 점검", "review service-logistics cost & perceived purchasing power")}</b>{T(", 하락기엔 프로모 여력", "; declines free up promo room")}</>}
          tone="amber" src={src(T("DOE 주간 유가(RON95·RON91) · 월평균", "DOE weekly fuel prices (RON95·RON91) · Monthly avg"))} />
      )}
        </> },
      ]} />
  )
}
