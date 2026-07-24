"use client"

import React from "react"

/** 지역시장 지도 — 원본 디자인 핸드오프(필리핀 17개 지역 인터랙티브 대시보드)를 그대로 임베드.
 *  · 원본 = public/region-map/index.html (마크업·CSS·JS·d3 단일 파일, 딜러 드릴다운·choropleth·KPI 스트립 전 구성 보존).
 *  · d3는 로컬 벤더(public/region-map/vendor/d3.min.js)로 재지정 — 외부 CDN 장애와 무관하게 동작.
 *  · 데이터: public/region-map/data/{ph-regions.geojson, economic.json, headline.json}. 이 파일 교체 시 지도 자동 반영.
 *  · 우리 디자인(DESIGN.md)은 바깥 페이지 셸(헤더 바·카드·모션)에만 적용 — 지도 내부 구성은 원본 별개 유지. */

export default function RegionMapView() {
  return (
    <div className="flex flex-col gap-3">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      <section
        className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md"
        style={{ animation: "fadeUp .5s ease both" }}
      >
        {/* 우리 디자인 셸 헤더(주요뉴스·환율과 동일 어법) */}
        <header className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 px-4 py-2.5">
          <span className="h-[18px] w-1 rounded bg-indigo-500" />
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900">지역시장 지도</h2>
          <span className="text-[11px] font-semibold text-gray-400">필리핀 17개 행정지역 · 셀아웃·경제 choropleth · 클릭 드릴다운</span>
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[9.5px] font-bold text-gray-500">예시 데이터 · 실측 연결 전</span>
        </header>

        {/* 원본 지도 임베드(별개 구성 그대로) — 세로 크게(하단 클립 방지) */}
        <iframe
          src="/region-map/index.html"
          title="필리핀 지역시장 인터랙티브 지도"
          loading="lazy"
          className="block w-full border-0"
          style={{ height: "92vh", minHeight: 860 }}
        />
      </section>

      <p className="text-[11px] leading-relaxed text-gray-400">
        원본 디자인 핸드오프 임베드(별개 구성 보존) · 데이터 교체 위치 =
        <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500">public/region-map/data/</code>
        · Supabase 직접연동은 원본 HTML 상단 <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500">SUPABASE</code> 설정
      </p>
    </div>
  )
}
