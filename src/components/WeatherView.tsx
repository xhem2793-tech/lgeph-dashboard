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

/** 최근 지진 규모 스트립 — 시간축 위 규모 점(색=규모) */
function QuakeStrip({ quakes }: { quakes: Quake[] }) {
  const [hi, setHi] = useState<number | null>(null)
  if (!quakes.length) return <div className="flex h-32 items-center justify-center text-[12px] text-gray-400">지진 데이터 없음</div>
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
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        {seg && <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{seg}</span>}
      </div>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {meaning}</p>
      <p className="mt-auto pt-2 text-[10px] text-gray-400 dark:text-gray-500">{src}</p>
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
    macroMonthly(["cdd_monthly", "temp_monthly"]).then(setMon).catch(() => {})
    weatherRecent(120).then(setWx).catch(() => {})
    typhoonAlerts(8).then(setTys).catch(() => {})
    earthquakesRecent(365, 4).then(setEqs).catch(() => {})
  }, [])

  const years = WIN.find((w) => w.k === win)!.n
  const cdd = useMemo(() => monSeries(mon, "cdd_monthly", years, "냉방도일 CDD", C.rose), [mon, years])
  const temp = useMemo(() => monSeries(mon, "temp_monthly", years, "월평균 기온", C.amber), [mon, years])

  const cddLatest = mon.cdd_monthly?.values?.at(-1)
  const cddPrev = mon.cdd_monthly?.values?.at(-2)
  const activeTy = tys.filter((t) => t.maxSignal > 0)
  const bigQuakes = eqs.filter((q) => q.mag >= 5)
  const maxQuake = eqs.length ? Math.max(...eqs.map((q) => q.mag)) : null
  const rainy = wx.filter((d) => (d.rain ?? 0) > 0).length

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

      {/* 배너 */}
      <div className="overflow-hidden rounded-xl border border-rose-100 dark:border-rose-500/25 bg-gradient-to-r from-rose-50 dark:from-rose-500/10 via-rose-50/40 dark:via-transparent to-white dark:to-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6M12 2l3 3M12 2 9 5" /><path d="M5 18a5 5 0 0 1 .5-9.9A6 6 0 0 1 17 9a4 4 0 0 1 1 7.9" /></svg>
          </div>
          <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700 dark:text-gray-200">
            <b className="font-semibold text-gray-900 dark:text-gray-50">냉방 수요·재난 리스크</b> — 냉방도일 CDD <b className="text-rose-700 dark:text-rose-300">{cddLatest != null ? Math.round(cddLatest) : "–"}</b>{cddLatest != null && cddPrev != null ? <span className={"ml-0.5 " + (cddLatest >= cddPrev ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{cddLatest >= cddPrev ? "▲" : "▼"}{Math.abs(Math.round(cddLatest - cddPrev))}</span> : null} · 활성 태풍 <b className="text-amber-700 dark:text-amber-300">{activeTy.length}</b>건 · 최근 1년 지진(M4+) <b className="text-orange-700 dark:text-orange-300">{eqs.length}</b>건{maxQuake ? <>(최대 M{maxQuake.toFixed(1)})</> : null}
          </div>
          <div className="hidden shrink-0 items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-0.5 sm:flex">
            {WIN.map((w) => (
              <button key={w.k} type="button" onClick={() => setWin(w.k)} className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors " + (win === w.k ? "bg-rose-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400")}>{w.k}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
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
        ) : <Panel title="냉방도일 (CDD)" meaning="데이터 로딩" src="PAGASA"><div className="flex h-40 items-center justify-center text-[12px] text-gray-400">불러오는 중</div></Panel>}

        {/* 태풍 */}
        <Panel
          title="태풍 경보 이력" seg="전사"
          meaning={<>PAGASA 태풍 신호(TCWS) — <b className="text-gray-700 dark:text-gray-200">물류·매장 방문 차질</b> 및 재난 후 <b className="text-gray-700 dark:text-gray-200">가전 침수 교체수요</b> 신호</>}
          src="PAGASA 태풍 공보(자체 수집)"
        >
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800/60">
            {tys.length === 0 ? <div className="flex h-32 items-center justify-center text-[12px] text-gray-400">최근 태풍 없음</div> : tys.slice(0, 6).map((t) => {
              const sig = SIG[t.maxSignal] ?? SIG[0]
              return (
                <div key={t.name + t.asOf} className="flex items-start gap-2.5 py-2">
                  <span className={"mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold " + sig.c}>{sig.t}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <b className="text-[13px] font-bold text-gray-900 dark:text-gray-50">{t.name}</b>
                      <span className="text-[10.5px] text-gray-500 dark:text-gray-400">{t.category}</span>
                      {t.inPar && <span className="rounded bg-rose-50 dark:bg-rose-500/10 px-1 text-[9px] font-bold text-rose-600 dark:text-rose-400">PAR</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">{t.headline}</span>
                  </span>
                  <span className="shrink-0 text-[10.5px] text-gray-400 dark:text-gray-500">{relDays(t.asOf)}</span>
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
            <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              <span>1년 <b className="text-gray-800 dark:text-gray-100">{eqs.length}</b>건</span>
              <span>M5+ <b className="text-orange-600 dark:text-orange-400">{bigQuakes.length}</b>건</span>
              {maxQuake && <span>최대 <b className="text-red-600 dark:text-red-400">M{maxQuake.toFixed(1)}</b></span>}
            </div>
            <div className="h-[150px] w-full">{eqs.length ? <QuakeStrip quakes={eqs} /> : <div className="flex h-full items-center justify-center text-[12px] text-gray-400">불러오는 중</div>}</div>
            <div className="mt-1.5 flex flex-col gap-1 border-t border-gray-100 dark:border-gray-800 pt-1.5">
              {eqs.slice(0, 3).map((q, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="w-9 shrink-0 font-bold tabular-nums" style={{ color: magColor(q.mag) }}>M{q.mag.toFixed(1)}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">{q.place}</span>
                  <span className="shrink-0 text-gray-400 dark:text-gray-500">{relDays(q.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* 계절 기온 */}
        {temp.series.length ? (
          <ChartCard
            title="월평균 기온" seg="CE" unit="℃ · 월" decimals={1}
            legend={<Lg c={C.amber} t="월평균 기온" b />}
            series={temp.series} labels={temp.labels}
            meaning={<>필리핀 우기(6~10월)·건기(11~5월) 계절성 — 최근 120일 강수일 <b className="text-gray-700 dark:text-gray-200">{rainy}일</b></>}
            ai={<>고온 지속은 냉방 상시가동으로 이어져 <b className="font-semibold text-rose-600 dark:text-rose-400">에어컨·냉장 수요와 전력요금 부담</b>을 동시에 키움. 건기 폭염엔 인버터 고효율 소구, 우기엔 제습·에어케어 수요를 함께 주시.</>}
            src="PAGASA 관측 월평균 기온"
          />
        ) : <Panel title="월평균 기온" meaning="데이터 로딩" src="PAGASA"><div className="flex h-40 items-center justify-center text-[12px] text-gray-400">불러오는 중</div></Panel>}
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">냉방도일(CDD)·기온=PAGASA 관측 기반 · 태풍=PAGASA 공보 · 지진=USGS FDSN 실시간(필리핀 4~21°N/116~128°E, M4.0+) · 화산 경보(PHIVOLCS)는 공식 API 부재로 추후 반영</p>
    </div>
  )
}
