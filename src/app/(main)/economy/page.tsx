"use client"

import { useState } from "react"
import DailyIndicators from "@/components/DailyIndicators"
import FxView from "@/components/FxView"
import RegionMapView from "@/components/RegionMapView"
import RegionPriceExtras from "@/components/RegionPriceExtras"
import { ApplianceView, RatesView, GrowthView, LaborView, SentimentView, PricesView } from "@/components/EconViews"
import { useLang } from "@/lib/i18n"

/** 경제지표 — 좌측 카테고리 네비 + 각 도메인 뷰(환율과 동일 레이아웃). 물가 포함 전 카테고리 EconViews로 통일. */

type NavItem = { id: string; ko: string; sub: string; count: string; group: string; accent?: boolean; star?: boolean; subs: string[] }
const NAV: NavItem[] = [
  { id: "regions", ko: "지역시장 지도", sub: "17개 지역 셀아웃·경제 choropleth 지도", count: "17", group: "전국", star: true, subs: ["전국 KPI", "지역별 choropleth", "지역 상세 드릴다운"] },
  { id: "core", ko: "핵심 요약", sub: "일일 지표 + 대표 스코어카드 한 화면", count: "KPI 12", group: "핵심", subs: ["일일 지표 환율·유가·날씨", "대표 지표 스코어카드"] },
  { id: "prices", ko: "물가", sub: "소비자물가 CPI·품목별·지역별 물가", count: "10+지역20", group: "실물경제", subs: ["소비자물가 CPI", "품목별 물가", "지역 물가 히트맵", "실질 지표"] },
  { id: "growth", ko: "국민계정·성장", sub: "GDP·투자·건설·산업생산·가동률", count: "14", group: "실물경제", subs: ["GDP 성장률", "투자·건설허가", "산업생산·가동률"] },
  { id: "labor", ko: "고용·임금·소득", sub: "실업률·최저임금·OFW 송금", count: "11", group: "실물경제", subs: ["실업률", "최저임금", "OFW 송금"] },
  { id: "sentiment", ko: "기업·소비 심리", sub: "소비자심리 CCI·기업심리 BCI", count: "5", group: "실물경제", subs: ["소비자심리 CCI", "기업심리 BCI", "내구재 구매의향"] },
  { id: "fx", ko: "환율·원가", sub: "대달러·실효환율·역내 통화·수입원가", count: "FX", group: "외환·금융", subs: ["동남아 6개국 통화", "₱/USD 기본 환율", "실효환율 NEER·REER", "수입 원가 영향"] },
  { id: "rates", ko: "통화·금리·신용", sub: "기준금리·통화량 M3·가계신용", count: "9", group: "외환·금융", subs: ["기준금리 BSP", "통화량 M3", "가계·카드 대출"] },
  { id: "appliance", ko: "가전 선행지표", sub: "가전 물가·PPI·수입액·실질가격 갭", count: "8", group: "가전 인텔리전스", subs: ["가전 물가·PPI", "가전 실질가격 갭", "수입액"] },
  { id: "market", ko: "가전시장·제품별", sub: "에어컨·냉장고·TV·세탁기 LG점유·ASP·할인갭", count: "1,900+", group: "가전 인텔리전스", accent: true, subs: ["LG 점유·ASP", "제품별 할인갭"] },
  { id: "radar", ko: "사업 레이더", sub: "원가압박·OFW구매력·실질물가·TCO", count: "파생", group: "가전 인텔리전스", star: true, subs: ["원가압박 지수", "실질 구매력·TCO"] },
]

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
  const [active, setActive] = useState("regions")

  function view() {
    if (active === "regions") return <div className="flex flex-col gap-3"><RegionMapView /><RegionPriceExtras /></div>
    if (active === "core") return <DailyIndicators />
    if (active === "fx") return <FxView />
    if (active === "prices") return <PricesView />
    if (active === "growth") return <GrowthView />
    if (active === "labor") return <LaborView />
    if (active === "sentiment") return <SentimentView />
    if (active === "rates") return <RatesView />
    if (active === "appliance") return <ApplianceView />
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
                  {n.group !== NAV[i - 1]?.group && (
                    <p className={"px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400 " + (i === 0 ? "mb-1" : "mb-1 mt-2.5")}>{n.group}</p>
                  )}
                  <button
                    onClick={() => setActive(n.id)}
                    style={{ animation: "fadeUp .4s ease both", animationDelay: (i * 40) + "ms" }}
                    className={
                      "group flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                      (active === n.id ? "bg-indigo-50 ring-1 ring-indigo-100" : "hover:bg-indigo-50/40")
                    }
                  >
                    <span className={"flex-1 text-[13px] " + (active === n.id ? "font-bold text-indigo-700" : "font-semibold text-gray-800 group-hover:text-indigo-600")}>
                      {n.star && <span className="text-amber-500">★ </span>}
                      {n.accent && <span className="text-violet-500">◆ </span>}
                      {n.ko}
                    </span>
                    <span className={"shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums " + (active === n.id ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400")}>{n.count}</span>
                  </button>
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
