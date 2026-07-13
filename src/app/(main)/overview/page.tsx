"use client"

import React from "react"
import { newsBySheet, calendarMonth } from "@/lib/supabase"
import TodayBrief from "@/components/TodayBrief"
import CompetitorMovers from "@/components/CompetitorMovers"
import EconRail from "@/components/EconRail"
import DailyIndicators from "@/components/DailyIndicators"
import AnalysisColumn from "@/components/AnalysisColumn"
import { useLang } from "@/lib/i18n"

export type PeriodValue = "previous-period" | "last-year" | "no-comparison"
export type KpiEntry = {
  title: string
  percentage: number
  current: number
  allowed: number
  unit?: string
}
export type KpiEntryExtended = Omit<KpiEntry, "current" | "allowed" | "unit"> & {
  value: string
  color: string
}



export default function Overview() {
  const { t, pick, lang } = useLang()
  const today = React.useRef(new Date()).current
  const [nMain, setNMain] = React.useState<any[]>([])
  const [nCE, setNCE] = React.useState<any[]>([])
  const [nB2B, setNB2B] = React.useState<any[]>([])
  const [cal, setCal] = React.useState<any[]>([])
  const [modal, setModal] = React.useState<any>(null)
  const [modalClosing, setModalClosing] = React.useState(false)
  const [calTick, setCalTick] = React.useState(0)
  const [calTab, setCalTab] = React.useState<"upcoming" | "past">("upcoming")
  const closeModal = () => { setModalClosing(true); window.setTimeout(() => { setModal(null); setModalClosing(false) }, 240) }

  React.useEffect(() => {
    ;(async () => {
      try {
        const [nm, nc, nb, ec] = await Promise.all([
          newsBySheet("daily_news", 14),
          newsBySheet("ce_trend", 5),
          newsBySheet("b2b_trend", 5),
          calendarMonth(),
        ])
        setNMain(nm); setNCE(nc); setNB2B(nb); setCal(ec)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [today])

  React.useEffect(() => {
    const id = window.setInterval(() => setCalTick((t) => t + 1), 10000)
    return () => window.clearInterval(id)
  }, [])

  


  

  // 캘린더 — 탭에 따라 예정/결과만. 제목은 2줄 클램프로 잘리되 카드 밖으로 흐르지 않는다
  const calList = cal.filter((e: any) => (calTab === "past" ? e.past : !e.past)).slice(0, 10)

  return (
    <main className="mx-auto max-w-[1536px] px-4 pb-4 pt-0 sm:px-6 sm:pb-6 sm:pt-0">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes badgeSwap{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}@keyframes chartSwap{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes calIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.96)}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}"}</style>
      {(
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_331px]" style={{ animation: "fadeUp .5s ease both" }}>
            <div className="lg:col-span-3">
              {/* ① 오늘의 핵심(주장) + 오늘의 변화(근거) — 좌우로 나란히.
                  주장 옆에 근거가 있어야 신뢰가 생긴다. */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 lg:grid-cols-2" style={{ animation: "fadeUp .5s ease both", animationDelay: "0.05s" }}>
                <TodayBrief />
                <CompetitorMovers />
              </div>
              {/* 주요 뉴스 — 금주 주요 이슈·가격 동향과 같은 카드 어법으로 묶음 */}
              <section className="mt-6 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-shadow duration-300 hover:shadow-md sm:mt-8" style={{ animation: "fadeUp .5s ease both", animationDelay: "0.45s" }}>
              <div className="mb-2 flex items-baseline gap-2 px-0.5">
                <a href="/news" className="group flex items-baseline gap-1">
                  <h2 className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">{t("news_title")}</h2>
                  <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
                </a>
                <span className="cursor-default text-[10px] text-gray-400">{t("news_sub")}</span>
                {nMain[0]?.date ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] font-semibold text-emerald-700">CONFIRMED</span>
                    {t("news_updated")} {String(nMain[0].date).slice(5).replace("-", "/")}
                    {/* 없는 기사를 지어내지 않는다 — 신규가 없으면 없다고 쓴다 */}
                    {String(nMain[0].date) !== new Date().toISOString().slice(0, 10) ? (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1 py-px text-[10px] font-semibold text-amber-700">
                        {t("news_none_today")}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <div>
                {/* 야후 구조 — 좌: 헤드라인 + 3열 / 우: 시장 동향이 위에서 아래까지 한 컬럼 */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_1fr]">
                  {/* 좌측 — 헤드라인 아래 CE·B2B·분석 3열 */}
                  <div>
                    {nMain[0] ? (
                      <button type="button" onClick={() => setModal({ ...nMain[0], category: "경제·정치·사회" })} className="group mb-4 flex flex-col gap-3 border-b border-gray-100 pb-4 text-left sm:flex-row sm:gap-4">
                        {nMain[0].image ? (
                          <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100 sm:aspect-auto sm:h-[168px] sm:w-[344px] sm:shrink-0">
                            <img src={nMain[0].image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(ev) => { const el = ev.currentTarget.parentElement; if (el) el.style.display = "none" }} />
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <p
                          className={
                            "line-clamp-3 font-bold leading-tight text-gray-900 group-hover:text-indigo-600 " +
                            (lang === "en" ? "text-[22px]" : "text-[25px]")
                          }
                        >
                          {pick(nMain[0].title, (nMain[0] as any).titleEn)}
                        </p>
                          {nMain[0].summary ? <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-gray-500">{pick(nMain[0].summary, (nMain[0] as any).summaryEn)}</p> : null}
                          <p className="mt-2 text-[12px] text-gray-400">{nMain[0].source} · {nMain[0].date}</p>
                        </div>
                      </button>
                    ) : null}

                    <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 lg:-mx-3 lg:grid-cols-3 lg:gap-y-0 lg:divide-x lg:divide-gray-200">
                      {[
                        { title: t("ce_title"), sub: t("ce_sub"), rows: nCE, skip: 0, cat: "CE" },
                        { title: t("b2b_title"), sub: t("b2b_sub"), rows: nB2B, skip: 0, cat: "B2B" },
                      ].map((col) => (
                        <div key={col.title} className="lg:min-h-[560px] lg:px-3">
                          <a href={"/news?cat=" + encodeURIComponent(col.cat)} className="group mb-2 flex items-baseline gap-1">
                            <span className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">{col.title}</span>
                            <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
                            <span className="ml-1 text-[10px] text-gray-400">{col.sub}</span>
                          </a>
                          <div className="flex flex-col divide-y divide-gray-100">
                            {(() => {
                              // 각 열의 상단은 반드시 사진 — 리드에 이미지가 없으면
                              // 이미지 있는 최신 기사를 끌어올린다(야후식). 순서만 바꿀 뿐 기사를 지어내지 않음
                              const rows = col.rows.slice(col.skip, col.skip + 5)
                              const li = rows.findIndex((r: any) => r.image)
                              if (li > 0) rows.unshift(rows.splice(li, 1)[0])
                              return rows
                            })().map((n, i) => (
                              <button key={i} type="button" onClick={() => setModal({ ...n, category: col.sub })} className="group py-3 text-left transition-all duration-300 ease-out hover:-translate-y-0.5">
                                {i === 0 && n.image ? (
                                  <div className="mb-2 h-[150px] w-full overflow-hidden rounded-lg bg-gray-100">
                                    <img src={n.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(ev) => { const el = ev.currentTarget.parentElement; if (el) el.style.display = "none" }} />
                                  </div>
                                ) : null}
                                <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-800 group-hover:text-indigo-600">{pick(n.title, (n as any).titleEn)}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 text-gray-400"><span className="min-w-0 truncate">{n.source}</span><span className="shrink-0">·</span><span className="shrink-0">{n.date}</span></p>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* 뉴스가 마르는 날에도 우리가 쓴 글은 있다 */}
                      <div className="lg:min-h-[560px]">
                        <AnalysisColumn />
                      </div>
                    </div>
                  </div>

                  {/* 우측 — 시장 동향. 야후의 Popular처럼 헤드라인 높이에서 시작해 아래까지 한 컬럼 */}
                  <div className="lg:border-l lg:border-gray-200 lg:pl-5">
                    <a href="/news?cat=시장" className="group mb-2 flex items-baseline gap-1">
                      <span className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">{t("market_title")}</span>
                      <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
                      <span className="ml-1 text-[10px] text-gray-400">{t("market_sub")}</span>
                    </a>
                    <div className="flex flex-col divide-y divide-gray-100">
                      {nMain.slice(1, 10).map((n, i) => (
                        <button key={i} type="button" onClick={() => setModal({ ...n, category: "경제·정치·사회" })} className="group py-2.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5">
                          <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-800 group-hover:text-indigo-600">{pick(n.title, (n as any).titleEn)}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 text-gray-400"><span className="min-w-0 truncate">{n.source}</span><span className="shrink-0">·</span><span className="shrink-0">{n.date}</span></p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              </section>

              {/* ③ 일간 지표(환율·유가·날씨) — 뉴스와 같은 카드 어법 */}
              <section className="mt-6 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-shadow duration-300 hover:shadow-md sm:mt-8" style={{ animation: "fadeUp .5s ease both", animationDelay: "0.5s" }}>
                <DailyIndicators />
              </section>
            </div>
            <div className="pt-4 lg:pt-0" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both", animationDelay: "0.36s" }}>
              <div className="mt-6 sm:mt-8 lg:sticky lg:top-[96px]">
              <div className="mb-5">
                <EconRail />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-300 hover:shadow-md">
              <div className="flex items-center justify-between gap-2">
                <a href="/calendar" className="group flex items-baseline gap-1">
                  <p className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">{t("cal_title")}</p>
                  <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
                </a>
                {/* 예정 ↔ 결과 — 같은 달을 두 방향으로 본다(앞으로 볼 것 / 이미 나온 것) */}
                <div className="flex shrink-0 gap-1">
                  {([["upcoming", t("cal_upcoming")], ["past", t("cal_past")]] as const).map(([k, lb]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCalTab(k)}
                      className={"rounded px-1.5 py-0.5 text-[10px] font-medium transition-all duration-200 active:scale-95 " + (calTab === k ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:-translate-y-0.5 hover:bg-gray-200 hover:text-indigo-600")}
                    >
                      {lb}
                    </button>
                  ))}
                </div>
              </div>
              <div key={`${calTick}-${calTab}`} className="mt-2 flex flex-col gap-0.5">
                {calList.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-gray-400">{calTab === "past" ? t("cal_none_past") : t("cal_none_up")}</p>
                ) : null}
                {calList.map((e, i) => {
                  const ev = pick(e.event, (e as any).eventEn)
                  const head = ev.split("\u2014")[0]
                  const abbr = head.match(/\(([^)0-9/]{1,12})\)/)
                  const calTitle = head.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim()
                  const kws = [abbr ? abbr[1].trim() : null, e.category].filter(Boolean).slice(0, 2)
                  return (
                    <React.Fragment key={i}>
                      <button type="button" onClick={() => setModal({ title: ev.split("\u2014")[0].trim(), summary: ev.split("\u2014").slice(1).join("\u2014").trim() || null, category: e.category, date: e.date, source: (e.past ? "결과" : "예정") + " · " + e.importance, isCal: true })} style={{ animation: "calIn .5s cubic-bezier(.16,1,.3,1) backwards", animationDelay: i * 0.1 + "s", willChange: "transform, opacity" }} className={"group flex w-full min-w-0 gap-2.5 rounded-lg px-1 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-gray-50 " + (e.past ? "opacity-90" : "")}>
                        <div className={"flex w-9 shrink-0 flex-col items-center justify-center rounded-md py-1 " + (e.past ? "bg-gray-200 text-gray-500" : "bg-emerald-50 text-emerald-600")}>
                          <span className="text-[10px] font-bold uppercase leading-none">{["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Number(e.date.slice(5, 7)) - 1]}</span>
                          <span className="text-sm font-bold leading-tight">{Number(e.date.slice(8, 10))}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={"line-clamp-2 break-words text-[13px] leading-snug transition-colors duration-300 group-hover:text-indigo-600 " + (e.past ? "text-gray-600" : "font-medium text-gray-800")}>{calTitle}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {kws.map((k, ki) => (
                              <span key={ki} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 transition-colors duration-300 group-hover:bg-indigo-50 group-hover:text-indigo-600">{k}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    </React.Fragment>
                  )
                })}
              </div>
              </div>
              </div>
            </div>
          </div>
        </>
      )}
      {modal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" style={{ animation: modalClosing ? "backOut .24s ease both" : "backIn .24s ease both" }} onClick={closeModal}>
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ animation: modalClosing ? "modalOut .24s cubic-bezier(.4,0,1,1) both" : "modalIn .34s cubic-bezier(.22,1,.36,1) both" }}>
            <button type="button" onClick={closeModal} className="absolute right-4 top-4 z-10 shrink-0 rounded-full bg-white/80 p-1.5 text-gray-400 backdrop-blur transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="닫기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="min-w-0 pr-8">
              {modal.category ? <span className="text-[11px] font-semibold text-indigo-600">{modal.category}</span> : null}
              <h3 className="mt-0.5 text-lg font-bold leading-snug text-gray-900">{modal.title}</h3>
              <p className="mt-1 text-xs text-gray-400">{modal.source} · {modal.date}</p>
            </div>
            {modal.image ? (
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100 md:col-span-1 md:aspect-auto md:h-full md:min-h-[140px]">
                  <img src={modal.image} alt="" className="h-full w-full object-cover" onError={(ev) => { const el = ev.currentTarget.parentElement; if (el) el.style.display = "none" }} />
                </div>
                <div className="min-w-0 md:col-span-2">
                  {modal.summary ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">본문 요약</p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-700">{modal.summary}</p>
                    </>
                  ) : null}
                </div>
              </div>
            ) : modal.summary ? (
              <div className="mt-4">
                {modal.isCal ? null : <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">본문 요약</p>}
                <p className={"leading-relaxed text-gray-700 " + (modal.isCal ? "text-[16px]" : "mt-1 text-sm")}>{modal.summary}</p>
              </div>
            ) : null}
            {modal.ai ? (
              <div className="mt-4 rounded-xl bg-indigo-50 p-4">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600"><span className="rounded bg-indigo-600 px-1 text-[10px] text-white">AI</span> 분석</p>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-700">{modal.ai}</p>
              </div>
            ) : null}
            {modal.url ? (
              <a href={modal.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-indigo-700">원문 보기 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17L17 7M17 7H8M17 7v9" /></svg></a>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}
