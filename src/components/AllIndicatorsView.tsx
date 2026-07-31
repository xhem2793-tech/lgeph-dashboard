"use client"

import React, { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { dataProvenance, allIndicatorLatest, indicatorSeries, fmtStamp, type Provenance } from "@/lib/supabase"
import { sourceLink } from "@/components/DataVerification"
import { Segmented } from "@/components/Segmented"
import { LineChart, Lg } from "@/components/EconChart"
import { CATS, NAV_IDS, classify, catKo } from "@/lib/indicatorCats"
import { InsightBanner, type Banner } from "@/components/InsightBanner"

/** 전체 지표 리스트 상단 배너 — 뉴스·경쟁사광고와 동일한 InsightBanner(크기·스타일 통일). */
const ALL_BANNER: Banner = {
  title: "전체 지표 리스트 · 출처 검증",
  summary: "모든 지표를 한 화면에서 — 최신값·직전 대비·기간·출처·신뢰도",
  body: "분류별 차트 대신 **모든 지표를 한 화면에서** 훑어봅니다 — 최신값·직전 대비·데이터 기간·**출처 링크·신뢰도**까지 한 줄로 정리. 각 지표의 **자세히보기(시계열·전년비/전월비)·엑셀 다운로드**를 지원합니다.",
  insight: "출처·신뢰도가 검증된 지표만 의사결정에 활용 — 원본 링크로 즉시 교차 확인이 가능합니다.",
}

/** 전체 지표 리스트(+데이터 출처·검증 통합) — 분류별 차트 대신 모든 지표를 한 화면에서 검색·정렬로 훑어보고,
 *  각 지표의 최신값·직전 대비·데이터 기간·원본 코드·출처 링크·신뢰도를 한 줄로. 행 클릭 시 해당 분류 차트로 이동. */

const ym = (d: string) => (d ? d.slice(0, 4) + "." + Number(d.slice(5, 7)) + "월" : "—")
const ymc = (d: string) => (d ? "’" + d.slice(2, 4) + "." + Number(d.slice(5, 7)) : "—") // 축약: '25.4

// 전망(forecast) 지표 — provenance(실측 검증 뷰)에 없으므로 별도 메타로 목록에 포함. 값은 v_latest_indicator에서.
const FORECAST_META: Record<string, { label: string; source: string; cat: string }> = {
  cpi_forecast_adb: { label: "소비자물가 상승률 전망(ADB)", source: "ADB 전망", cat: "prices" },
  cpi_inflation_forecast: { label: "인플레이션 전망(시장·BSP)", source: "BSP/시장 전망", cat: "prices" },
  gdp_forecast_adb: { label: "GDP 성장률 전망(ADB)", source: "ADB 전망", cat: "growth" },
  gdp_forecast_imf: { label: "GDP 성장률 전망(IMF)", source: "IMF 전망", cat: "growth" },
  ofw_remittance_forecast: { label: "OFW 송금액 전망($B)", source: "BSP/시장 전망", cat: "labor" },
}
function fmtVal(v: number): string {
  if (v == null || Number.isNaN(v)) return "—"
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B"
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M"
  if (a >= 1e4) return Math.round(v).toLocaleString()
  if (a >= 100) return v.toFixed(1)
  return v.toFixed(2)
}

// 값 단위 추론(%/₱/$/지수/℃/명) — 라벨·지표키 기반 휴리스틱
function inferUnit(indicator: string, label: string): { prefix?: string; suffix?: string; unit: string; note: string } {
  const s = (indicator + " " + (label || "")).toLowerCase()
  if (/유가|oil_|휘발유|경유|디젤|등유|gasoline|diesel|kerosene|ron9|meralco|요금|소매가|임금|wage|grdp|금액/.test(s)) return { prefix: "₱", unit: "₱", note: "₱(페소)" }
  if (/brent|수출액|수입액|송금|remittance|fdi|reserves|_usd|market_usd|외환보유|gni|gdp_total/.test(s)) return { prefix: "$", unit: "$", note: "$(미달러)" }
  if (/php_usd|환율|exchange/.test(s)) return { prefix: "₱", unit: "₱/$", note: "₱/$(환율)" }
  if (/율|률|금리|증가율|상승률|비중|참가율|점유|inflation|growth|_yoy|yoy|ratio|_pct|_gdp|share|forecast|rate$|_rate\b|ppi/.test(s)) return { suffix: "%", unit: "%", note: "% (율)" }
  if (/지수|index|\bcci\b|\bbci\b|rppi|psei|_ci_|confidence|sentiment|composite|gini|cpi_/.test(s)) return { suffix: "", unit: "지수", note: "지수(index)" }
  if (/기온|temperature/.test(s)) return { suffix: "℃", unit: "℃", note: "℃(기온)" }
  if (/cdd|냉방도일/.test(s)) return { suffix: "", unit: "CDD", note: "냉방도일" }
  if (/인구|population|취업자|employed|고용|households|가구|arrivals|관광객|입국자/.test(s)) return { suffix: "", unit: "명·수", note: "명·수" }
  return { suffix: "", unit: "값", note: "값" }
}

// 카테고리별 의미·LG 인사이트(페이지 차트카드처럼 차트 하단에 표기)
const CAT_MI: Record<string, { mean: string; ai: string }> = {
  prices: { mean: "소비자물가(CPI)·품목별 물가 — 생활비·구매력의 직접 지표", ai: "물가 상승은 재량소비 위축·가격민감도 확대로 대형·프리미엄 가전 수요에 부담. 안정 시 교체·프리미엄 소구 여지." },
  growth: { mean: "국민계정·성장·투자·생산 — 경기 사이클과 시장 규모의 배경", ai: "성장·투자 확대는 소득·고용을 통해 가전 수요 저변 확장. 둔화 시 내구재 지출 이연 경계." },
  labor: { mean: "고용·임금·소득·해외송금 — 가처분소득·구매력의 원천", ai: "고용·임금·송금 개선은 볼륨존~프리미엄 수요 견인. 실업·송금 둔화는 수요 하방 신호." },
  sentiment: { mean: "소비·기업 심리(CCI·BCI·BES) — 수요의 선행 신호", ai: "심리 개선은 내구재 구매의향 선행. 악화 시 할부·프로모션 강화로 방어." },
  housing: { mean: "부동산·주택·건축허가·공실 — 빌트인·초도 가전 수요 선행", ai: "주택 공급·가격 상승은 초도·빌트인 가전 수요에 우호. 상업 부동산은 B2B 공조 수요와 연동." },
  fx: { mean: "환율·실효환율·외환보유 — 수입 조달원가의 배경", ai: "페소 약세는 수입 가전 원가·판가 상승 압력. 현지 조달·헤지, 프리미엄 정당화가 대응 축." },
  rates: { mean: "금리·통화·신용 — 가전 할부·소비 금융 여건", ai: "금리 인하·신용 확대는 할부·카드 기반 내구재 구매력 개선. 긴축 시 수요 둔화 경계." },
  appliance: { mean: "가전 물가·PPI·수입액·보급 — 가전시장 직접 선행지표", ai: "가전 물가·조달·보급 흐름은 판가·수요·침투 전략의 1차 신호." },
  energy: { mean: "에너지효율 라벨(DOE) — 고효율 제품 경쟁 구도", ai: "전기료 부담 국면에서 고효율(별점) 소구가 차별화. 5성 비중 확대가 프리미엄 근거." },
  importprice: { mean: "수입 단가($/kg)·원산지 — 조달원가·수입 경쟁 구도", ai: "단가 상승은 COGS·소매가 압력, 현지화 이점 확대. 원산지 믹스는 경쟁 강도 신호." },
  online: { mean: "이커머스·디지털·통신 침투 — 온라인 판매 채널 성장", ai: "온라인 침투 확대는 D2C·이커머스 채널 강화 근거. 물류·디지털 마케팅 투자 연동." },
  weather: { mean: "냉방도일(CDD)·기온·태풍·지진 — 냉방 수요·재해 리스크", ai: "CDD·폭염은 에어컨 수요 선행, 태풍·지진은 공급망·재해복구 가전 교체 변수." },
  etc: { mean: "참고 지표 — 인구·디지털·재정 등 구조적 배경", ai: "직접 수요 지표는 아니나 시장 규모·구매력·인프라의 배경 맥락으로 활용." },
}

/** 검색어 하이라이트 — 뉴스 검색과 동일(노란 mark) */
function Hi({ text, q }: { text: string; q: string }) {
  const k = q.trim()
  if (!k || !text) return <>{text}</>
  const parts = text.split(new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"))
  return <>{parts.map((p, i) => (p.toLowerCase() === k.toLowerCase() ? <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-gray-900 dark:text-gray-50">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}</>
}

type Row = Provenance & { cat: string; catKo: string; value: number | null; period: string; prev: number | null }

export default function AllIndicatorsView({ onPick, layout = "list" }: { onPick?: (catKey: string) => void; layout?: "list" | "card" }) {
  const [prov, setProv] = useState<Provenance[]>([])
  const [latest, setLatest] = useState<Record<string, { value: number; period: string; prev: number | null }>>({})
  const [q, setQ] = useState("")
  const [focused, setFocused] = useState(false)
  const [cat, setCat] = useState("all")
  const [sort, setSort] = useState<"cat" | "recent">("cat")
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [detail, setDetail] = useState<Row | null>(null)
  const [bnOpen, setBnOpen] = useState(false)

  useEffect(() => {
    Promise.all([dataProvenance().catch(() => []), allIndicatorLatest().catch(() => ({}))]).then(([p, l]) => {
      setProv(p as Provenance[]); setLatest(l as Record<string, { value: number; period: string; prev: number | null }>); setLoadedAt(new Date())
    })
  }, [])

  // 엑셀(CSV) 다운로드 — 해당 지표 전체 시계열 + 전기/전년 대비
  async function downloadExcel(r: Row) {
    const series = await indicatorSeries(r.indicator).catch(() => [])
    if (!series.length) return
    const head = ["기간", "값", "전기대비(%)", "전년대비(%)"]
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
    return rows.filter((r) => (cat === "all" || r.cat === cat) && (!s || (r.label + " " + r.indicator + " " + r.source + " " + (r.source_ref ?? "") + " " + r.catKo).toLowerCase().includes(s)))
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

  const flat = useMemo(() => {
    if (sort !== "recent") return null
    return [...filtered].sort((a, b) => (b.period || "").localeCompare(a.period || ""))
  }, [filtered, sort])

  const confN = rows.filter((r) => (r.confidence || "").toUpperCase() === "CONFIRMED").length

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes detFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes bkFade{from{opacity:0}to{opacity:1}}@keyframes detSwap{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes detModalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}"}</style>

      <InsightBanner banner={ALL_BANNER} open={bnOpen} onToggle={() => setBnOpen((v) => !v)} />

      {/* 정렬(주요뉴스와 동일 Segmented) + 검색(우측) + 최종 갱신(뉴스와 동일 위치·포맷) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
        <Segmented value={sort} onChange={(k) => setSort(k as "cat" | "recent")} options={[{ k: "cat", label: "분류순" }, { k: "recent", label: "최신순" }]} size="sm" />
        <div className="flex flex-wrap items-center gap-2.5 text-[11.5px]">
          <span className="text-gray-500 dark:text-gray-400">총 지표 <b className="text-gray-900 dark:text-gray-50">{rows.length}</b></span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-500 dark:text-gray-400">검색 결과 <b className="text-indigo-600 dark:text-indigo-400">{filtered.length}</b></span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-500 dark:text-gray-400">CONFIRMED <b className="text-emerald-600 dark:text-emerald-400">{confN}</b></span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-500 dark:text-gray-400">분류 <b className="text-gray-900 dark:text-gray-50">{Object.keys(catCounts).length}</b></span>
        </div>
        <div className={"group relative ml-auto transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-full max-w-[420px]" : "w-full max-w-[320px]")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder="지표 · 원본코드 · 출처 · 분류 검색"
            className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="검색어 지우기"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          최종 갱신 {loadedAt ? fmtStamp(loadedAt.toISOString()) : "—"}
          <span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-bold text-emerald-700 dark:text-emerald-300">C</span>
        </span>
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="flex flex-wrap gap-1.5">
        <FCat k="all" ko="전체" n={rows.length} cat={cat} setCat={setCat} />
        {[...CATS.map((c) => c.key), "etc"].filter((k) => catCounts[k]).map((k) => (
          <FCat key={k} k={k} ko={catKo(k)} n={catCounts[k]} cat={cat} setCat={setCat} />
        ))}
      </div>

      {/* 분류순: 카테고리별 섹션 */}
      {grouped && grouped.map(([k, items]) => (
        <section key={k} className="overflow-hidden rounded-xl" style={{ animation: "fadeUp .5s ease both" }}>
          <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <span className="h-[16px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[13.5px] font-bold text-gray-900 dark:text-gray-50">{catKo(k)}</h2>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{items.length}개 지표</span>
            {NAV_IDS.has(k) && <button type="button" onClick={() => goChart(k)} className="ml-auto text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">차트 전체 보기 →</button>}
          </header>
          {layout === "card" ? <IndCards items={items} q={q} showCat={false} onDetail={setDetail} onExcel={downloadExcel} /> : <IndTable items={items} q={q} showCat={false} onDetail={setDetail} onExcel={downloadExcel} />}
        </section>
      ))}

      {/* 최신순: 단일 플랫 테이블 */}
      {flat && (
        <section className="overflow-hidden rounded-xl" style={{ animation: "fadeUp .5s ease both" }}>
          <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <span className="h-[16px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[13.5px] font-bold text-gray-900 dark:text-gray-50">최신 업데이트순</h2>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{flat.length}개 지표 · 최근 관측 우선</span>
          </header>
          {layout === "card" ? <IndCards items={flat} q={q} showCat onDetail={setDetail} onExcel={downloadExcel} /> : <IndTable items={flat} q={q} showCat onDetail={setDetail} onExcel={downloadExcel} />}
        </section>
      )}

      {prov.length > 0 && filtered.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[12.5px] text-gray-400">검색 결과 없음</div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        최신값=국가지표(PHILIPPINES) 최신 관측 · 직전 대비=직전 관측 대비 증감 · 기간=데이터 보유 범위(관측수) · <b className="font-semibold text-gray-500 dark:text-gray-400">자세히보기=시계열(연·분기·월)+전년비·전월비, 엑셀=CSV 다운로드</b> · 「전망」은 ADB·IMF·BSP 예측치.
      </p>

      {detail && <IndicatorDetail row={detail} onClose={() => setDetail(null)} onExcel={downloadExcel} onOpenChart={goChart} />}
    </div>
  )
}

function IndTable({ items, q, showCat, onDetail, onExcel }: { items: Row[]; q: string; showCat: boolean; onDetail: (r: Row) => void; onExcel: (r: Row) => void }) {
  // 고정 컬럼폭 — 카테고리별 표가 동일 위치에 정렬되도록(table-layout:fixed)
  const cols = showCat ? ["20%", "9%", "9%", "7%", "9%", "8%", "12%", "9%", "17%"] : ["24%", "10%", "7%", "10%", "9%", "13%", "10%", "17%"]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] table-fixed text-[12px]">
        <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">
          <th className="px-4 py-1.5">지표</th>
          {showCat && <th className="px-2 py-1.5">분류</th>}
          <th className="px-2 py-1.5 text-right">최신값</th><th className="px-2 py-1.5 text-center">단위</th><th className="px-2 py-1.5 text-right">직전 대비</th><th className="px-2 py-1.5">기준</th><th className="px-2 py-1.5">기간</th><th className="px-2 py-1.5">출처</th><th className="px-2 py-1.5 text-center">액션</th>
        </tr></thead>
        <tbody>
          {items.map((r) => {
            const chg = r.value != null && r.prev != null && r.prev !== 0 ? r.value - r.prev : null
            const up = chg != null && chg >= 0
            const link = sourceLink(r.source, r.source_ref)
            const u = inferUnit(r.indicator, r.label || "")
            return (
              <tr key={r.indicator} onClick={() => onDetail(r)}
                className="group cursor-pointer border-b border-gray-50 dark:border-gray-800/50 transition-all duration-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10">
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-gray-800 dark:text-gray-100 transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300" title={r.label || r.indicator}><Hi text={r.label || r.indicator} q={q} /></span>
                    <span className="shrink-0 text-[10px] font-semibold text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100">자세히 →</span>
                  </div>
                </td>
                {showCat && <td className="truncate px-2 py-1.5 text-gray-500 dark:text-gray-400">{r.catKo}</td>}
                <td className="px-2 py-1.5 text-right font-bold tabular-nums text-gray-900 dark:text-gray-50">{r.value != null ? (u.prefix || "") + fmtVal(r.value) + (u.suffix || "") : "—"}</td>
                <td className="px-2 py-1.5 text-center"><span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">{u.unit}</span></td>
                <td className={"px-2 py-1.5 text-right tabular-nums " + (chg == null ? "text-gray-300 dark:text-gray-600" : up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{chg == null ? "—" : (up ? "▲" : "▼") + fmtVal(Math.abs(chg))}</td>
                <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{ym(r.period)}</td>
                <td className="px-2 py-1.5 tabular-nums text-gray-400 dark:text-gray-500">{ymc(r.mn)}~{ymc(r.mx)} <span className="text-gray-300 dark:text-gray-600">({r.n})</span></td>
                <td className="truncate px-2 py-1.5" title={r.source}>{link ? <a href={link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"><Hi text={r.source} q={q} /> ↗</a> : <span className="text-gray-500 dark:text-gray-400"><Hi text={r.source} q={q} /></span>}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onDetail(r) }} className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[10.5px] font-semibold text-gray-600 dark:text-gray-300 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400 active:scale-95">자세히</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onExcel(r) }} title="엑셀(CSV) 다운로드" className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-95">엑셀</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 카드형 — 리스트(테이블)와 동일 데이터·동일 액션, 카드 그리드 레이아웃
function IndCards({ items, q, showCat, onDetail, onExcel }: { items: Row[]; q: string; showCat: boolean; onDetail: (r: Row) => void; onExcel: (r: Row) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((r, i) => {
        const chg = r.value != null && r.prev != null && r.prev !== 0 ? r.value - r.prev : null
        const up = chg != null && chg >= 0
        const link = sourceLink(r.source, r.source_ref)
        const u = inferUnit(r.indicator, r.label || "")
        return (
          <div key={r.indicator} onClick={() => onDetail(r)}
            style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(i, 12) * 0.02 + "s" }}
            className="group flex cursor-pointer flex-col rounded-xl p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {showCat && <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-indigo-600 dark:text-indigo-400">{r.catKo}</span>}
                  {r.confidence === "FORECAST" && <span className="rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-px text-[9.5px] font-bold text-amber-700 dark:text-amber-300">전망</span>}
                </div>
                <h3 className="mt-1 truncate text-[12.5px] font-bold text-gray-800 dark:text-gray-100 transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300" title={r.label || r.indicator}><Hi text={r.label || r.indicator} q={q} /></h3>
              </div>
              <span className="shrink-0 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[9.5px] font-semibold text-gray-500 dark:text-gray-400">{u.unit}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[19px] font-extrabold leading-none tabular-nums text-gray-900 dark:text-gray-50">{r.value != null ? (u.prefix || "") + fmtVal(r.value) + (u.suffix || "") : "—"}</span>
              <span className={"text-[11.5px] font-semibold tabular-nums " + (chg == null ? "text-gray-300 dark:text-gray-600" : up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{chg == null ? "" : (up ? "▲" : "▼") + fmtVal(Math.abs(chg))}</span>
            </div>
            <div className="mt-2 flex items-center gap-x-2 gap-y-0.5 text-[10.5px] text-gray-400 dark:text-gray-500">
              <span className="tabular-nums">{ym(r.period)}</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="tabular-nums">{ymc(r.mn)}~{ymc(r.mx)}</span>
              {link ? <a href={link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto shrink-0 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{r.source} ↗</a> : <span className="ml-auto shrink-0 truncate">{r.source}</span>}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 border-t border-gray-50 dark:border-gray-800/50 pt-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); onDetail(r) }} className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 py-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400 active:scale-95">자세히</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onExcel(r) }} title="엑셀(CSV) 다운로드" className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-95">엑셀</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 지표 자세히보기 — 시계열(월/분기/연)을 엑셀 표처럼, 전월비·전년비 반영
function IndicatorDetail({ row, onClose, onExcel, onOpenChart }: { row: Row; onClose: () => void; onExcel: (r: Row) => void; onOpenChart: (cat: string) => void }) {
  const [series, setSeries] = useState<{ date: string; value: number }[] | null>(null)
  const [gran, setGran] = useState<"month" | "quarter" | "year">("month")
  const [win, setWin] = useState("전체")

  useEffect(() => { indicatorSeries(row.indicator).then(setSeries).catch(() => setSeries([])) }, [row.indicator])

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

  const label = (k: string) => (gran === "year" ? k + "년" : gran === "quarter" ? k.replace("-", " ") : k.slice(0, 4) + "." + Number(k.slice(5)) + "월")
  const pct = (x: number | null) => (x == null ? "—" : (x >= 0 ? "+" : "") + x.toFixed(1) + "%")
  const gname: Record<string, string> = { month: "월별", quarter: "분기별", year: "연도별" }
  const u = inferUnit(row.indicator, row.label || "")
  const chartData = useMemo(() => table.slice().reverse().map((t) => ({ k: t.k, v: t.v })), [table]) // 차트는 시간순(과거→최신)
  const canOpen = NAV_IDS.has(row.cat)
  // 페이지 차트(LineChart)와 동일 포맷 — 라벨은 파서 호환 컴팩트('YY / YY.Qn / YY.M)
  const chLabels = chartData.map((d) => (gran === "year" ? "'" + d.k.slice(2) : gran === "quarter" ? d.k.split("-")[0].slice(2) + "." + d.k.split("-")[1] : d.k.slice(2, 4) + "." + Number(d.k.slice(5))))
  const chSeries = [{ name: row.label || row.indicator, color: "#4f46e5", data: chartData.map((d) => d.v), w: 2, endLabel: "" }]
  const chDec = Math.abs(chartData[chartData.length - 1]?.v ?? 0) < 20 ? 1 : 0
  const chUnit = u.suffix || (u.prefix ? " " + u.prefix : u.unit && u.unit !== "값" ? " " + u.unit : "") // 툴팁 단위

  if (typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6" onClick={onClose} style={{ animation: "bkFade .2s ease both" }}>
      <div className="relative flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ animation: "detModalIn .38s cubic-bezier(.22,1,.36,1) both", willChange: "transform, opacity" }}>
        <span className={"absolute inset-y-0 left-0 z-10 w-1 " + (row.confidence === "FORECAST" ? "bg-amber-500" : "bg-indigo-500")} />
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-3 top-3 z-10 rounded-full bg-white/90 dark:bg-gray-900/90 p-1.5 text-gray-500 dark:text-gray-400 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:text-gray-900 dark:hover:text-gray-50 active:scale-95"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 pt-6">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{row.catKo}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>{row.source}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="num">{ym(row.mn)}~{ym(row.mx)} ({row.n}관측)</span>
            {row.confidence === "FORECAST" && <span className="ml-1 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-px text-[10px] font-bold text-amber-700 dark:text-amber-300">전망</span>}
          </div>
          <h3 className="mt-2 text-[19px] font-semibold leading-[1.35] tracking-tight text-gray-900 dark:text-gray-50">{row.label || row.indicator}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canOpen && <button type="button" onClick={() => { onOpenChart(row.cat); onClose() }} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-95">경제지표에서 보기 →</button>}
            <button type="button" onClick={() => onExcel(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
              엑셀 다운로드
            </button>
          </div>
          <div className="mt-5">
          {series == null ? (
            <div className="flex h-56 items-center justify-center text-[12.5px] text-gray-400">불러오는 중…</div>
          ) : table.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-[12.5px] text-gray-400">시계열 데이터 없음</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 차트 카드 — 경제지표 페이지와 동일한 LineChart. 토글(Segmented)은 카드에 상주(리마운트 X)해 슬라이드 애니메이션 유지 */}
              <div className="rounded-xl p-3.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <h4 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{row.label || row.indicator}</h4>
                  <span className="shrink-0 text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{gname[gran]} · {u.note}</span>
                  <span className="ml-auto"><Segmented size="sm" value={win} onChange={setWin} options={[{ k: "1Y", label: "1Y" }, { k: "2Y", label: "2Y" }, { k: "5Y", label: "5Y" }, { k: "전체", label: "전체" }]} /></span>
                </div>
                {/* 축 글씨가 넓은 모달에서 과대해지지 않도록 폭 제한 + SVG 텍스트 축소 */}
                <style>{".detchart svg text{font-size:6.8px}"}</style>
                {/* 기간 토글에 맞춰 차트/최신값만 부드럽게 리렌더(카드·토글은 유지) */}
                <div key={"ch-" + win} style={{ animation: "bkFade .4s ease both" }}>
                  <div className="mt-1.5 flex min-h-[26px] flex-wrap items-start gap-x-3 gap-y-1 text-[10.5px]">
                    <Lg c="#4f46e5" t={row.label || row.indicator} b />
                    <span className="ml-auto tabular-nums text-gray-500 dark:text-gray-400">최신 <b className="text-gray-900 dark:text-gray-50">{(u.prefix || "") + fmtVal(chartData[chartData.length - 1]?.v ?? NaN) + (u.suffix || "")}</b></span>
                  </div>
                  <div className="detchart mx-auto" style={{ maxWidth: 560 }}>
                    <LineChart series={chSeries} labels={chLabels} decimals={chDec} unit={chUnit} />
                  </div>
                </div>
                {/* 의미 + LG 인사이트 — 페이지 차트카드와 동일 위치 */}
                <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {(CAT_MI[row.cat] || CAT_MI.etc).mean}</p>
                <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5">
                  <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">LG 인사이트</b> {(CAT_MI[row.cat] || CAT_MI.etc).ai}</p>
                </div>
              </div>
              {/* 엑셀형 표 카드 */}
              <div key={"tb-" + win} className="overflow-hidden rounded-xl" style={{ animation: "bkFade .45s ease .06s both" }}>
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
                  <span className="h-[15px] w-1 rounded bg-emerald-500" />
                  <h4 className="text-[12.5px] font-bold text-gray-900 dark:text-gray-50">시계열 표 <span className="text-[11px] font-semibold text-gray-400">· 전기·전년 대비</span></h4>
                  <button type="button" onClick={() => onExcel(row)} className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 transition-all hover:-translate-y-0.5 active:scale-95">엑셀 ↓</button>
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/90 backdrop-blur"><tr className="text-left text-[10.5px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-2">기간</th><th className="px-3 py-2 text-right">값</th><th className="px-3 py-2 text-right">{gran === "year" ? "전년대비" : gran === "quarter" ? "전분기대비" : "전월대비"}</th>{gran !== "year" && <th className="px-4 py-2 text-right">전년동기대비</th>}
                    </tr></thead>
                    <tbody>
                      {table.map((t) => (
                        <tr key={t.k} className="border-t border-gray-50 dark:border-gray-800/50 transition-colors hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5">
                          <td className="px-4 py-1.5 font-medium text-gray-800 dark:text-gray-100">{label(t.k)}</td>
                          <td className="px-3 py-1.5 text-right font-bold tabular-nums text-gray-900 dark:text-gray-50">{(u.prefix || "") + fmtVal(t.v) + (u.suffix || "")}</td>
                          <td className={"px-3 py-1.5 text-right tabular-nums " + (t.mom == null ? "text-gray-300 dark:text-gray-600" : t.mom >= 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{pct(t.mom)}</td>
                          {gran !== "year" && <td className={"px-4 py-1.5 text-right tabular-nums " + (t.yoy == null ? "text-gray-300 dark:text-gray-600" : t.yoy >= 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{pct(t.yoy)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          </div>
          <p className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">{gname[gran]} 시계열 · 값=기간 말 관측 · 상승 <span className="text-rose-500">적색</span>/하락 <span className="text-emerald-500">녹색</span> · 출처 {row.source}</p>
        </div>
      </div>
    </div>,
    document.body
  )
}

function FCat({ k, ko, n, cat, setCat }: { k: string; ko: string; n: number; cat: string; setCat: (v: string) => void }) {
  const on = cat === k
  // 주요뉴스 제품별 레터박스와 동일 사이즈·디자인·애니메이션(알약 border pill)
  return (
    <button type="button" onClick={() => setCat(k)}
      className={"rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 " + (on ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400")}>
      {ko} <span className={"ml-0.5 text-[10px] tabular-nums " + (on ? "text-indigo-200" : "text-gray-400 dark:text-gray-500")}>{n}</span>
    </button>
  )
}
