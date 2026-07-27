"use client"

import React, { useEffect, useMemo, useState } from "react"
import { ChartCard, fmtLabels } from "@/components/EconChart"
import { AgendaCard } from "@/components/EconViews"
import { macroDual, marketEstimates, latestMacro, type MktEst } from "@/lib/supabase"

/** 온라인 시장 — 이커머스 규모·성장 + 디지털/결제/통신 인프라(온라인 가전 구매 저변).
 *  레이아웃: 접이식 배너 + 좌측 차트그리드(표준 카드) + 우측 아젠다(다른 뷰와 동일). */

const C = { ind: "#4f46e5", emer: "#059669", blue: "#2563eb", violet: "#7c3aed", rose: "#e11d48", amber: "#d97706" }
const Lg = ({ c, t }: { c: string; t: string }) => (
  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} /><span className="text-gray-600 dark:text-gray-300">{t}</span></span>
)

type Series = { value: number; date: string }[]
type Spec = { key: string; name: string; color: string; tf?: (v: number) => number }
function build(d: Record<string, Series>, specs: Spec[]) {
  const present = specs.filter((s) => (d[s.key] ?? []).length >= 1)
  const dates = Array.from(new Set(present.flatMap((s) => (d[s.key] ?? []).map((r) => r.date)))).sort()
  const series = present.map((s) => { const m = new Map((d[s.key] ?? []).map((r) => [r.date, r.value])); return { name: s.name, color: s.color, w: 2, data: dates.map((dt) => (m.has(dt) ? (s.tf ? s.tf(m.get(dt)!) : m.get(dt)!) : NaN)) } })
  return { labels: fmtLabels(dates), series, has: series.some((s) => s.data.some((v) => Number.isFinite(v))) }
}

const KEYS = ["internet_penetration", "account_ownership", "mobile_per100", "broadband_per100", "credit_card_ownership", "debit_card_ownership", "credit_card_used", "secure_internet_servers", "saved_at_fi_pct"]

export default function OnlineMarketView() {
  const [d, setD] = useState<Record<string, Series>>({})
  const [est, setEst] = useState<MktEst[]>([])
  const [kv, setKv] = useState<Record<string, { value: number; date: string }>>({})
  const [open, setOpen] = useState(false)
  const [srcOpen, setSrcOpen] = useState(false)
  useEffect(() => {
    Promise.all(KEYS.map((k) => macroDual(k).then((r) => [k, r] as const)))
      .then((rs) => setD(Object.fromEntries(rs))).catch(() => {})
    marketEstimates("ecommerce").then(setEst).catch(() => {})
    latestMacro(["ecommerce_weekly_pct", "internet_penetration", "account_ownership", "credit_card_ownership", "mobile_per100"]).then(setKv).catch(() => {})
  }, [])

  const vals = est.map((e) => e.value).filter((v) => v > 0).sort((a, b) => a - b)
  const med = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null
  const cagr = useMemo(() => { const c = est.map((e) => e.cagr).filter((v): v is number => v != null); return c.length ? c.reduce((a, b) => a + b, 0) / c.length : null }, [est])

  const digital = build(d, [{ key: "internet_penetration", name: "인터넷 이용률", color: C.ind }, { key: "account_ownership", name: "금융계정 보유", color: C.emer }])
  const infra = build(d, [{ key: "mobile_per100", name: "모바일 가입/100", color: C.blue }, { key: "broadband_per100", name: "브로드밴드/100", color: C.violet }])
  const pay = build(d, [{ key: "credit_card_ownership", name: "신용카드 보유", color: C.rose }, { key: "debit_card_ownership", name: "직불카드 보유", color: C.blue }, { key: "credit_card_used", name: "신용카드 사용", color: C.amber }])
  const secure = build(d, [{ key: "secure_internet_servers", name: "보안 인터넷서버", color: C.violet }])

  const src = (t: string) => <><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> {t}</>

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes fadeOnly{from{opacity:0}to{opacity:1}}"}</style>

      {/* 접이식 배너 */}
      <div className="overflow-hidden rounded-xl border border-violet-100 dark:border-violet-500/25 bg-gradient-to-r from-violet-50 dark:from-violet-500/10 via-violet-50/40 dark:via-transparent to-white dark:to-gray-900 shadow-sm" style={{ animation: "fadeOnly .5s ease both" }}>
        <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer select-none items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg></div>
          <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700 dark:text-gray-200"><b className="font-semibold text-gray-900 dark:text-gray-50">온라인 시장</b> — 이커머스 {med != null ? <b className="text-violet-700 dark:text-violet-300">${med.toFixed(1)}B</b> : "—"}·연 {cagr != null ? cagr.toFixed(0) + "%" : "—"} 성장 · 인터넷 {kv.internet_penetration ? Math.round(kv.internet_penetration.value) + "%" : "—"}·계정 {kv.account_ownership ? Math.round(kv.account_ownership.value) + "%" : "—"} — 온라인 가전 구매 저변</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-violet-500 dark:text-violet-300 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
          <div className="overflow-hidden"><div className="border-t border-violet-100/70 dark:border-violet-500/25 px-4 pb-3.5 pt-3 text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">
            인터넷 이용률·금융계정이 빠르게 오르는 반면 <b className="text-gray-900 dark:text-gray-50">신용카드 보유는 3%대로 낮아</b>, 온라인 가전 판매는 <b className="text-violet-700 dark:text-violet-300">직불·현금·리테일러/핀테크 할부(BNPL)</b> 중심으로 설계해야 시장 특성에 맞습니다.
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-violet-700 dark:text-violet-300"><span className="mt-0.5 shrink-0 rounded bg-violet-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 관점</span><span>온라인 전용 모델·D2C·마켓플레이스 플래그십 + 무이자할부/BNPL 제휴로 전환율 제고. 모바일 포화·브로드밴드 확대는 스마트가전 연결성 마케팅 기반.</span></p>
          </div></div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section className="flex flex-col gap-4">
          {/* 이커머스 시장규모 */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
            <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
              <span className="h-[18px] w-1 rounded bg-violet-500" />
              <h2 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">이커머스 시장규모</h2>
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
                <button onClick={() => setSrcOpen((v) => !v)} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400">근거 {est.length}건 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: srcOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg></button>
                {srcOpen && (
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
          </div>

          {/* 지표 차트 그리드 — 표준 ChartCard */}
          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            {digital.has && (
              <ChartCard seg="CE" title="디지털 이용 확산" unit="% · 연간" labels={digital.labels} series={digital.series} decimals={0} seriesUnit="%"
                legend={<><Lg c={C.ind} t="인터넷 이용률" /><Lg c={C.emer} t="금융계정 보유" /></>}
                meaning={<>인터넷 이용·금융계정 보유 확대 — <b className="text-gray-700 dark:text-gray-200">온라인 가전 구매·전자결제 저변</b></>}
                ai={<>인터넷·계정 보유 상승은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">이커머스·할부·BNPL 채널 확장</b> → 온라인 전용 모델·번들·D2C 강화</>}
                src={src("World Bank·ITU 디지털지표 · 연간")} />
            )}
            {pay.has && (
              <ChartCard seg="CE" title="온라인 결제수단 보급" unit="% 성인 · 연간" labels={pay.labels} series={pay.series} decimals={1} seriesUnit="%"
                legend={<><Lg c={C.rose} t="신용카드 보유" /><Lg c={C.blue} t="직불카드 보유" /><Lg c={C.amber} t="신용카드 사용" /></>}
                meaning={<>온라인 결제 기반 카드 보급(Findex) — <b className="text-gray-700 dark:text-gray-200">이커머스 결제·할부 구조</b></>}
                ai={<><b className="font-semibold text-rose-600 dark:text-rose-400">신용카드 3%대로 낮음</b> → 온라인 가전은 직불·현금·<b className="font-semibold text-emerald-600 dark:text-emerald-400">BNPL/핀테크 할부</b> 우선 설계가 전환에 유리</>}
                src={src("World Bank Global Findex 카드 보유·사용율 · 격년")} />
            )}
            {infra.has && (
              <ChartCard seg="CE" title="통신 인프라 침투" unit="100명당 · 연간" labels={infra.labels} series={infra.series} decimals={0} seriesUnit=""
                legend={<><Lg c={C.blue} t="모바일 가입/100" /><Lg c={C.violet} t="브로드밴드/100" /></>}
                meaning={<>모바일·브로드밴드 보급 — <b className="text-gray-700 dark:text-gray-200">모바일 커머스·스마트가전 연결성</b></>}
                ai={<>모바일 포화·브로드밴드 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">앱 기반 구매·IoT 가전</b> 수요 기반 → 스마트홈 연계 마케팅</>}
                src={src("World Bank·ITU 통신지표 · 연간")} />
            )}
            {secure.has && (
              <ChartCard seg="B2B" title="이커머스 인프라 (보안서버)" unit="백만명당 · 연간" labels={secure.labels} series={secure.series} decimals={0} seriesUnit=""
                legend={<Lg c={C.violet} t="보안 인터넷서버/100만" />}
                meaning={<>보안 인터넷서버 밀도 — <b className="text-gray-700 dark:text-gray-200">전자상거래·결제 신뢰 인프라 성숙도</b></>}
                ai={<>보안 인프라 확충은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">온라인 결제 신뢰·플랫폼 성숙</b> → 공식몰·마켓플레이스 플래그십 확대 여건</>}
                src={src("World Bank WDI 보안 인터넷서버 · 연간")} />
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4"><AgendaCard /></aside>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">출처 이커머스 규모=다중기관 민간추정(범위·중앙값) · 디지털/결제/인프라=World Bank(WDI·Global Findex)·ITU 연간 실측 · 신용카드 보유율은 격년 서베이(2011~2024)</p>
    </div>
  )
}
