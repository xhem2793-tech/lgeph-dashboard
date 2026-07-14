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

/** 주요뉴스 — 3분할(주제 / 피드 / 규제 상시).
 *
 *  ■ 리스트의 역할은 "읽는 것"이 아니라 "열 것을 고르는 것"
 *   그래서 행은 제목 · 메타 한 줄 · SO WHAT 한 줄까지만. 본문 요약은 모달에서 읽는다.
 *   첫 기사만 리드 카드(큰 이미지 + 요약 2줄)로 두어 화면에 리듬을 만든다.
 *
 *  ■ 색은 신호가 있을 때만
 *   지표칩은 행당 1개, ±1% 이상 움직였을 때만 색을 준다. 전부 칠하면 아무것도 강조되지 않는다.
 *
 *  ■ 기간 필터는 없앴다 — 페이지가 생긴 이상 창을 좁힐 이유가 없고,
 *   창이 바뀔 때마다 좌측 카운트가 요동쳐 신뢰가 깨졌다. 대신 정렬(최신순/영향도순)을 둔다.
 */

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

/** 영향도 = 토픽 가중 × 지표 변동폭 × 신선도 감쇠. 최신이 곧 중요한 것은 아니다 */
const W: Record<string, number> = {
  "거시·금융": 1.0,
  "에너지·전력": 1.0,
  "CE·유통": 0.95,
  B2B: 0.9,
  "정치·정책": 0.85,
  "기상·재난": 0.8,
}

const PAGE = 20

function ageDays(s: string) {
  const d = new Date(s + "T00:00:00+08:00").getTime()
  const n = new Date()
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  return Math.max(0, Math.round((t - d) / 86400000))
}

function rel(s: string) {
  const a = ageDays(s)
  if (a <= 0) return "오늘"
  if (a === 1) return "어제"
  if (a < 7) return a + "일 전"
  return s.slice(5).replace("-", "/")
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

/** 지표칩 — 색은 ±1% 이상 움직였을 때만. 클릭하면 해당 지표로 이동 */
function ChipPill({ c }: { c: Chip }) {
  const dv = c.deltaPct ?? 0
  const strong = Math.abs(dv) >= 1
  const up = dv > 0
  return (
    <a
      href={"/economy?k=" + c.k}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-1.5 py-px text-[10px] leading-4 text-gray-600 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95"
    >
      <span>{c.label}</span>
      <span className="num font-semibold text-gray-800">
        {c.unit === "₱" ? "₱" : ""}
        {c.value ?? "—"}
        {c.unit && c.unit !== "₱" ? c.unit : ""}
      </span>
      {dv ? (
        <span className={"num font-semibold " + (strong ? (up ? "text-red-600" : "text-emerald-600") : "text-gray-400")}>
          {Math.abs(dv).toFixed(1)}%{up ? "↑" : "↓"}
        </span>
      ) : null}
    </a>
  )
}

/** 대표 지표 1개 — 가장 크게 움직인 것 */
function lead(f: FeedItem, chips: Record<string, Chip>): Chip | null {
  const arr = f.chipKeys.map((k) => chips[k]).filter(Boolean)
  if (!arr.length) return null
  return [...arr].sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))[0]
}

/** 이미지 없는 기사의 대표 비주얼 — 남의 사진을 빌려오지 않는다.
 *  저채도 톤 + 얇은 라벨. 사진과 나란히 놓아도 튀지 않게. */
const ART: Record<string, { c: string; tag: string }> = {
  "거시·금융": { c: "#eef2ff", tag: "MACRO" },
  "정치·정책": { c: "#f1f5f9", tag: "POLICY" },
  B2B: { c: "#eff6ff", tag: "B2B" },
  "CE·유통": { c: "#f5f3ff", tag: "RETAIL" },
  "기상·재난": { c: "#f0fdfa", tag: "WEATHER" },
  "에너지·전력": { c: "#fffbeb", tag: "ENERGY" },
}

function TopicArt({ f, chip, big }: { f: FeedItem; chip: Chip | null; big?: boolean }) {
  const a = ART[f.topic] ?? { c: "#f8fafc", tag: "NEWS" }
  return (
    <div
      className="flex h-full w-full flex-col justify-between overflow-hidden rounded-md border border-gray-200 p-2"
      style={{ backgroundColor: a.c }}
    >
      <span className="text-[9px] font-semibold tracking-widest text-gray-500">{a.tag}</span>
      {chip ? (
        <span className={"num font-semibold leading-tight text-gray-700 " + (big ? "text-[14px]" : "text-[11px]")}>
          {chip.label} {chip.unit === "₱" ? "₱" : ""}
          {chip.value ?? "—"}
          {chip.unit && chip.unit !== "₱" ? chip.unit : ""}
        </span>
      ) : (
        <span className={"font-semibold leading-tight text-gray-600 " + (big ? "text-[14px]" : "text-[11px]")}>
          {f.topic}
        </span>
      )}
      <span className="num text-[9px] text-gray-400">{f.date.slice(5).replace("-", "/")}</span>
    </div>
  )
}

export default function Page() {
  const { pick } = useLang()
  const [topic, setTopic] = React.useState("전체")
  const [sort, setSort] = React.useState<"new" | "impact">("new")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [feed, setFeed] = React.useState<FeedItem[] | null>(null)
  const [chips, setChips] = React.useState<Record<string, Chip>>({})
  const [regs, setRegs] = React.useState<RegBoardItem[]>([])
  const [stamp, setStamp] = React.useState<string | null>(null)
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
    newsFeed(0).then(setFeed).catch(() => setFeed([]))
  }, [])

  React.useEffect(() => {
    setPage(1)
  }, [topic, sort, q])

  const rows = React.useMemo(() => (feed ?? []).filter((f) => f.ai && f.ai.trim().length > 0), [feed])
  const counts = React.useMemo(() => {
    const m: Record<string, number> = { 전체: rows.length }
    for (const r of rows) m[r.topic] = (m[r.topic] ?? 0) + 1
    return m
  }, [rows])

  const shown = React.useMemo(() => {
    let d = topic === "전체" ? rows : rows.filter((r) => r.topic === topic)
    const k = q.trim().toLowerCase()
    if (k) {
      d = d.filter((r) => (r.title + " " + r.summary + " " + r.ai + " " + r.source).toLowerCase().includes(k))
    }
    if (sort === "impact") {
      const score = (f: FeedItem) => {
        const c = lead(f, chips)
        const mv = Math.min(6, Math.abs(c?.deltaPct ?? 0))
        const decay = 1 / (1 + ageDays(f.date) / 14)
        return (W[f.topic] ?? 0.8) * (1 + mv) * decay
      }
      d = [...d].sort((a, b) => score(b) - score(a))
    }
    return d
  }, [rows, topic, q, sort, chips])

  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const cur = Math.min(page, pages)
  const slice = shown.slice((cur - 1) * PAGE, cur * PAGE)

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

  const today = new Date()
  const active = TOPICS.find((t) => t.key === topic)

  const go = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="px-4 py-4 sm:px-6">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.96)}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}"}</style>

      <div style={{ animation: "fadeUp .5s ease both" }}>
        <a href="/news" className="group inline-flex items-baseline gap-1">
          <h1 className="text-[20px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
            주요뉴스
          </h1>
          <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
        </a>
        <p className="num mt-0.5 text-[12px] text-gray-500">
          W{weekNo(today)} · {today.getMonth() + 1}/{today.getDate()} · SO WHAT이 달린 승인 기사만 노출
        </p>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(190px,0.9fr)_minmax(0,3fr)_minmax(250px,1.1fr)]">
        {/* ── 좌 : 주제 ── */}
        <aside
          className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-[88px]"
          style={{ animation: "fadeUp .5s ease both", animationDelay: "0.05s" }}
        >
          <div className="px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">주제</p>
            <div className="flex flex-col gap-0.5">
              {TOPICS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTopic(t.key)}
                  className={
                    "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                    (topic === t.key ? "bg-indigo-50" : "hover:bg-indigo-50/40")
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={
                        "flex-1 text-[13px] transition-colors duration-300 " +
                        (topic === t.key ? "font-semibold text-indigo-700" : "font-medium text-gray-800 group-hover:text-indigo-600")
                      }
                    >
                      {t.label}
                    </span>
                    <span className="num shrink-0 text-[10px] text-gray-400">{counts[t.key] ?? 0}</span>
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
                <span className="num font-semibold text-red-700">{regs.filter((r) => r.severity === "Critical").length}</span>
              </span>
              <span className="flex items-center justify-between text-[12px] text-gray-600">
                High
                <span className="num font-semibold text-amber-700">{regs.filter((r) => r.severity === "High").length}</span>
              </span>
            </div>
          </div>
        </aside>

        {/* ── 중앙 : 피드 ── */}
        <section
          className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-300 hover:shadow-md"
          style={{ animation: "fadeUp .5s ease both", animationDelay: "0.1s" }}
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5 rounded-lg border border-gray-200 p-0.5">
              {([["new", "최신순"], ["impact", "영향도순"]] as const).map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSort(k)}
                  className={
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-300 ease-out active:scale-95 " +
                    (sort === k ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:-translate-y-0.5 hover:text-indigo-600")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="relative min-w-[220px] flex-1">
              <input
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                placeholder="제목·본문·SO WHAT·출처 검색"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 pr-16 text-[12px] outline-none transition-colors duration-300 focus:border-indigo-300"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-[11px] text-gray-400 transition-colors duration-200 hover:text-indigo-600"
                >
                  지우기
                </button>
              ) : null}
            </div>
          </div>

          <div key={topic + sort + cur + q} style={{ animation: "viewIn .32s cubic-bezier(.22,1,.36,1) both" }}>
            {feed === null ? (
              <div className="mt-3 flex flex-col gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[74px] rounded-lg bg-gray-50" />
                ))}
              </div>
            ) : slice.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-gray-500">조건에 맞는 기사 없음</p>
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-gray-100">
                {slice.map((f, i) => {
                  const c = lead(f, chips)
                  const isLead = cur === 1 && i === 0
                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setModal(f)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") setModal(f)
                      }}
                      className="group -mx-2 flex cursor-pointer gap-3 rounded-lg px-2 py-3 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-50/40 active:scale-[.997]"
                    >
                      <div className={"shrink-0 overflow-hidden rounded-md bg-gray-100 " + (isLead ? "hidden h-[128px] w-[208px] sm:block" : "hidden h-[62px] w-[104px] sm:block")}>
                        {f.image ? (
                          <img
                            src={f.image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(ev) => {
                              const el = ev.currentTarget
                              el.style.display = "none"
                            }}
                          />
                        ) : (
                          <TopicArt f={f} chip={c} big={isLead} />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <p
                          className={
                            "line-clamp-2 font-semibold leading-snug text-gray-900 transition-colors duration-300 group-hover:text-indigo-600 " +
                            (isLead ? "text-[18px]" : "text-[14.5px]")
                          }
                        >
                          {pick(f.title, f.titleEn)}
                        </p>

                        {isLead ? (
                          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-600">
                            {pick(f.summary, f.summaryEn)}
                          </p>
                        ) : null}

                        <p className="mt-1 line-clamp-1 text-[12px] leading-relaxed text-gray-600">
                          <span className="mr-1 text-[9.5px] font-bold tracking-wider text-indigo-600">SO WHAT</span>
                          {pick(f.ai, f.aiEn)}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] font-medium text-gray-500">{f.topic}</span>
                          <span className="text-[10.5px] text-gray-300">·</span>
                          <span className="text-[10.5px] text-gray-500">{f.source}</span>
                          <span className="text-[10.5px] text-gray-300">·</span>
                          <span className="num text-[10.5px] text-gray-500">{rel(f.date)}</span>
                          {c ? <ChipPill c={c} /> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {feed && shown.length > PAGE ? (
            <div className="mt-4 flex items-center justify-center gap-1 border-t border-gray-100 pt-3">
              <button
                type="button"
                disabled={cur === 1}
                onClick={() => go(cur - 1)}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                이전
              </button>
              {Array.from({ length: pages })
                .map((_, i) => i + 1)
                .filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 2)
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && p - arr[i - 1] > 1 ? <span className="px-1 text-[11px] text-gray-400">…</span> : null}
                    <button
                      type="button"
                      onClick={() => go(p)}
                      className={
                        "num min-w-[26px] rounded-md px-1.5 py-1 text-[11px] font-medium transition-all duration-300 ease-out active:scale-95 " +
                        (p === cur ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-600")
                      }
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                type="button"
                disabled={cur === pages}
                onClick={() => go(cur + 1)}
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                다음
              </button>
            </div>
          ) : null}
        </section>

        {/* ── 우 : 규제 동향 ── */}
        <aside
          className="h-fit lg:sticky lg:top-[88px]"
          style={{ animation: "fadeUp .5s ease both", animationDelay: "0.15s" }}
        >
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
            <div className="flex items-baseline justify-between border-b border-gray-100 px-3 py-2.5">
              <p className="text-[14px] font-bold tracking-tight text-gray-900">규제 동향</p>
              <span className="num text-[10px] text-gray-500">
                Critical {regs.filter((r) => r.severity === "Critical").length} · High {regs.filter((r) => r.severity === "High").length}
              </span>
            </div>
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-2">
              {regs.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-gray-500">등재된 규제 없음</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {board.map((r) => (
                    <a
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        "group flex flex-col gap-1 rounded-md border-l-2 bg-white px-2.5 py-2 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-50/40 active:scale-[.99] " +
                        (r.severity === "Critical" ? "border-red-500" : r.severity === "High" ? "border-amber-400" : "border-gray-200")
                      }
                    >
                      <span className="flex flex-wrap items-center gap-1">
                        <span className={"rounded px-1 py-px text-[9px] font-bold leading-4 " + (SEV[r.severity] ?? SEV.Medium)}>
                          {r.severity}
                        </span>
                        {r.dDay != null ? (
                          <span
                            className={
                              "num text-[9px] font-bold " +
                              (r.dDay >= 0 && r.dDay <= 7 ? "text-red-600" : "text-gray-500")
                            }
                          >
                            {r.dDay <= 0 ? "시행 중" : "D-" + r.dDay}
                          </span>
                        ) : null}
                        <span className="truncate text-[10px] text-gray-500">{r.agency}</span>
                      </span>
                      <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
                        {pick(r.title, r.titleEn)}
                      </p>
                      {r.actions ? (
                        <p className="line-clamp-1 text-[10px] leading-4 text-gray-500">
                          <b className="font-semibold text-gray-600">ACTION</b> {r.actions.split(" / ")[0]}
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
              className="absolute right-4 top-4 z-10 shrink-0 rounded-full bg-white/80 p-1.5 text-gray-400 backdrop-blur transition-colors duration-300 hover:bg-gray-100 hover:text-gray-700"
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
                    <ChipPill key={c.k} c={c} />
                  ))}
              </span>
              <h3 className="mt-1 text-lg font-bold leading-snug text-gray-900">{pick(modal.title, modal.titleEn)}</h3>
              <p className="num mt-1 text-xs text-gray-500">
                {modal.source} · {modal.date}
              </p>
            </div>

            <div className="mt-4 grid gap-5 md:grid-cols-3">
              <div className="h-[150px] w-full overflow-hidden rounded-xl bg-gray-100 md:col-span-1 md:h-full md:min-h-[150px]">
                {modal.image ? (
                  <img
                    src={modal.image}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(ev) => {
                      ev.currentTarget.style.display = "none"
                    }}
                  />
                ) : (
                  <TopicArt f={modal} chip={lead(modal, chips)} big />
                )}
              </div>
              <div className="min-w-0 md:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">본문 요약</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">{pick(modal.summary, modal.summaryEn)}</p>
              </div>
            </div>

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
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-95"
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
