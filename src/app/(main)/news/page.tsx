"use client"

import React from "react"
import {
  newsFeed,
  indicatorChips,
  regBoard,
  analysisPosts,
  freshness,
  fmtStamp,
  type FeedItem,
  type Chip,
  type RegBoardItem,
} from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 주요뉴스 — 좌 메뉴 / 피드 / 규제 상시.
 *
 *  ■ 세 종류를 한 그릇에
 *   뉴스 · 규제·정책 · 인사이트는 성격이 다르지만 읽는 방식은 같다 —
 *   리스트에서 고르고, 팝업에서 결론(SO WHAT)부터 읽는다. 그래서 카드·모달을 하나로 통일했다.
 *
 *  ■ 리스트의 역할은 "열 것을 고르는 것"
 *   행은 제목 · SO WHAT 한 줄 · 메타 한 줄까지만. 본문은 모달에서.
 *
 *  ■ 색은 신호가 있을 때만 — 지표칩은 행당 1개, ±1% 이상일 때만 색.
 */

type Kind = "news" | "reg" | "insight"

/** 리스트·모달이 함께 쓰는 표준형 — 셋을 한 모양으로 만든다 */
type Doc = {
  id: string
  kind: Kind
  topic: string
  title: string
  summary: string
  so: string
  source: string
  date: string
  url: string | null
  image: string | null
  chipKeys: string[]
  action?: string | null
  severity?: string | null
  dDay?: number | null
  agency?: string | null
}

type Menu = { key: string; label: string; desc: string }

const MENUS: Menu[] = [
  { key: "전체", label: "전체", desc: "뉴스 · 규제 · 인사이트 전부" },
  { key: "거시·금융", label: "거시·금융", desc: "물가·금리·환율·투자" },
  { key: "정치·정책", label: "정치·정책", desc: "예산·행정명령·정세" },
  { key: "B2B", label: "B2B", desc: "공조·인프라·데이터센터" },
  { key: "CE·유통", label: "CE·유통", desc: "가전 수요·채널·경쟁" },
  { key: "기상·재난", label: "기상·재난", desc: "태풍·폭염 · 냉방 수요" },
  { key: "에너지·전력", label: "에너지·전력", desc: "유가·전기요금·전력수급" },
  { key: "규제·정책", label: "규제·정책", desc: "통관·관세·세무·표준 · 시행일" },
  { key: "인사이트", label: "인사이트", desc: "자체 칼럼 · 외부 큐레이션" },
]

const W: Record<string, number> = {
  "거시·금융": 1.0,
  "에너지·전력": 1.0,
  "CE·유통": 0.95,
  B2B: 0.9,
  "정치·정책": 0.85,
  "기상·재난": 0.8,
  "규제·정책": 1.1,
  인사이트: 0.9,
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

function lead(d: Doc, chips: Record<string, Chip>): Chip | null {
  const arr = d.chipKeys.map((k) => chips[k]).filter(Boolean)
  if (!arr.length) return null
  return [...arr].sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))[0]
}

/** 사진이 없으면 지어내지 않는다 — 저채도 자체 비주얼 */
const ART: Record<string, { c: string; tag: string }> = {
  "거시·금융": { c: "#eef2ff", tag: "MACRO" },
  "정치·정책": { c: "#f1f5f9", tag: "POLICY" },
  B2B: { c: "#eff6ff", tag: "B2B" },
  "CE·유통": { c: "#f5f3ff", tag: "RETAIL" },
  "기상·재난": { c: "#f0fdfa", tag: "WEATHER" },
  "에너지·전력": { c: "#fffbeb", tag: "ENERGY" },
  "규제·정책": { c: "#fef2f2", tag: "REGULATION" },
  인사이트: { c: "#eef2ff", tag: "INSIGHT" },
}

function DocArt({ d, chip, big }: { d: Doc; chip: Chip | null; big?: boolean }) {
  const a = ART[d.topic] ?? { c: "#f8fafc", tag: "NEWS" }
  return (
    <div
      className="flex h-full w-full flex-col justify-between overflow-hidden rounded-md border border-gray-200 p-2.5"
      style={{ backgroundColor: a.c }}
    >
      <span className="text-[9px] font-semibold tracking-widest text-gray-500">{a.tag}</span>
      {d.kind === "reg" ? (
        <span className={"font-semibold leading-tight text-gray-700 " + (big ? "text-[15px]" : "text-[12px]")}>
          {d.dDay == null ? d.agency : d.dDay <= 0 ? "시행 중 · " + d.agency : "시행 D-" + d.dDay}
        </span>
      ) : chip ? (
        <span className={"num font-semibold leading-tight text-gray-700 " + (big ? "text-[15px]" : "text-[12px]")}>
          {chip.label} {chip.unit === "₱" ? "₱" : ""}
          {chip.value ?? "—"}
          {chip.unit && chip.unit !== "₱" ? chip.unit : ""}
        </span>
      ) : (
        <span className={"font-semibold leading-tight text-gray-600 " + (big ? "text-[15px]" : "text-[12px]")}>
          {d.topic}
        </span>
      )}
      <span className="num text-[9px] text-gray-400">{d.date.slice(5).replace("-", "/")}</span>
    </div>
  )
}

/** 요약 한 덩어리를 문단으로 — 벽처럼 붙은 글은 아무도 안 읽는다 */
function para(s: string): string[] {
  if (!s) return []
  const out: string[] = []
  for (const x of s.split(/(?<=\.)\s+/)) {
    const last = out[out.length - 1]
    if (last && (last + x).length < 170) out[out.length - 1] = last + " " + x
    else out.push(x)
  }
  return out
}

export default function Page() {
  const { pick } = useLang()
  const [menu, setMenu] = React.useState("전체")
  const [sort, setSort] = React.useState<"new" | "impact">("new")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [feed, setFeed] = React.useState<FeedItem[] | null>(null)
  const [chips, setChips] = React.useState<Record<string, Chip>>({})
  const [regs, setRegs] = React.useState<RegBoardItem[]>([])
  const [posts, setPosts] = React.useState<Awaited<ReturnType<typeof analysisPosts>>>([])
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [modal, setModal] = React.useState<Doc | null>(null)
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
    Promise.all([indicatorChips(), regBoard(40), analysisPosts(20), freshness()])
      .then(([c, r, p, f]) => {
        setChips(c)
        setRegs(r)
        setPosts(p)
        setStamp(f.news ?? null)
      })
      .catch(() => {})
    newsFeed(0).then(setFeed).catch(() => setFeed([]))
  }, [])

  React.useEffect(() => {
    setPage(1)
  }, [menu, sort, q])

  /** 세 소스를 표준형으로 */
  const newsDocs: Doc[] = React.useMemo(
    () =>
      (feed ?? [])
        .filter((f) => f.ai && f.ai.trim().length > 0)
        .map((f) => ({
          id: "n" + f.id,
          kind: "news" as Kind,
          topic: f.topic,
          title: pick(f.title, f.titleEn) as string,
          summary: pick(f.summary, f.summaryEn) as string,
          so: pick(f.ai, f.aiEn) as string,
          source: f.source,
          date: f.date,
          url: f.url,
          image: f.image,
          chipKeys: f.chipKeys,
        })),
    [feed, pick],
  )

  const regDocs: Doc[] = React.useMemo(
    () =>
      regs.map((r) => ({
        id: "r" + r.id,
        kind: "reg" as Kind,
        topic: "규제·정책",
        title: pick(r.title, r.titleEn) as string,
        summary: pick(r.summary, r.summaryEn) as string,
        so: r.implication ?? "",
        source: r.source,
        date: r.date,
        url: r.url,
        image: null,
        chipKeys: [],
        action: r.actions,
        severity: r.severity,
        dDay: r.dDay,
        agency: r.agency,
      })),
    [regs, pick],
  )

  const insightDocs: Doc[] = React.useMemo(
    () =>
      posts.map((p) => ({
        id: "i" + p.id,
        kind: "insight" as Kind,
        topic: "인사이트",
        title: pick(p.title, p.titleEn) as string,
        summary: (pick(p.summary, p.summaryEn) as string) || (pick(p.dek, p.dekEn) as string) || "",
        so: pick(p.whyMatters, p.whyMattersEn) as string,
        source: p.kind === "own" ? (p.author ?? "경영기획") : p.source,
        date: p.publishedAt,
        url: p.url,
        image: p.kind === "own" ? null : p.image,
        chipKeys: [],
      })),
    [posts, pick],
  )

  const all = React.useMemo(() => [...newsDocs, ...regDocs, ...insightDocs], [newsDocs, regDocs, insightDocs])

  const counts = React.useMemo(() => {
    const m: Record<string, number> = { 전체: all.length }
    for (const d of all) m[d.topic] = (m[d.topic] ?? 0) + 1
    return m
  }, [all])

  const shown = React.useMemo(() => {
    let d = menu === "전체" ? all : all.filter((x) => x.topic === menu)
    const k = q.trim().toLowerCase()
    if (k) d = d.filter((x) => (x.title + " " + x.summary + " " + x.so + " " + x.source).toLowerCase().includes(k))
    if (sort === "impact") {
      const score = (x: Doc) => {
        if (x.kind === "reg") {
          const urgent = x.dDay != null && x.dDay >= 0 && x.dDay <= 14 ? 2 : 1
          const sev = x.severity === "Critical" ? 3 : x.severity === "High" ? 2 : 1
          return (W["규제·정책"] ?? 1) * sev * urgent
        }
        const c = lead(x, chips)
        const mv = Math.min(6, Math.abs(c?.deltaPct ?? 0))
        const decay = 1 / (1 + ageDays(x.date) / 14)
        return (W[x.topic] ?? 0.8) * (1 + mv) * decay
      }
      d = [...d].sort((a, b) => score(b) - score(a))
    } else {
      d = [...d].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    }
    return d
  }, [all, menu, q, sort, chips])

  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const cur = Math.min(page, pages)
  const slice = shown.slice((cur - 1) * PAGE, cur * PAGE)

  const board = React.useMemo(() => {
    const rank = { Critical: 0, High: 1, Medium: 2 } as Record<string, number>
    return [...regDocs].sort((a, b) => {
      const s = (rank[a.severity ?? ""] ?? 9) - (rank[b.severity ?? ""] ?? 9)
      if (s !== 0) return s
      const ad = a.dDay == null ? 9999 : a.dDay < 0 ? 9998 : a.dDay
      const bd = b.dDay == null ? 9999 : b.dDay < 0 ? 9998 : b.dDay
      return ad - bd
    })
  }, [regDocs])

  const today = new Date()
  const active = MENUS.find((m) => m.key === menu)

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
          W{weekNo(today)} · {today.getMonth() + 1}/{today.getDate()} · 뉴스 · 규제·정책 · 인사이트
        </p>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(190px,0.9fr)_minmax(0,3fr)_minmax(250px,1.1fr)]">
        {/* ── 좌 : 메뉴 ── */}
        <aside
          className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-[88px]"
          style={{ animation: "fadeUp .5s ease both", animationDelay: "0.05s" }}
        >
          <div className="px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">주제</p>
            <div className="flex flex-col gap-0.5">
              {MENUS.map((m, i) => (
                <React.Fragment key={m.key}>
                  {i === 7 ? <div className="my-1 border-t border-gray-100" /> : null}
                  <button
                    type="button"
                    onClick={() => setMenu(m.key)}
                    className={
                      "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                      (menu === m.key ? "bg-indigo-50" : "hover:bg-indigo-50/40")
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={
                          "flex-1 text-[13px] transition-colors duration-300 " +
                          (menu === m.key ? "font-semibold text-indigo-700" : "font-medium text-gray-800 group-hover:text-indigo-600")
                        }
                      >
                        {m.label}
                      </span>
                      <span className="num shrink-0 text-[10px] text-gray-400">{counts[m.key] ?? 0}</span>
                    </span>
                    <span className="block text-[11px] leading-snug text-gray-500">{m.desc}</span>
                  </button>
                </React.Fragment>
              ))}
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

          <div key={menu + sort + cur + q} style={{ animation: "viewIn .32s cubic-bezier(.22,1,.36,1) both" }}>
            {feed === null ? (
              <div className="mt-3 flex flex-col gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[104px] rounded-lg bg-gray-50" />
                ))}
              </div>
            ) : slice.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-gray-500">조건에 맞는 항목 없음</p>
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-gray-100">
                {slice.map((d, i) => {
                  const c = lead(d, chips)
                  const isLead = cur === 1 && i === 0
                  return (
                    <div
                      key={d.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setModal(d)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") setModal(d)
                      }}
                      className="group -mx-2 flex cursor-pointer gap-4 rounded-lg px-2 py-3.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-50/40 active:scale-[.997]"
                    >
                      <div
                        className={
                          "shrink-0 overflow-hidden rounded-lg bg-gray-100 " +
                          (isLead ? "hidden h-[176px] w-[280px] sm:block" : "hidden h-[92px] w-[148px] sm:block")
                        }
                      >
                        {d.image ? (
                          <img
                            src={d.image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(ev) => {
                              ev.currentTarget.style.display = "none"
                            }}
                          />
                        ) : (
                          <DocArt d={d} chip={c} big={isLead} />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        {d.kind === "reg" ? (
                          <span className="mb-1 flex flex-wrap items-center gap-1">
                            <span className={"rounded px-1 py-px text-[9px] font-bold leading-4 " + (SEV[d.severity ?? ""] ?? SEV.Medium)}>
                              {d.severity}
                            </span>
                            {d.dDay != null ? (
                              <span
                                className={
                                  "num text-[10px] font-bold " + (d.dDay >= 0 && d.dDay <= 7 ? "text-red-600" : "text-gray-500")
                                }
                              >
                                {d.dDay <= 0 ? "시행 중" : "시행 D-" + d.dDay}
                              </span>
                            ) : null}
                            <span className="text-[10.5px] text-gray-500">{d.agency}</span>
                          </span>
                        ) : null}

                        <p
                          className={
                            "line-clamp-2 font-semibold leading-snug text-gray-900 transition-colors duration-300 group-hover:text-indigo-600 " +
                            (isLead ? "text-[18px]" : "text-[14.5px]")
                          }
                        >
                          {d.title}
                        </p>

                        {isLead ? (
                          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-600">{d.summary}</p>
                        ) : null}

                        {d.so ? (
                          <p className="mt-1 line-clamp-1 text-[12px] leading-relaxed text-gray-600">
                            <span className="mr-1 text-[9.5px] font-bold tracking-wider text-indigo-600">
                              {d.kind === "reg" ? "우리 영향" : d.kind === "insight" ? "왜 중요한가" : "SO WHAT"}
                            </span>
                            {d.so}
                          </p>
                        ) : null}

                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] font-medium text-gray-500">{d.topic}</span>
                          <span className="text-[10.5px] text-gray-300">·</span>
                          <span className="text-[10.5px] text-gray-500">{d.source}</span>
                          <span className="text-[10.5px] text-gray-300">·</span>
                          <span className="num text-[10.5px] text-gray-500">{rel(d.date)}</span>
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

        {/* ── 우 : 규제 동향 상시 (클릭 시 같은 팝업) ── */}
        <aside className="h-fit lg:sticky lg:top-[88px]" style={{ animation: "fadeUp .5s ease both", animationDelay: "0.15s" }}>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
            <button
              type="button"
              onClick={() => setMenu("규제·정책")}
              className="group flex w-full items-baseline justify-between border-b border-gray-100 px-3 py-2.5 text-left transition-colors duration-300 hover:bg-indigo-50/40"
            >
              <p className="text-[14px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
                규제 동향 ›
              </p>
              <span className="num text-[10px] text-gray-500">
                Critical {regDocs.filter((r) => r.severity === "Critical").length} · High{" "}
                {regDocs.filter((r) => r.severity === "High").length}
              </span>
            </button>
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-2">
              {board.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-gray-500">등재된 규제 없음</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {board.slice(0, 12).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setModal(r)}
                      className={
                        "group flex flex-col gap-1 rounded-md border-l-2 bg-white px-2.5 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-50/40 active:scale-[.99] " +
                        (r.severity === "Critical" ? "border-red-500" : r.severity === "High" ? "border-amber-400" : "border-gray-200")
                      }
                    >
                      <span className="flex flex-wrap items-center gap-1">
                        <span className={"rounded px-1 py-px text-[9px] font-bold leading-4 " + (SEV[r.severity ?? ""] ?? SEV.Medium)}>
                          {r.severity}
                        </span>
                        {r.dDay != null ? (
                          <span className={"num text-[9px] font-bold " + (r.dDay >= 0 && r.dDay <= 7 ? "text-red-600" : "text-gray-500")}>
                            {r.dDay <= 0 ? "시행 중" : "D-" + r.dDay}
                          </span>
                        ) : null}
                        <span className="truncate text-[10px] text-gray-500">{r.agency}</span>
                      </span>
                      <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
                        {r.title}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── 팝업 : 뉴스·규제·인사이트 공통 ── */}
      {modal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          style={{ animation: closing ? "backOut .24s ease both" : "backIn .24s ease both" }}
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ animation: closing ? "modalOut .24s cubic-bezier(.4,0,1,1) both" : "modalIn .34s cubic-bezier(.22,1,.36,1) both" }}
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

            <div className="h-[200px] w-full shrink-0 overflow-hidden bg-gray-100">
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
                <DocArt d={modal} chip={lead(modal, chips)} big />
              )}
            </div>

            <div className="overflow-y-auto px-7 pb-7 pt-5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                <span className="font-semibold text-indigo-600">{modal.topic}</span>
                <span className="text-gray-300">·</span>
                <span>{modal.source}</span>
                <span className="text-gray-300">·</span>
                <span className="num">{modal.date}</span>
                {modal.kind === "reg" ? (
                  <>
                    <span className={"ml-1 rounded px-1 py-px text-[10px] font-bold " + (SEV[modal.severity ?? ""] ?? SEV.Medium)}>
                      {modal.severity}
                    </span>
                    {modal.dDay != null ? (
                      <span
                        className={
                          "num rounded px-1 py-px text-[10px] font-bold " +
                          (modal.dDay >= 0 && modal.dDay <= 7 ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600")
                        }
                      >
                        {modal.dDay <= 0 ? "시행 중" : "시행 D-" + modal.dDay}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>

              <h3 className="mt-2 text-[24px] font-bold leading-[1.35] tracking-tight text-gray-900">{modal.title}</h3>

              {modal.so ? (
                <div className="mt-4 rounded-xl border-l-[3px] border-indigo-500 bg-indigo-50/60 px-4 py-3">
                  <p className="text-[10px] font-bold tracking-widest text-indigo-600">
                    {modal.kind === "reg" ? "우리 영향" : modal.kind === "insight" ? "왜 중요한가" : "SO WHAT"}
                  </p>
                  <p className="mt-1 text-[15px] leading-[1.75] text-gray-800">{modal.so}</p>
                </div>
              ) : null}

              <div className="mt-5">
                <p className="text-[10px] font-bold tracking-widest text-gray-400">본문 요약</p>
                <div className="mt-2 space-y-3">
                  {para(modal.summary).map((p, i) => (
                    <p key={i} className="text-[15px] leading-[1.8] text-gray-700">
                      {p}
                    </p>
                  ))}
                </div>
              </div>

              {modal.action ? (
                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[10px] font-bold tracking-widest text-gray-500">ACTION</p>
                  <p className="mt-1 text-[14px] leading-[1.7] text-gray-700">{modal.action}</p>
                </div>
              ) : null}

              {modal.chipKeys.map((k) => chips[k]).filter(Boolean).length ? (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="mb-1.5 text-[10px] font-bold tracking-widest text-gray-400">연결 지표</p>
                  <div className="flex flex-wrap gap-1.5">
                    {modal.chipKeys
                      .map((k) => chips[k])
                      .filter(Boolean)
                      .map((c) => (
                        <ChipPill key={c.k} c={c} />
                      ))}
                  </div>
                </div>
              ) : null}

              {modal.url ? (
                <a
                  href={modal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-95"
                >
                  원문 보기 · {modal.source}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M7 17L17 7M17 7H8M17 7v9" />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
