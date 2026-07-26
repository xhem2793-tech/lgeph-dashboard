"use client"

import React, { useEffect, useMemo, useState } from "react"
import { ChartCard, moLabel } from "@/components/EconChart"
import { macroDual, marketEstimates, latestMacro, type MktEst } from "@/lib/supabase"

/** 온라인 시장 — 이커머스 규모·성장 + 디지털/통신 침투(온라인 가전 구매 저변). */

const C = { ind: "#4f46e5", emer: "#059669", blue: "#2563eb", violet: "#7c3aed", rose: "#e11d48", amber: "#d97706" }
const Lg = ({ c, t }: { c: string; t: string }) => (
  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} /><span className="text-gray-600 dark:text-gray-300">{t}</span></span>
)

type Series = { value: number; date: string }[]
function merge(a: Series, b: Series, an: string, bn: string, ac: string, bc: string) {
  const dates = Array.from(new Set([...a, ...b].map((r) => r.date))).sort()
  const ma = new Map(a.map((r) => [r.date, r.value])), mb = new Map(b.map((r) => [r.date, r.value]))
  return { labels: dates.map(moLabel), series: [
    { name: an, color: ac, w: 2, data: dates.map((d) => (ma.has(d) ? ma.get(d)! : NaN)) },
    { name: bn, color: bc, w: 2, data: dates.map((d) => (mb.has(d) ? mb.get(d)! : NaN)) },
  ] }
}

export default function OnlineMarketView() {
  const [d, setD] = useState<Record<string, Series>>({})
  const [est, setEst] = useState<MktEst[]>([])
  const [kv, setKv] = useState<Record<string, { value: number; date: string }>>({})
  const [open, setOpen] = useState(false)
  useEffect(() => {
    Promise.all(["internet_penetration", "account_ownership", "mobile_per100", "broadband_per100"].map((k) => macroDual(k).then((r) => [k, r] as const)))
      .then((rs) => setD(Object.fromEntries(rs))).catch(() => {})
    marketEstimates("ecommerce").then(setEst).catch(() => {})
    latestMacro(["ecommerce_weekly_pct", "credit_card_loan_growth_yoy", "internet_penetration"]).then(setKv).catch(() => {})
  }, [])

  const vals = est.map((e) => e.value).filter((v) => v > 0).sort((a, b) => a - b)
  const med = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null
  const cagr = useMemo(() => { const c = est.map((e) => e.cagr).filter((v): v is number => v != null); return c.length ? c.reduce((a, b) => a + b, 0) / c.length : null }, [est])

  const digital = merge(d.internet_penetration ?? [], d.account_ownership ?? [], "인터넷 이용률", "계정 보유율", C.ind, C.emer)
  const infra = merge(d.mobile_per100 ?? [], d.broadband_per100 ?? [], "모바일 가입/100", "브로드밴드/100", C.blue, C.violet)

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      <div className="rounded-xl border border-violet-100 dark:border-violet-500/25 bg-gradient-to-r from-violet-50 dark:from-violet-500/10 via-violet-50/40 dark:via-transparent to-white dark:to-gray-900 px-4 py-3 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg>
          </div>
          <div className="text-[13px] leading-snug text-gray-700 dark:text-gray-200">
            <b className="font-semibold text-gray-900 dark:text-gray-50">온라인 시장</b> — 이커머스 {med != null ? <b className="text-violet-700 dark:text-violet-300">${med.toFixed(1)}B</b> : "—"}(중앙값)·연 {cagr != null ? cagr.toFixed(0) + "%" : "—"} 성장 · 인터넷 {kv.internet_penetration ? Math.round(kv.internet_penetration.value) + "%" : "—"} — 온라인 가전 구매 저변 확대
          </div>
        </div>
      </div>

      {/* 이커머스 시장규모(다중기관 추정) */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
        <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
          <span className="h-[18px] w-1 rounded bg-violet-500" />
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">이커머스 시장규모</h2>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">다중기관 추정 · 범위·중앙값</span>
          <span className="ml-auto rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">추정(민간)</span>
        </header>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div><div className="text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">중앙값</div><div className="text-[26px] font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">{med != null ? "$" + med.toFixed(1) + "B" : "—"}</div></div>
          <div><div className="text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">범위</div><div className="text-[15px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{vals.length ? "$" + vals[0].toFixed(1) + "–" + vals[vals.length - 1].toFixed(1) + "B" : "—"}</div></div>
          <div><div className="text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">연평균성장</div><div className="text-[15px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{cagr != null ? cagr.toFixed(0) + "%" : "—"}</div></div>
          <div><div className="text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">주간 온라인쇼핑</div><div className="text-[15px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{kv.ecommerce_weekly_pct ? kv.ecommerce_weekly_pct.value.toFixed(0) + "%" : "—"}</div></div>
          <div className="ml-auto"><div className="text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">추정 기관</div><div className="text-[15px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{est.length}곳</div></div>
        </div>
        {est.length > 0 && (
          <>
            <button onClick={() => setOpen((v) => !v)} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400">근거 {est.length}건 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg></button>
            {open && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-[11.5px]">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500"><th className="px-2 py-1">기관</th><th className="px-2 py-1 text-right">규모</th><th className="px-2 py-1">연도</th><th className="px-2 py-1">범위</th><th className="px-2 py-1 text-right">원본</th></tr></thead>
                  <tbody>
                    {est.map((e, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                        <td className="px-2 py-1 font-medium text-gray-800 dark:text-gray-100">{e.source}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-gray-700 dark:text-gray-200">${e.value.toFixed(1)}B</td>
                        <td className="px-2 py-1 tabular-nums text-gray-500 dark:text-gray-400">{e.year}</td>
                        <td className="px-2 py-1 text-gray-500 dark:text-gray-400">{e.scope ?? "—"}</td>
                        <td className="px-2 py-1 text-right">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-600 dark:text-violet-400 hover:underline">원본 ↗</a> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <div className="grid items-stretch gap-4 sm:grid-cols-2">
        {digital.series.some((s) => s.data.some((v) => Number.isFinite(v))) && (
          <ChartCard seg="CE" title="디지털 이용 확산" unit="% · 연간" labels={digital.labels} series={digital.series} decimals={0} seriesUnit="%"
            legend={<><Lg c={C.ind} t="인터넷 이용률" /><Lg c={C.emer} t="계정 보유율" /></>}
            meaning={<>인터넷 이용·금융계정 보유 확대 — <b className="text-gray-700 dark:text-gray-200">온라인 가전 구매·전자결제 저변</b></>}
            ai={<>인터넷·계정 보유 상승은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">이커머스·할부·BNPL 채널 확장</b> → 온라인 전용 모델·번들·D2C 강화 여지</>}
            src="World Bank·ITU 디지털지표 · 연간" />
        )}
        {infra.series.some((s) => s.data.some((v) => Number.isFinite(v))) && (
          <ChartCard seg="CE" title="통신 인프라 침투" unit="100명당 · 연간" labels={infra.labels} series={infra.series} decimals={0} seriesUnit=""
            legend={<><Lg c={C.blue} t="모바일 가입/100" /><Lg c={C.violet} t="브로드밴드/100" /></>}
            meaning={<>모바일·브로드밴드 보급 — <b className="text-gray-700 dark:text-gray-200">모바일 커머스·스마트가전 연결성</b></>}
            ai={<>모바일 보급 포화·브로드밴드 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">앱 기반 구매·IoT 가전</b> 수요 기반 → 스마트홈 연계 마케팅</>}
            src="World Bank·ITU 통신지표 · 연간" />
        )}
      </div>
    </div>
  )
}
