"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

/** 지역시장 지도 — 원본 디자인 핸드오프(필리핀 17개 지역 인터랙티브 대시보드)를 그대로 임베드.
 *  · 원본 = public/region-map/index.html (마크업·CSS·JS·d3 단일 파일, 딜러 드릴다운·choropleth·KPI 스트립 전 구성 보존).
 *  · d3는 로컬 벤더(public/region-map/vendor/d3.min.js)로 재지정 — 외부 CDN 장애와 무관하게 동작.
 *  · 데이터: public/region-map/data/{ph-regions.geojson, economic.json, headline.json}. 이 파일 교체 시 지도 자동 반영.
 *  · 우리 디자인(DESIGN.md)은 바깥 페이지 셸(헤더 바·카드·모션)에만 적용 — 지도 내부 구성은 원본 별개 유지. */

export default function RegionMapView() {
  // 동적 캐시버스터 — 매 로드 고유 URL로 iframe이 항상 최신 맵을 받도록(정적 ?v 캐시 문제 근본 해결)
  const [cb, setCb] = useState("")
  const [mounted, setMounted] = useState(false)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const { theme, resolvedTheme } = useTheme()
  const dark = ((theme === "system" ? resolvedTheme : theme) === "dark")
  useEffect(() => { setCb("?t=" + Date.now()); setMounted(true) }, [])
  // 테마 토글 시 iframe에 postMessage — 리로드 없이 CSS 변수만 전환(드릴다운 상태 보존)
  useEffect(() => {
    if (!mounted) return
    frameRef.current?.contentWindow?.postMessage({ type: "ax-theme", theme: dark ? "dark" : "light" }, "*")
  }, [dark, mounted])
  return (
    // 풀블리드 — 카드 박스·이중 헤더·개발자 푸터 제거. 지도가 페이지 표면과 하나로 읽히게.
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both" }}>
      {cb ? (
        <iframe
          ref={frameRef}
          src={"/region-map/index.html" + cb + "&theme=" + (dark ? "dark" : "light")}
          title="필리핀 지역시장 인터랙티브 지도"
          className="block w-full border-0"
          style={{ height: "calc(100vh - 108px)", minHeight: 900 }}
          onLoad={() => frameRef.current?.contentWindow?.postMessage({ type: "ax-theme", theme: dark ? "dark" : "light" }, "*")}
        />
      ) : (
        <div className="w-full animate-pulse bg-gray-50 dark:bg-gray-900" style={{ height: "calc(100vh - 108px)", minHeight: 900 }} />
      )}
    </div>
  )
}
