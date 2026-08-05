"use client"

import React from "react"
import { T } from "@/lib/i18n"

// 경쟁사 뷰 공용 프리미티브 — 포맷·라벨·DOE정규화·진열 세그먼트 + 드롭다운 컴포넌트.
// 여러 뷰(BoardView·PositioningMatrix·DealsView·AnomalyView·MoversView)에서 공유.

/** 카테고리 표시 라벨 — KO는 원문, EN은 통일 약자(REF·W/M·TV·RAC·All). 필터 키(한글)는 그대로 두고 '표시'만 전환. */
const CAT_ABBR_EN: Record<string, string> = { 전체: "All", 냉장고: "REF", 세탁기: "W/M", TV: "TV", 에어컨: "RAC", RAC: "RAC", SAC: "SAC", 오디오: "Audio", 기타: "Other" }
export const catLabel = (c: string): string => T(c, CAT_ABBR_EN[c] ?? c)

/** 세그먼트 — 유통 매장이 실제로 진열을 나누는 축(설치형태·도어·급) */
export const SEGMENTS: Record<string, { t: string; re: RegExp }[]> = {
  에어컨: [
    { t: "윈도우", re: /window/i },
    { t: "스플릿", re: /split|wall[- ]?mount/i },
    { t: "플로어·천장", re: /floor|ceiling|cassette/i },
    { t: "포터블", re: /portable/i },
    { t: "인버터", re: /inverter/i },
  ],
  냉장고: [
    { t: "양문형(SxS)", re: /side by side|sxs/i },
    { t: "상냉동", re: /top mount|two door|2 door/i },
    { t: "하냉동·프렌치", re: /bottom|french|multi ?door/i },
    { t: "인버터", re: /inverter/i },
  ],
  세탁기: [
    { t: "프론트로드", re: /front load/i },
    { t: "탑로드", re: /top load/i },
    { t: "트윈워시", re: /twin/i },
  ],
  TV: [
    { t: "OLED", re: /oled/i },
    { t: "QNED·NANO", re: /qned|nano/i },
    { t: "UHD·4K", re: /uhd|4k/i },
  ],
}

export const peso = (n: number | null) => (n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US"))
export const pct = (n: number | null) => (n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%")
export const md = (s: string | null) => (s ? s.slice(5).replace("-", "/") : "—")
export const deltaCol = (d: number | null) => (d == null || d === 0 ? "text-gray-400 dark:text-gray-500" : d < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")

export const pmMean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
export const pmTicks = (min: number, max: number, count = 5): number[] => {
  const range = (max - min) || 1, raw = range / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-6; v += step) out.push(v)
  return out
}
export const pmShort = (n: number) => (n >= 1000 ? "₱" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : "₱" + Math.round(n))

export const DOE_CODE: Record<string, string> = { "RAC": "acu", "SAC": "acu", "TV": "tvl", "냉장고": "ref", "세탁기": "cwm" }
const pmNorm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
// DOE 매칭용 카테고리 인지 정규화 — 에어컨(acu)은 리테일의 실내/실외기 프리픽스(HSN·HSU·HSN/U)를
//   DOE 등록코드(HS-12IPX3=HS+숫자)에 맞춰 HS로 접는다. 이 한 줄로 스플릿 AC 매칭 67%→91%.
export const doeNorm = (doeCode: string, s: string) => { const n = pmNorm(s); return doeCode === "acu" ? n.replace(/HS[NU]+/g, "HS") : n }
export const pmShopLabel = (s: string) => (s === "SM Appliance" ? "SM" : s === "Western Appliances" ? "Western" : s === "Robinsons Appliances" ? "Robinsons" : s)
export const pmStarCls = (s: number | null) => (s == null ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500" : s >= 4 ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : s >= 2 ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300")
// 가격대(tier) 라벨·색 — 엔트리=LOW(초록) · 미드=MED(파랑) · 프리미엄(주황)
export const pmTierLabel = (t: string) => (t === "프리미엄" ? T("프리미엄", "Premium") : t === "미드" ? "MED" : "LOW")
// 카드 왼쪽 세로 스트립 색 — 가격대 구분(배지 대신)
export const pmTierBar = (t: string) => (t === "프리미엄" ? "bg-amber-400 dark:bg-amber-500" : t === "미드" ? "bg-sky-400 dark:bg-sky-500" : "bg-emerald-400 dark:bg-emerald-500")

// 호버 드롭다운 선택 — 좌측 세로 메뉴(마우스 오버로 옵션 펼침)
export function PmDrop({ label, sel, options, onSelect }: { label: string; sel: string; options: { k: string; t: string }[]; onSelect: (k: string) => void }) {
  const cur = options.find((o) => o.k === sel)?.t ?? sel
  return (
    <div className="group relative shrink-0">
      <button type="button" className="flex w-full items-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-left transition-colors group-hover:border-indigo-300 dark:group-hover:border-indigo-500/40">
        <span className="shrink-0 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
        <span className="ml-1.5 whitespace-nowrap text-[12px] font-semibold text-gray-800 dark:text-gray-100">{cur}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 transition-transform duration-200 group-hover:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="invisible absolute left-0 top-[calc(100%-2px)] z-40 max-h-[280px] w-max min-w-full max-w-[280px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {options.map((o) => <button key={o.k} type="button" onClick={() => onSelect(o.k)} className={"block w-full whitespace-nowrap rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " + (o.k === sel ? "bg-indigo-600 font-semibold text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800")}>{o.t}</button>)}
      </div>
    </div>
  )
}

/** 복수선택 드롭다운 — PmDrop과 동일 톤 + 체크박스. sel=[] 이면 '전체'. 브랜드 등 다중 비교용. */
export function PmMultiDrop({ label, sel, options, onToggle, onClear, allLabel = T("전체", "All") }: { label: string; sel: string[]; options: { k: string; t: string }[]; onToggle: (k: string) => void; onClear: () => void; allLabel?: string }) {
  const cur = sel.length === 0 ? allLabel : sel.length === 1 ? (options.find((o) => o.k === sel[0])?.t ?? sel[0]) : sel.length + T("개 선택", " selected")
  return (
    <div className="group relative shrink-0">
      <button type="button" className="flex w-full items-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-left transition-colors group-hover:border-indigo-300 dark:group-hover:border-indigo-500/40">
        <span className="shrink-0 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
        <span className="ml-1.5 whitespace-nowrap text-[12px] font-semibold text-gray-800 dark:text-gray-100">{cur}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 transition-transform duration-200 group-hover:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="invisible absolute left-0 top-[calc(100%-2px)] z-40 max-h-[280px] w-max min-w-full max-w-[280px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <button type="button" onClick={onClear} className={"block w-full whitespace-nowrap rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " + (sel.length === 0 ? "bg-indigo-600 font-semibold text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800")}>{allLabel}</button>
        {options.map((o) => { const ck = sel.includes(o.k); return (
          <button key={o.k} type="button" onClick={() => onToggle(o.k)} className={"flex w-full items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " + (ck ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800")}>
            <span className={"flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors " + (ck ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 dark:border-gray-700")}>{ck && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}</span>
            {o.t}
          </button>
        ) })}
      </div>
    </div>
  )
}

/** 표준 리스트 검색 인풋 — 전 리스트(경쟁사 가격·이동·포지셔닝 등) 공용. 뉴스 검색과 폭·스타일 단일 소스.
 *  기본 320px, 포커스·입력 시 416px로 부드럽게 확장(뉴스와 동일). 폭을 개별 뷰에서 다르게 주지 말 것. */
export function ListSearch({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string
}) {
  const [focused, setFocused] = React.useState(false)
  return (
    <div className={"group relative " + className} style={{ width: focused || value ? 288 : 245, transition: "width .42s cubic-bezier(.22,1,.36,1)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder} aria-label={placeholder}
        className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-8 text-[13px] outline-none transition-[background,border,box-shadow] duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 hover:bg-white dark:hover:border-gray-700 dark:hover:bg-gray-900 focus:border-indigo-400 focus:bg-white focus:shadow-[0_0_0_3.5px_rgba(99,102,241,0.12)] dark:focus:border-indigo-500/50 dark:focus:bg-gray-950" />
      {value && <button type="button" onClick={() => onChange("")} aria-label={T("검색어 지우기", "Clear search")} className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-indigo-600 active:scale-90 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-indigo-400" style={{ animation: "fadeUp .2s ease both" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
    </div>
  )
}
