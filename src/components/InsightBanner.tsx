"use client"

import React from "react"
import { T } from "@/lib/i18n"

/** 페이지 상단 인사이트 배너 — 뉴스·경쟁사 광고·환율 뷰가 공유하는 단일 컴포넌트.
 *  워딩은 public/banners.json 매니페스트에서 로드(주간/월간 자동 갱신).
 *  본문·인사이트는 **굵게** 마크업 지원. 접힘/펼침 애니메이션은 기존 배너와 동일. */

export type Banner = {
  title: string         // 굵은 리드 문구
  summary: string       // 접힘 상태 한 줄(— 뒤 요약)
  body: string          // 펼침 본문(**굵게** 지원)
  insight: string       // LG 관점/대응 문장
  insightLabel?: string // 기본 "LG 관점"
  period?: string | null // 기간 라벨(예: 2026-W31 · 2026-07)
  cadence?: string | null // weekly | monthly
  updatedAt?: string | null
}

/** **굵게** → <b> 로 렌더 */
function rich(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <b key={i} className="font-semibold text-gray-900 dark:text-gray-50">{p.slice(2, -2)}</b>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  )
}

/** 기간 표기 — 2026-W31 → "31주차", 2026-07 → "7월"(연도 생략, 간결) */
function fmtPeriod(p?: string | null): string {
  if (!p) return ""
  const w = p.match(/W(\d+)/)
  if (w) return Number(w[1]) + T("주차", "W")
  const m = p.match(/^\d{4}-(\d{2})$/)
  if (m) return Number(m[1]) + T("월", "M")
  return p
}

export function InsightBanner({ banner, open, onToggle }: { banner: Banner; open: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className="group cursor-pointer select-none overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50/60 dark:bg-indigo-500/[0.08] transition-all duration-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {banner.period && (
          <span className="shrink-0 rounded-full bg-indigo-600/10 dark:bg-indigo-500/20 px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
            {fmtPeriod(banner.period)}
          </span>
        )}
        <div className="min-w-0 flex-1 truncate text-[12.5px] text-gray-700 dark:text-gray-200">
          <b className="font-semibold text-gray-900 dark:text-gray-50">{banner.title}</b> — {banner.summary}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-400 dark:text-indigo-300 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </div>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.22,1,.36,1)" }}>
        <div className="overflow-hidden">
          <div className="border-t border-indigo-100/70 dark:border-indigo-500/25 px-4 pb-3.5 pt-3">
            <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">{rich(banner.body)}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-indigo-700 dark:text-indigo-300">
              <span className="mt-0.5 shrink-0 rounded-md bg-indigo-600/10 dark:bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">{banner.insightLabel || T("LG 관점", "LG View")}</span>
              <span>{rich(banner.insight)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
