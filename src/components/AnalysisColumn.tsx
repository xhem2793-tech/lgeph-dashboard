"use client"

import React from "react"
import { createPortal } from "react-dom"
import { analysisPosts, regAlerts, type RegAlert } from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 4번째 열 — 위: 규제 동향 1건 / 아래: 이번 주 분석 1건.
 *  규제(통관·관세·세무·표준)는 즉시 비용·리드타임으로 꽂힌다. 뉴스에 섞이면 묻히므로 상단 고정.
 *  두 카드 모두 본문 발췌 노출 — 제목만 보고 넘기는 일을 막는다. 원문 전재 금지(요약·해석·링크만).
 */
type Post = Awaited<ReturnType<typeof analysisPosts>>[number]

const fmt = (s: string) => Number(s.slice(5, 7)) + "/" + Number(s.slice(8, 10))

/** 시행일까지 남은 일수 — 과거면 '시행 중' */
function dday(eff: string | null): { text: string; urgent: boolean } | null {
  if (!eff) return null
  const d = new Date(eff + "T00:00:00+08:00").getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = Math.round((d - today) / 86400000)
  if (diff < 0) return { text: "시행 중", urgent: false }
  if (diff === 0) return { text: "오늘 시행", urgent: true }
  return { text: "시행 D-" + diff, urgent: diff <= 7 }
}

const SEV: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-amber-100 text-amber-700",
  Medium: "bg-gray-100 text-gray-600",
}

/** 자체 칼럼 대표 비주얼 — 사진이 아니라 데이터 */
function OwnVisual({ tags, compact }: { tags: string[]; compact?: boolean }) {
  return (
    <div
      className={
        "flex w-full flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 p-3 " +
        (compact ? "h-[76px]" : "h-full min-h-[180px]")
      }
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">AX 자체 분석</span>
      <div className="flex gap-1">
        {tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-white/15 px-1.5 py-px text-[10px] text-white">
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 본문 마크다운 최소 렌더 */
function MdBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0)
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
      seg.startsWith("**") && seg.endsWith("**") ? (
        <strong key={i} className="font-semibold text-gray-900">{seg.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={i}>{seg}</React.Fragment>
      ),
    )
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        const h = b.match(/^(#{2,4})\s+(.*)$/)
        if (h) {
          return <h4 key={i} className="mt-4 text-[15px] font-semibold text-gray-900">{inline(h[2])}</h4>
        }
        return (
          <p key={i} className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-700">{inline(b)}</p>
        )
      })}
    </div>
  )
}

const SHELL =
  "fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
const CARD = "my-auto w-full max-w-[880px] rounded-2xl bg-white p-5 shadow-2xl"
const ANIM = { animation: "apIn .24s cubic-bezier(.22,1,.36,1) both" }
const CARD_BTN =
  "group flex w-full flex-col overflow-hidden rounded-lg border border-gray-100 p-2.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm"

function useEsc(close: () => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [close])
}

/** 규제 팝업 */
function RegModal({ r, onClose }: { r: RegAlert; onClose: () => void }) {
  const { pick } = useLang()
  useEsc(onClose)
  const dd = dday(r.effectiveDate)

  return createPortal(
    <div className={SHELL} onClick={onClose}>
      <style>{"@keyframes apIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}"}</style>
      <div className={CARD} style={ANIM} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-indigo-50 px-1.5 py-px text-[10px] font-bold text-indigo-700">{r.agency}</span>
            <span className="rounded bg-gray-100 px-1.5 py-px text-[10px] font-bold text-gray-600">{r.category}</span>
            <span className={"rounded px-1.5 py-px text-[10px] font-bold " + (SEV[r.severity] ?? SEV.Medium)}>
              {r.severity}
            </span>
            {dd ? (
              <span
                className={
                  "rounded px-1.5 py-px text-[10px] font-bold " +
                  (dd.urgent ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600")
                }
              >
                {dd.text}
              </span>
            ) : null}
            <span className="text-[11px] text-gray-500">
              {fmt(r.date)} · {r.source}
              {r.docNo ? " · " + r.docNo : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <h2 className="text-[24px] font-bold leading-tight text-gray-900">{pick(r.title, r.titleEn)}</h2>

        <div className="mt-4">
          <MdBody text={(pick(r.summary, r.summaryEn) as string) ?? ""} />
        </div>

        {r.implication ? (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
            <p className="text-[14px] leading-relaxed text-gray-700">
              <b className="font-semibold text-gray-900">우리 영향 · </b>
              {r.implication}
            </p>
          </div>
        ) : null}

        {r.actions ? (
          <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-[14px] leading-relaxed text-gray-700">
              <b className="font-semibold text-gray-900">액션 · </b>
              {r.actions}
            </p>
          </div>
        ) : null}

        {r.url ? (
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12px] text-indigo-600 transition-colors duration-200 hover:underline"
          >
            원문 전체 보기 · {r.source} ↗
          </a>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/** 분석 팝업 */
function Modal({ p, onClose }: { p: Post; onClose: () => void }) {
  const { t, pick } = useLang()
  useEsc(onClose)

  return createPortal(
    <div className={SHELL} onClick={onClose}>
      <style>{"@keyframes apIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}"}</style>
      <div className={CARD} style={ANIM} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={
                "rounded px-1.5 py-px text-[10px] font-bold " +
                (p.kind === "own" ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600")
              }
            >
              {p.kind === "own" ? "자체 칼럼" : "외부 큐레이션"}
            </span>
            <span className="text-[11px] text-gray-500">
              {fmt(p.publishedAt)} · {p.kind === "own" ? p.author ?? "경영기획" : p.source}
            </span>
            {p.confidence ? (
              <span className="rounded bg-gray-50 px-1.5 py-px text-[10px] text-gray-500">{p.confidence}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <h2 className="text-[24px] font-bold leading-tight text-gray-900">{pick(p.title, p.titleEn)}</h2>
        {p.dek ? <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">{pick(p.dek, p.dekEn)}</p> : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
          <div>
            {p.kind === "own" ? (
              <OwnVisual tags={p.tags} />
            ) : p.image ? (
              <div className="w-full overflow-hidden rounded-lg bg-gray-100">
                <img src={p.image} alt="" className="h-auto w-full object-contain" />
              </div>
            ) : null}
          </div>

          <div>
            {p.summary ? (
              <p className="text-[14px] leading-relaxed text-gray-700">{pick(p.summary, p.summaryEn)}</p>
            ) : null}

            <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
              <p className="text-[14px] leading-relaxed text-gray-700">
                <b className="font-semibold text-gray-900">{t("why_matters")} · </b>
                {pick(p.whyMatters, p.whyMattersEn)}
              </p>
            </div>

            {p.url ? (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[12px] text-indigo-600 transition-colors duration-200 hover:underline"
              >
                {p.kind === "own" ? "근거 원문" : "원문 전체 보기"} · {p.source} ↗
              </a>
            ) : null}
          </div>
        </div>

        {p.body ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <MdBody text={pick(p.body, p.bodyEn) as string} />
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export default function AnalysisColumn() {
  const { t, pick } = useLang()
  const [rows, setRows] = React.useState<Post[] | null>(null)
  const [regs, setRegs] = React.useState<RegAlert[] | null>(null)
  const [err, setErr] = React.useState(false)
  const [open, setOpen] = React.useState<Post | null>(null)
  const [openReg, setOpenReg] = React.useState<RegAlert | null>(null)

  React.useEffect(() => {
    analysisPosts(4).then(setRows).catch(() => setErr(true))
    regAlerts(3).then(setRegs).catch(() => setRegs([]))
  }, [])

  const reg = regs && regs.length > 0 ? regs[0] : null
  const post = rows && rows.length > 0 ? rows[0] : null
  const dd = reg ? dday(reg.effectiveDate) : null

  return (
    <div className="flex flex-col gap-4 lg:px-3">
      <section>
        <a href="/news?cat=분석" className="group mb-2 flex items-baseline gap-1">
          <span className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
            {t("analysis_title")}
          </span>
          <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">
            ›
          </span>
        </a>

        {err ? (
          <p className="py-6 text-[12px] text-gray-500">분석 글을 불러오지 못함 · 확인 필요</p>
        ) : !post ? (
          <div className="h-[150px] rounded-lg bg-gray-50" />
        ) : (
          <button type="button" onClick={() => setOpen(post)} className={CARD_BTN}>
            {post.kind === "own" ? (
              <div className="mb-2 w-full">
                <OwnVisual tags={post.tags} compact />
              </div>
            ) : post.image ? (
              <div className="mb-2 h-[76px] w-full overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={post.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(ev) => {
                    const el = ev.currentTarget.parentElement
                    if (el) el.style.display = "none"
                  }}
                />
              </div>
            ) : null}

            <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-800 transition-colors duration-200 group-hover:text-indigo-600">
              {pick(post.title, post.titleEn)}
            </p>

            <p className="mt-1.5 flex items-center gap-1 text-[11px] leading-4 text-gray-500">
              <span
                className={
                  "shrink-0 rounded px-1 py-px text-[10px] font-bold leading-4 " +
                  (post.kind === "own" ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600")
                }
              >
                {post.kind === "own" ? t("analysis_own") : t("analysis_ext")}
              </span>
              <span className="min-w-0 truncate">{post.kind === "own" ? post.author ?? "경영기획" : post.source}</span>
              <span className="shrink-0">·</span>
              <span className="shrink-0">{fmt(post.publishedAt)}</span>
            </p>
          </button>
        )}
      </section>

      <section className="border-t border-gray-100 pt-3">
        <a href="/news?cat=규제" className="group mb-2 flex items-baseline gap-1">
          <span className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
            규제 동향
          </span>
          <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">
            ›
          </span>
        </a>

        {!regs ? (
          <div className="h-[150px] rounded-lg bg-gray-50" />
        ) : !reg ? (
          <p className="py-6 text-[12px] text-gray-500">등재된 규제 동향 없음</p>
        ) : (
          <button type="button" onClick={() => setOpenReg(reg)} className={CARD_BTN}>
            <span className="mb-1 flex flex-wrap items-center gap-1">
              <span className="rounded bg-indigo-50 px-1 py-px text-[10px] font-bold leading-4 text-indigo-700">
                {reg.agency}
              </span>
              <span className="rounded bg-gray-100 px-1 py-px text-[10px] font-bold leading-4 text-gray-600">
                {reg.category}
              </span>
              <span className={"rounded px-1 py-px text-[10px] font-bold leading-4 " + (SEV[reg.severity] ?? SEV.Medium)}>
                {reg.severity}
              </span>
              {dd ? (
                <span
                  className={
                    "rounded px-1 py-px text-[10px] font-bold leading-4 " +
                    (dd.urgent ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600")
                  }
                >
                  {dd.text}
                </span>
              ) : null}
            </span>

            <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-800 transition-colors duration-200 group-hover:text-indigo-600">
              {pick(reg.title, reg.titleEn)}
            </p>

            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              {reg.source} · {fmt(reg.date)}
            </p>
          </button>
        )}
      </section>

      {open ? <Modal p={open} onClose={() => setOpen(null)} /> : null}
      {openReg ? <RegModal r={openReg} onClose={() => setOpenReg(null)} /> : null}
    </div>
  )
}
