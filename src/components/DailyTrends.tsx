"use client"

import React, { useEffect, useState } from "react"
import { exchangeRates, oilDaily } from "@/lib/supabase"
import { useIsDark, chartColors } from "@/components/EconChart"

/** 일일동향 — 유가·환율만 최근 30개 데이터로 간결하게. 상세 시계열은 각 도메인 뷰. */

type Pt = { date: string; value: number }

function md(d: string) { return Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10)) }

function MiniLine({ pts, color, dec }: { pts: Pt[]; color: string; dec: number }) {
  const dark = useIsDark()
  const CO = chartColors(dark)
  const ref = React.useRef<SVGSVGElement | null>(null)
  const [W, setW] = useState(560)
  const H = 150, L = 40, R = 12, T = 12, B = 22
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth || 560))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  if (!pts.length) return <div className="h-[150px] animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" />
  const vs = pts.map((p) => p.value)
  const mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn) * 0.15 || 1
  const lo = mn - pad, hi = mx + pad
  const X = (i: number) => L + (W - L - R) * (pts.length === 1 ? 0.5 : i / (pts.length - 1))
  const Y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1))
  const line = pts.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.value).toFixed(1)).join(" ")
  const area = line + ` L${X(pts.length - 1).toFixed(1)} ${H - B} L${X(0).toFixed(1)} ${H - B} Z`
  const gid = "g" + color.replace(/[^a-z0-9]/gi, "")
  const ticks = 3
  return (
    <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={dark ? 0.28 : 0.18} /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {Array.from({ length: ticks + 1 }, (_, i) => { const v = lo + (hi - lo) * (i / ticks); const y = Y(v); return (
        <g key={i}><line x1={L} y1={y} x2={W - R} y2={y} stroke={CO.grid} strokeWidth="1" /><text x={L - 6} y={y + 3} textAnchor="end" fontSize="10" fill={dark ? "#9ca3af" : "#6b7280"}>{v.toFixed(dec)}</text></g>
      ) })}
      {pts.map((p, i) => (i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1) ? <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fontSize="10" fill={dark ? "#9ca3af" : "#6b7280"}>{md(p.date)}</text> : null)}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.value)} r={i === pts.length - 1 ? 3.4 : 1.6} fill={color} />)}
    </svg>
  )
}

function Card({ title, seg, unit, pts, color, dec, note }: { title: string; seg: string; unit: string; pts: Pt[]; color: string; dec: number; note: string }) {
  const last = pts[pts.length - 1]?.value, first = pts[0]?.value
  const chg = last != null && first != null ? last - first : null
  const up = (chg ?? 0) > 0
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-shadow hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{seg}</span>
        <span className="ml-auto text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[22px] font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">{last != null ? last.toFixed(dec) : "—"}</span>
        {chg != null && <span className={"text-[12px] font-bold tabular-nums " + (up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{up ? "▲" : "▼"} {Math.abs(chg).toFixed(dec)} <span className="font-medium text-gray-400 dark:text-gray-500">30일</span></span>}
      </div>
      <div className="mt-2"><MiniLine pts={pts} color={color} dec={dec} /></div>
      <p className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">{note}</p>
    </div>
  )
}

export default function DailyTrends() {
  const [fx, setFx] = useState<Pt[]>([])
  const [oil, setOil] = useState<Pt[]>([])
  useEffect(() => {
    exchangeRates(30).then((r) => setFx(r.map((x) => ({ date: x.date, value: x.value })))).catch(() => {})
    oilDaily(30).then((r) => setOil(r.filter((x) => x.diesel != null).map((x) => ({ date: x.date, value: x.diesel as number })))).catch(() => {})
  }, [])
  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      <div className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 dark:from-indigo-500/10 via-indigo-50/40 dark:via-transparent to-white dark:to-gray-900 px-4 py-3 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></svg>
          </div>
          <div className="text-[13px] leading-snug text-gray-700 dark:text-gray-200"><b className="font-semibold text-gray-900 dark:text-gray-50">일일동향</b> — 환율·유가 최근 30일 · 조달원가·물류비의 초단기 신호 (상세 시계열은 환율·물가 뷰)</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="환율 USD/PHP" seg="CE·B2B" unit="₱ · 일별" pts={fx} color="#4f46e5" dec={2} note="출처 BSP 기준환율 · 페소 약세 시 수입 가전 원가 상승" />
        <Card title="유가 디젤" seg="B2B" unit="₱/L · 주간" pts={oil} color="#e11d48" dec={2} note="출처 DOE NCR 공동고시 · 물류비·실질구매력 영향" />
      </div>
    </div>
  )
}
