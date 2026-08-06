"use client"

import React from "react"
import { T, useLang } from "@/lib/i18n"

/** 웰컴 팝업 — AX 필리핀법인 마켓 인텔리전스 대시보드 베타 안내.
 *  하루 1회 노출(localStorage에 마지막 노출 날짜 저장). 닫으면 그날은 다시 안 뜨고, 상단 전구 아이콘으로 언제든 재열기. */
const SEEN_KEY = "ax_welcome_seen_date"
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") }
// 언어 토글 시 트리가 리마운트돼도(LangProvider key=lang) 팝업이 닫히지 않게 열림 상태를 모듈에 유지
let _wOpen = false

const BUILDING: { icon: React.ReactNode; t: string; tEn: string; d: string; dEn: string }[] = [
  { t: "국가동향", tEn: "National Trends", d: "필리핀 뉴스·규제·정책 + 인사이트 리포트 자동 수집·개인별 맞춤 발송", dEn: "Auto-collects Philippine news, regulation & policy plus insight reports, delivered personalized", icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { t: "시장동향", tEn: "Market Trends", d: "경쟁사 가격·프로모·신제품/EOL 실시간 관측", dEn: "Real-time tracking of competitor pricing, promotions, and new/EOL products", icon: <><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" /></> },
  { t: "주요지표", tEn: "Key Indicators", d: "거시·금융·가전 선행지표 200+ (World Bank·PSA·BSP)", dEn: "200+ leading macro, financial & appliance indicators (World Bank · PSA · BSP)", icon: <><rect x="3" y="10" width="4" height="10" rx="1" /><rect x="10" y="4" width="4" height="16" rx="1" /><rect x="17" y="13" width="4" height="7" rx="1" /></> },
  { t: "마케팅·경쟁광고", tEn: "Marketing & Ads", d: "경쟁사 광고·캠페인 트래킹, 종료·신규 감지", dEn: "Tracks competitor ads and campaigns, detecting launches and terminations", icon: <><path d="M3 11l18-5v12L3 14z" /><path d="M11.6 16.8a3 3 0 0 1-5.8-1.1" /></> },
  { t: "주요일정·리포트", tEn: "Schedule & Reports", d: "경제·정책 캘린더 + 부서·제품·기간별 맞춤 리포트(예정)", dEn: "Economic & policy calendar plus custom reports by team, product, and period (planned)", icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
]

export default function WelcomeModal() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = React.useState(_wOpen)   // 리마운트(언어 토글) 시에도 열림 유지
  const [closing, setClosing] = React.useState(false)

  React.useEffect(() => {
    if (_wOpen) { setOpen(true); return }   // 언어 토글로 재마운트된 경우 그대로 열어둠
    try { if (localStorage.getItem(SEEN_KEY) !== todayStr()) { _wOpen = true; setOpen(true) } } catch { _wOpen = true; setOpen(true) }
  }, [])

  // TopNav 전구 아이콘 등에서 다시 열기 — 첫 방문 여부와 무관하게 노출
  React.useEffect(() => {
    const reopen = () => { _wOpen = true; setClosing(false); setOpen(true) }
    window.addEventListener("ax:open-welcome", reopen)
    return () => window.removeEventListener("ax:open-welcome", reopen)
  }, [])

  const close = () => {
    setClosing(true)
    _wOpen = false
    try { localStorage.setItem(SEEN_KEY, todayStr()) } catch {}
    window.setTimeout(() => { setOpen(false); setClosing(false) }, 220)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6" aria-modal role="dialog">
      <div className="absolute inset-0 bg-gray-900/45 backdrop-blur-md" style={{ animation: (closing ? "veilOut" : "veilIn") + " .24s ease both" }} onClick={close} />
      <div
        className="relative flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[0.06] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.55)] dark:bg-gray-900 dark:ring-white/10"
        style={{ animation: (closing ? "popOut .22s ease both" : "popIn .5s cubic-bezier(.34,1.42,.64,1) both") }}
      >
        {/* 헤더 — 파스텔 오로라 그라디언트(감성) + 그라디언트 타이틀 */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/80 via-white to-fuchsia-50/50 px-7 pb-6 pt-7 dark:from-indigo-500/[0.07] dark:via-gray-900 dark:to-fuchsia-500/[0.05]">
          <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400" />
          {/* 오로라 오브 — 파스텔·저채도 블러로 은은한 깊이감 */}
          <div className="pointer-events-none absolute -left-12 -top-14 h-48 w-48 rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-500/20" />
          <div className="pointer-events-none absolute -right-10 -top-8 h-44 w-44 rounded-full bg-fuchsia-300/25 blur-3xl dark:bg-fuchsia-500/15" />
          <div className="pointer-events-none absolute right-24 top-12 h-28 w-28 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />
          <div className="relative flex items-center gap-2" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both", animationDelay: ".1s" }}>
            {/* 로고 워드마크 */}
            <span className="text-[15px] font-extrabold leading-none tracking-tight">
              <span className="text-gray-900 dark:text-gray-50">axlgeph</span><span className="text-indigo-600 dark:text-indigo-400">.report</span>
            </span>
            <span className="mt-0.5 text-[11px] font-semibold italic leading-none text-gray-400 dark:text-gray-500">beta</span>
            {/* 언어 배지 — 누가 들어올지 몰라 팝업 안에서 바로 KO/EN 선택(기본 한글). 넉넉한 크기 */}
            <div className="ml-auto flex items-center rounded-full bg-white/70 p-1 text-[12.5px] font-bold shadow-sm ring-1 ring-indigo-100 backdrop-blur dark:bg-white/10 dark:ring-indigo-500/20">
              {(["ko", "en"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-label={l === "ko" ? "한국어" : "English"} className={"rounded-full px-3 py-1 leading-none transition-colors " + (lang === l ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200")}>{l === "ko" ? "KO" : "EN"}</button>
              ))}
            </div>
          </div>
          <h2 className="relative mt-3.5 text-[20px] font-extrabold leading-[1.25] tracking-tight" style={{ animation: "fadeUp .55s cubic-bezier(.22,1,.36,1) both", animationDelay: ".17s" }}>
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-fuchsia-300">{T("AX 필리핀법인", "AX Philippines")}</span>
            <span className="block text-gray-900 dark:text-gray-50">{T("마켓 인텔리전스 대시보드", "Market Intelligence Dashboard")}</span>
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          {/* 리드 문구 — 헤더에서 내려 제목형(좌측 인디고 액센트)으로 강조 */}
          <p className="mb-4 border-l-[3px] border-indigo-400 pl-3 text-[13.5px] font-semibold leading-relaxed text-gray-800 dark:border-indigo-500/50 dark:text-gray-100">
            {T("AX 기반 각 데이터를 한 곳에 모아 의사결정을 돕는 대시보드입니다.", "An AX-powered dashboard that brings each dataset into one place to support decision-making.")}
          </p>
          {/* 주의 — 정확도·갱신 안내 */}
          <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-500"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
            <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">
              {T("데이터 수집 테스트 기간이라 일부 수치는 ", "In a data-collection test phase, so some figures are ")}<b className="font-bold">{T("참고용", "reference only")}</b>{T("이며, 실시간 구축 중이라 사이트가 일시 불안정할 수 있습니다.", " and the site may be temporarily unstable while it's built in real time.")}
            </p>
          </div>

          {/* 무엇을 구축 중인가 */}
          <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("지금 구축 중인 것", "Now building")}</p>
          <div className="flex flex-col gap-1.5">
            {BUILDING.map((b, i) => (
              <div key={b.t} className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10" style={{ animation: "fadeUp .45s cubic-bezier(.22,1,.36,1) both", animationDelay: 0.06 + i * 0.05 + "s" }}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg>
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-gray-900 dark:text-gray-50">{T(b.t, b.tEn)}</div>
                  <div className="text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{T(b.d, b.dEn)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 — 재열기 안내 + CTA */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-7 py-3.5 dark:border-gray-800">
          <span className="hidden items-center gap-1.5 text-[11.5px] text-gray-400 dark:text-gray-500 sm:flex">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-400"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" /></svg>
            {T("상단 ", "Reopen anytime from the ")}<b className="font-semibold text-gray-500 dark:text-gray-400">{T("전구 아이콘", "lightbulb icon")}</b>{T("으로 언제든 다시 볼 수 있어요", " in the top bar")}
          </span>
          <button type="button" onClick={close} className="ml-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-[13px] font-bold text-white shadow-md shadow-violet-600/25 transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg hover:shadow-violet-600/30 active:scale-95">
            {T("살펴보기", "Explore")}
          </button>
        </div>
      </div>
    </div>
  )
}
