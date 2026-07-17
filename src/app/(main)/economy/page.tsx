"use client"

import React, { useEffect, useMemo, useState } from "react"
import DailyIndicators from "@/components/DailyIndicators"
import { homeBand, pricesDomain } from "@/lib/supabase"
import type { PricesDomain } from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 경제지표 페이지 — 도메인 메뉴(리스트형) + 물가·생활비 도메인 상세.
 *  색=사업영향(원가·물가↑=로즈, 수요·구매력↑=에메랄드, 중립=인디고).
 *  물가 헤드라인=YoY(표준)+6개월 전망콘(BSP 공식앵커, ESTIMATED).
 *  당월/누적 토글=기여도 기준 + 헤드라인 보조수치. 롤링 24개월(18실적+6전망).
 */

type Card = Awaited<ReturnType<typeof homeBand>>[number]

const NAV = [
  { id: "core", ko: "핵심 요약", sub: "오늘의 수치 + 대표 지표 한 화면", count: "KPI 12" },
  { id: "prices", ko: "물가·생활비", sub: "CPI 10품목 + 지역별 물가 히트맵", count: "10+지역20" },
  { id: "growth", ko: "성장·경기", sub: "GDP 부문분해·투자·가동률·건축허가", count: "14" },
  { id: "rates", ko: "금리·통화·신용", sub: "BSP 3금리·M3·대출(소비자/카드)", count: "9" },
  { id: "labor", ko: "고용·소득·송금", sub: "실업·최저임금·OFW 송금(구성별)", count: "11" },
  { id: "sentiment", ko: "소비·기업 심리", sub: "CCI·BCI·내구재 구매의향(장기)", count: "5" },
  { id: "appliance", ko: "가전 선행지표", sub: "가전 PPI·수입액·가전/에어컨 물가", count: "8" },
  { id: "market", ko: "가전시장·제품별", sub: "에어컨·냉장고·TV·세탁기별 LG점유·ASP·할인갭", count: "1,900+", accent: true },
  { id: "radar", ko: "사업 레이더", sub: "원가압박·OFW구매력·실질물가·TCO", count: "파생", star: true },
]

const num = (s: string | undefined) => {
  const v = parseFloat((s ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(v) ? v : 0
}
const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00")
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}
const moShort = (iso: string) => Number(iso.slice(5, 7)) + "월"

/* ============ 알약+슬라이드 토글 (당월/누적) ============ */
function BasisToggle({ value, onChange }: { value: "mom" | "ytd"; onChange: (v: "mom" | "ytd") => void }) {
  return (
    <div className="relative inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-semibold">
      <span
        className="absolute inset-y-0.5 rounded-full bg-indigo-600 shadow-sm transition-all duration-300 ease-out"
        style={{ left: value === "mom" ? "2px" : "50%", width: "calc(50% - 2px)" }}
      />
      {(["mom", "ytd"] as const).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={"relative z-10 w-14 rounded-full py-1 transition-colors duration-300 " + (value === k ? "text-white" : "text-gray-500 hover:text-gray-700")}
        >
          {k === "mom" ? "당월" : "누적"}
        </button>
      ))}
    </div>
  )
}

/* ============ 헤드라인 팬차트 (YoY 실적 + 6M 전망콘) ============ */
function FanChart({ actual, adates, fdates, forecast }: { actual: (number | null)[]; adates: string[]; fdates: string[]; forecast: number[] }) {
  const W = 560, H = 150, padT = 10, padB = 18, padL = 6, cH = H - padT - padB
  const all = [...actual.filter((v): v is number => v != null), ...forecast]
  const max = Math.max(...all, 8), min = Math.min(...all, 0)
  const span = max - min || 1
  const n = actual.length + forecast.length
  const step = (W - padL) / (n - 1)
  const y = (v: number) => padT + (max - v) / span * cH
  const x = (i: number) => padL + i * step
  const zeroY = y(0)
  const aPts: string[] = []
  actual.forEach((v, i) => { if (v != null) aPts.push(x(i) + "," + y(v)) })
  const lastActualIdx = actual.length - 1
  const lastActualVal = actual[lastActualIdx]
  const fStart = actual.length
  const fPts = forecast.map((v, i) => x(fStart + i) + "," + y(v))
  const coneUp = forecast.map((v, i) => x(fStart + i) + "," + y(v + 0.4 * (i + 1)))
  const coneDn = forecast.map((v, i) => x(fStart + i) + "," + y(v - 0.4 * (i + 1))).reverse()
  const anchor = lastActualVal != null ? x(lastActualIdx) + "," + y(lastActualVal) : fPts[0]
  const conePath = "M" + anchor + " L" + coneUp.join(" L") + " L" + coneDn.join(" L") + " Z"
  const gridV = [0, 2, 4, 6, 8].filter((g) => g <= max + 0.5)
  const ticks = [0, 5, 11, 17, 23]
  const labels24 = adates.map(moShort).concat(fdates.map(moShort))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden>
      <rect x={padL} y={y(4)} width={W - padL} height={Math.max(0, y(2) - y(4))} fill="rgba(99,102,241,0.06)" />
      {gridV.map((g) => (
        <g key={g}>
          <line x1={padL} y1={y(g)} x2={W} y2={y(g)} stroke="#eef1f4" />
          <text x={0} y={y(g) + 3} fontSize="7" fill="#94a3b8">{g}</text>
        </g>
      ))}
      {min < 0 && <line x1={padL} y1={zeroY} x2={W} y2={zeroY} stroke="#cbd5e1" />}
      <line x1={x(lastActualIdx)} y1={padT} x2={x(lastActualIdx)} y2={H - padB} stroke="#e2e8f0" strokeDasharray="2,2" />
      <path d={conePath} fill="rgba(99,102,241,0.12)" style={{ transition: "d .5s ease" }} />
      <polyline points={aPts.join(" ")} fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={(anchor + " " + fPts.join(" "))} fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4,3" strokeLinecap="round" />
      {lastActualVal != null && <circle cx={x(lastActualIdx)} cy={y(lastActualVal)} r="3.4" fill="#6366f1" />}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 4} fontSize="6.5" fill="#94a3b8" textAnchor="middle">{labels24[i]}</text>
      ))}
    </svg>
  )
}

/* ============ 지역 히트맵 ============ */
function RegionHeatmap({ rows }: { rows: Record<string, number>[] }) {
  const cols: [string, string][] = [
    ["전체", "inf_all_items"], ["식품", "inf_food"], ["쌀", "inf_rice"],
    ["전기", "inf_electricity"], ["가전", "inf_appliances"], ["에어컨", "inf_aircon"],
  ]
  const top = [...rows].sort((a, b) => num(String(b.inf_all_items)) - num(String(a.inf_all_items))).slice(0, 6)
  const shade = (v: number) => "rgba(225,29,72," + (0.06 + Math.max(0, Math.min(1, v / 25)) * 0.8).toFixed(3) + ")"
  return (
    <div className="mt-2 grid gap-0.5" style={{ gridTemplateColumns: "auto repeat(6,1fr)" }}>
      <div />
      {cols.map(([c]) => <div key={c} className="text-center text-[7.5px] text-gray-400">{c}</div>)}
      {top.map((r, ri) => (
        <React.Fragment key={ri}>
          <div className="flex items-center justify-end pr-1 text-right text-[7.5px] text-gray-500">{String(r.geo).replace("Region ", "")}</div>
          {cols.map(([, key]) => {
            const v = num(String(r[key]))
            const t = Math.max(0, Math.min(1, v / 25))
            return (
              <div key={key} className="flex h-[15px] items-center justify-center rounded-sm text-[7px] tabular-nums" style={{ background: shade(v), color: t > 0.55 ? "#fff" : "#334155" }}>
                {v.toFixed(1)}
              </div>
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}

/* ============ 지역 분포 ============ */
function RegionDist({ rows }: { rows: Record<string, number>[] }) {
  const vals = rows.map((r) => num(String(r.inf_all_items))).filter((v) => v > 0)
  if (!vals.length) return null
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
  const px = (v: number) => ((v - lo) / (hi - lo || 1)) * 100
  return (
    <div>
      <div className="mt-1 flex gap-3 text-[9px] text-gray-400">
        <div>평균<b className="block text-[13px] text-gray-800">{mean.toFixed(1)}</b></div>
        <div>범위<b className="block text-[13px] text-gray-800">{lo.toFixed(1)}–{hi.toFixed(1)}</b></div>
        <div>σ<b className="block text-[13px] text-gray-800">{sd.toFixed(1)}</b></div>
      </div>
      <div className="relative mt-3 h-9">
        <div className="absolute inset-x-0 bottom-3 border-t border-gray-200" />
        <div className="absolute bottom-0 top-0.5 border-l border-dashed border-rose-400" style={{ left: px(mean) + "%" }} />
        {vals.map((v, i) => (
          <div key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-indigo-400/50" style={{ left: px(v) + "%", top: 12 + (i % 3) * 6 }} />
        ))}
        <span className="absolute bottom-0 left-0 text-[8px] text-gray-400">{lo.toFixed(1)}</span>
        <span className="absolute bottom-0 right-0 text-[8px] text-gray-400">{hi.toFixed(1)}</span>
      </div>
    </div>
  )
}

/* ============ 실질 지표 (가로형) ============ */
function RealBars({ yoy, policyRate, remitYoY }: { yoy: number; policyRate: number | null; remitYoY: number | null }) {
  const rows: { name: string; sub: string; v: number | null }[] = [
    { name: "정책금리", sub: (policyRate ?? "?") + "−" + yoy.toFixed(1), v: policyRate != null ? +(policyRate - yoy).toFixed(2) : null },
    { name: "송금", sub: remitYoY != null ? remitYoY.toFixed(1) + "−" + yoy.toFixed(1) : "확인 후 기입", v: remitYoY != null ? +(remitYoY - yoy).toFixed(2) : null },
    { name: "대출금리", sub: "확인 후 기입", v: null },
    { name: "예금금리", sub: "확인 후 기입", v: null },
    { name: "최저임금", sub: "확인 후 기입", v: null },
  ]
  const MAX = 5
  return (
    <div className="mt-2 grid grid-cols-5 gap-1">
      {rows.map((r) => {
        const has = r.v != null
        const neg = has && (r.v as number) < 0
        const h = has ? Math.min(38, (Math.abs(r.v as number) / MAX) * 38) : 0
        return (
          <div key={r.name} className="flex flex-col items-center">
            <div className="relative h-[76px] w-full">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200" />
              {has && (
                <div
                  className="absolute left-[22%] w-[56%] rounded-sm"
                  style={{ height: h, [neg ? "top" : "bottom"]: "50%", background: neg ? "linear-gradient(180deg,rgba(225,29,72,.55),rgba(225,29,72,.9))" : "linear-gradient(180deg,rgba(5,150,105,.9),rgba(5,150,105,.55))" } as React.CSSProperties}
                />
              )}
              <div className="absolute inset-x-0 text-center text-[9.5px] font-extrabold tabular-nums" style={{ [neg ? "top" : "bottom"]: `${38 + h + 2}px`, color: has ? (neg ? "#e11d48" : "#059669") : "#cbd5e1" } as React.CSSProperties}>
                {has ? ((r.v as number) > 0 ? "+" : "") + (r.v as number).toFixed(1) : "—"}
              </div>
            </div>
            <div className="mt-1 text-center text-[8px] font-semibold text-gray-600">
              {r.name}
              <span className="block text-[6.5px] font-normal text-gray-400">{r.sub}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ============ 물가·생활비 도메인 ============ */
function PricesView({ data, byKey }: { data: PricesDomain; byKey: Record<string, Card> }) {
  const [basis, setBasis] = useState<"mom" | "ytd">("mom")
  const all = data.idx["CPI_all_items"]

  const m = useMemo(() => {
    if (!all || all.values.length < 13) return null
    const v = all.values, dts = all.dates
    const nLast = v.length - 1
    const yoy = +((v[nLast] / v[nLast - 12] - 1) * 100).toFixed(1)
    const mom = v.map((x, i) => (i >= 1 ? +((x / v[i - 1] - 1) * 100).toFixed(2) : null))
    const ytd = v.map((x, i) => {
      const yr = dts[i].slice(0, 4)
      let base = -1
      for (let j = i; j >= 0; j--) if (dts[j].slice(0, 4) === yr && dts[j].slice(5, 7) === "01") { base = j - 1; break }
      return base >= 0 ? +((x / v[base] - 1) * 100).toFixed(2) : null
    })
    const fdates = [1, 2, 3, 4, 5, 6].map((k) => addMonths(dts[nLast], k))
    const series = basis === "mom" ? mom : ytd
    const finite = series.filter((z): z is number => z != null)
    const last6 = finite.slice(-6)
    const avg = last6.reduce((a, b) => a + b, 0) / (last6.length || 1)
    const fc = basis === "mom"
      ? fdates.map(() => +avg.toFixed(2))
      : fdates.map((_, i) => +((series[nLast] ?? avg) + avg * (i + 1)).toFixed(2))
    const momNow = mom[nLast] ?? 0
    const ytdNow = ytd[nLast] ?? 0
    return { yoy, series, adates: dts, fdates, fc, momNow, ytdNow, lastDate: dts[nLast] }
  }, [all, basis])

  if (!m) return <p className="text-[12px] text-gray-400">데이터 로딩 중…</p>

  const appinf = num(byKey.appinf?.value), cpi = num(byKey.cpi?.value)
  const gap = +(appinf - cpi).toFixed(1)
  const remit = byKey.remit, fx = byKey.fx, cci = byKey.cci, durable = byKey.durable, food = byKey.foodinf
  const peso = remit && fx ? (num(remit.value) * num(fx.value)) : null

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[14px] font-bold text-gray-900">물가·생활비 <span className="text-[9px] font-normal text-gray-400">· {m.lastDate.slice(0, 7).replace("-", ".")} · PSA/BSP</span></div>
        <BasisToggle value={basis} onChange={setBasis} />
      </div>

      <div className="grid gap-2.5 md:grid-cols-[1.75fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-gray-900">
            전체 물가
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[8px] font-bold text-rose-600">목표 상회</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-500">전망 EST</span>
          </div>
          <div className="mt-0.5 text-[23px] font-bold tabular-nums text-gray-900">
            {m.yoy}<span className="text-[10px] font-medium text-gray-400">% YoY · 목표 2–4% · 전망앵커 BSP 6.4→4.5%</span>
          </div>
          <div className="mt-0.5 text-[10px] tabular-nums text-gray-500">
            당월 {m.momNow > 0 ? "+" : ""}{m.momNow.toFixed(1)}% · 올해누적 {m.ytdNow > 0 ? "+" : ""}{m.ytdNow.toFixed(1)}%
          </div>
          <FanChart actual={m.series} adates={m.adates} fdates={m.fdates} forecast={m.fc} />
          <div className="mt-1 flex flex-wrap gap-2.5 text-[8px] text-gray-400">
            <span><span className="mr-1 inline-block h-0 w-3 border-t-2 border-indigo-500 align-middle" />실적</span>
            <span><span className="mr-1 inline-block h-0 w-3 border-t-2 border-dashed border-indigo-500 align-middle" />전망(추세연장·EST)</span>
            <span>◦ 롤링 24개월(18실적+6전망) · 목표밴드 2–4%</span>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2.5">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">● 중립·지연</span>
            <span className="text-[11px] font-bold text-gray-900">가전 수요</span>
          </div>
          <div className="border-b border-gray-100 px-3 pb-2">
            <div className="text-[9px] text-gray-400">실질가격 갭 · 가전−전체</div>
            <div className={"text-[24px] font-extrabold leading-tight tabular-nums " + (gap < 0 ? "text-emerald-600" : "text-rose-600")}>{gap > 0 ? "+" : ""}{gap}<span className="text-[10px] font-semibold text-gray-400">%p</span></div>
          </div>
          <div className="flex flex-col gap-1.5 px-3 py-2 text-[10px] text-gray-600">
            {peso != null && <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />OFW 구매력<span className="ml-auto font-bold tabular-nums text-gray-800">₱{peso.toFixed(0)}B</span></div>}
            {food && <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />필수재(식품)<span className="ml-auto font-bold tabular-nums text-gray-800">{food.value}%</span></div>}
            {durable && <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />내구재 의향<span className="ml-auto font-bold tabular-nums text-gray-800">{durable.value}</span></div>}
            {cci && <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />소비자신뢰<span className="ml-auto font-bold tabular-nums text-gray-800">{cci.value}</span></div>}
          </div>
          <div className="mt-auto px-3 pb-2.5 text-[9px] font-semibold text-indigo-500">저가·필수형 우선 ▸</div>
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11.5px] font-bold text-gray-900">품목별 기여도 <span className="text-[8px] font-normal text-gray-400">· {basis === "mom" ? "당월" : "누적"} · 선=전체지수</span></div>
          <div className="mt-2 flex h-[130px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 text-center">
            <div className="flex gap-1">
              {[10, 16, 22, 14, 8].map((h, i) => <div key={i} className="w-2.5 animate-pulse rounded-sm bg-gray-200" style={{ height: h * 2, animationDelay: i * 120 + "ms" }} />)}
            </div>
            <div className="text-[10px] font-semibold text-gray-500">PSA 공식 가중치 수집 중</div>
            <div className="text-[8.5px] text-gray-400">COICOP-2018 부문 가중치 적재 후 정식 기여도 분해</div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-gray-900">실질 지표 <span className="ml-auto rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[8px] font-normal text-gray-500">물가 <b className="text-rose-600">{m.yoy}%</b></span></div>
          <RealBars yoy={m.yoy} policyRate={data.policyRate} remitYoY={remit?.deltaYoy ?? null} />
          <div className="mt-1 flex justify-between text-[7px] text-gray-400"><span>−5 압박</span><span>0</span><span>+5 여유</span></div>
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-[1.25fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11.5px] font-bold text-gray-900">지역 × 품목 <span className="text-[8px] font-normal text-gray-400">· 물가 상위 {Math.min(6, data.region.length)}개 지역</span></div>
          <RegionHeatmap rows={data.region} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11.5px] font-bold text-gray-900">지역 물가 분포 <span className="text-[8px] font-normal text-gray-400">· 전국 {data.region.length}곳</span></div>
          <RegionDist rows={data.region} />
        </div>
      </div>

      <p className="text-[9px] leading-snug text-gray-400">색=사업영향(원가·물가↑ 로즈, 수요·구매력↑ 에메랄드) · 전망·기대는 ESTIMATED · 실질 대출/예금/임금은 확인 후 기입</p>
    </div>
  )
}

/* ============ 준비 중 도메인 ============ */
function Soon({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 text-center">
      <div className="text-[13px] font-bold text-gray-500">{label}</div>
      <div className="text-[11px] text-gray-400">물가·생활비 템플릿을 이 도메인에도 적용 예정</div>
    </div>
  )
}

export default function Page() {
  const { lang } = useLang()
  const en = lang === "en"
  const [active, setActive] = useState("prices")
  const [band, setBand] = useState<Card[] | null>(null)
  const [prices, setPrices] = useState<PricesDomain | null>(null)

  useEffect(() => {
    homeBand().then(setBand).catch(() => setBand([]))
    pricesDomain().then(setPrices).catch(() => setPrices({ idx: {}, forecast: [], policyRate: null, region: [] }))
  }, [])

  const byKey = useMemo(() => {
    const map: Record<string, Card> = {}
    ;(band ?? []).forEach((c) => (map[c.key] = c))
    return map
  }, [band])

  function view() {
    if (active === "core") return <DailyIndicators />
    if (active === "prices") {
      if (!prices || band === null) return <div className="h-64 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      return <PricesView data={prices} byKey={byKey} />
    }
    const label = NAV.find((n) => n.id === active)?.ko ?? ""
    return <Soon label={label} />
  }

  return (
    <main className="px-4 pb-10 pt-3 sm:px-6">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-[88px]">
          <div className="px-2.5 py-3">
            <p className="mb-2 px-1.5 text-[14px] font-bold tracking-tight text-gray-900">{en ? "View" : "보기"}</p>
            <nav className="flex flex-col gap-0.5">
              {NAV.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => setActive(n.id)}
                  style={{ animation: "fadeUp .4s ease both", animationDelay: `${i * 40}ms` }}
                  className={
                    "group w-full rounded-lg px-2.5 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                    (active === n.id ? "bg-indigo-50 ring-1 ring-indigo-100" : "hover:bg-indigo-50/40")
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <span className={"flex-1 text-[13px] " + (active === n.id ? "font-bold text-indigo-700" : "font-semibold text-gray-800 group-hover:text-indigo-600")}>
                      {n.star && <span className="text-amber-500">★ </span>}
                      {n.accent && <span className="text-violet-500">◆ </span>}
                      {n.ko}
                    </span>
                    <span className={"shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums " + (active === n.id ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400")}>{n.count}</span>
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-gray-400">{n.sub}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>
        <div className="min-w-0">
          <div key={active} style={{ animation: "fadeUp .4s ease both" }}>{view()}</div>
        </div>
      </div>
    </main>
  )
}
