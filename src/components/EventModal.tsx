"use client"

import React from "react"
import { createPortal } from "react-dom"
import type { CalEvent } from "@/lib/supabase"

/** 이벤트 상세 팝업 — 캘린더 페이지와 위젯(AgendaCard)이 공유하는 단일 모달(디자인 동일). */

const CAT_DOT: Record<string, string> = { 경제: "bg-emerald-500", 금융: "bg-blue-500", 정치: "bg-purple-500", 규제: "bg-red-500", 에너지: "bg-amber-500", 유통: "bg-violet-500", 공휴일: "bg-teal-500", 기타: "bg-gray-400" }
const KIND: Record<string, string> = { release: "지표 발표", policy: "정책·규제", holiday: "공휴일" }
const dotOf = (c: string) => CAT_DOT[c] ?? CAT_DOT["기타"]
const catLabel = (c: string) => (c === "규제" ? "정책" : c)
const para = (s: string | null) => (s ?? "").split(/\n{2,}|(?<=\.)\s{2,}/).map((x) => x.trim()).filter(Boolean)
const fmtVal = (v: number | null, unit: string | null) => {
  if (v === null) return "—"
  const u = unit ?? ""
  if (u.includes("%") || u === "percent") return v.toFixed(1) + "%"
  if (u === "PHP/kWh") return "₱" + v.toFixed(2)
  if (u === "PHP/day") return "₱" + v.toFixed(0)
  if (u === "USD bn") return "$" + v.toFixed(2) + "B"
  return String(v)
}

export default function EventModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const [closing, setClosing] = React.useState(false)
  const close = () => { setClosing(true); window.setTimeout(onClose, 200) }
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, []) // eslint-disable-line
  if (typeof document === "undefined") return null
  const m = event
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" style={{ animation: closing ? "evBackOut .22s ease both" : "evBackIn .22s ease both" }} onClick={close}>
      <style>{"@keyframes evBackIn{from{opacity:0}to{opacity:1}}@keyframes evBackOut{from{opacity:1}to{opacity:0}}@keyframes evModalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}@keyframes evModalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.98)}}"}</style>
      <div className="relative flex max-h-[88vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ animation: closing ? "evModalOut .22s cubic-bezier(.4,0,1,1) both" : "evModalIn .34s cubic-bezier(.22,1,.36,1) both" }} onClick={(e) => e.stopPropagation()}>
        <span className={"absolute inset-y-0 left-0 w-1 " + dotOf(m.category)} />
        <button type="button" onClick={close} aria-label="닫기" className="absolute right-3 top-3 z-10 rounded-full bg-white/90 dark:bg-gray-900/90 p-1.5 text-gray-500 dark:text-gray-400 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:text-gray-900 dark:hover:text-gray-50 active:scale-95">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="flex w-full shrink-0 items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-7 pb-3 pt-6 text-[13px] font-semibold">
          <span className="text-gray-800 dark:text-gray-100">{catLabel(m.category)}</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-500 dark:text-gray-400">{KIND[m.kind] || ""}</span>
          {m.importance >= 2 && <span className="text-[13px] text-amber-500 dark:text-amber-400">{"★".repeat(m.importance)}</span>}
        </div>

        <div className="overflow-y-auto px-7 pb-7 pt-5">
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-gray-500 dark:text-gray-400">
            {m.sourceLabel && <span className="font-semibold text-gray-600 dark:text-gray-300">{m.sourceLabel}</span>}
            {m.sourceLabel && <span className="text-gray-300 dark:text-gray-600">·</span>}
            <span className="tabular-nums">{m.date}</span>
          </div>

          <h3 className="mt-2 text-[21px] font-semibold leading-snug tracking-tight text-gray-900 dark:text-gray-50">{m.event}</h3>

          {m.indicatorKey && (
            <div className="mt-4 inline-flex flex-wrap gap-4 rounded-lg bg-gray-50 dark:bg-gray-900 px-3.5 py-2 text-[13px] tabular-nums">
              <span className="text-gray-400 dark:text-gray-500">예측 <span className="font-semibold text-gray-600 dark:text-gray-300">{m.forecast || "—"}</span></span>
              <span className="text-indigo-500 dark:text-indigo-400">실제 <span className="font-semibold">{fmtVal(m.actual, m.unit)}</span></span>
              <span className="text-gray-400 dark:text-gray-500">이전 <span className="font-semibold text-gray-500 dark:text-gray-400">{fmtVal(m.previous, m.unit)}</span></span>
            </div>
          )}

          {m.implication && (
            <div className="mt-4 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-3">
              <p className="text-[11.5px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">시사점</p>
              <p className="mt-1 text-[15px] leading-[1.7] text-gray-800 dark:text-gray-100">{m.implication}</p>
            </div>
          )}

          {m.summary && (
            <div className="mt-4 space-y-2">
              <p className="text-[11.5px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">본문 요약</p>
              {para(m.summary).map((p, k) => <p key={k} className="text-[14px] leading-[1.7] text-gray-600 dark:text-gray-300">{p}</p>)}
            </div>
          )}

          {m.actions && (
            <div className="mt-4">
              <p className="text-[11.5px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">대응 · Owner</p>
              <p className="mt-1 whitespace-pre-line text-[14px] leading-[1.7] text-gray-600 dark:text-gray-300">{m.actions}</p>
            </div>
          )}

          {m.url && (
            <a href={m.url} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center gap-1 rounded-lg bg-gray-900 py-2.5 text-[14px] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-800 active:scale-[.99]">원문 보기 ↗</a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
