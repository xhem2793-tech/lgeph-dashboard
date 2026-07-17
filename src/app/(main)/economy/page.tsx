"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import DailyIndicators from "@/components/DailyIndicators"
import { ProChart, CountUp } from "@/components/ProChartCore"
import { homeBand, econSeries } from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 경제지표 페이지 — 뉴스형 좌측 메뉴 + 섹션.
 *
 *  ■ 겹침 해결(블룸버그 원칙: 같은 데이터, 세 가지 역할)
 *   · 원본  = 상세 차트 + 12개월 표 + 출처. 한 지표당 딱 한 번.
 *   · 참조  = 배지(현재값) + "원본 보기" 링크. 차트 없음.
 *   · 파생  = 여러 지표를 조합해 만든 새 숫자. 구성요소 차트 없음.
 *
 *  ■ 우리만의 강점 = 사업 레이더(파생). 블룸버그엔 없는, 가전 영업 관점 산출지표.
 *  ■ 색은 방향이 아니라 사업영향 — 원가·물가↑=로즈, 수요·구매력 개선=에메랄드.
 */

type Card = Awaited<ReturnType<typeof homeBand>>[number]
type Series = Awaited<ReturnType<typeof econSeries>>[string]

/* ── 섹션 구성: 각 지표는 '원본' 섹션에 딱 한 번만 배치 ── */
const ORIGIN: Record<string, string[]> = {
  macro: ["cci", "durable", "retgva", "congva", "remit"],
  cost: ["cpi", "elec", "foodinf", "riceinf", "lpginf", "traninf"],
  appliance: ["appinf", "acinf", "ppiapp"],
}

const NAV = [
  { id: "today", ko: "오늘의 수치", en: "Today", note: "환율·유가·날씨" },
  { id: "macro", ko: "시장·수요 환경", en: "Demand", note: "성장·소비심리·송금" },
  { id: "cost", ko: "원가·물가 압력", en: "Cost & CPI", note: "물가·전기·연료" },
  { id: "appliance", ko: "가전 가격 신호", en: "Appliance", note: "가전·에어컨·PPI" },
  { id: "radar", ko: "사업 레이더", en: "Radar", note: "가전 영업 산출지표", star: true },
  { id: "all", ko: "전체 경제지표", en: "All indicators", note: "16개 한눈에" },
]

const scale = (key: string, v: number) => (key === "remit" ? v / 1e9 : v)

function decimals(c: Card) {
  const m = /\.(\d+)/.exec(c.value ?? "")
  return m ? Math.min(m[1].length, 2) : c.suffix === "%" ? 1 : 0
}

function periodLabel(iso: string, freq: string) {
  const y = iso.slice(2, 4)
  const mo = Number(iso.slice(5, 7))
  return freq === "분기" ? `${Math.floor((mo - 1) / 3) + 1}Q${y}` : `${mo}월`
}

function tone(dir: string, delta: number | null) {
  if (delta == null || delta === 0 || dir === "neutral") return { cls: "text-gray-400", arrow: "" }
  const up = delta > 0
  const bad = dir === "bad" ? up : !up
  return { cls: bad ? "text-rose-600" : "text-emerald-600", arrow: up ? "↑" : "↓" }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const num = (s: string | undefined) => {
  const v = parseFloat((s ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(v) ? v : 0
}

function MetricCard({ card, series, en }: { card: Card; series?: Series; en: boolean }) {
  const [open, setOpen] = useState(false)
  const label = en ? card.labelEn : card.label
  const dec = decimals(card)
  const unit = en ? "MoM" : "전월비"
  const unitY = en ? "YoY" : "전년비"

  const cur = series ? series.points.map((v) => scale(card.key, v)) : []
  const prevArr = series ? series.prev.map((v) => (v == null ? NaN : scale(card.key, v))) : []
  const hasPrev = prevArr.length === cur.length && prevArr.length > 0 && prevArr.every((v) => Number.isFinite(v))
  const labels = series ? series.dates.map((d) => periodLabel(d, card.freq)) : []
  const yr = series && series.dates.length ? series.dates[series.dates.length - 1].slice(0, 4) : ""

  const tMom = tone(card.dir, card.deltaMom ?? null)
  const tYoy = tone(card.dir, card.deltaYoy ?? null)

  const rows = labels
    .map((lb, i) => ({
      lb,
      v: cur[i],
      mom: i > 0 ? cur[i] - cur[i - 1] : null,
      yoy: hasPrev ? cur[i] - prevArr[i] : null,
    }))
    .reverse()

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold tracking-tight text-gray-900">{label}</h3>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {card.asOf?.slice(0, 7).replace("-", ".")} · {card.freq} · PSA/BSP
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[20px] font-bold leading-none tabular-nums text-gray-900">
            {card.prefix}
            <CountUp value={num(card.value)} suffix="" decimals={dec} />
            <span className="text-[13px] font-semibold text-gray-500">{card.suffix}</span>
          </p>
          <div className="mt-1 flex items-center justify-end gap-2 text-[11px] font-semibold tabular-nums">
            {card.deltaMom != null && (
              <span className={tMom.cls}>
                {unit} {Math.abs(card.deltaMom).toFixed(1)}
                {card.deltaUnit}
                {tMom.arrow}
              </span>
            )}
            {card.deltaYoy != null && (
              <span className={tYoy.cls}>
                {unitY} {Math.abs(card.deltaYoy).toFixed(1)}
                {card.deltaUnit}
                {tYoy.arrow}
              </span>
            )}
          </div>
        </div>
      </div>

      {cur.length > 1 ? (
        <div className="mt-3">
          <ProChart
            cur={cur}
            prev={hasPrev ? prevArr : undefined}
            labels={labels}
            unit={card.suffix}
            curName={yr}
            prevName={String(Number(yr) - 1)}
            decimals={dec}
          />
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-gray-400">시계열 준비 중</p>
      )}

      {rows.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            {open ? (en ? "Hide table ▲" : "표 접기 ▲") : en ? "Monthly table ▼" : "월별 표 ▼"}
          </button>
          {open && (
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-[11px] tabular-nums">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-2 py-1.5 text-left font-medium">{en ? "Period" : "기준"}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{en ? "Value" : "값"}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{unit}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{unitY}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r, i) => (
                    <tr key={i} className="text-gray-700">
                      <td className="px-2 py-1.5 text-left text-gray-500">{r.lb}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{r.v.toFixed(dec)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">
                        {r.mom == null ? "–" : (r.mom > 0 ? "+" : "") + r.mom.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-500">
                        {r.yoy == null ? "–" : (r.yoy > 0 ? "+" : "") + r.yoy.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RefBadge({ card, href, note, en }: { card: Card; href: string; note: string; en: boolean }) {
  const label = en ? card.labelEn : card.label
  return (
    <a
      href={href}
      className="group flex items-center justify-between gap-3 rounded-lg border border-gray-150 bg-gray-50 px-3 py-2 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
    >
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-gray-700">{label}</p>
        <p className="truncate text-[10px] text-gray-400">{note}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13px] font-bold tabular-nums text-gray-900">
          {card.prefix}
          {card.value}
          {card.suffix}
        </p>
        <p className="text-[10px] text-indigo-500 group-hover:text-indigo-600">{en ? "detail →" : "원본 →"}</p>
      </div>
    </a>
  )
}

function DerivedCard({
  title,
  formula,
  value,
  sub,
  sowhat,
  good,
  children,
}: {
  title: string
  formula: string
  value: string
  sub?: string
  sowhat: string
  good: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold tracking-tight text-violet-900">{title}</h3>
          <p className="mt-0.5 font-mono text-[10px] text-violet-400">{formula}</p>
        </div>
        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-600">
          산출·참고
        </span>
      </div>
      <p className={"mt-2 text-[22px] font-bold leading-none tabular-nums " + (good ? "text-emerald-600" : "text-rose-600")}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-violet-500">{sub}</p>}
      {children}
      <p className="mt-2 border-t border-violet-100 pt-2 text-[11px] leading-snug text-violet-700">{sowhat}</p>
    </div>
  )
}

function SectionHead({ title, desc, star }: { title: string; desc: string; star?: boolean }) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-1.5 text-[16px] font-bold tracking-tight text-gray-900">
        {star && <span className="text-amber-500">★</span>}
        {title}
      </h2>
      <p className="mt-0.5 text-[12px] text-gray-500">{desc}</p>
    </div>
  )
}

export default function Page() {
  const { lang } = useLang()
  const en = lang === "en"
  const [band, setBand] = useState<Card[] | null>(null)
  const [series, setSeries] = useState<Record<string, Series>>({})
  const [active, setActive] = useState("today")
  const [q, setQ] = useState("")
  const secRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    Promise.all([homeBand(), econSeries()])
      .then(([b, s]) => {
        setBand(b)
        setSeries(s)
      })
      .catch(() => setBand([]))
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive((e.target as HTMLElement).id)
        })
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    )
    Object.values(secRefs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [band])

  const byKey = useMemo(() => {
    const m: Record<string, Card> = {}
    ;(band ?? []).forEach((c) => (m[c.key] = c))
    return m
  }, [band])

  const d = useMemo(() => {
    const appN = num(byKey.appinf?.value)
    const cpiN = num(byKey.cpi?.value)
    const remitN = num(byKey.remit?.value)
    const fxN = num(byKey.fx?.value)
    const oilN = num(byKey.oil?.value)
    const elecN = num(byKey.elec?.value)
    const acN = num(byKey.acinf?.value)
    const ap = series.appinf
    const cp = series.cpi
    let gapSeries: number[] = []
    let gapLabels: string[] = []
    if (ap && cp) {
      const n = Math.min(ap.points.length, cp.points.length)
      const ao = ap.points.slice(ap.points.length - n)
      const co = cp.points.slice(cp.points.length - n)
      const dts = ap.dates.slice(ap.dates.length - n)
      gapSeries = ao.map((v, i) => +(v - co[i]).toFixed(2))
      gapLabels = dts.map((x) => periodLabel(x, "월별"))
    }
    const fxS = clamp((fxN - 55) / (65 - 55), 0, 1) * 100
    const oilS = clamp((oilN - 50) / (80 - 50), 0, 1) * 100
    const elecS = clamp(elecN / 15, 0, 1) * 100
    const costIdx = 0.4 * fxS + 0.3 * oilS + 0.3 * elecS
    return { gap: +(appN - cpiN).toFixed(1), gapSeries, gapLabels, peso: remitN * fxN, costIdx, fxS, oilS, elecS, acN, elecN }
  }, [byKey, series])

  const originCards = (sec: string) => ORIGIN[sec].map((k) => byKey[k]).filter(Boolean) as Card[]
  const setRef = (id: string) => (el: HTMLElement | null) => {
    secRefs.current[id] = el
  }

  const filtered = (band ?? []).filter((c) => {
    const s = (c.label + c.labelEn + c.key).toLowerCase()
    return s.includes(q.toLowerCase())
  })

  const loading = band === null

  return (
    <main className="px-4 pb-10 pt-0 sm:px-6">
      <h1 className="mb-3 text-lg font-bold tracking-tight text-gray-900">{en ? "Economy" : "경제지표"}</h1>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:h-fit">
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={
                  "rounded-lg px-3 py-2 transition-colors " +
                  (active === n.id ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50")
                }
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {n.star && <span className="text-amber-500">★</span>}
                  {en ? n.en : n.ko}
                </span>
                <span className="mt-0.5 block text-[10px] text-gray-400">{n.note}</span>
              </a>
            ))}
          </nav>
          <p className="mt-3 hidden px-3 text-[10px] leading-relaxed text-gray-400 lg:block">
            {en
              ? "Origin = full chart+table (once). Reference = badge+link. Derived = computed."
              : "원본=상세 차트·표(한 번) · 참조=배지·링크 · 파생=산출값. 같은 지표를 두 번 그리지 않음."}
          </p>
        </aside>

        <div className="min-w-0 space-y-10">
          <section id="today" ref={setRef("today")} className="scroll-mt-4">
            <SectionHead
              title={en ? "Today's numbers" : "오늘의 수치"}
              desc={en ? "Daily FX · weekly fuel · weather" : "매일 갱신되는 환율·유가·날씨 — 가장 빠른 신호"}
            />
            <DailyIndicators />
          </section>

          <section id="macro" ref={setRef("macro")} className="scroll-mt-4">
            <SectionHead
              title={en ? "Demand environment" : "시장·수요 환경"}
              desc={en ? "Growth · confidence · remittances" : "가전 수요를 떠받치는 성장·소비심리·구매력"}
            />
            {loading ? (
              <Skel />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {originCards("macro").map((c) => (
                  <MetricCard key={c.key} card={c} series={series[c.key]} en={en} />
                ))}
              </div>
            )}
            {!loading && byKey.foodinf && (
              <RefStrip en={en}>
                <RefBadge card={byKey.foodinf} href="#cost" en={en} note={en ? "disposable income" : "필수지출 경쟁 → 원가·물가"} />
              </RefStrip>
            )}
          </section>

          <section id="cost" ref={setRef("cost")} className="scroll-mt-4">
            <SectionHead
              title={en ? "Cost & CPI pressure" : "원가·물가 압력"}
              desc={en ? "Consumer prices, power, fuel" : "소비자물가·전기·연료 — 판가와 가처분소득을 함께 압박"}
            />
            {loading ? (
              <Skel />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {originCards("cost").map((c) => (
                  <MetricCard key={c.key} card={c} series={series[c.key]} en={en} />
                ))}
              </div>
            )}
            {!loading && (byKey.fx || byKey.oil) && (
              <RefStrip en={en}>
                {byKey.fx && <RefBadge card={byKey.fx} href="#today" en={en} note={en ? "import cost" : "수입원가 → 오늘의 수치"} />}
                {byKey.oil && <RefBadge card={byKey.oil} href="#today" en={en} note={en ? "logistics/fuel" : "물류·연료 → 오늘의 수치"} />}
              </RefStrip>
            )}
          </section>

          <section id="appliance" ref={setRef("appliance")} className="scroll-mt-4">
            <SectionHead
              title={en ? "Appliance price signal" : "가전 가격 신호"}
              desc={en ? "Appliance/aircon CPI, producer price" : "가전·에어컨 소비자물가와 생산자물가 — 판가 여력"}
            />
            {loading ? (
              <Skel />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {originCards("appliance").map((c) => (
                  <MetricCard key={c.key} card={c} series={series[c.key]} en={en} />
                ))}
              </div>
            )}
            {!loading && byKey.cpi && (
              <RefStrip en={en}>
                <RefBadge card={byKey.cpi} href="#cost" en={en} note={en ? "real-price baseline" : "실질가격 기준선 → 원가·물가"} />
              </RefStrip>
            )}
          </section>

          <section id="radar" ref={setRef("radar")} className="scroll-mt-4">
            <SectionHead
              star
              title={en ? "Business radar" : "사업 레이더"}
              desc={en ? "Our own indices — not on Bloomberg" : "가전 영업 관점으로 지표를 조합한 산출지표 — 우리만의 강점"}
            />
            {loading ? (
              <Skel />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                <DerivedCard
                  title={en ? "Real appliance-price gap" : "가전 실질물가 갭"}
                  formula="가전물가 − 전체물가(CPI)"
                  value={(d.gap > 0 ? "+" : "") + d.gap + "%p"}
                  good={d.gap < 0}
                  sowhat={
                    d.gap < 0
                      ? "가전이 전체 물가보다 싸짐 = 실질가격 하락, 구매 유인 개선. 프로모 없이도 상대 매력 상승."
                      : "가전이 전체 물가보다 비싸짐 = 실질가격 상승, 구매 저항. 판가·프로모 점검 필요."
                  }
                >
                  {d.gapSeries.length > 1 && (
                    <div className="mt-2">
                      <ProChart cur={d.gapSeries} labels={d.gapLabels} unit="%p" curName={en ? "gap" : "갭"} prevName="" decimals={1} />
                    </div>
                  )}
                </DerivedCard>

                <DerivedCard
                  title={en ? "OFW peso purchasing power" : "OFW 페소 구매력"}
                  formula="송금액($) × 환율(₱/$)"
                  value={"₱" + d.peso.toFixed(0) + "B"}
                  sub={`$${num(byKey.remit?.value).toFixed(2)}B × ₱${num(byKey.fx?.value).toFixed(2)}`}
                  good
                  sowhat="송금 달러가 페소로 바뀌는 힘. 페소 약세일수록 현지 구매력↑ — 송금 가구의 가전 구매 여력 확대."
                />

                <DerivedCard
                  title={en ? "Cost-pressure index" : "원가압박 지수"}
                  formula="환율·40% + 유가·30% + 전기·30% (0–100)"
                  value={d.costIdx.toFixed(0)}
                  sub="0=완화 · 100=최고 압박"
                  good={d.costIdx < 50}
                  sowhat="수입원가·물류·운영비를 하나로 합친 압박도. 높을수록 판가 인상 또는 마진 방어 압력."
                >
                  <div className="mt-2 space-y-1">
                    {[
                      { l: "환율", v: d.fxS },
                      { l: "유가", v: d.oilS },
                      { l: "전기", v: d.elecS },
                    ].map((b) => (
                      <div key={b.l} className="flex items-center gap-2">
                        <span className="w-8 text-[10px] text-violet-500">{b.l}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
                          <div className="h-full rounded-full bg-violet-500" style={{ width: `${b.v.toFixed(0)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </DerivedCard>

                <DerivedCard
                  title={en ? "Aircon total burden" : "에어컨 총부담 신호"}
                  formula="구입(에어컨물가) + 운영(전기요금)"
                  value={d.acN.toFixed(1) + " / " + d.elecN.toFixed(1) + "%"}
                  sub="구입 물가 / 전기요금 상승률"
                  good={d.acN < 3}
                  sowhat={
                    d.elecN > 8
                      ? "구입가는 안정적이나 전기요금 급등으로 총소유비용(TCO) 부담↑ — 고효율·인버터 소구가 유효."
                      : "구입·운영 모두 안정권 — 에어컨 판촉에 우호적."
                  }
                />
              </div>
            )}
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-700">
              ※ 사업 레이더는 공식 지표를 조합한 산출·해석 지표 (AI INTERPRETED). 원자료는 각 원본 섹션 참조, 최종 판단은 담당자.
            </p>
          </section>

          <section id="all" ref={setRef("all")} className="scroll-mt-4">
            <SectionHead
              title={en ? "All indicators" : "전체 경제지표"}
              desc={en ? "Every tracked indicator in one table" : "추적 중인 16개 지표를 한 표로 — 검색·비교용"}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={en ? "Search indicator…" : "지표 검색…"}
              className="mb-3 w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-indigo-300"
            />
            {loading ? (
              <Skel />
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-[12px] tabular-nums">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                      <th className="px-3 py-2 text-left font-medium">{en ? "Indicator" : "지표"}</th>
                      <th className="px-3 py-2 text-right font-medium">{en ? "Value" : "현재값"}</th>
                      <th className="px-3 py-2 text-right font-medium">{en ? "MoM" : "전월비"}</th>
                      <th className="px-3 py-2 text-right font-medium">{en ? "YoY" : "전년비"}</th>
                      <th className="px-3 py-2 text-right font-medium">{en ? "As of" : "기준"}</th>
                      <th className="px-3 py-2 text-right font-medium">{en ? "Freq" : "빈도"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((c) => {
                      const tm = tone(c.dir, c.deltaMom ?? null)
                      const ty = tone(c.dir, c.deltaYoy ?? null)
                      return (
                        <tr key={c.key} className="text-gray-700 hover:bg-gray-50/60">
                          <td className="px-3 py-2 text-left font-semibold text-gray-800">{en ? c.labelEn : c.label}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">
                            {c.prefix}
                            {c.value}
                            {c.suffix}
                          </td>
                          <td className={"px-3 py-2 text-right font-semibold " + tm.cls}>
                            {c.deltaMom == null ? "–" : Math.abs(c.deltaMom).toFixed(1) + (c.deltaUnit ?? "") + tm.arrow}
                          </td>
                          <td className={"px-3 py-2 text-right font-semibold " + ty.cls}>
                            {c.deltaYoy == null ? "–" : Math.abs(c.deltaYoy).toFixed(1) + (c.deltaUnit ?? "") + ty.arrow}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-400">{c.asOf?.slice(0, 7).replace("-", ".")}</td>
                          <td className="px-3 py-2 text-right text-gray-400">{c.freq}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-gray-400">검색 결과 없음</p>}
              </div>
            )}
            <p className="mt-2 text-[10px] leading-snug text-gray-400">
              색은 사업영향 기준 · 원가·물가↑=로즈, 수요·구매력 개선=에메랄드
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

function RefStrip({ children, en }: { children: React.ReactNode; en: boolean }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{en ? "Reference" : "참조 지표"}</p>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Skel() {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      ))}
    </div>
  )
}
