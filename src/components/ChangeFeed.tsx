"use client"

import React from "react"
import { weekHighlights } from "@/lib/supabase"

/** 금주 핵심 — 원래 "오늘의 변화"였으나 가격 피드로 전락했던 자리.
 *
 *  ■ 왜 바꿨나
 *   하루 창에서는 사실상 가격만 움직인다. 재고·거시·태풍·뉴스는 하루 단위로 변하지 않는다.
 *   그 결과 화면이 "경쟁사 가격 8줄"이 되어, 우리가 매일 봐야 할 다른 축이 전부 밀려났다.
 *
 *  ■ 어떻게 고쳤나
 *   창 = 7일. 종류별 쿼터 = 재고2 · 가격1 · 거시2 · 태풍1 · 뉴스1.
 *   가격이 아무리 많이 움직여도 다른 축의 자리를 잠식하지 못한다. LG 재고는 항상 우선.
 *
 *  ■ 타입 스케일 (BRANDING_GUIDE §6.5) — 10/11/12/14/16/20 밖으로 나가지 않는다.
 */
type Row = Awaited<ReturnType<typeof weekHighlights>>[number]

const DOT: Record<Row["tone"], string> = {
  bad: "bg-rose-500",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  neutral: "bg-gray-300",
}
const KIND: Record<Row["kind"], string> = {
  stock: "재고",
  price: "가격",
  macro: "거시",
  weather: "기상",
  news: "뉴스",
}

/** 모델명이 길어 잘림 — 브랜드+카테고리만 남긴다 */
function trimSubject(s: string) {
  const t = s.replace(/`/g, "").replace(/\s+/g, " ").trim()
  return t.length > 24 ? t.slice(0, 24) + "…" : t
}
const fmtDate = (s?: string | null) =>
  s ? `${s.slice(5, 7)}/${s.slice(8, 10)}` : "—"

export default function ChangeFeed() {
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    weekHighlights(5).then(setRows).catch(() => setErr(true))
  }, [])

  const asOf = rows?.[0]?.asOf ?? null
  const empty = rows !== null && rows.length === 0

  return (
    <section className="h-full rounded-xl border border-gray-200 bg-white p-4">
      <header className="mb-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900">금주 핵심</h2>
          <span className="text-[11px] text-gray-400">최근 7일 · {fmtDate(asOf)} 기준</span>
        </div>
        <a
          href="/competitors"
          className="text-[11px] text-gray-400 transition-colors duration-200 hover:text-indigo-600"
        >
          전체 &gt;
        </a>
      </header>

      {err ? (
        <p className="py-6 text-center text-[12px] text-gray-400">
          데이터를 불러오지 못함 — 확인 필요
        </p>
      ) : empty ? (
        <p className="py-8 text-center text-[12px] text-gray-400">
          특이사항 없음 — 이번 주 변화 0건
        </p>
      ) : (
        <div className="flex flex-col">
          {(rows ?? Array.from({ length: 5 })).map((r, i) =>
            !r ? (
              <div key={i} className="h-[34px] border-b border-gray-50" />
            ) : (
              <div
                key={i}
                className="flex items-baseline gap-2 border-b border-gray-50 py-2 last:border-0"
                style={{ animation: "fadeUp .5s ease both", animationDelay: `${i * 0.05}s` }}
              >
                <span className={"mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full " + DOT[r.tone]} />
                <p className="min-w-0 flex-1 text-[12px] leading-snug text-gray-700">
                  <b className="font-semibold text-gray-900">{trimSubject(r.subject)}</b>{" "}
                  <span className="text-gray-500">{r.detail}</span>
                  {r.source ? <span className="text-gray-400"> · {r.source}</span> : null}
                </p>
                <span className="shrink-0 text-[10px] text-gray-300">{KIND[r.kind]}</span>
              </div>
            ),
          )}
        </div>
      )}

      <p className="mt-2 border-t border-gray-100 pt-2 text-[10px] leading-snug text-gray-400">
        가격·재고·거시·기상·뉴스 각 축에 자리를 배분 — 가격이 다른 축을 밀어내지 않도록 고정
      </p>
    </section>
  )
}
