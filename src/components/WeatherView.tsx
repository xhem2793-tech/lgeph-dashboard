"use client"

import React, { useEffect, useMemo, useState } from "react"
import { macroMonthly, weatherRecent, typhoonAlerts, earthquakesRecent } from "@/lib/supabase"
import type { WxDay, Typhoon, Quake } from "@/lib/supabase"
import { ChartCard, Lg, fmtLabels, type SLine } from "@/components/EconChart"

/** 날씨·재난 — 냉방도일(CDD)·기온(가전 냉방 수요 선행) + 태풍·지진(공급망·매장·재난 후 교체수요 리스크).
 *  데이터: macro_indicators(cdd_monthly·temp_monthly)·weather(일별)·weather_alerts(태풍)·earthquakes(USGS 실측). */

const C = { rose: "#dc2626", amber: "#d99400", ind: "#6366f1", teal: "#0f766e", blue: "#0284c7" }
const WIN = [{ k: "1Y", n: 1 }, { k: "2Y", n: 2 }, { k: "전체", n: 10 }]

type Mon = Record<string, { dates: string[]; values: number[] }>
function monSeries(d: Mon, key: string, years: number, name: string, color: string): { series: SLine[]; labels: string[] } {
  const s = d[key]
  if (!s || s.values.length < 2) return { series: [], labels: [] }
  const latest = s.dates[s.dates.length - 1]
  const cutoff = (Number(latest.slice(0, 4)) - years) + latest.slice(4)
  const idx = s.dates.map((dt, i) => ({ dt, i })).filter((x) => x.dt >= cutoff)
  const use = idx.length >= 2 ? idx : s.dates.map((dt, i) => ({ dt, i })).slice(-Math.min(2, s.dates.length))
  return { series: [{ name, color, data: use.map((x) => s.values[x.i]), w: 2 }], labels: fmtLabels(use.map((x) => x.dt)) }
}

const SIG: Record<number, { t: string; c: string }> = {
  0: { t: "해제", c: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
  1: { t: "신호 1", c: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  2: { t: "신호 2", c: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  3: { t: "신호 3", c: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  4: { t: "신호 4", c: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" },
  5: { t: "신호 5", c: "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200" },
}
const relDays = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? "오늘" : d === 1 ? "어제" : d < 30 ? d + "일 전" : Math.round(d / 30) + "개월 전"
}
const magColor = (m: number) => (m >= 6 ? "#b91c1c" : m >= 5 ? "#ea580c" : m >= 4.5 ? "#d99400" : "#0f766e")
// PAGASA 열지수(Heat Index) 위험 단계
function heatRisk(hi: number | null): { t: string; c: string; bg: string } {
  if (hi == null) return { t: "—", c: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800" }
  if (hi >= 52) return { t: "매우위험", c: "text-red-800 dark:text-red-300", bg: "bg-red-100 dark:bg-red-500/20" }
  if (hi >= 42) return { t: "위험", c: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" }
  if (hi >= 33) return { t: "경보", c: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10" }
  if (hi >= 27) return { t: "주의", c: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-500/10" }
  return { t: "안전", c: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10" }
}
const MONF = ["1","2","3","4","5","6","7","8","9","10","11","12"]

/** 월별 기후 평년 — 강수(막대) + 열지수(선). 우기(6~10월)·건기 패턴 */
function ClimateChart({ mon }: { mon: { rain: number; hi: number }[] }) {
  if (mon.length < 12) return <div className="flex h-full items-center justify-center text-[13px] text-gray-400">데이터 부족</div>
  const W = 420, H = 150, padB = 20, padT = 10, padL = 8
  const rMax = Math.max(...mon.map((m) => m.rain), 1)
  const hiMin = Math.min(...mon.map((m) => m.hi)), hiMax = Math.max(...mon.map((m) => m.hi))
  const bw = (W - padL * 2) / 12
  const ry = (v: number) => padT + (H - padT - padB) * (1 - v / rMax)
  const hy = (v: number) => padT + (H - padT - padB) * (1 - (v - hiMin + 1) / (hiMax - hiMin + 2))
  const hpts = mon.map((m, i) => `${padL + bw * i + bw / 2},${hy(m.hi)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
      {/* 우기 음영 6~10월 */}
      <rect x={padL + bw * 5} y={padT} width={bw * 5} height={H - padT - padB} fill="#38bdf8" fillOpacity="0.07" />
      {mon.map((m, i) => (
        <rect key={i} x={padL + bw * i + 2} y={ry(m.rain)} width={bw - 4} height={H - padB - ry(m.rain)} fill="#0ea5e9" fillOpacity="0.55" rx="1.5" />
      ))}
      <polyline points={hpts} fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {mon.map((m, i) => <circle key={i} cx={padL + bw * i + bw / 2} cy={hy(m.hi)} r="1.8" fill="#dc2626" />)}
      {MONF.map((mm, i) => <text key={i} x={padL + bw * i + bw / 2} y={H - 6} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 8 }}>{mm}</text>)}
      <text x={padL + bw * 7.5} y={padT + 8} textAnchor="middle" className="fill-sky-500" style={{ fontSize: 8.5, fontWeight: 700 }}>우기</text>
    </svg>
  )
}

/** 일별 기온(최저~최고 밴드+평균선) + 강수 막대 — 최근 N일 */
function DailyChart({ days }: { days: WxDay[] }) {
  const d = days.slice(-90).filter((x) => x.maxT != null && x.minT != null)
  if (d.length < 3) return <div className="flex h-full items-center justify-center text-[13px] text-gray-400">데이터 부족</div>
  const W = 420, H = 150, padB = 18, padT = 8, padL = 6
  const temps = d.flatMap((x) => [x.maxT!, x.minT!])
  const tMin = Math.min(...temps) - 1, tMax = Math.max(...temps) + 1
  const rMax = Math.max(...d.map((x) => x.rain ?? 0), 1)
  const bw = (W - padL * 2) / d.length
  const ty = (v: number) => padT + (H - padT - padB) * 0.62 * (1 - (v - tMin) / (tMax - tMin))
  const x = (i: number) => padL + bw * i + bw / 2
  const band = d.map((p, i) => `${x(i)},${ty(p.maxT!)}`).concat(d.slice().reverse().map((p, i) => `${x(d.length - 1 - i)},${ty(p.minT!)}`)).join(" ")
  const avg = d.map((p, i) => `${x(i)},${ty(p.avgT ?? (p.maxT! + p.minT!) / 2)}`).join(" ")
  const ry = (v: number) => H - padB - (H - padB - (padT + (H - padT - padB) * 0.66)) * (v / rMax)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
      {d.map((p, i) => { const rr = p.rain ?? 0; if (!rr) return null; return <rect key={i} x={x(i) - bw / 2 + 0.4} y={ry(rr)} width={Math.max(0.8, bw - 0.8)} height={H - padB - ry(rr)} fill="#0ea5e9" fillOpacity="0.5" /> })}
      <polygon points={band} fill="#f59e0b" fillOpacity="0.16" />
      <polyline points={avg} fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x={padL} y={H - 5} className="fill-gray-400" style={{ fontSize: 8 }}>{d[0].date.slice(5).replace("-", "/")}</text>
      <text x={W - padL} y={H - 5} textAnchor="end" className="fill-gray-400" style={{ fontSize: 8 }}>{d[d.length - 1].date.slice(5).replace("-", "/")}</text>
    </svg>
  )
}

/** 최근 지진 규모 스트립 — 시간축 위 규모 점(색=규모) */
function QuakeStrip({ quakes }: { quakes: Quake[] }) {
  const [hi, setHi] = useState<number | null>(null)
  if (!quakes.length) return <div className="flex h-32 items-center justify-center text-[13px] text-gray-400">지진 데이터 없음</div>
  const pts = [...quakes].reverse() // 오래된→최신
  const t0 = new Date(pts[0].at).getTime(), t1 = new Date(pts[pts.length - 1].at).getTime()
  const span = Math.max(1, t1 - t0)
  const W = 720, H = 150, padB = 22, padT = 10
  const maxM = Math.max(6, ...pts.map((p) => p.mag))
  const x = (t: number) => 8 + (W - 16) * ((t - t0) / span)
  const y = (m: number) => padT + (H - padT - padB) * (1 - (m - 3.5) / (maxM - 3.5))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }} onMouseLeave={() => setHi(null)}>
      {[4, 5, 6].map((m) => (
        <g key={m}>
          <line x1="8" x2={W - 8} y1={y(m)} y2={y(m)} stroke="currentColor" className="text-gray-200 dark:text-gray-800" strokeWidth="1" strokeDasharray="3 3" />
          <text x="10" y={y(m) - 2} className="fill-gray-400" style={{ fontSize: 9 }}>M{m}</text>
        </g>
      ))}
      {pts.map((p, i) => {
        const cx = x(new Date(p.at).getTime()), cy = y(p.mag)
        return <circle key={i} cx={cx} cy={cy} r={hi === i ? 5 : 2 + (p.mag - 3.5) * 1.4} fill={magColor(p.mag)} fillOpacity={hi == null || hi === i ? 0.85 : 0.25} onMouseEnter={() => setHi(i)} style={{ cursor: "pointer", transition: "r .15s" }} />
      })}
      {hi != null && (() => {
        const p = pts[hi], cx = x(new Date(p.at).getTime())
        return <text x={Math.min(W - 120, Math.max(8, cx - 40))} y={padT + 8} className="fill-gray-700 dark:fill-gray-200" style={{ fontSize: 10, fontWeight: 700 }}>M{p.mag.toFixed(1)} · {p.place.slice(0, 26)}</text>
      })()}
      <text x="8" y={H - 6} className="fill-gray-400" style={{ fontSize: 9 }}>{pts[0].at.slice(0, 7)}</text>
      <text x={W - 8} y={H - 6} textAnchor="end" className="fill-gray-400" style={{ fontSize: 9 }}>{pts[pts.length - 1].at.slice(0, 7)}</text>
    </svg>
  )
}

function Panel({ title, seg, children, meaning, src }: { title: string; seg?: string; children: React.ReactNode; meaning: React.ReactNode; src: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        {seg && <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">{seg}</span>}
      </div>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {meaning}</p>
      <p className="mt-auto pt-2 text-[11px] text-gray-400 dark:text-gray-500">{src}</p>
    </div>
  )
}

export default function WeatherView() {
  const [win, setWin] = useState("2Y")
  const [mon, setMon] = useState<Mon>({})
  const [wx, setWx] = useState<WxDay[]>([])
  const [tys, setTys] = useState<Typhoon[]>([])
  const [eqs, setEqs] = useState<Quake[]>([])

  useEffect(() => {
    macroMonthly(["cdd_monthly", "temp_monthly", "enso_oni"]).then(setMon).catch(() => {})
    weatherRecent(400).then(setWx).catch(() => {})
    typhoonAlerts(8).then(setTys).catch(() => {})
    earthquakesRecent(365, 4).then(setEqs).catch(() => {})
  }, [])

  const years = WIN.find((w) => w.k === win)!.n
  const cdd = useMemo(() => monSeries(mon, "cdd_monthly", years, "냉방도일 CDD", C.rose), [mon, years])
  const enso = useMemo(() => monSeries(mon, "enso_oni", Math.max(years, 3), "ONI 지수", C.blue), [mon, years])
  const oni = mon.enso_oni?.values?.at(-1)
  const phase = oni == null ? null
    : oni >= 0.5 ? { t: "엘니뇨", c: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", dot: "bg-rose-500", d: "건조·고온 경향 — 냉방·냉장 수요↑, 가뭄·전력수급 리스크" }
    : oni <= -0.5 ? { t: "라니냐", c: "text-sky-700 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-500/10", dot: "bg-sky-500", d: "다우·태풍 경향 — 홍수·물류 차질, 제습·에어케어 수요" }
    : { t: "중립(Neutral)", c: "text-gray-600 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-800", dot: "bg-gray-400", d: "평년 수준 — 계절 패턴 우세" }

  const cddLatest = mon.cdd_monthly?.values?.at(-1)
  const activeTy = tys.filter((t) => t.maxSignal > 0)
  const bigQuakes = eqs.filter((q) => q.mag >= 5)
  const maxQuake = eqs.length ? Math.max(...eqs.map((q) => q.mag)) : null
  // 현재 기상(최신일) + 월별 기후 평년
  const cur = wx.length ? wx[wx.length - 1] : null
  const hr = heatRisk(cur?.heat ?? null)
  const monthly = useMemo(() => {
    const acc = Array.from({ length: 12 }, () => ({ r: 0, hi: 0, n: 0, hn: 0 }))
    for (const d of wx) { const m = Number(d.date.slice(5, 7)) - 1; if (m < 0 || m > 11) continue; if (d.rain != null) { acc[m].r += d.rain } acc[m].n++; if (d.heat != null) { acc[m].hi += d.heat; acc[m].hn++ } }
    return acc.map((a) => ({ rain: a.n ? a.r / a.n : 0, hi: a.hn ? a.hi / a.hn : 0 }))
  }, [wx])
  const season = cur ? (Number(cur.date.slice(5, 7)) >= 6 && Number(cur.date.slice(5, 7)) <= 10 ? "우기(6~10월)" : "건기(11~5월)") : ""

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

      {/* 현재 기상 히어로 — 날씨 대시보드 상단 */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-sky-50 via-white to-white dark:from-sky-500/10 dark:via-gray-900 dark:to-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* 현재 기온 */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="num text-[30px] font-extrabold leading-none text-gray-900 dark:text-gray-50">{cur?.maxT != null ? Math.round(cur.maxT) : "–"}°</span>
                <span className="num text-[16px] font-semibold text-gray-400 dark:text-gray-500">/ {cur?.minT != null ? Math.round(cur.minT) : "–"}°</span>
              </div>
              <div className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">필리핀(전국 관측) · {cur ? cur.date.slice(5).replace("-", "/") : "—"} · {season}</div>
            </div>
          </div>
          {/* 체감(열지수) */}
          <div className="flex flex-col">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">체감(열지수)</span>
            <span className="flex items-center gap-1.5">
              <span className="num text-[21px] font-bold text-gray-900 dark:text-gray-50">{cur?.heat != null ? cur.heat.toFixed(1) + "°" : "–"}</span>
              <span className={"rounded px-1.5 py-0.5 text-[11px] font-bold " + hr.bg + " " + hr.c}>{hr.t}</span>
            </span>
          </div>
          {/* 타일 */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { l: "강수", v: cur?.rain != null ? cur.rain.toFixed(0) + "mm" : "–", c: "text-sky-700 dark:text-sky-300" },
              { l: "ENSO", v: phase ? phase.t : "–", c: phase ? phase.c.split(" ")[0] : "text-gray-500" },
              { l: "냉방도일", v: cddLatest != null ? Math.round(cddLatest) + "" : "–", c: "text-rose-700 dark:text-rose-300" },
              { l: "활성태풍", v: activeTy.length + "건", c: "text-amber-700 dark:text-amber-300" },
              { l: "지진 M4+", v: eqs.length + "건", c: "text-orange-700 dark:text-orange-300" },
            ].map((t) => (
              <div key={t.l} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 px-2.5 py-1.5 text-center">
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t.l}</div>
                <div className={"num text-[14px] font-bold " + t.c}>{t.v}</div>
              </div>
            ))}
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-0.5 sm:flex">
            {WIN.map((w) => (
              <button key={w.k} type="button" onClick={() => setWin(w.k)} className={"rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-colors " + (win === w.k ? "bg-sky-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400")}>{w.k}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {/* 일별 기온·강수 */}
        <Panel title="일별 기온·강수 (최근 90일)" seg="관측"
          meaning={<>일 최저~최고 기온(음영)·평균(선) + 강수(파랑 막대) — 폭염·우기 강도 추적</>}
          src="PAGASA 일별 관측(자체 수집)">
          <div className="h-[150px] w-full">{wx.length ? <DailyChart days={wx} /> : <div className="flex h-full items-center justify-center text-[13px] text-gray-400">불러오는 중</div>}</div>
        </Panel>

        {/* 월별 기후 평년 — 우기/건기 */}
        <Panel title="월별 기후 평년 (우기·건기)" seg="기후"
          meaning={<>월별 평균 강수(파랑)·열지수(빨강) — <b className="text-sky-600 dark:text-sky-400">우기 6~10월</b> 다우, <b className="text-rose-600 dark:text-rose-400">건기 3~5월</b> 폭염</>}
          src="PAGASA 관측 월별 집계">
          <div className="h-[150px] w-full">{monthly.some((m) => m.hi > 0) ? <ClimateChart mon={monthly} /> : <div className="flex h-full items-center justify-center text-[13px] text-gray-400">불러오는 중</div>}</div>
        </Panel>

        {/* ENSO 현황 — 엘니뇨/라니냐 */}
        <Panel
          title="ENSO — 엘니뇨 · 라니냐" seg="기후"
          meaning={<>ONI(해수면온도 편차) — <b className="text-rose-600 dark:text-rose-400">+0.5↑ 엘니뇨</b>·<b className="text-sky-600 dark:text-sky-400">−0.5↓ 라니냐</b>·중립. 필리핀 강수·기온 계절성의 최대 변수</>}
          src="NOAA CPC Oceanic Niño Index(ONI)"
        >
          {phase ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-3">
                <span className={"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[16px] font-extrabold " + phase.bg + " " + phase.c}>
                  <span className={"h-2.5 w-2.5 rounded-full " + phase.dot} />{phase.t}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">현재 ONI</span>
                  <span className={"num text-[21px] font-bold " + phase.c}>{oni! > 0 ? "+" : ""}{oni!.toFixed(2)}</span>
                </span>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200"><b className="font-semibold">가전 함의</b> {phase.d}</p>
              <div className="mt-2 flex gap-1 text-[10.5px] font-semibold">
                <span className="rounded bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 text-rose-700 dark:text-rose-300">엘니뇨 ≥+0.5</span>
                <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-gray-500 dark:text-gray-400">중립</span>
                <span className="rounded bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">라니냐 ≤−0.5</span>
              </div>
            </div>
          ) : <div className="flex h-40 items-center justify-center text-[13px] text-gray-400">불러오는 중</div>}
        </Panel>

        {/* ONI 추이 */}
        {enso.series.length ? (
          <ChartCard
            title="ONI 지수 추이" seg="기후" unit="편차(℃) · 계절" decimals={2}
            legend={<Lg c={C.blue} t="ONI(Niño 3.4 편차)" b />}
            series={enso.series} labels={enso.labels}
            meaning={<>3개월 이동 해수면온도 편차 — <b className="text-gray-700 dark:text-gray-200">추세 전환</b>(라니냐→엘니뇨 등)이 계절 리스크 신호</>}
            ai={<>엘니뇨 국면은 <b className="font-semibold text-rose-600 dark:text-rose-400">고온·건조로 냉방(에어컨)·냉장 수요를 밀어올리나</b> 가뭄·전력수급 부담을, 라니냐는 <b className="font-semibold text-sky-600 dark:text-sky-400">다우·태풍으로 홍수·물류 차질과 제습·에어케어 수요</b>를 키움. 전환 시점을 성수기 재고·프로모 계획에 선반영.</>}
            src="NOAA CPC ONI(Niño 3.4)"
          />
        ) : <Panel title="ONI 지수 추이" meaning="데이터 로딩" src="NOAA"><div className="flex h-40 items-center justify-center text-[13px] text-gray-400">불러오는 중</div></Panel>}

        {/* CDD */}
        {cdd.series.length ? (
          <ChartCard
            title="냉방도일 (CDD)" seg="CE" unit="냉방도일 · 월" decimals={0}
            legend={<Lg c={C.rose} t="냉방도일 CDD" b />}
            series={cdd.series} labels={cdd.labels}
            meaning={<>기준 24℃ 초과 누적 — <b className="text-gray-700 dark:text-gray-200">높을수록 냉방(에어컨·냉장) 상시가동 수요↑</b></>}
            ai={<>CDD는 에어컨·냉장고 가동시간과 직접 연동되는 <b className="font-semibold">냉방 수요 선행지표</b>. 성수기(4~6월) 피크 구간의 전년 대비 상승폭이 클수록 <b className="font-semibold text-rose-600 dark:text-rose-400">교체·신규·대형화 수요</b> 여지. 폭염 국면엔 고효율 인버터 소구가 유효.</>}
            src="PSA/PAGASA 관측 기온 기반 산출(기준 24℃)"
          />
        ) : <Panel title="냉방도일 (CDD)" meaning="데이터 로딩" src="PAGASA"><div className="flex h-40 items-center justify-center text-[13px] text-gray-400">불러오는 중</div></Panel>}

        {/* 태풍 */}
        <Panel
          title="태풍 경보 이력" seg="전사"
          meaning={<>PAGASA 태풍 신호(TCWS) — <b className="text-gray-700 dark:text-gray-200">물류·매장 방문 차질</b> 및 재난 후 <b className="text-gray-700 dark:text-gray-200">가전 침수 교체수요</b> 신호</>}
          src="PAGASA 태풍 공보(자체 수집)"
        >
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800/60">
            {tys.length === 0 ? <div className="flex h-32 items-center justify-center text-[13px] text-gray-400">최근 태풍 없음</div> : tys.slice(0, 6).map((t) => {
              const sig = SIG[t.maxSignal] ?? SIG[0]
              return (
                <div key={t.name + t.asOf} className="flex items-start gap-2.5 py-2">
                  <span className={"mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold " + sig.c}>{sig.t}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <b className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{t.name}</b>
                      <span className="text-[11.5px] text-gray-500 dark:text-gray-400">{t.category}</span>
                      {t.inPar && <span className="rounded bg-rose-50 dark:bg-rose-500/10 px-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">PAR</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[12px] leading-snug text-gray-500 dark:text-gray-400">{t.headline}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-gray-400 dark:text-gray-500">{relDays(t.asOf)}</span>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* 지진 */}
        <Panel
          title="최근 지진 활동 (M4.0+)" seg="전사"
          meaning={<>USGS 실측 필리핀 지진 — <b className="text-gray-700 dark:text-gray-200">공급망·매장·설비 리스크</b>, 강진 후 <b className="text-gray-700 dark:text-gray-200">복구 가전 수요</b> 신호</>}
          src="USGS FDSN(실시간) · 최근 1년 M4.0+"
        >
          <div className="flex h-full flex-col">
            <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-gray-500 dark:text-gray-400">
              <span>1년 <b className="text-gray-800 dark:text-gray-100">{eqs.length}</b>건</span>
              <span>M5+ <b className="text-orange-600 dark:text-orange-400">{bigQuakes.length}</b>건</span>
              {maxQuake && <span>최대 <b className="text-red-600 dark:text-red-400">M{maxQuake.toFixed(1)}</b></span>}
            </div>
            <div className="h-[150px] w-full">{eqs.length ? <QuakeStrip quakes={eqs} /> : <div className="flex h-full items-center justify-center text-[13px] text-gray-400">불러오는 중</div>}</div>
            <div className="mt-1.5 flex flex-col gap-1 border-t border-gray-100 dark:border-gray-800 pt-1.5">
              {eqs.slice(0, 3).map((q, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="w-9 shrink-0 font-bold tabular-nums" style={{ color: magColor(q.mag) }}>M{q.mag.toFixed(1)}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">{q.place}</span>
                  <span className="shrink-0 text-gray-400 dark:text-gray-500">{relDays(q.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

      </div>

      <p className="text-[12px] leading-relaxed text-gray-400 dark:text-gray-500">냉방도일(CDD)·기온=PAGASA 관측 기반 · 태풍=PAGASA 공보 · 지진=USGS FDSN 실시간(필리핀 4~21°N/116~128°E, M4.0+) · 화산 경보(PHIVOLCS)는 공식 API 부재로 추후 반영</p>
    </div>
  )
}
