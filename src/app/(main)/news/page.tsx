"use client"

import React from "react"
import {
  newsFeed,
  indicatorChips,
  regBoard,
  todayBrief,
  calendarMonth,
  analysisPosts,
  type FeedItem,
  type Chip,
  type RegBoardItem,
} from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 주요뉴스 — 대시보드와 같은 그릇(max-w-1536 · 카드 · 286px 레일)에 담는다.
 *  기사 나열은 금지. 각 행은 제목 · 메타+지표칩 · SO WHAT 3층으로 읽힌다.
 *  규제(Critical/High)는 별도 카드가 아니라 피드 흐름 안에 적색 행으로 끼워 넣는다. */

const TOPICS = ["전체", "거시·금융", "정치·정책", "B2B", "CE·유통", "기상·재난", "에너지·전력"]

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

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
    <span
      onMouseEnter={() => onHover(c.k)}
      onMouseLeave={() => onHover(null)}
      className={
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] leading-4 transition-colors duration-200 " +
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
    </span>
  )
}

export default function Page() {
  const { pick, lang } = useLang()
  const [days, setDays] = React.useState(7)
  const [topic, setTopic] = React.useState("전체")
  const [feed, setFeed] = React.useState<FeedItem[] | null>(null)
  const [chips, setChips] = React.useState<Record<string, Chip>>({})
  const [regs, setRegs] = React.useState<RegBoardItem[]>([])
  const [brief, setBrief] = React.useState<Awaited<ReturnType<typeof todayBrief>>>(null)
  const [events, setEvents] = React.useState<Awaited<ReturnType<typeof calendarMonth>>>([])
  const [posts, setPosts] = React.useState<Awaited<ReturnType<typeof analysisPosts>>>([])
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
    Promise.all([indicatorChips(), regBoard(), todayBrief(), calendarMonth(), analysisPosts(2)])
      .then(([c, r, b, e, p]) => {
        setChips(c)
        setRegs(r)
        setBrief(b)
        setEvents(e.filter((x) => !x.past).slice(0, 4))
        setPosts(p)
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
  const alerts = regs.filter((r) => r.severity === "Critical" || r.severity === "High")
  const pinned = alerts.filter((r) => r.dDay != null && (r.dDay as number) >= 0 && (r.dDay as number) <= 7)
  const rest = alerts.filter((r) => !pinned.includes(r)).slice(0, 3)
  const today = new Date()

  const RegRow = ({ r }: { r: RegBoardItem }) => (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1 rounded-lg border border-red-100 bg-red-50/60 p-3 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-lg hover:shadow-indigo-100"
    >
      <span className="flex flex-wrap items-center gap-1">
        <span className={"rounded px-1 py-px text-[10px] font-bold leading-4 " + (SEV[r.severity] ?? SEV.Medium)}>
          {r.severity}
        </span>
        {r.dDay != null ? (
          <span className="rounded bg-red-600 px-1 py-px text-[10px] font-bold leading-4 text-white">
            {r.dDay <= 0 ? "시행 중" : "시행 D-" + r.dDay}
          </span>
        ) : null}
        <span className="rounded bg-white px-1 py-px text-[10px] font-bold leading-4 text-gray-600">{r.agency}</span>
        <span className="text-[11px] text-gray-500">{r.category}</span>
      </span>
      <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-900 transition-colors duration-200 group-hover:text-indigo-600">
        {pick(r.title, r.titleEn)}
      </p>
      {r.actions ? (
        <p className="line-clamp-1 border-l-2 border-red-500 pl-2 text-[12px] leading-relaxed text-gray-700">
          <b className="font-semibold">ACTION</b> {r.actions.split(" / ")[0]}
        </p>
      ) : null}
    </a>
  )

  return (
    <main className="mx-auto max-w-[1536px] px-4 pb-6 pt-4 sm:px-6 sm:pb-8">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.96)}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}"}</style>

      <header className="mb-3 flex items-end justify-between" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-baseline gap-2">
          <h1 className="text-[20px] font-bold tracking-tight text-gray-900">주요뉴스</h1>
          <span className="num text-[12px] text-gray-500">
            W{weekNo(today)} · {today.getMonth() + 1}/{today.getDate()}
          </span>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200 active:scale-95 " +
                (days === d ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:text-indigo-600")
              }
            >
              {d}일
            </button>
          ))}
        </div>
      </header>

      <div
        className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_286px]"
        style={{ animation: "fadeUp .5s ease both", animationDelay: "0.05s" }}
      >
        {/* ── 좌 : 브리핑 + 피드 카드 ── */}
        <div>
          {brief ? (
            <section className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-shadow duration-300 hover:shadow-md">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-[16px] font-bold tracking-tight text-gray-900">결론 브리핑</span>
                <span className="rounded border border-indigo-200 bg-indigo-50 px-1 py-px text-[10px] font-semibold text-indigo-700">
                  {brief.status === "approved" ? "CONFIRMED" : "AI INTERPRETED"}
                </span>
                <span className="num ml-auto text-[10px] text-gray-500">{brief.asOf} 기준</span>
              </div>
              <ol className="space-y-1.5">
                {(lang === "en" && brief.linesEn ? brief.linesEn : brief.lines).map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="num mt-px text-[11px] font-bold text-indigo-600">{i + 1}</span>
                    <p className="text-[13px] leading-relaxed text-gray-700">
                      {l.text}
                      {l.evidence ? <span className="ml-1 text-[10px] text-gray-500">· {l.evidence}</span> : null}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-shadow duration-300 hover:shadow-md">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[132px_minmax(0,1fr)]">
              {/* 주제 메뉴 */}
              <aside className="lg:border-r lg:border-gray-100 lg:pr-3">
                <nav className="flex flex-wrap gap-0.5 lg:flex-col">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      className={
                        "flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-left text-[12px] transition-all duration-200 active:scale-[0.98] " +
                        (topic === t
                          ? "bg-indigo-50 font-semibold text-indigo-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-indigo-600")
                      }
                    >
                      <span className="truncate">{t}</span>
                      <span className="num text-[10px] text-gray-500">{counts[t] ?? 0}</span>
                    </button>
                  ))}
                </nav>

                <div className="mt-3 hidden border-t border-gray-100 pt-3 lg:block">
                  <p className="mb-1.5 text-[11px] font-bold text-gray-900">규제 알림</p>
                  <div className="flex flex-col gap-1 px-2">
                    <span className="flex items-center justify-between text-[11px] text-gray-600">
                      Critical
                      <span className="num rounded bg-red-100 px-1 font-semibold text-red-700">
                        {regs.filter((r) => r.severity === "Critical").length}
                      </span>
                    </span>
                    <span className="flex items-center justify-between text-[11px] text-gray-600">
                      High
                      <span className="num rounded bg-amber-100 px-1 font-semibold text-amber-700">
                        {regs.filter((r) => r.severity === "High").length}
                      </span>
                    </span>
                  </div>
                </div>
              </aside>

              {/* 피드 */}
              <div className="flex flex-col gap-2">
                {pinned.map((r) => (
                  <RegRow key={"p" + r.id} r={r} />
                ))}

                {feed === null ? (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-[92px] rounded-lg bg-gray-50" />
                    ))}
                  </>
                ) : shown.length === 0 ? (
                  <p className="py-10 text-center text-[12px] text-gray-500">해당 주제 기사 없음</p>
                ) : (
                  shown.map((f, i) => (
                    <React.Fragment key={f.id}>
                      <button
                        type="button"
                        onClick={() => setModal(f)}
                        className="group flex w-full gap-3 rounded-lg bg-gray-50 p-3 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white hover:shadow-lg hover:shadow-indigo-100"
                      >
                        {f.image ? (
                          <div className="hidden h-[70px] w-[104px] shrink-0 overflow-hidden rounded-md bg-gray-100 sm:block">
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
                          <div className="hidden h-[70px] w-[104px] shrink-0 rounded-md bg-gray-100 sm:block" />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[14px] font-medium leading-snug text-gray-900 transition-colors duration-200 group-hover:text-indigo-600">
                            {pick(f.title, f.titleEn)}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-1">
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

                          <p className="mt-1.5 border-l-2 border-indigo-500 pl-2 text-[12px] leading-relaxed text-gray-700">
                            <span className="mr-1 text-[10px] font-bold tracking-wider text-indigo-600">SO WHAT</span>
                            {pick(f.ai, f.aiEn)}
                          </p>
                        </div>
                      </button>

                      {i === 2 && rest.length ? <RegRow r={rest[0]} /> : null}
                      {i === 7 && rest.length > 1 ? <RegRow r={rest[1]} /> : null}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* ── 우 레일 : 대시보드와 동일한 286px 카드 스택 ── */}
        <aside className="lg:sticky lg:top-[96px] lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-300 hover:shadow-md">
            <p className="mb-2 text-[16px] font-bold tracking-tight text-gray-900">다가오는 이벤트</p>
            <div className="flex flex-col gap-0.5">
              {events.map((e, i) => (
                <div key={i} className="group flex gap-2.5 rounded-lg px-1 py-1.5 transition-colors duration-200 hover:bg-gray-50">
                  <div className="flex w-9 shrink-0 flex-col items-center justify-center rounded-md bg-emerald-50 py-1 text-emerald-600">
                    <span className="text-[10px] font-bold uppercase leading-none">{MON[Number(e.date.slice(5, 7)) - 1]}</span>
                    <span className="num text-sm font-semibold leading-tight">{Number(e.date.slice(8, 10))}</span>
                  </div>
                  <p className="line-clamp-2 flex-1 text-[12px] leading-snug text-gray-800 transition-colors duration-200 group-hover:text-indigo-600">
                    {(pick(e.event, e.eventEn) as string).split("—")[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-300 hover:shadow-md">
            <p className="mb-2 text-[16px] font-bold tracking-tight text-gray-900">이번 주 칼럼</p>
            <div className="flex flex-col divide-y divide-gray-100">
              {posts.map((p) => (
                <a
                  key={p.id}
                  href="/overview"
                  className="group block py-2 transition-all duration-300 ease-out hover:-translate-y-0.5"
                >
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-gray-800 transition-colors duration-200 group-hover:text-indigo-600">
                    {pick(p.title, p.titleEn)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{p.author ?? "경영기획"}</p>
                </a>
              ))}
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
                <span className="text-[11px] font-semibold text-indigo-600">{modal.topic}</span>
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
    </main>
  )
}
