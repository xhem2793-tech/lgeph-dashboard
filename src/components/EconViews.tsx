"use client"

import React, { useEffect, useState } from "react"
import { macroMonthly, calendarUpcoming, seaCompare } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"
import { ChartCard, Lg, SLine, moLabel } from "@/components/EconChart"

/** 주요 지표 카테고리 뷰 — 전부 Supabase(macro_indicators, geo_level=national) 실측.
 *  환율(FxView)과 동일한 차트(평소 선만·호버 점·핵심요약 애니메이션) + 의미 + AI 분석(LGE-PH 관점) + 출처.
 *  각 카드는 지표 1~3계열을 한 축에 겹쳐 그림. 창(1Y/2Y/전체) 토글 공용. */

type Mon = Record<string, { dates: string[]; values: number[] }>
const WIN = [{ k: "1Y", n: 1 }, { k: "2Y", n: 2 }, { k: "5Y", n: 5 }, { k: "전체", n: 99 }] // n=표시 기간(년)

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
  const labels = axis.map(moLabel)
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
    <div className="overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 dark:from-indigo-500/10 via-indigo-50/40 dark:via-transparent to-white dark:to-gray-900 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
      <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer select-none items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></svg>
        </div>
        <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700 dark:text-gray-200">{line}</div>
        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{nowLbl} 기준</span>
        {lg && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-400 dark:text-indigo-300 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>}
      </div>
      {lg && (
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
          <div className="overflow-hidden">
            <div className="border-t border-indigo-100/70 dark:border-indigo-500/25 px-4 pb-3.5 pt-3">
              <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                <span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 관점</span>
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
function AgendaCard() {
  const [ev, setEv] = useState<{ date: string; event: string; category: string }[]>([])
  useEffect(() => { calendarUpcoming(6).then((r) => setEv(r.map((x) => ({ date: x.date, event: x.event, category: x.category })))).catch(() => setEv([])) }, [])
  if (!ev.length) return null
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dday = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - today0) / 86400000)
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both", animationDelay: "80ms" }}>
      <header className="flex items-baseline justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5">
        <h2 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">경제 일정</h2>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">지표 발표</span>
      </header>
      <div className="mt-2 flex flex-col">
        {ev.map((x, i) => {
          const dd = dday(x.date)
          return (
            <div key={i} style={{ animation: "fadeUp .5s ease both", animationDelay: 60 + i * 40 + "ms" }} className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-gray-900 dark:text-gray-50">{x.event}</span>
                <span className="block text-[10.5px] text-gray-500 dark:text-gray-400">{x.category}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[11px] font-semibold text-gray-500 dark:text-gray-400">{dd === 0 ? "오늘" : dd > 0 ? "D-" + dd : "D+" + -dd}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 공용 셸 — 환율 페이지와 동일 레이아웃(배너 + 좌 차트 | 우 위젯 286px) ──
type Section = { key: string; label: string; node: React.ReactNode }
function Shell({ title, sub, win, setWin, loaded, empty, banner, kpiDefs, d, children, sections }: { title: string; sub: string; win: string; setWin: (k: string) => void; loaded: boolean; empty: boolean; banner?: BannerDef; kpiDefs?: KpiDef[]; d: Mon; children?: React.ReactNode; sections?: Section[] }) {
  const [activeSub, setActiveSub] = useState(sections?.[0]?.key ?? "")
  const curSub = sections?.find((s) => s.key === activeSub) ?? sections?.[0]
  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      {banner && <Banner {...banner} d={d} kpiDefs={loaded ? kpiDefs : undefined} />}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
          <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{sub}</span>
            <span className="ml-auto">
              <Segmented size="sm" value={win} onChange={setWin} options={WIN.map((w) => ({ k: w.k, label: w.k }))} />
            </span>
          </header>
          {loaded && !empty && sections && sections.length > 1 && (
            <nav className="mb-3.5 flex flex-wrap gap-1.5">
              {sections.map((s) => (
                <button key={s.key} type="button" onClick={() => setActiveSub(s.key)}
                  className={"rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200 " + (activeSub === s.key ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300")}>
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
              <div className="text-[14px] font-bold text-gray-500 dark:text-gray-400">데이터 적재 대기</div>
              <div className="text-[12px] text-gray-400 dark:text-gray-500">해당 지표가 아직 Supabase에 없음 · 수집 후 자동 표시</div>
            </div>
          ) : (
            <div key={activeSub} className="grid items-stretch gap-4 sm:grid-cols-2" style={{ animation: "fadeUp .35s ease both" }}>{sections ? curSub?.node : children}</div>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <AgendaCard />
        </aside>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">출처 PSA·BSP 공식통계(Supabase macro_indicators) · 색=사업영향(원가·부담↑ rose, 수요·구매력↑ emerald)</p>
    </div>
  )
}

const src = (s: string) => (<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> {s}</>)

// ══════════════════════════════════════════════════════════════════════
// 가전 선행지표 — PPI·수입·가전물가·전기료
// ══════════════════════════════════════════════════════════════════════
const APPLIANCE_KEYS = ["PPI_domestic_appliances", "PPI_electrical", "PPI_electronics", "PPI_manufacturing", "imports_home_appliances", "imports_consumer_electronics", "imports_telecom", "INF_household_appliances", "INF_aircon", "INF_all_items", "meralco_residential_rate", "appl_own_ref", "appl_own_wash", "appl_own_tv", "appl_own_cool", "appl_own_mobile", "cdd_monthly", "temp_monthly"]
// 단면(cross-sectional) 바 카드 — 보유율·연령구조 등 시점 스냅샷용 공용
function CrossBarCard({ d, items, title, seg, unit, meaning, ai, source, sort = true }: { d: Mon; items: { key: string; name: string }[]; title: string; seg: string; unit: string; meaning: React.ReactNode; ai: React.ReactNode; source: string; sort?: boolean }) {
  let rows = items.map((it) => ({ ...it, v: latestOf(d, it.key)?.v ?? 0 })).filter((r) => r.v > 0)
  if (sort) rows = rows.sort((a, b) => b.v - a.v)
  if (!rows.length) return null
  return (
    <div className="relative z-0 flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{seg}</span>
        <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-gray-600 dark:text-gray-300">{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              <div className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-indigo-500 to-indigo-400" style={{ width: r.v + "%", transition: "width .8s cubic-bezier(.16,1,.3,1) " + (i * 0.06) + "s" }} />
            </div>
            <span className="w-11 shrink-0 text-right text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{r.v.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 min-h-[34px] text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {meaning}</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">AI</b> {ai}</p></div>
      <div className="mt-auto pt-2.5 text-[10px] text-gray-400 dark:text-gray-500">{src(source)}</div>
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
    <div className="relative z-0 flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">가전 보유율 (침투율)</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">CE</span>
        <span className="ml-auto shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">가구 % · 2020</span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-gray-600 dark:text-gray-300">{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              <div className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-indigo-500 to-indigo-400" style={{ width: r.v + "%", transition: "width .8s cubic-bezier(.16,1,.3,1) " + (i * 0.06) + "s" }} />
            </div>
            <span className="w-11 shrink-0 text-right text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{r.v.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 min-h-[34px] text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 가구 보유율 = 시장 침투율. <b className="font-semibold text-emerald-600 dark:text-emerald-400">냉장고 46%·세탁기 43% = 성장여력 최대</b> (미보유 과반)</p>
      <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">AI</b> 저침투(냉장고·세탁기)는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">초도수요 헤드룸 = 보급형 볼륨존</b>, 고침투(TV·냉방)는 교체·프리미엄 업그레이드 시장</p></div>
      <div className="mt-auto pt-2.5 text-[10px] text-gray-400 dark:text-gray-500">{src("PSA 2020 인구주택총조사 · 가구편의")}</div>
    </div>
  )
}
export function ApplianceView() {
  const [win, setWin] = useState("2Y")
  const { d, loaded } = useMacro(APPLIANCE_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const ppi = build(d, n, [{ key: "PPI_domestic_appliances", name: "가전 PPI", color: C.ind, w: 2 }, { key: "PPI_electrical", name: "전기기기", color: C.rose }, { key: "PPI_electronics", name: "전자", color: C.blue }])
  const imp = build(d, n, [{ key: "imports_home_appliances", name: "가전", color: C.ind, w: 2, tf: (v) => v / 1e6 }, { key: "imports_consumer_electronics", name: "소비자전자", color: C.rose, tf: (v) => v / 1e6 }, { key: "imports_telecom", name: "통신기기", color: C.blue, tf: (v) => v / 1e6 }]) // USD→백만$ (연간 무역통계)
  const inf = build(d, n, [{ key: "INF_household_appliances", name: "가전 물가", color: C.ind, w: 2 }, { key: "INF_aircon", name: "에어컨", color: C.rose }, { key: "INF_all_items", name: "전체 CPI", color: C.brown }])
  const elec = build(d, n, [{ key: "meralco_residential_rate", name: "가정용 전기료", color: C.ind, w: 2 }])
  const cdd = build(d, n, [{ key: "cdd_monthly", name: "냉방도일 CDD", color: C.rose, w: 2 }]) // 에어컨 수요 선행
  const empty = !ppi.series.length && !imp.series.length && !inf.series.length && !elec.series.length && !cdd.series.length
  return (
    <Shell title="가전 선행지표" sub="생산자물가·수입액·가전물가·전기료 — 원가·공급 선행" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ summary: (kv) => <>가전 물가 {B(f1(kv.INF_household_appliances) + "%")}·에어컨 {B(f1(kv.INF_aircon) + "%")}·가전 PPI {B(f1(kv.PPI_domestic_appliances) + "%")}, 전기료 {B("₱" + f1(kv.meralco_residential_rate))} — {(kv.PPI_domestic_appliances ?? 0) > 2 ? "원가·소매가 상방 압박" : "원가·가전물가 안정 국면"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">가전 원가·공급 선행지표</b></>, lg: <>PPI·수입 급등은 원가·중국계 물량 신호 → <b className="font-semibold">조달 헤지·프로모 타이밍</b> 선제 대응 · 전기료↑엔 고효율 프리미엄 소구</> }}
      kpiDefs={[
        { key: "INF_household_appliances", label: "가전 물가 YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_aircon", label: "에어컨 물가 YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "PPI_domestic_appliances", label: "가전 PPI YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "meralco_residential_rate", label: "전기료", fmt: (v) => "₱" + v.toFixed(2), tone: "amber" },
      ]}>
      <OwnershipCard d={d} />
      {ppi.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="가전 생산자물가 PPI" unit="전년비 %" labels={ppi.labels} series={ppi.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="가전 PPI" b /><Lg c={C.rose} t="전기기기" /><Lg c={C.blue} t="전자" /></>}
          meaning={<>생산단계 출고가격 상승률 — <b className="text-gray-700 dark:text-gray-200">소비자가·조달원가의 수개월 선행</b></>}
          ai={<>가전 PPI 상승은 수개월 뒤 출고가·원가로 전이 → <b className="font-semibold text-rose-600 dark:text-rose-400">선제 판가·조달 대응</b>, 부품 헤지·현지조달 비중 점검</>}
          tone="rose" src={src("PSA 생산자물가지수(PPI) · 월별")} />
      )}
      {imp.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="가전·전자·통신 수입액" unit="백만$ · 연간" labels={imp.labels} series={imp.series} decimals={0} seriesUnit="백만$"
          legend={<><Lg c={C.ind} t="가전" b /><Lg c={C.rose} t="소비자전자" /><Lg c={C.blue} t="통신기기" /></>}
          meaning={<>가전·인접 카테고리 완제품 수입 규모 — <b className="text-gray-700 dark:text-gray-200">시장 공급량·경쟁 강도 선행</b></>}
          ai={<>수입 급증은 중국계 물량 유입 신호 → <b className="font-semibold text-amber-600 dark:text-amber-400">채널 재고·가격 경쟁 압박</b> · 소비자전자·통신 동반 확대는 스마트홈 연계 수요 신호</>}
          tone="amber" src={src("PSA 수출입통계 · 연간")} />
      )}
      {inf.series.length > 0 && (
        <ChartCard seg="CE" title="가전 소비자물가 상승률" unit="전년비 %" labels={inf.labels} series={inf.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="가전 물가" b /><Lg c={C.rose} t="에어컨" /><Lg c={C.brown} t="전체 CPI" /></>}
          meaning={<>가전 소매물가 상승률 vs 전체 물가 — <b className="text-gray-700 dark:text-gray-200">가전의 실질 가격 매력</b></>}
          ai={<>가전 물가가 전체 CPI보다 낮으면 <b className="font-semibold text-emerald-600 dark:text-emerald-400">실질 저렴 → 구매 매력↑</b>, 높으면 구매 저항 → 보급형·프로모 강화</>}
          tone="rose" src={src("PSA CPI(가전·에어컨) · 전년비")} />
      )}
      {elec.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="가정용 전기요금 (Meralco)" unit="₱/kWh" labels={elec.labels} series={elec.series} decimals={2}
          legend={<Lg c={C.ind} t="가정용 전기료" b />}
          meaning={<>전기요금 = 가전 <b className="text-gray-700 dark:text-gray-200">사용비용·에너지효율 소구력</b> 결정</>}
          ai={<>전기료 상승기엔 <b className="font-semibold text-emerald-600 dark:text-emerald-400">인버터·고효율 프리미엄 소구</b>가 유리 → 에너지 절감액을 판매 메시지로 전환</>}
          tone="amber" src={src("Meralco 가정용 요금 · 월별")} />
      )}
      {cdd.series.length > 0 && (
        <ChartCard seg="CE" title="냉방도일 (에어컨 수요 선행)" unit="CDD · 월별 · 기준24℃" labels={cdd.labels} series={cdd.series} decimals={0} seriesUnit="CDD"
          legend={<Lg c={C.rose} t="냉방도일 CDD" b />}
          meaning={<>냉방도일 = Σ(일평균기온−24℃) — <b className="text-gray-700 dark:text-gray-200">에어컨·냉장고 사용강도·판매 성수기 직접 선행</b></>}
          ai={<>CDD 급등기(3~5월 혹서)는 <b className="font-semibold text-amber-600 dark:text-amber-400">에어컨·선풍기 판매 성수기</b> → 사전 재고·프로모 집중, 냉방 프리미엄(인버터) 소구 최적 · <b className="text-gray-500 dark:text-gray-400">Open-Meteo 기온</b></>}
          tone="amber" src={src("Open-Meteo 메트로마닐라 기온 · 냉방도일 월집계")} />
      )}
    </Shell>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 통화·금리·신용 — 정책금리·M3·가계신용
// ══════════════════════════════════════════════════════════════════════
const RATES_KEYS = ["policy_rate_monthly", "BSP_policy_rate", "interbank_call_rate", "m3_growth_yoy", "broad_money_growth", "domestic_credit_pct_gdp", "bank_loan_growth_yoy", "consumer_loan_growth_yoy", "credit_card_loan_growth_yoy", "current_account_pct_gdp", "fdi_net_inflow_usd", "trade_balance_gdp", "exports_gdp", "imports_gdp", "govt_exp_gdp", "reserves_usd"]
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
  const empty = !pol.series.length && !loan.series.length && !m3.series.length && !credit.series.length && !cab.series.length && !fdi.series.length && !trade.series.length && !reserves.series.length && !govt.series.length
  return (
    <Shell title="통화·금리·신용" sub="기준금리·통화량 M3·가계신용 — 할부·카드 구매력" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ summary: (kv) => <>정책금리 {B(f1(kv.BSP_policy_rate) + "%")}·M3 {B(f1(kv.m3_growth_yoy) + "%")}, 소비자대출 {B(f1(kv.consumer_loan_growth_yoy) + "%")}·카드 {B(f1(kv.credit_card_loan_growth_yoy) + "%")}·총대출 {B(f1(kv.bank_loan_growth_yoy) + "%")} — {(kv.BSP_policy_rate ?? 9) < 6 ? "금리 인하·신용 확장이 할부 수요 뒷받침" : "고금리로 할부 부담 지속"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">통화·신용 = 가전 구매력 엔진</b></>, lg: <>금리 인하·카드/소비자대출 확장기엔 <b className="font-semibold">무이자 할부·프리미엄 푸시</b>가 유효 · 콜금리 급등 시 유통 운전자금 부담 관찰</> }}
      kpiDefs={[
        { key: "BSP_policy_rate", label: "정책금리 RRP", fmt: (v) => v + "%", tone: "amber" },
        { key: "m3_growth_yoy", label: "통화량 M3", fmt: (v) => v + "%", tone: "emerald" },
        { key: "consumer_loan_growth_yoy", label: "소비자대출", fmt: (v) => v + "%", tone: "emerald" },
        { key: "credit_card_loan_growth_yoy", label: "신용카드 대출", fmt: (v) => v + "%", tone: "emerald" },
        { key: "bank_loan_growth_yoy", label: "은행 총대출", fmt: (v) => v + "%", tone: "emerald" },
      ]}
      sections={[
        { key: "rate_credit", label: "금리·신용", node: <>
      {pol.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="정책금리·시장금리" unit="% · 월별" labels={pol.labels} series={pol.series} decimals={2} seriesUnit="%"
          legend={<><Lg c={C.ind} t="정책금리 RRP" b /><Lg c={C.rose} t="시장금리(콜)" /></>}
          meaning={<>정책금리 vs 시장금리 — <b className="text-gray-700 dark:text-gray-200">할부·소비자 금융비용의 기준·자금시장 긴장도</b></>}
          ai={<>금리 인하기엔 <b className="font-semibold text-emerald-600 dark:text-emerald-400">할부·카드 이자 부담↓ = 가전 구매력↑</b> · 시장금리 급등 시 유통 운전자금 부담 관찰</>}
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
          meaning={<>정부지출·서비스업 GDP비중 — <b className="text-gray-700 dark:text-gray-200">인프라·서비스 경제화 = 도시가구·B2B 수요 기반</b></>}
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
const GROWTH_KEYS = ["gdp_growth_yoy", "household_consumption_yoy", "gross_capital_formation_yoy", "gfcf_growth", "construction_gva_growth", "construction_gfcf_growth", "permits_residential_value", "permits_total_value", "permits_nonresidential_floorarea", "industry_gva_yoy", "industry_va_growth", "manufacturing_va_growth", "services_va_growth", "capacity_utilization", "retail_gva_growth", "wholesale_retail_trade_yoy", "services_gva_yoy", "retail_sales_growth", "gdp_per_capita_usd", "office_vacancy_ncr"]
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
  const ret = build(d, n, [{ key: "wholesale_retail_trade_yoy", name: "도소매 거래", color: C.ind, w: 2 }, { key: "retail_gva_growth", name: "소매 부가가치", color: C.teal }])
  const permit = build(d, n, [{ key: "permits_nonresidential_floorarea", name: "비주거 착공면적", color: C.ind, w: 2, tf: (v) => v / 1e6 }])
  const permitV = build(d, n, [{ key: "permits_residential_value", name: "주거 건축허가액", color: C.violet, w: 2, tf: (v) => v / 1e6 }]) // 천PHP→십억₱
  const va = build(d, n, [{ key: "manufacturing_va_growth", name: "제조업", color: C.ind, w: 2 }, { key: "industry_va_growth", name: "산업", color: C.rose }, { key: "services_va_growth", name: "서비스", color: C.emer }])
  const rsale = build(d, n, [{ key: "retail_sales_growth", name: "소매판매 증가율", color: C.ind, w: 2 }]) // 연간 6년(COVID 저점)
  const pcap = build(d, n, [{ key: "gdp_per_capita_usd", name: "1인당 GDP", color: C.ind, w: 2 }]) // USD, 연간 — 구매력·시장규모
  const office = build(d, n, [{ key: "office_vacancy_ncr", name: "오피스 공실률", color: C.rose, w: 2 }]) // 민간자료(Colliers)
  const empty = !gdp.series.length && !demand.series.length && !cons.series.length && !ind.series.length && !cap.series.length && !ret.series.length && !permit.series.length && !permitV.series.length && !va.series.length && !rsale.series.length && !pcap.series.length && !office.series.length
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
          meaning={<>실질 GDP 성장률 — <b className="text-gray-700 dark:text-gray-200">가전 시장 전체 파이의 크기</b> (연간 장기 + 최근 분기)</>}
          ai={<>성장 둔화기엔 재량소비 위축 → <b className="font-semibold text-amber-600 dark:text-amber-400">보급형 방어</b>, 확장기엔 프리미엄·신규수요 가속</>}
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
        </> },
        { key: "industry", label: "산업·생산", node: <>
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
          ai={<>가동률 하락은 수요 둔화·유휴 신호 → <b className="font-semibold text-amber-600 dark:text-amber-400">보수적 재고·판가</b>, 상승 지속 시 공급 병목 대비</>}
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
        </> },
        { key: "trade", label: "유통", node: <>
      {ret.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="도소매 유통 성장" unit="전년비 %" labels={ret.labels} series={ret.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="도소매 거래" b /><Lg c={C.teal} t="소매 부가가치" /></>}
          meaning={<>도소매업 성장률 — <b className="text-gray-700 dark:text-gray-200">유통 채널 활력·소비 실현</b></>}
          ai={<>도소매 성장 가속은 채널 판매 여건 개선 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">유통 프로모·진열 확대 적기</b></>}
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
const LABOR_KEYS = ["unemployment_rate", "underemployment_rate", "labor_force_participation_rate", "employed_persons", "ofw_cash_remittance", "ofw_cash_remittance_growth_yoy", "ofw_personal_remittance", "remittances_usd", "population", "urban_population_pct", "min_wage_php", "households_mn", "household_size", "internet_penetration", "electrification_rate", "poverty_rate", "fertility_rate", "median_age", "mobile_per100", "broadband_per100", "account_ownership", "gini_index", "hh_consumption_pc", "gni_per_capita", "life_expectancy", "secondary_enroll", "pop_share_child", "pop_share_youth", "pop_share_working", "pop_share_old"]
export function LaborView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(LABOR_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const un = build(d, n, [{ key: "unemployment_rate", name: "실업률", color: C.ind, w: 2 }, { key: "underemployment_rate", name: "불완전고용", color: C.rose }])
  const lf = build(d, n, [{ key: "labor_force_participation_rate", name: "경제활동참가율", color: C.ind, w: 2 }])
  const emp = build(d, n, [{ key: "employed_persons", name: "취업자 수", color: C.emer, w: 2 }]) // 백만명, 월별 5년
  const rem = build(d, n, [{ key: "ofw_cash_remittance_growth_yoy", name: "송금 증가율", color: C.ind, w: 2 }])
  const remL = build(d, n, [{ key: "ofw_cash_remittance", name: "OFW 현금송금", color: C.emer, w: 2 }])
  const remY = build(d, n, [{ key: "remittances_usd", name: "연간 송금액", color: C.emer, w: 2, tf: (v) => v / 1e9 }]) // USD→십억$, 연간 장기(15년)
  const pop = build(d, n, [{ key: "population", name: "인구", color: C.ind, w: 2, tf: (v) => v / 1e6 }]) // 명→백만명, 연간
  const wage = build(d, n, [{ key: "min_wage_php", name: "최저임금(일급)", color: C.ind, w: 2 }]) // PHP/일, 11년
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
    <Shell title="고용·임금·소득" sub="실업·경제활동참가·OFW 송금 — 가전 구매력" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
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
          ai={<>실업·불완전고용 하락은 소득 안정 신호 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">가전 수요 우호</b>, 상승 시 필수·보급형 우선</>}
          tone="rose" src={src("PSA 노동력조사(LFS) · 월/분기")} />
      )}
      {remL.series.length > 0 && (
        <ChartCard seg="CE" title="OFW 현금송금액" unit="송금 규모" labels={remL.labels} series={remL.series}
          legend={<Lg c={C.emer} t="OFW 현금송금" b />}
          meaning={<>해외근로자 송금 — <b className="text-gray-700 dark:text-gray-200">필리핀 가전·프리미엄 구매의 핵심 재원</b></>}
          ai={<>송금 유입은 가전 특히 <b className="font-semibold text-emerald-600 dark:text-emerald-400">프리미엄·대형 수요를 견인</b> → 송금 성수기(4Q·연말)에 프리미엄 캠페인 집중</>}
          tone="emerald" src={src("BSP OFW 현금송금 · 월별")} />
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
          meaning={<>가구 규모·출산율 하락 — <b className="text-gray-700 dark:text-gray-200">가구 수 증가·소형 가전 수요 구조 전환</b></>}
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
const SENTIMENT_KEYS = ["consumer_confidence_index", "consumer_confidence_next12m", "business_confidence_index", "business_confidence_next12m", "durables_buying_intention"]
export function SentimentView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(SENTIMENT_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const cci = build(d, n, [{ key: "consumer_confidence_index", name: "현재 CCI", color: C.ind, w: 2 }, { key: "consumer_confidence_next12m", name: "향후 12개월", color: C.emer }])
  const bci = build(d, n, [{ key: "business_confidence_index", name: "현재 BCI", color: C.ind, w: 2 }, { key: "business_confidence_next12m", name: "향후 12개월", color: C.blue }])
  const dur = build(d, n, [{ key: "durables_buying_intention", name: "내구재 구매의향", color: C.ind, w: 2 }])
  const empty = !cci.series.length && !bci.series.length && !dur.series.length
  return (
    <Shell title="기업·소비 심리" sub="소비자심리 CCI·기업심리 BCI·내구재 구매의향 — 수요 선행" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ summary: (kv) => <>소비자심리 CCI {B(f1(kv.consumer_confidence_index))}·기업심리 BCI {B(f1(kv.business_confidence_index))}·내구재 구매의향 {B(f1(kv.durables_buying_intention))} — {(kv.consumer_confidence_index ?? 0) < 0 ? "심리 위축, 수요 회복 지연 국면" : "심리 개선, 수요 회복 초입"}</>, headline: <><b className="font-semibold text-gray-900 dark:text-gray-50">소비·기업 심리 = 수요의 3~6개월 선행</b></>, lg: <>내구재 구매의향·CCI 반등 초입에 <b className="font-semibold">신제품·프리미엄 출시 타이밍</b> · 악화 시 가성비·필수형 우선</> }}
      kpiDefs={[
        { key: "consumer_confidence_index", label: "소비자심리 CCI", fmt: (v) => String(v), tone: "emerald" },
        { key: "business_confidence_index", label: "기업심리 BCI", fmt: (v) => String(v), tone: "emerald" },
        { key: "durables_buying_intention", label: "내구재 구매의향", fmt: (v) => String(v), tone: "emerald" },
      ]}>
      {dur.series.length > 0 && (
        <ChartCard seg="CE" title="내구재 구매의향" unit="지수" labels={dur.labels} series={dur.series} decimals={1}
          legend={<Lg c={C.ind} t="내구재 구매의향" b />}
          meaning={<>가전 등 내구재 구매 의향 — <b className="text-gray-700 dark:text-gray-200">실판매의 3~6개월 직접 선행</b></>}
          ai={<>구매의향 반등은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">수개월 뒤 가전 실판매 회복</b>을 예고 → 반등 초입에 신제품·프리미엄 출시 타이밍</>}
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
    </Shell>
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
    <Shell title="물가" sub="생활물가·에너지·주거/내구재 CPI 상승률 — 실질 구매력·원가" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
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
          ai={<>전체 물가 4% 상회 시 필수재 쏠림 → <b className="font-semibold text-amber-600 dark:text-amber-400">가전 구매 이연</b>, 둔화 국면엔 재량소비·프리미엄 전환 회복</>}
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
          ai={<>쌀값 급등은 체감물가·정책개입(수입관세·상한제)을 촉발 → <b className="font-semibold text-amber-600 dark:text-amber-400">소비심리 위축 신호</b>, 안정 시 재량소비 여력 반등</>}
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
          meaning={<>국내 종류별 소매 유가 — <b className="text-gray-700 dark:text-gray-200">운송·물류원가·전기료·전체 물가의 상류 동인</b></>}
          ai={<>유가 상승은 운송·물류·전기료로 전이돼 <b className="font-semibold text-amber-600 dark:text-amber-400">가전 물류원가·소비자 물가 동반 압박</b> → 조달·판가 선제 점검, 하락기엔 원가 여유·프로모 여력</>}
          tone="amber" src={src("DOE 주간 유가(oil_prices) · 월평균")} />
      )}
      {gas.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="휘발유 등급별 (RON95·RON91)" unit="₱/L · 월별" labels={gas.labels} series={gas.series} decimals={1} seriesUnit="₱"
          legend={<><Lg c={C.ind} t="RON95" b /><Lg c={C.rose} t="RON91" /></>}
          meaning={<>휘발유 등급별 소매가 — <b className="text-gray-700 dark:text-gray-200">이동·물류비의 세부 동인, 경유와 함께 원가 상류</b></>}
          ai={<>휘발유가 상승은 방문설치·A/S 물류비와 소비자 이동비용을 함께 압박 → <b className="font-semibold text-amber-600 dark:text-amber-400">서비스 물류원가·체감 구매력 점검</b>, 하락기엔 프로모 여력</>}
          tone="amber" src={src("DOE 주간 유가(RON95·RON91) · 월평균")} />
      )}
        </> },
      ]} />
  )
}
