"use client"

// 개선요청·문의 창구 — 상단 아이콘 클릭 시 열림(ax:open-feedback 이벤트). 어느 페이지의 어느 부분을
//   어떻게 개선하면 좋을지 제출. 제출 데이터는 feedback_requests(익명 insert·조회 비공개)에 저장 → 오너만 확인.
import React from "react"
import { createPortal } from "react-dom"
import { submitFeedback } from "@/lib/supabase"
import { useAccessIdentity } from "@/lib/useAccessIdentity"
import { T } from "@/lib/i18n"

// 경로 → 사람이 읽는 페이지명(제출 시 참고). 없으면 경로 그대로.
const PAGE_LABEL: Record<string, string> = {
  "/overview": "국가동향(개요)", "/competitors": "시장동향(경쟁사)", "/economy": "주요지표",
  "/competitor-ads": "마케팅", "/calendar": "주요일정", "/news": "주요뉴스", "/regions": "지역시장지도",
  "/reports": "리포트", "/weather": "날씨·재난", "/details": "상세", "/appendix": "부록",
}
function pageName(path: string): string {
  const base = "/" + (path.replace(/^\//, "").split("/")[0] || "")
  return PAGE_LABEL[base] ? `${PAGE_LABEL[base]} (${path})` : path
}

export default function FeedbackModal() {
  const [open, setOpen] = React.useState(false)
  const [page, setPage] = React.useState("")
  const [area, setArea] = React.useState("")
  const [request, setRequest] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [err, setErr] = React.useState(false)
  const me = useAccessIdentity()

  React.useEffect(() => {
    const onOpen = () => {
      setPage(typeof window !== "undefined" ? pageName(window.location.pathname) : "")
      setArea(""); setRequest(""); setDone(false); setErr(false); setOpen(true)
    }
    window.addEventListener("ax:open-feedback", onOpen)
    return () => window.removeEventListener("ax:open-feedback", onOpen)
  }, [])

  const canSend = request.trim().length >= 3 && !sending
  const send = async () => {
    if (!canSend) return
    setSending(true); setErr(false)
    const ok = await submitFeedback({ page, area: area.trim(), request: request.trim(), submitter: me?.email || me?.name || "" })
    setSending(false)
    if (ok) { setDone(true); setTimeout(() => setOpen(false), 1400) } else setErr(true)
  }

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" style={{ animation: "fadeUp .2s ease both" }} onClick={() => setOpen(false)}>
      <div className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-2xl dark:bg-gray-900 dark:ring-white/10" style={{ animation: "popIn .34s cubic-bezier(.34,1.42,.64,1) both" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{T("개선 요청 · 문의", "Improvement request · Feedback")}</h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{T("어느 페이지의 어느 부분을 어떻게 개선하면 좋을지 남겨주세요", "Tell us which page, which part, and how you'd like it improved")}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label={T("닫기", "Close")} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-gray-500 transition hover:bg-black/10 active:scale-90 dark:bg-white/10 dark:text-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
            <p className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-50">{T("접수되었습니다. 감사합니다!", "Received. Thank you!")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-3.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{T("페이지", "Page")}</span>
              <input value={page} onChange={(e) => setPage(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-[12.5px] text-gray-800 outline-none focus:border-indigo-400 dark:text-gray-100" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{T("개선할 부분 (선택)", "Which part (optional)")}</span>
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder={T("예: 유통 히트맵 미니팝업 위치", "e.g. Retail heatmap tooltip position")} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-[12.5px] text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-400 dark:text-gray-100" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{T("개선 요청 내용", "What to improve")}<span className="ml-1 text-rose-500">*</span></span>
              <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={4} placeholder={T("이렇게 바뀌면 좋겠어요…", "I'd like it to work like…")} className="resize-none rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-[12.5px] leading-relaxed text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-400 dark:text-gray-100" />
            </label>
            {err && <p className="text-[11.5px] font-semibold text-rose-600 dark:text-rose-400">{T("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.", "Failed to send. Please try again shortly.")}</p>}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[10.5px] text-gray-400 dark:text-gray-500">{T("제출 내용은 비공개로 저장됩니다", "Submissions are stored privately")}</span>
              <button type="button" onClick={send} disabled={!canSend} className="rounded-lg bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 active:scale-95 disabled:opacity-40">{sending ? T("전송 중…", "Sending…") : T("보내기", "Send")}</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
