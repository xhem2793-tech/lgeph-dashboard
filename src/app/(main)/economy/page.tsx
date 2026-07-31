"use client"

import { useEffect, useState } from "react"
import FxView from "@/components/FxView"
import RegionMapView from "@/components/RegionMapView"
import RegionPriceExtras from "@/components/RegionPriceExtras"
import EnergyLabelView from "@/components/EnergyLabelView"
import OnlineMarketView from "@/components/OnlineMarketView"
import WeatherView from "@/components/WeatherView"
import ImportPriceView from "@/components/ImportPriceView"
import HousingView from "@/components/HousingView"
import AllIndicatorsView from "@/components/AllIndicatorsView"
import { ApplianceView, RatesView, GrowthView, LaborView, SentimentView, PricesView } from "@/components/EconViews"
import { Segmented } from "@/components/Segmented"
import { dataProvenance } from "@/lib/supabase"
import { countByCat } from "@/lib/indicatorCats"
import { useLang } from "@/lib/i18n"

/** 경제지표 — 좌측 카테고리 네비 + 각 도메인 뷰(환율과 동일 레이아웃). 물가 포함 전 카테고리 EconViews로 통일. */

type NavItem = { id: string; ko: string; sub: string; count: string; group: string; accent?: boolean; star?: boolean; subs: string[] }
const NAV: NavItem[] = [
  { id: "regions", ko: "지역시장 지도", sub: "17개 지역 셀아웃·경제 choropleth 지도 + 지역 물가", count: "17", group: "전국", star: true, subs: ["전국 KPI", "지역별 choropleth", "지역 상세 드릴다운", "지역 물가 히트맵"] },
  { id: "prices", ko: "물가", sub: "소비자물가 CPI·품목별 물가", count: "10", group: "실물경제", subs: ["소비자물가 CPI", "품목별 물가", "에너지·유가", "실질 지표"] },
  { id: "growth", ko: "국민계정·성장", sub: "GDP·투자·건설·산업생산·가동률", count: "14", group: "실물경제", subs: ["GDP 성장률", "투자·건설허가", "산업생산·가동률"] },
  { id: "labor", ko: "고용·임금·소득", sub: "실업률·최저임금·OFW 송금", count: "11", group: "실물경제", subs: ["실업률", "최저임금", "OFW 송금"] },
  { id: "sentiment", ko: "기업·소비 심리", sub: "소비자심리 CCI·기업심리 BCI·BES 기업경기", count: "11", group: "실물경제", subs: ["소비자심리 CCI", "기업심리 BCI", "내구재 구매의향", "BES 종합·업종·고용", "사업 제약요인"] },
  { id: "housing", ko: "부동산·주택", sub: "주택가격지수 RPPI·건축허가·공실(가전 상관 최고)", count: "4", group: "실물경제", subs: ["주택가격지수 RPPI", "RPPI 상승률", "주거 건축허가", "오피스 공실·건설"] },
  { id: "fx", ko: "환율·원가", sub: "대달러·실효환율·역내 통화·수입원가", count: "7", group: "외환·금융", subs: ["동남아 6개국 통화", "₱/USD 기본 환율", "실효환율 NEER·REER", "수입 원가 영향"] },
  { id: "rates", ko: "통화·금리·신용", sub: "기준금리·통화량 M3·가계신용", count: "9", group: "외환·금융", subs: ["기준금리 BSP", "통화량 M3", "가계·카드 대출"] },
  { id: "appliance", ko: "가전 선행지표", sub: "가전 물가·PPI·수입액·실질가격 갭", count: "8", group: "가전 인텔리전스", subs: ["가전 물가·PPI", "가전 실질가격 갭", "수입액"] },
  { id: "energy", ko: "에너지 라벨", sub: "에어컨·냉장고·TV 브랜드별 에너지효율·별점(DOE)", count: "4", group: "가전 인텔리전스", star: true, subs: ["브랜드별 효율", "5성 비중", "카테고리별"] },
  { id: "importprice", ko: "수입 단가", sub: "가전 수입 단가($/kg)·원산지 점유(Comtrade)", count: "4", group: "가전 인텔리전스", subs: ["냉장고", "에어컨", "세탁기", "TV"] },
  { id: "online", ko: "온라인 시장", sub: "이커머스 규모·디지털/통신 침투", count: "3", group: "소비·디지털", subs: ["이커머스 규모", "디지털 이용", "통신 인프라"] },
  { id: "weather", ko: "날씨·재난", sub: "냉방도일 CDD·기온·태풍·지진", count: "4", group: "환경·리스크", subs: ["냉방도일 CDD", "월평균 기온", "태풍 경보", "지진 활동"] },
]

function Soon({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 text-center">
      <div className="text-[15px] font-bold text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-[13px] text-gray-400 dark:text-gray-500">물가·생활비 템플릿을 이 도메인에도 적용 예정</div>
    </div>
  )
}

export default function Page() {
  const { lang } = useLang()
  const en = lang === "en"
  const [active, setActive] = useState("prices")
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)

  // 사이드바 카테고리 카운트를 실데이터(provenance)에서 실시간 집계
  useEffect(() => {
    dataProvenance().then((rows) => { setCounts(countByCat(rows)); setTotal(rows.length) }).catch(() => {})
  }, [])

  // 딥링크: /economy/?v=<카테고리> 로 진입 시 해당 뷰 활성화
  useEffect(() => {
    if (typeof window === "undefined") return
    const v = new URLSearchParams(window.location.search).get("v")
    if (v && NAV.some((n) => n.id === v)) setActive(v)
  }, [])

  // 지표 기반 카테고리는 실시간 카운트, 구조적 항목(지도·일일동향·온라인)은 고정
  const navCount = (n: NavItem) => (n.id === "all" ? (total ? String(total) : n.count) : counts[n.id] != null ? String(counts[n.id]) : n.count)

  function view() {
    if (active === "all") return <AllIndicatorsView onPick={setActive} />
    if (active === "regions") return <div className="flex flex-col gap-3"><RegionMapView /><RegionPriceExtras /></div>
    if (active === "fx") return <FxView />
    if (active === "energy") return <EnergyLabelView />
    if (active === "online") return <OnlineMarketView />
    if (active === "weather") return <WeatherView />
    if (active === "importprice") return <ImportPriceView />
    if (active === "housing") return <HousingView />
    if (active === "prices") return <PricesView />
    if (active === "growth") return <GrowthView />
    if (active === "labor") return <LaborView />
    if (active === "sentiment") return <SentimentView />
    if (active === "rates") return <RatesView />
    if (active === "appliance") return <ApplianceView />
    return <Soon label={NAV.find((n) => n.id === active)?.ko ?? ""} />
  }

  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes fadeOnly{from{opacity:0}to{opacity:1}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"}</style>
      <div className="grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-20">
        <aside className="h-fit lg:sticky lg:top-[61px] lg:border-r lg:border-gray-100 lg:dark:border-gray-800/70 lg:pr-6" style={{ animation: "fadeUp .5s ease both" }}>
          <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            <p className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{en ? "View" : "보기"}</p>
            <span className="ml-auto"><Segmented size="sm" value={active === "all" ? "list" : "card"} onChange={(k) => setActive(k === "list" ? "all" : (active === "all" ? "prices" : active))} options={[{ k: "card", label: "카드" }, { k: "list", label: "리스트" }]} /></span>
          </div>
          <div className="px-3 py-3">
            <nav className="flex flex-col gap-0.5">
              {NAV.map((n, i) => (
                <div key={n.id}>
                  {n.group !== NAV[i - 1]?.group && (
                    <p className={"px-1.5 text-[11.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 " + (i === 0 ? "mb-1" : "mb-1 mt-2.5")}>{n.group}</p>
                  )}
                  <button
                    onPointerDown={() => setActive(n.id)}
                    onClick={() => setActive(n.id)}
                    className={
                      "group flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                      (active === n.id ? "bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-100 dark:ring-indigo-500/25" : "hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10")
                    }
                  >
                    <span className={"flex-1 text-[14px] " + (active === n.id ? "font-bold text-indigo-700 dark:text-indigo-300" : "font-semibold text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400")}>
                      {n.ko}
                    </span>
                    <span className="num shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{navCount(n)}</span>
                  </button>
                </div>
              ))}
            </nav>
          </div>
        </aside>
        <div className="min-h-[1200px] min-w-0" style={{ animation: "fadeUp .5s ease both" }}>
          {/* 경쟁사 광고 페이지와 동일: 뷰 전환 시 viewIn */}
          <div key={active} style={{ animation: "viewIn .42s cubic-bezier(.16,1,.3,1) both" }}>{view()}</div>
        </div>
      </div>
    </main>
  )
}
