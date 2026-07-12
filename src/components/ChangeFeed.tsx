"use client"

import React from "react"
import { dailyChanges } from "@/lib/supabase"

/** 오늘의 변화 — 매일 실제로 바뀐 것만.
 *
 *  이 위젯이 홈 상단에 있는 이유:
 *  구조 지표(선반점유·ASP·프리미엄)는 6일간 0.3~0.8%p밖에 안 움직인다.
 *  매일 열어도 어제와 같은 화면이면 사람은 안 열게 된다.
 *  → 홈의 명당은 '진짜 매일 바뀌는 것'이 가져야 한다.
 *
 *  변화가 없으면 "특이사항 없음"을 그대로 쓴다. 억지로 채우지 않는다.
 */
type Row = Awaited<ReturnType<typeof dailyChanges>>[number]

const DOT: Record<Row["tone"], string> = {
  bad: "bg-rose-500",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  neutral: "bg-gray-300",
}
const KIND: Record<Row["kind"], string> = {
  price: "가격",
  stock: "재고",
  weather: "기상",
  news: "뉴스",
}

/** 모델명이 길어 잘림 — 브랜드+카테고리+모델코드만 남긴다 */
function trimSubject(s: string) {
  const t = s.replace(/`/g, "").replace(/\s+/g, " ").trim()
  return t.length > 42 ? t.slice(0, 42) + "…" : t
}
const fmtDate = (s?: string | null) =>
  s ? `${s.slice(5, 7)}/${s.slice(8, 10)}` : "—"

export default function ChangeFeed() {
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    dailyChanges(8).then(setRows).catch(() => setErr(true))
  }, [])

  const asOf = rows?.[0]?.asOf ?? null
  const empty = rows !== null && rows.length === 0

  return (
    <section className="h-full rounded-xl border border-gray-200 bg-white p-4">
      <header className="mb-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-bold tracking-tight text-gray-900">오늘의 변화</h2>
          <span className="text-[10px] text-gray-400">{fmtDate(asOf)}</span>
        </div>
        <span className="text-[10.5px] text-gray-400">
          {rows ? `${rows.length}건` : "…"}
        </span>
      </header>

      {err ? (
        <p className="py-6 text-center text-[12px] text-gray-400">
          변화 데이터를 불러오지 못함 — 확인 필요
        </p>
      ) : empty ? (
        <p className="py-8 text-center text-[12px] text-gray-400">
          특이사항 없음 — 가격 변동 0건
        </p>
      ) : (
        <div className="flex flex-col">
          {(rows ?? Array.from({ length: 4 })).map((r, i) =>
            !r ? (
              <div key={i} className="h-[34px] border-b border-gray-50" />
            ) : (
              <div
                key={i}
                className="flex items-baseline gap-2 border-b border-gray-50 py-[7px] last:border-0"
                style={{ animation: "fadeUp .5s ease both", animationDelay: `${i * 0.05}s` }}
              >
                <span className={"mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full " + DOT[r.tone]} />
                <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-gray-700">
                  <b className="font-semibold text-gray-900">{trimSubject(r.subject)}</b>{" "}
                  <span className="text-gray-500">{r.detail}</span>
                  {r.source ? (
                    <span className="text-gray-400"> · {r.source}</span>
                  ) : null}
                </p>
                <span className="shrink-0 text-[9.5px] text-gray-300">{KIND[r.kind]}</span>
              </div>
            ),
          )}
        </div>
      )}

      <p className="mt-2 border-t border-gray-100 pt-2 text-[9.5px] leading-relaxed text-gray-400">
        변동 없는 날은 “특이사항 없음”을 그대로 표기 — 빈 날의 정직함이 있는 날의 무게를 만듦
      </p>
    </section>
  )
}
