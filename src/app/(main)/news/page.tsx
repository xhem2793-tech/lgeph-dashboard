"use client"

import React from "react"
import {
  newsFeed,
  indicatorChips,
  regBoard,
  freshness,
  fmtStamp,
  type FeedItem,
  type Chip,
  type RegBoardItem,
} from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 주요뉴스 — 경쟁사 가격 페이지와 같은 뼈대(좌 메뉴판 카드 + 우 콘텐츠 카드).
 *  각 행은 주제배지 · 제목 · 메타+지표칩 · 본문 요약 · SO WHAT 5층.
 *  SO WHAT 없는 기사는 행으로 나가지 않는다. 규제(Critical/High)는 피드 안에 적색 행으로 삽입.
 *  지표칩 클릭 → /economy?k=<key> */

type Topic = { key: string; label: string; desc: string }

const TOPICS: Topic[] = [
  { key: "전체", label: "전체", desc: "SO WHAT이 달린 승인 기사 전부" },
  { key: "거시·금융", label: "거시·금융", desc: "물가·금리·환율·투자" },
  { key: "정치·정책", label: "정치·정책", desc: "규제·예산·행정명령" },
  { key: "B2B", label: "B2B", desc: "공조·인프라·데이터센터" },
  { key: "CE·유통", label: "CE·유통", desc: "가전 수요·채널·경쟁" },
  { key: "기상·재난", label: "기상·재난", desc: "태풍·폭염 · 냉방 수요" },
  { key: "에너지·전력", label: "에너지·전력", desc: "유가·전기요금·전력수급" },
]

/** 기간 — 창을 좁히면 기사가 사라지는 게 아니라 안 보이는 것뿐. 기본 30일, 전체(0)까지 */
const PERIODS = [
  { d: 7, t: "7일" },
  { d: 30, t: "30일" },
  { d: 90, t: "90일" },
  { d: 0, t: "전체" },
]

function rel(s: string) {
  const d = new Date(s + "T00:00:00+08:00").getTime()
  const n = new Date()
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  const diff = Math.round((t - d) / 86400000)
  if (diff <= 0) return "오늘"
  if (diff === 1) return "어제"
  return diff + "일 전"
}

function weekNo(d: Date) {
  const s = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - s.getTime()) / 86400000 + s.getDay() + 1) / 7)
}

const SEV: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-amber-100 text-amber-700",
  Medium: "bg-gray-100 text-gray-600",
}

function ChipPill({ c, on, onHover }: { c: Chip; on: boolean; onHover: (k: string | null) => void }) {
  const up = (c.deltaPct ?? 0) > 0
  const flat = !c.deltaPct
  return (
    <a
      href={"/economy?k=" + c.k}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => onHover(c.k)}
      onMouseLeave={() => onHover(null)}
      className={
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] leading-4 transition-all duration-200 hover:-translate-y-px hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 " +
        (on ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600")
      }
    >
      <span className="font-medium">{c.label}</span>
      <span className="num font-semibold text-gray-900">
        {c.unit === "₱" ? "₱" : ""}
        {c.value ?? "—"}
        {c.unit && c.unit !== "₱" ? c.unit : ""}
      </span>
      {flat ? null : (
        <span className={"num font-semibold " + (up ? "text-red-600" : "text-emerald-600")}>
          {Math.abs(c.deltaPct as number).toFixed(1)}%{up ? "↑" : "↓"}
        </span>
      )}
    </a>
  )
}

export default function Page() {
  const { pick } = useLang()
  const [days, setDays] = React.useState(30)
  const [topic, setTopic] = React.useState("전체")
  const [feed, setFeed] = React.useState<FeedItem[] | null>(null)
  const [chips, setChips] = React.useState<Record<string, Chip>>({})
  const [regs, setRegs] = React.useState<RegBoardItem[]>([])
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [hot, setHot] = React.useState<string | null>(null)
  const [modal, setModal] = React.useState<FeedItem | null>(null)
  const [closing, setClosing] = React.useState(false)

  const closeModal = React.useCallback(() => {
    setClosing(true)
    window.setTimeout(() => {
      setModal(null)
      setClosing(false)
    }, 240)
  }, [])

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeModal()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [closeModal])

  React.useEffect(() => {
    Promise.all([indicatorChips(), regBoard(), freshness()])
      .then(([c, r, f]) => {
        setChips(c)
        setRegs(r)
        setStamp(f.news ?? null)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    setFeed(null)
    newsFeed(days).then(setFeed).catch(() => setFeed([]))
  }, [days])

  const rows = React.useMemo(() => (feed ?? []).filter((f) => f.ai && f.ai.trim().length > 0), [feed])
  const counts = React.useMemo(() => {
    const m: Record<string, number> = { 전체: rows.length }
    for (const r of rows) m[r.topic] = (m[r.topic] ?? 0) + 1
    return m
  }, [rows])

  const shown = topic === "전체" ? rows : rows.filter((r) => r.topic === topic)
  const today = new Date()
  const active = TOPICS.find((t) => t.key === topic)
  /** 우측 패널 — Critical 먼저, 그 안에서 시행 임박순. 놓치면 비용이 되는 것부터 위로 */
  const board = React.useMemo(() => {
    const rank = { Critical: 0, High: 1, Medium: 2 } as Record<string, number>
    return [...regs].sort((a, b) => {
      const s = (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)
      if (s !== 0) return s
      const ad = a.dDay == null ? 9999 : a.dDay < 0 ? 9998 : a.dDay
      const bd = b.dDay == null ? 9999 : b.dDay < 0 ? 9998 : b.dDay
      return ad - bd
    })
  }, [regs])

  return (
    <div className="px-4 py-4 sm:px-6">
      <style>{"@keyframes viewIn{from{opacity:0;transform:translateY(8px) scale(.995)}to{opacity:1;transform:none}}@keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.96)}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}"}</style>

      <a href="/news" className="group inline-flex items-baseline gap-1">
        <h1 className="text-[20px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
          주요뉴스
        </h1>
        <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
      </a>
      <p className="num mt-0.5 text-[12px] text-gray-500">
        W{weekNo(today)} · {today.getMonth() + 1}/{today.getDate()} · SO WHAT이 달린 승인 기사만 노출
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(190px,0.9fr)_minmax(0,3fr)_minmax(260px,1.15fr)]">
        {/* ── 좌 : 메뉴판(경쟁사 가격과 동일 규격) ── */}
        <aside className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">주제</p>
            <div className="flex flex-col gap-0.5">
              {TOPICS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTopic(t.key)}
                  className={
                    "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-200 hover:-translate-y-px active:scale-[.99] " +
                    (topic === t.key ? "bg-indigo-50" : "hover:bg-indigo-50/40")
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={
                        "flex-1 text-[13px] transition-colors duration-200 " +
                        (topic === t.key
                          ? "font-semibold text-indigo-700"
                          : "font-medium text-gray-800 group-hover:text-indigo-600")
                      }
                    >
                      {t.label}
                    </span>
                    <span className="num shrink-0 rounded border border-gray-200 bg-gray-50 px-1 py-px text-[9px] font-semibold text-gray-500">
                      {counts[t.key] ?? 0}
                    </span>
                  </span>
                  <span className="block text-[11px] leading-snug text-gray-500">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">규제 알림</p>
            <div className="flex flex-col gap-1 px-1">
              <span className="flex items-center justify-between text-[12px] text-gray-600">
                Critical
                <span className="num rounded bg-red-100 px-1 font-semibold text-red-700">
                  {regs.filter((r) => r.severity === "Critical").length}
                </span>
              </span>
              <span className="flex items-center justify-between text-[12px] text-gray-600">
                High
                <span className="num rounded bg-amber-100 px-1 font-semibold text-amber-700">
                  {regs.filter((r) => r.severity === "High").length}
                </span>
              </span>
              <span className="mt-1 text-[10px] leading-snug text-gray-400">
                시행 임박순 · 우측 패널에 상시 노출
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100 px-3 py-2.5">
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-gray-200 p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.d}
                  type="button"
                  onClick={() => setDays(p.d)}
                  className={
                    "rounded-md py-1 text-[11px] font-medium transition-all duration-200 active:scale-95 " +
                    (days === p.d ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:text-indigo-600")
                  }
                >
                  {p.t}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── 우 : 피드 카드 ── */}
        <section
          key={topic + days}
          className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          style={{ animation: "viewIn .32s cubic-bezier(.22,1,.36,1) both" }}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-2">
            <h2 className="flex items-baseline gap-2 text-[16px] font-bold tracking-tight text-gray-900">
              {active?.label}
              <span className="num text-[11px] font-medium text-gray-500">{shown.length}건</span>
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
              최종 갱신 {stamp ? fmtStamp(stamp) : "—"}
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700">
                CONFIRMED
              </span>
            </span>
          </header>

          <div className="mt-3 flex flex-col gap-2.5">
            {feed === null ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-[168px] rounded-lg bg-gray-50" />
                ))}
              </>
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-gray-500">해당 주제 기사 없음</p>
            ) : (
              shown.map((f, i) => (
                <React.Fragment key={f.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setModal(f)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") setModal(f)
                    }}
                    className="group flex cursor-pointer gap-4 rounded-lg bg-gray-50 p-3.5 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white hover:shadow-lg hover:shadow-indigo-100"
                  >
                    {f.image ? (
                      <div className="hidden h-[140px] w-[210px] shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:block">
                        <img
                          src={f.image}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(ev) => {
                            const el = ev.currentTarget.parentElement
                            if (el) el.style.visibility = "hidden"
                          }}
                        />
                      </div>
                    ) : (
                      <div className="hidden h-[140px] w-[210px] shrink-0 rounded-lg bg-gray-100 sm:block" />
                    )}

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="rounded bg-indigo-50 px-1.5 py-px text-[10px] font-bold leading-4 text-indigo-700">
                          {f.topic}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {f.source} · {rel(f.date)}
                        </span>
                        {f.chipKeys
                          .map((k) => chips[k])
                          .filter(Boolean)
                          .map((c) => (
                            <ChipPill key={c.k} c={c} on={hot === c.k} onHover={setHot} />
                          ))}
                      </div>

                      <p className="mt-1 line-clamp-2 text-[16px] font-semibold leading-snug text-gray-900 transition-colors duration-200 group-hover:text-indigo-600">
                        {pick(f.title, f.titleEn)}
                      </p>

                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-600">
                        {pick(f.summary, f.summaryEn)}
                      </p>

                      <p className="mt-auto line-clamp-2 border-l-2 border-indigo-500 pl-2 pt-1.5 text-[12px] leading-relaxed text-gray-700">
                        <span className="mr-1 text-[10px] font-bold tracking-wider text-indigo-600">SO WHAT</span>
                        {pick(f.ai, f.aiEn)}
                      </p>
                    </div>
                  </div>

                </React.Fragment>
              ))
            )}
          </div>
        </section>

        {/* ── 우 : 규제·정책 상시 노출 ── */}
        <aside className="h-fit lg:sticky lg:top-[96px]">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-baseline justify-between border-b border-gray-100 px-3 py-2.5">
              <p className="text-[14px] font-bold tracking-tight text-gray-900">규제 동향</p>
              <span className="num text-[10px] text-gray-500">Critical {regs.filter((r) => r.severity === "Critical").length} · High {regs.filter((r) => r.severity === "High").length}</span>
            </div>
            <div className="max-h-[720px] overflow-y-auto p-2">
              {regs.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-gray-500">등재된 규제 없음</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {board.map((r) => (
                    <a
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        "group flex flex-col gap-1 rounded-lg border p-2.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm " +
                        (r.severity === "Critical" ? "border-red-100 bg-red-50/60" : "border-gray-100 bg-gray-50")
                      }
                    >
                      <span className="flex flex-wrap items-center gap-1">
                        <span className={"rounded px-1 py-px text-[9px] font-bold leading-4 " + (SEV[r.severity] ?? SEV.Medium)}>
                          {r.severity}
                        </span>
                        {r.dDay != null ? (
                          <span
                            className={
                              "rounded px-1 py-px text-[9px] font-bold leading-4 " +
                              (r.dDay >= 0 && r.dDay <= 7 ? "bg-red-600 text-white" : "bg-gray-200 text-gray-600")
                            }
                          >
                            {r.dDay <= 0 ? "시행 중" : "D-" + r.dDay}
                          </span>
                        ) : null}
                        <span className="truncate text-[10px] text-gray-500">{r.agency}</span>
                      </span>
                      <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-gray-900 transition-colors duration-200 group-hover:text-indigo-600">
                        {pick(r.title, r.titleEn)}
                      </p>
                      {r.actions ? (
                        <p className="line-clamp-1 text-[10px] leading-4 text-gray-600">
                          <b className="font-semibold text-gray-700">ACTION</b> {r.actions.split(" / ")[0]}
                        </p>
                      ) : null}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          style={{ animation: closing ? "backOut .24s ease both" : "backIn .24s ease both" }}
          onClick={closeModal}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            style={{ animation: closing ? "modalOut .24s cubic-bezier(.4,0,1,1) both" : "modalIn .34s cubic-bezier(.22,1,.36,1) both" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="닫기"
              className="absolute right-4 top-4 z-10 shrink-0 rounded-full bg-white/80 p-1.5 text-gray-400 backdrop-blur transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="min-w-0 pr-8">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-indigo-50 px-1.5 py-px text-[10px] font-bold leading-4 text-indigo-700">{modal.topic}</span>
                {modal.confidence ? (
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700">
                    {modal.confidence}
                  </span>
                ) : null}
                {modal.chipKeys
                  .map((k) => chips[k])
                  .filter(Boolean)
                  .map((c) => (
                    <ChipPill key={c.k} c={c} on={false} onHover={() => {}} />
                  ))}
              </span>
              <h3 className="mt-1 text-lg font-bold leading-snug text-gray-900">{pick(modal.title, modal.titleEn)}</h3>
              <p className="num mt-1 text-xs text-gray-500">
                {modal.source} · {modal.date}
              </p>
            </div>

            {modal.image ? (
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100 md:col-span-1 md:aspect-auto md:h-full md:min-h-[140px]">
                  <img
                    src={modal.image}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(ev) => {
                      const el = ev.currentTarget.parentElement
                      if (el) el.style.display = "none"
                    }}
                  />
                </div>
                <div className="min-w-0 md:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">본문 요약</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-700">{pick(modal.summary, modal.summaryEn)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">본문 요약</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">{pick(modal.summary, modal.summaryEn)}</p>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-indigo-50 p-4">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
                <span className="rounded bg-indigo-600 px-1 text-[10px] text-white">AI</span> SO WHAT
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-700">{pick(modal.ai, modal.aiEn)}</p>
            </div>

            <a
              href={modal.url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700"
            >
              원문 보기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 17L17 7M17 7H8M17 7v9" />
              </svg>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}
