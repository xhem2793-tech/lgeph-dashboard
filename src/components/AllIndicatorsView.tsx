"use client"

import React, { useEffect, useMemo, useState } from "react"
import { dataProvenance, allIndicatorLatest, indicatorSeries, econSpark, fmtStamp, type Provenance } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"
import { LineChart, Lg } from "@/components/EconChart"
import { CATS, NAV_IDS, classify, catKo } from "@/lib/indicatorCats"
import { INDICATOR_DESC, INDICATOR_INSIGHT } from "@/lib/indicatorDesc"
import { InsightBanner, type Banner } from "@/components/InsightBanner"
import { PmDrop } from "@/components/competitors/shared"
import { T, pickL } from "@/lib/i18n"
import { INDICATOR_EN } from "@/lib/indicatorLabelsEn"

/** 지표 라벨 표시용 — EN이면 코드 번역맵, KO면 한글 원문. 라벨 없으면 indicator 키 폴백. (매칭·정렬 로직엔 쓰지 말 것) */
const enLabel = (indicator: string, label?: string | null) => pickL(label, INDICATOR_EN[indicator]) || indicator

/** 전체 지표 리스트 상단 배너 — 뉴스·경쟁사광고와 동일한 InsightBanner(크기·스타일 통일). */
// 렌더 시점 생성(언어 토글 반영) — 모듈 최상위 T()는 import 시 굳어버림
const buildAllBanner = (): Banner => ({
  title: T("전체 지표 리스트 · 출처 검증", "All Indicators · Source Verification"),
  summary: T("모든 지표를 한 화면에서 — 최신값·직전 대비·기간·출처·신뢰도", "Every indicator on one screen — latest value, prior change, coverage, source, confidence"),
  body: T("분류별 차트 대신 **모든 지표를 한 화면에서** 훑어봅니다 — 최신값·직전 대비·데이터 기간·**출처 링크·신뢰도**까지 한 줄로 정리. 각 지표의 **자세히보기(시계열·전년비/전월비)·엑셀 다운로드**를 지원합니다.", "Scan **every indicator on one screen** instead of category charts — latest value, prior change, data coverage and **source link & confidence** in a single row. Each indicator supports **detail view (time series, YoY/MoM) and Excel download**."),
  insight: T("출처·신뢰도가 검증된 지표만 의사결정에 활용 — 원본 링크로 즉시 교차 확인이 가능합니다.", "Use only source- and confidence-verified indicators for decisions — cross-check instantly via the original link."),
})

/** 전체 지표 리스트(+데이터 출처·검증 통합) — 분류별 차트 대신 모든 지표를 한 화면에서 검색·정렬로 훑어보고,
 *  각 지표의 최신값·직전 대비·데이터 기간·원본 코드·출처 링크·신뢰도를 한 줄로. 행 클릭 시 해당 분류 차트로 이동. */

const ym = (d: string) => (d ? d.slice(0, 4) + "." + Number(d.slice(5, 7)) + T("월", "M") : "—")

// 전망(forecast) 지표 — provenance(실측 검증 뷰)에 없으므로 별도 메타로 목록에 포함. 값은 v_latest_indicator에서.
const buildForecastMeta = (): Record<string, { label: string; source: string; cat: string }> => ({
  cpi_forecast_adb: { label: T("소비자물가 상승률 전망(ADB)", "CPI Inflation Forecast (ADB)"), source: T("ADB 전망", "ADB Forecast"), cat: "prices" },
  cpi_inflation_forecast: { label: T("인플레이션 전망(시장·BSP)", "Inflation Forecast (Market·BSP)"), source: T("BSP/시장 전망", "BSP/Market Forecast"), cat: "prices" },
  gdp_forecast_adb: { label: T("GDP 성장률 전망(ADB)", "GDP Growth Forecast (ADB)"), source: T("ADB 전망", "ADB Forecast"), cat: "growth" },
  gdp_forecast_imf: { label: T("GDP 성장률 전망(IMF)", "GDP Growth Forecast (IMF)"), source: T("IMF 전망", "IMF Forecast"), cat: "growth" },
  ofw_remittance_forecast: { label: T("OFW 송금액 전망($B)", "OFW Remittance Forecast ($B)"), source: T("BSP/시장 전망", "BSP/Market Forecast"), cat: "labor" },
})
function fmtVal(v: number): string {
  if (v == null || Number.isNaN(v)) return "—"
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B"
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M"
  if (a >= 1000) return Math.round(v).toLocaleString()
  if (a >= 100) return v.toFixed(1)
  return v.toFixed(2)
}

// 값 단위 추론(%/₱/$/지수/℃/명) — 라벨·지표키 기반 휴리스틱
function inferUnit(indicator: string, label: string): { prefix?: string; suffix?: string; unit: string; note: string } {
  const s = (indicator + " " + (label || "")).toLowerCase()
  // ── 소스에 '축소 단위'로 저장된 지표 — 스케일 접미사 명시(억달러 5.74=$5.74B, 백만명 49.6=49.6M) ──
  if (/appliance_market_usd|ecommerce_market_usd|ofw_cash_remittance$|ofw_personal_remittance/.test(indicator)) return { prefix: "$", suffix: "B", unit: "$B", note: T("$십억(USD bn)", "$ bn (USD)") }
  if (/^employed_persons$|^tourism_arrivals$/.test(indicator)) return { suffix: T("백만명", "M"), unit: T("백만명", "M"), note: T("백만 명", "million") }
  if (/^elec_consumption_pc$/.test(indicator)) return { suffix: " kWh", unit: "kWh", note: T("kWh/1인", "kWh/capita") }
  if (/^energy_/.test(indicator)) return { suffix: " ktoe", unit: "ktoe", note: T("ktoe(석유환산천톤)", "ktoe") }
  if (/^cdd_/.test(indicator)) return { suffix: "", unit: "CDD", note: T("냉방도일", "CDD") }
  if (/^life_expectancy$/.test(indicator)) return { suffix: T("세", "yr"), unit: T("세", "yr"), note: T("세(기대수명)", "years") }
  if (/^household_size$/.test(indicator)) return { suffix: T("명", ""), unit: T("명", "persons"), note: T("가구원 수", "persons") }
  if (/cagr|_market_cagr/.test(s)) return { suffix: "%", unit: "%", note: T("% (연평균성장)", "% (CAGR)") }
  if (/유가|oil_|휘발유|경유|디젤|등유|gasoline|diesel|kerosene|ron9|meralco|요금|소매가|임금|wage|grdp|금액/.test(s)) return { prefix: "₱", unit: "₱", note: T("₱(페소)", "₱ (PHP)") }
  if (/brent|수출액|수입액|송금|remittance|fdi|reserves|_usd|market_usd|외환보유|gni|gdp_total/.test(s)) return { prefix: "$", unit: "$", note: T("$(미달러)", "$ (USD)") }
  if (/php_usd|환율|exchange/.test(s)) return { prefix: "₱", unit: "₱/$", note: T("₱/$(환율)", "₱/$ (FX)") }
  if (/율|률|금리|증가율|상승률|비중|참가율|점유|inflation|growth|_yoy|yoy|ratio|_pct|_gdp|share|forecast|rate$|_rate\b|ppi/.test(s)) return { suffix: "%", unit: "%", note: T("% (율)", "% (rate)") }
  if (/지수|index|\bcci\b|\bbci\b|rppi|psei|_ci_|confidence|sentiment|composite|gini|cpi_/.test(s)) return { suffix: "", unit: "지수", note: T("지수(index)", "Index") }
  if (/기온|temperature/.test(s)) return { suffix: "℃", unit: "℃", note: T("℃(기온)", "℃ (temp)") }
  if (/cdd|냉방도일/.test(s)) return { suffix: "", unit: "CDD", note: T("냉방도일", "CDD") }
  if (/인구|population|취업자|employed|고용|households|가구|arrivals|관광객|입국자/.test(s)) return { suffix: "", unit: "명·수", note: T("명·수", "count") }
  return { suffix: "", unit: "값", note: T("값", "value") }
}

// 카테고리별 의미·LG 인사이트(페이지 차트카드처럼 차트 하단에 표기)
const buildCatMi = (): Record<string, { mean: string; ai: string }> => ({
  prices: { mean: T("소비자물가(CPI)·품목별 물가 — 생활비·구매력의 직접 지표", "CPI and item-level prices — a direct read on cost of living and purchasing power"), ai: T("물가 상승은 재량소비 위축·가격민감도 확대로 대형·프리미엄 가전 수요에 부담. 안정 시 교체·프리미엄 소구 여지.", "Rising prices curb discretionary spending and raise price sensitivity, pressuring large and premium appliance demand; stable prices open room for replacement and premium positioning.") },
  growth: { mean: T("국민계정·성장·투자·생산 — 경기 사이클과 시장 규모의 배경", "National accounts, growth, investment and output — the backdrop for the cycle and market size"), ai: T("성장·투자 확대는 소득·고용을 통해 가전 수요 저변 확장. 둔화 시 내구재 지출 이연 경계.", "Stronger growth and investment widen the demand base via income and jobs; a slowdown risks deferred durable-goods spending.") },
  labor: { mean: T("고용·임금·소득·해외송금 — 가처분소득·구매력의 원천", "Employment, wages, income and remittances — the source of disposable income and purchasing power"), ai: T("고용·임금·송금 개선은 볼륨존~프리미엄 수요 견인. 실업·송금 둔화는 수요 하방 신호.", "Gains in jobs, wages and remittances drive demand from the volume zone to premium; weaker employment or remittances signal downside.") },
  sentiment: { mean: T("소비·기업 심리(CCI·BCI·BES) — 수요의 선행 신호", "Consumer and business sentiment (CCI·BCI·BES) — a leading signal for demand"), ai: T("심리 개선은 내구재 구매의향 선행. 악화 시 할부·프로모션 강화로 방어.", "Improving sentiment leads durable-goods purchase intent; on weakness, defend with installment plans and promotions.") },
  housing: { mean: T("부동산·주택·건축허가·공실 — 빌트인·초도 가전 수요 선행", "Real estate, housing, building permits and vacancy — leading built-in and first-fit appliance demand"), ai: T("주택 공급·가격 상승은 초도·빌트인 가전 수요에 우호. 상업 부동산은 B2B 공조 수요와 연동.", "Rising housing supply and prices favor first-fit and built-in appliance demand; commercial real estate ties to B2B HVAC demand.") },
  fx: { mean: T("환율·실효환율·외환보유 — 수입 조달원가의 배경", "FX, effective exchange rate and reserves — the backdrop for import sourcing costs"), ai: T("페소 약세는 수입 가전 원가·판가 상승 압력. 현지 조달·헤지, 프리미엄 정당화가 대응 축.", "Peso weakness pressures imported-appliance cost and pricing; local sourcing, hedging and premium justification are the key responses.") },
  rates: { mean: T("금리·통화·신용 — 가전 할부·소비 금융 여건", "Rates, money and credit — financing conditions for appliance installments and consumer credit"), ai: T("금리 인하·신용 확대는 할부·카드 기반 내구재 구매력 개선. 긴축 시 수요 둔화 경계.", "Rate cuts and credit expansion improve installment- and card-based durable-goods affordability; tightening warns of softer demand.") },
  appliance: { mean: T("가전 물가·PPI·수입액·보급 — 가전시장 직접 선행지표", "Appliance prices, PPI, imports and penetration — direct leading indicators for the appliance market"), ai: T("가전 물가·조달·보급 흐름은 판가·수요·침투 전략의 1차 신호.", "Appliance price, sourcing and penetration trends are the first signal for pricing, demand and penetration strategy.") },
  energy: { mean: T("에너지효율 라벨(DOE) — 고효율 제품 경쟁 구도", "Energy-efficiency labels (DOE) — the competitive landscape for high-efficiency products"), ai: T("전기료 부담 국면에서 고효율(별점) 소구가 차별화. 5성 비중 확대가 프리미엄 근거.", "When electricity bills bite, high-efficiency (star-rating) appeal differentiates; a rising 5-star share underpins premium positioning.") },
  importprice: { mean: T("수입 단가($/kg)·원산지 — 조달원가·수입 경쟁 구도", "Import unit price ($/kg) and origin — sourcing cost and the import competitive landscape"), ai: T("단가 상승은 COGS·소매가 압력, 현지화 이점 확대. 원산지 믹스는 경쟁 강도 신호.", "Higher unit prices pressure COGS and retail prices while widening the localization advantage; the origin mix signals competitive intensity.") },
  online: { mean: T("이커머스·디지털·통신 침투 — 온라인 판매 채널 성장", "E-commerce, digital and telecom penetration — growth of online sales channels"), ai: T("온라인 침투 확대는 D2C·이커머스 채널 강화 근거. 물류·디지털 마케팅 투자 연동.", "Deeper online penetration supports strengthening D2C and e-commerce channels, tied to logistics and digital-marketing investment.") },
  weather: { mean: T("냉방도일(CDD)·기온·태풍·지진 — 냉방 수요·재해 리스크", "Cooling degree days (CDD), temperature, typhoons and earthquakes — cooling demand and disaster risk"), ai: T("CDD·폭염은 에어컨 수요 선행, 태풍·지진은 공급망·재해복구 가전 교체 변수.", "CDD and heat waves lead AC demand; typhoons and earthquakes drive supply-chain and disaster-recovery replacement demand.") },
  etc: { mean: T("참고 지표 — 인구·디지털·재정 등 구조적 배경", "Reference indicators — structural backdrop such as demographics, digital and fiscal"), ai: T("직접 수요 지표는 아니나 시장 규모·구매력·인프라의 배경 맥락으로 활용.", "Not direct demand indicators, but useful as context for market size, purchasing power and infrastructure.") },
})

/** 검색어 하이라이트 — 뉴스 검색과 동일(노란 mark) */
function Hi({ text, q }: { text: string; q: string }) {
  const k = q.trim()
  if (!k || !text) return <>{text}</>
  const parts = text.split(new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"))
  return <>{parts.map((p, i) => (p.toLowerCase() === k.toLowerCase() ? <mark key={i} className="rounded-sm bg-yellow-200 dark:bg-yellow-500/30 px-0.5 text-gray-900 dark:text-gray-50">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}</>
}

type Row = Provenance & { cat: string; catKo: string; value: number | null; period: string; prev: number | null }

export default function AllIndicatorsView({ onPick }: { onPick?: (catKey: string) => void; layout?: "list" | "card" }) {
  const ALL_BANNER = buildAllBanner(), FORECAST_META = buildForecastMeta(), CAT_MI = buildCatMi()   // 렌더 시점 생성(언어 반영)
  const [prov, setProv] = useState<Provenance[]>([])
  const [latest, setLatest] = useState<Record<string, { value: number; period: string; prev: number | null }>>({})
  const [q, setQ] = useState("")
  const [focused, setFocused] = useState(false)
  const [cat, setCat] = useState("all")
  const [sort, setSort] = useState<"cat" | "recent">("recent")
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [detail, setDetail] = useState<Row | null>(null)
  const [bnOpen, setBnOpen] = useState(false)
  const [spark, setSpark] = useState<Record<string, number[]>>({})
  const [fav, setFav] = useState<Set<string>>(new Set())
  const toggleFav = (id: string) => setFav((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); try { localStorage.setItem("ind_fav", JSON.stringify(Array.from(s))) } catch {} return s })

  useEffect(() => {
    Promise.all([dataProvenance().catch(() => []), allIndicatorLatest().catch(() => ({})), econSpark().catch(() => ({}))]).then(([p, l, s]) => {
      setProv(p as Provenance[]); setLatest(l as Record<string, { value: number; period: string; prev: number | null }>); setSpark(s as Record<string, number[]>); setLoadedAt(new Date())
    })
    try { const f = localStorage.getItem("ind_fav"); if (f) setFav(new Set(JSON.parse(f))) } catch {}
  }, [])

  // 엑셀(CSV) 다운로드 — 해당 지표 전체 시계열 + 전기/전년 대비
  async function downloadExcel(r: Row) {
    const series = await indicatorSeries(r.indicator).catch(() => [])
    if (!series.length) return
    const head = [T("기간", "Period"), T("값", "Value"), T("전기대비(%)", "vs Prior (%)"), T("전년대비(%)", "YoY (%)")]
    const lines = series.map((p, i) => {
      const prev = i > 0 ? series[i - 1].value : null
      const yrAgoDate = (Number(p.date.slice(0, 4)) - 1) + p.date.slice(4)
      const ya = series.find((x) => x.date === yrAgoDate)
      const mom = prev != null && prev !== 0 ? ((p.value - prev) / Math.abs(prev)) * 100 : null
      const yoy = ya && ya.value !== 0 ? ((p.value - ya.value) / Math.abs(ya.value)) * 100 : null
      return [p.date, p.value, mom == null ? "" : mom.toFixed(2), yoy == null ? "" : yoy.toFixed(2)]
    })
    const csv = "﻿" + [head, ...lines].map((row) => row.join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = (r.label || r.indicator) + ".csv"; a.click()
    URL.revokeObjectURL(url)
  }

  // 행 클릭 → 해당 분류 차트로 이동(onPick 있으면 동일 페이지 전환, 없으면 경제지표로 라우팅)
  function goChart(catKey: string) {
    if (!NAV_IDS.has(catKey)) return
    if (onPick) onPick(catKey)
    else if (typeof window !== "undefined") window.location.href = "/economy/?v=" + catKey
  }

  const rows: Row[] = useMemo(() => {
    const mapped = prov.map((p) => {
      const c = classify(p.indicator, p.label || "")
      const lv = latest[p.indicator]
      return { ...p, cat: c.key, catKo: c.ko, value: lv ? lv.value : null, period: lv ? lv.period : p.mx, prev: lv ? lv.prev : null }
    })
    // 중복 라벨 제거(전기 보급률 등) — 값 있음>CONFIRMED>관측수 순으로 대표 1개만
    const score = (r: Row) => (r.value != null ? 4 : 0) + ((r.confidence || "").toUpperCase() === "CONFIRMED" ? 2 : 0) + (r.n || 0) / 1e6
    const byLabel = new Map<string, Row>()
    for (const r of mapped) {
      const key = (r.label || r.indicator).trim().toLowerCase()
      const ex = byLabel.get(key)
      if (!ex || score(r) > score(ex)) byLabel.set(key, r)
    }
    const out = Array.from(byLabel.values())
    // 전망 지표 주입(provenance 미포함) — 전망치·기준(출처)을 명시
    const have = new Set(out.map((r) => r.indicator))
    for (const [ind, meta] of Object.entries(FORECAST_META)) {
      const lv = latest[ind]
      if (!lv || have.has(ind)) continue
      out.push({ indicator: ind, label: meta.label, source: meta.source, source_ref: null, confidence: "FORECAST", levels: null, mn: lv.period, mx: lv.period, n: 1, cat: meta.cat, catKo: catKo(meta.cat), value: lv.value, period: lv.period, prev: lv.prev })
    }
    return out
  }, [prov, latest])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) m[r.cat] = (m[r.cat] || 0) + 1
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => (cat === "all" || r.cat === cat) && (!s || (r.label + " " + (INDICATOR_EN[r.indicator] ?? "") + " " + r.indicator + " " + r.source + " " + (r.source_ref ?? "") + " " + r.catKo).toLowerCase().includes(s)))
  }, [rows, q, cat])

  // 분류순: 카테고리별 그룹 / 최신순: 최신 관측일(period) 내림차순 플랫
  const grouped = useMemo(() => {
    if (sort === "recent") return null
    const order = [...CATS.map((c) => c.key), "etc"]
    const m: Record<string, Row[]> = {}
    for (const r of filtered) (m[r.cat] = m[r.cat] || []).push(r)
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.label || a.indicator).localeCompare(b.label || b.indicator, "ko"))
    return order.filter((k) => m[k]?.length).map((k) => [k, m[k]] as [string, Row[]])
  }, [filtered, sort])

  // 기간 문자열(연/분기/월/일 혼재)을 비교 가능한 '기간 종료 시점' 숫자로 정규화 — 월/분기/연이 섞여도 최신 데이터가 위로.
  const periodEnd = (p: string): number => {
    if (!p) return 0
    const q = p.match(/^(\d{4})[-\s]*Q([1-4])/i); if (q) return +q[1] * 10000 + +q[2] * 3 * 100 + 31 // 분기 → 종료월
    const ymd = p.match(/^(\d{4})-(\d{2})-(\d{2})/); if (ymd) return +ymd[1] * 10000 + +ymd[2] * 100 + +ymd[3]
    const ym = p.match(/^(\d{4})-(\d{2})/); if (ym) return +ym[1] * 10000 + +ym[2] * 100 + 31
    const y = p.match(/^(\d{4})/); if (y) return +y[1] * 10000 + 1231 // 연 → 연말
    return 0
  }
  const flat = useMemo(() => {
    if (sort !== "recent") return null
    // 최신순 = '가장 최근에 발표된 실제 지표' — 최근 관측일(mx) 기준. 단, 미래 날짜(전망치 gdp_forecast 등)는 발표 최신이 아니므로 하단으로.
    const now = new Date(); const todayNum = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
    const upd = (r: Row) => { const m = (r.mx || "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return periodEnd(r.period || ""); const v = +m[1] * 10000 + +m[2] * 100 + +m[3]; return v > todayNum ? -1 : v }
    return [...filtered].sort((a, b) => (upd(b) - upd(a)) || (periodEnd(b.period || "") - periodEnd(a.period || "")))
  }, [filtered, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes detFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes bkFade{from{opacity:0}to{opacity:1}}@keyframes detSwap{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes detModalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}"}</style>

      {!detail && (<>
      <InsightBanner banner={ALL_BANNER} open={bnOpen} onToggle={() => setBnOpen((v) => !v)} />

      {/* 정렬(분류순/최신순) + 분류 드롭다운(시장동향식) + 총 지표 + 검색 + 최신 — 한 줄 */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
        <Segmented value={sort} onChange={(k) => setSort(k as "cat" | "recent")} options={[{ k: "cat", label: T("분류순", "By type") }, { k: "recent", label: T("최신순", "Latest") }]} size="sm" />
        <PmDrop label={T("분류", "Category")} sel={cat} onSelect={setCat} options={[{ k: "all", t: T("전체", "All") }, ...[...CATS.map((c) => c.key), "etc"].filter((k) => catCounts[k]).map((k) => ({ k, t: catKo(k) + " (" + catCounts[k] + ")" }))]} />
        <span className="shrink-0 text-[11.5px] text-gray-500 dark:text-gray-400">{T("총 지표", "Total")} <b className="text-gray-900 dark:text-gray-50">{rows.length}</b></span>
        <div className={"group relative ml-auto transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-full max-w-[360px]" : "w-full max-w-[260px]")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder={T("지표 · 원본코드 · 출처 · 분류 검색", "Search indicator · code · source · category")}
            className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={T("검색어 지우기", "Clear search")}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          {T("최신", "Updated")} {loadedAt ? fmtStamp(loadedAt.toISOString()) : "—"}
          <span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span>
        </span>
      </div>

      {/* 분류순: 카테고리별 섹션 — 카테고리 제목·설명 + 지표 리스트(설명·최신값·24H·7일) */}
      {grouped && grouped.map(([k, items]) => (
        <section key={k} style={{ animation: "fadeUp .5s ease both" }}>
          {/* 카테고리 헤더 — 제목·개수·설명을 한 줄로 */}
          <header className="mb-1 flex items-baseline gap-2 px-1">
            <h2 className="shrink-0 text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{catKo(k)}</h2>
            <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{items.length}{T("개 지표", " indicators")}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-gray-500 dark:text-gray-400">{CAT_MI[k]?.mean ?? T("국가 공식통계 기반 최신 관측 지표", "Latest observations from official national statistics")}</span>
            {NAV_IDS.has(k) && <button type="button" onClick={() => goChart(k)} className="shrink-0 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{T("차트 전체 보기", "View all charts")} →</button>}
          </header>
          <IndListTable items={items} q={q} spark={spark} fav={fav} onFav={toggleFav} onDetail={setDetail} />
        </section>
      ))}

      {/* 최신순: 단일 플랫 리스트 */}
      {flat && (
        <section style={{ animation: "fadeUp .5s ease both" }}>
          <header className="mb-1.5 flex flex-wrap items-baseline gap-x-2 px-1">
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("최신 업데이트순", "By latest update")}</h2>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{flat.length}{T("개 지표", " indicators")}</span>
            <span className="text-[12px] text-gray-400 dark:text-gray-500">· {T("최근 관측이 갱신된 지표 우선", "Most recently updated first")}</span>
          </header>
          <IndListTable items={flat} q={q} spark={spark} fav={fav} onFav={toggleFav} onDetail={setDetail} showCat />
        </section>
      )}

      {prov.length > 0 && filtered.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[12.5px] text-gray-400">{T("검색 결과 없음", "No results")}</div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        {T("최신값=국가지표(PHILIPPINES) 최신 관측 · 직전 대비=직전 관측 대비 증감 · 기간=데이터 보유 범위(관측수) · ", "Latest = most recent observation for the national indicator (PHILIPPINES) · Prior change = change vs. previous observation · Coverage = data range held (observations) · ")}<b className="font-semibold text-gray-500 dark:text-gray-400">{T("자세히보기=시계열(연·분기·월)+전년비·전월비, 엑셀=CSV 다운로드", "Detail = time series (Y/Q/M) + YoY·MoM, Excel = CSV download")}</b>{T(" · 「전망」은 ADB·IMF·BSP 예측치.", " · “Forecast” = ADB·IMF·BSP projections.")}
      </p>
      </>)}

      {detail && <IndicatorDetail row={detail} onClose={() => setDetail(null)} onExcel={downloadExcel} onOpenChart={goChart} />}
    </div>
  )
}


// 지표별 설명 — 큐레이션 문구(INDICATOR_DESC) 우선 + 단위·출처·기간을 붙여 전 행 2줄 분량으로 보강(균일)
function descOf(r: Row): string {
  const u = inferUnit(r.indicator, r.label || "")
  const base = INDICATOR_DESC[r.indicator]
    ?? ((u.unit === "%" ? T("전기 대비 증감률·비율", "Change vs. prior period · ratio") : u.unit === "지수" ? T("기준계열 대비 지수", "Index vs. base series") : u.prefix === "₱" ? T("가격·금액(₱ 페소)", "Price · amount (₱ PHP)") : u.prefix === "$" ? T("금액($ 미달러)", "Amount ($ USD)") : u.unit === "℃" ? T("월평균 기온", "Monthly avg. temperature") : u.unit === "CDD" ? T("냉방도일(에어컨 수요 선행)", "Cooling degree days (leads AC demand)") : u.unit.indexOf("명") >= 0 ? T("인구·규모·수량", "Population · size · count") : T("국가 공식통계 관측값", "Official national statistic observation")) + T(" 지표", " indicator"))
  // 리스트에는 설명(정의)만 — 단위·출처·관측기간은 지표 상세 페이지에서 표시
  return base
}

// 추정 발표일 — 관측 최신월 + 주기별 표준 발표지연(월별 +45일, 분기 +75, 연 +200, 일/주 +2).
// 주기는 provenance의 mn~mx 스팬 ÷ 관측수로 추정. 실제 발표일 근사치(DB에 정확 발표일 미보유).
function estReleaseMD(r: Row): string | null {
  const base = r.period && /^\d{4}-\d{2}-\d{2}/.test(r.period) ? r.period : r.mx || ""
  const m = base.match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null
  const a = (r.mn || "").match(/^(\d{4})-(\d{2})/), b = (r.mx || "").match(/^(\d{4})-(\d{2})/)
  const span = a && b ? (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2])) : 1
  const cad = span / Math.max(1, (r.n || 1) - 1) // 관측 간 개월 간격(주기)
  const lag = cad >= 6 ? 200 : cad >= 2 ? 75 : cad >= 0.7 ? 45 : 2
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); d.setDate(d.getDate() + lag)
  return (d.getMonth() + 1) + "/" + d.getDate()
}

// ── 이미지형 리스트 테이블 — 지표(☆) | 설명 | 최신값 | 24H(%) | 최근 7일 ──
function IndListTable({ items, q, fav, onFav, onDetail, showCat }: { items: Row[]; q: string; spark?: Record<string, number[]>; fav: Set<string>; onFav: (id: string) => void; onDetail: (r: Row) => void; showCat?: boolean }) {
  const cols = showCat ? ["21%", "9%", "39%", "12%", "11%", "8%"] : ["23%", "45%", "13%", "11%", "8%"]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-fixed text-[12px]">
        <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          <th className="px-3 py-2">{T("지표", "Indicator")}</th>
          {showCat && <th className="px-2 py-2">{T("분류", "Category")}</th>}
          <th className="px-2 py-2">{T("설명", "Desc.")}</th>
          <th className="px-2 py-2 text-right">{T("최신 값", "Latest")}</th>
          <th className="px-2 py-2 text-right whitespace-nowrap">{T("최신월", "Period")}</th>
          <th className="px-3 py-2 text-right whitespace-nowrap">{T("갱신", "Updated")}</th>
        </tr></thead>
        <tbody>
          {items.map((r) => {
            const u = inferUnit(r.indicator, r.label || "")
            const isFav = fav.has(r.indicator)
            return (
              <tr key={r.indicator} onClick={() => onDetail(r)} className="group cursor-pointer border-b border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onFav(r.indicator) }} aria-label={T("즐겨찾기", "Favorite")} className={"shrink-0 transition-colors active:scale-90 " + (isFav ? "text-amber-400" : "text-gray-300 hover:text-amber-400 dark:text-gray-600")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L12 16.77 6.79 19.5l.99-5.8-4.21-4.1 5.82-.85z" /></svg>
                    </button>
                    <span className="truncate font-semibold text-gray-800 dark:text-gray-100 transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300" title={enLabel(r.indicator, r.label)}><Hi text={enLabel(r.indicator, r.label)} q={q} /></span>
                  </div>
                </td>
                {showCat && <td className="truncate px-2 py-3 text-gray-500 dark:text-gray-400">{r.catKo}</td>}
                <td className="px-2 py-3 align-middle"><div className="flex min-h-[2.75em] items-center"><p className="line-clamp-2 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{descOf(r)}</p></div></td>
                <td className="px-2 py-3 text-right font-bold tabular-nums text-gray-900 dark:text-gray-50">{r.value != null ? (u.prefix || "") + fmtVal(r.value) + (u.suffix || "") : "—"}</td>
                <td className="px-2 py-3 text-right align-middle tabular-nums whitespace-nowrap text-[11.5px] font-semibold text-gray-600 dark:text-gray-300">{r.period ? ym(r.period) : "—"}</td>
                <td className="px-3 py-3 text-right align-middle tabular-nums whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400" title={T("추정 발표일(관측월+표준 발표지연)", "Est. release date (obs. month + typical lag)")}>{estReleaseMD(r) ?? "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 지표 자세히보기 — 시계열(월/분기/연)을 엑셀 표처럼, 전월비·전년비 반영
// 엑셀형 연도×기간 피벗 — 행=연도(최신 위), 열=월(1~12)/분기(Q1~4)/반기(상·하)/연간.
// 각 셀=값(상단)+전년비 YoY%(하단, 색상)를 함께 표시. 월 데이터가 없는 분기/연 지표는 해당 열만 노출.
function YearPivot({ series, native, u }: { series: { date: string; value: number }[]; native: "month" | "quarter" | "year"; u: { prefix?: string; suffix?: string } }) {
  const mmap = useMemo(() => { const m = new Map<string, number>(); for (const p of series) m.set(p.date.slice(0, 4) + "-" + Number(p.date.slice(5, 7)), p.value); return m }, [series])
  const years = useMemo(() => Array.from(new Set(series.map((p) => p.date.slice(0, 4)))).sort((a, b) => Number(b) - Number(a)), [series])
  type Col = { key: string; label: string; kind: "m" | "q" | "h" | "a"; idx: number; grp: string }
  const cols = useMemo(() => {
    const c: Col[] = []
    if (native === "month") for (let m = 1; m <= 12; m++) c.push({ key: "m" + m, label: String(m), kind: "m", idx: m, grp: T("월", "Month") })
    if (native !== "year") for (let q = 1; q <= 4; q++) c.push({ key: "q" + q, label: "Q" + q, kind: "q", idx: q, grp: T("분기", "Qtr") })
    if (native !== "year") { c.push({ key: "h1", label: T("상반", "H1"), kind: "h", idx: 1, grp: T("반기", "Half") }); c.push({ key: "h2", label: T("하반", "H2"), kind: "h", idx: 2, grp: T("반기", "Half") }) }
    c.push({ key: "a", label: T("연간", "Yr"), kind: "a", idx: 0, grp: T("연간", "Annual") })
    return c
  }, [native])
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const present = (y: string, ms: number[]) => ms.map((m) => mmap.get(y + "-" + m)).filter((v): v is number => v != null)
  const cellVal = (y: string, c: Col): number | null => {
    if (c.kind === "m") { const v = mmap.get(y + "-" + c.idx); return v == null ? null : v }
    if (c.kind === "q") return avg(present(y, [1, 2, 3].map((x) => x + (c.idx - 1) * 3)))
    if (c.kind === "h") return avg(present(y, c.idx === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]))
    return avg(present(y, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))
  }
  const yoyOf = (y: string, c: Col): number | null => {
    const cur = cellVal(y, c), prev = cellVal(String(Number(y) - 1), c)
    return cur != null && prev != null && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null
  }
  const fmtV = (v: number | null) => v == null ? "—" : (u.prefix || "") + fmtVal(v) + (u.suffix || "")
  if (!years.length) return <div className="flex h-24 items-center justify-center text-[12px] text-gray-400">{T("데이터 없음", "No data")}</div>
  const isGrpStart = (i: number) => i === 0 || cols[i].grp !== cols[i - 1].grp // 그룹 경계(좌측선)
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-gray-400 dark:text-gray-500">
        <span>{T("각 셀 상단=값(기간 평균) · 하단=전년비", "Each cell: top = value (period avg) · bottom = YoY")}</span>
        <span className="inline-flex items-center gap-1"><span className="text-rose-500">{T("▲ 상승", "▲ up")}</span><span className="text-emerald-500">{T("▼ 하락", "▼ down")}</span></span>
      </div>
      <div className="max-h-[440px] overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
        <table className="w-full border-collapse text-[11px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/95 backdrop-blur">
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800/95 px-3 py-2 text-left font-semibold">{T("연도", "Year")}</th>
              {cols.map((c, i) => <th key={c.key} className={"px-2 py-2 text-right font-semibold whitespace-nowrap " + (isGrpStart(i) ? "border-l border-gray-200 dark:border-gray-700 " : "") + (c.kind === "a" ? "text-indigo-600 dark:text-indigo-300" : "")} title={c.grp}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y} className="border-t border-gray-50 dark:border-gray-800/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5">
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-1.5 text-left font-bold text-gray-800 dark:text-gray-100">{y}</td>
                {cols.map((c, i) => { const v = cellVal(y, c), yy = yoyOf(y, c)
                  const vCol = v == null ? "text-gray-300 dark:text-gray-600" : c.kind === "a" ? "font-bold text-gray-900 dark:text-gray-50" : "text-gray-700 dark:text-gray-200"
                  const yCol = yy == null ? "text-gray-300 dark:text-gray-600" : yy >= 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-500 dark:text-emerald-400"
                  return <td key={c.key} className={"px-2 py-1 text-right align-top " + (isGrpStart(i) ? "border-l border-gray-100 dark:border-gray-800 " : "")}>
                    <div className={"whitespace-nowrap leading-tight " + vCol}>{fmtV(v)}</div>
                    <div className={"whitespace-nowrap text-[9px] leading-tight " + yCol}>{yy == null ? "" : (yy >= 0 ? "+" : "") + yy.toFixed(1) + "%"}</div>
                  </td> })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IndicatorDetail({ row, onClose, onExcel, onOpenChart }: { row: Row; onClose: () => void; onExcel: (r: Row) => void; onOpenChart: (cat: string) => void }) {
  const CAT_MI = buildCatMi()   // 렌더 시점 생성(언어 반영)
  const [series, setSeries] = useState<{ date: string; value: number }[] | null>(null)
  const [gran, setGran] = useState<"month" | "quarter" | "year">("month")
  const [win, setWin] = useState("전체")

  useEffect(() => { indicatorSeries(row.indicator).then(setSeries).catch(() => setSeries([])) }, [row.indicator])
  // 지표 상세 진입 시 항상 최상단에서 시작(리스트 스크롤 위치 이월 방지). 스크롤 컨테이너 무관하게 동작.
  useEffect(() => { if (typeof window !== "undefined") { window.scrollTo({ top: 0, behavior: "auto" }); const se = document.scrollingElement; if (se) se.scrollTop = 0 } }, [row.indicator])

  // 기간 윈도우 필터(1Y/2Y/5Y/전체) — 페이지 차트와 동일
  const winSeries = useMemo(() => {
    if (!series || series.length < 2) return series || []
    const yrs = win === "1Y" ? 1 : win === "2Y" ? 2 : win === "5Y" ? 5 : 100
    if (yrs >= 100) return series
    const last = series[series.length - 1].date
    const cutoff = (Number(last.slice(0, 4)) - yrs) + last.slice(4)
    const f = series.filter((p) => p.date >= cutoff)
    return f.length >= 2 ? f : series.slice(-Math.min(2, series.length))
  }, [series, win])

  // 네이티브 주기 추정(월/분기/연) → 사용 가능한 granularity 결정
  const native = useMemo(() => {
    if (!series || series.length < 2) return "month"
    const gaps: number[] = []
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1].date, b = series[i].date
      gaps.push((Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7))))
    }
    gaps.sort((x, y) => x - y); const med = gaps[Math.floor(gaps.length / 2)] || 1
    return med >= 10 ? "year" : med >= 2 ? "quarter" : "month"
  }, [series])
  const grans = native === "year" ? ["year"] : native === "quarter" ? ["quarter", "year"] : ["month", "quarter", "year"]
  useEffect(() => { if (!grans.includes(gran)) setGran(native as "month" | "quarter" | "year") }, [native]) // eslint-disable-line

  // 리샘플 + 전기/전년 대비
  const table = useMemo(() => {
    if (!winSeries || !winSeries.length) return []
    const keyOf = (d: string) => {
      const y = d.slice(0, 4), m = Number(d.slice(5, 7))
      if (gran === "year") return y
      if (gran === "quarter") return y + "-Q" + (Math.floor((m - 1) / 3) + 1)
      return y + "." + String(m).padStart(2, "0")
    }
    const map = new Map<string, number>()
    for (const p of winSeries) map.set(keyOf(p.date), p.value) // asc → 마지막(최신)이 대표
    const keys = Array.from(map.keys())
    const prevYearKey = (k: string) => {
      if (gran === "year") return String(Number(k) - 1)
      if (gran === "quarter") return (Number(k.slice(0, 4)) - 1) + k.slice(4)
      return (Number(k.slice(0, 4)) - 1) + k.slice(4)
    }
    return keys.map((k, i) => {
      const v = map.get(k)!
      const prev = i > 0 ? map.get(keys[i - 1])! : null
      const ya = map.get(prevYearKey(k))
      const mom = prev != null && prev !== 0 ? ((v - prev) / Math.abs(prev)) * 100 : null
      const yoy = ya != null && ya !== 0 ? ((v - ya) / Math.abs(ya)) * 100 : null
      return { k, v, mom, yoy }
    }).reverse() // 최신 우선
  }, [winSeries, gran])

  const gname: Record<string, string> = { month: T("월별", "Monthly"), quarter: T("분기별", "Quarterly"), year: T("연도별", "Annual") }
  const u = inferUnit(row.indicator, row.label || "")
  const chartData = useMemo(() => table.slice().reverse().map((t) => ({ k: t.k, v: t.v })), [table]) // 차트는 시간순(과거→최신)
  const canOpen = NAV_IDS.has(row.cat)
  // 페이지 차트(LineChart)와 동일 포맷 — 라벨은 파서 호환 컴팩트('YY / YY.Qn / YY.M)
  const chLabels = chartData.map((d) => (gran === "year" ? "'" + d.k.slice(2) : gran === "quarter" ? d.k.split("-")[0].slice(2) + "." + d.k.split("-")[1] : d.k.slice(2, 4) + "." + Number(d.k.slice(5))))
  const chSeries = [{ name: enLabel(row.indicator, row.label), color: "#4f46e5", data: chartData.map((d) => d.v), w: 2, endLabel: "" }]
  const chDec = Math.abs(chartData[chartData.length - 1]?.v ?? 0) < 20 ? 1 : 0
  const chUnit = u.suffix || (u.prefix ? " " + u.prefix : u.unit && u.unit !== "값" ? " " + u.unit : "") // 툴팁 단위

  return (
    <section style={{ animation: "detFade .3s ease both" }}>
        <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300 active:scale-95"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>{T("목록으로", "Back")}</button>
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (row.confidence === "FORECAST" ? "bg-amber-500" : "bg-indigo-500")} />
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{row.catKo}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>{row.source}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="num">{ym(row.mn)}~{ym(row.mx)} ({row.n}{T("관측", " obs.")})</span>
            {row.confidence === "FORECAST" && <span className="ml-1 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-px text-[10px] font-bold text-amber-700 dark:text-amber-300">{T("전망", "Forecast")}</span>}
          </div>
          <h3 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-gray-900 dark:text-gray-50">{enLabel(row.indicator, row.label)}</h3>
          <p className="mt-1.5 max-w-[920px] text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">{INDICATOR_DESC[row.indicator] ?? descOf(row)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canOpen && <button type="button" onClick={() => { onOpenChart(row.cat); onClose() }} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-95">{T("경제지표에서 보기", "View in Indicators")} →</button>}
            <button type="button" onClick={() => onExcel(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
              {T("엑셀 다운로드", "Excel download")}
            </button>
          </div>
          <div className="mt-5">
          {series == null ? (
            <div className="flex h-56 items-center justify-center text-[12.5px] text-gray-400">{T("불러오는 중…", "Loading…")}</div>
          ) : table.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-[12.5px] text-gray-400">{T("시계열 데이터 없음", "No time-series data")}</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 상단: 좌 차트 카드 | 우 LG 인사이트 카드(지표별 3~4문장) */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                {/* 차트 카드(좌) — 경제지표 페이지와 동일한 LineChart. 토글(Segmented)은 카드에 상주해 슬라이드 애니메이션 유지 */}
                <div className="flex min-w-0 flex-col rounded-xl border border-gray-100 p-3.5 dark:border-gray-800 lg:w-[58%]">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <h4 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{enLabel(row.indicator, row.label)}</h4>
                    <span className="shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{gname[gran]} · {u.note}</span>
                    <span className="ml-auto"><Segmented size="sm" value={win} onChange={setWin} options={[{ k: "1Y", label: "1Y" }, { k: "2Y", label: "2Y" }, { k: "5Y", label: "5Y" }, { k: "전체", label: T("전체", "All") }]} /></span>
                  </div>
                  {/* 축 글씨가 넓은 화면에서 과대해지지 않도록 폭 제한 + SVG 텍스트 축소 */}
                  <style>{".detchart svg text{font-size:6.8px}"}</style>
                  {/* 기간 토글에 맞춰 차트/최신값만 부드럽게 리렌더(카드·토글은 유지) */}
                  <div key={"ch-" + win} className="flex flex-1 flex-col justify-center" style={{ animation: "bkFade .4s ease both" }}>
                    <div className="mt-1.5 flex min-h-[26px] flex-wrap items-start gap-x-3 gap-y-1 text-[10.5px]">
                      <Lg c="#4f46e5" t={enLabel(row.indicator, row.label)} b />
                      <span className="ml-auto tabular-nums text-gray-500 dark:text-gray-400">{T("최신", "Latest")} <b className="text-gray-900 dark:text-gray-50">{(u.prefix || "") + fmtVal(chartData[chartData.length - 1]?.v ?? NaN) + (u.suffix || "")}</b></span>
                    </div>
                    <div className="detchart mx-auto w-full" style={{ maxWidth: 620 }}>
                      <LineChart series={chSeries} labels={chLabels} decimals={chDec} unit={chUnit} />
                    </div>
                  </div>
                </div>
                {/* LG 인사이트 카드(우) — 지표별 큐레이션(INDICATOR_INSIGHT) 우선, 없으면 카테고리 인사이트 */}
                <div className="flex min-w-0 flex-col rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/[0.06] p-4 lg:w-[42%]" style={{ animation: "bkFade .45s ease .06s both" }}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg></span>
                    <h4 className="text-[13.5px] font-bold text-gray-900 dark:text-gray-50">{T("LG 인사이트", "LG Insight")}</h4>
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">{INDICATOR_INSIGHT[row.indicator] ?? (CAT_MI[row.cat] || CAT_MI.etc).ai}</p>
                  <p className="mt-3 border-t border-indigo-100 dark:border-indigo-500/20 pt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {(CAT_MI[row.cat] || CAT_MI.etc).mean}</p>
                </div>
              </div>
              {/* 하단: 전폭 엑셀형 연도×기간 피벗(월·분기·반기·연간 + 전년비 토글) */}
              <div className="min-w-0 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5" style={{ animation: "bkFade .5s ease .1s both" }}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="h-[15px] w-1 rounded bg-indigo-500" />
                  <h4 className="text-[12.5px] font-bold text-gray-900 dark:text-gray-50">{T("연도별 지표표", "Yearly matrix")} <span className="text-[11px] font-semibold text-gray-400">{T("· 월·분기·반기·연간", "· month·qtr·half·annual")}</span></h4>
                  <button type="button" onClick={() => onExcel(row)} className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 transition-all hover:-translate-y-0.5 active:scale-95">{T("엑셀", "Excel")} ↓</button>
                </div>
                <YearPivot series={series} native={native as "month" | "quarter" | "year"} u={u} />
              </div>
            </div>
          )}
          </div>
          <p className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">{gname[gran]} {T("시계열(차트) · 연도별 표=기간 평균(연평균·분기평균) · 전년비 ", "time series (chart) · yearly matrix = period average · YoY ")}<span className="text-rose-500">{T("상승 적색", "up red")}</span>{T("/", "/")}<span className="text-emerald-500">{T("하락 녹색", "down green")}</span>{T(" · 출처 ", " · Source ")}{row.source}</p>
        </div>
    </section>
  )
}

