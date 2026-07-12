"use client"

import React from "react"
import { briefArchive } from "@/lib/supabase"

/** 지난 7일 브리핑 — 우리가 무엇을 주장했고, 사람이 그것을 승인했는가의 기록.
 *
 *  이 자리의 값어치는 "어제 뭐라고 했더라"가 아니라 **승인 이력**에 있다.
 *  AI 초안(검토 전)과 사람이 승인한 판단(CONFIRMED)이 한 줄에서 구분돼야
 *  "사람이 최종 판단자"(철학 3원칙)가 화면에서 증명된다.
 *
 *  누적형 위젯 — 오늘 1건에서 시작해 매일 한 줄씩 쌓인다. 없는 날을 지어내지 않는다.
 */
type Row = Awaited<ReturnType<typeof briefArchive>>[number]

const WD = ["일", "월", "화", "수", "목", "금", "토"]
const fmt = (s: string) => {
  const d = new Date(s + "T00:00:00")
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`
}

export default function BriefArchive() {
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    briefArchive().then(setRows).catch(() => setErr(true))
  }, [])

  const nApproved = (rows ?? []).filter((r) => r.status === "approved").length

  return (
    <section className="h-full rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900">지난 7일 브리핑</h3>
        <span className="text-[11px] text-gray-400">
          {rows ? `${rows.length}일 · 승인 ${nApproved}` : "…"}
        </span>
      </header>

      {err ? (
        <p className="py-6 text-center text-[12px] text-gray-400">
          아카이브를 불러오지 못함 — 확인 필요
        </p>
      ) : rows && rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-gray-400">
          아직 누적된 브리핑 없음 — 오늘부터 쌓임
        </p>
      ) : (
        <div className="flex flex-col">
          {(rows ?? Array.from({ length: 3 })).map((r, i) =>
            !r ? (
              <div key={i} className="h-[30px] border-b border-gray-50" />
            ) : (
              <div
                key={r.asOf}
                className="flex items-baseline gap-2.5 border-b border-gray-50 py-2 last:border-0"
                style={{ animation: "fadeUp .5s ease both", animationDelay: `${i * 0.05}s` }}
              >
                <span className="w-[52px] shrink-0 text-[11px] tabular-nums text-gray-400">
                  {fmt(r.asOf)}
                </span>
                <span
                  className={
                    "shrink-0 rounded px-1.5 py-px text-[10px] font-bold " +
                    (r.status === "approved"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700")
                  }
                >
                  {r.status === "approved" ? "CONFIRMED" : "검토 전"}
                </span>
                <p className="min-w-0 flex-1 truncate text-[12px] text-gray-700" title={r.head}>
                  {r.head || "—"}
                </p>
                <span className="shrink-0 text-[10px] text-gray-300">{r.nLines}줄</span>
              </div>
            ),
          )}
        </div>
      )}

      <p className="mt-2 border-t border-gray-100 pt-2 text-[10px] leading-snug text-gray-400">
        검토 전 = AI 초안 · CONFIRMED = 담당자 승인 — 승인 없는 판단은 배포하지 않음
      </p>
    </section>
  )
}
