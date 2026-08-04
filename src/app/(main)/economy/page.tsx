"use client"

import React, { useEffect, useRef, useState } from "react"
import FxView from "@/components/FxView"
import RegionMapView from "@/components/RegionMapView"
import RegionPriceExtras from "@/components/RegionPriceExtras"
import OnlineMarketView from "@/components/OnlineMarketView"
import ImportPriceView from "@/components/ImportPriceView"
import HousingView from "@/components/HousingView"
import AllIndicatorsView from "@/components/AllIndicatorsView"
import { ApplianceView, RatesView, GrowthView, LaborView, SentimentView, PricesView, AgendaCard } from "@/components/EconViews"
import { Segmented } from "@/components/Segmented"
import { dataProvenance } from "@/lib/supabase"
import { countByCat } from "@/lib/indicatorCats"
import { useLang } from "@/lib/i18n"

/** 경제지표 — 좌측 카테고리 네비 + 각 도메인 뷰(환율과 동일 레이아웃). 물가 포함 전 카테고리 EconViews로 통일. */

type NavItem = { id: string; ko: string; sub: string; count: string; group: string; accent?: boolean; star?: boolean; subs: string[] }
const NAV: NavItem[] = [
  { id: "prices", ko: "물가", sub: "소비자물가 CPI·품목별 물가", count: "10", group: "실물경제", subs: ["소비자물가 CPI", "품목별 물가", "에너지·유가", "실질 지표"] },
  { id: "growth", ko: "국민계정·성장", sub: "GDP·투자·건설·산업생산·가동률", count: "14", group: "실물경제", subs: ["GDP 성장률", "투자·건설허가", "산업생산·가동률"] },
  { id: "labor", ko: "고용·임금·소득", sub: "실업률·최저임금·OFW 송금", count: "11", group: "실물경제", subs: ["실업률", "최저임금", "OFW 송금"] },
  { id: "sentiment", ko: "기업·소비 심리", sub: "소비자심리 CCI·기업심리 BCI·BES 기업경기", count: "11", group: "실물경제", subs: ["소비자심리 CCI", "기업심리 BCI", "내구재 구매의향", "BES 종합·업종·고용", "사업 제약요인"] },
  { id: "housing", ko: "부동산·주택", sub: "주택가격지수 RPPI·건축허가·공실(가전 상관 최고)", count: "4", group: "실물경제", subs: ["주택가격지수 RPPI", "RPPI 상승률", "주거 건축허가", "오피스 공실·건설"] },
  { id: "fx", ko: "환율·원가", sub: "대달러·실효환율·역내 통화·수입원가", count: "7", group: "외환·금융", subs: ["동남아 6개국 통화", "₱/USD 기본 환율", "실효환율 NEER·REER", "수입 원가 영향"] },
  { id: "rates", ko: "통화·금리·신용", sub: "기준금리·통화량 M3·가계신용", count: "9", group: "외환·금융", subs: ["기준금리 BSP", "통화량 M3", "가계·카드 대출"] },
  { id: "appliance", ko: "가전 선행지표", sub: "가전 물가·PPI·수입액·실질가격 갭", count: "8", group: "가전 인텔리전스", subs: ["가전 물가·PPI", "가전 실질가격 갭", "수입액"] },
  { id: "importprice", ko: "수입 단가", sub: "가전 수입 단가($/kg)·원산지 점유(Comtrade)", count: "4", group: "가전 인텔리전스", subs: ["냉장고", "에어컨", "세탁기", "TV"] },
  { id: "online", ko: "온라인 시장", sub: "이커머스 규모·디지털/통신 침투", count: "3", group: "소비·디지털", subs: ["이커머스 규모", "디지털 이용", "통신 인프라"] },
  { id: "regions", ko: "지역시장 지도", sub: "17개 지역 셀아웃·경제 choropleth 지도 + 지역 물가", count: "17", group: "지역", star: true, subs: ["전국 KPI", "지역별 choropleth", "지역 상세 드릴다운", "지역 물가 히트맵"] },
]

function Soon({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 text-center">
      <div className="text-[13.5px] font-bold text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-[12px] text-gray-400 dark:text-gray-500">물가·생활비 템플릿을 이 도메인에도 적용 예정</div>
    </div>
  )
}

function viewFor(id: string) {
  if (id === "regions") return <div className="flex flex-col gap-3"><RegionMapView /><RegionPriceExtras /></div>
  if (id === "fx") return <FxView />
  if (id === "online") return <OnlineMarketView />
  if (id === "importprice") return <ImportPriceView />
  if (id === "housing") return <HousingView />
  if (id === "prices") return <PricesView />
  if (id === "growth") return <GrowthView />
  if (id === "labor") return <LaborView />
  if (id === "sentiment") return <SentimentView />
  if (id === "rates") return <RatesView />
  if (id === "appliance") return <ApplianceView />
  return <Soon label={NAV.find((n) => n.id === id)?.ko ?? ""} />
}

export default function Page() {
  const { lang } = useLang()
  const en = lang === "en"
  const [mode, setMode] = useState<"card" | "list">("card")
  const [active, setActive] = useState("prices")   // 스크롤스파이 현재 섹션
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [mounted, setMounted] = useState<Set<string>>(() => new Set(["prices", "growth"]))
  const secRefs = useRef<Record<string, HTMLElement | null>>({})
  const clickLock = useRef(false)

  // 사이드바 카테고리 카운트를 실데이터(provenance)에서 실시간 집계
  useEffect(() => {
    dataProvenance().then((rows) => setCounts(countByCat(rows))).catch(() => {})
  }, [])

  // 근접 섹션 지연 마운트 — 뷰포트 ±600px 진입 시 실제 뷰 렌더(초기 부하↓)
  useEffect(() => {
    if (mode !== "card") return
    const obs = new IntersectionObserver((ents) => {
      let changed = false; const next = new Set<string>()
      ents.forEach((e) => { if (e.isIntersecting) { const id = (e.target as HTMLElement).dataset.sec; if (id) { next.add(id); changed = true } } })
      if (changed) setMounted((prev) => { const s = new Set(prev); next.forEach((id) => s.add(id)); return s })
    }, { rootMargin: "600px 0px 600px 0px" })
    Object.values(secRefs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [mode])

  // 스크롤스파이 — 뷰포트 상단 45% 밴드에 걸린 섹션을 활성으로(좌측 메뉴 동기화)
  useEffect(() => {
    if (mode !== "card") return
    const obs = new IntersectionObserver((ents) => {
      if (clickLock.current) return
      const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      const id = (vis[0]?.target as HTMLElement | undefined)?.dataset.sec
      if (id) setActive(id)
    }, { rootMargin: "-42% 0px -52% 0px", threshold: 0 })
    Object.values(secRefs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [mode])

  // 딥링크: /economy/?v=<카테고리> → 해당 섹션으로 스크롤
  useEffect(() => {
    if (typeof window === "undefined") return
    const v = new URLSearchParams(window.location.search).get("v")
    if (v && NAV.some((n) => n.id === v)) { setMode("card"); requestAnimationFrame(() => go(v)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 지표 기반 카테고리는 실시간 카운트, 구조적 항목은 고정
  const navCount = (n: NavItem) => (counts[n.id] != null ? String(counts[n.id]) : n.count)

  // 좌측 메뉴 클릭 → 섹션으로 스무스 스크롤(마운트 후 재보정)
  function go(id: string) {
    if (mode !== "card") setMode("card")
    setActive(id)
    setMounted((prev) => { const s = new Set(prev); s.add(id); return s })
    clickLock.current = true
    const scroll = () => secRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
    requestAnimationFrame(scroll)
    // 상위 섹션이 뒤늦게 마운트되며 위치가 밀릴 수 있어 두 차례 재보정
    setTimeout(scroll, 260)
    setTimeout(() => { scroll(); clickLock.current = false }, 620)
  }

  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes fadeOnly{from{opacity:0}to{opacity:1}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"}</style>
      <div className={"grid items-start gap-6 lg:gap-7 " + (mode === "card" ? "lg:grid-cols-[270px_minmax(0,1fr)_270px]" : "lg:grid-cols-[270px_minmax(0,1fr)]")}>
        <aside className="h-fit lg:sticky lg:top-[61px] scroll-soft lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-gray-100 lg:dark:border-gray-800/70 lg:pr-6" style={{ animation: "fadeUp .5s ease both" }}>
          <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 bg-white/95 px-2 py-2.5 backdrop-blur dark:bg-gray-950/90">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            <p className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{en ? "View" : "보기"}</p>
            <span className="ml-auto"><Segmented size="sm" value={mode} onChange={(k) => setMode(k as "card" | "list")} options={[{ k: "card", label: "카드" }, { k: "list", label: "리스트" }]} /></span>
          </div>
          <div className="px-2 py-3">
            <nav className="flex flex-col gap-1">
              {NAV.map((n, i) => (
                <React.Fragment key={n.id}>
                  {n.group !== NAV[i - 1]?.group && <p className="px-2.5 pb-1 pt-3.5 text-[11px] font-semibold tracking-wide text-gray-400 dark:text-gray-500 first:pt-1">{n.group}</p>}
                  <button
                    onClick={() => go(n.id)}
                    className={
                      "group relative flex w-full items-center rounded-md px-2.5 py-2 text-left transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 active:scale-[.98] " +
                      (mode === "card" && active === n.id ? "bg-indigo-50/70 dark:bg-indigo-500/10" : "hover:bg-indigo-50 dark:hover:bg-indigo-500/10")
                    }
                  >
                    {mode === "card" && active === n.id && <span className="absolute -left-2 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-indigo-500 dark:bg-indigo-400" />}
                    <span className="flex w-full items-center gap-1.5">
                      <span className={"flex-1 text-[14px] transition-colors " + (mode === "card" && active === n.id ? "font-semibold text-indigo-700 dark:text-indigo-300" : "font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400")}>
                        {n.ko}
                      </span>
                      <span className="num shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{navCount(n)}</span>
                    </span>
                  </button>
                </React.Fragment>
              ))}
            </nav>
          </div>
        </aside>
        <div className="min-h-[1200px] min-w-0" style={{ animation: "fadeUp .5s ease both" }}>
          {mode === "list" ? (
            <div style={{ animation: "viewIn .42s cubic-bezier(.22,1,.36,1) both" }}><AllIndicatorsView onPick={(id) => go(id)} /></div>
          ) : (
            <div className="flex flex-col gap-6">
              {NAV.map((n) => (
                <section
                  key={n.id}
                  id={"sec-" + n.id}
                  data-sec={n.id}
                  ref={(el) => { secRefs.current[n.id] = el }}
                  className="scroll-mt-[76px] rounded-2xl border border-gray-200 dark:border-gray-800/80 bg-white/70 dark:bg-gray-900/25 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5"
                >
                  {/* 카테고리 제목 — 바로 밑 토글과 밀착(간격 축소), 카드로 카테고리 구분 */}
                  <div className="mb-2.5 flex items-baseline gap-2 pb-2">
                    <h2 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{n.ko}</h2>
                    <span className="truncate text-[12px] text-gray-400 dark:text-gray-500">{n.sub}</span>
                  </div>
                  {mounted.has(n.id)
                    ? <div style={{ animation: "viewIn .42s cubic-bezier(.22,1,.36,1) both" }}>{viewFor(n.id)}</div>
                    : <div className="min-h-[360px] rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40" />}
                </section>
              ))}
            </div>
          )}
        </div>

        {/* 우측 경제일정 위젯 — 카드 섹션 모드에서만 sticky 고정(리스트 모드 X) */}
        {mode === "card" && (
          <aside className="hidden lg:block lg:sticky lg:top-[61px] scroll-soft lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-gray-100 lg:dark:border-gray-800/70 lg:pl-6" style={{ animation: "fadeUp .5s ease both" }}>
            <AgendaCard />
          </aside>
        )}
      </div>
    </main>
  )
}
