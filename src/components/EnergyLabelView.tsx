"use client"

import React, { useEffect, useMemo, useState } from "react"
import { energyLabels, type EnergyRow } from "@/lib/supabase"

/** 에너지 라벨 — DOE 에너지효율 등급. 제품담당 관점:
 *  ① LG가 카테고리 기준선 대비 어디에 서 있나(5성 비중은 카테고리마다 기준이 다름)
 *  ② 라인업 폭(풀라인업 vs 니치)이 5성% 차이를 만든다 → 오해 방지
 *  ③ 차기 목표 스펙·프리미엄 소구 근거 */

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF" },
  { key: "ref", label: "냉장고", metric: "EEF" },
  { key: "tvl", label: "TV", metric: "EER" },
  { key: "cwm", label: "세탁기", metric: "EER" },
]

type Agg = { brand: string; n: number; eff: number; s5: number; s4: number; s3: number; kwh: number | null }

export default function EnergyLabelView() {
  const [rows, setRows] = useState<EnergyRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cat, setCat] = useState("acu")
  useEffect(() => { energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const cur = CATS.find((c) => c.key === cat)!
  const catRows = useMemo(() => rows.filter((r) => r.category === cat && r.brand), [rows, cat])
  const baseline5 = useMemo(() => { const s = catRows.filter((r) => r.star != null); return s.length ? s.filter((r) => (r.star ?? 0) >= 5).length / s.length * 100 : 0 }, [catRows])

  const agg = useMemo<Agg[]>(() => {
    const by: Record<string, EnergyRow[]> = {}
    for (const r of catRows) (by[r.brand] = by[r.brand] || []).push(r)
    return Object.entries(by).map(([brand, rs]) => {
      const effs = rs.map((r) => r.eff).filter((v): v is number => v != null && v > 0)
      const kwhs = rs.map((r) => r.kwh).filter((v): v is number => v != null && v > 0)
      const st = rs.filter((r) => r.star != null)
      const pct = (f: (s: number) => boolean) => st.length ? st.filter((r) => f(r.star ?? 0)).length / st.length * 100 : 0
      return { brand, n: rs.length, eff: effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : 0, s5: pct((s) => s >= 5), s4: pct((s) => s === 4), s3: pct((s) => s <= 3), kwh: kwhs.length ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : null }
    }).filter((a) => a.n >= 5)
  }, [catRows])

  const byEff = useMemo(() => [...agg].sort((a, b) => b.eff - a.eff), [agg])
  const lg = agg.find((a) => /^lg$/i.test(a.brand))
  const lgEffRank = lg ? byEff.findIndex((a) => a === lg) + 1 : 0
  const leader = byEff[0]
  const gap = lg && leader ? ((leader.eff - lg.eff) / lg.eff) * 100 : null
  const maxEff = Math.max(...agg.map((a) => a.eff), 1)
  const niche = agg.filter((a) => a.s5 >= 99 && a.n <= 12).sort((a, b) => b.n - a.n)
  const topModels = useMemo(() => [...catRows].filter((r) => r.eff != null && r.eff > 0).sort((a, b) => (b.eff ?? 0) - (a.eff ?? 0)).slice(0, 6), [catRows])

  const Stat = ({ label, value, sub, accent }: { label: string; value: string; sub?: React.ReactNode; accent?: boolean }) => (
    <div className={"flex-1 min-w-[150px] rounded-lg border px-3.5 py-2.5 " + (accent ? "border-teal-200 dark:border-teal-500/30 bg-teal-50/60 dark:bg-teal-500/10" : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30")}>
      <div className="text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">{label}</div>
      <div className={"mt-0.5 text-[20px] font-extrabold tabular-nums tracking-tight " + (accent ? "text-teal-700 dark:text-teal-300" : "text-gray-900 dark:text-gray-50")}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  )
  const Dist = ({ a }: { a: Agg }) => (
    <span className="flex h-2.5 w-full min-w-[80px] max-w-[150px] overflow-hidden rounded-full" title={`5성 ${a.s5.toFixed(0)}% · 4성 ${a.s4.toFixed(0)}% · 3성↓ ${a.s3.toFixed(0)}%`}>
      <span className="block h-full bg-emerald-500" style={{ width: a.s5 + "%" }} />
      <span className="block h-full bg-amber-400" style={{ width: a.s4 + "%" }} />
      <span className="block h-full bg-gray-300 dark:bg-gray-600" style={{ width: a.s3 + "%" }} />
    </span>
  )

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      <div className="rounded-xl border border-teal-100 dark:border-teal-500/25 bg-gradient-to-r from-teal-50 dark:from-teal-500/10 via-teal-50/40 dark:via-transparent to-white dark:to-gray-900 px-4 py-3 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg></div>
          <div className="text-[13px] leading-snug text-gray-700 dark:text-gray-200">
            <b className="font-semibold text-gray-900 dark:text-gray-50">에너지 라벨 · {cur.label}</b> — {lg && leader ? <>LG 효율 <b className="text-teal-700 dark:text-teal-300">{agg.length}개사 중 {lgEffRank}위</b>, 리더 <b>{leader.brand}</b> 대비 {gap != null ? gap.toFixed(0) : "—"}% 낮음 · LG 5성 <b className="text-teal-700 dark:text-teal-300">{lg.s5.toFixed(0)}%</b> vs 카테고리 평균 {baseline5.toFixed(0)}%</> : "DOE 에너지효율 등급 분석"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={"rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all " + (cat === c.key ? "bg-teal-600 text-white shadow-sm" : "border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-teal-300 dark:hover:border-teal-500/40")}>{c.label}</button>
        ))}
      </div>

      {loaded && lg && (
        <div className="flex flex-wrap gap-2.5" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
          <Stat label={"LG 평균 " + cur.metric} value={lg.eff.toFixed(2)} sub={<>효율 <b className="text-gray-700 dark:text-gray-300">{lgEffRank}위</b> / {agg.length}개사</>} accent />
          <Stat label="LG 5성 비중" value={lg.s5.toFixed(0) + "%"} sub={<>카테고리 평균 <b className={lg.s5 >= baseline5 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{baseline5.toFixed(0)}%</b> {lg.s5 >= baseline5 ? "이상" : "미만"}</>} accent />
          <Stat label="카테고리 리더" value={leader ? leader.brand : "—"} sub={leader ? <>{cur.metric} {leader.eff.toFixed(2)} · LG 대비 <b className="text-rose-600 dark:text-rose-400">+{gap != null ? gap.toFixed(0) : "—"}%</b></> : undefined} />
          <Stat label="LG 모델 수" value={String(lg.n)} sub={<>{cur.label} 등록(풀라인업)</>} />
        </div>
      )}

      {/* 해석: 왜 이런가 */}
      {loaded && lg && (
        <section className="rounded-xl border border-amber-100 dark:border-amber-500/25 bg-amber-50/40 dark:bg-amber-500/5 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
          <div className="flex items-center gap-1.5"><span className="rounded bg-amber-500 px-1.5 py-0.5 text-[9.5px] font-bold text-white">해석</span><h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">LG {cur.label} 5성 {lg.s5.toFixed(0)}% — 어떻게 읽나</h3></div>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">
            <li>• <b>기준이 카테고리마다 다름</b> — {cur.label} 시장 전체 5성 비중은 <b className="text-teal-700 dark:text-teal-300">{baseline5.toFixed(0)}%</b>. {baseline5 >= 60 ? "5성이 사실상 표준" : baseline5 >= 25 ? "5성이 상위권 그룹" : "5성이 소수 프리미엄"}이라, 절대% 대신 <b>평균 대비</b>로 봐야 함. LG는 평균 {lg.s5 >= baseline5 ? "이상" : "미만"}.</li>
            <li>• <b>라인업 폭의 영향</b> — LG는 {lg.n}개 <b>풀라인업</b>(보급~프리미엄). {niche.length > 0 ? <>반면 5성 100% 브랜드({niche.slice(0, 3).map((x) => x.brand + " " + x.n + "모델").join("·")})는 <b>소형 니치</b>로 프리미엄만 취급 → 100%는 라인업이 좁다는 뜻이지 절대 우위가 아님.</> : "5성 100% 브랜드는 대개 모델 수가 적은 니치."}</li>
            <li>• <b>실행</b> — {lg.s5 >= baseline5 ? <>평균 이상 유지 중. 최고 {cur.metric}(리더 {leader?.brand} {leader?.eff.toFixed(2)}) 격차 {gap != null ? gap.toFixed(0) : "—"}%를 플래그십에서 좁혀 <b>효율 상한 리더십</b> 확보.</> : <>평균 미만 → 프리미엄 라인 5성 확대가 시급. 벤치마크(하단 최고효율 모델)로 차기 목표 스펙 설정, 보급형은 4성 유지로 가격 방어.</>}</li>
          </ul>
        </section>
      )}

      {/* 효율 랭킹 — 시각 우선(바 차트) */}
      {loaded && byEff.length > 0 && (() => {
        const top = byEff.slice(0, 14)
        const avg = agg.reduce((s, a) => s + a.eff, 0) / (agg.length || 1)
        const rowH = 26, padL = 92, padR = 46, W = 720, H = top.length * rowH + 30
        const bx = (v: number) => padL + (W - padL - padR) * (v / maxEff)
        return (
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
            <header className="mb-2 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
              <span className="h-[18px] w-1 rounded bg-teal-500" />
              <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{cur.label} 브랜드 효율 랭킹</h2>
              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">평균 {cur.metric}(높을수록 고효율) · LG 강조 · 점선=시장평균</span>
            </header>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }}>
              <line x1={bx(avg)} y1="6" x2={bx(avg)} y2={H - 20} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 3" />
              <text x={bx(avg)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#9ca3af">평균 {avg.toFixed(2)}</text>
              {top.map((a, i) => {
                const isLG = /^lg$/i.test(a.brand), y = 6 + i * rowH, col = isLG ? "#0d9488" : i === 0 ? "#d97706" : "#cbd5e1"
                return (
                  <g key={a.brand} style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(i, 12) * 0.03 + "s" }}>
                    <text x={padL - 6} y={y + rowH / 2 + 3.5} textAnchor="end" fontSize="11" fontWeight={isLG ? 800 : 500} fill={isLG ? "#0d9488" : "currentColor"} className="text-gray-600 dark:text-gray-300">{a.brand}</text>
                    <rect x={padL} y={y + 3} width={Math.max(1, bx(a.eff) - padL)} height={rowH - 8} rx="3" fill={col} className={isLG ? "" : "dark:opacity-70"} />
                    <text x={bx(a.eff) + 5} y={y + rowH / 2 + 3.5} fontSize="11" fontWeight={isLG ? 800 : 600} fill={isLG ? "#0d9488" : "currentColor"} className="text-gray-700 dark:text-gray-200">{a.eff.toFixed(2)}{isLG ? " ★" : i === 0 ? " 리더" : ""}</text>
                  </g>
                )
              })}
            </svg>
            <p className="mt-1 text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">막대=평균 {cur.metric} · 5성 등급 분포·모델수는 아래 상세 표 참조</p>
          </section>
        )
      })()}

      {/* 브랜드 등급 분포 + 효율 (상세 표 — 보조) */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
        <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
          <span className="h-[18px] w-1 rounded bg-gray-300 dark:bg-gray-600" />
          <h2 className="text-[15px] font-bold tracking-tight text-gray-700 dark:text-gray-200">상세 표 · 등급 분포</h2>
          <span className="ml-auto flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />5성</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />4성</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />3성↓</span></span>
        </header>
        {!loaded ? (
          <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-gray-50 dark:bg-gray-800/40" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12px]">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">
                <th className="px-2 py-1.5 w-7">#</th><th className="px-2 py-1.5">브랜드</th><th className="px-2 py-1.5">모델</th><th className="px-2 py-1.5">등급 분포(5·4·3성↓)</th><th className="px-2 py-1.5 text-right">평균 {cur.metric}</th><th className="px-2 py-1.5 text-right">월kWh</th>
              </tr></thead>
              <tbody>
                {byEff.map((a, i) => {
                  const isLG = /^lg$/i.test(a.brand); const isNiche = a.s5 >= 99 && a.n <= 12
                  return (
                    <tr key={a.brand} className={"border-b border-gray-50 dark:border-gray-800/50 " + (isLG ? "bg-teal-50/60 dark:bg-teal-500/10" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30")} style={{ animation: "fadeUp .3s cubic-bezier(.16,1,.3,1) both", animationDelay: Math.min(i, 14) * 0.018 + "s" }}>
                      <td className="px-2 py-1.5 tabular-nums font-bold text-gray-400 dark:text-gray-500">{i + 1}</td>
                      <td className={"px-2 py-1.5 font-bold whitespace-nowrap " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{a.brand}{isLG && <span className="ml-1 rounded bg-teal-600 px-1 py-px text-[8.5px] font-bold text-white">LG</span>}{i === 0 && <span className="ml-1 rounded bg-amber-100 dark:bg-amber-500/20 px-1 py-px text-[8.5px] font-bold text-amber-700 dark:text-amber-300">리더</span>}{isNiche && <span className="ml-1 rounded bg-gray-100 dark:bg-gray-800 px-1 py-px text-[8.5px] font-bold text-gray-500 dark:text-gray-400">니치</span>}</td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{a.n}</td>
                      <td className="px-2 py-1.5"><div className="flex items-center gap-2"><Dist a={a} /><span className="w-9 shrink-0 text-right text-[10.5px] tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{a.s5.toFixed(0)}%</span></div></td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><span className={"block h-full rounded-full " + (isLG ? "bg-teal-500" : i === 0 ? "bg-amber-400" : "bg-gray-400 dark:bg-gray-600")} style={{ width: (a.eff / maxEff * 100) + "%" }} /></span>
                          <span className={"w-11 tabular-nums font-semibold " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{a.eff.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{a.kwh != null ? Math.round(a.kwh) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loaded && topModels.length > 0 && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
          <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-amber-500" /><h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">최고효율 벤치마크 모델</h2><span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">시장 최고 {cur.metric} — 차기 목표 스펙</span>
          </header>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topModels.map((m, i) => { const isLG = /^lg$/i.test(m.brand); return (
              <div key={i} className={"rounded-lg border px-3 py-2 " + (isLG ? "border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/10" : "border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30")}>
                <div className="flex items-center justify-between gap-2"><span className={"text-[12px] font-bold " + (isLG ? "text-teal-700 dark:text-teal-300" : "text-gray-800 dark:text-gray-100")}>{m.brand}</span><span className="text-[13px] font-extrabold tabular-nums text-gray-900 dark:text-gray-50">{m.eff?.toFixed(2)}<span className="ml-0.5 text-[9px] font-medium text-gray-400">{cur.metric}</span></span></div>
                <div className="mt-0.5 truncate text-[10.5px] text-gray-500 dark:text-gray-400" title={m.model}>{m.model || "—"}{m.kwh != null ? " · " + Math.round(m.kwh) + "kWh/월" : ""}</div>
              </div>
            ) })}
          </div>
        </section>
      )}

      <p className="text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · 등급 분포=브랜드 라인업의 5·4·3성↓ 구성 · 5성% 절대비교는 라인업 폭·카테고리 기준선 차이로 오해 소지 → 평균 대비·등급 분포로 해석</p>
    </div>
  )
}
