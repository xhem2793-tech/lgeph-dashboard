"use client"

import React, { useEffect, useMemo, useState } from "react"
import { energyLabels, type EnergyRow } from "@/lib/supabase"

/** 에너지 효율 — 카테고리 × 설치형(창문/벽걸이) × 용량 세그먼트별 브랜드 효율 비교. 일반 차트카드 다중. */

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF", specUnit: "냉방용량" },
  { key: "ref", label: "냉장고", metric: "EEF", specUnit: "용량" },
  { key: "tvl", label: "TV", metric: "EER", specUnit: "화면" },
]
const SEG: Record<string, { k: string; lo: number; hi: number }[]> = {
  acu: [{ k: "1HP급", lo: 0, hi: 3.4 }, { k: "1.5HP급", lo: 3.4, hi: 5.2 }, { k: "2HP급", lo: 5.2, hi: 6.9 }, { k: "2.5HP+", lo: 6.9, hi: Infinity }],
  ref: [{ k: "~200L", lo: 0, hi: 200 }, { k: "200~299L", lo: 200, hi: 300 }, { k: "300~399L", lo: 300, hi: 400 }, { k: "400L+", lo: 400, hi: Infinity }],
  tvl: [{ k: '~32"', lo: 0, hi: 33 }, { k: '39~43"', lo: 33, hi: 44 }, { k: '48~50"', lo: 44, hi: 51 }, { k: '55"+', lo: 51, hi: Infinity }],
}
function typeOf(cat: string, s: string): string {
  const t = (s || "").toLowerCase()
  if (cat === "acu") { if (t.includes("window")) return "창문형"; if (t.includes("wall")) return "벽걸이형"; if (t.includes("cassette") || t.includes("ceiling") || t.includes("floor") || t.includes("suspend")) return "천장·스탠드"; return "기타" }
  if (cat === "ref") { if (t.includes("frost free")) return "간냉식"; if (t.includes("defrost")) return "직냉식"; return "기타" }
  return "전체"
}
const TEAL = "#0d9488", GRAY = "#cbd5e1", AMBER = "#f59e0b"

// 카드 셸
function Card({ title, seg, note, children }: { title: string; seg?: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        {seg && <span className="shrink-0 rounded bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-300">{seg}</span>}
      </div>
      <div className="mt-2 flex-1">{children}</div>
      <p className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-1.5 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">{note}</p>
    </div>
  )
}
// 가로 막대 랭킹
function HBar({ items, hiName }: { items: { name: string; v: number; n?: number }[]; hiName?: string }) {
  if (!items.length) return <div className="flex h-32 items-center justify-center text-[12px] text-gray-400">데이터 부족</div>
  const max = Math.max(...items.map((i) => i.v), 1), rowH = 24, padL = 74, padR = 40, W = 360, H = items.length * rowH + 2
  const bx = (v: number) => padL + (W - padL - padR) * (v / max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }}>
      {items.map((a, i) => {
        const isHi = hiName && a.name.toLowerCase() === hiName.toLowerCase(), y = i * rowH, col = isHi ? TEAL : i === 0 ? "#5eead4" : "#e2e8f0"
        return (
          <g key={a.name}>
            <text x={padL - 6} y={y + rowH / 2 + 3.5} textAnchor="end" fontSize="10.5" fontWeight={isHi ? 800 : 500} className={isHi ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{a.name}</text>
            <rect x={padL} y={y + 4} width={Math.max(2, bx(a.v) - padL)} height={rowH - 9} rx="3" fill={col} className={isHi ? "" : "dark:opacity-30"} style={{ animation: "grow .5s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 0.03 + "s", transformOrigin: `${padL}px 0` }} />
            <text x={bx(a.v) + 5} y={y + rowH / 2 + 3.5} fontSize="10.5" fontWeight={isHi ? 800 : 600} className={isHi ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-600 dark:fill-gray-300"}>{a.v.toFixed(2)}</text>
          </g>
        )
      })}
    </svg>
  )
}
// 그룹 막대(LG vs 시장평균) per 범주
function GroupBars({ groups }: { groups: { label: string; lg: number | null; mkt: number }[] }) {
  if (!groups.length) return <div className="flex h-32 items-center justify-center text-[12px] text-gray-400">데이터 부족</div>
  const max = Math.max(...groups.flatMap((g) => [g.lg ?? 0, g.mkt]), 1), W = 360, H = 150, B = 26, T = 6, L = 6, R = 6
  const gw = (W - L - R) / groups.length, bw = Math.min(18, gw * 0.3)
  const Y = (v: number) => T + (H - T - B) * (1 - v / max)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }}>
        {groups.map((g, i) => {
          const cx = L + gw * (i + 0.5)
          return (
            <g key={g.label}>
              {g.lg != null && <rect x={cx - bw - 1} y={Y(g.lg)} width={bw} height={H - B - Y(g.lg)} rx="2" fill={TEAL} style={{ animation: "growBar .5s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 0.04 + "s", transformOrigin: `center ${H - B}px` }} />}
              <rect x={cx + 1} y={Y(g.mkt)} width={bw} height={H - B - Y(g.mkt)} rx="2" fill={GRAY} className="dark:opacity-40" style={{ animation: "growBar .5s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 0.04 + 0.02 + "s", transformOrigin: `center ${H - B}px` }} />
              {g.lg != null && <text x={cx - bw / 2 - 1} y={Y(g.lg) - 3} textAnchor="middle" fontSize="8.5" fontWeight="700" className="fill-teal-600 dark:fill-teal-400">{g.lg.toFixed(1)}</text>}
              <text x={cx} y={H - 14} textAnchor="middle" fontSize="9.5" className="fill-gray-500 dark:fill-gray-400">{g.label}</text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10px]"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: TEAL }} />LG</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />시장평균</span></div>
    </>
  )
}

export default function EnergyLabelView() {
  const [rows, setRows] = useState<EnergyRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cat, setCat] = useState("acu")
  const [typ, setTyp] = useState("전체")
  const [segIdx, setSegIdx] = useState(0)
  useEffect(() => { energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true)) }, [])

  const cur = CATS.find((c) => c.key === cat)!
  const segs = SEG[cat] || []
  const hasType = cat === "acu" || cat === "ref"
  const catRows = useMemo(() => rows.filter((r) => r.category === cat && r.brand && r.eff != null && r.eff > 0), [rows, cat])
  const types = useMemo(() => hasType ? Array.from(new Set(catRows.map((r) => typeOf(cat, r.stype)))).filter((t) => t !== "기타").sort() : [], [catRows, hasType, cat])
  useEffect(() => { setTyp("전체"); setSegIdx(0) }, [cat])

  const byType = (r: EnergyRow) => typ === "전체" || typeOf(cat, r.stype) === typ
  const segCounts = useMemo(() => segs.map((s) => catRows.filter((r) => byType(r) && r.spec != null && r.spec >= s.lo && r.spec < s.hi).length), [catRows, segs, typ])
  useEffect(() => { if (!segCounts.length) return; const b = segCounts.indexOf(Math.max(...segCounts)); if (segCounts[segIdx] === 0 && b >= 0) setSegIdx(b) }, [typ]) // eslint-disable-line
  const seg = segs[segIdx] || segs[0]

  // Card1: 선택 타입+용량 내 브랜드 랭킹
  const rank = useMemo(() => {
    const rs = catRows.filter((r) => byType(r) && seg && r.spec != null && r.spec >= seg.lo && r.spec < seg.hi)
    const by: Record<string, number[]> = {}; for (const r of rs) (by[r.brand] = by[r.brand] || []).push(r.eff!)
    return Object.entries(by).map(([name, a]) => ({ name, v: a.reduce((x, y) => x + y, 0) / a.length, n: a.length })).filter((x) => x.n >= 2).sort((a, b) => b.v - a.v).slice(0, 8)
  }, [catRows, seg, typ])
  const lgRank = rank.find((r) => /^lg$/i.test(r.name)); const lgRk = lgRank ? rank.indexOf(lgRank) + 1 : 0

  // Card2: 설치형별 LG vs 시장평균 (선택 용량 무관, 타입 전체)
  const byTypeChart = useMemo(() => {
    if (!hasType) return []
    const cats = types
    return cats.map((tp) => {
      const rs = catRows.filter((r) => typeOf(cat, r.stype) === tp)
      const lgv = rs.filter((r) => /^lg$/i.test(r.brand)).map((r) => r.eff!)
      const all = rs.map((r) => r.eff!)
      return { label: tp, lg: lgv.length ? lgv.reduce((a, b) => a + b, 0) / lgv.length : null, mkt: all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0 }
    }).filter((g) => g.mkt > 0)
  }, [catRows, types, hasType, cat])

  // Card3: 용량대별 LG vs 시장평균
  const bySeg = useMemo(() => segs.map((s) => {
    const rs = catRows.filter((r) => byType(r) && r.spec != null && r.spec >= s.lo && r.spec < s.hi)
    const lgv = rs.filter((r) => /^lg$/i.test(r.brand)).map((r) => r.eff!)
    const all = rs.map((r) => r.eff!)
    return { label: s.k, lg: lgv.length ? lgv.reduce((a, b) => a + b, 0) / lgv.length : null, mkt: all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0 }
  }).filter((g) => g.mkt > 0), [catRows, segs, typ])

  // Card4: 등급 분포(선택 세그먼트 상위 브랜드 5/4/3성)
  const grade = useMemo(() => {
    const rs = catRows.filter((r) => byType(r) && seg && r.spec != null && r.spec >= seg.lo && r.spec < seg.hi)
    const by: Record<string, EnergyRow[]> = {}; for (const r of rs) (by[r.brand] = by[r.brand] || []).push(r)
    return Object.entries(by).map(([name, a]) => { const st = a.filter((r) => r.star != null); const p = (f: (s: number) => boolean) => st.length ? st.filter((r) => f(r.star ?? 0)).length / st.length * 100 : 0; return { name, n: a.length, s5: p((s) => s >= 5), s4: p((s) => s === 4), s3: p((s) => s <= 3) } }).filter((x) => x.n >= 3).sort((a, b) => b.s5 - a.s5).slice(0, 6)
  }, [catRows, seg, typ])

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes growBar{from{transform:scaleY(0)}to{transform:scaleY(1)}}"}</style>

      {/* 헤더 + 카테고리 */}
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both" }}>
        <div>
          <h1 className="text-[19px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">에너지 효율</h1>
          <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">DOE 에너지효율 라벨 · 설치형·용량 세그먼트별 브랜드 {cur.metric} 비교</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-800 p-0.5">
          {CATS.map((c) => (<button key={c.key} onClick={() => setCat(c.key)} className={"rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all " + (cat === c.key ? "bg-teal-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400")}>{c.label}</button>))}
        </div>
      </div>

      {/* 필터: 설치형 + 용량 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".03s" }}>
        {hasType && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">설치형</span>
            {["전체", ...types].map((t) => <button key={t} onClick={() => setTyp(t)} className={"rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all " + (typ === t ? "bg-teal-600 text-white" : "border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-teal-300")}>{t}</button>)}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{cur.specUnit}</span>
          {segs.map((s, i) => <button key={s.k} onClick={() => setSegIdx(i)} disabled={!segCounts[i]} className={"rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all disabled:opacity-30 " + (segIdx === i ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-400")}>{s.k}<span className="ml-1 text-[10px] opacity-60">{segCounts[i]}</span></button>)}
        </div>
      </div>

      {loaded && lgRank && rank[0] && (
        <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-200" style={{ animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both", animationDelay: ".05s" }}>
          <b className="text-gray-900 dark:text-gray-50">{cur.label} · {typ !== "전체" ? typ + " · " : ""}{seg?.k}</b> — LG <b className="text-teal-600 dark:text-teal-400">{rank.length}개사 중 {lgRk}위</b>, 리더 {rank[0].name}({rank[0].v.toFixed(2)}) 대비 {(((rank[0].v - lgRank.v) / lgRank.v) * 100).toFixed(0)}% 낮음
        </p>
      )}

      {!loaded ? <div className="h-64 animate-pulse rounded-xl bg-gray-50 dark:bg-gray-800/40" /> : (
        <div className="grid items-stretch gap-4 sm:grid-cols-2">
          <Card title="브랜드 효율 랭킹" seg={`${typ !== "전체" ? typ + " " : ""}${seg?.k}`} note={`선택 세그먼트 내 브랜드 평균 ${cur.metric} · LG 강조`}>
            <HBar items={rank} hiName="LG" />
          </Card>
          {hasType && (
            <Card title="설치형별 LG vs 시장" note={`설치형별 평균 ${cur.metric} · LG가 어느 폼팩터에 강한가`}>
              <GroupBars groups={byTypeChart} />
            </Card>
          )}
          <Card title="용량대별 LG vs 시장" note={`용량 세그먼트별 평균 ${cur.metric} · LG 강·약 구간 식별`}>
            <GroupBars groups={bySeg} />
          </Card>
          <Card title="등급 분포(별점)" seg={seg?.k} note="브랜드별 5·4·3성↓ 구성 · 5성 비중 높은 순">
            {grade.length === 0 ? <div className="flex h-32 items-center justify-center text-[12px] text-gray-400">데이터 부족</div> : (
              <div className="flex flex-col gap-1.5">
                {grade.map((g) => { const isLG = /^lg$/i.test(g.name); return (
                  <div key={g.name} className="flex items-center gap-2">
                    <span className={"w-[52px] shrink-0 truncate text-right text-[10.5px] " + (isLG ? "font-bold text-teal-600 dark:text-teal-400" : "text-gray-500 dark:text-gray-400")}>{g.name}</span>
                    <span className="flex h-3 flex-1 overflow-hidden rounded" title={`5성 ${g.s5.toFixed(0)}% · 4성 ${g.s4.toFixed(0)}% · 3성↓ ${g.s3.toFixed(0)}%`}><span style={{ width: g.s5 + "%", background: "#10b981" }} /><span style={{ width: g.s4 + "%", background: AMBER }} /><span className="bg-gray-300 dark:bg-gray-600" style={{ width: g.s3 + "%" }} /></span>
                    <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{g.s5.toFixed(0)}%</span>
                  </div>
                ) })}
                <div className="mt-0.5 flex items-center gap-3 text-[9.5px] text-gray-400"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />5성</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: AMBER }} />4성</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />3성↓</span></div>
              </div>
            )}
          </Card>
        </div>
      )}

      <p className="text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · 설치형·용량 세그먼트별 브랜드 평균 {cur.metric}(높을수록 고효율) · 전체 평균은 스펙 혼합으로 왜곡되므로 세그먼트별 비교</p>
    </div>
  )
}
