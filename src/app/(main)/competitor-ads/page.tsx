"use client"

import React, { useEffect, useState } from "react"
import { competitorAds, pageBanner } from "@/lib/supabase"
import type { CompAd } from "@/lib/supabase"
import { ListSearch } from "@/components/competitors/shared"
import { Segmented } from "@/components/Segmented"
import { InsightBanner, type Banner } from "@/components/InsightBanner"
import { T } from "@/lib/i18n"

/** 경쟁사 동향 — 좌측 체크박스 패싯 사이드바(브랜드·성격·제품·상태 멀티선택) + 상단 게재월 스테퍼·정렬 토글.
 *  3열 반응형 썸네일 갤러리(image_url 없으면 브랜드 이니셜). 카드 클릭 → 심플 팝업. 제목 한글.
 *  DESIGN.md §2·§3 모션·모달, 색=신호. 데이터: v_competitor_ads_board.
 */

type St = { key: string; label: string; text: string; dot: string; band: string }
const STATUS: St[] = [
  { key: "진행중", label: "진행중", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", band: "bg-emerald-50 dark:bg-emerald-500/10" },
  { key: "새로시작", label: "새로시작", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500", band: "bg-indigo-50 dark:bg-indigo-500/10" },
  { key: "종료예정", label: "종료예정", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500", band: "bg-amber-50 dark:bg-amber-500/10" },
  { key: "종료", label: "종료됨", text: "text-gray-500 dark:text-gray-400", dot: "bg-gray-400 dark:bg-gray-500", band: "bg-gray-100 dark:bg-gray-800" },
]
const stOf = (s: string) => STATUS.find((x) => x.key === s)
const stLabel = (k: string) =>
  k === "진행중" ? T("진행중", "Active") :
  k === "새로시작" ? T("새로시작", "New") :
  k === "종료예정" ? T("종료예정", "Ending soon") :
  k === "종료" ? T("종료됨", "Ended") : k
const BRANDS = ["Samsung", "TCL", "Hisense", "Midea", "Sharp", "Panasonic"]
const TYPES = [
  { k: "brand", label: "브랜드" }, { k: "promo", label: "프로모" }, { k: "launch", label: "신제품" },
  { k: "campaign", label: "캠페인" }, { k: "event", label: "행사" }, { k: "other", label: "기타" },
]
const AD_TYPE: Record<string, string> = { promo: "프로모", launch: "신제품", brand: "브랜드", campaign: "캠페인", event: "행사", roadshow: "로드쇼", other: "기타" }
const AD_TYPE_EN: Record<string, string> = { promo: "Promo", launch: "New model", brand: "Brand", campaign: "Campaign", event: "Event", roadshow: "Roadshow", other: "Other" }
const adTypeLabel = (k: string) => (AD_TYPE[k] ? T(AD_TYPE[k], AD_TYPE_EN[k] ?? AD_TYPE[k]) : k)
const PRODS = ["에어컨(RAC)", "TV·AV", "세탁·건조", "냉장고", "에어케어", "기타"]
// 표시 라벨(키는 로직 유지) — 정확매칭 + 데이터 변형(bare "에어컨" 등) 정규식 폴백으로 EN 잔여 한글 방지
const prodLabel = (c: string) => {
  const s = c || ""
  if (s === "에어컨(RAC)" || /에어컨|aircon|air ?con|\brac\b/i.test(s)) return T("에어컨", "RAC")
  if (s === "TV·AV" || /\btv\b|\bav\b|텔레비/i.test(s)) return T("TV·AV", "TV·AV")
  if (s === "세탁·건조" || /세탁|건조|laundry|washer|dryer/i.test(s)) return T("세탁·건조", "Laundry")
  if (s === "냉장고" || /냉장|refriger|\bref\b/i.test(s)) return T("냉장고", "REF")
  if (s === "에어케어" || /에어케어|air ?care|공기청정|청정기/i.test(s)) return T("에어케어", "Air Care")
  if (s === "기타" || /기타|other/i.test(s) || !s) return T("기타", "Other")
  return T(s, s)
}
const clean = (s: string | null | undefined) =>
  (s || "").replace(/&#8211;|&#8212;/g, "–").replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim()
const ymLabel = (ym: string) => T(Number(ym.slice(0, 4)) + "년 " + Number(ym.slice(5, 7)) + "월", Number(ym.slice(5, 7)) + "/" + Number(ym.slice(0, 4)))

type Opt = { value: string; label: string; count: number; dot?: string }
function Facet({ title, options, selected, onToggle }: { title: string; options: Opt[]; selected: string[]; onToggle: (v: string) => void }) {
  if (options.length === 0) return null
  return (
    <div className="py-2">
      <div className="mb-1 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</div>
      <div className="flex flex-col">
        {options.map((o, i) => {
          const ck = selected.includes(o.value)
          return (
            <button key={o.value} onClick={() => onToggle(o.value)} style={{ animation: "fadeUp .35s ease both", animationDelay: (Math.min(i, 8) * 25) + "ms" }} className="group flex items-center gap-2 rounded-md px-1.5 py-[6px] text-left text-[12.5px] font-medium transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 active:scale-[.98] hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
              <span className={"flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors " + (ck ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 dark:border-gray-700 group-hover:border-gray-400")}>
                {ck && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
              </span>
              {o.dot && <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + o.dot} />}
              <span className={"flex-1 truncate " + (ck ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-200")}>{o.label}</span>
              <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">{o.count}</span>
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
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-indigo-50 dark:bg-indigo-500/10">
      {showImg
        ? <img src={a.image_url || ""} alt="" loading="lazy" decoding="async" onError={() => setErr(true)} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-indigo-500 to-violet-600"><span className="text-[19px] font-bold tracking-tight text-white">{a.brand}</span><span className="text-[9px] font-medium text-white/70">{T("광고 이미지 없음", "No ad image")}</span></div>}
      {st && st.key !== "진행중" && (
        <span className={"absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/85 dark:bg-gray-900/85 px-2 py-0.5 text-[9px] font-bold " + st.text}>
          <span className={"h-1.5 w-1.5 rounded-full " + st.dot} />
          {a.days_to_end != null && a.days_to_end >= 0 ? "D-" + a.days_to_end : stLabel(st.key)}
        </span>
      )}
      <span className="absolute bottom-0 left-0 bg-white/60 dark:bg-gray-900/60 px-1.5 py-0.5 text-[8px] font-medium text-gray-600 dark:text-gray-300">{prodLabel(a.category || "기타")}</span>
    </div>
  )
}

function period(a: CompAd) {
  if (a.days_to_end != null && a.days_to_end >= 0) return T("종료 D-", "Ends D-") + a.days_to_end
  if (a.ad_started_on) return a.days_since_start != null ? T("게재 " + a.days_since_start + "일차", "Posted · day " + a.days_since_start) : T("게재 " + a.ad_started_on, "Posted " + a.ad_started_on)
  return T("상시", "Always-on")
}
const briefBody = (b: string | null) => clean((b || "").split("[실무]")[0])
const offerShort = (o: string | null) => clean(o).replace(/\s*\([^)]*\)\s*$/, "")

/** 요약 한 덩어리를 문단으로 — 뉴스 모달과 동일 규칙(문장 단위, ~170자 병합) */
function para(s: string): string[] {
  if (!s) return []
  const out: string[] = []
  for (const x of s.split(/(?<=[.。!?])\s+/)) {
    const last = out[out.length - 1]
    if (last && (last + x).length < 170) out[out.length - 1] = last + " " + x
    else out.push(x)
  }
  return out
}

function Hi({ text, q }: { text: string; q: string }) {
  const k = q.trim()
  if (!k || !text) return <>{text}</>
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = String(text).split(new RegExp("(" + esc + ")", "gi"))
  return <>{parts.map((p, i) => p.toLowerCase() === k.toLowerCase() ? <mark key={i} className="rounded-sm bg-yellow-200 dark:bg-yellow-500/30 px-0.5 text-gray-900 dark:text-gray-50">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>)}</>
}

function Card({ a, onOpen, q = "" }: { a: CompAd; onOpen: () => void; q?: string }) {
  const conf = a.confidence === "CONFIRMED" ? T("확인", "Verified") : a.confidence ? "AI" : ""
  const openSrc = (e: React.MouseEvent) => { e.stopPropagation(); if (a.ad_url) window.open(a.ad_url, "_blank", "noopener") }
  const brief = briefBody(a.body)
  const ended = a.status === "종료"
  return (
    <button onClick={onOpen} className={"group flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 text-left transition-all duration-300 ease-out hover:-translate-y-px hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md active:scale-[.99] " + (ended ? "opacity-70 hover:opacity-100" : "")}>
      <Thumb a={a} />
      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold tracking-tight text-gray-900 dark:text-gray-50"><Hi text={a.brand} q={q} /></span>
          <span className="rounded border border-gray-200 dark:border-gray-800 px-1.5 py-0.5 text-[9.5px] font-medium text-gray-500 dark:text-gray-400">{adTypeLabel(a.ad_type)}</span>
          {/* P4 신뢰 신호 — 상단 상시 노출 */}
          {conf && <span className={"ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold " + (a.confidence === "CONFIRMED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")}>{conf}</span>}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-gray-800 dark:text-gray-100"><Hi text={clean(a.headline)} q={q} /></p>
        {a.offer && <span className="mt-1.5 max-w-full self-start truncate rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300"><Hi text={offerShort(a.offer)} q={q} /></span>}
        {brief && <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-gray-500 dark:text-gray-400"><Hi text={brief} q={q} /></p>}
        <div className="mt-auto flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] text-gray-400 dark:text-gray-500">
          {a.venue ? (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg><span className="truncate"><Hi text={a.venue} q={q} /></span></>
          ) : (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg><span>{period(a)}</span></>
          )}
          {a.ad_url ? (
            <span onClick={openSrc} className="ml-auto inline-flex items-center gap-0.5 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">{T("원문", "Source")}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10" /></svg></span>
          ) : (
            /* P5 클릭 어포던스 — 상세 열림 표시 */
            <span className="ml-auto inline-flex items-center gap-0.5 text-gray-300 transition-colors duration-300 group-hover:text-indigo-500 dark:text-gray-600 dark:group-hover:text-indigo-400">{T("자세히", "Details")}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-0.5"><path d="M9 6l6 6-6 6" /></svg></span>
          )}
        </div>
      </div>
    </button>
  )
}

/** 경쟁사 광고 상세 — 뉴스·정책 모달과 동일 레이아웃(좌 액센트 바 · 200px 히어로 · 시사점/본문 요약 · 원문 버튼).
 *  색은 상태 신호(진행중 emerald·새로시작 indigo·종료예정 amber)로 액센트 바에만. 애니메이션도 뉴스와 동일. */
function Modal({ a, onClose }: { a: CompAd; onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const st = stOf(a.status)
  const impl = a.body && a.body.includes("[실무]") ? a.body.split("[실무]") : null
  const bodyMain = impl ? clean(impl[0]) : clean(a.body)
  const bodyImpl = impl ? clean(impl.slice(1).join(" ")) : null
  const close = () => { setClosing(true); setTimeout(onClose, 240) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const showImg = !!a.image_url && !imgErr
  const meta: string[] = []
  if (a.ad_started_on) meta.push(T("게재 ", "Posted ") + a.ad_started_on + (a.days_since_start != null ? " (" + a.days_since_start + T("일차", "d") + ")" : ""))
  if (a.ends_on) meta.push(T("종료 ", "Ends ") + a.ends_on + (a.days_to_end != null && a.days_to_end >= 0 ? " (D-" + a.days_to_end + ")" : ""))
  meta.push(T("제품 ", "Product ") + prodLabel(a.category || "기타"))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
      style={{ animation: closing ? "veilOut .24s ease both" : "veilIn .24s ease both" }}
      onClick={close}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[0.06] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] dark:bg-gray-900 dark:ring-white/10"
        style={{ animation: closing ? "popOut .22s cubic-bezier(.4,0,1,1) both" : "popIn .44s cubic-bezier(.34,1.42,.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label={T("닫기", "Close")}
          className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-gray-600 backdrop-blur transition-all duration-200 hover:bg-black/10 hover:text-gray-900 active:scale-90 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 dark:hover:text-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {/* 히어로 — 광고 이미지, 없으면 브랜드 그라디언트 폴백 */}
        <div className="relative h-[200px] w-full shrink-0 overflow-hidden">
          {showImg ? (
            <img src={a.image_url || ""} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setImgErr(true)} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-indigo-500 to-violet-600">
              <span className="text-[27px] font-bold tracking-tight text-white">{a.brand}</span>
              <span className="text-[10px] font-medium text-white/70">{T("광고 이미지 없음", "No ad image")}</span>
            </div>
          )}
          {st && (
            <span className={"absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 px-2.5 py-1 text-[11px] font-bold backdrop-blur " + st.text}>
              <span className={"h-1.5 w-1.5 rounded-full " + st.dot} />
              {stLabel(st.key)}{a.days_to_end != null && a.days_to_end >= 0 ? " D-" + a.days_to_end : ""}
            </span>
          )}
        </div>

        <div className="overflow-y-auto px-6 pb-6 pt-5">
          {/* 메타 — iOS 캡션 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{a.brand}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>{adTypeLabel(a.ad_type)}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="num">{a.ad_started_on || T("상시", "Always-on")}</span>
          </div>

          {/* 제목 — iOS large title */}
          <h3 className="mt-2.5 text-[22px] font-bold leading-[1.3] tracking-[-0.01em] text-gray-900 dark:text-gray-50">{clean(a.headline)}</h3>

          {a.offer && (
            <span className="mt-3 inline-block rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-100 dark:ring-emerald-500/20">{clean(a.offer)}</span>
          )}

          {/* 시사점 — iOS 틴티드 콜아웃 카드 */}
          {bodyImpl && (
            <div className="mt-4 rounded-2xl bg-indigo-50/80 p-4 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/10 dark:ring-indigo-500/20">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{T("시사점", "Implication")}</p>
              <p className="mt-1.5 text-[14px] font-medium leading-[1.7] text-gray-800 dark:text-gray-100">{bodyImpl}</p>
            </div>
          )}

          {/* 본문 요약 — iOS 그룹 카드 */}
          {bodyMain && (
            <div className="mt-3.5 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("본문 요약", "Summary")}</p>
              <div className="mt-2 space-y-2.5">
                {para(bodyMain).map((p, i) => (
                  <p key={i} className="text-[13px] leading-[1.75] text-gray-600 dark:text-gray-300">{p}</p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 px-1">
            <p className="text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">{meta.join(" · ")}</p>
            <p className="mt-1 text-[10.5px] text-gray-400 dark:text-gray-500">{T("Meta 광고 라이브러리(자체 수집)", "Meta Ad Library (self-collected)")} · {a.confidence || "—"}</p>
          </div>

          {/* 원문 — iOS 풀폭 버튼 */}
          {a.ad_url && (
            <a
              href={a.ad_url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-3 text-[13.5px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-all duration-300 ease-[cubic-bezier(.34,1.42,.64,1)] hover:-translate-y-0.5 hover:bg-indigo-700 active:scale-[.98]"
            >
              {T("원문 광고 보기", "View original ad")} · {a.brand}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H8M17 7v9" /></svg>
            </a>
          )}
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
  const [sitOpen, setSitOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState("latest")
  const [q, setQ] = useState("")
  const [sel, setSel] = useState<CompAd | null>(null)
  /** 배너 폴백 — 매니페스트(public/banners.json) 로드 실패 시 표시(주간 자동 갱신 대상) */
  const ADS_BANNER: Banner = {
    title: T("성수기 TV·에어컨 경쟁 집중", "Peak-season TV·AC competition intensifies"),
    summary: T("Samsung 가격딜·TCL 신모델 무이자·Hisense 월드컵 브랜딩", "Samsung price deals · TCL 0% installment on new models · Hisense World Cup branding"),
    body: T("성수기 진입과 함께 경쟁사 광고가 **TV·에어컨**에 집중되는 흐름. **Samsung**은 비전 AI TV를 대형 할인+사운드바로 **가격 공세**, **TCL**은 인버터 에어컨 신모델을 무이자 할부로 밀며 **신제품+금융** 카드, **Hisense**는 월드컵 스폰서십으로 **브랜딩** 상향 시도.", "As peak season begins, competitor advertising is concentrating on **TV·AC**. **Samsung** is running a **price offensive** on its Vision AI TV with steep discounts plus soundbars; **TCL** is pushing new inverter AC models on interest-free installments — a **new-product + financing** play; **Hisense** is lifting **brand** presence via World Cup sponsorship."),
    insight: T("TV 성수기 프로모 강도·번들 점검, 에어컨 할부조건 경쟁력 확인, 중가 브랜드 상향 시도 주시.", "Review peak-season TV promo intensity and bundles, verify AC installment competitiveness, and watch mid-tier brands moving upmarket."),
    insightLabel: T("LG 대응", "LG response"),
    period: "2026-W31",
  }
  const [banner, setBanner] = useState<Banner>(ADS_BANNER)

  useEffect(() => { competitorAds().then(setAds).catch(() => setAds([])) }, [])
  useEffect(() => { pageBanner("competitor-ads").then((b) => { if (b) setBanner(b as Banner) }).catch(() => {}) }, [])

  const all = ads ?? []
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat([v]))
  const cnt = (pred: (a: CompAd) => boolean) => all.filter(pred).length

  const months = Array.from(new Set(all.map((a) => (a.ad_started_on ? a.ad_started_on.slice(0, 7) : "")).filter(Boolean))).sort((x, y) => y.localeCompare(x))
  const monthSel = monthIdx >= 0 && monthIdx < months.length ? months[monthIdx] : null

  const inArr = (arr: string[], v: string) => arr.length === 0 || arr.includes(v)
  const qq = q.trim().toLowerCase()
  const matchQ = (a: CompAd) => !qq || [a.brand, a.headline, a.body, a.offer, a.venue, a.category, AD_TYPE[a.ad_type]].some((s) => (s || "").toLowerCase().includes(qq))
  const filtered = all.filter((a) =>
    inArr(fBrand, a.brand) && inArr(fType, a.ad_type) && inArr(fProd, a.category || "기타") && inArr(fStat, a.status) && matchQ(a) &&
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
  // 검색어 일치 개수(뉴스와 동일한 'N곳 일치')
  const hits = qq ? shown.reduce((s, a) => s + [a.brand, a.headline, a.body, a.offer, a.venue].reduce((t, f) => t + ((f || "").toLowerCase().split(qq).length - 1), 0), 0) : 0

  const brandOpts: Opt[] = BRANDS.map((b) => ({ value: b, label: b, count: cnt((a) => a.brand === b) })).filter((o) => o.count > 0)
  const typeOpts: Opt[] = TYPES.map((t) => ({ value: t.k, label: adTypeLabel(t.k), count: cnt((a) => a.ad_type === t.k) })).filter((o) => o.count > 0)
  const prodOpts: Opt[] = PRODS.map((p) => ({ value: p, label: prodLabel(p), count: cnt((a) => (a.category || "기타") === p) })).filter((o) => o.count > 0)
  const statOpts: Opt[] = STATUS.map((s) => ({ value: s.key, label: stLabel(s.key), count: cnt((a) => a.status === s.key), dot: s.dot })).filter((o) => o.count > 0)

  const anyFilter = fBrand.length + fType.length + fProd.length + fStat.length > 0 || monthSel !== null
  const clearAll = () => { setFBrand([]); setFType([]); setFProd([]); setFStat([]); setMonthIdx(-1) }

    const PER_PAGE = 24
  const totalPages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const curPage = Math.min(page, totalPages)
  const paged = shown.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE)
  useEffect(() => { setPage(1) }, [fBrand, fType, fProd, fStat, monthSel, sort, q])

    const _today = new Date().toISOString().slice(0, 10)
  const _maxDate = ads ? ads.reduce((m, x) => { const d = x.ad_started_on || ""; return d && d <= _today && d > m ? d : m }, "") : ""
  const _fresh = _maxDate ? _maxDate.slice(5).replace("-", "/") : ""

  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes backIn{from{opacity:0}to{opacity:1}}@keyframes backOut{from{opacity:1}to{opacity:0}}@keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}@keyframes modalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.98)}}"}</style>

      <div className="grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-7">
        <aside style={{animation:"fadeUp .5s ease both"}} className="h-fit py-2 lg:sticky lg:top-[61px] scroll-soft lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-gray-100 lg:dark:border-gray-800/70 lg:pr-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-2 py-2.5">
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></svg>
              <span className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{T("필터", "Filters")}</span>
            </span>
            {anyFilter && <button onClick={clearAll} className="text-[10.5px] text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400">{T("초기화", "Reset")}</button>}
          </div>
          <Facet title={T("브랜드", "Brand")} options={brandOpts} selected={fBrand} onToggle={(v) => toggle(fBrand, setFBrand, v)} />
          <div className="mx-1.5 h-px bg-gray-100 dark:bg-gray-800" />
          <Facet title={T("제품", "Product")} options={prodOpts} selected={fProd} onToggle={(v) => toggle(fProd, setFProd, v)} />
          <div className="mx-1.5 h-px bg-gray-100 dark:bg-gray-800" />
          <Facet title={T("카테고리", "Category")} options={typeOpts} selected={fType} onToggle={(v) => toggle(fType, setFType, v)} />
          <div className="mx-1.5 h-px bg-gray-100 dark:bg-gray-800" />
          <Facet title={T("상태", "Status")} options={statOpts} selected={fStat} onToggle={(v) => toggle(fStat, setFStat, v)} />
        </aside>

        <div className="min-w-0" style={{animation:"fadeUp .5s ease both"}}>
          <div className="mb-4"><InsightBanner banner={banner} open={sitOpen} onToggle={() => setSitOpen((v) => !v)} /></div>

        <div className="relative mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-2.5"><div className="flex shrink-0 items-center gap-3"><Segmented value={sort} onChange={(k) => setSort(k)} options={[{ k: "latest", label: T("최신순", "Latest") }, { k: "ending", label: T("종료임박순", "Ending soon") }]} size="sm" /><div className="inline-flex items-center gap-1 rounded-full bg-gray-200/80 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] dark:bg-gray-800/80 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"><button onClick={() => setMonthIdx(-1)} className={"h-7 rounded-full px-3 text-[12px] font-semibold transition-all duration-200 active:scale-[.93] " + (monthSel === null ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.04)] text-gray-900 dark:bg-gray-950 dark:text-gray-50" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}>{T("전체", "All")}</button><button onClick={() => setMonthIdx((i) => Math.min((i < 0 ? -1 : i) + 1, months.length - 1))} aria-label={T("이전 달", "Previous month")} disabled={months.length === 0 || monthIdx >= months.length - 1} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition-colors hover:bg-white dark:hover:bg-gray-900 disabled:opacity-30"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button><span className={"min-w-[92px] px-1 text-center text-[12px] font-semibold " + (monthSel ? "text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-500")}>{monthSel ? ymLabel(monthSel) : T("전체 기간", "All periods")}</span><button onClick={() => setMonthIdx((i) => (i <= 0 ? 0 : i - 1))} aria-label={T("다음 달", "Next month")} disabled={monthIdx <= 0} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition-colors hover:bg-white dark:hover:bg-gray-900 disabled:opacity-30"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button></div></div><div className="flex shrink-0 items-center gap-3"><ListSearch value={q} onChange={setQ} placeholder={T("브랜드 · 제목 · 프로모 · 장소 검색", "Search brand · title · promo · venue")} className="hidden lg:block" /><span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-700 dark:text-gray-200">{shown.length}{T("건", "")}</b>{qq ? <span>· {hits}{T("곳 일치", " matches")}</span> : null}{_maxDate ? <>· {T("최신", "Updated")} {_fresh}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></> : null}</span></div></div>

          <div key={(ads === null ? "L" : "R") + fBrand.join() + fType.join() + fProd.join() + fStat.join() + String(monthSel) + sort + q} style={{ animation: "viewIn .42s cubic-bezier(.22,1,.36,1) both" }}>
          {ads === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" />)}</div>
          ) : shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-16 text-center text-[12px] text-gray-400 dark:text-gray-500">{qq ? T("검색 결과 없음", "No results") : T("해당 조건의 광고 없음", "No ads match these filters")}</div>
          ) : (
            <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paged.map((a, i) => (
                <div key={a.brand + a.headline + i} style={{ animation: "fadeUp .45s ease both", animationDelay: (Math.min(i, 16) * 30) + "ms" }}>
                  <Card a={a} onOpen={() => setSel(a)} q={q} />
                </div>
              ))}
            </div>
            {totalPages > 1 ? (<div className="mt-4 flex items-center justify-center gap-1 border-t border-gray-100 dark:border-gray-800 pt-3"><button type="button" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} className="rounded-md border border-gray-200 dark:border-gray-800 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0">{T("이전", "Prev")}</button>{Array.from({ length: totalPages }, (_, k) => k + 1).map((p) => (<button key={p} type="button" onClick={() => setPage(p)} className={"min-w-[26px] rounded-md px-1.5 py-1 text-[11px] font-medium transition-all duration-300 ease-out active:scale-95 " + (p === curPage ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300 hover:-translate-y-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400")}>{p}</button>))}<button type="button" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} className="rounded-md border border-gray-200 dark:border-gray-800 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0">{T("다음", "Next")}</button></div>) : null}
            </>
          )}
          </div>

          <p className="mt-5 text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">{T("색=상태 신호(진행중 emerald·새로시작 indigo·종료예정 amber) · 썸네일 없으면 브랜드 이니셜 · 제목 한글 번역 · 클릭 시 상세", "Color = status signal (active emerald · new indigo · ending soon amber) · brand initials when no thumbnail · Korean-translated titles · click for detail")}</p>
        </div>
      </div>

      {sel && <Modal a={sel} onClose={() => setSel(null)} />}
    </main>
  )
}
