"use client"

import React from "react"
import { ingestHealth } from "@/lib/supabase"

/** 데이터 신뢰 패널 — 각 소스가 언제 마지막으로 성공했는가.
 *
 *  철학 1원칙("검증 가능한 것만 말한다")의 화면상 구현.
 *  신뢰를 얻는 가장 빠른 길은 **우리 약점을 우리가 먼저 공개하는 것**.
 *
 *  ⚠️ 지연은 그 자체로 결함이 아니다 — BSP 송금은 원래 2~3개월 늦게 발표된다.
 *     정상 발표 지연(expected_lag)을 모르고 경보를 띄우면 양치기 소년이 된다.
 */
type Row = Awaited<ReturnType<typeof ingestHealth>>[number]

const TONE: Record<Row["status"], string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  stale: "text-rose-600",
  dead: "text-rose-600",
}
const LABEL: Record<Row["status"], string> = {
  ok: "정상",
  warn: "주의",
  stale: "지연",
  dead: "중단",
}
const fmt = (s?: string | null) => (s ? s.slice(5).replace("-", "/") : "—")

export default function IngestHealth() {
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    ingestHealth().then(setRows).catch(() => setErr(true))
  }, [])

  const bad = (rows ?? []).filter((r) => r.status !== "ok").length

  return (
    <section className="h-full rounded-lg border border-gray-200 bg-white p-3">
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[12px] font-bold tracking-tight text-gray-900">데이터 신뢰</h3>
        <span className="text-[9px] text-gray-300">
          {rows ? (bad ? `${bad}건 주의` : "전부 정상") : "수집 상태"}
        </span>
      </header>

      {err ? (
        <p className="py-4 text-center text-[10px] text-gray-400">불러오지 못함</p>
      ) : (
        <table className="w-full border-collapse text-[9.5px]">
          <tbody>
            {(rows ?? Array.from({ length: 8 })).map((r, i) =>
              !r ? (
                <tr key={i}>
                  <td className="h-[22px]" />
                </tr>
              ) : (
                <tr key={r.src} className="border-b border-gray-50 last:border-0">
                  <td className="py-[5px] text-gray-600">
                    {r.src}
                    {r.vol ? (
                      <span className="ml-1 text-gray-300">{r.vol.toLocaleString()}건</span>
                    ) : null}
                  </td>
                  <td className={"py-[5px] text-right font-semibold " + TONE[r.status]}>
                    {fmt(r.lastAt)}
                    <span className="ml-1 font-normal">
                      {r.status === "ok" ? "✓" : `· ${LABEL[r.status]}`}
                    </span>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <p className="mt-2 border-t border-gray-100 pt-1.5 text-[8.5px] leading-relaxed text-gray-400">
        정상 발표 지연을 반영 — BSP 송금은 원래 2~3개월 늦음
        <br />
        <b className="font-semibold text-gray-500">약점을 우리가 먼저 공개한다</b>
      </p>
    </section>
  )
}
