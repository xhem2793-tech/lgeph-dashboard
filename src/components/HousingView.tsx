"use client"

import React, { useEffect, useMemo, useState } from "react"
import { macroMonthly, infraRegional, type InfraRegion } from "@/lib/supabase"
import { ChartCard, Lg, fmtLabels, type SLine } from "@/components/EconChart"
import { Segmented } from "@/components/Segmented"

const REGSHORT: Record<string, string> = {
  "National Capital Region": "NCR", "Cordillera Administrative Region": "CAR", "Negros Island Region": "NIR",
  "Region I": "I 일로코스", "Region II": "II 카가얀", "Region III": "III 중부루손", "Region IV-A": "IV-A 칼라바르손",
  "Region V": "V 비콜", "Region VI": "VI 서비사야", "Region VII": "VII 중부비사야", "Region VIII": "VIII 동부비사야",
  "Region IX": "IX 삼보앙가", "Region X": "X 북민다나오", "Region XI": "XI 다바오", "Region XII": "XII 소크사르젠", "Region XIII": "XIII 카라가",
}

/** 부동산·주택 — 가전 판매와 상관 최고 분야. BSP 주택가격지수(RPPI)·건축허가·공실·건설투자.
 *  주택 공급(허가·완공)과 가격은 빌트인·초도 가전 수요의 핵심 선행지표. 데이터: macro_indicators + BSP RPPI(2019=100, 분기). */

const C = { ind: "#6366f1", rose: "#dc2626", emer: "#059669", amber: "#d99400", violet: "#7c3aed", teal: "#0f766e" }
const WIN = [{ k: "1Y", n: 1 }, { k: "2Y", n: 2 }, { k: "5Y", n: 5 }, { k: "전체", n: 12 }]
type Mon = Record<string, { dates: string[]; values: number[] }>
type Spec = { key: string; name: string; color: string; tf?: (v: number) => number }

/** 여러 지표를 union 축으로 정렬해 SLine[] + labels 생성(시계열 2점 이상만) */
function build(d: Mon, years: number, specs: Spec[]): { series: SLine[]; labels: string[] } {
  const present = specs.filter((s) => d[s.key] && d[s.key].values.length >= 2)
  if (!present.length) return { series: [], labels: [] }
  const set = new Set<string>()
  present.forEach((s) => d[s.key].dates.forEach((dt) => set.add(dt)))
  const all = Array.from(set).sort()
  const latest = all[all.length - 1]
  const cutoff = (Number(latest.slice(0, 4)) - years) + latest.slice(4)
  let axis = all.filter((dt) => dt >= cutoff)
  if (axis.length < 2) axis = all.slice(-2)
  const series = present.map((s) => {
    const m = new Map(d[s.key].dates.map((dt, i) => [dt, d[s.key].values[i]]))
    return { name: s.name, color: s.color, w: 2, data: axis.map((dt) => { const v = m.get(dt); return v == null ? NaN : (s.tf ? s.tf(v) : v) }) }
  })
  return { series, labels: fmtLabels(axis) }
}
const f1 = (v?: number) => (v == null ? "–" : v.toFixed(1))

export default function HousingView() {
  const [win, setWin] = useState("5Y")
  const [d, setD] = useState<Mon>({})
  useEffect(() => {
    macroMonthly(["rppi_index", "rppi_index_condo", "rppi_index_house", "rppi_yoy", "permits_residential_floorarea", "permits_residential_value", "office_vacancy_ncr", "construction_gva_growth"]).then(setD).catch(() => {})
  }, [])
  const years = WIN.find((w) => w.k === win)!.n

  const rppi = useMemo(() => build(d, years, [
    { key: "rppi_index", name: "전체", color: C.ind }, { key: "rppi_index_condo", name: "콘도", color: C.rose }, { key: "rppi_index_house", name: "단독주택", color: C.emer },
  ]), [d, years])
  const yoy = useMemo(() => build(d, years, [{ key: "rppi_yoy", name: "RPPI 상승률", color: C.violet }]), [d, years])
  const permits = useMemo(() => build(d, years, [{ key: "permits_residential_floorarea", name: "주거 연면적", color: C.teal, tf: (v) => v / 1e6 }]), [d, years])
  const other = useMemo(() => build(d, years, [{ key: "office_vacancy_ncr", name: "오피스 공실률 NCR", color: C.amber }, { key: "construction_gva_growth", name: "건설 GVA 성장", color: C.ind }]), [d, years])

  const [infra, setInfra] = useState<InfraRegion[]>([])
  useEffect(() => { infraRegional().then(setInfra).catch(() => {}) }, [])
  const infraMax = infra.length ? Math.max(...infra.map((r) => r.budgetB)) : 1
  const infraTot = infra.reduce((s, r) => s + r.budgetB, 0)

  const rppiLast = d.rppi_index?.values?.at(-1)
  const yoyLast = d.rppi_yoy?.values?.at(-1)
  const rppiDate = d.rppi_index?.dates?.at(-1)

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

      <div className="overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50/60 dark:bg-indigo-500/[0.08] p-4" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-gray-700 dark:text-gray-200">
            <b className="font-semibold text-gray-900 dark:text-gray-50">주택·부동산</b> — RPPI(2019=100) <b className="text-indigo-700 dark:text-indigo-300">{f1(rppiLast)}</b>{yoyLast != null ? <> · 전년비 <b className={yoyLast >= 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>{yoyLast >= 0 ? "+" : ""}{f1(yoyLast)}%</b></> : null}{rppiDate ? " (" + rppiDate.slice(0, 4) + "Q" + (Math.floor(Number(rppiDate.slice(5, 7)) / 3) + 1) + ")" : ""} — 주택 공급·가격은 <b className="text-gray-700 dark:text-gray-200">빌트인·초도 가전 수요</b> 선행
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4">
      <section className="min-w-0 rounded-xl p-4" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
        {/* 기간 토글 — 타 경제지표 뷰와 동일하게 카드 헤더 내부에 배치 */}
        <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
          <span className="h-[18px] w-1 rounded bg-indigo-500" />
          <h2 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">부동산·주택</h2>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">RPPI·건축허가·공실·인프라</span>
          <span className="ml-auto"><Segmented size="sm" value={win} onChange={setWin} options={WIN.map((w) => ({ k: w.k, label: w.k }))} /></span>
        </header>
        <div className="grid items-stretch gap-4 sm:grid-cols-2">
        {rppi.series.length ? (
          <ChartCard title="주택가격지수 RPPI" seg="CE" unit="2019=100 · 분기" decimals={1}
            legend={<><Lg c={C.ind} t="전체" b /><Lg c={C.rose} t="콘도" /><Lg c={C.emer} t="단독주택" /></>}
            series={rppi.series} labels={rppi.labels}
            meaning={<>BSP 전국 주택 실거래가 지수 — <b className="text-gray-700 dark:text-gray-200">주택자산·구매력·신규 입주</b> 대리</>}
            ai={<>주택가격 상승은 자산효과·신규 입주로 <b className="font-semibold text-emerald-600 dark:text-emerald-400">빌트인·프리미엄 가전 수요</b>에 우호적이나, 과열은 구매력 잠식 양면. 콘도 vs 단독 격차는 채널(도심 소형 vs 교외 대형) 수요 믹스 신호.</>}
            src="BSP 주택가격지수(RPPI, 2019=100)" />
        ) : <Soon label="주택가격지수 RPPI" />}

        {yoy.series.length ? (
          <ChartCard title="RPPI 상승률(전년비)" seg="CE" unit="% · 분기" decimals={1}
            legend={<Lg c={C.violet} t="RPPI 전년비" b />}
            series={yoy.series} labels={yoy.labels}
            meaning={<>주택가격 <b className="text-gray-700 dark:text-gray-200">전년비 상승률</b> — 부동산 경기 모멘텀</>}
            ai={<>상승률 가속은 부동산 경기 확장·신규 준공 파이프라인 확대 신호로 <b className="font-semibold">가전 초도수요 선행</b>. 둔화·마이너스는 준공 지연·구매력 약화로 대형·프리미엄 수요 부담.</>}
            src="BSP RPPI 전년비" />
        ) : <Soon label="RPPI 상승률" />}

        {permits.series.length ? (
          <ChartCard title="주거 건축허가 연면적" seg="B2B·CE" unit="백만㎡ · 분기" decimals={2}
            legend={<Lg c={C.teal} t="주거 연면적" b />}
            series={permits.series} labels={permits.labels}
            meaning={<>승인 건축허가 <b className="text-gray-700 dark:text-gray-200">주거 연면적</b> — 12~24개월 후 준공·입주 선행</>}
            ai={<>건축허가 연면적은 <b className="font-semibold">신규 주택 공급 파이프라인</b>으로, 준공 시차(1~2년) 후 <b className="font-semibold text-emerald-600 dark:text-emerald-400">빌트인·초도 가전 수요</b>로 전환. 지역별 허가 편중은 채널 배치 우선순위 신호(지역 지도 연계).</>}
            src="PSA 건축허가 통계 · 주거 연면적" />
        ) : <Soon label="주거 건축허가 연면적" />}

        {other.series.length ? (
          <ChartCard title="오피스 공실·건설투자" seg="B2B" unit="% · 분기" decimals={1}
            legend={<><Lg c={C.amber} t="오피스 공실률 NCR" b /><Lg c={C.ind} t="건설 GVA 성장" /></>}
            series={other.series} labels={other.labels}
            meaning={<>NCR 오피스 공실률·건설 부가가치 성장 — <b className="text-gray-700 dark:text-gray-200">상업용 공조 수요</b> 대리</>}
            ai={<>공실률 상승은 상업용 신규 착공·B2B 공조 수요 둔화 신호, 건설 GVA 성장은 <b className="font-semibold">시스템에어컨·칠러</b> 발주 환경. 공실 개선+건설 확장 조합이 B2B 우호적.</>}
            src="Colliers·PSA(공실률·건설 GVA)" />
        ) : <Soon label="오피스 공실·건설투자" />}

        {/* 지역별 인프라 투자 — DPWH (B2B 공조·빌트인 발주 환경) */}
        {infra.length > 0 && (
          <div className="flex flex-col rounded-xl p-3.5 sm:col-span-2" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">지역별 인프라 투자 (DPWH)</h3>
              <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">B2B</span>
              <span className="ml-auto text-[10.5px] text-gray-400 dark:text-gray-500">총 ₱{Math.round(infraTot).toLocaleString()}B · {infra.length}개 지역</span>
            </div>
            <div className="mt-2.5 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {infra.map((r) => (
                <div key={r.region} className="flex items-center gap-2">
                  <span className="w-[92px] shrink-0 truncate text-[11.5px] font-semibold text-gray-700 dark:text-gray-200" title={r.region}>{REGSHORT[r.region] || r.region}</span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                    <div className="absolute inset-y-0 left-0 rounded bg-amber-500/85" style={{ width: Math.max(3, (r.budgetB / infraMax) * 100) + "%" }} />
                  </div>
                  <span className="w-[52px] shrink-0 text-right text-[11px] font-bold tabular-nums text-gray-800 dark:text-gray-100">₱{r.budgetB.toFixed(0)}B</span>
                  <span className="hidden w-[64px] shrink-0 text-right text-[10px] tabular-nums text-gray-400 dark:text-gray-500 sm:inline">{(r.projects / 1000).toFixed(1)}k건</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> 지역별 공공 인프라 예산·프로젝트 — <b className="text-gray-700 dark:text-gray-200">신규 청사·병원·상업복합의 시스템에어컨·칠러 발주 환경</b> 대리(Build Better More 연계)</p>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">DPWH Transparency(공개) · 지역별 예산·건수·집행상태 집계</p>
          </div>
        )}
        </div>
      </section>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">BSP 주택가격지수(RPPI, 2019=100, 분기·전국) · PSA 건축허가 · 공실률(Colliers)·건설 GVA(PSA) · NCR/지역별 세부·프리셀링·모기지는 분기 리포트 수동 취합 예정</p>
    </div>
  )
}

function Soon({ label }: { label: string }) {
  return <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 text-[12px] text-gray-400"><b className="text-[12.5px] text-gray-500 dark:text-gray-400">{label}</b><span className="mt-1">데이터 준비 중</span></div>
}
