"use client"

import RegionMapView from "@/components/RegionMapView"
import RegionPriceExtras from "@/components/RegionPriceExtras"

/** 필리핀 지역시장 지도 — 경제지표에서 분리한 별도 페이지(우측 위젯 없음).
 *  17개 지역 셀아웃·경제 choropleth + 지역 물가 히트맵. */
export default function RegionsPage() {
  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-3" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
        <RegionMapView />
        <RegionPriceExtras />
      </div>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>
    </main>
  )
}
