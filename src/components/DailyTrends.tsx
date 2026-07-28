"use client"

import React, { useEffect, useState } from "react"
import { exchangeRates, oilDaily, latestMacro } from "@/lib/supabase"
import { useIsDark, chartColors } from "@/components/EconChart"

/** 일일동향 — 마스터 경제 대시보드(통합 지표·시장상황) + 환율·유가 30일 (표준 카드 디자인·애니메이션 통일). */

type Pt = { date: string; value: number }
function md(d: string) { return Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10)) }

// ── 미니 라인(일별 index 기준) — 표준 LineChart와 동일 톤(영역채움·그리드·끝점) ──
function MiniLine({ pts, color, dec }: { pts: Pt[]; color: string; dec: number }) {
  const dark = useIsDark(); const CO = chartColors(dark)
  const ref = React.useRef<SVGSVGElement | null>(null)
  const [W, setW] = useState(560)
  const H = 148, L = 38, R = 12, T = 12, B = 22
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth || 560)); ro.observe(el); return () => ro.disconnect() }, [])
  if (!pts.length) return <div className="h-[148px] animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" />
  const vs = pts.map((p) => p.value), mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn) * 0.15 || 1
  const lo = mn - pad, hi = mx + pad
  const X = (i: number) => L + (W - L - R) * (pts.length === 1 ? 0.5 : i / (pts.length - 1))
  const Y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1))
  const line = pts.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.value).toFixed(1)).join(" ")
  const area = line + ` L${X(pts.length - 1).toFixed(1)} ${H - B} L${X(0).toFixed(1)} ${H - B} Z`
  const gid = "g" + color.replace(/[^a-z0-9]/gi, "")
  return (
    <svg ref={ref} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={dark ? 0.26 : 0.16} /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {Array.from({ length: 4 }, (_, i) => { const v = lo + (hi - lo) * (i / 3); const y = Y(v); return (
        <g key={i}><line x1={L} y1={y} x2={W - R} y2={y} stroke={CO.grid} strokeWidth="1" /><text x={L - 6} y={y + 3} textAnchor="end" fontSize="10" fill={dark ? "#9ca3af" : "#6b7280"}>{v.toFixed(dec)}</text></g>
      ) })}
      {pts.map((p, i) => (i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1) ? <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fontSize="10" fill={dark ? "#9ca3af" : "#6b7280"}>{md(p.date)}</text> : null)}
      <path d={area} fill={`url(#${gid})`} style={{ animation: "fadeIn .5s ease both" }} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 0, animation: "drawL .8s ease both" }} />
      <circle cx={X(pts.length - 1)} cy={Y(pts[pts.length - 1].value)} r={3.4} fill={color} stroke="#fff" strokeWidth="1.4" style={{ animation: "fadeIn .5s ease .4s both" }} />
    </svg>
  )
}

// ── 표준 ChartCard 톤의 카드(헤더+범례 대시+의미+접이식 LG 인사이트) ──
function TrendCard({ title, seg, unit, pts, color, dec, meaning, ai, src, delay }: { title: string; seg: string; unit: string; pts: Pt[]; color: string; dec: number; meaning: React.ReactNode; ai: React.ReactNode; src: string; delay: number }) {
  const [aiOpen, setAiOpen] = useState(false)
  const last = pts[pts.length - 1]?.value, first = pts[0]?.value
  const chg = last != null && first != null ? last - first : null, up = (chg ?? 0) > 0
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both", animationDelay: delay + "s" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{seg}</span>
        <span className="ml-auto text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      <div className="mt-1.5 flex min-h-[22px] items-center gap-x-3 text-[10.5px]">
        <span className="inline-flex items-center gap-1.5" style={{ color: "#6b7280" }}><span className="inline-block h-0 w-3" style={{ borderTop: "2.4px solid " + color }} />{title.split(" ")[0]}</span>
        <span className="ml-auto flex items-baseline gap-1.5">
          <span className="text-[19px] font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">{last != null ? last.toFixed(dec) : "—"}</span>
          {chg != null && <span className={"text-[11px] font-bold tabular-nums " + (up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{up ? "▲" : "▼"}{Math.abs(chg).toFixed(dec)} <span className="font-medium text-gray-400 dark:text-gray-500">30일</span></span>}
        </span>
      </div>
      <MiniLine pts={pts} color={color} dec={dec} />
      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {meaning}</p>
      <button type="button" onClick={() => setAiOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 transition-colors hover:text-indigo-700 dark:hover:text-indigo-300">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>
        LG 인사이트
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: aiOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div style={{ display: "grid", gridTemplateRows: aiOpen ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(.16,1,.3,1)" }}><div className="overflow-hidden"><div className="mt-1.5 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{ai}</p></div></div></div>
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> {src}</p>
    </div>
  )
}

// ── 마스터 통합 경제 대시보드 ──
type Kpi = { key: string; label: string; unit: string; dec: number; tone: (v: number) => "up" | "down" | "flat" }
const KPIS: Kpi[] = [
  { key: "gdp_growth_yoy", label: "GDP 성장", unit: "%", dec: 1, tone: (v) => v >= 6 ? "up" : v < 4 ? "down" : "flat" },
  { key: "cpi_inflation_yoy", label: "소비자물가", unit: "%", dec: 1, tone: (v) => v <= 3 ? "up" : v > 4 ? "down" : "flat" },
  { key: "BSP_policy_rate", label: "정책금리", unit: "%", dec: 2, tone: (v) => v < 5 ? "up" : v > 6.5 ? "down" : "flat" },
  { key: "m3_growth_yoy", label: "통화량 M3", unit: "%", dec: 1, tone: (v) => v >= 6 ? "up" : "flat" },
  { key: "psei_index", label: "PSEi 지수", unit: "", dec: 0, tone: (v) => v >= 6500 ? "up" : v < 6000 ? "down" : "flat" },
  { key: "consumer_confidence_index", label: "소비자심리", unit: "", dec: 1, tone: (v) => v >= 0 ? "up" : "down" },
  { key: "npl_ratio", label: "은행 NPL", unit: "%", dec: 1, tone: (v) => v <= 3.5 ? "up" : "down" },
  { key: "meralco_residential_rate", label: "전기료", unit: "₱", dec: 1, tone: (v) => v <= 12 ? "up" : "down" },
]
const toneCls = { up: "text-emerald-600 dark:text-emerald-400", down: "text-rose-600 dark:text-rose-400", flat: "text-gray-700 dark:text-gray-200" }

export default function DailyTrends() {
  const [fx, setFx] = useState<Pt[]>([])
  const [oil, setOil] = useState<Pt[]>([])
  const [kv, setKv] = useState<Record<string, { value: number; date: string }>>({})
  useEffect(() => {
    exchangeRates(30).then((r) => setFx(r.map((x) => ({ date: x.date, value: x.value })))).catch(() => {})
    oilDaily(30).then((r) => setOil(r.filter((x) => x.diesel != null).map((x) => ({ date: x.date, value: x.diesel as number })))).catch(() => {})
    latestMacro(KPIS.map((k) => k.key)).then(setKv).catch(() => {})
  }, [])
  const fxUp = fx.length > 1 && fx[fx.length - 1].value > fx[0].value
  // 시장 상황 요약(자동)
  const g = kv.gdp_growth_yoy?.value, inf = kv.cpi_inflation_yoy?.value
  const status: { t: string; c: string }[] = []
  if (g != null) status.push(g < 4 ? { t: "성장 둔화", c: "rose" } : g >= 6 ? { t: "성장 견조", c: "emerald" } : { t: "성장 완만", c: "amber" })
  if (inf != null) status.push(inf > 4 ? { t: "물가 부담", c: "rose" } : inf <= 3 ? { t: "물가 안정", c: "emerald" } : { t: "물가 보합", c: "amber" })
  status.push(fxUp ? { t: "페소 약세(원가↑)", c: "rose" } : { t: "페소 강세", c: "emerald" })
  const cmap: Record<string, string> = { rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" }

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes drawL{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}"}</style>

      {/* 배너 */}
      <div className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 dark:from-indigo-500/10 via-indigo-50/40 dark:via-transparent to-white dark:to-gray-900 px-4 py-3 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" /></svg></div>
          <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700 dark:text-gray-200"><b className="font-semibold text-gray-900 dark:text-gray-50">일일동향</b> — 통합 경제 대시보드 + 환율·유가 30일 · 조달원가·수요의 초단기 신호</div>
          <div className="hidden shrink-0 flex-wrap gap-1.5 sm:flex">{status.map((s) => <span key={s.t} className={"rounded-full px-2 py-0.5 text-[10.5px] font-bold " + cmap[s.c]}>{s.t}</span>)}</div>
        </div>
      </div>

      {/* 마스터 통합 경제 지표 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both", animationDelay: ".05s" }}>
        <div className="mb-3 flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
          <span className="h-[18px] w-1 rounded bg-indigo-500" />
          <h2 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">통합 경제 지표</h2>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">핵심 지표 최신값 · 한눈에 보는 시장 상황</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {KPIS.map((k, i) => { const d = kv[k.key]; const t = d ? k.tone(d.value) : "flat"
            return (
              <div key={k.key} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 px-3 py-2.5" style={{ animation: "fadeUp .4s ease both", animationDelay: (0.08 + i * 0.03) + "s" }}>
                <div className="text-[10.5px] font-semibold text-gray-400 dark:text-gray-500">{k.label}</div>
                <div className={"mt-1 text-[19px] font-extrabold tabular-nums tracking-tight " + toneCls[t]}>{d ? (k.dec === 0 ? Math.round(d.value).toLocaleString() : d.value.toFixed(k.dec)) : "—"}<span className="ml-0.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500">{k.unit}</span></div>
                <div className="mt-0.5 text-[9.5px] text-gray-400 dark:text-gray-500">{d ? d.date.slice(2, 4) + "." + Number(d.date.slice(5, 7)) + (d.date.slice(8) !== "01" ? "." + Number(d.date.slice(8, 10)) : "") : ""}</div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500"><b className="font-semibold text-gray-500 dark:text-gray-400">시장 상황</b> {status.map((s) => s.t).join(" · ")} — 색: <span className="text-emerald-600 dark:text-emerald-400">우호</span>/<span className="text-amber-600 dark:text-amber-400">중립</span>/<span className="text-rose-600 dark:text-rose-400">부담</span> · 상세는 각 도메인 뷰</p>
      </div>

      {/* 환율·유가 (표준 카드 디자인) */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2">
        <TrendCard title="환율 USD/PHP" seg="CE·B2B" unit="₱ · 일별" pts={fx} color="#4f46e5" dec={2} delay={0.1}
          meaning={<>달러당 페소 — <b className="text-gray-700 dark:text-gray-200">수입 가전·부품 조달원가</b>의 초단기 신호</>}
          ai={<>페소 약세(값↑)는 <b className="font-semibold text-rose-600 dark:text-rose-400">수입 가전 COGS 상방</b> → 판가 전가·달러 헤지 점검. 강세 전환기엔 조달·프로모 여력 확대.</>}
          src="BSP 기준환율 · 일별" />
        <TrendCard title="유가 디젤" seg="B2B" unit="₱/L · 주간" pts={oil} color="#e11d48" dec={2} delay={0.15}
          meaning={<>NCR 디젤 소매가 — <b className="text-gray-700 dark:text-gray-200">물류·배송비·실질구매력</b>의 상류 동인</>}
          ai={<>유가 상승은 <b className="font-semibold text-rose-600 dark:text-rose-400">물류비·설치비 상방 + 재량소비 위축</b> → 배송단가·프로모 타이밍 조정. 하락기엔 판매 여력 개선.</>}
          src="DOE NCR 공동고시 · 주간" />
      </div>
    </div>
  )
}
