"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { energyLabels, latestMacro, brandPriceRanges, type EnergyRow, type PriceRange } from "@/lib/supabase"
import { PmDrop, PmMultiDrop } from "@/components/competitors/shared"
import { T } from "@/lib/i18n"

/** 에너지 효율 — 전문기관 수준 분석. 카테고리×설치형×냉매×용량 세그먼트별 브랜드 효율·등급·전력비용(TCO). */

/** 화면에 보일 지표(차트) 선택 — 채널별 가격비교식 드롭다운 필터. Sub이 이 컨텍스트를 읽어 선택된 idx만 렌더. */
const ActiveMetricCtx = React.createContext<number | null>(null)
// 지표 필터 옵션(idx → 라벨). idx는 각 Sub의 idx와 일치. 냉매(5)는 에어컨만 노출.
const METRICS: { idx: number; ko: string; en: string; acuOnly?: boolean }[] = [
  { idx: 0, ko: "브랜드 효율 랭킹", en: "Efficiency Ranking" },
  { idx: 1, ko: "효율↔월전력", en: "Efficiency ↔ Power" },
  { idx: 2, ko: "용량대별 LG vs 시장", en: "LG vs Market by Capacity" },
  { idx: 3, ko: "월 전기요금(TCO)", en: "Monthly Bill (TCO)" },
  { idx: 4, ko: "브랜드 등급 분포", en: "Grade Distribution" },
  { idx: 5, ko: "냉매 믹스(GWP)", en: "Refrigerant Mix", acuOnly: true },
  { idx: 6, ko: "효율 분포", en: "Efficiency Distribution" },
  { idx: 7, ko: "용량↔효율 지형", en: "Capacity ↔ Efficiency" },
  { idx: 8, ko: "브랜드 포지셔닝", en: "Brand Positioning" },
  { idx: 9, ko: "브랜드별 가격대", en: "Price Range by Brand" },
]

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF", specUnit: "냉방용량" },
  { key: "ref", label: "냉장고", metric: "EEF", specUnit: "용량" },
  { key: "tvl", label: "TV", metric: "EER", specUnit: "화면" },
]
const CAT_EN: Record<string, string> = { acu: "RAC", ref: "REF", tvl: "TV" }
const SEG: Record<string, { k: string; lo: number; hi: number }[]> = {
  acu: [{ k: "소형(≤0.8HP)", lo: 0, hi: 2.5 }, { k: "1HP급", lo: 2.5, hi: 3.4 }, { k: "1.5HP급", lo: 3.4, hi: 5.2 }, { k: "2HP급", lo: 5.2, hi: 6.9 }, { k: "2.5HP급", lo: 6.9, hi: 8.5 }, { k: "3HP+", lo: 8.5, hi: Infinity }],
  ref: [{ k: "~150L", lo: 0, hi: 150 }, { k: "150~249L", lo: 150, hi: 250 }, { k: "250~349L", lo: 250, hi: 350 }, { k: "350~449L", lo: 350, hi: 450 }, { k: "450L+", lo: 450, hi: Infinity }],
  tvl: [{ k: '~32"', lo: 0, hi: 33 }, { k: '39~43"', lo: 33, hi: 44 }, { k: '48~50"', lo: 44, hi: 51 }, { k: '55~60"', lo: 51, hi: 61 }, { k: '65"+', lo: 61, hi: Infinity }],
}
function typeOf(cat: string, s: string): string {
  const t = (s || "").toLowerCase()
  if (cat === "acu") { if (t.includes("window")) return "창문형"; if (t.includes("wall")) return "벽걸이형"; if (t.includes("cassette")) return "천장카세트"; if (t.includes("floor")) return "스탠드"; if (t.includes("ceiling") || t.includes("suspend")) return "천장형"; return "기타" }
  if (cat === "ref") { if (t.includes("frost free")) return "간냉식"; if (t.includes("defrost")) return "직냉식"; return "기타" }
  return "전체"
}
const TEAL = "#0d9488", GRAY = "#cbd5e1", AMBER = "#f59e0b"

/** 전기요금 시뮬레이터 — 브랜드 선택 + 사용강도·요금 조정 → 월/연 요금·LG 대비 절감(DOE 표준 월소비전력 기반) */
function EnergySim({ brands, lgKwh, rate0 }: { brands: { name: string; kwh: number }[]; lgKwh: number | null; rate0: number }) {
  const [sel, setSel] = useState<string>("")
  const [mult, setMult] = useState(1)
  const [rate, setRate] = useState(rate0)
  useEffect(() => { setRate(rate0) }, [rate0])
  const pick = brands.find((b) => b.name === sel) || brands[0]
  if (!pick) return <div className="flex h-40 items-center justify-center text-[12px] text-gray-400">{T("세그먼트 데이터 부족", "No segment data")}</div>
  const kwh = pick.kwh * mult
  const mo = Math.round(kwh * rate), yr = Math.round(kwh * rate * 12)
  const lgMo = lgKwh != null ? Math.round(lgKwh * mult * rate) : null
  const saveYr = lgMo != null ? (mo - lgMo) * 12 : null
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400">{T("브랜드/모델(세그먼트 평균)", "Brand/Model (segment average)")}</span>
          <select value={pick.name} onChange={(e) => setSel(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 outline-none focus:border-teal-400">
            {brands.map((b) => <option key={b.name} value={b.name}>{b.name} · {Math.round(b.kwh)}{T("kWh/월", "kWh/mo")}</option>)}
          </select></label>
        <label className="block"><span className="mb-1 flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400"><span>{T("사용강도", "Usage intensity")}</span><span className="text-teal-600 dark:text-teal-400">{mult.toFixed(2)}× {mult < 1 ? T("(가벼움)", "(light)") : mult > 1 ? T("(많음)", "(heavy)") : T("(표준)", "(standard)")}</span></span>
          <input type="range" min="0.5" max="2" step="0.05" value={mult} onChange={(e) => setMult(+e.target.value)} className="w-full accent-teal-600" /></label>
        <label className="block"><span className="mb-1 flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400"><span>{T("전기요금 ₱/kWh", "Electricity rate ₱/kWh")}</span></span>
          <input type="number" step="0.1" value={rate} onChange={(e) => setRate(+e.target.value || 0)} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 outline-none focus:border-teal-400" /></label>
      </div>
      <div className="flex flex-col justify-center gap-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-4">
        <div className="flex items-baseline justify-between"><span className="text-[12px] text-gray-500 dark:text-gray-400">{T("월 예상 소비전력", "Est. monthly consumption")}</span><span className="text-[14.5px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{Math.round(kwh)} kWh</span></div>
        <div className="flex items-baseline justify-between border-t border-gray-100 dark:border-gray-800 pt-2.5"><span className="text-[12px] text-gray-500 dark:text-gray-400">{T("월 전기요금", "Monthly bill")}</span><span className="text-[23.5px] font-extrabold tabular-nums text-teal-700 dark:text-teal-300">₱{mo.toLocaleString()}</span></div>
        <div className="flex items-baseline justify-between"><span className="text-[12px] text-gray-500 dark:text-gray-400">{T("연 전기요금", "Annual bill")}</span><span className="text-[14.5px] font-bold tabular-nums text-gray-800 dark:text-gray-100">₱{yr.toLocaleString()}</span></div>
        {lgMo != null && !/^lg$/i.test(pick.name) && <div className="mt-1 rounded-lg bg-teal-50 dark:bg-teal-500/10 px-3 py-2 text-[12px] leading-relaxed text-teal-800 dark:text-teal-200">{T("같은 사용조건에서 ", "At the same usage, switching to ")}<b>LG</b>{T("로 바꾸면 월 ", ": monthly ")}<b>₱{Math.abs(mo - lgMo).toLocaleString()}</b>{T(", 연 ", ", yearly ")}<b>₱{Math.abs(saveYr!).toLocaleString()}</b> {saveYr! > 0 ? T("절감", "saved") : T("더 듦", "added")}{T(" · 고효율 소구 포인트", " · high-efficiency selling point")}</div>}
        {/^lg$/i.test(pick.name) && <div className="mt-1 text-[11px] text-gray-400">{T("LG 모델 기준 · 다른 브랜드 선택 시 LG 절감액 비교", "LG baseline · pick another brand to compare LG savings")}</div>}
      </div>
    </div>
  )
}

// 스크롤로 화면에 들어올 때 애니메이션 재생 — 마운트 시 한 번만 재생돼 놓치는 문제 해소.
// 중요: 기존 1.5s 강제 on 안전장치는 '화면 밖' 하단 카드(전기요금 TCO·등급·냉매)의 진입 애니메이션을
// 스크롤 전에 오프스크린으로 재생시켜 버려, 실제로 보일 땐 이미 끝나 있어 애니메이션이 '안 됨'처럼 보였음.
// → 안전장치를 60초로 늦춰(스크롤로 진작 IO 발화) 정상 스크롤 리빌 보장 + IO 미지원 시에만 즉시 on.
function useInView() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return }
    let done = false
    const t = { id: 0 }
    const fire = () => { if (done) return; done = true; setOn(true); io.disconnect(); clearTimeout(t.id) }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) fire() }, { threshold: 0.01, rootMargin: "0px 0px -30px 0px" })
    io.observe(el)
    // 초기 가시성 즉시 판정 — 마운트 시 이미 화면 안이면 바로 on(IO 초기 콜백 누락으로 빈 화면 되던 버그 방지).
    // 화면 밖 카드는 여기서 걸리지 않고 IO가 스크롤 진입 시 발화 → 애니메이션이 실제 보일 때 재생.
    const r = el.getBoundingClientRect()
    if (r.top < (window.innerHeight || document.documentElement.clientHeight) && r.bottom > 0) fire()
    else t.id = window.setTimeout(fire, 8000) // 최후 안전장치(스크롤로 진작 IO 발화되므로 실질 미발동)
    return () => { io.disconnect(); clearTimeout(t.id) }
  }, [])
  return [ref, on] as const
}

type CsvData = { head: string[]; rows: (string | number)[][] }
function dlImgFrom(el: HTMLElement | null, name: string) {
  const svg = el?.querySelector("svg"); if (!svg) return
  const c = svg.cloneNode(true) as SVGElement; c.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  const b = new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml;charset=utf-8" })
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name + ".svg"; a.click(); URL.revokeObjectURL(a.href)
}
function dlCsvFrom(csv: CsvData, name: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const text = [csv.head.map(esc).join(","), ...csv.rows.map((r) => r.map(esc).join(","))].join("\n")
  const b = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name + ".csv"; a.click(); URL.revokeObjectURL(a.href)
}
const IcoBtn = ({ onClick, title, d, fill = false }: { onClick: () => void; title: string; d: string; fill?: boolean }) => (
  <button type="button" onClick={onClick} title={title} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-teal-600 dark:hover:bg-gray-800 dark:hover:text-teal-400">
    <svg width="13" height="13" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  </button>
)
const ICO = { expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', csv: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 21h16"/>' }

function Sub({ title, seg, meaning, ai, idx = 0, csv, children, bigChildren }: { title: string; seg?: string; meaning: React.ReactNode; ai?: React.ReactNode; idx?: number; csv?: CsvData; children: React.ReactNode; bigChildren?: React.ReactNode }) {
  const [ref, on] = useInView()
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [big, setBig] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [sortCol, setSortCol] = useState(1) // 기본: 첫 값 컬럼(지표값) 내림차순 정렬
  const [sortDesc, setSortDesc] = useState(true)
  const pNum = (v: string | number) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : null }
  const sortedRows = (() => {
    if (!csv) return [] as (string | number)[][]
    if (sortCol < 0) return csv.rows
    const rows = [...csv.rows]
    rows.sort((a, b) => { const an = pNum(a[sortCol]), bn = pNum(b[sortCol]); let c: number; if (an != null && bn != null) c = an - bn; else c = String(a[sortCol]).localeCompare(String(b[sortCol])); return sortDesc ? -c : c })
    return rows
  })()
  const activeIdx = React.useContext(ActiveMetricCtx)
  if (activeIdx != null && idx !== activeIdx) return null // 지표 필터: 선택된 차트만 표시
  return (
    <>
    <div ref={(el) => { cardRef.current = el; (ref as React.MutableRefObject<HTMLDivElement | null>).current = el }} className="flex h-full flex-col rounded-xl p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animation: on ? "fadeUp .5s cubic-bezier(.22,1,.36,1) both" : undefined, animationDelay: Math.min(idx, 6) * 0.06 + "s", opacity: on ? undefined : 0 }}>
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded bg-indigo-500" />
        <h3 className="text-[22.5px] font-bold leading-tight tracking-tight text-gray-800 dark:text-gray-100">{title}</h3>
        {seg && <span className="shrink-0 rounded bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">{seg}</span>}
        {csv && (
          <button type="button" onClick={() => dlCsvFrom(csv, "에너지_" + title)} aria-label={T("데이터(CSV) 다운로드", "Download data (CSV)")} title={T("데이터(CSV) 다운로드", "Download data (CSV)")} className="ml-auto flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 transition-all duration-200 hover:border-teal-300 dark:hover:border-teal-500/40 hover:text-teal-600 dark:hover:text-teal-400 active:scale-95">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
          </button>
        )}
      </div>
      {/* 인라인 확대 레이아웃 — 좌: 큰 차트+의미·인사이트 / 우: 정렬 가능한 데이터 표 */}
      <div className="mt-2 flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-col lg:w-[58%]">
          {/* 메인 차트 — 테두리·고정높이, 넘치면 스크롤(레이아웃 고정·가독성) */}
          <div key={on ? "in" : "out"} className="h-[352px] overflow-auto rounded-xl border border-gray-100 bg-gray-50/30 p-3 dark:border-gray-800 dark:bg-gray-900/20">{on ? (bigChildren ?? children) : null}</div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {meaning}</p>
        </div>
        {csv && (
          <div className="flex min-h-0 flex-col lg:w-[42%] lg:border-l lg:border-gray-100 lg:dark:border-gray-800 lg:pl-4">
            <div className="h-[352px] min-h-0 overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900"><tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="w-8 py-2 px-2 text-center font-semibold text-gray-400 dark:text-gray-500">#</th>
                  {csv.head.map((h, i) => <th key={i} onClick={() => { if (sortCol === i) setSortDesc((d) => !d); else { setSortCol(i); setSortDesc(true) } }} className={"cursor-pointer select-none py-2 px-2 font-semibold text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 " + (i === 0 ? "text-left" : "text-right")}>{h}{sortCol === i ? (sortDesc ? " ↓" : " ↑") : ""}</th>)}
                </tr></thead>
                <tbody>{sortedRows.map((r, ri) => { const isLg = /^lg$/i.test(String(r[0])); return <tr key={ri} className={"border-b border-gray-100 dark:border-gray-800/60 " + (isLg ? "bg-teal-50/50 dark:bg-teal-500/10 font-semibold" : "")}>
                  <td className={"w-8 py-2 px-2 text-center text-[11px] font-bold tabular-nums " + (isLg ? "text-teal-600 dark:text-teal-400" : "text-gray-300 dark:text-gray-600")}>{ri + 1}</td>
                  {r.map((c, ci) => <td key={ci} className={"py-2 px-2 tabular-nums " + (ci === 0 ? "text-left text-gray-700 dark:text-gray-200" : "text-right text-gray-600 dark:text-gray-300")}>{c}</td>)}
                </tr> })}</tbody>
              </table>
            </div>
            <p className="mt-1.5 shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{T("열 클릭 시 정렬(재클릭=오름/내림) · ", "Click a column to sort · ")}<b className="text-teal-600 dark:text-teal-400">{T("LG 강조", "LG in teal")}</b></p>
            {/* LG 인사이트 — 표 아래(우측 컬럼) */}
            {ai && (
              <div className="mt-2.5">
                <button type="button" onClick={() => setAiOpen((v) => !v)} className="flex items-center gap-1 text-[10.5px] font-bold text-teal-600 dark:text-teal-400 transition-colors hover:text-teal-700 dark:hover:text-teal-300">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>
                  {T("LG 인사이트", "LG Insight")}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: aiOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <div style={{ display: "grid", gridTemplateRows: aiOpen ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(.22,1,.36,1)" }}>
                  <div className="overflow-hidden">
                    <div className="mt-1.5 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5">
                      <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{ai}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    {big && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 sm:p-8" style={{ animation: "veilIn .24s ease both" }} onClick={() => setBig(false)}>
        <div className="flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[0.06] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] dark:bg-gray-900 dark:ring-white/10" style={{ animation: "popIn .44s cubic-bezier(.34,1.42,.64,1) both" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
            <span className="h-[16px] w-1 rounded bg-indigo-500" />
            <h3 className="text-[14.5px] font-bold text-gray-900 dark:text-gray-50">{title}</h3>
            {seg && <span className="rounded bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">{seg}</span>}
            <span className="ml-auto flex items-center gap-0.5">
              <IcoBtn onClick={() => dlImgFrom(document.getElementById("bigchart-" + idx), "에너지_" + title)} title={T("이미지 다운로드", "Download image")} d={ICO.img} />
              {csv && <IcoBtn onClick={() => dlCsvFrom(csv, "에너지_" + title)} title={T("CSV 다운로드", "Download CSV")} d={ICO.csv} />}
              <button type="button" onClick={() => setBig(false)} aria-label={T("닫기", "Close")} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-gray-500 transition-all duration-200 hover:bg-black/10 hover:text-gray-900 active:scale-90 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 dark:hover:text-gray-50"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
            </span>
          </div>
          {/* 좌: 큰 차트(전체목록)+의미·인사이트 / 우: 정렬 가능한 데이터 표 */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
            <div className="flex min-w-0 flex-col lg:w-[60%] lg:overflow-y-auto lg:pr-1">
              <div id={"bigchart-" + idx} className="flex h-[46vh] w-full items-center justify-center lg:h-[66vh]">{bigChildren ?? children}</div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">{T("의미", "Meaning")}</b> {meaning}</p>
              {ai && <div className="mt-2 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11.5px] leading-relaxed text-gray-600 dark:text-gray-300"><b className="font-semibold text-indigo-600 dark:text-indigo-400">{T("LG 인사이트", "LG Insight")}</b> {ai}</p></div>}
            </div>
            {csv && (
              <div className="flex min-h-0 flex-col lg:w-[40%] lg:border-l lg:border-gray-100 lg:dark:border-gray-800 lg:pl-4">
                <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{T("정렬", "Sort")}</span>
                  <button type="button" onClick={() => setSortCol(-1)} className={"rounded-md px-2 py-1 text-[11px] font-semibold transition-all " + (sortCol < 0 ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-500/15")}>{T("기본순", "Default")}</button>
                  {csv.head.map((h, i) => (
                    <button key={i} type="button" onClick={() => { if (sortCol === i) setSortDesc((d) => !d); else { setSortCol(i); setSortDesc(true) } }} className={"rounded-md px-2 py-1 text-[11px] font-semibold transition-all " + (sortCol === i ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-500/15")}>{h}{sortCol === i ? (sortDesc ? " ↓" : " ↑") : ""}</button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
                  <table className="w-full border-collapse text-[12px]">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900"><tr className="border-b border-gray-200 dark:border-gray-800">{csv.head.map((h, i) => <th key={i} onClick={() => { if (sortCol === i) setSortDesc((d) => !d); else { setSortCol(i); setSortDesc(true) } }} className={"cursor-pointer select-none py-1.5 px-2 font-semibold text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 " + (i === 0 ? "text-left" : "text-right")}>{h}{sortCol === i ? (sortDesc ? " ↓" : " ↑") : ""}</th>)}</tr></thead>
                    <tbody>{sortedRows.map((r, ri) => <tr key={ri} className={"border-b border-gray-100 dark:border-gray-800/60 " + (/^lg$/i.test(String(r[0])) ? "bg-teal-50/50 dark:bg-teal-500/10 font-semibold" : "")}>{r.map((c, ci) => <td key={ci} className={"py-1.5 px-2 tabular-nums " + (ci === 0 ? "text-left text-gray-700 dark:text-gray-200" : "text-right text-gray-600 dark:text-gray-300")}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <p className="mt-1.5 shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{T("열 머리글·버튼 클릭 시 해당 기준 정렬(재클릭=오름/내림) · ", "Click a column header or button to sort (click again to toggle asc/desc) · ")}<b className="text-teal-600 dark:text-teal-400">{T("LG 강조", "LG in teal")}</b></p>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
function HBar({ items, hiName }: { items: { name: string; v: number; n?: number }[]; hiName?: string }) {
  const [h, setH] = useState<number | null>(null)
  if (!items.length) return <div className="flex h-28 w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  // Cleveland 점 랭킹 — 효율축 위 브랜드 점, 시장평균 기준선, 순위·LG 강조. (막대 나열 대체)
  const rowH = 28, padL = 104, padR = 46, W = 360, TP = 18, H = items.length * rowH + TP + 6
  const vals = items.map((i) => i.v), mn = Math.min(...vals), mx = Math.max(...vals), pd = (mx - mn) * 0.14 || 1
  const lo = mn - pd, hi = mx + pd
  const X = (v: number) => padL + (W - padL - padR) * ((v - lo) / ((hi - lo) || 1))
  const mkt = vals.reduce((a, b) => a + b, 0) / vals.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
      {/* 시장평균 기준선 */}
      <line x1={X(mkt)} y1={TP - 4} x2={X(mkt)} y2={H - 4} stroke="#f59e0b" strokeWidth="1.1" strokeDasharray="3 2.5" opacity="0.8" />
      <text x={X(mkt)} y={TP - 8} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#d97706">{T("시장평균 ", "Mkt avg ")}{mkt.toFixed(2)}</text>
      {items.map((a, i) => { const isHi = hiName && a.name.toLowerCase() === hiName.toLowerCase(), y = TP + i * rowH + rowH / 2, dim = h != null && h !== i, r = isHi ? 7 : h === i ? 6 : 5, col = isHi ? TEAL : "#94a3b8"
        return (
          <g key={a.name} onMouseEnter={() => setH(i)} style={{ cursor: "default", opacity: dim ? 0.42 : 1, transition: "opacity .18s" }}>
            <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill="transparent" /><title>{a.name} · {a.v.toFixed(2)}{a.n ? ` · ${a.n}${T("개 모델", " models")}` : ""}</title>
            {/* 순위 뱃지 */}
            <text x={12} y={y + 3.5} fontSize="10" fontWeight="800" className={isHi ? "fill-teal-500 dark:fill-teal-400" : "fill-gray-300 dark:fill-gray-600"}>{i + 1}</text>
            <text x={padL - 10} y={y + 3.5} textAnchor="end" fontSize="10.5" fontWeight={isHi || h === i ? 800 : 500} className={isHi ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{a.name}</text>
            {/* 가이드 라인 + 점 */}
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef2f6" strokeWidth="1" className="dark:stroke-gray-800/70" />
            <circle cx={X(a.v)} cy={y} r={r} fill={col} stroke="#fff" strokeWidth={isHi ? 1.6 : 0.8} className={isHi ? "" : "dark:fill-gray-500"} style={{ animation: "popIn .5s cubic-bezier(.34,1.42,.64,1) both", animationDelay: (0.06 + Math.min(i, 12) * 0.04) + "s", transformOrigin: `${X(a.v)}px ${y}px` }} />
            <text x={X(a.v) + (X(a.v) > W - padR - 30 ? -(r + 5) : r + 5)} y={y + 3.5} textAnchor={X(a.v) > W - padR - 30 ? "end" : "start"} fontSize="10.5" fontWeight={isHi || h === i ? 800 : 600} className={isHi ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-600 dark:fill-gray-300"}>{a.v.toFixed(2)}{h === i && a.n ? ` (${a.n})` : ""}</text>
          </g>
        )
      })}
    </svg>
  )
}
// 덤벨 — 용량대별 LG vs 시장평균 효율을 점 2개+연결선으로. 격차(우측=LG 우위)를 한눈에. (그룹막대 대체)
function GroupBars({ groups, fmt = (v: number) => v.toFixed(1) }: { groups: { label: string; lg: number | null; mkt: number }[]; fmt?: (v: number) => string }) {
  const [h, setH] = useState<number | null>(null)
  if (!groups.length) return <div className="flex h-28 w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const vals = groups.flatMap((g) => (g.lg != null ? [g.lg, g.mkt] : [g.mkt]))
  const mn = Math.min(...vals), mx = Math.max(...vals), pd = (mx - mn) * 0.16 || 1, lo = mn - pd, hi = mx + pd
  const rowH = 30, padL = 74, padR = 48, W = 360, TP = 8, H = groups.length * rowH + TP + 6
  const X = (v: number) => padL + (W - padL - padR) * ((v - lo) / ((hi - lo) || 1))
  return (
    <div className="flex h-full w-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ width: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
        {groups.map((g, i) => { const y = TP + i * rowH + rowH / 2, dim = h != null && h !== i, ahead = g.lg != null && g.lg >= g.mkt
          return (
            <g key={g.label} onMouseEnter={() => setH(i)} style={{ opacity: dim ? 0.42 : 1, transition: "opacity .18s", cursor: "default" }}>
              <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill="transparent" /><title>{g.label} · LG {g.lg != null ? fmt(g.lg) : "—"} · {T("시장", "Market")} {fmt(g.mkt)}</title>
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="9.5" fontWeight={h === i ? 800 : 500} className="fill-gray-500 dark:fill-gray-400">{g.label.replace(/\(.*\)/g, "")}</text>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef2f6" strokeWidth="1" className="dark:stroke-gray-800/70" />
              {/* 연결선(격차) */}
              {g.lg != null && <line x1={X(g.mkt)} y1={y} x2={X(g.lg)} y2={y} stroke={ahead ? "#5eead4" : "#fca5a5"} strokeWidth="2.4" strokeLinecap="round" style={{ animation: "growX .5s ease both", animationDelay: (0.08 + i * 0.05) + "s", transformOrigin: `${X(g.mkt)}px 0` }} />}
              {/* 시장 점 */}
              <circle cx={X(g.mkt)} cy={y} r={4.2} fill={GRAY} stroke="#fff" strokeWidth="0.8" className="dark:fill-gray-500" style={{ animation: "popIn .5s cubic-bezier(.34,1.42,.64,1) both", animationDelay: (0.1 + i * 0.05) + "s", transformOrigin: `${X(g.mkt)}px ${y}px` }} />
              {/* LG 점 */}
              {g.lg != null && <circle cx={X(g.lg)} cy={y} r={6} fill={TEAL} stroke="#fff" strokeWidth="1.6" style={{ animation: "popIn .5s cubic-bezier(.34,1.42,.64,1) both", animationDelay: (0.16 + i * 0.05) + "s", transformOrigin: `${X(g.lg)}px ${y}px` }} />}
              {g.lg != null && <text x={X(g.lg) + (X(g.lg) >= X(g.mkt) ? 9 : -9)} y={y + 3.2} textAnchor={X(g.lg) >= X(g.mkt) ? "start" : "end"} fontSize="9.5" fontWeight="800" className="fill-teal-600 dark:fill-teal-400">{fmt(g.lg)}</text>}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex shrink-0 items-center gap-3 text-[10px]"><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL }} />LG</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />{T("시장평균", "Market avg")}</span><span className="text-gray-400">{T("→ 오른쪽일수록 고효율", "→ right = higher efficiency")}</span></div>
    </div>
  )
}

// 산점도 — 효율(X, 높을수록 우측=좋음) vs 월전력(Y, 낮을수록 상단=좋음). LG 강조, 사분면 가이드·격자
function Scatter({ pts, metric }: { pts: { name: string; eff: number; kwh: number; isLG: boolean; n?: number }[]; metric: string }) {
  const [h, setH] = useState<number | null>(null)
  if (pts.length < 2) return <div className="flex h-full min-h-[200px] w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const W = 400, H = 200, L = 40, R = 14, TP = 14, B = 30
  const exs = pts.map((p) => p.eff), kys = pts.map((p) => p.kwh)
  const pad = (lo: number, hi: number) => { const d = (hi - lo) * 0.12 || 1; return [lo - d, hi + d] as const }
  const [ex0, ex1] = pad(Math.min(...exs), Math.max(...exs)), [ky0, ky1] = pad(Math.min(...kys), Math.max(...kys))
  const X = (v: number) => L + (W - L - R) * ((v - ex0) / ((ex1 - ex0) || 1))
  const Y = (v: number) => TP + (H - TP - B) * ((v - ky0) / ((ky1 - ky0) || 1))
  const emx = (ex0 + ex1) / 2, kmy = (ky0 + ky1) / 2
  return (
    <div className="flex h-full w-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ width: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
        {/* 사분면 가이드 — 우상단(고효율·저전력)=우수 */}
        <rect x={X(emx)} y={TP} width={W - R - X(emx)} height={Y(kmy) - TP} fill="#0d9488" opacity="0.05" />
        {[0.25, 0.5, 0.75].map((f) => <line key={"h" + f} x1={L} y1={TP + (H - TP - B) * f} x2={W - R} y2={TP + (H - TP - B) * f} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="2 3" className="dark:stroke-gray-800" />)}
        {[0.25, 0.5, 0.75].map((f) => <line key={"v" + f} x1={L + (W - L - R) * f} y1={TP} x2={L + (W - L - R) * f} y2={H - B} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="2 3" className="dark:stroke-gray-800" />)}
        <line x1={L} y1={TP} x2={L} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        {/* 축 눈금 */}
        <text x={L - 4} y={TP + 4} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(ky0)}</text>
        <text x={L - 4} y={H - B} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(ky1)}</text>
        <text x={L} y={H - B + 11} textAnchor="middle" fontSize="8" fill="#94a3b8">{ex0.toFixed(1)}</text>
        <text x={W - R} y={H - B + 11} textAnchor="end" fontSize="8" fill="#94a3b8">{ex1.toFixed(1)}</text>
        <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b">{T("효율", "Efficiency")}({metric}) {T("→ 높을수록 우수", "→ higher is better")}</text>
        <text x={11} y={(TP + H - B) / 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b" transform={`rotate(-90 11 ${(TP + H - B) / 2})`}>{T("월전력 ↓ 낮을수록 우수", "Monthly power ↓ lower is better")}</text>
        <text x={W - R - 2} y={TP + 9} textAnchor="end" fontSize="7.5" fontWeight="700" className="fill-teal-600/70 dark:fill-teal-400/60">{T("우수 구간", "Optimal zone")}</text>
        {pts.map((p, i) => (
          <g key={p.name} onMouseEnter={() => setH(i)} style={{ cursor: "default" }} opacity={h == null || h === i || p.isLG ? 1 : 0.45}>
            <title>{p.name} · {metric} {p.eff.toFixed(2)} · {Math.round(p.kwh)}{T("kWh/월", "kWh/mo")}{p.n ? ` · ${p.n}${T("모델", " models")}` : ""}</title>
            <circle cx={X(p.eff)} cy={Y(p.kwh)} r={p.isLG ? 7 : 5} fill={p.isLG ? TEAL : "#94a3b8"} stroke={p.isLG ? "#fff" : "#fff"} strokeWidth={p.isLG ? 1.6 : 0.8} className={p.isLG ? "" : "dark:fill-gray-500"} style={{ animation: "popIn .7s cubic-bezier(.34,1.42,.64,1) both", animationDelay: (0.1 + i * 0.06) + "s", transition: "opacity .15s", transformOrigin: `${X(p.eff)}px ${Y(p.kwh)}px` }} />
            {(p.isLG || h === i) && <text x={X(p.eff)} y={Y(p.kwh) - 10} textAnchor="middle" fontSize="9.5" fontWeight="800" className={p.isLG ? "fill-teal-700 dark:fill-teal-300" : "fill-gray-600 dark:fill-gray-200"}>{p.name}</text>}
          </g>
        ))}
      </svg>
      <div className="mt-1 shrink-0 text-[10px] text-gray-400"><span className="font-semibold text-teal-600 dark:text-teal-400">● LG</span>{T(" · 우측·상단(음영)일수록 고효율·저전력", " · upper-right (shaded) = higher efficiency, lower power")}</div>
    </div>
  )
}
const avgOf = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null

// 히스토그램 — 세그먼트 내 전 모델의 효율 분포 + LG 포함분(teal)·중앙값. 시장 대비 LG가 분포 어디에 위치하는지.
function EffHist({ vals, lgVals, metric }: { vals: number[]; lgVals: number[]; metric: string }) {
  const [h, setH] = useState<number | null>(null)
  if (vals.length < 4) return <div className="flex h-full min-h-[180px] w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const nb = Math.min(8, Math.max(5, Math.round(Math.sqrt(vals.length))))
  const bw0 = (hi - lo) / nb || 1
  const bins = Array.from({ length: nb }, (_, i) => ({ lo: lo + bw0 * i, hi: lo + bw0 * (i + 1), n: 0, lg: 0 }))
  const put = (v: number, key: "n" | "lg") => { let k = Math.floor((v - lo) / bw0); if (k >= nb) k = nb - 1; if (k < 0) k = 0; bins[k][key]++ }
  for (const v of vals) put(v, "n"); for (const v of lgVals) put(v, "lg")
  const sorted = [...vals].sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)]
  const maxN = Math.max(...bins.map((b) => b.n), 1)
  const W = 360, H = 178, L = 10, R = 10, TP = 14, B = 30, bw = (W - L - R) / nb
  const Y = (n: number) => TP + (H - TP - B) * (1 - n / maxN)
  const X = (v: number) => L + (W - L - R) * ((v - lo) / ((hi - lo) || 1))
  return (
    <div className="flex h-full w-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ width: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        {bins.map((b, i) => { const x = L + bw * i, dim = h != null && h !== i
          return (
            <g key={i} onMouseEnter={() => setH(i)} style={{ opacity: dim ? 0.5 : 1, transition: "opacity .15s" }}>
              <rect x={x} y={TP} width={bw} height={H - TP - B} fill="transparent" /><title>{b.lo.toFixed(2)}~{b.hi.toFixed(2)} · {b.n}{T("모델", " models")}{b.lg ? ` (LG ${b.lg})` : ""}</title>
              <rect x={x + 1.5} y={Y(b.n)} width={Math.max(1, bw - 3)} height={H - B - Y(b.n)} rx="2" fill={GRAY} className="dark:opacity-40" style={{ animation: "growBar .55s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.08 + i * 0.05) + "s", transformOrigin: `center ${H - B}px` }} />
              {b.lg > 0 && <rect x={x + 1.5} y={Y(b.lg)} width={Math.max(1, bw - 3)} height={H - B - Y(b.lg)} rx="2" fill={TEAL} style={{ animation: "growBar .55s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.14 + i * 0.05) + "s", transformOrigin: `center ${H - B}px` }} />}
              {b.n > 0 && <text x={x + bw / 2} y={Y(b.n) - 3} textAnchor="middle" fontSize="8" className="fill-gray-500 dark:fill-gray-400">{b.n}</text>}
            </g>
          )
        })}
        <line x1={X(med)} y1={TP} x2={X(med)} y2={H - B} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 2" />
        <text x={X(med)} y={TP + 7} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#d97706">{T("중앙", "Median")} {med.toFixed(1)}</text>
        <text x={L} y={H - B + 11} fontSize="8" fill="#94a3b8">{lo.toFixed(1)}</text>
        <text x={W - R} y={H - B + 11} textAnchor="end" fontSize="8" fill="#94a3b8">{hi.toFixed(1)}</text>
        <text x={(L + W - R) / 2} y={H - 1} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b">{T("효율", "Efficiency")}({metric}) {T("구간 →", "range →")}</text>
      </svg>
      <div className="mt-1 flex shrink-0 items-center gap-3 text-[10px]"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: TEAL }} />LG</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />{T("시장", "Market")}</span><span className="text-gray-400">{T("구간별 모델수", "Models per bin")}</span></div>
    </div>
  )
}

// 용량↔효율 지형 — 카테고리 전체 모델. x=용량(스펙), y=효율. LG(teal)·시장(gray). 용량대별 LG 포진·효율 추세를 한눈에.
function CapScatter({ pts, metric, specUnit }: { pts: { spec: number; eff: number; isLG: boolean; name: string }[]; metric: string; specUnit: string }) {
  const [h, setH] = useState<number | null>(null)
  if (pts.length < 3) return <div className="flex h-full min-h-[200px] w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const W = 400, H = 200, L = 40, R = 12, TP = 14, B = 32
  const sxs = pts.map((p) => p.spec), eys = pts.map((p) => p.eff)
  const pad = (lo: number, hi: number) => { const d = (hi - lo) * 0.08 || 1; return [lo - d, hi + d] as const }
  const [sx0, sx1] = pad(Math.min(...sxs), Math.max(...sxs)), [ey0, ey1] = pad(Math.min(...eys), Math.max(...eys))
  const X = (v: number) => L + (W - L - R) * ((v - sx0) / ((sx1 - sx0) || 1))
  const Y = (v: number) => TP + (H - TP - B) * (1 - (v - ey0) / ((ey1 - ey0) || 1))
  return (
    <div className="flex h-full w-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ width: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
        {[0.25, 0.5, 0.75].map((f) => <line key={"h" + f} x1={L} y1={TP + (H - TP - B) * f} x2={W - R} y2={TP + (H - TP - B) * f} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="2 3" className="dark:stroke-gray-800" />)}
        <line x1={L} y1={TP} x2={L} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        <text x={L - 4} y={TP + 4} textAnchor="end" fontSize="8" fill="#94a3b8">{ey1.toFixed(1)}</text>
        <text x={L - 4} y={H - B} textAnchor="end" fontSize="8" fill="#94a3b8">{ey0.toFixed(1)}</text>
        <text x={11} y={(TP + H - B) / 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b" transform={`rotate(-90 11 ${(TP + H - B) / 2})`}>{T("효율", "Efficiency")}({metric}) ↑</text>
        <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b">{specUnit} →</text>
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setH(i)} style={{ cursor: "default" }} opacity={h == null || h === i || p.isLG ? 1 : 0.4}>
            <title>{p.name} · {specUnit} {p.spec} · {metric} {p.eff.toFixed(2)}</title>
            <circle cx={X(p.spec)} cy={Y(p.eff)} r={p.isLG ? 5.5 : 3.4} fill={p.isLG ? TEAL : "#94a3b8"} stroke="#fff" strokeWidth={p.isLG ? 1.3 : 0.6} className={p.isLG ? "" : "dark:fill-gray-500"} style={{ animation: "fadeIn .5s ease both", animationDelay: Math.min(i, 40) * 0.012 + "s", transition: "opacity .15s" }} />
          </g>
        ))}
      </svg>
      <div className="mt-1 shrink-0 text-[10px] text-gray-400"><span className="font-semibold text-teal-600 dark:text-teal-400">● LG</span>{T(" · 우상단일수록 대용량·고효율", " · upper-right = larger capacity, higher efficiency")}</div>
    </div>
  )
}

// 브랜드 포지셔닝 버블 — x=평균효율, y=5성 비중%, 크기=모델수(라인업 폭). 우상단·큰버블=고효율·프리미엄·풀라인업.
function Bubble({ items, metric, hi = [] }: { items: { name: string; eff: number; s5: number; n: number; isLG: boolean }[]; metric: string; hi?: string[] }) {
  const [h, setH] = useState<number | null>(null)
  const hiSet = new Set(hi.map((b) => b.toLowerCase()))
  if (items.length < 2) return <div className="flex h-full min-h-[200px] w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const W = 400, H = 200, L = 40, R = 16, TP = 16, B = 30
  const exs = items.map((p) => p.eff)
  const pad = (lo: number, hi: number) => { const d = (hi - lo) * 0.12 || 1; return [lo - d, hi + d] as const }
  const [ex0, ex1] = pad(Math.min(...exs), Math.max(...exs))
  const X = (v: number) => L + (W - L - R) * ((v - ex0) / ((ex1 - ex0) || 1))
  const Y = (v: number) => TP + (H - TP - B) * (1 - v / 100)
  const maxN = Math.max(...items.map((i) => i.n), 1)
  const rad = (n: number) => 4 + 10 * Math.sqrt(n / maxN)
  return (
    <div className="flex h-full w-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ width: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
        {[0, 25, 50, 75, 100].map((p) => <line key={p} x1={L} y1={Y(p)} x2={W - R} y2={Y(p)} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="2 3" className="dark:stroke-gray-800" />)}
        <line x1={L} y1={TP} x2={L} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        <text x={L - 4} y={Y(100) + 3} textAnchor="end" fontSize="8" fill="#94a3b8">100</text>
        <text x={L - 4} y={Y(0)} textAnchor="end" fontSize="8" fill="#94a3b8">0</text>
        <text x={11} y={(TP + H - B) / 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b" transform={`rotate(-90 11 ${(TP + H - B) / 2})`}>{T("5성 비중(%) ↑", "5-star share (%) ↑")}</text>
        <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b">{T("평균 효율", "Avg efficiency")}({metric}) →</text>
        {items.map((p, i) => {
          const emph = p.isLG || hiSet.has(p.name.toLowerCase())  // 강조 대상(LG는 항상, 선택 브랜드)
          const col = p.isLG ? TEAL : emph ? "#6366f1" : "#94a3b8" // 선택 브랜드=인디고 강조
          const dim = hiSet.size > 0 ? (emph ? 1 : 0.25) : (h == null || h === i || p.isLG ? 1 : 0.5) // 선택 시 비강조 흐리게
          return (
          <g key={p.name} onMouseEnter={() => setH(i)} style={{ cursor: "default", opacity: dim, transition: "opacity .3s ease" }}>
            <title>{p.name} · {metric} {p.eff.toFixed(2)} · {T("5성", "5★")} {p.s5.toFixed(0)}% · {p.n}{T("모델", " models")}</title>
            <circle cx={X(p.eff)} cy={Y(p.s5)} r={rad(p.n) * (h === i ? 1.14 : 1)} fill={col} fillOpacity={emph ? 0.85 : 0.4} stroke={col} strokeWidth={emph ? 1.6 : 0.8} style={{ animation: "popIn .5s cubic-bezier(.34,1.42,.64,1) both", animationDelay: Math.min(i, 12) * 0.025 + "s", transition: "r .25s cubic-bezier(.34,1.42,.64,1), fill-opacity .25s ease", transformOrigin: `${X(p.eff)}px ${Y(p.s5)}px` }} />
            {(emph || h === i) && <text x={X(p.eff)} y={Y(p.s5) - rad(p.n) - 3} textAnchor="middle" fontSize="9" fontWeight="800" className={p.isLG ? "fill-teal-700 dark:fill-teal-300" : emph ? "fill-indigo-600 dark:fill-indigo-300" : "fill-gray-600 dark:fill-gray-200"}>{p.name}</text>}
          </g>
          )
        })}
      </svg>
    </div>
  )
}

// LG 기준 대비 다이버징 — 월 전기요금(낮을수록 유리)을 'LG보다 월 얼마 더/덜 드는지'로. LG=기준선(0). (롤리팝 대체)
function CostLollipop({ items }: { items: { label: string; cost: number; isLG: boolean }[] }) {
  const [h, setH] = useState<number | null>(null)
  if (!items.length) return <div className="flex h-full min-h-[180px] w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const lg = items.find((i) => i.isLG)?.cost ?? [...items].sort((a, b) => a.cost - b.cost)[Math.floor(items.length / 2)].cost
  const rows = items.map((a) => ({ ...a, d: a.cost - lg }))
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.d)), 1)
  const rowH = 28, padL = 66, padR = 58, W = 360, TP = 15, H = rows.length * rowH + TP + 6
  const hasNeg = rows.some((r) => r.d < -0.5)
  const x0 = hasNeg ? padL + (W - padL - padR) * 0.32 : padL + 6   // LG 기준선 위치(음수 있으면 왼쪽 여유)
  const bx = (d: number) => x0 + (W - x0 - padR) * (d > 0 ? d / (maxAbs * 1.08) : d / (maxAbs * 1.08) * ((x0 - padL) / (W - x0 - padR)))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
      {/* LG 기준선 */}
      <line x1={x0} y1={TP - 4} x2={x0} y2={H - 4} stroke={TEAL} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.85" />
      <text x={x0} y={TP - 7} textAnchor="middle" fontSize="8.5" fontWeight="800" className="fill-teal-600 dark:fill-teal-400">{T("LG 기준", "LG base")}</text>
      {rows.map((a, i) => { const y = TP + i * rowH + rowH / 2, isLG = a.isLG, worse = a.d > 0, dim = h != null && h !== i
        const col = isLG ? TEAL : worse ? "#f43f5e" : "#10b981"  // 더 비쌈=rose, 더 쌈=emerald
        const bw = bx(a.d) - x0
        return (
          <g key={a.label} onMouseEnter={() => setH(i)} style={{ opacity: dim ? 0.42 : 1, transition: "opacity .18s", cursor: "default" }}>
            <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill="transparent" /><title>{a.label} · ₱{a.cost.toLocaleString()}{T("/월", "/mo")}{isLG ? "" : ` · LG${T(" 대비 ", " vs ")}${a.d > 0 ? "+" : ""}₱${a.d.toLocaleString()}`}</title>
            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fontWeight={isLG ? 800 : 500} className={isLG ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{a.label}</text>
            {isLG ? (
              <circle cx={x0} cy={y} r={5} fill={TEAL} stroke="#fff" strokeWidth="1.5" style={{ animation: "popIn .5s cubic-bezier(.34,1.42,.64,1) both", animationDelay: (0.06 + i * 0.05) + "s", transformOrigin: `${x0}px ${y}px` }} />
            ) : (
              <rect x={Math.min(x0, bx(a.d))} y={y - 8} width={Math.max(2, Math.abs(bw))} height={16} rx={3} fill={col} fillOpacity={0.85} style={{ animation: "growX .55s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.08 + i * 0.05) + "s", transformOrigin: `${x0}px 0` }} />
            )}
            <text x={isLG ? x0 + 9 : bx(a.d) + (worse ? 6 : -6)} y={y + 3.5} textAnchor={isLG ? "start" : worse ? "start" : "end"} fontSize="10" fontWeight={isLG ? 800 : 700} className={isLG ? "fill-teal-600 dark:fill-teal-400" : worse ? "fill-rose-500 dark:fill-rose-400" : "fill-emerald-600 dark:fill-emerald-400"}>{isLG ? T("기준 ₱", "base ₱") + a.cost.toLocaleString() : (a.d > 0 ? "+" : "") + "₱" + a.d.toLocaleString()}</text>
          </g>
        )
      })}
    </svg>
  )
}

// 100% 스택바(SVG) — 브랜드별 5·4·3성↓ 구성. 세그먼트별 growX 애니메이션·hover·값 라벨. (인라인 막대→SVG 스택바)
function GradeStack({ rows }: { rows: { name: string; s5: number; s4: number; s3: number; n: number }[] }) {
  const [h, setH] = useState<number | null>(null)
  if (!rows.length) return <div className="flex h-full min-h-[160px] w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const rowH = 26, padL = 58, padR = 42, W = 360, H = rows.length * rowH + 4, barW = W - padL - padR
  const seg = [{ k: "s5" as const, c: "#10b981" }, { k: "s4" as const, c: AMBER }, { k: "s3" as const, c: "#cbd5e1" }]
  return (
    <div className="flex h-full w-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ width: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
        {rows.map((g, i) => { const y = i * rowH, isLG = /^lg$/i.test(g.name), dim = h != null && h !== i
          let acc = 0
          return (
            <g key={g.name} onMouseEnter={() => setH(i)} style={{ opacity: dim ? 0.45 : 1, transition: "opacity .15s", cursor: "default" }}>
              <rect x={0} y={y} width={W} height={rowH} fill="transparent" /><title>{g.name} · {T("5성", "5★")} {g.s5.toFixed(0)}% · {T("4성", "4★")} {g.s4.toFixed(0)}% · {T("3성↓", "≤3★")} {g.s3.toFixed(0)}% · {g.n}{T("모델", " models")}</title>
              <text x={padL - 6} y={y + rowH / 2 + 3} textAnchor="end" fontSize="10.5" fontWeight={isLG ? 800 : 500} className={isLG ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{g.name}</text>
              {seg.map((s, si) => { const w = barW * (g[s.k] || 0) / 100, x = padL + acc; acc += w; if (w <= 0) return null
                return <rect key={s.k} x={x} y={y + 4} width={w} height={rowH - 9} fill={s.c} className={s.k === "s3" ? "dark:fill-gray-600" : ""} style={{ animation: "growX .5s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.1 + i * 0.05 + si * 0.06) + "s", transformOrigin: `${x}px 0` }} /> })}
              <text x={padL + barW + 5} y={y + rowH / 2 + 3} fontSize="10" fontWeight={isLG ? 800 : 600} className="fill-emerald-600 dark:fill-emerald-400">{g.s5.toFixed(0)}%</text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex shrink-0 items-center gap-3 text-[9.5px] text-gray-400"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />{T("5성", "5★")}</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: AMBER }} />{T("4성", "4★")}</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />{T("3성↓", "≤3★")}</span></div>
    </div>
  )
}

// 도넛 페어 — 냉매 믹스 LG vs 시장. 세그먼트 draw 애니메이션(stroke-dashoffset). (스택바→도넛으로 스타일 변경)
function RefrigDonut({ keys, lg, mkt, colors }: { keys: string[]; lg: { m: Record<string, number>; tot: number }; mkt: { m: Record<string, number>; tot: number }; colors: Record<string, string> }) {
  const R = 30, SW = 12, C = 2 * Math.PI * R, cx = 40, cy = 40
  const one = (t: { m: Record<string, number>; tot: number }, tag: string) => {
    let acc = 0
    return (
      <div className="flex flex-col items-center gap-1">
        <svg viewBox="0 0 80 80" style={{ width: 82, height: 82 }}>
          <circle cx={cx} cy={cy} r={R} fill="none" strokeWidth={SW} stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
          {t.tot > 0 && keys.map((k, i) => { const pct = (t.m[k] || 0) / t.tot; if (pct <= 0) return null; const len = C * pct, off = -C * acc; acc += pct
            return <circle key={k} cx={cx} cy={cy} r={R} fill="none" strokeWidth={SW} stroke={colors[k] || "#94a3b8"} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`} style={{ animation: "dashDraw .8s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.12 + i * 0.1) + "s" }} /> })}
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fontWeight="800" className={tag === "LG" ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{tag}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7.5" className="fill-gray-400">{t.tot}{T("모델", "")}</text>
        </svg>
      </div>
    )
  }
  return (
    <div className="flex h-full w-full flex-col justify-center">
      <style>{"@keyframes dashDraw{from{stroke-dasharray:0 " + C.toFixed(1) + "}}"}</style>
      <div className="flex items-center justify-center gap-6">{one(lg, "LG")}{one(mkt, T("시장", "Market"))}</div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[9.5px] text-gray-400">{keys.slice(0, 5).map((k) => <span key={k} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: colors[k] || "#94a3b8" }} />{k}</span>)}<span className="text-gray-400">{T("· 녹색계=저GWP", "· green = low-GWP")}</span></div>
    </div>
  )
}

// 가격대 박스 — 브랜드별 소매가 분포(박스=P25~P75, 세로선=중앙값, 수염=P10~P90). LG teal 강조·growX 애니메이션.
function PriceBox({ items }: { items: PriceRange[] }) {
  const [h, setH] = useState<number | null>(null)
  if (!items.length) return <div className="flex h-full min-h-[180px] w-full items-center justify-center text-[12px] text-gray-400">{T("가격 데이터 부족", "No price data")}</div>
  const max = Math.max(...items.map((i) => i.p90), 1)
  const rowH = 25, padL = 58, padR = 46, W = 360, H = items.length * rowH + 4
  const bx = (v: number) => padL + (W - padL - padR) * (v / max)
  const fmt = (v: number) => (v >= 1000 ? "₱" + Math.round(v / 1000) + "k" : "₱" + Math.round(v))
  return (
    <div className="flex h-full w-full flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 flex-1" style={{ width: "100%", display: "block" }} onMouseLeave={() => setH(null)}>
        {items.map((a, i) => { const y = i * rowH + rowH / 2, isLG = /^lg$/i.test(a.brand), col = isLG ? TEAL : "#94a3b8", dim = h != null && h !== i, bw = Math.max(2, bx(a.p75) - bx(a.p25))
          return (
            <g key={a.brand} onMouseEnter={() => setH(i)} style={{ opacity: dim ? 0.4 : 1, transition: "opacity .15s", cursor: "default" }}>
              <rect x={0} y={i * rowH} width={W} height={rowH} fill="transparent" /><title>{a.brand} · {T("중앙", "Median")} ₱{a.med.toLocaleString()} · P25~P75 ₱{a.p25.toLocaleString()}~₱{a.p75.toLocaleString()} · {a.n}{T("모델", " models")}</title>
              <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10.5" fontWeight={isLG ? 800 : 500} className={isLG ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{a.brand}</text>
              <line x1={bx(a.p10)} y1={y} x2={bx(a.p90)} y2={y} stroke={col} strokeWidth="1" strokeOpacity="0.5" className={isLG ? "" : "dark:opacity-70"} />
              <line x1={bx(a.p10)} y1={y - 3} x2={bx(a.p10)} y2={y + 3} stroke={col} strokeWidth="1" strokeOpacity="0.5" />
              <line x1={bx(a.p90)} y1={y - 3} x2={bx(a.p90)} y2={y + 3} stroke={col} strokeWidth="1" strokeOpacity="0.5" />
              <rect x={bx(a.p25)} y={y - 5.5} width={bw} height={11} rx="2.5" fill={col} fillOpacity={isLG ? 0.85 : 0.32} stroke={col} strokeWidth={isLG ? 1.2 : 0.6} style={{ animation: "growX .55s cubic-bezier(.22,1,.36,1) both", animationDelay: (0.1 + i * 0.05) + "s", transformOrigin: `${bx(a.p25)}px 0` }} />
              <line x1={bx(a.med)} y1={y - 6.5} x2={bx(a.med)} y2={y + 6.5} stroke={isLG ? "#fff" : "#475569"} strokeWidth="1.8" className={isLG ? "" : "dark:stroke-gray-200"} style={{ animation: "fadeIn .4s ease both", animationDelay: (0.35 + i * 0.05) + "s" }} />
              <text x={W - padR + 4} y={y + 3.5} fontSize="10" fontWeight={isLG ? 800 : 600} className={isLG ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-600 dark:fill-gray-300"}>{fmt(a.med)}</text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[9.5px] text-gray-400"><span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: TEAL, opacity: 0.4 }} />{T("박스=P25~P75", "box = P25–P75")}</span><span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0 border-l-2 border-gray-500" />{T("중앙값", "Median")}</span><span>{T("수염=P10~P90 · 우측=중앙가", "whisker = P10–P90 · right = median price")}</span></div>
    </div>
  )
}

// LG 커버리지 매트릭스 — 설치형(행) × 용량(열). 셀=LG 모델수, 색농도=LG 평균효율. LG 라인업 전모를 한 화면에.
type Cell = { lgN: number; lgEff: number | null; mktN: number; mktEff: number | null }
function Heatmap({ rowLabels, colLabels, cells, metric, effLo, effHi }: { rowLabels: string[]; colLabels: string[]; cells: Record<string, Cell>; metric: string; effLo: number; effHi: number }) {
  const [hov, setHov] = useState<string | null>(null)
  if (!rowLabels.length) return <div className="flex h-40 w-full items-center justify-center text-[12px] text-gray-400">{T("데이터 부족", "No data")}</div>
  const tone = (eff: number | null) => { if (eff == null) return 0; const t = (eff - effLo) / ((effHi - effLo) || 1); return Math.max(0.12, Math.min(1, t)) }
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[420px]" style={{ display: "grid", gridTemplateColumns: `76px repeat(${colLabels.length}, minmax(0,1fr))`, gap: "3px" }}>
        <div />
        {colLabels.map((c) => <div key={c} className="pb-0.5 text-center text-[9.5px] font-semibold text-gray-500 dark:text-gray-400">{c.replace(/급|\(.*\)/g, "")}</div>)}
        {rowLabels.map((r, ri) => (
          <React.Fragment key={r}>
            <div className="flex items-center justify-end pr-1.5 text-[10.5px] font-semibold text-gray-600 dark:text-gray-300">{r}</div>
            {colLabels.map((c, ci) => {
              const k = r + "|" + c, cell = cells[k], id = ri + "-" + ci
              const has = cell && cell.lgN > 0, op = has ? tone(cell.lgEff) : 0
              return (
                <div key={c} onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)} title={cell ? `${r} · ${c}\nLG ${cell.lgN}${T("개", "")} (${cell.lgEff != null ? metric + " " + cell.lgEff.toFixed(2) : "—"})\n${T("시장", "Market")} ${cell.mktN}${T("개", "")} (${cell.mktEff != null ? cell.mktEff.toFixed(2) : "—"})` : `${r} · ${c} · LG 0${T("개", "")}`}
                  className="relative flex aspect-[1.6/1] min-h-[34px] items-center justify-center rounded-md text-[12.5px] font-bold transition-all"
                  style={{ background: has ? `rgba(13,148,136,${op})` : "var(--hm-empty)", color: has && op > 0.55 ? "#fff" : has ? "#0f766e" : "#cbd5e1", outline: hov === id ? "2px solid #0d9488" : "none", animation: "fadeIn .45s ease both", animationDelay: (ri * colLabels.length + ci) * 0.02 + "s" }}>
                  {has ? cell.lgN : "·"}
                  {has && cell.mktN > 0 && <span className="absolute bottom-0.5 right-1 text-[7px] font-medium opacity-60">/{cell.mktN}</span>}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <style>{":root{--hm-empty:#f1f5f9}.dark{--hm-empty:#1e293b}"}</style>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-gray-400">
        <span className="font-semibold text-gray-500 dark:text-gray-400">{T("숫자=LG 모델수 · /뒤=시장 총모델", "Number = LG models · after / = market total")}</span>
        <span className="inline-flex items-center gap-1">{T("색농도", "Shade")} {metric} {T("낮음", "low")}<span className="h-2.5 w-16 rounded" style={{ background: "linear-gradient(90deg,rgba(13,148,136,.12),rgba(13,148,136,1))" }} />{T("높음", "high")}</span>
      </div>
    </div>
  )
}

export default function EnergyLabelView() {
  const [rows, setRows] = useState<EnergyRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cat, setCat] = useState("acu")
  const [typ, setTyp] = useState("전체")
  const [segIdx, setSegIdx] = useState(0)
  const [metricSel, setMetricSel] = useState(0) // 화면에 표시할 지표(차트) idx
  const [bubBrands, setBubBrands] = useState<string[]>([]) // 브랜드 포지셔닝: 비교할 브랜드(빈 값=전체, LG는 항상 표시)
  // 카테고리 바뀌면 냉매(에어컨 전용) 등 선택 불가 지표는 기본으로 리셋
  useEffect(() => { if (cat !== "acu" && metricSel === 5) setMetricSel(0) }, [cat, metricSel])
  const [rate, setRate] = useState(14.83) // Meralco 가정용 ₱/kWh(실측 로드 전 기본값)
  const [rateAsOf, setRateAsOf] = useState("")
  const [simOpen, setSimOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [mSort, setMSort] = useState<"eff" | "kwh" | "star">("eff")
  const [mLgOnly, setMLgOnly] = useState(false)
  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([])
  useEffect(() => {
    energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true))
    latestMacro(["meralco_residential_rate"]).then((m) => { const r = m.meralco_residential_rate; if (r) { setRate(r.value); setRateAsOf(r.date.slice(2, 4) + "." + Number(r.date.slice(5, 7))) } }).catch(() => {})
  }, [])
  // 브랜드별 가격대(소매) — 카테고리 변경 시 fetch. 에너지 라벨 cat → competitor_prices 카테고리 매핑.
  const CAT_KO: Record<string, string> = { acu: "에어컨", ref: "냉장고", tvl: "TV" }
  useEffect(() => { const ko = CAT_KO[cat]; if (!ko) { setPriceRanges([]); return } brandPriceRanges(ko).then(setPriceRanges).catch(() => setPriceRanges([])) }, [cat]) // eslint-disable-line

  const cur = CATS.find((c) => c.key === cat)!
  const segs = SEG[cat] || []
  const hasType = cat === "acu" || cat === "ref"
  const catRows = useMemo(() => rows.filter((r) => r.category === cat && r.brand && r.eff != null && r.eff > 0), [rows, cat])
  const types = useMemo(() => hasType ? Array.from(new Set(catRows.map((r) => typeOf(cat, r.stype)))).filter((t) => t !== "기타") : [], [catRows, hasType, cat])
  useEffect(() => { setTyp("전체") }, [cat])
  const byType = (r: EnergyRow) => typ === "전체" || typeOf(cat, r.stype) === typ
  const inSeg = (r: EnergyRow, s: { lo: number; hi: number }) => r.spec != null && r.spec >= s.lo && r.spec < s.hi
  const segCounts = useMemo(() => segs.map((s) => catRows.filter((r) => byType(r) && inSeg(r, s)).length), [catRows, segs, typ])
  // 카테고리 진입 시 기본 세그먼트 = LG 모델이 가장 많은 곳(LG 없으면 모델 최다). LG 없는 소형 구간이 먼저 보이던 문제 해소.
  useEffect(() => {
    if (!loaded || !segs.length) return
    const lgc = segs.map((s) => catRows.filter((r) => /^lg$/i.test(r.brand) && inSeg(r, s)).length)
    const src = lgc.some((c) => c > 0) ? lgc : segs.map((s) => catRows.filter((r) => inSeg(r, s)).length)
    const b = src.indexOf(Math.max(...src)); if (b >= 0) setSegIdx(b)
  }, [cat, loaded]) // eslint-disable-line
  // 설치형(typ) 변경으로 현재 세그먼트가 비면 최다 세그먼트로 이동
  useEffect(() => { if (!segCounts.length) return; if ((segCounts[segIdx] || 0) < 3) { const b = segCounts.indexOf(Math.max(...segCounts)); if (b >= 0) setSegIdx(b) } }, [typ]) // eslint-disable-line
  const seg = segs[segIdx] || segs[0]
  const segRows = useMemo(() => catRows.filter((r) => byType(r) && seg && inSeg(r, seg)), [catRows, seg, typ])

  const { rank, rankAll, lgR, lgRk } = useMemo(() => {
    const by: Record<string, number[]> = {}; for (const r of segRows) (by[r.brand] = by[r.brand] || []).push(r.eff!)
    // 모델 2개 이상 브랜드 + LG(1개만 있어도) 전체 랭킹
    const all = Object.entries(by).map(([name, a]) => ({ name, v: avgOf(a)!, n: a.length })).filter((x) => x.n >= 2 || /^lg$/i.test(x.name)).sort((a, b) => b.v - a.v)
    const lgIdx = all.findIndex((x) => /^lg$/i.test(x.name))
    // 상위 5개 + LG(순위 밖이면 6번째에 끼워넣어 항상 노출) — 카드용. 확대 시엔 rankAll(전체) 사용.
    let disp = all.slice(0, 5)
    if (lgIdx >= 5) disp = [...all.slice(0, 5), all[lgIdx]]
    return { rank: disp, rankAll: all, lgR: lgIdx >= 0 ? all[lgIdx] : undefined, lgRk: lgIdx >= 0 ? lgIdx + 1 : 0, brandCount: all.length }
  }, [segRows])
  const gap = lgR && rank[0] ? ((rank[0].v - lgR.v) / lgR.v) * 100 : null

  // 모델별 상세(제품코드) — 선택 세그먼트의 개별 모델. PD가 모델 단위로 스펙·효율·별점·전력·냉매 확인.
  const modelRows = useMemo(() => {
    let rs = segRows.slice()
    if (mLgOnly) rs = rs.filter((r) => /^lg$/i.test(r.brand))
    const key = (r: EnergyRow) => mSort === "kwh" ? (r.kwh ?? 1e9) : mSort === "star" ? -(r.star ?? -1) : -(r.eff ?? -1)
    return rs.sort((a, b) => key(a) - key(b))
  }, [segRows, mSort, mLgOnly])

  const scatterData = useMemo(() => {
    const by: Record<string, { effs: number[]; kwhs: number[] }> = {}
    for (const r of segRows) { const o = (by[r.brand] = by[r.brand] || { effs: [], kwhs: [] }); if (r.eff != null) o.effs.push(r.eff); if (r.kwh != null && r.kwh > 0) o.kwhs.push(r.kwh) }
    return Object.entries(by).map(([name, o]) => ({ name, eff: avgOf(o.effs)!, kwh: avgOf(o.kwhs)!, isLG: /^lg$/i.test(name), n: o.effs.length })).filter((x) => x.eff != null && x.kwh != null && x.n >= 2)
  }, [segRows])
  const bySegChart = useMemo(() => segs.map((s) => {
    const rs = catRows.filter((r) => byType(r) && inSeg(r, s))
    return { label: s.k, lg: avgOf(rs.filter((r) => /^lg$/i.test(r.brand)).map((r) => r.eff!)), mkt: avgOf(rs.map((r) => r.eff!)) ?? 0 }
  }).filter((g) => g.mkt > 0), [catRows, segs, typ])

  // LG 커버리지 매트릭스 — 설치형×용량 전 조합의 LG/시장 모델수·효율 (카테고리 전체, 필터 무관)
  const coverage = useMemo(() => {
    const cells: Record<string, Cell> = {}; const effs: number[] = []
    const rowLabels = hasType ? types : ["전체"]
    for (const rl of rowLabels) for (const s of segs) {
      const rs = catRows.filter((r) => (hasType ? typeOf(cat, r.stype) === rl : true) && inSeg(r, s))
      if (!rs.length) continue
      const lg = rs.filter((r) => /^lg$/i.test(r.brand)); const lgEff = avgOf(lg.map((r) => r.eff!))
      if (lgEff != null) effs.push(lgEff)
      cells[rl + "|" + s.k] = { lgN: lg.length, lgEff, mktN: rs.length, mktEff: avgOf(rs.map((r) => r.eff!)) }
    }
    const lgTotal = catRows.filter((r) => /^lg$/i.test(r.brand)).length
    return { cells, rowLabels, colLabels: segs.map((s) => s.k), effLo: effs.length ? Math.min(...effs) : 0, effHi: effs.length ? Math.max(...effs) : 1, lgTotal }
  }, [catRows, types, segs, hasType, cat])

  // 냉매 믹스 — LG vs 시장 R32/R410A 등 (환경규제·GWP 관점)
  const refrigMix = useMemo(() => {
    const norm = (s: string) => { const t = (s || "").toUpperCase().replace(/[\s-]/g, ""); if (!t) return null; if (t.includes("R32")) return "R32"; if (t.includes("R410")) return "R410A"; if (t.includes("R290")) return "R290"; if (t.includes("R600")) return "R600a"; if (t.includes("R134")) return "R134a"; return t.slice(0, 6) }
    const tally = (rs: EnergyRow[]) => { const m: Record<string, number> = {}; let tot = 0; for (const r of rs) { const g = norm(r.refrigerant); if (!g) continue; m[g] = (m[g] || 0) + 1; tot++ } return { m, tot } }
    const lg = tally(segRows.filter((r) => /^lg$/i.test(r.brand))); const mkt = tally(segRows)
    const keys = Array.from(new Set([...Object.keys(lg.m), ...Object.keys(mkt.m)])).sort((a, b) => (mkt.m[b] || 0) - (mkt.m[a] || 0))
    return { keys, lg, mkt }
  }, [segRows])
  // 냉매(에어컨) — extra는 energyLabels에서 stype만 파싱했으므로 rows의 원본 대신 model/eff 기반 분리 불가 → segment refrigerant via rows extra not available; use kwh TCO instead

  // TCO — 선택 세그먼트 월 전기요금(₱) 낮은 순 상위 5개 브랜드 + LG(순위 밖이면 추가)
  const { tco, tcoAll } = useMemo(() => {
    const by: Record<string, number[]> = {}
    for (const r of segRows) if (r.kwh != null && r.kwh > 0) (by[r.brand] = by[r.brand] || []).push(r.kwh)
    const all = Object.entries(by).map(([label, a]) => ({ label, kwh: avgOf(a)!, n: a.length })).filter((x) => x.n >= 2 || /^lg$/i.test(x.label)).sort((a, b) => a.kwh - b.kwh)
    const lgIdx = all.findIndex((x) => /^lg$/i.test(x.label))
    let disp = all.slice(0, 5)
    if (lgIdx >= 5) disp = [...all.slice(0, 5), all[lgIdx]]
    const mk = (arr: typeof all) => arr.map((x) => ({ label: x.label, cost: Math.round(x.kwh * rate), isLG: /^lg$/i.test(x.label) }))
    return { tco: mk(disp), tcoAll: mk(all) }
  }, [segRows, rate])

  const { grade, gradeAll } = useMemo(() => {
    const by: Record<string, EnergyRow[]> = {}; for (const r of segRows) (by[r.brand] = by[r.brand] || []).push(r)
    const all = Object.entries(by).map(([name, a]) => { const st = a.filter((r) => r.star != null); const p = (f: (s: number) => boolean) => st.length ? st.filter((r) => f(r.star ?? 0)).length / st.length * 100 : 0; return { name, n: a.length, s5: p((s) => s >= 5), s4: p((s) => s === 4), s3: p((s) => s <= 3) } }).filter((x) => x.n >= 3).sort((a, b) => b.s5 - a.s5)
    return { grade: all.slice(0, 6), gradeAll: all }
  }, [segRows])

  // LG 강·약 세그먼트(분석 요약)
  const simBrands = useMemo(() => { const by: Record<string, number[]> = {}; for (const r of segRows) if (r.kwh != null && r.kwh > 0) (by[r.brand] = by[r.brand] || []).push(r.kwh); return Object.entries(by).map(([name, a]) => ({ name, kwh: avgOf(a)! })).filter((x) => x.kwh > 0).sort((a, b) => a.kwh - b.kwh) }, [segRows])
  const lgKwh = simBrands.find((b) => /^lg$/i.test(b.name))?.kwh ?? null

  // 신규: 효율 분포 히스토그램(세그먼트) · 용량↔효율 지형(카테고리 전체) · 브랜드 포지셔닝 버블
  const histData = useMemo(() => ({
    vals: segRows.map((r) => r.eff!).filter((v) => Number.isFinite(v)),
    lgVals: segRows.filter((r) => /^lg$/i.test(r.brand)).map((r) => r.eff!).filter((v) => Number.isFinite(v)),
  }), [segRows])
  const capData = useMemo(() => catRows.filter((r) => byType(r) && r.spec != null && r.eff != null).map((r) => ({ spec: r.spec!, eff: r.eff!, isLG: /^lg$/i.test(r.brand), name: r.brand })), [catRows, typ]) // eslint-disable-line
  const bubbleData = useMemo(() => {
    const by: Record<string, EnergyRow[]> = {}; for (const r of segRows) (by[r.brand] = by[r.brand] || []).push(r)
    return Object.entries(by).map(([name, a]) => {
      const effs = a.map((r) => r.eff!).filter((v) => Number.isFinite(v))
      const st = a.filter((r) => r.star != null)
      const s5 = st.length ? st.filter((r) => (r.star ?? 0) >= 5).length / st.length * 100 : 0
      return { name, eff: avgOf(effs)!, s5, n: a.length, isLG: /^lg$/i.test(name) }
    }).filter((x) => (x.n >= 2 || x.isLG) && Number.isFinite(x.eff))
  }, [segRows])
  // 브랜드별 가격대 — 중앙가 상위 7 + LG(순위 밖이면 추가). 카테고리 단위(세그먼트 무관).
  const priceDisp = useMemo(() => {
    if (!priceRanges.length) return []
    const lgIdx = priceRanges.findIndex((p) => /^lg$/i.test(p.brand))
    let disp = priceRanges.slice(0, 7)
    if (lgIdx >= 7) disp = [...priceRanges.slice(0, 7), priceRanges[lgIdx]]
    return disp
  }, [priceRanges])
  const lgPrice = priceRanges.find((p) => /^lg$/i.test(p.brand))
  const lgSegPos = useMemo(() => bySegChart.map((g) => ({ label: g.label, diff: g.lg != null ? g.lg - g.mkt : null })).filter((x) => x.diff != null) as { label: string; diff: number }[], [bySegChart])
  const strong = [...lgSegPos].sort((a, b) => b.diff - a.diff)[0]
  const weak = [...lgSegPos].sort((a, b) => a.diff - b.diff)[0]
  const lgGrade = grade.find((g) => /^lg$/i.test(g.name))

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes growBar{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}"}</style>


      <div className="grid items-start gap-4">
        <section className="min-w-0 rounded-xl p-4" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
          {/* 채널별 가격비교식 필터 바 — 제품·설치·용량·지표 드롭다운 나란히(테두리 묶음). 선택한 지표 1개만 표시 */}
          <div className="mb-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
            <PmDrop label={T("제품", "Product")} sel={cat} options={CATS.map((c) => ({ k: c.key, t: T(c.label, CAT_EN[c.key] ?? c.label) }))} onSelect={(k) => { setCat(k); setTyp("전체"); setSegIdx(0) }} />
            {hasType && <PmDrop label={T("설치", "Type")} sel={typ} options={["전체", ...types].map((t) => ({ k: t, t: T(t, t === "전체" ? "All" : t) }))} onSelect={setTyp} />}
            <PmDrop label={T("용량", "Cap.")} sel={String(segIdx)} options={segs.map((s, i) => ({ k: String(i), t: `${s.k} (${segCounts[i] || 0})` }))} onSelect={(k) => setSegIdx(Number(k))} />
            {metricSel === 8 && <PmMultiDrop label={T("브랜드 강조", "Focus")} sel={bubBrands} options={bubbleData.filter((b) => !b.isLG).map((b) => ({ k: b.name, t: b.name }))} onToggle={(k) => setBubBrands((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])} onClear={() => setBubBrands([])} allLabel={T("없음", "None")} />}
            <PmDrop label={T("지표", "Metric")} sel={String(metricSel)} options={METRICS.filter((m) => !m.acuOnly || cat === "acu").map((m) => ({ k: String(m.idx), t: T(m.ko, m.en) }))} onSelect={(k) => setMetricSel(Number(k))} />
          </div>


          {!loaded ? (
            <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" />)}</div>
          ) : (
            <>
            {/* LG 커버리지 매트릭스 — 카테고리 전체(필터 무관). 잠시 숨김(false) — 복원 시 true로. */}
            {false && (
            <div key={"cov-" + cat} className="mb-4 flex flex-col rounded-xl p-3.5" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both" }}>
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <h3 className="text-[13px] font-bold tracking-tight text-gray-900 dark:text-gray-50">LG {cur.label}{T(" 라인업 커버리지", " Lineup Coverage")}</h3>
                <span className="shrink-0 rounded bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-300">{T("전체", "Total")} {coverage.lgTotal}{T("개 모델", " models")}</span>
                <span className="ml-auto text-[10.5px] text-gray-400 dark:text-gray-500">{T("설치형 × 용량 · 색=효율", "Type × Capacity · color = efficiency")}</span>
              </div>
              <Heatmap rowLabels={coverage.rowLabels} colLabels={coverage.colLabels} cells={coverage.cells} metric={cur.metric} effLo={coverage.effLo} effHi={coverage.effHi} />
              <p className="mt-2.5 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{T("LG는 ", "LG has ")}<b>{coverage.lgTotal}{T("개", "")}</b>{T(" 모델을 ", " models across ")}{coverage.rowLabels.length}{T("개 설치형·", " types · ")}{coverage.colLabels.length}{T("개 용량대에 걸쳐 등록. ", " capacity bands. ")}<b>{T("빈 셀=미출시 공백", "Empty cell = not-launched gap")}</b>{T("(진입 기회), 색이 옅은 셀=효율 열세(개선 타깃).", " (entry opportunity); lighter cells = efficiency lag (improvement targets).")}</p>
            </div>
            )}
            <ActiveMetricCtx.Provider value={metricSel}>
            <div key={`seg-${typ}-${segIdx}-${metricSel}`} className="grid items-stretch gap-4 grid-cols-1">
              <Sub idx={0} title={T("브랜드 효율 랭킹", "Brand Efficiency Ranking")} seg={`${typ !== "전체" ? typ + " " : ""}${seg?.k}`} meaning={<>{T("같은 세그먼트 브랜드 평균 ", "Same-segment brand avg ")}{cur.metric} — <b className="text-gray-700 dark:text-gray-200">{T("높을수록 고효율", "higher = more efficient")}</b></>} ai={lgR ? <>{T("LG는 이 세그먼트 ", "LG ranks ")}<b className="font-semibold text-teal-700 dark:text-teal-300">{lgRk}{T("위", "th")}</b>{T(", 리더 ", " in this segment; leader ")}{rank[0]?.name}{T(" 대비 ", " vs ")}{gap != null ? gap.toFixed(0) : "—"}% {gap != null && gap > 0 ? <>{T("낮아 ", "lower — ")}<b className="font-semibold">{T("최고효율 격차가 곧 차기 개발 타깃", "the gap to best-in-class is the next-gen R&D target")}</b></> : <>{T("높아 ", "higher — ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("프리미엄 효율 소구 가능", "premium efficiency positioning available")}</b></>}{T(". 상위 브랜드와의 ", ". Reflect the ")}{cur.metric}{T(" 갭을 스펙 로드맵에 반영.", " gap vs top brands in the spec roadmap.")}</> : <><b className="font-semibold">{T("LG는 이 세그먼트 등록 모델 없음", "LG has no registered models in this segment")}</b>{T("(현지 미출시) — 시장 벤치마크로 진입 검토 시 목표 효율선 설정에 활용.", " (not launched locally) — use the market benchmark to set a target efficiency line when considering entry.")}</>} csv={{ head: [T("브랜드", "Brand"), cur.metric, T("모델수", "Models")], rows: rankAll.map((r) => [r.name, r.v.toFixed(2), r.n]) }} bigChildren={<HBar items={rankAll} hiName="LG" />}><HBar items={rank} hiName="LG" /></Sub>
              <Sub idx={1} title={T("효율 ↔ 월전력 관계", "Efficiency ↔ Monthly Power")} seg={seg?.k} meaning={<>{T("가로=효율, 세로=월전력 — ", "X = efficiency, Y = monthly power — ")}<b className="text-gray-700 dark:text-gray-200">{T("우상단", "upper-right")}</b>{T("이 고효율·저전력", " = high-efficiency, low-power")}</>} ai={<>{T("같은 효율이라도 실제 월전력은 다를 수 있어 ", "Even at equal efficiency, actual monthly power can differ, so ")}<b className="font-semibold">{T("효율 스펙과 실사용 전력의 정합성", "the alignment between spec efficiency and real-world power")}</b>{T("이 관건. LG 점이 우상단 음영(우수 구간)에 있으면 ", " is key. If the LG point sits in the shaded upper-right (optimal zone), ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("‘고효율=저전기료’ 메시지가 실측으로 뒷받침", "the ‘high-efficiency = low bill’ message is backed by measured data")}</b>{T("되고, 아니면 라벨효율 대비 소비전력 개선이 과제.", "; otherwise, improving consumption vs label efficiency is the task.")}</>} csv={{ head: [T("브랜드", "Brand"), cur.metric, T("월전력(kWh)", "Monthly power (kWh)")], rows: scatterData.map((p) => [p.name, p.eff.toFixed(2), Math.round(p.kwh)]) }}><Scatter pts={scatterData} metric={cur.metric} /></Sub>
              <Sub idx={2} title={T("용량대별 LG vs 시장", "LG vs Market by Capacity")} meaning={<>{T("용량대별 ", "By capacity, ")}<b className="text-gray-700 dark:text-gray-200">{T("LG vs 시장평균", "LG vs market avg")}</b> {cur.metric}{T(" — 효율 포지션", " — efficiency position")}</>} ai={weak && strong ? <>{T("LG는 ", "LG is ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{strong.label}</b>{T("에서 시장 대비 +", " +")}{strong.diff.toFixed(2)}{T(" 강세인 반면 ", " above market, while ")}<b className="font-semibold text-rose-600 dark:text-rose-400">{weak.label}</b>{T("는 ", " lags ")}{weak.diff.toFixed(2)}{T(" 열세 → ", " → ")}<b className="font-semibold">{T("열세 용량대의 효율 스펙 상향이 차기 라인업 1순위", "raising efficiency specs in the lagging band is the top next-lineup priority")}</b>{T(". 강세 용량대는 프리미엄 가격 방어에 활용.", ". Use strong bands to defend premium pricing.")}</> : <>{T("용량대별 LG 포지션 — 시장평균 상회 구간은 프리미엄, 하회 구간은 개선 타깃.", "LG position by capacity — bands above market avg are premium; below are improvement targets.")}</>} csv={{ head: [T("용량대", "Capacity"), "LG " + cur.metric, T("시장 ", "Market ") + cur.metric], rows: bySegChart.map((g) => [g.label, g.lg != null ? g.lg.toFixed(2) : "—", g.mkt.toFixed(2)]) }}><GroupBars groups={bySegChart} /></Sub>
              <Sub idx={3} title={T("월 전기요금 (TCO)", "Monthly Bill (TCO)")} seg={seg?.k} meaning={<>{T("월소비전력×전기료(Meralco) 추정 — ", "Monthly kWh × rate (Meralco), est. — ")}<b className="text-gray-700 dark:text-gray-200">{T("낮을수록 유리", "lower is better")}</b></>} ai={(() => { const lgT = tco.find((t) => t.isLG); const best = tco[0]; if (!lgT || !best) return <>{T("효율이 높을수록 월 전기요금↓ — ", "Higher efficiency → lower monthly bill — ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("연간 절감액을 구매 설득 메시지로 전환", "turn annual savings into a purchase-persuasion message")}</b>{T("(고효율 프리미엄 정당화).", " (justifying the high-efficiency premium).")}</>; const diff = lgT.cost - best.cost; return <>{T("LG 월 약 ", "LG ~")}<b>₱{lgT.cost.toLocaleString()}</b>{T(", 최저 ", "; lowest ")}{best.label}(₱{best.cost.toLocaleString()}){T(" 대비 ", " vs ")}{diff > 0 ? <>₱{diff.toLocaleString()}{T(" 높아 ", " higher — ")}<b className="font-semibold">{T("효율 개선 시 절감 소구 여지", "room to pitch savings via efficiency gains")}</b></> : diff < 0 ? <>₱{(-diff).toLocaleString()}{T(" 낮아 ", " lower — ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("연 ₱", "₱")}{((-diff) * 12).toLocaleString()}{T(" 절감 마케팅 가능", "/yr savings marketing possible")}</b></> : T("동일", "same")}{T(". 필리핀 高전기료 구조상 TCO 절감은 강한 구매 동인.", ". Given the Philippines' high electricity costs, TCO savings are a strong purchase driver.")}</> })()} csv={{ head: [T("브랜드", "Brand"), T("월 전기요금(₱)", "Monthly bill (₱)")], rows: tcoAll.map((t) => [t.label, t.cost]) }} bigChildren={<CostLollipop items={tcoAll} />}>
                <CostLollipop items={tco} />
              </Sub>
              <Sub idx={4} title={T("브랜드 등급 분포(별점)", "Brand Grade Distribution (stars)")} seg={seg?.k} meaning={<>{T("브랜드별 ", "Per brand, ")}<b className="text-gray-700 dark:text-gray-200">{T("5·4·3성↓ 구성", "5/4/≤3-star mix")}</b>{T(" — 모델수와 함께 해석", " — read alongside model count")}</>} ai={lgGrade ? <>{T("LG 5성 ", "LG 5-star ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{lgGrade.s5.toFixed(0)}%</b>{T("(4성 ", " (4-star ")}{lgGrade.s4.toFixed(0)}%) — {lgGrade.s5 >= 60 ? <b className="font-semibold">{T("프리미엄 효율 라인이 견고", "premium efficiency line is solid")}</b> : <b className="font-semibold text-amber-600 dark:text-amber-400">{T("5성 비중 확대 여지", "room to grow 5-star share")}</b>}{T(". DOE 별점은 소비자·유통 진열의 직접 소구 포인트라 5성 라인 폭이 매대 경쟁력으로 직결.", ". DOE stars are a direct selling point on the shelf, so 5-star breadth translates straight into retail competitiveness.")}</> : <>{T("고별점 비중이 높은 브랜드일수록 프리미엄 진열·인증 마케팅에 유리 — LG 미등록 세그먼트는 진입 시 5성 라인 우선 확보가 관건.", "Brands with a higher share of top ratings gain in premium display and certification marketing — for segments where LG is unregistered, securing a 5-star line first is key on entry.")}</>} csv={{ head: [T("브랜드", "Brand"), T("5성%", "5★%"), T("4성%", "4★%"), T("3성↓%", "≤3★%"), T("모델수", "Models")], rows: gradeAll.map((g) => [g.name, g.s5.toFixed(0), g.s4.toFixed(0), g.s3.toFixed(0), g.n]) }} bigChildren={<GradeStack rows={gradeAll} />}>
                <GradeStack rows={grade} />
              </Sub>
              {cat === "acu" && refrigMix.mkt.tot > 0 && (() => {
                const RC: Record<string, string> = { R32: "#10b981", R290: "#0d9488", R600a: "#22c55e", R410A: "#dc2626", R134a: "#f59e0b" }
                const lgR32 = refrigMix.lg.tot ? (refrigMix.lg.m.R32 || 0) / refrigMix.lg.tot * 100 : null
                return (
                  <Sub idx={5} title={T("냉매 믹스 (환경·GWP)", "Refrigerant Mix (Environment·GWP)")} seg={seg?.k} meaning={<>{T("냉매 구성 LG vs 시장 — ", "Refrigerant mix, LG vs market — ")}<b className="text-gray-700 dark:text-gray-200">{T("저GWP(R32·R290)=규제 대응력", "low-GWP (R32·R290) = regulatory readiness")}</b></>} ai={<>LG R32 {lgR32 != null ? <b className="font-semibold text-emerald-600 dark:text-emerald-400">{lgR32.toFixed(0)}%</b> : "—"}{T(" — 고GWP R410A가 남아있으면 규제강화(키갈리 개정·수입쿼터) 시 리스크, 저GWP 전환율이 높을수록 ", " — remaining high-GWP R410A is a risk under tighter regulation (Kigali Amendment, import quotas); the higher the low-GWP conversion rate, ")}<b className="font-semibold">{T("친환경 프리미엄·조달 입찰 가점", "the stronger the case for eco-premium and procurement-bid credit")}</b>{T(" 근거. R290(자연냉매)까지 갖추면 규제 선도 시장 대응력 강화.", ". Adding R290 (natural refrigerant) further strengthens readiness for regulation-leading markets.")}</>} csv={{ head: [T("냉매", "Refrigerant"), "LG %", T("시장 %", "Market %")], rows: refrigMix.keys.map((k) => [k, refrigMix.lg.tot ? ((refrigMix.lg.m[k] || 0) / refrigMix.lg.tot * 100).toFixed(0) : "—", refrigMix.mkt.tot ? ((refrigMix.mkt.m[k] || 0) / refrigMix.mkt.tot * 100).toFixed(0) : "—"]) }}>
                    <RefrigDonut keys={refrigMix.keys} lg={refrigMix.lg} mkt={refrigMix.mkt} colors={RC} />
                  </Sub>
                )
              })()}
              <Sub idx={6} title={T("효율 분포 (히스토그램)", "Efficiency Distribution (histogram)")} seg={seg?.k} meaning={<>{T("세그먼트 ", "Segment ")}{cur.metric}{T(" 분포 — ", " distribution — ")}<b className="text-teal-600 dark:text-teal-400">{T("teal=LG", "teal = LG")}</b>{T(", 주황선=중앙값", ", orange line = median")}</>} ai={<>{T("LG 막대가 ", "If LG bars cluster ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("중앙값 오른쪽(고효율)", "right of the median (high-efficiency)")}</b>{T("에 몰려 있으면 세그먼트 상위권, 왼쪽이면 개선 필요. 분포가 좌우로 넓으면 브랜드 간 효율 편차가 커 ", ", LG leads the segment; on the left, it needs improvement. A wide spread means large efficiency variance across brands, so ")}<b className="font-semibold">{T("고효율 차별화 여지가 크고", "there is ample room for high-efficiency differentiation")}</b>{T(", 촘촘하면 스펙 경쟁이 상향 평준화됐다는 신호.", "; a tight spread signals specs have converged upward.")}</>} csv={{ head: [T("구간(하한)", "Bin (lower)"), T("모델수", "Models")], rows: (() => { const v = histData.vals; if (v.length < 4) return []; const lo = Math.min(...v), hi = Math.max(...v), nb = Math.min(8, Math.max(5, Math.round(Math.sqrt(v.length)))), bw = (hi - lo) / nb || 1; const b = Array(nb).fill(0); for (const x of v) { let k = Math.floor((x - lo) / bw); if (k >= nb) k = nb - 1; if (k < 0) k = 0; b[k]++ } return b.map((n, i) => [(lo + bw * i).toFixed(2), n]) })() }}><EffHist vals={histData.vals} lgVals={histData.lgVals} metric={cur.metric} /></Sub>
              <Sub idx={7} title={T("용량↔효율 지형", "Capacity ↔ Efficiency Map")} meaning={<>{T("전 용량대 ", "Across all capacities, ")}<b className="text-gray-700 dark:text-gray-200">{T("용량 대비 효율", "efficiency vs capacity")}</b>{T(" 지형 — ", " map — ")}<b className="text-teal-600 dark:text-teal-400">{T("teal=LG", "teal = LG")}</b></>} ai={<>{T("보통 용량이 커질수록 효율이 낮아지는 추세가 있어, ", "Efficiency usually trends lower as capacity grows, so ")}<b className="font-semibold">{T("LG 점이 같은 용량대의 시장 무리보다 위쪽", "an LG point above the market cluster at the same capacity")}</b>{T("이면 효율 우위. LG teal 점이 특정 용량대에 없으면 ", " indicates an efficiency edge. If no LG teal point appears in a capacity band, that is a ")}<b className="font-semibold text-amber-600 dark:text-amber-400">{T("라인업 공백(진입 기회)", "lineup gap (entry opportunity)")}</b>{T(", 아래쪽에 몰리면 해당 용량 효율 개선이 과제.", "; if they cluster low, improving efficiency at that capacity is the task.")}</>} csv={{ head: [T("브랜드", "Brand"), cur.specUnit, cur.metric], rows: capData.map((p) => [p.name, p.spec, p.eff.toFixed(2)]) }}><CapScatter pts={capData} metric={cur.metric} specUnit={cur.specUnit} /></Sub>
              <Sub idx={8} title={T("브랜드 포지셔닝", "Brand Positioning")} seg={seg?.k} meaning={<><span className="font-semibold text-teal-600 dark:text-teal-400">● LG</span> · {T("x=효율, y=5성 비중%, ", "x = efficiency, y = 5-star %, ")}<b className="text-gray-700 dark:text-gray-200">{T("버블 크기=모델수(라인업 폭)", "bubble size = model count")}</b>{T(" · 우상단·큰 버블일수록 고효율·프리미엄·풀라인업", " · upper-right & larger = high-efficiency, premium, full lineup")}</>} ai={<><b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("우상단·큰 버블", "Upper-right, large bubble")}</b>{T("=고효율·프리미엄·풀라인업(이상적). LG 버블이 우상단이면 효율·등급·라인업 폭 3박자를 갖춘 것이고, 작으면 ", " = high-efficiency, premium, full lineup (ideal). An LG bubble in the upper-right has all three — efficiency, grade, and lineup breadth; if it is small, the task is ")}<b className="font-semibold">{T("라인업 확장", "lineup expansion")}</b>{T(", 좌측이면 ", "; if to the left, ")}<b className="font-semibold">{T("효율 상향", "raising efficiency")}</b>{T(", 하단이면 ", "; if low, ")}<b className="font-semibold">{T("5성 모델 확대", "expanding 5-star models")}</b>{T("가 각각의 과제.", ".")}</>} csv={{ head: [T("브랜드", "Brand"), cur.metric, T("5성%", "5★%"), T("모델수", "Models")], rows: bubbleData.map((p) => [p.name, p.eff.toFixed(2), p.s5.toFixed(0), p.n]) }}><Bubble items={bubbleData} metric={cur.metric} hi={bubBrands} /></Sub>
              {CAT_KO[cat] && priceDisp.length > 0 && (
              <Sub idx={9} title={T("브랜드별 가격대 (소매)", "Price Range by Brand (retail)")} seg={CAT_KO[cat]} meaning={<>{T("리테일러 실판매가 분포 — ", "Retailer street-price distribution — ")}<b className="text-gray-700 dark:text-gray-200">{T("박스=P25~P75, 선=중앙값", "box = P25–P75, line = median")}</b></>} ai={lgPrice ? <>LG {CAT_KO[cat]}{T(" 중앙가 ", " median price ")}<b className="font-semibold text-teal-700 dark:text-teal-300">₱{Math.round(lgPrice.med).toLocaleString()}</b>(P25~P75 ₱{Math.round(lgPrice.p25).toLocaleString()}~₱{Math.round(lgPrice.p75).toLocaleString()}) — {priceDisp[0] && priceDisp[0].med > lgPrice.med * 1.1 ? <><b className="font-semibold">{priceDisp[0].brand}</b>{T(" 등 프리미엄 대비 중가 포지션", " and other premiums — a mid-price position")}</> : <>{T("상위 가격대에 위치", "positioned in the upper price band")}</>}. <b>{T("가격대 폭이 넓을수록", "The wider the price range,")}</b>{T(" 보급형~프리미엄 풀커버, 좁으면 특정 층 집중. 효율 우위 세그먼트에서 가격 프리미엄을 ", " the fuller the coverage from entry to premium; a narrow range concentrates on one tier. In segments with an efficiency edge, ")}<b className="font-semibold text-emerald-600 dark:text-emerald-400">{T("에너지 절감 TCO로 정당화", "justifying the price premium via energy-saving TCO")}</b>{T("하는 전략이 유효.", " is an effective strategy.")}</> : <>{T("브랜드별 소매 가격대 — LG 가격 포지션과 프리미엄/보급 커버리지 진단(효율 대비 가격 매력도).", "Retail price range by brand — diagnosing LG's price position and premium/entry coverage (price appeal vs efficiency).")}</>} csv={{ head: [T("브랜드", "Brand"), "P10", "P25", T("중앙값", "Median"), "P75", "P90", T("모델수", "Models")], rows: priceRanges.map((p) => [p.brand, Math.round(p.p10), Math.round(p.p25), Math.round(p.med), Math.round(p.p75), Math.round(p.p90), p.n]) }} bigChildren={<PriceBox items={priceRanges} />}><PriceBox items={priceDisp} /></Sub>
              )}
            </div>
            </ActiveMetricCtx.Provider>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setModelOpen(true)} className="flex w-full items-center gap-2.5 rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/10 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both", animationDelay: ".28s" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-teal-600 text-white shadow-sm shadow-teal-600/25"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg></span>
              <span className="flex-1"><span className="block text-[13px] font-bold text-gray-900 dark:text-gray-50">{T("모델별 상세 (제품코드)", "Model Details (code)")}</span><span className="block text-[11px] text-gray-500 dark:text-gray-400">{T("개별 모델 스펙·효율·별점·전력·냉매 · CSV", "Per-model spec · efficiency · stars · power · refrigerant · CSV")}</span></span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-teal-500"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button type="button" onClick={() => setSimOpen(true)} className="flex w-full items-center gap-2.5 rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/10 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.22,1,.36,1) both", animationDelay: ".3s" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-teal-600 text-white shadow-sm shadow-teal-600/25"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h8M8 14h3" /></svg></span>
              <span className="flex-1"><span className="block text-[13px] font-bold text-gray-900 dark:text-gray-50">{T("전기요금 계산기 열기", "Open Bill Calculator")}</span><span className="block text-[11px] text-gray-500 dark:text-gray-400">{T("브랜드·사용강도·요금 조정 → 월/연 전기요금·LG 절감액", "Adjust brand, usage & rate → monthly/annual bill · LG savings")}</span></span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-teal-500"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            </div>
            </>
          )}
        </section>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">{T("출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · 설치형·용량 세그먼트별 브랜드 평균 ", "Source: Philippine DOE energy-efficiency label registration data (official) · brand avg by type/capacity segment ")}{cur.metric}{T("(높을수록 고효율) · TCO=DOE 라벨 월소비전력×Meralco 가정용 요금(₱", " (higher = more efficient) · TCO = DOE-label monthly kWh × Meralco residential rate (₱")}{rate.toFixed(1)}/kWh{rateAsOf ? " · " + rateAsOf + T(" 기준", " basis") : ""}{T(") 추정 · 전체 평균은 스펙 혼합 왜곡", ") est. · overall average distorted by spec mixing")}</p>

      {simOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 sm:p-8" style={{ animation: "veilIn .24s ease both" }} onClick={() => setSimOpen(false)}>
          <div className="w-full max-w-[560px] overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[0.06] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] dark:bg-gray-900 dark:ring-white/10" style={{ animation: "popIn .44s cubic-bezier(.34,1.42,.64,1) both" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 bg-teal-50/60 dark:bg-teal-500/10 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h8M8 14h3" /></svg></span>
              <div className="flex-1"><div className="text-[13.5px] font-bold text-gray-900 dark:text-gray-50">{T("전기요금 계산기", "Bill Calculator")}</div><div className="text-[11px] text-gray-500 dark:text-gray-400">{cur.label} {typ !== "전체" ? typ + " " : ""}{seg?.k}{T(" · DOE 표준 월소비전력 기반", " · based on DOE-standard monthly consumption")}</div></div>
              <button type="button" onClick={() => setSimOpen(false)} aria-label={T("닫기", "Close")} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-gray-500 transition-all duration-200 hover:bg-black/10 hover:text-gray-900 active:scale-90 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 dark:hover:text-gray-50"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
            </div>
            <div className="p-4"><EnergySim brands={simBrands} lgKwh={lgKwh} rate0={rate} /></div>
          </div>
        </div>,
        document.body
      )}

      {modelOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 sm:p-8" style={{ animation: "veilIn .24s ease both" }} onClick={() => setModelOpen(false)}>
          <div className="flex max-h-[92vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[26px] bg-white ring-1 ring-black/[0.06] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] dark:bg-gray-900 dark:ring-white/10" style={{ animation: "popIn .44s cubic-bezier(.34,1.42,.64,1) both" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
              <span className="h-[16px] w-1 rounded bg-indigo-500" />
              <h3 className="text-[14.5px] font-bold text-gray-900 dark:text-gray-50">{T("모델별 상세 · ", "Model Details · ")}{cur.label}</h3>
              <span className="rounded bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">{typ !== "전체" ? typ + " " : ""}{seg?.k} · {modelRows.length}{T("개", "")}</span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="hidden items-center gap-0.5 sm:flex">
                  {([["eff", T("효율순", "Eff.")], ["kwh", T("저전력순", "Low kWh")], ["star", T("별점순", "Stars")]] as const).map(([k, lbl]) => <button key={k} type="button" onClick={() => setMSort(k as "eff" | "kwh" | "star")} className={"rounded-md px-2 py-1 text-[11px] font-semibold transition-all " + (mSort === k ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50")}>{lbl}</button>)}
                </span>
                <button type="button" onClick={() => setMLgOnly((v) => !v)} className={"rounded-md px-2 py-1 text-[11px] font-bold transition-all " + (mLgOnly ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50")}>{T("LG만", "LG only")}</button>
                <IcoBtn onClick={() => dlCsvFrom({ head: [T("브랜드", "Brand"), T("모델(제품코드)", "Model (code)"), cur.specUnit, cur.metric, T("별점", "Stars"), T("월전력kWh", "kWh/mo"), T("냉매", "Refrigerant")], rows: modelRows.map((r) => [r.brand, r.model, r.spec ?? "—", r.eff ?? "—", r.star ?? "—", r.kwh ?? "—", r.refrigerant || "—"]) }, "에너지_모델별_" + cur.label)} title={T("CSV 다운로드", "Download CSV")} d={ICO.csv} />
                <button type="button" onClick={() => setModelOpen(false)} aria-label={T("닫기", "Close")} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-gray-500 transition-all duration-200 hover:bg-black/10 hover:text-gray-900 active:scale-90 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 dark:hover:text-gray-50"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
              </span>
            </div>
            <div className="overflow-auto">
              {modelRows.length === 0 ? <div className="flex h-40 items-center justify-center text-[12.5px] text-gray-400">{T("해당 세그먼트 모델 없음", "No models in this segment")}</div> : (
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900"><tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2 text-left font-semibold">{T("브랜드", "Brand")}</th><th className="px-3 py-2 text-left font-semibold">{T("모델 (제품코드)", "Model (code)")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{cur.specUnit}</th><th className="px-3 py-2 text-right font-semibold">{cur.metric}</th>
                    <th className="px-3 py-2 text-right font-semibold">{T("별점", "Stars")}</th><th className="px-3 py-2 text-right font-semibold">{T("월 kWh", "kWh/mo")}</th><th className="px-3 py-2 text-left font-semibold">{T("냉매", "Refrigerant")}</th>
                  </tr></thead>
                  <tbody>{modelRows.map((r, i) => { const isLG = /^lg$/i.test(r.brand); return (
                    <tr key={i} className={"border-b border-gray-100 dark:border-gray-800/60 " + (isLG ? "bg-teal-50/60 dark:bg-teal-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/40")}>
                      <td className={"px-3 py-1.5 " + (isLG ? "font-bold text-teal-700 dark:text-teal-300" : "text-gray-700 dark:text-gray-200")}>{r.brand}</td>
                      <td className="max-w-[280px] truncate px-3 py-1.5 text-gray-600 dark:text-gray-300" title={r.model}>{r.model}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.spec ?? "—"}</td>
                      <td className={"px-3 py-1.5 text-right font-semibold tabular-nums " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{r.eff != null ? r.eff.toFixed(2) : "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{r.star != null ? "★".repeat(Math.min(5, r.star)) : "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{r.kwh != null ? Math.round(r.kwh) : "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{r.refrigerant || "—"}</td>
                    </tr>
                  ) })}</tbody>
                </table>
              )}
            </div>
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-2 text-[10.5px] text-gray-400 dark:text-gray-500">{T("현재 세그먼트(", "Current segment (")}{cur.label} {typ !== "전체" ? typ + " " : ""}{seg?.k}{T(")의 개별 모델 · ", ") individual models · ")}<b className="text-teal-600 dark:text-teal-400">{T("LG 강조", "LG in teal")}</b>{T(" · DOE 라벨 등록 데이터", " · DOE label registration data")}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
