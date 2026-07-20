"use client"

import React, { useEffect, useMemo, useState } from "react"
import { competitorAds } from "@/lib/supabase"
import type { CompAd } from "@/lib/supabase"

/** 경쟁사 동향 — 경쟁 6개 브랜드 활성 광고를 진행중/새로시작/종료예정 3버킷으로.
 *  데이터: v_competitor_ads_board (Meta 광고 라이브러리 자체 수집). 카드 클릭 → 상세 팝업.
 *  색=신호: 진행중 emerald · 새로시작 indigo · 종료예정 amber.
 */

const BUCKETS: { key: string; label: string; cls: string; dot: string; hint: string }[] = [
  { key: "진행중", label: "진행중", cls: "text-emerald-700", dot: "bg-emerald-500", hint: "상시·기간 미정 광고. 계속 노출 중" },
  { key: "새로시작", label: "새로시작", cls: "text-indigo-700", dot: "bg-indigo-500", hint: "최근 7일 내 게재 시작한 신규 광고" },
  { key: "종료예정", label: "종료예정", cls: "text-amber-700", dot: "bg-amber-500", hint: "종료이이 명시된 세일·행사 (D-day)" },
]
const BRANDS = ["전체", "Samsung", "TCL", "Hisense", "Midea", "Sharp", "Panasonic"]
const AD_TYPE: Record<string, string> = { promo: "프로모", launch: "신제품", brand: "브랜드", roadshow: "로드쇼", other: "기타" }

const clean = (s: string | null | undefined) =>
  (s || "").replace(/&#8211;|&#8212;/g, "–").replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim()

function footer(a: CompAd) {
  if (a.days_to_end != null && a.days_to_end >= 0) return "종료 D-" + a.days_to_end
  if (a.ad_started_on) return "게재 " + (a.days_since_start != null ? a.days_since_start + "일차" : a.ad_started_on)
  return "상시"
}

function Card({ a, onOpen }: { a: CompAd; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-gray-900">{a.brand}</span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{AD_TYPE[a.ad_type] ?? a.ad_type}</span>
        {a.page_name !== a.brand && <span className="truncate text-[10px] text-gray-400">· {a.page_name}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-gray-800">{clean(a.headline)}</p>
      {a.offer && <span className="mt-1.5 inline-block rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{clean(a.offer)}</span>}
      <div className="mt-2 flex items-center gap-1.5 border-t border-gray-100 pt-2 text-[10.5px] text-gray-400">
        <span>{footer(a)}</span>
        {a.confidence && <span className="ml-auto">{a.confidence === "CONFIRMED" ? "확인" : "AI"}</span>}
      </div>
    </button>
  )
}

function Modal({ a, onClose }: { a: CompAd; onClose: () => void }) {
  const impl = a.body && a.body.includes("[실무]") ? a.body.split("[실무]") : null
  const bodyMain = impl ? clean(impl[0]) : clean(a.body)
  const bodyImpl = impl ? clean(impl.slice(1).join(" ")) : null
  const bk = BUCKETS.find((b) => b.key === a.status)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-2xl border border-gray-200 bg-white p-5 shadow-xl" style={{ animation: "popin .22s cubic-bezier(.22,1,.36,1) both" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-extrabold text-gray-900">{a.brand}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">{AD_TYPE[a.ad_type] ?? a.ad_type}</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">✕</button>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400">
          <span>{a.page_name}</span>
          {bk && <span className={"ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold " + bk.cls}><span className={"h-1.5 w-1.5 rounded-full " + bk.dot} />{bk.label}{a.days_to_end != null && a.days_to_end >= 0 ? " D-" + a.days_to_end : ""}</span>}
        </div>
        <p className="mt-3 text-[14px] font-bold leading-snug text-gray-900">{clean(a.headline)}</p>
        {a.offer && <span className="mt-2 inline-block rounded-md bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">{clean(a.offer)}</span>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-[12px] text-gray-500">
          {a.ad_started_on && <span>게재 시작 <b className="text-gray-700">{a.ad_started_on}</b>{a.days_since_start != null ? ` (${a.days_since_start}일차)` : ""}</span>}
          {a.ends_on && <span>종료 <b className="text-gray-700">{a.ends_on}</b></span>}
          {a.venue && <span>장소 <b className="text-gray-700">{a.venue}</b></span>}
        </div>
        {bodyMain && <div className="mt-3 rounded-lg bg-gray-50 p-3 text-[12.5px] leading-relaxed text-gray-700">{bodyMain}</div>}
        {bodyImpl && <div className="mt-2 rounded-lg bg-indigo-50/60 p-3 text-[12.5px] leading-relaxed text-indigo-800"><b>[실무]</b> {bodyImpl}</div>}
        <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-400">출처 Meta 광고 라이브러리(자체 수집) · {a.confidence || "—"}{a.ad_url ? " · 상세 링크 보유" : ""}</p>
      </div>
    </div>
  )
}

export default function Page() {
  const [ads, setAds] = useState<CompAd[] | null>(null)
  const [brand, setBrand] = useState("전체")
  const [sel, setSel] = useState<CompAd | null>(null)

  useEffect(() => {
    competitorAds().then(setAds).catch(() => setAds([]))
  }, [])

  const filtered = useMemo(() => (ads ?? []).filter((a) => brand === "전체" || a.brand === brand), [ads, brand])
  const brandCount = (b: string) => (ads ?? []).filter((a) => b === "전체" || a.brand === b).length
  const bucket = (k: string) => filtered.filter((a) => a.status === k).sort((a, b) => (a.days_to_end ?? 999) - (b.days_to_end ?? 999))

  return (
    <main className="px-4 pb-10 pt-3 sm:px-6">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes popin{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}"}</style>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[18px] font-extrabold text-gray-900">경쟁사 동향 <span className="text-[11px] font-medium text-gray-400">· Meta 광고 라이브러리 · 활성 광고</span></h1>
        <p className="text-[10.5px] text-gray-400">주간 수집 · 경쟁 6개 브랜드</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {BRANDS.map((b) => (
          <button key={b} onClick={() => setBrand(b)} className={"rounded-lg border px-2.5 py-1 text-[12px] transition-colors " + (brand === b ? "border-transparent bg-indigo-50 font-bold text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
            {b} <span className={brand === b ? "text-indigo-400" : "text-gray-400"}>{brandCount(b)}</span>
          </button>
        ))}
      </div>

      {ads === null ? (
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {BUCKETS.map((bk) => {
            const list = bucket(bk.key)
            return (
              <div key={bk.key} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-2.5">
                <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
                  <span className={"h-2 w-2 rounded-full " + bk.dot} />
                  <span className={"text-[13px] font-bold " + bk.cls}>{bk.label}</span>
                  <span className="ml-auto text-[12px] font-semibold text-gray-400">{list.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {list.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-[11px] leading-relaxed text-gray-400">{bk.hint}<br />해당 광고 없음</div>
                  ) : list.map((a, i) => (
                    <div key={a.brand + a.headline + i} style={{ animation: "fadeUp .35s ease both", animationDelay: (Math.min(i, 12) * 40) + "ms" }}>
                      <Card a={a} onOpen={() => setSel(a)} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-4 text-[10.5px] leading-relaxed text-gray-400">색=상태 신호(진행중 emerald·새로시작 indigo·종료예정 amber) · 종료일은 문구/세일명 명시분만 · 게재 시작일은 Meta 게재 시작 기준</p>

      {sel && <Modal a={sel} onClose={() => setSel(null)} />}
    </main>
  )
}
