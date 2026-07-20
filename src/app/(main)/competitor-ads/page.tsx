"use client"

import React, { useEffect, useMemo, useState } from "react"
import { competitorAds } from "@/lib/supabase"
import type { CompAd } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"

/** 경쟁사 동향 — 경쟁 6개 브랜드 활성 광고.
 *  필터: 브랜드(상단 Segmented) · 광고 성격(좌측 메뉴) · 상태(pill) · 게재월(pill). 고른 것만 카드로.
 *  카드/모달=DESIGN.md §3·§4, 모션 §2. 색=신호. 데이터: v_competitor_ads_board.
 */

type Bucket = { key: string; label: string; text: string; dot: string; bar: string; band: string; hint: string }
const BUCKETS: Bucket[] = [
  { key: "진행중", label: "진행중", text: "text-emerald-700", dot: "bg-emerald-500", bar: "bg-emerald-500", band: "bg-emerald-50", hint: "상시·기간 미정 광고 · 계속 노출 중" },
  { key: "새로시작", label: "새로시작", text: "text-indigo-700", dot: "bg-indigo-500", bar: "bg-indigo-500", band: "bg-indigo-50", hint: "최근 7일 내 게재 시작한 신규 광고" },
  { key: "종료예정", label: "종료예정", text: "text-amber-700", dot: "bg-amber-500", bar: "bg-amber-500", band: "bg-amber-50", hint: "종료일 명시된 세일·행사 · D-day" },
]
const BRANDS = ["전체", "Samsung", "TCL", "Hisense", "Midea", "Sharp", "Panasonic"]
const CATS: { key: string; type: string | null; label: string; sub: string }[] = [
  { key: "all", type: null, label: "전체", sub: "모든 광고" },
  { key: "brand", type: "brand", label: "브랜드", sub: "브랜드 인지·이미지" },
  { key: "promo", type: "promo", label: "프로모", sub: "할인·번들·세일" },
  { key: "launch", type: "launch", label: "신제품", sub: "런칭·출시" },
  { key: "campaign", type: "campaign", label: "캠페인", sub: "통합 마케팅" },
  { key: "event", type: "event", label: "행사", sub: "매장행사·로드쇼" },
  { key: "other", type: "other", label: "기타", sub: "분류 외" },
]
const STATI: { key: string; label: string }[] = [
  { key: "전체", label: "전체" },
  { key: "진행중", label: "진행중" },
  { key: "새로시작", label: "새로시작" },
  { key: "종료예정", label: "종료예정" },
]
const AD_TYPE: Record<string, string> = { promo: "프로모", launch: "신제품", brand: "브랜드", campaign: "캠페인", event: "행사", roadshow: "로드쇼", other: "기타" }
const initials = (s: string) => (s || "").trim().slice(0, 2).toUpperCase()

const clean = (s: string | null | undefined) =>
  (s || "").replace(/&#8211;|&#8212;/g, "–").replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim()

function footer(a: CompAd) {
  if (a.days_to_end != null && a.days_to_end >= 0) return "종료 D-" + a.days_to_end
  if (a.ad_started_on) return "게재 " + (a.days_since_start != null ? a.days_since_start + "일차" : a.ad_started_on)
  return "상시"
}

function Card({ a, bk, onOpen }: { a: CompAd; bk: Bucket | undefined; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex h-full w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-px hover:border-indigo-300 hover:shadow-md active:scale-[.99]"
    >
      <span className={"w-1 shrink-0 " + (bk ? bk.bar : "bg-gray-300")} />
      <span className="min-w-0 flex-1 p-3.5">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[9.5px] font-bold text-indigo-600">{initials(a.brand)}</span>
          <span className="text-[13px] font-bold tracking-tight text-gray-900">{a.brand}</span>
          <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{AD_TYPE[a.ad_type] ?? a.ad_type}</span>
          {bk && (
            <span className={"ml-auto inline-flex items-center gap-1 text-[10px] font-semibold " + bk.text}>
              <span className={"h-1.5 w-1.5 rounded-full " + bk.dot} />
              {a.days_to_end != null && a.days_to_end >= 0 ? "D-" + a.days_to_end : bk.label}
            </span>
          )}
        </span>
        <span className="mt-2 block line-clamp-2 text-[12.5px] font-medium leading-snug text-gray-800">{clean(a.headline)}</span>
        {a.offer && (
          <span className="mt-2 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{clean(a.offer)}</span>
        )}
        <span className="mt-2.5 flex items-center gap-1.5 border-t border-gray-100 pt-2 text-[10.5px] text-gray-400">
          <span>{footer(a)}</span>
          {a.confidence && <span className="ml-auto">{a.confidence === "CONFIRMED" ? "확인" : "AI"}</span>}
        </span>
      </span>
    </button>
  )
}

function Modal({ a, onClose }: { a: CompAd; onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const bk = BUCKETS.find((b) => b.key === a.status)
  const impl = a.body && a.body.includes("[실무]") ? a.body.split("[실무]") : null
  const bodyMain = impl ? clean(impl[0]) : clean(a.body)
  const bodyImpl = impl ? clean(impl.slice(1).join(" ")) : null
  const close = () => { setClosing(true); setTimeout(onClose, 230) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-gray-900/40 p-4 backdrop-blur-sm sm:p-8"
      style={{ animation: (closing ? "backOut" : "backIn") + " .22s ease both" }}
      onClick={close}
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: (closing ? "modalOut" : "modalIn") + " .34s cubic-bezier(.22,1,.36,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"px-5 pb-4 pt-4 " + (bk ? bk.band : "bg-gray-50")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-[11px] font-bold text-gray-700">{initials(a.brand)}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold tracking-tight text-gray-900">{a.brand}</span>
                  <span className="rounded border border-gray-300/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{AD_TYPE[a.ad_type] ?? a.ad_type}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">{a.page_name}</div>
              </div>
            </div>
            <button onClick={close} aria-label="닫기" className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/60 hover:text-gray-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          {bk && (
            <span className={"mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold " + bk.text}>
              <span className={"h-1.5 w-1.5 rounded-full " + bk.dot} />
              {bk.label}{a.days_to_end != null && a.days_to_end >= 0 ? " · D-" + a.days_to_end : ""}
            </span>
          )}
        </div>

        <div className="px-5 py-4">
          <p className="text-[14px] font-bold leading-snug text-gray-900">{clean(a.headline)}</p>
          {a.offer && (
            <span className="mt-2.5 inline-block rounded-md bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">{clean(a.offer)}</span>
          )}

          <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-gray-100 pt-3.5">
            {a.ad_started_on && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">게재 시작</div>
                <div className="mt-0.5 text-[12.5px] font-semibold text-gray-800">{a.ad_started_on}{a.days_since_start != null ? <span className="font-normal text-gray-400"> · {a.days_since_start}일차</span> : null}</div>
              </div>
            )}
            {a.ends_on && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">종료일</div>
                <div className="mt-0.5 text-[12.5px] font-semibold text-gray-800">{a.ends_on}</div>
              </div>
            )}
            {a.venue && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">장소</div>
                <div className="mt-0.5 text-[12.5px] font-semibold text-gray-800">{a.venue}</div>
              </div>
            )}
          </div>

          {bodyMain && (
            <div className="mt-3.5 rounded-xl bg-gray-50 p-3.5 text-[12.5px] leading-relaxed text-gray-700">{bodyMain}</div>
          )}
          {bodyImpl && (
            <div className="mt-2.5 rounded-xl bg-indigo-50/70 p-3.5 text-[12.5px] leading-relaxed text-indigo-800">
              <span className="font-bold">실무</span> {bodyImpl}
            </div>
          )}
          <p className="mt-3.5 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-[10.5px] text-gray-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
            Meta 광고 라이브러리(자체 수집) · {a.confidence || "—"}{a.ad_url ? " · 상세 링크 보유" : ""}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [ads, setAds] = useState<CompAd[] | null>(null)
  const [brand, setBrand] = useState("전체")
  const [cat, setCat] = useState("all")
  const [stat, setStat] = useState("전체")
  const [month, setMonth] = useState("전체")
  const [sel, setSel] = useState<CompAd | null>(null)

  useEffect(() => {
    competitorAds().then(setAds).catch(() => setAds([]))
  }, [])

  const catType = CATS.find((c) => c.key === cat)?.type ?? null
  const mMatch = (a: CompAd, m: string) => m === "전체" || (m === "상시" ? !a.ad_started_on : (a.ad_started_on ?? "").slice(0, 7) === m)
  const filtered = useMemo(
    () => (ads ?? []).filter((a) => (brand === "전체" || a.brand === brand) && (catType === null || a.ad_type === catType) && mMatch(a, month)),
    [ads, brand, catType, month],
  )
  const catCount = (c: { type: string | null }) => (ads ?? []).filter((a) => (brand === "전체" || a.brand === brand) && mMatch(a, month) && (c.type === null || a.ad_type === c.type)).length
  const statusCount = (k: string) => filtered.filter((a) => k === "전체" || a.status === k).length
  const bkOf = (s: string) => BUCKETS.find((b) => b.key === s)
  const PRIO: Record<string, number> = { 종료예정: 0, 새로시작: 1, 진행중: 2 }
  const shown = filtered
    .filter((a) => stat === "전체" || a.status === stat)
    .sort((a, b) => (PRIO[a.status] ?? 9) - (PRIO[b.status] ?? 9) || (a.days_to_end ?? 999) - (b.days_to_end ?? 999))

  const months = (() => {
    const set = new Set<string>()
    let sangsi = false
    for (const a of (ads ?? [])) { if (a.ad_started_on) set.add(a.ad_started_on.slice(0, 7)); else sangsi = true }
    const arr = Array.from(set).sort((x, y) => y.localeCompare(x))
    const opts = ["전체", ...arr]
    if (sangsi) opts.push("상시")
    return opts
  })()
  const monthLabel = (m: string) => (m === "전체" ? "전체" : m === "상시" ? "상시" : m.slice(0, 4) + "." + m.slice(5, 7))
  const monthCount = (m: string) => (ads ?? []).filter((a) => (brand === "전체" || a.brand === brand) && (catType === null || a.ad_type === catType) && mMatch(a, m)).length

  return (
    <main className="mx-auto max-w-[1536px] px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}@keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.98)}}"}</style>

      <div className="mb-4 overflow-x-auto pb-0.5">
        <Segmented value={brand} onChange={setBrand} options={BRANDS.map((b) => ({ k: b, label: b }))} size="sm" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-[88px]">
          <div className="px-2.5 py-3">
            <div className="mb-2 px-1.5 text-[14px] font-bold tracking-tight text-gray-900">광고 성격</div>
            <div className="flex flex-col gap-0.5">
              {CATS.map((c, i) => {
                const on = cat === c.key
                const n = catCount(c)
                return (
                  <button
                    key={c.key}
                    onClick={() => setCat(c.key)}
                    style={{ animation: "fadeUp .4s ease both", animationDelay: (i * 40) + "ms" }}
                    className={"group w-full rounded-lg px-2.5 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " + (on ? "bg-indigo-50 ring-1 ring-indigo-100" : "hover:bg-indigo-50/40")}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={"flex-1 text-[13px] " + (on ? "font-bold text-indigo-700" : "font-semibold text-gray-800 group-hover:text-gray-900")}>{c.label}</span>
                      <span className={"shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums " + (on ? "bg-indigo-100 text-indigo-600" : n === 0 ? "bg-gray-50 text-gray-300" : "bg-gray-100 text-gray-500")}>{n}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-gray-400">{c.sub}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {STATI.map((s) => {
              const on = stat === s.key
              const bk = bkOf(s.key)
              return (
                <button
                  key={s.key}
                  onClick={() => setStat(s.key)}
                  className={"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] transition-all duration-300 ease-out active:scale-95 " + (on ? "border-transparent bg-indigo-50 font-bold text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:-translate-y-px hover:border-indigo-200")}
                >
                  {bk && <span className={"h-1.5 w-1.5 rounded-full " + bk.dot} />}
                  {s.label}
                  <span className={on ? "text-indigo-400" : "text-gray-400"}>{statusCount(s.key)}</span>
                </button>
              )
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 flex items-center gap-1 text-[11px] font-semibold text-gray-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
              게재월
            </span>
            {months.map((m) => {
              const on = month === m
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={"inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] tabular-nums transition-all duration-300 ease-out active:scale-95 " + (on ? "border-transparent bg-indigo-50 font-bold text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:-translate-y-px hover:border-indigo-200")}
                >
                  {monthLabel(m)}
                  <span className={on ? "text-indigo-400" : "text-gray-400"}>{monthCount(m)}</span>
                </button>
              )
            })}
          </div>

          {ads === null ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />)}</div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-[12px] text-gray-400">해당 조건의 광고 없음</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((a, i) => (
                <div key={a.brand + a.headline + i} style={{ animation: "fadeUp .5s ease both", animationDelay: (Math.min(i, 14) * 35) + "ms" }}>
                  <Card a={a} bk={bkOf(a.status)} onOpen={() => setSel(a)} />
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 text-[10.5px] leading-relaxed text-gray-400">색=상태 신호(진행중 emerald·새로시작 indigo·종료예정 amber) · 종료일은 문구/세일명 명시분만 · 게재 시작일은 Meta 게재 시작 기준</p>
        </div>
      </div>

      {sel && <Modal a={sel} onClose={() => setSel(null)} />}
    </main>
  )
}

