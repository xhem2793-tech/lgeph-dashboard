"use client"

import React from "react"
import { publishedReports, type PubReport } from "@/lib/supabase"
import DataVerification from "@/components/DataVerification"
import { Segmented } from "@/components/Segmented"

/** 리포트 — 발간 리포트(발행 파이프라인이 채움) + 데이터 검증(구 자료 페이지)을 한 페이지에.
 *  · 리포트 카드 클릭 → PDF 원문(새 탭). 발행 = 자동 노출(reports/index.json 매니페스트).
 *  · '자료' 페이지를 탭으로 흡수 — 좌측 nav는 리포트 하나로 통일.
 */

function fmtDate(d: string) {
  return d.length >= 10 ? d.slice(0, 4) + "." + d.slice(5, 7) + "." + d.slice(8, 10) : d
}

function ReportCard({ r, i }: { r: PubReport; i: number }) {
  const [err, setErr] = React.useState(false)
  const open = () => { if (r.pdf) window.open(r.pdf, "_blank", "noopener") }
  return (
    <button
      type="button"
      onClick={open}
      style={{ animation: "repIn .5s cubic-bezier(.16,1,.3,1) backwards", animationDelay: Math.min(i, 10) * 0.05 + "s" }}
      className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md active:scale-[.99]"
    >
      {/* 썸네일 — 리포트 미리보기(있으면), 없으면 브랜드 그라디언트 */}
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        {r.thumb && !err ? (
          <img src={r.thumb} alt="" loading="lazy" onError={() => setErr(true)} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-indigo-500 to-violet-600">
            <span className="text-[13px] font-bold tracking-tight text-white">axlgeph.report</span>
            <span className="text-[10px] font-medium text-white/70">{r.kind}</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 dark:bg-gray-900/90 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shadow-sm backdrop-blur">{r.kind}</span>
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
          PDF
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-600 dark:text-gray-300">{r.source}</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="num">{fmtDate(r.date)}</span>
          {r.topic && <><span className="text-gray-300 dark:text-gray-600">·</span><span className="text-indigo-600 dark:text-indigo-400">{r.topic}</span></>}
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-gray-900 dark:text-gray-50 transition-colors duration-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{r.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">{r.summary}</p>
        {r.so && (
          <p className="mt-2 line-clamp-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2 text-[11.5px] leading-relaxed text-gray-700 dark:text-gray-200"><b className="font-semibold text-indigo-600 dark:text-indigo-400">시사점</b> {r.so}</p>
        )}
        <div className="mt-auto flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-2.5 text-[10.5px] text-gray-400 dark:text-gray-500">
          {r.sentAt ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
              발송 {r.recipients ?? "—"}명 · {fmtDate(r.sentAt)}
            </span>
          ) : r.review ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              검토용 · 미발송
            </span>
          ) : (
            <span>미발송</span>
          )}
          <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-indigo-600 dark:text-indigo-400">원문 열기<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10" /></svg></span>
        </div>
      </div>
    </button>
  )
}

export default function Page() {
  const [tab, setTab] = React.useState<"reports" | "data">("reports")
  const [reports, setReports] = React.useState<PubReport[] | null>(null)
  React.useEffect(() => { publishedReports().then(setReports).catch(() => setReports([])) }, [])

  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes repIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"}</style>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3" style={{ animation: "fadeUp .5s ease both" }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-indigo-600 dark:text-indigo-400">Market Intelligence</p>
          <h1 className="mt-0.5 text-[22px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">리포트</h1>
          <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">발간 리포트 원문 · 데이터 출처 검증</p>
        </div>
        <Segmented
          value={tab}
          onChange={(k) => setTab(k as "reports" | "data")}
          options={[{ k: "reports", label: "발간 리포트" }, { k: "data", label: "데이터 검증" }]}
        />
      </header>

      {tab === "reports" ? (
        <div key="reports" style={{ animation: "viewIn .42s cubic-bezier(.16,1,.3,1) both" }}>
          {reports === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[320px] animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" />)}
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 py-20 text-center text-[13px] text-gray-400 dark:text-gray-500">아직 발간된 리포트가 없습니다 · <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[11px]">npm run publish-report</code> 로 발행</div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {reports.map((r, i) => <ReportCard key={r.id} r={r} i={i} />)}
              </div>
              <p className="mt-5 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">발행 파이프라인(<code className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-px text-[10px]">publish-report</code>)이 리포트를 자동 등록 · 클릭 시 PDF 원문 · 법인 이메일 동시 발송</p>
            </>
          )}
        </div>
      ) : (
        <div key="data" style={{ animation: "viewIn .42s cubic-bezier(.16,1,.3,1) both" }}>
          <DataVerification />
        </div>
      )}
    </main>
  )
}
