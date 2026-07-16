"use client"

import React from "react"
import { calendarEvents, freshness, fmtStamp, type CalEvent } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"

/** 경제캘린더 — 좌 그리드(전체 이벤트) + 우 위젯(구성·수요 선행) + 하단 목록.
 *  팝업·애니메이션은 주요뉴스 페일지와 동일(backIn/modalIn, popIn 계열).
 *  캘린더에는 지표 발표 · 정책·규제 · 공휴일만. 규제 클릭 시 원문 상세 노출.
 */

const CAT: Record<string, { bg: string; fg: string; dot: string; band: string }> = {
  경제: { bg: "bg-emerald-50", fg: "text-emerald-800", dot: "bg-emerald-500", band: "bg-emerald-100 text-emerald-900" },
  금융: { bg: "bg-blue-50", fg: "text-blue-800", dot: "bg-blue-500", band: "bg-blue-100 text-blue-900" },
  정치: { bg: "bg-purple-50", fg: "text-purple-800", dot: "bg-purple-500", band: "bg-purple-100 text-purple-900" },
  규제: { bg: "bg-red-50", fg: "text-red-800", dot: "bg-red-500", band: "bg-red-100 text-red-900" },
  에너지: { bg: "bg-amber-50", fg: "text-amber-800", dot: "bg-amber-500", band: "bg-amber-100 text-amber-900" },
  유통: { bg: "bg-violet-50", fg: "text-violet-800", dot: "bg-violet-500", band: "bg-violet-100 text-violet-900" },
  공휴일: { bg: "bg-teal-50", fg: "text-teal-800", dot: "bg-teal-500", band: "bg-teal-100 text-teal-900" },
  기타: { bg: "bg-gray-100", fg: "text-gray-700", dot: "bg-gray-400", band: "bg-gray-100 text-gray-800" },
}
const tone = (c: string) => CAT[c] ?? CAT["기타"]
const LEGEND = ["경제", "금융", "정치", "규제", "에너지", "공휴일"]
const KIND: Record<string, string> = { release: "지표 발표", policy: "정책·규제", holiday: "공휴일" }
const SEV = (i: number) => (i >= 3 ? "Critical" : i === 2 ? "High" : "Medium")
const SEVCLS = (i: number) =>
  i >= 3 ? "bg-red-600 text-white" : i === 2 ? "bg-amber-500 text-white" : "bg-gray-400 text-white"

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0")
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
}
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const dday = (a: string, b: Date) =>
  Math.round((new Date(a + "T00:00:00").getTime() - b.getTime()) / 86400000)
const head = (s: string) => s.split(/[—–]/)[0].replace(/\s*\(.*?\)\s*$/, "").trim()
const para = (s: string | null) =>
  (s ?? "").split(/\n{2,}|(?<=\.)\s{2,}/).map((x) => x.trim()).filter(Boolean)

const fmtVal = (v: number | null, unit: string | null) => {
  if (v === null) return "—"
  const u = unit ?? ""
  if (u.includes("%") || u === "percent") return v.toFixed(1) + "%"
  if (u === "PHP/kWh") return "₱" + v.toFixed(2)
  if (u === "PHP/day") return "₱" + v.toFixed(0)
  if (u === "USD bn") return "$" + v.toFixed(2) + "B"
  return String(v)
}

type Bucket = "past" | "upcoming"

export default function Calendar() {
  const [rows, setRows] = React.useState<CalEvent[] | null>(null)
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [bucket, setBucket] = React.useState<Bucket>("upcoming")
  const [cat, setCat] = React.useState("전체")
  const [month, setMonth] = React.useState(0)
  const [span, setSpan] = React.useState<"2주" | "한달">("2주")
  const [modal, setModal] = React.useState<CalEvent | null>(null)
  const [dayList, setDayList] = React.useState<{ date: string; events: CalEvent[] } | null>(null)
  const [closing, setClosing] = React.useState(false)

  const openEvent = (e: CalEvent) => { setDayList(null); setModal(e) }
  const closeModal = () => {
    setClosing(true)
    window.setTimeout(() => { setModal(null); setDayList(null); setClosing(false) }, 230)
  }

  const today = React.useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])

  const range = React.useMemo(() => {
    if (span === "2주") {
      const sun = addDays(today, -today.getDay() + month * 14)
      return { from: sun, to: addDays(sun, 13) }
    }
    const s = new Date(today.getFullYear(), today.getMonth() + month, 1)
    return { from: s, to: new Date(today.getFullYear(), today.getMonth() + month + 1, 0) }
  }, [today, month, span])

  const week = React.useMemo(() => {
    const s = addDays(today, -today.getDay())
    return { from: iso(s), to: iso(addDays(s, 6)) }
  }, [today])

  React.useEffect(() => {
    freshness().then((f) => setStamp(f.calendar ?? null)).catch(() => {})
  }, [])

  React.useEffect(() => {
    setRows(null)
    calendarEvents(iso(addDays(range.from, -35)), iso(addDays(range.to, 35)))
      .then((r) => setRows(r.filter((x) => x.kind !== "other")))
      .catch(() => setRows([]))
  }, [range.from, range.to])

  const all = rows ?? []
  const inMonth = React.useMemo(
    () => all.filter((r) => r.date >= iso(range.from) && r.date <= iso(range.to)),
    [all, range.from, range.to],
  )
  const cells = React.useMemo(() => {
    const start = addDays(range.from, -range.from.getDay())
    const end = addDays(range.to, 6 - range.to.getDay())
    const out: Date[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
    return out
  }, [range.from, range.to])
  const byDay = React.useMemo(() => {
    const m: Record<string, CalEvent[]> = {}
    for (const r of inMonth) (m[r.date] ??= []).push(r)
    for (const k of Object.keys(m)) m[k].sort((a, b) => b.importance - a.importance)
    return m
  }, [inMonth])
  const inBucket = React.useCallback(
    (r: CalEvent) => {
      if (r.date >= week.from && r.date <= week.to) return "week"
      return r.date < week.from ? "past" : "next"
    },
    [week.from, week.to],
  )
  const list = React.useMemo(() => {
    const f = all.filter((r) => {
      const b = inBucket(r)
      const inSel = bucket === "past" ? b === "past" : b !== "past"
      return inSel && (cat === "전체" || r.category === cat)
    })
    return f.sort((a, b) =>
      bucket === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    )
  }, [all, bucket, cat, inBucket])
  const counts = React.useMemo(() => {
    const c = { past: 0, week: 0, next: 0 }
    for (const r of all) c[inBucket(r) as "past" | "week" | "next"]++
    return { past: c.past, upcoming: c.week + c.next }
  }, [all, inBucket])
  const cats = React.useMemo(() => {
    const s = new Set(all.filter((r) => (bucket === "past" ? inBucket(r) === "past" : inBucket(r) !== "past")).map((r) => r.category))
    const extra = Array.from(s).filter((c) => !LEGEND.includes(c))
    return ["전체", ...LEGEND.filter((c) => s.has(c)), ...extra]
  }, [all, bucket, inBucket])
  const mix = React.useMemo(() => {
    const m: Record<string, number> = { release: 0, policy: 0, holiday: 0 }
    for (const r of inMonth) if (m[r.kind] !== undefined) m[r.kind]++
    return m
  }, [inMonth])
  const triggers = React.useMemo(() => {
    const out: { label: string; date: string; note: string; dot: string }[] = []
    const y = today.getFullYear(), mo = today.getMonth(), dd = today.getDate()
    const end = new Date(y, mo + 1, 0).getDate()
    const nextPay = dd < 15 ? new Date(y, mo, 15) : dd < end ? new Date(y, mo + 1, 0) : new Date(y, mo + 1, 15)
    out.push({ label: "급여일", date: iso(nextPay), note: "오프라인 가전 구매 스파이크", dot: "bg-emerald-500" })
    const sales = ["2026-08-08", "2026-09-09", "2026-10-10", "2026-11-11", "2026-12-12"]
    const ns = sales.find((s) => s >= iso(today))
    if (ns) out.push({ label: "이커머스 대형세일", date: ns, note: ns.slice(5).replace("-", ".") + " 메가세일", dot: "bg-violet-500" })
    const elec = all
      .filter((r) => r.category === "에너지" && (r.event.includes("전기요금") || r.event.includes("Meralco")) && r.date >= iso(today))
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    if (elec) out.push({ label: "전기요금 변동", date: elec.date, note: "냉방가전 사용부담 좌우", dot: "bg-amber-500" })
    return out
  }, [all, today])

  const crit = inMonth.filter((r) => r.importance >= 3).length
  const label =
    span === "2주"
      ? `${range.from.getMonth() + 1}/${range.from.getDate()} – ${range.to.getMonth() + 1}/${range.to.getDate()}`
      : `${range.from.getFullYear()}년 ${range.from.getMonth() + 1}월`

  return (
    <div className="mx-auto max-w-[1536px] px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
      <style>{
        "@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}" +
        "@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
        "@keyframes rowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
        "@keyframes backIn{from{opacity:0}to{opacity:1}}" +
        "@keyframes backOut{from{opacity:1}to{opacity:0}}" +
        "@keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}" +
        "@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.98)}}"
      }</style>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <div
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          style={{ animation: "fadeUp .5s ease both" }}
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMonth((m) => m - 1)}
                  className="rounded-md border border-gray-200 px-2 py-0.5 text-[13px] font-semibold text-gray-500 transition-all duration-300 hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-600 active:scale-95"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setMonth((m) => m + 1)}
                  className="rounded-md border border-gray-200 px-2 py-0.5 text-[13px] font-semibold text-gray-500 transition-all duration-300 hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-600 active:scale-95"
                >
                  ›
                </button>
              </div>
              <h2 className="text-[17px] font-bold tracking-tight text-gray-900">{label}</h2>
              <span className="text-[12px] font-medium text-gray-500">{inMonth.length}건 · Critical {crit}건</span>
              {month !== 0 && (
                <button
                  type="button"
                  onClick={() => setMonth(0)}
                  className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 transition-all duration-300 hover:-translate-y-px active:scale-95"
                >
                  {span === "2주" ? "이번 주" : "이번 달"}
                </button>
              )}
            </div>
            <Segmented
              value={span}
              onChange={(k) => { setSpan(k as "2주" | "한달"); setMonth(0) }}
              options={[{ k: "2주", label: "2주" }, { k: "한달", label: "한달" }]}
              size="sm"
            />
          </header>

          <div className="mt-3 grid grid-cols-7 gap-1.5 text-[11.5px] font-semibold text-gray-400">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d} className="px-1">{d}</div>
            ))}
          </div>

          <div
            key={label}
            className="mt-1.5 grid grid-cols-7 gap-1.5"
            style={{ animation: "viewIn .45s cubic-bezier(.22,1,.36,1) both" }}
          >
            {cells.map((d) => {
              const key = iso(d)
              const on = d >= range.from && d <= range.to
              const isToday = key === iso(today)
              const evs = byDay[key] ?? []
              const holiday = evs.some((e) => e.kind === "holiday")
              return (
                <div
                  key={key}
                  onClick={() => on && evs.length > 0 && setDayList({ date: key, events: evs })}
                  className={
                    (span === "2주" ? "min-h-[150px] " : "h-[118px] ") + "overflow-hidden rounded-lg border p-2 transition-all duration-300 " +
                    (on ? "cursor-pointer bg-white hover:-translate-y-px hover:border-indigo-200 hover:shadow-sm " : "border-transparent bg-transparent ") +
                    (isToday ? "border-indigo-400 bg-indigo-50/40 " : holiday && on ? "border-teal-200 bg-teal-50/40 " : on ? "border-gray-200 " : "")
                  }
                >
                  {on && (
                    <>
                      <div
                        className={
                          "mb-1.5 text-[13px] font-semibold " +
                          (isToday ? "text-indigo-600" : holiday ? "text-teal-600" : d.getDay() === 0 ? "text-rose-500" : "text-gray-700")
                        }
                      >
                        {d.getDate()}
                      </div>
                      {evs.slice(0, span === "2주" ? 6 : 3).map((e) => {
                        const t = tone(e.category)
                        return (
                          <button
                            key={e.event}
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); openEvent(e) }}
                            className={
                              "mb-0.5 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11.5px] font-medium leading-tight text-gray-700 transition-all duration-300 hover:bg-gray-100 active:scale-[.97] "
                            }
                            title={e.event}
                          >
                            <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + t.dot} /><span className="min-w-0 truncate">{e.importance >= 3 ? "★ " : ""}{head(e.event)}</span>
                          </button>
                        )
                      })}
                      {evs.length > (span === "2주" ? 6 : 3) && (
                        <span className="block px-1 text-[10.5px] font-medium text-gray-400">+{evs.length - (span === "2주" ? 6 : 3)}건</span>
                    )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] font-medium text-gray-500">
            {LEGEND.map((c) => (
              <span key={c} className="flex items-center gap-1">
                <span className={"h-1.5 w-1.5 rounded-full " + tone(c).dot} />
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4" style={{ animation: "fadeUp .5s ease both", animationDelay: "80ms" }}>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <header className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
              <h2 className="text-[15px] font-bold tracking-tight text-gray-900">{label} 구성</h2>
              <span className="text-[11px] text-gray-400">최종 갱신 {stamp ? fmtStamp(stamp) : "—"}</span>
            </header>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "release", n: mix.release, c: "text-emerald-700 bg-emerald-50" },
                { k: "policy", n: mix.policy, c: "text-red-700 bg-red-50" },
                { k: "holiday", n: mix.holiday, c: "text-teal-700 bg-teal-50" },
              ].map((x) => (
                <div key={x.k} className={"rounded-lg py-3 " + x.c}>
                  <p className="text-[20px] font-bold tabular-nums">{x.n}</p>
                  <p className="mt-0.5 text-[11px] font-medium">{KIND[x.k]}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
              뉴스성 이벤트는 제외 — 지표 발표 · 정책·규제 시행 · 필리핀 공휴일만 캘린더에 표시
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <header className="flex items-baseline justify-b-between border-b border-gray-100 pb-2.5">
              <h2 className="text-[15px] font-bold tracking-tight text-gray-900">수요 선행</h2>
              <span className="text-[11px] text-gray-400">가전 판매 트리거</span>
            </header>
            <div className="mt-2 flex flex-col">
              {triggers.map((x, i) => {
                const dd = dday(x.date, today)
                return (
                  <div
                    key={x.label}
                    className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-all duration-300 hover:-translate-y-px hover:bg-indigo-50/40"
                    style={{ animation: "rowIn .4s cubic-bezier(.22,1,.36,1) both", animationDelay: 120 + i * 60 + "ms" }}
                  >
                    <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + x.dot} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-gray-900">{x.label}</span>
                      <span className="block text-[10.5px] text-gray-500">{x.note}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[11px] font-semibold text-gray-500">
                      {dd === 0 ? "오늘" : "D-" + dd}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
              캘린더 본문에는 없는 수요 트리거만 별도 표시 — 급여일·세일윈도우·전기요금
            </p>
          </div>
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        style={{ animation: "fadeUp .5s ease both", animationDelay: "140ms" }}
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-bold tracking-tight text-gray-900">이벤트 목록</h2>
            <Segmented size="sm"
              options={[
                { k: "past", label: "지남 " + counts.past },
                { k: "upcoming", label: "예정 " + counts.upcoming },
              ]}
              value={bucket}
              onChange={(k) => { setBucket(k as Bucket); setCat("전체") }}
            />
          </div>
          <span className="text-[11px] text-gray-400">클릭 시 상세</span>
        </header>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={
                "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all duration-300 hover:-translate-y-px active:scale-[.98] " +
                (cat === c ? "bg-indigo-600 text-white" : "border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600")
              }
            >
              {c}
            </button>
          ))}
        </div>

        {rows === null ? (
          <div className="flex min-h-[240px] items-center justify-center text-[13px] text-gray-400">불러오는 중</div>
        ) : list.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center text-[13px] text-gray-400">해당 구간 이벤트 없음</div>
        ) : (
          <div key={bucket + cat} className="mt-2 overflow-x-auto" style={{ animation: "viewIn .4s cubic-bezier(.22,1,.36,1) both" }}>
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-500">
                  <th className="w-[70px] px-2 py-2 text-left">날짜</th>
                  <th className="w-[62px] px-2 py-2 text-left">분류</th>
                  <th className="w-[76px] px-2 py-2 text-left">성격</th>
                  <th className="px-2 py-2 text-left">이벤트</th>
                  <th className="w-[64px] px-2 py-2 text-left">시간</th>
                  <th className="w-[52px] px-2 py-2 text-right">중요도</th>
                  <th className="w-[74px] px-2 py-2 text-right">예측</th>
                  <th className="w-[74px] px-2 py-2 text-right">실제</th>
                  <th className="w-[74px] px-2 py-2 text-right">이전</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => {
                  const t = tone(e.category)
                  const seg = inBucket(e)
                  const showHead = bucket === "upcoming" && (i === 0 || inBucket(list[i - 1]) !== seg)
                  const up = e.actual !== null && e.previous !== null && e.actual > e.previous
                  const down = e.actual !== null && e.previous !== null && e.actual < e.previous
                  return (
                    <React.Fragment key={e.date + e.event}>
                      {showHead && (
                        <tr>
                          <td colSpan={9} className="border-t border-gray-100 bg-gray-50/60 px-2 pb-1.5 pt-2.5 text-[11px] font-bold text-gray-500 first:border-t-0">
                            {seg === "week" ? "이번 주" : "예정"}
                          </td>
                        </tr>
                      )}
                      <tr
                        onClick={() => openEvent(e)}
                        className={
                          "cursor-pointer border-b border-gray-50 transition-colors duration-300 hover:bg-indigo-50/50 " +
                          (bucket === "past" ? "opacity-70 hover:opacity-100" : "")
                        }
                        style={{ animation: "rowIn .4s cubic-bezier(.22,1,.36,1) both", animationDelay: Math.min(i, 14) * 22 + "ms" }}
                      >
                        <td className="h-[44px] px-2 align-middle font-medium tabular-nums text-gray-600">{e.date.slice(5).replace("-", "/")}</td>
                        <td className="h-[44px] px-2 align-middle">
                          <span className={"rounded px-1.5 py-0.5 text-[10.5px] font-semibold " + t.bg + " " + t.fg}>{e.category}</span>
                        </td>
                        <td className="h-[44px] px-2 align-middle text-[11.5px] text-gray-500">{KIND[e.kind] ?? "—"}</td>
                        <td className="max-w-0 truncate h-[44px] px-2 align-middle font-medium text-gray-900">{e.event}</td>
                        <td className="h-[44px] px-2 align-middle text-[11.5px] text-gray-400">{e.releaseTime ?? "—"}</td>
                        <td className="h-[44px] px-2 align-middle text-right text-[11px] text-amber-500">{"★".repeat(e.importance)}</td>
                        <td className="h-[44px] px-2 align-middle text-right tabular-nums text-gray-400">{e.forecast ?? "—"}</td>
                        <td className={"h-[44px] px-2 align-middle text-right font-bold tabular-nums " + (up ? "text-rose-600" : down ? "text-emerald-600" : "text-gray-900")}>{fmtVal(e.actual, e.unit)}</td>
                        <td className="h-[44px] px-2 align-middle text-right tabular-nums text-gray-500">{fmtVal(e.previous, e.unit)}</td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          실제·이전은 자체 수집 지표에서 자동 연결 — CPI·실업률·송금·GDP·기준금리·전기요금·최저임금·PPI
          <br />
          예측은 공식 기관 전망이 확보된 건만 표기 — 미확보 시 &quot;—&quot; 유지(추정치 생성 금지)
        </p>
      </div>

      {(dayList || modal) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          style={{ animation: closing ? "backOut .22s ease both" : "backIn .22s ease both" }}
          onClick={closeModal}
        >
          {modal ? (
            <div
              className="relative flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              style={{ animation: closing ? "modalOut .22s cubic-bezier(.4,0,1,1) both" : "modalIn .34s cubic-bezier(.22,1,.36,1) both" }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                aria-label="닫기"
                className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:text-gray-900 active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <div className="flex w-full shrink-0 items-center gap-2 border-b border-gray-100 px-7 pb-3 pt-6 text-[12px] font-semibold">
                <span className={"h-2 w-2 rounded-full " + tone(modal.category).dot} />
                <span className="text-gray-800">{modal.category}</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">{KIND[modal.kind] || ""}</span>
                {modal.importance >= 2 && (
                  <span className={"ml-auto rounded px-1.5 py-0.5 text-[10.5px] font-bold " + SEVCLS(modal.importance)}>{SEV(modal.importance)}</span>
                )}
              </div>

              <div className="overflow-y-auto px-7 pb-7 pt-5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-gray-500">
                  {modal.sourceLabel && <span className="font-semibold text-indigo-600">{modal.sourceLabel}</span>}
                  {modal.sourceLabel && <span className="text-gray-300">·</span>}
                  <span className="tabular-nums">{modal.date}</span>
                  <span className="text-amber-500">{"★".repeat(modal.importance)}</span>
                </div>

                <h3 className="mt-2 text-[22px] font-bold leading-snug tracking-tight text-gray-900">{modal.event}</h3>

                {modal.indicatorKey && (
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                    <div>
                      <p className="text-[11px] text-gray-500">예측</p>
                      <p className="text-[17px] font-bold text-gray-400">{modal.forecast ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">실제</p>
                      <p className="text-[17px] font-bold text-gray-900">{fmtVal(modal.actual, modal.unit)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">이전</p>
                      <p className="text-[17px] font-bold text-gray-500">{fmtVal(modal.previous, modal.unit)}</p>
                    </div>
                  </div>
                )}

                {modal.summary && (
                  <div className="mt-4 space-y-3">
                    {para(modal.summary).map((p, k) => (
                      <p key={k} className="text-[14px] leading-[1.75] text-gray-700">{p}</p>
                    ))}
                  </div>
                )}

                {modal.implication && (
                  <div className="mt-4 rounded-xl border-l-2 border-indigo-500 bg-indigo-50/50 px-4 py-3">
                    <p className="text-[12px] font-bold text-indigo-700">시사점 · So What</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-gray-800">{modal.implication}</p>
                  </div>
                )}

                {modal.actions && (
                  <div className="mt-3 rounded-xl border-l-2 border-emerald-500 bg-emerald-50/50 px-4 py-3">
                    <p className="text-[12px] font-bold text-emerald-700">대응 · Owner</p>
                    <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-gray-800">{modal.actions}</p>
                  </div>
                )}

                {modal.url && (
                  <a
                    href={modal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 flex items-center justify-center gap-1 rounded-lg bg-gray-900 py-2.5 text-[13px] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-800 active:scale-[.99]"
                  >
                    원문 보기 ↗
                  </a>
                )}
              </div>
            </div>
          ) : dayList ? (
            <div
              className="relative flex max-h-[84vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              style={{ animation: closing ? "modalOut .22s cubic-bezier(.4,0,1,1) both" : "modalIn .34s cubic-bezier(.22,1,.36,1) both" }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex items-baseline justify-between border-b border-gray-100 px-6 pb-3 pt-5">
                <h3 className="text-[16px] font-bold text-gray-900">{dayList.date.slice(5).replace("-", "/")} 일정</h3>
                <span className="text-[11px] text-gray-400">{dayList.events.length}건</span>
              </div>
              <div className="flex flex-col overflow-y-auto px-4 py-2">
                {dayList.events.map((e, i) => {
                  const t = tone(e.category)
                  return (
                    <button
                      key={e.event}
                      type="button"
                      onClick={() => openEvent(e)}
                      className="flex items-start gap-2.5 rounded-lg h-[44px] px-2 align-middle text-left transition-all duration-300 hover:-translate-y-px hover:bg-indigo-50/50 active:scale-[.99]"
                      style={{ animation: "rowIn .35s cubic-bezier(.22,1,.36,1) both", animationDelay: i * 40 + "ms" }}
                    >
                      <span className={"mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold " + t.bg + " " + t.fg}>{e.category}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-snug text-gray-900">{e.importance >= 3 ? "★ " : ""}{e.event}</span>
                        <span className="mt-0.5 block text-[11px] text-gray-500">{KIND[e.kind] ?? "—"}{e.sourceLabel ? " · " + e.sourceLabel : ""}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="m-4 rounded-lg border border-gray-200 py-2 text-[12.5px] font-medium text-gray-600 transition-all duration-300 hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-600 active:scale-[.99]"
              >
                닫기
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
