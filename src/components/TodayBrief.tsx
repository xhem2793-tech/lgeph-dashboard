"use client"

import React from "react"
import { todayBrief, approveBrief } from "@/lib/supabase"

/** 오늘의 핵심 — 주장 3줄 + 근거 + 이번 주 판단.
 *
 *  ■ 승인 게이트 (철학 3원칙: 사람이 최종 판단자)
 *    'AI · 검토 전' 배지만 달고 승인 버튼이 없으면 원칙은 장식이 된다.
 *    승인할 방법이 없으면 영원히 '검토 전'이다.
 *    draft(앰버) → [승인] → approved(CONFIRMED · 에메랄드)
 *
 *  ■ 매일 '판단'을 만들지 않는다
 *    5일간 가격 변동 40건 — 대부분의 날은 실질 변화가 없다.
 *    매일 판단을 강제하면 없는 판단을 지어내게 된다(양치기 소년).
 *    → 매일 = 변화 감지(핵심 3줄) / 주간 = 액션(이번 주 판단, 주 1회 갱신)
 */
type Brief = NonNullable<Awaited<ReturnType<typeof todayBrief>>>

const fmtDate = (s?: string | null) => (s ? s.slice(5).replace("-", "/") : "—")

export default function TodayBrief() {
  const [b, setB] = React.useState<Brief | null | undefined>(undefined)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    todayBrief()
      .then(setB)
      .catch(() => setB(null))
  }, [])

  async function onApprove() {
    if (!b || busy) return
    setBusy(true)
    setErr(null)
    try {
      await approveBrief(b.asOf, "경영기획")
      setB({ ...b, status: "approved", approvedBy: "경영기획" })
    } catch {
      setErr("승인 실패 — 다시 시도")
    } finally {
      setBusy(false)
    }
  }

  const approved = b?.status === "approved"

  return (
    <section className="flex h-full flex-col rounded-xl border-[1.5px] border-indigo-500 bg-indigo-50/40 p-3.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100">
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900">금주 주요 이슈</h2>
          <span className="text-[10px] text-gray-400">{fmtDate(b?.asOf)}</span>
        </div>

        {b === undefined ? null : approved ? (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[10px] font-bold text-emerald-700">
            CONFIRMED · {b?.approvedBy ?? "승인"}
          </span>
        ) : (
          <button
            type="button"
            onClick={onApprove}
            disabled={busy || !b}
            className="rounded border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-700 transition-colors duration-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
            title="검토 후 승인하면 CONFIRMED로 전환됩니다"
          >
            {busy ? "승인 중…" : "AI · 검토 전 → 승인"}
          </button>
        )}
      </header>

      {b === undefined ? (
        <div className="flex-1 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[24px] rounded bg-white/60" />
          ))}
        </div>
      ) : !b ? (
        <p className="py-6 text-center text-[12px] text-gray-400">
          오늘 초안 없음 — 아직 생성 전
        </p>
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-around gap-1">
            {b.lines.map((l, i) => (
              <div
                key={i}
                className="group relative rounded-lg border border-indigo-100/70 bg-white/70 px-2.5 py-2 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white"
                style={{ animation: "fadeUp .5s ease both", animationDelay: `${i * 0.06}s` }}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold leading-snug text-gray-900">{l.text}</p>
                    {l.evidence ? (
                      <p className="mt-1 text-[11px] text-gray-400">근거 · {l.evidence}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {err ? <p className="mt-1 text-[10px] text-rose-600">{err}</p> : null}

        </>
      )}
    </section>
  )
}
