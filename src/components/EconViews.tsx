"use client"

import React, { useEffect, useState } from "react"
import { macroMonthly, calendarUpcoming } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"
import { ChartCard, Lg, SLine, moLabel, tail } from "@/components/EconChart"

/** 주요 지표 카테고리 뷰 — 전부 Supabase(macro_indicators, geo_level=national) 실측.
 *  환율(FxView)과 동일한 차트(평소 선만·호버 점·핵심요약 애니메이션) + 의미 + AI 분석(LGE-PH 관점) + 출처.
 *  각 카드는 지표 1~3계열을 한 축에 겹쳐 그림. 창(1Y/2Y/전체) 토글 공용. */

type Mon = Record<string, { dates: string[]; values: number[] }>
const WIN = [{ k: "1Y", n: 12 }, { k: "2Y", n: 24 }, { k: "전체", n: 60 }]

// 시리즈 팔레트(환율과 동일 계열)
const C = { ind: "#6366f1", rose: "#dc2626", blue: "#0284c7", emer: "#059669", amber: "#d99400", violet: "#7c3aed", teal: "#0f766e", brown: "#a1795b" }

type Spec = { key: string; name: string; color: string; w?: number; tf?: (v: number) => number }
/** 여러 지표를 한 카드에 정렬해 SLine[] + labels 생성. 시계열(2점 이상)만 라인으로. */
function build(d: Mon, n: number, specs: Spec[]): { series: SLine[]; labels: string[] } {
  const present = specs.filter((s) => d[s.key] && d[s.key].values.length >= 2) // 1점짜리는 라인 불가 → 제외(KPI 타일로 대체)
  if (!present.length) return { series: [], labels: [] }
  const L = Math.min(n, ...present.map((s) => d[s.key].values.length))
  const series = present.map((s) => ({ name: s.name, color: s.color, w: s.w, data: tail(d[s.key].values, L).map((v) => (s.tf ? s.tf(v) : v)) }))
  const labels = tail(d[present[0].key].dates, L).map(moLabel)
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
  useEffect(() => { macroMonthly(keys, 60).then((r) => { setD(r); setLoaded(true) }).catch(() => setLoaded(true)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { d, loaded }
}

// ── 접이식 배너(환율 페이지와 동일) ───────────────────────────────────────
type BannerDef = { headline: React.ReactNode; lg?: React.ReactNode }
function Banner({ headline, lg, d, kpiDefs }: BannerDef & { d: Mon; kpiDefs?: KpiDef[] }) {
  const [open, setOpen] = useState(false)
  const items = (kpiDefs ?? []).map((k) => ({ ...k, cur: latestOf(d, k.key) })).filter((k) => k.cur)
  const tc = (t?: string) => (t === "rose" ? "text-rose-600" : t === "emerald" ? "text-emerald-600" : t === "amber" ? "text-amber-600" : "text-gray-900")
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-indigo-50/40 to-white shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
      <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer select-none items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></svg>
        </div>
        <div className="min-w-0 flex-1 text-[13px] text-gray-700">{headline}</div>
        {lg && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-400 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>}
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-indigo-100/70 bg-white/50 px-4 py-2.5">
          {items.map((k) => (
            <div key={k.key} className="flex items-baseline gap-1.5">
              <span className="text-[10.5px] font-medium text-gray-500">{k.label}</span>
              <span className={"text-[15px] font-bold tabular-nums " + tc(k.tone)}>{k.fmt(k.cur!.v)}</span>
            </div>
          ))}
          <span className="ml-auto text-[10px] text-gray-400">{moLabel(items[0].cur!.date)} 기준</span>
        </div>
      )}
      {lg && (
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
          <div className="overflow-hidden">
            <div className="border-t border-indigo-100/70 px-4 pb-3.5 pt-3">
              <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-indigo-700">
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
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both", animationDelay: "80ms" }}>
      <header className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
        <h2 className="text-[15px] font-bold tracking-tight text-gray-900">경제 일정</h2>
        <span className="text-[11px] text-gray-400">지표 발표</span>
      </header>
      <div className="mt-2 flex flex-col">
        {ev.map((x, i) => {
          const dd = dday(x.date)
          return (
            <div key={i} style={{ animation: "fadeUp .5s ease both", animationDelay: 60 + i * 40 + "ms" }} className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-indigo-50/40">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-gray-900">{x.event}</span>
                <span className="block text-[10.5px] text-gray-500">{x.category}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[11px] font-semibold text-gray-500">{dd === 0 ? "오늘" : dd > 0 ? "D-" + dd : "D+" + -dd}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 공용 셸 — 환율 페이지와 동일 레이아웃(배너 + 좌 차트 | 우 위젯 286px) ──
function Shell({ title, sub, win, setWin, loaded, empty, banner, kpiDefs, d, children }: { title: string; sub: string; win: string; setWin: (k: string) => void; loaded: boolean; empty: boolean; banner?: BannerDef; kpiDefs?: KpiDef[]; d: Mon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      {banner && <Banner {...banner} d={d} kpiDefs={loaded ? kpiDefs : undefined} />}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
          <header className="mb-3.5 flex flex-wrap items-center gap-2.5 border-b border-gray-100 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900">{title}</h2>
            <span className="text-[11px] font-semibold text-gray-400">{sub}</span>
            <span className="ml-auto">
              <Segmented size="sm" value={win} onChange={setWin} options={WIN.map((w) => ({ k: w.k, label: w.k }))} />
            </span>
          </header>
          {!loaded ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />)}
            </div>
          ) : empty ? (
            <div className="flex h-52 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 text-center">
              <div className="text-[14px] font-bold text-gray-500">데이터 적재 대기</div>
              <div className="text-[12px] text-gray-400">해당 지표가 아직 Supabase에 없음 · 수집 후 자동 표시</div>
            </div>
          ) : (
            <div className="grid items-stretch gap-4 sm:grid-cols-2">{children}</div>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <AgendaCard />
        </aside>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400">출처 PSA·BSP 공식통계(Supabase macro_indicators) · 색=사업영향(원가·부담↑ rose, 수요·구매력↑ emerald)</p>
    </div>
  )
}

const src = (s: string) => (<><b className="font-semibold text-gray-500">자료</b> {s}</>)

// ══════════════════════════════════════════════════════════════════════
// 가전 선행지표 — PPI·수입·가전물가·전기료
// ══════════════════════════════════════════════════════════════════════
const APPLIANCE_KEYS = ["PPI_domestic_appliances", "PPI_electrical", "PPI_electronics", "PPI_manufacturing", "imports_home_appliances", "imports_consumer_electronics", "imports_telecom", "INF_household_appliances", "INF_aircon", "INF_all_items", "meralco_residential_rate"]
export function ApplianceView() {
  const [win, setWin] = useState("2Y")
  const { d, loaded } = useMacro(APPLIANCE_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const ppi = build(d, n, [{ key: "PPI_domestic_appliances", name: "가전 PPI", color: C.ind, w: 2 }, { key: "PPI_electrical", name: "전기기기", color: C.rose }, { key: "PPI_electronics", name: "전자", color: C.blue }])
  const imp = build(d, n, [{ key: "imports_home_appliances", name: "가전 수입", color: C.ind, w: 2 }]) // 연간 무역통계 → 막대
  const inf = build(d, n, [{ key: "INF_household_appliances", name: "가전 물가", color: C.ind, w: 2 }, { key: "INF_aircon", name: "에어컨", color: C.rose }, { key: "INF_all_items", name: "전체 CPI", color: C.brown }])
  const elec = build(d, n, [{ key: "meralco_residential_rate", name: "가정용 전기료", color: C.ind, w: 2 }])
  const empty = !ppi.series.length && !imp.series.length && !inf.series.length && !elec.series.length
  return (
    <Shell title="가전 선행지표" sub="생산자물가·수입액·가전물가·전기료 — 원가·공급 선행" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ headline: <><b className="font-semibold text-gray-900">가전 원가·공급 선행지표</b> — PPI·수입·전기료로 원가/경쟁 압박을 조기 포착</>, lg: <>PPI·수입 급등은 원가·중국계 물량 신호 → <b className="font-semibold">조달 헤지·프로모 타이밍</b> 선제 대응 · 전기료↑엔 고효율 프리미엄 소구</> }}
      kpiDefs={[
        { key: "INF_household_appliances", label: "가전 물가 YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "INF_aircon", label: "에어컨 물가 YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "PPI_domestic_appliances", label: "가전 PPI YoY", fmt: (v) => v + "%", tone: "rose" },
        { key: "meralco_residential_rate", label: "전기료", fmt: (v) => "₱" + v.toFixed(2), tone: "amber" },
      ]}>
      {ppi.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="가전 생산자물가 PPI" unit="지수" labels={ppi.labels} series={ppi.series}
          legend={<><Lg c={C.ind} t="가전 PPI" b /><Lg c={C.rose} t="전기기기" /><Lg c={C.blue} t="전자" /></>}
          meaning={<>생산단계 출고가격 — <b className="text-gray-700">소비자가·조달원가의 수개월 선행</b></>}
          ai={<>가전 PPI 상승은 수개월 뒤 출고가·원가로 전이 → <b className="font-semibold text-rose-600">선제 판가·조달 대응</b>, 부품 헤지·현지조달 비중 점검</>}
          tone="rose" src={src("PSA 생산자물가지수(PPI) · 월별")} />
      )}
      {imp.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="가전 수입액" unit="연간 · 무역통계" kind="bar" labels={imp.labels} series={imp.series}
          legend={<Lg c={C.ind} t="가전 완제품 수입" b />}
          meaning={<>완제품·부품 수입 규모 — <b className="text-gray-700">시장 공급량·경쟁 강도 선행</b></>}
          ai={<>수입 급증은 중국계 물량 유입 신호 → <b className="font-semibold text-amber-600">채널 재고·가격 경쟁 압박</b>, 프로모 타이밍·SKU 방어 필요</>}
          tone="amber" src={src("PSA 수출입통계 · 월별")} />
      )}
      {inf.series.length > 0 && (
        <ChartCard seg="CE" title="가전 소비자물가 상승률" unit="전년비 %" labels={inf.labels} series={inf.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="가전 물가" b /><Lg c={C.rose} t="에어컨" /><Lg c={C.brown} t="전체 CPI" /></>}
          meaning={<>가전 소매물가 상승률 vs 전체 물가 — <b className="text-gray-700">가전의 실질 가격 매력</b></>}
          ai={<>가전 물가가 전체 CPI보다 낮으면 <b className="font-semibold text-emerald-600">실질 저렴 → 구매 매력↑</b>, 높으면 구매 저항 → 보급형·프로모 강화</>}
          tone="rose" src={src("PSA CPI(가전·에어컨) · 전년비")} />
      )}
      {elec.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="가정용 전기요금 (Meralco)" unit="₱/kWh" labels={elec.labels} series={elec.series} decimals={2}
          legend={<Lg c={C.ind} t="가정용 전기료" b />}
          meaning={<>전기요금 = 가전 <b className="text-gray-700">사용비용·에너지효율 소구력</b> 결정</>}
          ai={<>전기료 상승기엔 <b className="font-semibold text-emerald-600">인버터·고효율 프리미엄 소구</b>가 유리 → 에너지 절감액을 판매 메시지로 전환</>}
          tone="amber" src={src("Meralco 가정용 요금 · 월별")} />
      )}
    </Shell>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 통화·금리·신용 — 정책금리·M3·가계신용
// ══════════════════════════════════════════════════════════════════════
const RATES_KEYS = ["BSP_policy_rate", "BSP_odf_rate", "BSP_olf_rate", "interbank_call_rate", "m3_growth_yoy", "broad_money_growth", "bank_loan_growth_yoy", "consumer_loan_growth_yoy", "credit_card_loan_growth_yoy"]
export function RatesView() {
  const [win, setWin] = useState("2Y")
  const { d, loaded } = useMacro(RATES_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const pol = build(d, n, [{ key: "BSP_policy_rate", name: "정책금리 RRP", color: C.ind, w: 2 }, { key: "BSP_olf_rate", name: "상한 OLF", color: C.rose }, { key: "BSP_odf_rate", name: "하한 ODF", color: C.blue }])
  const m3 = build(d, n, [{ key: "m3_growth_yoy", name: "M3 통화량", color: C.ind, w: 2 }, { key: "broad_money_growth", name: "광의통화", color: C.teal }])
  const loan = build(d, n, [{ key: "consumer_loan_growth_yoy", name: "소비자대출", color: C.ind, w: 2 }, { key: "credit_card_loan_growth_yoy", name: "신용카드", color: C.rose }, { key: "bank_loan_growth_yoy", name: "은행 총대출", color: C.blue }])
  const call = build(d, n, [{ key: "interbank_call_rate", name: "콜금리", color: C.ind, w: 2 }])
  const empty = !pol.series.length && !m3.series.length && !loan.series.length && !call.series.length
  return (
    <Shell title="통화·금리·신용" sub="기준금리·통화량 M3·가계신용 — 할부·카드 구매력" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ headline: <><b className="font-semibold text-gray-900">통화·신용 = 가전 구매력 엔진</b> — 정책금리·M3·가계신용이 할부/카드 수요를 좌우</>, lg: <>금리 인하·카드/소비자대출 확장기엔 <b className="font-semibold">무이자 할부·프리미엄 푸시</b>가 유효 · 콜금리 급등 시 유통 운전자금 부담 관찰</> }}
      kpiDefs={[
        { key: "BSP_policy_rate", label: "정책금리 RRP", fmt: (v) => v + "%", tone: "amber" },
        { key: "m3_growth_yoy", label: "통화량 M3", fmt: (v) => v + "%", tone: "emerald" },
        { key: "consumer_loan_growth_yoy", label: "소비자대출", fmt: (v) => v + "%", tone: "emerald" },
        { key: "credit_card_loan_growth_yoy", label: "신용카드 대출", fmt: (v) => v + "%", tone: "emerald" },
        { key: "bank_loan_growth_yoy", label: "은행 총대출", fmt: (v) => v + "%", tone: "emerald" },
      ]}>
      {pol.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="BSP 정책금리 corridor" unit="%" labels={pol.labels} series={pol.series} decimals={2} seriesUnit="%"
          legend={<><Lg c={C.ind} t="정책금리 RRP" b /><Lg c={C.rose} t="상한 OLF" /><Lg c={C.blue} t="하한 ODF" /></>}
          meaning={<>기준금리·상하한(corridor) — <b className="text-gray-700">할부·소비자 금융비용의 기준</b></>}
          ai={<>금리 인하기엔 <b className="font-semibold text-emerald-600">할부·카드 이자 부담↓ = 가전 구매력↑</b> → 무이자 할부·금융 프로모로 수요 견인 유리</>}
          tone="amber" src={src("BSP 정책금리·ODF·OLF · 일별")} />
      )}
      {loan.series.length > 0 && (
        <ChartCard seg="CE" title="가계·카드 신용 성장" unit="전년비 %" labels={loan.labels} series={loan.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="소비자대출" b /><Lg c={C.rose} t="신용카드" /><Lg c={C.blue} t="은행 총대출" /></>}
          meaning={<>가계·카드 대출 증가율 — <b className="text-gray-700">가전 할부 구매의 직접 재원</b></>}
          ai={<>카드·소비자대출 확대는 <b className="font-semibold text-emerald-600">내구재 할부 수요 선행</b> → 신용 확장기에 프리미엄·대형 라인업 푸시</>}
          tone="emerald" src={src("BSP 대출통계(소비자·카드·은행) · 전년비")} />
      )}
      {m3.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="통화량 M3 증가율" unit="전년비 %" labels={m3.labels} series={m3.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="M3 통화량" b /><Lg c={C.teal} t="광의통화" /></>}
          meaning={<>시중 유동성 증가율 — <b className="text-gray-700">소비여력·신용 확대 여지</b></>}
          ai={<>M3 확대는 유동성·소비여력 개선 신호 → <b className="font-semibold text-emerald-600">수요 회복 국면</b> 판단의 거시 배경</>}
          tone="emerald" src={src("BSP 통화총량(M3) · 월별")} />
      )}
      {call.series.length > 0 && (
        <ChartCard seg="B2B" title="은행간 콜금리" unit="%" labels={call.labels} series={call.series} decimals={2} seriesUnit="%"
          legend={<Lg c={C.ind} t="콜금리" b />}
          meaning={<>단기 시장금리 — <b className="text-gray-700">정책금리 전이·자금시장 긴장도</b></>}
          ai={<>콜금리 급등은 자금경색 신호 → 유통·딜러 <b className="font-semibold text-amber-600">운전자금 부담·재고 조정</b> 가능성 관찰</>}
          tone="amber" src={src("BSP 은행간 콜금리 · 일별")} />
      )}
    </Shell>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 국민계정·성장 — GDP·소비·투자·건설·산업·유통
// ══════════════════════════════════════════════════════════════════════
const GROWTH_KEYS = ["gdp_growth_yoy", "household_consumption_yoy", "gross_capital_formation_yoy", "gfcf_growth", "construction_gva_growth", "construction_gfcf_growth", "permits_residential_value", "permits_total_value", "permits_nonresidential_floorarea", "industry_gva_yoy", "industry_va_growth", "manufacturing_va_growth", "services_va_growth", "capacity_utilization", "retail_gva_growth", "wholesale_retail_trade_yoy", "services_gva_yoy"]
export function GrowthView() {
  const [win, setWin] = useState("전체")
  const { d, loaded } = useMacro(GROWTH_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const gdp = build(d, n, [{ key: "gdp_growth_yoy", name: "GDP 성장률", color: C.ind, w: 2 }, { key: "household_consumption_yoy", name: "민간소비", color: C.emer }, { key: "gross_capital_formation_yoy", name: "총투자", color: C.blue }])
  const cons = build(d, n, [{ key: "construction_gva_growth", name: "건설 부가가치", color: C.ind, w: 2 }, { key: "permits_residential_value", name: "주거 건축허가", color: C.violet }])
  const ind = build(d, n, [{ key: "industry_gva_yoy", name: "산업", color: C.ind, w: 2 }, { key: "manufacturing_va_growth", name: "제조업", color: C.rose }, { key: "capacity_utilization", name: "가동률", color: C.amber }])
  const ret = build(d, n, [{ key: "wholesale_retail_trade_yoy", name: "도소매 거래", color: C.ind, w: 2 }, { key: "retail_gva_growth", name: "소매 부가가치", color: C.teal }])
  const permit = build(d, n, [{ key: "permits_nonresidential_floorarea", name: "비주거 착공면적", color: C.ind, w: 2, tf: (v) => v / 1e6 }])
  const va = build(d, n, [{ key: "manufacturing_va_growth", name: "제조업", color: C.ind, w: 2 }, { key: "industry_va_growth", name: "산업", color: C.rose }, { key: "services_va_growth", name: "서비스", color: C.emer }])
  const empty = !gdp.series.length && !cons.series.length && !ind.series.length && !ret.series.length && !permit.series.length && !va.series.length
  return (
    <Shell title="국민계정·성장" sub="GDP·소비·투자·건설허가·산업·유통 — 가전 수요 파이" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ headline: <><b className="font-semibold text-gray-900">국민계정으로 본 가전 수요 파이</b> — 소비·투자·건설허가가 시장 크기를 결정</>, lg: <>민간소비·주거 착공 회복은 <b className="font-semibold">가전 신규수요 선행</b> → 성장 밀집 지역 채널·재고 선점, 둔화 시 보급형 방어</> }}
      kpiDefs={[
        { key: "gdp_growth_yoy", label: "GDP 성장률", fmt: (v) => v + "%", tone: "emerald" },
        { key: "household_consumption_yoy", label: "민간소비", fmt: (v) => v + "%", tone: "emerald" },
        { key: "gross_capital_formation_yoy", label: "총투자", fmt: (v) => v + "%", tone: "emerald" },
        { key: "capacity_utilization", label: "가동률", fmt: (v) => v + "%", tone: "amber" },
      ]}>
      {gdp.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="GDP·소비·투자 성장률" unit="전년비 %" labels={gdp.labels} series={gdp.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="GDP 성장률" b /><Lg c={C.emer} t="민간소비" /><Lg c={C.blue} t="총투자" /></>}
          meaning={<>경제·소비·투자 성장률 — <b className="text-gray-700">가전 시장 전체 파이의 크기</b></>}
          ai={<>민간소비 성장은 가전 수요와 직결 → <b className="font-semibold text-emerald-600">소비 확장기에 시장 성장 가속</b>, 둔화 시 보급형 방어</>}
          tone="emerald" src={src("PSA 국민계정(GDP·GDE) · 분기")} />
      )}
      {cons.series.length > 0 && (
        <ChartCard seg="B2B" title="건설·주거 건축허가" unit="증가율·규모" labels={cons.labels} series={cons.series} decimals={1}
          legend={<><Lg c={C.ind} t="건설 부가가치" b /><Lg c={C.violet} t="주거 건축허가" /></>}
          meaning={<>신축·주거 착공 — <b className="text-gray-700">빌트인·냉난방·신규 가전 수요의 6~12개월 선행</b></>}
          ai={<>주거 건축허가 증가는 <b className="font-semibold text-emerald-600">신규 가전·에어컨 수요 선행</b> → 착공 밀집 지역에 채널·재고 선제 배치</>}
          tone="emerald" src={src("PSA 건설통계·건축허가 · 분기/월")} />
      )}
      {ind.series.length > 0 && (
        <ChartCard seg="B2B" title="산업·제조·가동률" unit="전년비 % / %" labels={ind.labels} series={ind.series} decimals={1}
          legend={<><Lg c={C.ind} t="산업" b /><Lg c={C.rose} t="제조업" /><Lg c={C.amber} t="가동률" /></>}
          meaning={<>산업 생산·가동률 — <b className="text-gray-700">현지 조달·공급망·경기 국면</b></>}
          ai={<>가동률·제조업 둔화는 경기 하강 신호 → <b className="font-semibold text-amber-600">수요 위축 대비</b>, 재고·판가 보수적 운영</>}
          tone="amber" src={src("PSA 산업생산·가동률 · 분기/월")} />
      )}
      {ret.series.length > 0 && (
        <ChartCard seg="CE·B2B" title="도소매 유통 성장" unit="전년비 %" labels={ret.labels} series={ret.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="도소매 거래" b /><Lg c={C.teal} t="소매 부가가치" /></>}
          meaning={<>도소매업 성장률 — <b className="text-gray-700">유통 채널 활력·소비 실현</b></>}
          ai={<>도소매 성장 가속은 채널 판매 여건 개선 → <b className="font-semibold text-emerald-600">유통 프로모·진열 확대 적기</b></>}
          tone="emerald" src={src("PSA 국민계정 도소매업 · 분기")} />
      )}
      {permit.series.length > 0 && (
        <ChartCard seg="B2B" title="비주거 건축허가(상업·산업)" unit="백만 ㎡ · 분기" kind="bar" labels={permit.labels} series={permit.series} decimals={2}
          legend={<Lg c={C.ind} t="비주거 착공면적" b />}
          meaning={<>상업·산업 신축 착공면적 — <b className="text-gray-700">B2B 냉난방·빌트인 수요의 선행</b></>}
          ai={<>비주거 착공 확대는 <b className="font-semibold text-emerald-600">상업용 HVAC·빌트인 프로젝트 수요 선행</b> → B2B 파이프라인·입찰 선제 대응</>}
          tone="emerald" src={src("PSA 건축허가(비주거) · 분기")} />
      )}
      {va.series.length > 0 && (
        <ChartCard seg="B2B" title="부문별 부가가치 성장" unit="전년비 %" labels={va.labels} series={va.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="제조업" b /><Lg c={C.rose} t="산업" /><Lg c={C.emer} t="서비스" /></>}
          meaning={<>제조·산업·서비스 부문 성장 — <b className="text-gray-700">B2B 수요처 업황·설비투자 여력</b></>}
          ai={<>제조·서비스 업황 개선은 <b className="font-semibold text-emerald-600">기업 설비·시설 투자 여력</b> → B2B 상업용·산업용 수요 우호</>}
          tone="emerald" src={src("PSA 국민계정 부문별 GVA · 연간")} />
      )}
    </Shell>
  )
}

// ══════════════════════════════════════════════════════════════════════
// 고용·임금·소득 — 실업·참가·OFW 송금·인구
// ══════════════════════════════════════════════════════════════════════
const LABOR_KEYS = ["unemployment_rate", "underemployment_rate", "labor_force_participation_rate", "employed_persons", "ofw_cash_remittance", "ofw_cash_remittance_growth_yoy", "ofw_personal_remittance", "remittances_usd", "population", "urban_population_pct"]
export function LaborView() {
  const [win, setWin] = useState("2Y")
  const { d, loaded } = useMacro(LABOR_KEYS)
  const n = WIN.find((w) => w.k === win)!.n
  const un = build(d, n, [{ key: "unemployment_rate", name: "실업률", color: C.ind, w: 2 }, { key: "underemployment_rate", name: "불완전고용", color: C.rose }])
  const lf = build(d, n, [{ key: "labor_force_participation_rate", name: "경제활동참가율", color: C.ind, w: 2 }])
  const rem = build(d, n, [{ key: "ofw_cash_remittance_growth_yoy", name: "송금 증가율", color: C.ind, w: 2 }])
  const remL = build(d, n, [{ key: "ofw_cash_remittance", name: "OFW 현금송금", color: C.emer, w: 2 }])
  const empty = !un.series.length && !lf.series.length && !rem.series.length && !remL.series.length
  return (
    <Shell title="고용·임금·소득" sub="실업·경제활동참가·OFW 송금 — 가전 구매력" win={win} setWin={setWin} loaded={loaded} empty={empty} d={d}
      banner={{ headline: <><b className="font-semibold text-gray-900">고용·OFW 송금 = 가전 구매력의 원천</b> — 소득 안정과 송금이 수요를 견인</>, lg: <>실업 하락·송금 증가는 가처분소득↑ → <b className="font-semibold">송금 성수기(4Q·연말) 프리미엄 집중</b> · 페소 약세와 겹치면 환산 구매력 추가 상승</> }}
      kpiDefs={[
        { key: "unemployment_rate", label: "실업률", fmt: (v) => v + "%", tone: "rose" },
        { key: "underemployment_rate", label: "불완전고용", fmt: (v) => v + "%", tone: "rose" },
        { key: "ofw_cash_remittance_growth_yoy", label: "OFW 송금 YoY", fmt: (v) => v + "%", tone: "emerald" },
        { key: "labor_force_participation_rate", label: "경제활동참가", fmt: (v) => v + "%", tone: "emerald" },
      ]}>
      {un.series.length > 0 && (
        <ChartCard seg="CE" title="실업·불완전고용률" unit="%" labels={un.labels} series={un.series} decimals={1} seriesUnit="%"
          legend={<><Lg c={C.ind} t="실업률" b /><Lg c={C.rose} t="불완전고용" /></>}
          meaning={<>고용 여건 — <b className="text-gray-700">가처분소득·내구재 구매 여력</b></>}
          ai={<>실업·불완전고용 하락은 소득 안정 신호 → <b className="font-semibold text-emerald-600">가전 수요 우호</b>, 상승 시 필수·보급형 우선</>}
          tone="rose" src={src("PSA 노동력조사(LFS) · 월/분기")} />
      )}
      {remL.series.length > 0 && (
        <ChartCard seg="CE" title="OFW 현금송금액" unit="송금 규모" labels={remL.labels} series={remL.series}
          legend={<Lg c={C.emer} t="OFW 현금송금" b />}
          meaning={<>해외근로자 송금 — <b className="text-gray-700">필리핀 가전·프리미엄 구매의 핵심 재원</b></>}
          ai={<>송금 유입은 가전 특히 <b className="font-semibold text-emerald-600">프리미엄·대형 수요를 견인</b> → 송금 성수기(4Q·연말)에 프리미엄 캠페인 집중</>}
          tone="emerald" src={src("BSP OFW 현금송금 · 월별")} />
      )}
      {rem.series.length > 0 && (
        <ChartCard seg="CE" title="OFW 송금 증가율" unit="전년비 %" labels={rem.labels} series={rem.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="송금 증가율" b />}
          meaning={<>송금 증가율 — <b className="text-gray-700">구매력 모멘텀</b></>}
          ai={<>송금 증가율 가속은 <b className="font-semibold text-emerald-600">가처분소득 모멘텀</b> → 페소 약세와 겹치면 페소환산 송금 구매력 추가 상승</>}
          tone="emerald" src={src("BSP OFW 현금송금 · 전년비")} />
      )}
      {lf.series.length > 0 && (
        <ChartCard seg="CE" title="경제활동참가율" unit="%" labels={lf.labels} series={lf.series} decimals={1} seriesUnit="%"
          legend={<Lg c={C.ind} t="경제활동참가율" b />}
          meaning={<>노동시장 참여율 — <b className="text-gray-700">소득 창출 인구 저변</b></>}
          ai={<>참가율 상승은 소득 기반 확대 → <b className="font-semibold text-emerald-600">중장기 수요 저변 확대</b> 신호</>}
          tone="emerald" src={src("PSA 노동력조사(LFS) · 월/분기")} />
      )}
    </Shell>
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
      banner={{ headline: <><b className="font-semibold text-gray-900">소비·기업 심리 = 수요의 3~6개월 선행</b> — 내구재 구매의향이 실판매를 예고</>, lg: <>내구재 구매의향·CCI 반등 초입에 <b className="font-semibold">신제품·프리미엄 출시 타이밍</b> · 악화 시 가성비·필수형 우선</> }}
      kpiDefs={[
        { key: "consumer_confidence_index", label: "소비자심리 CCI", fmt: (v) => String(v), tone: "emerald" },
        { key: "business_confidence_index", label: "기업심리 BCI", fmt: (v) => String(v), tone: "emerald" },
        { key: "durables_buying_intention", label: "내구재 구매의향", fmt: (v) => String(v), tone: "emerald" },
      ]}>
      {dur.series.length > 0 && (
        <ChartCard seg="CE" title="내구재 구매의향" unit="지수" labels={dur.labels} series={dur.series} decimals={1}
          legend={<Lg c={C.ind} t="내구재 구매의향" b />}
          meaning={<>가전 등 내구재 구매 의향 — <b className="text-gray-700">실판매의 3~6개월 직접 선행</b></>}
          ai={<>구매의향 반등은 <b className="font-semibold text-emerald-600">수개월 뒤 가전 실판매 회복</b>을 예고 → 반등 초입에 신제품·프리미엄 출시 타이밍</>}
          tone="emerald" src={src("BSP 소비자기대조사 내구재 구매의향 · 분기")} />
      )}
      {cci.series.length > 0 && (
        <ChartCard seg="CE" title="소비자심리 CCI" unit="지수" labels={cci.labels} series={cci.series} decimals={1}
          legend={<><Lg c={C.ind} t="현재 CCI" b /><Lg c={C.emer} t="향후 12개월" /></>}
          meaning={<>소비자 신뢰지수 — <b className="text-gray-700">가계 지출 심리·수요 선행</b></>}
          ai={<>CCI 개선은 재량 지출 확대 신호 → <b className="font-semibold text-emerald-600">프리미엄 전환 수요</b>, 악화 시 가성비·필수형 우선</>}
          tone="emerald" src={src("BSP 소비자기대조사(CES) · 분기")} />
      )}
      {bci.series.length > 0 && (
        <ChartCard seg="B2B" title="기업심리 BCI" unit="지수" labels={bci.labels} series={bci.series} decimals={1}
          legend={<><Lg c={C.ind} t="현재 BCI" b /><Lg c={C.blue} t="향후 12개월" /></>}
          meaning={<>기업 신뢰지수 — <b className="text-gray-700">B2B·유통 투자·재고 심리</b></>}
          ai={<>BCI 개선은 유통·B2B 발주 확대 여건 → <b className="font-semibold text-emerald-600">채널 재고·프로젝트 수주</b> 우호</>}
          tone="emerald" src={src("BSP 기업기대조사(BES) · 분기")} />
      )}
    </Shell>
  )
}
