"use client"

import React, { useEffect, useMemo, useState } from "react"
import DailyIndicators from "@/components/DailyIndicators"
import FxView from "@/components/FxView"
import { ProChart, CountUp } from "@/components/ProChartCore"
import { homeBand, pricesDomain, macroMonthly } from "@/lib/supabase"
import type { PricesDomain } from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 경제지표 — 물가·생활비. 헤드라인 = 유가·환율과 동일한 ProChart(2025 vs 2026). */

type Card = Awaited<ReturnType<typeof homeBand>>[number]
type Mon = Record<string, { dates: string[]; values: number[] }>

const NAV: { id: string; ko: string; sub: string; count: string; accent?: boolean; star?: boolean; subs: string[] }[] = [
  { id: "core", ko: "핵심 요약", sub: "오늘의 수치 + 대표 지표 한 화면", count: "KPI 12", subs: ["환율·유가·날씨", "대표 지표 스코어카드"] },
  { id: "prices", ko: "물가·생활비", sub: "CPI 10품목 + 지역별 물가 히트맵", count: "10+지역20", subs: ["소비자물가 CPI", "품목별 물가", "지역 히트맵", "실질 지표"] },
  { id: "fx", ko: "환율·원가", sub: "역내 통화 비교·실효환율·수입원가 영향", count: "FX", subs: ["₱/USD 추이", "동남아 6개국 통화", "실효환율 NEER·REER", "수입 원가 영향"] },
  { id: "growth", ko: "성장·경기", sub: "GDP 부문분해·투자·가동률·건축허가", count: "14", subs: ["GDP 성장률", "투자·건축허가", "가동률"] },
  { id: "rates", ko: "금리·통화·신용", sub: "BSP 3금리·M3·대출(소비자/카드)", count: "9", subs: ["기준금리 BSP", "M3·통화량", "가계·카드 대출"] },
  { id: "labor", ko: "고용·소득·송금", sub: "실업·최저임금·OFW 송금(구성별)", count: "11", subs: ["실업률", "최저임금", "OFW 송금"] },
  { id: "sentiment", ko: "소비·기업 심리", sub: "CCI·BCI·내구재 구매의향(장기)", count: "5", subs: ["소비자신뢰 CCI", "기업심리 BCI", "내구재 구매의향"] },
  { id: "appliance", ko: "가전 선행지표", sub: "가전 PPI·수입액·가전/에어컨 물가", count: "8", subs: ["가전 물가·PPI", "가전 실질가격 갭", "수입액"] },
  { id: "market", ko: "가전시장·제품별", sub: "에어컨·냉장고·TV·세탁기별 LG점유·ASP·할인갭", count: "1,900+", accent: true, subs: ["LG 점유·ASP", "제품별 할인갭"] },
  { id: "radar", ko: "사업 레이더", sub: "원가압박·OFW구매력·실질물가·TCO", count: "파생", star: true, subs: ["원가압박 지수", "실질 구매력·TCO"] },
]

const num = (s: string | undefined) => {
  const v = parseFloat((s ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(v) ? v : 0
}
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]

function yearOverlay(dates: string[], values: number[]) {
  const y25: (number | null)[] = Array(12).fill(null)
  const y26: (number | null)[] = Array(12).fill(null)
  dates.forEach((d, i) => {
    const yr = d.slice(0, 4), mo = Number(d.slice(5, 7)) - 1
    if (yr === "2025") y25[mo] = values[i]
    else if (yr === "2026") y26[mo] = values[i]
  })
  return { y25, y26 }
}

function PricesView({ data, inf, byKey }: { data: PricesDomain; inf: Mon; byKey: Record<string, Card> }) {
  const [mounted, setMounted] = useState(false)
  const infAll = inf["INF_all_items"]

  const h = useMemo(() => {
    if (!infAll || infAll.values.length < 2) return null
    const { y25, y26 } = yearOverlay(infAll.dates, infAll.values)
    let last = -1
    for (let i = 11; i >= 0; i--) if (y26[i] != null) { last = i; break }
    const cur = last >= 0 ? (y26[last] as number) : 0
    const prevYr = last >= 0 && y25[last] != null ? (y25[last] as number) : null
    const delta = prevYr != null ? +(cur - prevYr).toFixed(1) : null
    const curArr = y26.slice(0, last + 1) as number[]
    const prevArr = y25 as number[]
    return { cur, prevYr, delta, curArr, prevArr }
  }, [infAll])

  useEffect(() => {
    if (!h) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
    return () => cancelAnimationFrame(id)
  }, [h])

  if (!h) return <div className="h-80 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />

  const up = (h.delta ?? 0) > 0
  const appinf = num(byKey.appinf?.value), cpi = num(byKey.cpi?.value)
  const gap = +(appinf - cpi).toFixed(1)
  const remit = byKey.remit, fx = byKey.fx, cci = byKey.cci, durable = byKey.durable, food = byKey.foodinf
  const peso = remit && fx ? num(remit.value) * num(fx.value) : null
  const realPolicy = data.policyRate != null ? +(data.policyRate - h.cur).toFixed(1) : null

  const items: [string, string][] = [["식품", "INF_food"], ["쌀", "INF_rice"], ["전기", "INF_electricity"], ["LPG", "INF_lpg"], ["운송", "INF_transport"], ["가전", "INF_household_appliances"]]
  const cols: [string, string][] = [["전체", "inf_all_items"], ["식품", "inf_food"], ["쌀", "inf_rice"], ["전기", "inf_electricity"], ["가전", "inf_appliances"], ["에어컨", "inf_aircon"]]
  const topReg = [...data.region].sort((a, b) => num(String(b.inf_all_items)) - num(String(a.inf_all_items))).slice(0, 6)
  const regVals = data.region.map((r) => num(String(r.inf_all_items))).filter((v) => v > 0)
  const rMean = regVals.length ? regVals.reduce((a, b) => a + b, 0) / regVals.length : 0
  const rLo = regVals.length ? Math.min(...regVals) : 0
  const rHi = regVals.length ? Math.max(...regVals) : 0
  const shade = (v: number) => "rgba(225,29,72," + (0.06 + Math.max(0, Math.min(1, v / 25)) * 0.82).toFixed(3) + ")"

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold tracking-tight text-gray-900">전체 물가</h3>
              {h.delta != null && (
                <span className={"inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-bold " + (up ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                  {up ? "▲" : "▼"}{Math.abs(h.delta)}%p
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-gray-300" />2025</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-indigo-500" />2026</span>
            </div>
          </div>
          <div className="mt-1.5 flex items-end gap-2">
            <p className="text-[28px] font-bold leading-none tabular-nums text-gray-900">
              <CountUp value={h.cur} decimals={1} /><span className="text-[15px] font-semibold text-gray-500">%</span>
            </p>
            {h.prevYr != null && <p className="pb-1 text-[12px] text-gray-400">전년 동월 {h.prevYr}%</p>}
          </div>
          <div className="mt-3">
            <ProChart cur={h.curArr} prev={h.prevArr} labels={MONTHS} unit="%" curName="2026" prevName="2025" decimals={1} />
          </div>
          <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-400">출처 PSA CPI · 전년비(YoY) · 2025 vs 2026 · BSP 목표 2–4%</p>
        </div>

        <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-900">가전 수요</h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">중립·지연</span>
          </div>
          <div className="mt-2">
            <p className="text-[12px] text-gray-500">가전 실질가격 갭 <span className="text-gray-400">(가전−전체)</span></p>
            <p className={"text-[28px] font-bold leading-none tabular-nums " + (gap < 0 ? "text-emerald-600" : "text-rose-600")}>
              {gap > 0 ? "+" : ""}<CountUp value={gap} decimals={1} /><span className="text-[14px] font-semibold text-gray-500">%p</span>
            </p>
            <p className="mt-1 text-[11px] text-gray-400">{gap < 0 ? "가전이 전체보다 저렴 → 실질 매력↑" : "가전이 전체보다 비쌈 → 구매 저항"}</p>
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 text-[12px]">
            {peso != null && <div className="flex items-center gap-2 text-gray-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />OFW 구매력<span className="ml-auto font-bold tabular-nums text-gray-900">₱{peso.toFixed(0)}B</span></div>}
            {food && <div className="flex items-center gap-2 text-gray-600"><span className="h-2 w-2 rounded-full bg-rose-500" />필수재(식품)<span className="ml-auto font-bold tabular-nums text-gray-900">{food.value}%</span></div>}
            {durable && <div className="flex items-center gap-2 text-gray-600"><span className="h-2 w-2 rounded-full bg-rose-500" />내구재 구매의향<span className="ml-auto font-bold tabular-nums text-gray-900">{durable.value}</span></div>}
            {cci && <div className="flex items-center gap-2 text-gray-600"><span className="h-2 w-2 rounded-full bg-rose-500" />소비자신뢰 CCI<span className="ml-auto font-bold tabular-nums text-gray-900">{cci.value}</span></div>}
          </div>
          <p className="mt-auto pt-3 text-[12px] font-semibold text-indigo-600">→ 저가·필수형 우선, 프리미엄은 심리 반등 후</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-900">품목별 물가</h3>
            <span className="text-[11px] text-gray-400">전년비 %, 최신월</span>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {items.map(([label, key], i) => {
              const s = inf[key]
              const v = s && s.values.length ? s.values[s.values.length - 1] : null
              const w = v != null ? Math.min(100, (Math.abs(v) / 35) * 100) : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-[13px] text-gray-600">{label}</span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-gray-100">
                    <div className="h-full rounded bg-indigo-400" style={{ width: (mounted ? w : 0) + "%", transition: "width .9s cubic-bezier(.22,1,.36,1) " + (i * 0.07) + "s" }} />
                  </div>
                  <span className="w-14 shrink-0 text-right text-[13px] font-bold tabular-nums text-gray-900">{v != null ? v.toFixed(1) + "%" : "–"}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-400">부문별 기여도 분해는 PSA 공식 가중치 적재 후 제공</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-900">실질 지표</h3>
            <span className="text-[11px] text-gray-400">명목 − 물가 {h.cur}%</span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <p className={"text-[28px] font-bold leading-none tabular-nums " + ((realPolicy ?? 0) < 0 ? "text-rose-600" : "text-emerald-600")}>
              {realPolicy != null ? (realPolicy > 0 ? "+" : "") : ""}<CountUp value={realPolicy ?? 0} decimals={1} /><span className="text-[14px] font-semibold text-gray-500">%p</span>
            </p>
            <p className="pb-1 text-[12px] text-gray-500">실질 정책금리 <span className="text-gray-400">(BSP {data.policyRate ?? "–"}% − 물가)</span></p>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">{(realPolicy ?? 0) < 0 ? "실질금리 마이너스 = 완화적이나 물가 재가속에 인하 지연" : "실질금리 플러스 = 긴축적"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
            {["실질 대출금리", "실질 예금금리", "실질 최저임금", "실질 송금"].map((n) => (
              <span key={n} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-400">{n} · 확인 후 기입</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-900">지역 × 품목 물가</h3>
            <span className="text-[11px] text-gray-400">전년비 %, 상위 6개 지역</span>
          </div>
          <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: "auto repeat(6,1fr)" }}>
            <div />
            {cols.map(([c]) => <div key={c} className="pb-1 text-center text-[11px] font-medium text-gray-400">{c}</div>)}
            {topReg.map((r, ri) => (
              <React.Fragment key={ri}>
                <div className="flex items-center justify-end pr-2 text-right text-[11px] text-gray-600">{String(r.geo).replace(/\(.*/, "").replace("Region ", "").trim().slice(0, 10)}</div>
                {cols.map(([, key], ci) => {
                  const v = num(String(r[key]))
                  const t = Math.max(0, Math.min(1, v / 25))
                  return <div key={key} className="flex h-7 items-center justify-center rounded text-[11px] font-medium tabular-nums" style={{ background: shade(v), color: t > 0.55 ? "#fff" : "#334155", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "scale(.9)", transition: "all .4s ease " + ((ri * 6 + ci) * 0.02) + "s" }}>{v.toFixed(1)}</div>
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-[15px] font-bold text-gray-900">지역 물가 분포 <span className="text-[11px] font-normal text-gray-400">전국 {data.region.length}곳</span></h3>
          <div className="mt-3 flex gap-5">
            <div><p className="text-[11px] text-gray-400">평균</p><p className="text-[22px] font-bold tabular-nums text-gray-900">{rMean.toFixed(1)}<span className="text-[12px] text-gray-400">%</span></p></div>
            <div><p className="text-[11px] text-gray-400">범위</p><p className="text-[22px] font-bold tabular-nums text-gray-900">{rLo.toFixed(1)}–{rHi.toFixed(1)}</p></div>
          </div>
          <div className="relative mt-5 h-12">
            <div className="absolute inset-x-0 bottom-4 border-t border-gray-200" />
            <div className="absolute bottom-1 top-0 border-l border-dashed border-rose-400" style={{ left: (((rMean - rLo) / (rHi - rLo || 1)) * 100) + "%" }} />
            {regVals.map((v, i) => (
              <div key={i} className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-indigo-400/60" style={{ left: (((v - rLo) / (rHi - rLo || 1)) * 100) + "%", top: 8 + (i % 3) * 8, opacity: mounted ? 1 : 0, transform: mounted ? "none" : "scale(0)", transition: "all .45s cubic-bezier(.22,1,.36,1) " + (i * 0.03) + "s" }} />
            ))}
            <span className="absolute bottom-0 left-0 text-[10px] text-gray-400">{rLo.toFixed(1)}%</span>
            <span className="absolute bottom-0 right-0 text-[10px] text-gray-400">{rHi.toFixed(1)}%</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">지역 편차 {(rHi - rLo).toFixed(1)}%p · 점선=전국 평균</p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400">색=사업영향(원가·물가↑ 로즈, 수요·구매력↑ 에메랄드) · 실질 대출/예금/임금·송금은 데이터 확인 후 기입</p>
    </div>
  )
}

function Soon({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 text-center">
      <div className="text-[14px] font-bold text-gray-500">{label}</div>
      <div className="text-[12px] text-gray-400">물가·생활비 템플릿을 이 도메인에도 적용 예정</div>
    </div>
  )
}

export default function Page() {
  const { lang } = useLang()
  const en = lang === "en"
  const [active, setActive] = useState("prices")
  const [band, setBand] = useState<Card[] | null>(null)
  const [prices, setPrices] = useState<PricesDomain | null>(null)
  const [inf, setInf] = useState<Mon>({})

  useEffect(() => {
    homeBand().then(setBand).catch(() => setBand([]))
    pricesDomain().then(setPrices).catch(() => setPrices({ idx: {}, forecast: [], policyRate: null, region: [] }))
    macroMonthly(["INF_all_items", "INF_food", "INF_rice", "INF_electricity", "INF_lpg", "INF_transport", "INF_household_appliances"]).then(setInf).catch(() => setInf({}))
  }, [])

  const byKey = useMemo(() => {
    const map: Record<string, Card> = {}
    ;(band ?? []).forEach((c) => (map[c.key] = c))
    return map
  }, [band])

  function view() {
    if (active === "core") return <DailyIndicators />
    if (active === "fx") return <FxView />
    if (active === "prices") {
      if (!prices || band === null) return <div className="h-80 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      return <PricesView data={prices} inf={inf} byKey={byKey} />
    }
    return <Soon label={NAV.find((n) => n.id === active)?.ko ?? ""} />
  }

  return (
    <main className="px-4 pb-10 pt-4 sm:px-6">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-[88px]">
          <div className="px-2.5 py-3">
            <p className="mb-2 px-1.5 text-[14px] font-bold tracking-tight text-gray-900">{en ? "View" : "보기"}</p>
            <nav className="flex flex-col gap-0.5">
              {NAV.map((n, i) => (
                <div key={n.id}>
                  <button
                    onClick={() => setActive(n.id)}
                    style={{ animation: "fadeUp .4s ease both", animationDelay: (i * 40) + "ms" }}
                    className={
                      "group w-full rounded-lg px-2.5 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                      (active === n.id ? "bg-indigo-50 ring-1 ring-indigo-100" : "hover:bg-indigo-50/40")
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={"flex-1 text-[13px] " + (active === n.id ? "font-bold text-indigo-700" : "font-semibold text-gray-800 group-hover:text-indigo-600")}>
                        {n.star && <span className="text-amber-500">★ </span>}
                        {n.accent && <span className="text-violet-500">◆ </span>}
                        {n.ko}
                      </span>
                      <span className={"shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums " + (active === n.id ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400")}>{n.count}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-gray-400">{n.sub}</span>
                  </button>
                  {active === n.id && (
                    <div className="mb-1 ml-3 mt-0.5 flex flex-col border-l border-indigo-100 pl-2">
                      {n.subs.map((su) => (
                        <span key={su} className="rounded py-[3px] pl-1.5 text-[11.5px] font-medium text-gray-500 transition-colors hover:text-indigo-600">· {su}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </aside>
        <div className="min-w-0">
          <div key={active} style={{ animation: "fadeUp .4s ease both" }}>{view()}</div>
        </div>
      </div>
    </main>
  )
}
