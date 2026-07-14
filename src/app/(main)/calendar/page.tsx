"use client"

import React from "react"
import { calendarEvents, freshness, fmtStamp, type CalEvent } from "@/lib/supabase"

/** 경제캘린더 — 상단 월간 그리드(칸 안에 이벤트 칩) + 하단 표(예측·실제·이전).
 *
 *  애니메이션은 대시보드와 동일: fadeUp .5s ease(진입) · cellIn/rowIn cubic-bezier(.16,1,.3,1) ·
 *  hover는 indigo-600으로 색만 · active:scale로 살짝 눌림.
 */

const CAT: Record<string, { bg: string; fg: string; dot: string }> = {
  정치: { bg: "bg-rose-50", fg: "text-rose-800", dot: "bg-rose-500" },
  금짵: { bg: "bg-blue-50", fg: "text-blue-800", dot: "bg-blue-500" },
  경제: { bg: "bg-emerald-50", fg: "text-emerald-800", dot: "bg-emerald-500" },
  에너지: { bg: "bg-amber-50", fg: "text-amber-800", dot: "bg-amber-500" },
  유통: { bg: "bg-violet-50", fg: "text-violet-800", dot: "bg-violet-500" },
  B2B: { bg: "bg-cyan-50", fg: "text-cyan-800", dot: "bg-cyan-500" },
  날씨: { bg: "bg-sky-50", fg: "text-sky-800", dot: "bg-sky-500" },
  재난: { bg: "bg-sky-50", fg: "text-sky-800", dot: "bg-sky-500" },
  국제: { bg: "bg-gray-100", fg: "text-gray-700", dot: "bg-gray-400" },
  사회: { bg: "bg-gray-100", fg: "text-gray-700", dot: "bg-gray-400" },
  기타: { bg: "bg-gray-100", fg: "text-gray-700", dot: "bg-gray-400" },
}
const tone = (c: string) => CAT[c] ?? CAT["기타"]

const LEGEND = ["정치", "경제", "금융", "에너지", "유통", "B2B"]

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** 제목에서 대시(—) 앞부분만 — 칸 안에는 핵심만 */
const head = (s: string) => s.split(/[—–]/)[0].replace(/\s*\(.*?\)\s*$/, "").trim()

const fmtVal = (v: number | null, unit: string | null) => {
  if (v === null) return "—"
  const u = unit ?? ""
  if (u.includes("%") || u === "percent") return v.toFixed(1) + "%"
  if (u === "PHP/kWh") return "₱" + v.toFixed(2)
  if (u === "PHP/day") return "₱" + v.toFixed(0)
  if (u === "USD bn") return "$" + v.toFixed(2) + "B"
  return String(v)
}

export default function Calendar() {
  const [span, setSpan] = React.useState<"month" | "2w">("month")
  const [rows, setRows] = React.useState<CalEvent[] | null>(null)
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [cat, setCat] = React.useState("전체")
  const [open, setOpen] = React.useState<CalEvent | null>(null)

  const today = React.useMemo(() => new Date(), [])
  const range = React.useMemo(() => {
    if (span === "2w") {
      const s = addDays(today, -today.getDay())
      return { from: s, to: addDays(s, 13) }
    }
    const s = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: s, to: new Date(today.getFullYear(), today.getMonth() + 1, 0) }
  }, [span, today])

  React.useEffect(() => {
    freshness()
      .then((f) => setStamp(f.calendar ?? null))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    setRows(null)
    calendarEvents(iso(range.from), iso(range.to))
      .then(setRows)
      .catch(() => setRows([]))
  }, [range.from, range.to])

  const data = React.useMemo(
    () => (rows ?? []).filter((r) => cat === "전체" || r.category === cat),
    [rows, cat],
  )

  /** 그리드 셀 = 시작주 일요일부터 종료주 토요일까지 */
  const cells = React.useMemo(() => {
    const start = addDays(range.from, -range.from.getDay())
    const end = addDays(range.to, 6 - range.to.getDay())
    const out: Date[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
    return out
  }, [range.from, range.to])

  const byDay = React.useMemo(() => {
    const m: Record<string, CalEvent[]> = {}
    for (const r of data) (m[r.date] ??= []).push(r)
    for (const k of Object.keys(m)) m[k].sort((a, b) => b.importance - a.importance)
    return m
  }, [data])

  const cats = React.useMemo(() => {
    const s = new Set((rows ?? []).map((r) => r.category))
    return ["전체", ...LEGEND.filter((c) => s.has(c)), ...[...s].filter((c) => !LEGEND.includes(c))]
  }, [rows])

  const list = React.useMemo(
    () => [...data].sort((a, b) => b.importance - a.importance || a.date.localeCompare(b.date)),
    [data],
  )

  const crit = data.filter((r) => r.importance >= 3).length
  const monthLabel =
    span === "month"
      ? `${today.getFullYear()}년 ${today.getMonth() + 1}월`
      : `${range.from.getMonth() + 1}/${range.from.getDate()} ~ ${range.to.getMonth() + 1}/${range.to.getDate()}`

  return (
    <div className="mx-auto max-w-[1536px] px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
      <style>{
        "@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
        "@keyframes cellIn{from{opacity:0;transform:translateY(6px) scale(.99)}to{opacity:1;transform:none}}" +
        "@keyframes rowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
        "@keyframes popIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}"
      }</style>

      <div
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        style={{ animation: "fadeUp .5s ease both" }}
      >
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900">{monthLabel}</h2>
            <span className="text-[12px] text-gray-500">
              이벤트 {data.length}건 · Critical {crit}건
            </span>
            <div className="flex overflow-hidden rounded-full border border-gray-200">
              {(["month", "2w"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpan(s)}
                  className={
                    "px-3 py-1 text-[11px] font-medium transition-colors duration-200 active:scale-[.98] " +
                    (span === s
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-500 hover:text-indigo-600")
                  }
                >
                  {s === "month" ? "한 달" : "2주"}
                </button>
              ))}
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
            최종 갱신 {stamp ? fmtStamp(stamp) : "—"}
            <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700">
              CONFIRMED
            </span>
          </span>
        </header>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-all duration-200 hover:-translate-y-px active:scale-[.98] " +
                (cat === c
                  ? "bg-indigo-600 text-white"
                  : "border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600")
              }
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] text-gray-400">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="px-1">{d}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const key = iso(d)
            const inRange = d >= range.from && d <= range.to
            const isToday = key === iso(today)
            const evs = byDay[key] ?? []
            return (
              <div
                key={key}
                className={
                  "min-h-[92px] rounded-lg border p-1.5 transition-colors duration-200 " +
                  (isToday ? "border-indigo-300 bg-indigo-50/30 " : "border-gray-200 ") +
                  (inRange ? "bg-white " : "border-transparent bg-transparent ")
                }
                style={{ animation: "cellIn .32s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 8 + "ms" }}
              >
                {inRange && (
                  <>
                    <div
                      className={
                        "mb-1 text-[11px] " +
                        (isToday ? "font-semibold text-indigo-600" : "text-gray-400")
                      }
                    >
                      {d.getDate()}
                    </div>
                    {evs.slice(0, 3).map((e) => {
                      const t = tone(e.category)
                      return (
                        <button
                          key={e.event}
                          type="button"
                          onClick={() => setOpen(e)}
                          className={
                            "mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[10.5px] leading-snug transition-all duration-200 hover:-translate-y-px active:scale-[.98] " +
                            t.bg + " " + t.fg
                          }
                          title={e.event}
                        >
                          {e.importance >= 3 ? "★ " : ""}
                          {head(e.event)}
                        </button>
                      )
                    })}
                    {evs.length > 3 && (
                      <span className="block px-1 text-[10px] text-gray-400">+{evs.length - 3}건</span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
          {LEGEND.map((c) => (
            <span key={c} className="flex items-center gap-1">
              <span className={"h-1.5 w-1.5 rounded-full " + tone(c).dot} />
              {c}
            </span>
          ))}
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        style={{ animation: "fadeUp .5s ease both", animationDelay: "80ms" }}
      >
        <header className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900">이벤트 목록</h2>
          <span className="text-[11px] text-gray-400">중요도순 · 클릭 시 상세</span>
        </header>

        {rows === null ? (
          <div className="flex min-h-[240px] items-center justify-center text-[13px] text-gray-400">
            불러오는 중
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12.5px]">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-500">
                  <th className="w-[70px] px-2 py-2 text-left">날짜</th>
                  <th className="w-[64px] px-2 py-2 text-left">시간</th>
                  <th className="w-[62px] px-2 py-2 text-left">분류</th>
                  <th className="px-2 py-2 text-left">이벤트</th>
                  <th className="w-[78px] px-2 py-2 text-right">예측</th>
                  <th className="w-[78px] px-2 py-2 text-right">실제</th>
                  <th className="w-[78px] px-2 py-2 text-right">이전</th>
                  <th className="w-[58px] px-2 py-2 text-right">중요도</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => {
                  const t = tone(e.category)
                  const up = e.actual !== null && e.previous !== null && e.actual > e.previous
                  const down = e.actual !== null && e.previous !== null && e.actual < e.previous
                  return (
                    <tr
                      key={e.date + e.event}
                      onClick={() => setOpen(e)}
                      className={
                        "cursor-pointer border-b border-gray-50 transition-colors duration-200 hover:bg-indigo-50/40 " +
                        (e.past ? "opacity-60 hover:opacity-100" : "")
                      }
                      style={{ animation: "rowIn .3s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 14 + "ms" }}
                    >
                      <td className="px-2 py-2 tabular-nums text-gray-500">
                        {e.date.slice(5).replace("-", "/")}
                      </td>
                      <td className="px-2 py-2 text-[11px] text-gray-400">{e.releaseTime ?? "—"}</td>
                      <td className="px-2 py-2">
                        <span className={"rounded px-1.5 py-0.5 text-[10px] font-medium " + t.bg + " " + t.fg}>
                          {e.category}
                        </span>
                      </td>
                      <td className="max-w-0 truncate px-2 py-2 text-gray-900">{e.event}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-400">
                        {e.forecast ?? "—"}
                      </td>
                      <td
                        className={
                          "px-2 py-2 text-right font-semibold tabular-nums " +
                          (up ? "text-rose-600" : down ? "text-emerald-600" : "text-gray-900")
                        }
                      >
                        {fmtVal(e.actual, e.unit)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-500">
                        {fmtVal(e.previous, e.unit)}
                      </td>
                      <td className="px-2 py-2 text-right text-[11px] text-amber-500">
                        {"★".repeat(e.importance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          실제·이전은 자체 수집 지표(macro_indicators)에서 자동 연결 — CPI·실업률·송금·GDP·기준금리·전기요금·최저임금·PPI
          <br />
          예측은 공식 컨센서스가 확보된 건만 표기 — 미확보 시 &quot;—&quot; 유지(추정치 생성 금지)
        </p>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-[640px] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            style={{ animation: "popIn .28s cubic-bezier(.16,1,.3,1) both" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[11.5px] text-gray-500">
              <span className={"rounded px-1.5 py-0.5 font-medium " + tone(open.category).bg + " " + tone(open.category).fg}>
                {open.category}
              </span>
              <span className="tabular-nums">{open.date}</span>
              {open.releaseTime && <span>· {open.releaseTime}</span>}
              <span className="text-amber-500">{"★".repeat(open.importance)}</span>
            </div>
            <p className="mt-3 text-[16px] font-semibold leading-relaxed text-gray-900">{open.event}</p>
            {open.indicatorKey && (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
                <div>
                  <p className="text-[11px] text-gray-500">예측</p>
                  <p className="text-[15px] font-semibold text-gray-400">{open.forecast ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">실제</p>
                  <p className="text-[15px] font-semibold text-gray-900">{fmtVal(open.actual, open.unit)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">이전</p>
                  <p className="text-[15px] font-semibold text-gray-500">{fmtVal(open.previous, open.unit)}</p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="mt-5 w-full rounded-md border border-gray-200 py-2 text-[12.5px] text-gray-600 transition-colors duration-200 hover:border-indigo-300 hover:text-indigo-600 active:scale-[.99]"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
