"use client"

import React, { useEffect, useState } from "react"
import { competitorAds } from "@/lib/supabase"
import type { CompAd } from "@/lib/supabase"

/** 경쟁사 동향 — 좌측 체크박스 패싯 사이드바(브랜드·성격·제품·상태 멀티선택) + 상단 게재월 스테퍼·정렬 토글.
 *  3열 반응형 썸네일 갤러리(image_url 없으면 브랜드 이니셜). 카드 클릭 → 심플 팝업. 제목 한글.
 *  DESIGN.md §2·§3 모션·모달, 색=신호. 데이터: v_competitor_ads_board.
 */

type St = { key: string; label: string; text: string; dot: string; band: string }
const STATUS: St[] = [
  { key: "진행중", label: "진행중", text: "text-emerald-700", dot: "bg-emerald-500", band: "bg-emerald-50" },
  { key: "새로시작", label: "새로시작", text: "text-indigo-700", dot: "bg-indigo-500", band: "bg-indigo-50" },
  { key: "종료예정", label: "종료예정", text: "text-amber-700", dot: "bg-amber-500", band: "bg-amber-50" },
]
const stOf = (s: string) => STATUS.find((x) => x.key === s)
const BRANDS = ["Samsung", "TCL", "Hisense", "Midea", "Sharp", "Panasonic"]
const TYPES = [
  { k: "brand", label: "브랜드" }, { k: "promo", label: "프로모" }, { k: "launch", label: "신제품" },
  { k: "campaign", label: "캠페인" }, { k: "event", label: "행사" }, { k: "other", label: "기타" },
]
const AD_TYPE: Record<string, string> = { promo: "프로모", launch: "신제품", brand: "브랜드", campaign: "캠페인", event: "행사", roadshow: "로드쇼", other: "기타" }
const PRODS = ["에어컨(RAC)", "TV·AV", "세탁·건조", "냉장고", "에어케어", "기타"]
const prodLabel = (c: string) => (c === "에어컨(RAC)" ? "에어컨" : c)
const initials = (s: string) => (s || "").trim().slice(0, 2).toUpperCase()
const clean = (s: string | null | undefined) =>
  (s || "").replace(/&#8211;|&#8212;/g, "–").replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim()
const ymLabel = (ym: string) => Number(ym.slice(0, 4)) + "년 " + Number(ym.slice(5, 7)) + "월"

type Opt = { value: string; label: string; count: number; dot?: string }
function Facet({ title, options, selected, onToggle }: { title: string; options: Opt[]; selected: string[]; onToggle: (v: string) => void }) {
  if (options.length === 0) return null
  return (
    <div className="py-2">
      <div className="mb-1 px-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">{title}</div>
      <div className="flex flex-col">
        {options.map((o, i) => {
          const ck = selected.includes(o.value)
          return (
            <button key={o.value} onClick={() => onToggle(o.value)} style={{ animation: "fadeUp .35s ease both", animationDelay: (Math.min(i, 8) * 25) + "ms" }} className="group flex items-center gap-2 rounded-md px-1.5 py-[5px] text-left text-[12px] transition-colors hover:bg-indigo-50/50">
              <span className={"flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors " + (ck ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 group-hover:border-gray-400")}>
                {ck && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>}
              </span>
              {o.dot && <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + o.dot} />}
              <span className={"flex-1 truncate " + (ck ? "font-semibold text-indigo-700" : "text-gray-700")}>{o.label}</span>
              <span className="text-[10px] tabular-nums text-gray-400">{o.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Thumb({ a }: { a: CompAd }) {
  const [err, setErr] = useState(false)
  const st = stOf(a.status)
  const showImg = !!a.image_url && !err
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-indigo-50">
      {showImg
        ? <img src={a.image_url || ""} alt="" onError={() => setErr(true)} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-indigo-500 to-violet-600"><span className="text-[20px] font-bold tracking-tight text-white">{a.brand}</span><span className="text-[9px] font-medium text-white/70">광고 이미지 없음</span></div>}
      {st && (
        <span className={"absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-bold " + st.text}>
          <span className={"h-1.5 w-1.5 rounded-full " + st.dot} />
          {a.days_to_end != null && a.days_to_end >= 0 ? "D-" + a.days_to_end : st.label}
        </span>
      )}
      <span className="absolute bottom-0 left-0 bg-white/60 px-1.5 py-0.5 text-[8px] font-medium text-gray-600">{prodLabel(a.category || "기타")}</span>
    </div>
  )
}

function period(a: CompAd) {
  if (a.days_to_end != null && a.days_to_end >= 0) return "종료 D-" + a.days_to_end
  if (a.ad_started_on) return "게재 " + (a.days_since_start != null ? a.days_since_start + "일차" : a.ad_started_on)
  return "상시"
}
const briefBody = (b: string | null) => clean((b || "").split("[실무]")[0])
const offerShort = (o: string | null) => clean(o).replace(/\s*\([^)]*\)\s*$/, "")

function Card({ a, onOpen }: { a: CompAd; onOpen: () => void }) {
  const conf = a.confidence === "CONFIRMED" ? "확인" : a.confidence ? "AI" : ""
  const openSrc = (e: React.MouseEvent) => { e.stopPropagation(); if (a.ad_url) window.open(a.ad_url, "_blank", "noopener") }
  const brief = briefBody(a.body)
  return (
    <button onClick={onOpen} className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-px hover:border-indigo-300 hover:shadow-md active:scale-[.99]">
      <Thumb a={a} />
      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold tracking-tight text-gray-900">{a.brand}</span>
          <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[9.5px] font-medium text-gray-500">{AD_TYPE[a.ad_type] ?? a.ad_type}</span>
          {a.ad_url && (
            <span onClick={openSrc} aria-label="원문 보기" className="ml-auto text-gray-300 transition-colors hover:text-indigo-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            </span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-gray-800">{clean(a.headline)}</p>
        {a.offer && <span className="mt-1.5 max-w-full self-start truncate rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">{offerShort(a.offer)}</span>}
        {brief && <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-gray-500">{brief}</p>}
        <div className="mt-auto flex items-center gap-1.5 border-t border-gray-100 pt-2 text-[10px] text-gray-400">
          {a.venue ? (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg><span className="truncate">{a.venue}</span></>
          ) : (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg><span>{period(a)}</span></>
          )}
          {a.ad_url ? (
            <span onClick={openSrc} className="ml-auto inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-700">원문<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10" /></svg></span>
          ) : conf ? <span className="ml-auto">{conf}</span> : null}
        </div>
      </div>
    </button>
  )
}

function Modal({ a, onClose }: { a: CompAd; onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const st = stOf(a.status)
  const impl = a.body && a.body.includes("[실무]") ? a.body.split("[실무]") : null
  const bodyMain = impl ? clean(impl[0]) : clean(a.body)
  const bodyImpl = impl ? clean(impl.slice(1).join(" ")) : null
  const close = () => { setClosing(true); setTimeout(onClose, 230) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const meta: string[] = []
  if (a.ad_started_on) meta.push("게재 " + a.ad_started_on + (a.days_since_start != null ? " (" + a.days_since_start + "일차)" : ""))
  if (a.ends_on) meta.push("종료 " + a.ends_on + (a.days_to_end != null && a.days_to_end >= 0 ? " (D-" + a.days_to_end + ")" : ""))
  meta.push("제품 " + prodLabel(a.category || "기타"))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-gray-900/40 p-4 backdrop-blur-sm sm:p-8" style={{ animation: (closing ? "backOut" : "backIn") + " .22s ease both" }} onClick={close}>
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: (closing ? "modalOut" : "modalIn") + " .34s cubic-bezier(.22,1,.36,1) both" }} onClick={(e) => e.stopPropagation()}>
        <div className={"flex items-center justify-between gap-3 px-5 py-3.5 " + (st ? st.band : "bg-gray-50")}>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tracking-tight text-gray-900">{a.brand}</span>
            <span className="rounded border border-gray-300/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{AD_TYPE[a.ad_type] ?? a.ad_type}</span>
            {st && <span className={"inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold " + st.text}><span className={"h-1.5 w-1.5 rounded-full " + st.dot} />{st.label}{a.days_to_end != null && a.days_to_end >= 0 ? " D-" + a.days_to_end : ""}</span>}
          </div>
          <button onClick={close} aria-label="닫기" className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-white/60 hover:text-gray-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[14px] font-bold leading-snug text-gray-900">{clean(a.headline)}</p>
          {a.offer && <span className="mt-2.5 inline-block rounded-md bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">{clean(a.offer)}</span>}
          <p className="mt-3 border-t border-gray-100 pt-3 text-[11.5px] leading-relaxed text-gray-500">{meta.join(" · ")}</p>
          {bodyMain && <div className="mt-3 rounded-xl bg-gray-50 p-3.5 text-[12.5px] leading-relaxed text-gray-700">{bodyMain}</div>}
          {bodyImpl && <div className="mt-2.5 rounded-xl bg-indigo-50/70 p-3.5 text-[12.5px] leading-relaxed text-indigo-800"><span className="font-bold">실무</span> {bodyImpl}</div>}
          <p className="mt-3 text-[10.5px] text-gray-400">Meta 광고 라이브러리(자체 수집) · {a.confidence || "—"}</p>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [ads, setAds] = useState<CompAd[] | null>(null)
  const [fBrand, setFBrand] = useState<string[]>([])
  const [fType, setFType] = useState<string[]>([])
  const [fProd, setFProd] = useState<string[]>([])
  const [fStat, setFStat] = useState<string[]>([])
  const [monthIdx, setMonthIdx] = useState(-1)
  const [sort, setSort] = useState("latest")
  const [sel, setSel] = useState<CompAd | null>(null)

  useEffect(() => { competitorAds().then(setAds).catch(() => setAds([])) }, [])

  const all = ads ?? []
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat([v]))
  const cnt = (pred: (a: CompAd) => boolean) => all.filter(pred).length

  const months = Array.from(new Set(all.map((a) => (a.ad_started_on ? a.ad_started_on.slice(0, 7) : "")).filter(Boolean))).sort((x, y) => y.localeCompare(x))
  const monthSel = monthIdx >= 0 && monthIdx < months.length ? months[monthIdx] : null

  const inArr = (arr: string[], v: string) => arr.length === 0 || arr.includes(v)
  const filtered = all.filter((a) =>
    inArr(fBrand, a.brand) && inArr(fType, a.ad_type) && inArr(fProd, a.category || "기타") && inArr(fStat, a.status) &&
    (monthSel === null || (a.ad_started_on || "").slice(0, 7) === monthSel),
  )
  const shown = filtered.slice().sort((a, b) => {
    if (sort === "ending") return (a.days_to_end ?? 9999) - (b.days_to_end ?? 9999)
    const ax = a.ad_started_on || "", bx = b.ad_started_on || ""
    if (ax && bx) return bx.localeCompare(ax)
    if (ax) return -1
    if (bx) return 1
    return 0
  })

  const brandOpts: Opt[] = BRANDS.map((b) => ({ value: b, label: b, count: cnt((a) => a.brand === b) })).filter((o) => o.count > 0)
  const typeOpts: Opt[] = TYPES.map((t) => ({ value: t.k, label: t.label, count: cnt((a) => a.ad_type === t.k) })).filter((o) => o.count > 0)
  const prodOpts: Opt[] = PRODS.map((p) => ({ value: p, label: prodLabel(p), count: cnt((a) => (a.category || "기타") === p) })).filter((o) => o.count > 0)
  const statOpts: Opt[] = STATUS.map((s) => ({ value: s.key, label: s.label, count: cnt((a) => a.status === s.key), dot: s.dot })).filter((o) => o.count > 0)

  const anyFilter = fBrand.length + fType.length + fProd.length + fStat.length > 0 || monthSel !== null
  const clearAll = () => { setFBrand([]); setFType([]); setFProd([]); setFStat([]); setMonthIdx(-1) }

  return (
    <main className="mx-auto max-w-[1536px] px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}@keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.98)}}"}</style>

      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white px-2 py-2 shadow-sm lg:sticky lg:top-[80px]">
          <div className="flex items-center justify-between px-1.5 pb-1">
            <span className="text-[13px] font-bold tracking-tight text-gray-900">필터</span>
            {anyFilter && <button onClick={clearAll} className="text-[10.5px] text-gray-400 hover:text-indigo-600">초기화</button>}
          </div>
          <Facet title="브랜드" options={brandOpts} selected={fBrand} onToggle={(v) => toggle(fBrand, setFBrand, v)} />
          <div className="mx-1.5 h-px bg-gray-100" />
          <Facet title="광고 성격" options={typeOpts} selected={fType} onToggle={(v) => toggle(fType, setFType, v)} />
          <div className="mx-1.5 h-px bg-gray-100" />
          <Facet title="제품별" options={prodOpts} selected={fProd} onToggle={(v) => toggle(fProd, setFProd, v)} />
          <div className="mx-1.5 h-px bg-gray-100" />
          <Facet title="상태" options={statOpts} selected={fStat} onToggle={(v) => toggle(fStat, setFStat, v)} />
        </aside>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button onClick={() => setMonthIdx(-1)} className={"rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors " + (monthSel === null ? "border-indigo-200 bg-indigo-50 font-bold text-indigo-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50")}>전체</button>
            <div className="inline-flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white">
              <button onClick={() => setMonthIdx((i) => Math.min((i < 0 ? -1 : i) + 1, months.length - 1))} aria-label="이전 달" className="flex h-8 w-7 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30" disabled={months.length === 0 || monthIdx >= months.length - 1}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <span className={"min-w-[104px] border-x border-gray-200 px-2 text-center text-[12px] font-semibold " + (monthSel ? "text-indigo-700" : "text-gray-400")}>{monthSel ? ymLabel(monthSel) : "전체 기간"}</span>
              <button onClick={() => setMonthIdx((i) => (i <= 0 ? 0 : i - 1))} aria-label="다음 달" className="flex h-8 w-7 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30" disabled={monthIdx <= 0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </div>
            <span className="text-[10.5px] text-gray-400">게재월</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[11px] text-gray-400">조건 일치 <b className="font-semibold text-gray-700">{shown.length}건</b></span>
              <div className="flex shrink-0 gap-0.5 rounded-lg bg-gray-100 p-0.5">
                {[["latest", "최신순"], ["ending", "종료임박순"]].map(([k, l]) => (
                  <button key={k} onClick={() => setSort(k)} className={"rounded-md px-2.5 py-1 text-[12px] transition-all duration-300 ease-out " + (sort === k ? "bg-white font-bold text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-800")}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {ads === null ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />)}</div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-[12px] text-gray-400">해당 조건의 광고 없음</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((a, i) => (
                <div key={a.brand + a.headline + i} style={{ animation: "fadeUp .45s ease both", animationDelay: (Math.min(i, 16) * 30) + "ms" }}>
                  <Card a={a} onOpen={() => setSel(a)} />
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 text-[10.5px] leading-relaxed text-gray-400">색=상태 신호(진행중 emerald·새로시작 indigo·종료예정 amber) · 썸네일 없으면 브랜드 이니셜 · 제목 한글 번역 · 클릭 시 상세</p>
        </div>
      </div>

      {sel && <Modal a={sel} onClose={() => setSel(null)} />}
    </main>
  )
}
