"use client"

import React from "react"
import { categoryKpi, homeBand } from "@/lib/supabase"

/** 더 파고들기 — 주제별 진입 카드.
 *  홈 최하단은 '결론'이 아니라 '입구'. 각 카드에 대표 숫자 하나를 얹어
 *  클릭할지 말지 판단할 수 있게 한다. */
type Card = {
  title: string
  href: string
  value: string
  sub: string
  hint?: string
}

export default function EntryCards() {
  const [cards, setCards] = React.useState<Card[] | null>(null)

  React.useEffect(() => {
    Promise.all([categoryKpi(), homeBand()])
      .then(([kpi, band]) => {
        const lgSku = kpi.reduce((a, r) => a + r.lgSku, 0)
        const totSku = kpi.reduce((a, r) => a + r.totalSku, 0)
        const fx = band.find((b) => b.key === "fx")
        const tc = band.find((b) => b.key === "tc")
        setCards([
          {
            title: "경쟁사 가격",
            href: "/competitors",
            value: `${lgSku}`,
            sub: `LG SKU / 전체 ${totSku.toLocaleString()}`,
            hint: "상황판 · 가격대 지도",
          },
          {
            title: "경제지표",
            href: "/economy",
            value: `${fx?.prefix ?? ""}${fx?.value ?? "—"}`,
            sub: `USD/PHP · 전년비 ${fx?.delta?.toFixed(1) ?? "—"}%↑`,
            hint: "30일 추세 차트",
          },
          {
            title: "주요 뉴스",
            href: "/news",
            value: "3열",
            sub: "시장 · CE · B2B",
            hint: "+ 이번 주 분석 칼럼",
          },
          {
            title: "리스크·규제",
            href: "/appendix",
            value: `${tc?.value ?? "—"}`,
            sub: `태풍 · ${tc?.deltaLabel ?? ""} ${tc?.delta ?? "—"}`,
            hint: "DTI·DOE 규제 동향",
          },
        ])
      })
      .catch(() => setCards([]))
  }, [])

  return (
    <section className="animate-[fadeUp_.5s_ease]">
      <header className="mb-2 flex items-baseline gap-2">
        <h2 className="text-[16px] font-bold tracking-tight text-gray-900">더 파고들기</h2>
        <span className="text-[10px] text-gray-400">주제별 상세</span>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {(cards ?? Array.from({ length: 4 })).map((c, i) =>
          !c ? (
            <div key={i} className="h-[76px] rounded-lg border border-gray-100 bg-[#f9fafb]" />
          ) : (
            <a
              key={c.title}
              href={c.href}
              className="group rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-colors duration-200 hover:border-indigo-300"
              style={{ animation: "fadeUp .5s ease both", animationDelay: `${i * 0.05}s` }}
            >
              <p className="flex items-baseline justify-between text-[11px] font-bold text-gray-900">
                {c.title}
                <span className="text-gray-300 transition-colors duration-200 group-hover:text-indigo-600">
                  ›
                </span>
              </p>
              <p className="mt-1 text-[16px] font-bold leading-none tracking-tight text-gray-900">
                {c.value}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-gray-400">{c.sub}</p>
              {c.hint ? (
                <p className="mt-0.5 text-[10px] leading-tight text-gray-300">{c.hint}</p>
              ) : null}
            </a>
          ),
        )}
      </div>
    </section>
  )
}
