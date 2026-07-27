"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { energyLabels, latestMacro, type EnergyRow } from "@/lib/supabase"
import { AgendaCard } from "@/components/EconViews"
import { Segmented } from "@/components/Segmented"

/** 에너지 효율 — 전문기관 수준 분석. 카테고리×설치형×냉매×용량 세그먼트별 브랜드 효율·등급·전력비용(TCO). */

const CATS = [
  { key: "acu", label: "에어컨", metric: "CSPF", specUnit: "냉방용량" },
  { key: "ref", label: "냉장고", metric: "EEF", specUnit: "용량" },
  { key: "tvl", label: "TV", metric: "EER", specUnit: "화면" },
]
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
  if (!pick) return <div className="flex h-40 items-center justify-center text-[12px] text-gray-400">세그먼트 데이터 부족</div>
  const kwh = pick.kwh * mult
  const mo = Math.round(kwh * rate), yr = Math.round(kwh * rate * 12)
  const lgMo = lgKwh != null ? Math.round(lgKwh * mult * rate) : null
  const saveYr = lgMo != null ? (mo - lgMo) * 12 : null
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-gray-500 dark:text-gray-400">브랜드/모델(세그먼트 평균)</span>
          <select value={pick.name} onChange={(e) => setSel(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100 outline-none focus:border-teal-400">
            {brands.map((b) => <option key={b.name} value={b.name}>{b.name} · {Math.round(b.kwh)}kWh/월</option>)}
          </select></label>
        <label className="block"><span className="mb-1 flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400"><span>사용강도</span><span className="text-teal-600 dark:text-teal-400">{mult.toFixed(2)}× {mult < 1 ? "(가벼움)" : mult > 1 ? "(많음)" : "(표준)"}</span></span>
          <input type="range" min="0.5" max="2" step="0.05" value={mult} onChange={(e) => setMult(+e.target.value)} className="w-full accent-teal-600" /></label>
        <label className="block"><span className="mb-1 flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400"><span>전기요금 ₱/kWh</span></span>
          <input type="number" step="0.1" value={rate} onChange={(e) => setRate(+e.target.value || 0)} className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100 outline-none focus:border-teal-400" /></label>
      </div>
      <div className="flex flex-col justify-center gap-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-4">
        <div className="flex items-baseline justify-between"><span className="text-[12px] text-gray-500 dark:text-gray-400">월 예상 소비전력</span><span className="text-[15px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{Math.round(kwh)} kWh</span></div>
        <div className="flex items-baseline justify-between border-t border-gray-100 dark:border-gray-800 pt-2.5"><span className="text-[12px] text-gray-500 dark:text-gray-400">월 전기요금</span><span className="text-[24px] font-extrabold tabular-nums text-teal-700 dark:text-teal-300">₱{mo.toLocaleString()}</span></div>
        <div className="flex items-baseline justify-between"><span className="text-[12px] text-gray-500 dark:text-gray-400">연 전기요금</span><span className="text-[15px] font-bold tabular-nums text-gray-800 dark:text-gray-100">₱{yr.toLocaleString()}</span></div>
        {lgMo != null && !/^lg$/i.test(pick.name) && <div className="mt-1 rounded-lg bg-teal-50 dark:bg-teal-500/10 px-3 py-2 text-[12px] leading-relaxed text-teal-800 dark:text-teal-200">같은 사용조건에서 <b>LG</b>로 바꾸면 월 <b>₱{Math.abs(mo - lgMo).toLocaleString()}</b>, 연 <b>₱{Math.abs(saveYr!).toLocaleString()}</b> {saveYr! > 0 ? "절감" : "더 듦"} · 고효율 소구 포인트</div>}
        {/^lg$/i.test(pick.name) && <div className="mt-1 text-[11px] text-gray-400">LG 모델 기준 · 다른 브랜드 선택 시 LG 절감액 비교</div>}
      </div>
    </div>
  )
}

// 스크롤로 화면에 들어올 때 애니메이션 재생 — 마운트 시 한 번만 재생돼 놓치는 문제 해소.
// 안전장치: IO 미지원 시 즉시 on, 1.5s 내 미발화 시 강제 on → 콘텐츠가 영구히 숨겨지지 않음.
function useInView() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect() } }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" })
    io.observe(el)
    const t = window.setTimeout(() => setOn(true), 1500)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [])
  return [ref, on] as const
}

function Sub({ title, seg, note, idx = 0, children }: { title: string; seg?: string; note: React.ReactNode; idx?: number; children: React.ReactNode }) {
  const [ref, on] = useInView()
  return (
    <div ref={ref} className="flex h-full flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animation: on ? "fadeUp .5s cubic-bezier(.16,1,.3,1) both" : undefined, animationDelay: Math.min(idx, 6) * 0.06 + "s", opacity: on ? undefined : 0 }}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        {seg && <span className="shrink-0 rounded bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-300">{seg}</span>}
      </div>
      <div key={on ? "in" : "out"} className="mt-2 flex min-h-[188px] flex-1 items-center">{on ? children : null}</div>
      <p className="mt-2 border-l-2 border-teal-300 dark:border-teal-500/40 pl-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{note}</p>
    </div>
  )
}
function HBar({ items, hiName }: { items: { name: string; v: number; n?: number }[]; hiName?: string }) {
  const [h, setH] = useState<number | null>(null)
  if (!items.length) return <div className="flex h-28 w-full items-center justify-center text-[12px] text-gray-400">데이터 부족</div>
  const max = Math.max(...items.map((i) => i.v), 1), rowH = 24, padL = 78, padR = 40, W = 360, H = items.length * rowH + 2
  const bx = (v: number) => padL + (W - padL - padR) * (v / max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }} onMouseLeave={() => setH(null)}>
      {items.map((a, i) => { const isHi = hiName && a.name.toLowerCase() === hiName.toLowerCase(), y = i * rowH, col = isHi ? TEAL : i === 0 ? "#5eead4" : "#e2e8f0", dim = h != null && h !== i
        return (
          <g key={a.name} onMouseEnter={() => setH(i)} style={{ cursor: "default", opacity: dim ? 0.4 : 1, transition: "opacity .15s" }}>
            <rect x={0} y={y} width={W} height={rowH} fill="transparent" /><title>{a.name} · {a.v.toFixed(2)}{a.n ? ` · ${a.n}개 모델` : ""}</title>
            <text x={padL - 6} y={y + rowH / 2 + 3.5} textAnchor="end" fontSize="10.5" fontWeight={isHi || h === i ? 800 : 500} className={isHi ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-500 dark:fill-gray-400"}>{a.name}</text>
            <rect x={padL} y={y + 4} width={Math.max(2, bx(a.v) - padL)} height={rowH - 9} rx="3" fill={col} className={isHi ? "" : "dark:opacity-30"} style={{ animation: "growX .55s cubic-bezier(.16,1,.3,1) both", animationDelay: (0.1 + i * 0.04) + "s", transformOrigin: `${padL}px 0` }} />
            <text x={bx(a.v) + 5} y={y + rowH / 2 + 3.5} fontSize="10.5" fontWeight={isHi || h === i ? 800 : 600} className={isHi ? "fill-teal-600 dark:fill-teal-400" : "fill-gray-600 dark:fill-gray-300"}>{a.v.toFixed(2)}{h === i && a.n ? ` (${a.n})` : ""}</text>
          </g>
        )
      })}
    </svg>
  )
}
function GroupBars({ groups, fmt = (v: number) => v.toFixed(1) }: { groups: { label: string; lg: number | null; mkt: number }[]; fmt?: (v: number) => string }) {
  const [h, setH] = useState<number | null>(null)
  if (!groups.length) return <div className="flex h-28 w-full items-center justify-center text-[12px] text-gray-400">데이터 부족</div>
  const max = Math.max(...groups.flatMap((g) => [g.lg ?? 0, g.mkt]), 1), W = 360, H = 158, B = 26, T = 14, L = 6, R = 6
  const gw = (W - L - R) / groups.length, bw = Math.min(17, gw * 0.3)
  const Y = (v: number) => T + (H - T - B) * (1 - v / max)
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }} onMouseLeave={() => setH(null)}>
        {groups.map((g, i) => { const cx = L + gw * (i + 0.5), dim = h != null && h !== i
          return (
            <g key={g.label} onMouseEnter={() => setH(i)} style={{ opacity: dim ? 0.45 : 1, transition: "opacity .15s", cursor: "default" }}>
              <rect x={cx - gw / 2} y={0} width={gw} height={H} fill="transparent" /><title>{g.label} · LG {g.lg != null ? fmt(g.lg) : "—"} · 시장 {fmt(g.mkt)}</title>
              {g.lg != null && <rect x={cx - bw - 1} y={Y(g.lg)} width={bw} height={H - B - Y(g.lg)} rx="2" fill={TEAL} style={{ animation: "growBar .55s cubic-bezier(.16,1,.3,1) both", animationDelay: (0.1 + i * 0.05) + "s", transformOrigin: `center ${H - B}px` }} />}
              <rect x={cx + 1} y={Y(g.mkt)} width={bw} height={H - B - Y(g.mkt)} rx="2" fill={GRAY} className="dark:opacity-40" style={{ animation: "growBar .55s cubic-bezier(.16,1,.3,1) both", animationDelay: (0.12 + i * 0.05) + "s", transformOrigin: `center ${H - B}px` }} />
              {g.lg != null && <text x={cx - bw / 2 - 1} y={Y(g.lg) - 3} textAnchor="middle" fontSize="8" fontWeight="700" className="fill-teal-600 dark:fill-teal-400">{fmt(g.lg)}</text>}
              <text x={cx} y={H - 13} textAnchor="middle" fontSize="8.5" className="fill-gray-500 dark:fill-gray-400">{g.label.replace(/급|\(.*\)/g, "")}</text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10px]"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: TEAL }} />LG</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />시장평균</span></div>
    </div>
  )
}

// 산점도 — 효율(X, 높을수록 우측=좋음) vs 월전력(Y, 낮을수록 상단=좋음). LG 강조, 사분면 가이드·격자
function Scatter({ pts, metric }: { pts: { name: string; eff: number; kwh: number; isLG: boolean; n?: number }[]; metric: string }) {
  const [h, setH] = useState<number | null>(null)
  if (pts.length < 2) return <div className="flex h-full min-h-[200px] w-full items-center justify-center text-[12px] text-gray-400">데이터 부족</div>
  const W = 340, H = 250, L = 40, R = 14, T = 16, B = 30
  const exs = pts.map((p) => p.eff), kys = pts.map((p) => p.kwh)
  const pad = (lo: number, hi: number) => { const d = (hi - lo) * 0.12 || 1; return [lo - d, hi + d] as const }
  const [ex0, ex1] = pad(Math.min(...exs), Math.max(...exs)), [ky0, ky1] = pad(Math.min(...kys), Math.max(...kys))
  const X = (v: number) => L + (W - L - R) * ((v - ex0) / ((ex1 - ex0) || 1))
  const Y = (v: number) => T + (H - T - B) * ((v - ky0) / ((ky1 - ky0) || 1))
  const emx = (ex0 + ex1) / 2, kmy = (ky0 + ky1) / 2
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }} onMouseLeave={() => setH(null)}>
        {/* 사분면 가이드 — 우상단(고효율·저전력)=우수 */}
        <rect x={X(emx)} y={T} width={W - R - X(emx)} height={Y(kmy) - T} fill="#0d9488" opacity="0.05" />
        {[0.25, 0.5, 0.75].map((f) => <line key={"h" + f} x1={L} y1={T + (H - T - B) * f} x2={W - R} y2={T + (H - T - B) * f} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="2 3" className="dark:stroke-gray-800" />)}
        {[0.25, 0.5, 0.75].map((f) => <line key={"v" + f} x1={L + (W - L - R) * f} y1={T} x2={L + (W - L - R) * f} y2={H - B} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="2 3" className="dark:stroke-gray-800" />)}
        <line x1={L} y1={T} x2={L} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-gray-700" />
        {/* 축 눈금 */}
        <text x={L - 4} y={T + 4} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(ky0)}</text>
        <text x={L - 4} y={H - B} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(ky1)}</text>
        <text x={L} y={H - B + 11} textAnchor="middle" fontSize="8" fill="#94a3b8">{ex0.toFixed(1)}</text>
        <text x={W - R} y={H - B + 11} textAnchor="end" fontSize="8" fill="#94a3b8">{ex1.toFixed(1)}</text>
        <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b">효율({metric}) → 높을수록 우수</text>
        <text x={11} y={(T + H - B) / 2} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#64748b" transform={`rotate(-90 11 ${(T + H - B) / 2})`}>월전력 ↓ 낮을수록 우수</text>
        <text x={W - R - 2} y={T + 9} textAnchor="end" fontSize="7.5" fontWeight="700" className="fill-teal-600/70 dark:fill-teal-400/60">우수 구간</text>
        {pts.map((p, i) => (
          <g key={p.name} onMouseEnter={() => setH(i)} style={{ cursor: "default" }} opacity={h == null || h === i || p.isLG ? 1 : 0.45}>
            <title>{p.name} · {metric} {p.eff.toFixed(2)} · {Math.round(p.kwh)}kWh/월{p.n ? ` · ${p.n}모델` : ""}</title>
            <circle cx={X(p.eff)} cy={Y(p.kwh)} r={p.isLG ? 7 : 5} fill={p.isLG ? TEAL : "#94a3b8"} stroke={p.isLG ? "#fff" : "#fff"} strokeWidth={p.isLG ? 1.6 : 0.8} className={p.isLG ? "" : "dark:fill-gray-500"} style={{ animation: "fadeIn .5s ease both", animationDelay: i * 0.03 + "s", transition: "opacity .15s" }} />
            {(p.isLG || h === i) && <text x={X(p.eff)} y={Y(p.kwh) - 10} textAnchor="middle" fontSize="9.5" fontWeight="800" className={p.isLG ? "fill-teal-700 dark:fill-teal-300" : "fill-gray-600 dark:fill-gray-200"}>{p.name}</text>}
          </g>
        ))}
      </svg>
      <div className="mt-1 text-[10px] text-gray-400"><span className="font-semibold text-teal-600 dark:text-teal-400">● LG</span> · 우측·상단(음영)일수록 고효율·저전력</div>
    </div>
  )
}
const avgOf = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null

// LG 커버리지 매트릭스 — 설치형(행) × 용량(열). 셀=LG 모델수, 색농도=LG 평균효율. LG 라인업 전모를 한 화면에.
type Cell = { lgN: number; lgEff: number | null; mktN: number; mktEff: number | null }
function Heatmap({ rowLabels, colLabels, cells, metric, effLo, effHi }: { rowLabels: string[]; colLabels: string[]; cells: Record<string, Cell>; metric: string; effLo: number; effHi: number }) {
  const [hov, setHov] = useState<string | null>(null)
  if (!rowLabels.length) return <div className="flex h-40 w-full items-center justify-center text-[12px] text-gray-400">데이터 부족</div>
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
                <div key={c} onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)} title={cell ? `${r} · ${c}\nLG ${cell.lgN}개 (${cell.lgEff != null ? metric + " " + cell.lgEff.toFixed(2) : "—"})\n시장 ${cell.mktN}개 (${cell.mktEff != null ? cell.mktEff.toFixed(2) : "—"})` : `${r} · ${c} · LG 0개`}
                  className="relative flex aspect-[1.6/1] min-h-[34px] items-center justify-center rounded-md text-[13px] font-bold transition-all"
                  style={{ background: has ? `rgba(13,148,136,${op})` : "var(--hm-empty)", color: has && op > 0.55 ? "#fff" : has ? "#0f766e" : "#cbd5e1", outline: hov === id ? "2px solid #0d9488" : "none", animation: "fadeIn .45s ease both", animationDelay: (ri * colLabels.length + ci) * 0.02 + "s" }}>
                  {has ? cell.lgN : "·"}
                  {has && cell.mktN > 0 && <span className="absolute bottom-0.5 right-1 text-[7.5px] font-medium opacity-60">/{cell.mktN}</span>}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <style>{":root{--hm-empty:#f1f5f9}.dark{--hm-empty:#1e293b}"}</style>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-gray-400">
        <span className="font-semibold text-gray-500 dark:text-gray-400">숫자=LG 모델수 · /뒤=시장 총모델</span>
        <span className="inline-flex items-center gap-1">색농도 {metric} 낮음<span className="h-2.5 w-16 rounded" style={{ background: "linear-gradient(90deg,rgba(13,148,136,.12),rgba(13,148,136,1))" }} />높음</span>
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
  const [rate, setRate] = useState(14.83) // Meralco 가정용 ₱/kWh(실측 로드 전 기본값)
  const [rateAsOf, setRateAsOf] = useState("")
  const [open, setOpen] = useState(false)
  const [simOpen, setSimOpen] = useState(false)
  useEffect(() => {
    energyLabels().then((r) => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true))
    latestMacro(["meralco_residential_rate"]).then((m) => { const r = m.meralco_residential_rate; if (r) { setRate(r.value); setRateAsOf(r.date.slice(2, 4) + "." + Number(r.date.slice(5, 7))) } }).catch(() => {})
  }, [])

  const cur = CATS.find((c) => c.key === cat)!
  const segs = SEG[cat] || []
  const hasType = cat === "acu" || cat === "ref"
  const catRows = useMemo(() => rows.filter((r) => r.category === cat && r.brand && r.eff != null && r.eff > 0), [rows, cat])
  const types = useMemo(() => hasType ? Array.from(new Set(catRows.map((r) => typeOf(cat, r.stype)))).filter((t) => t !== "기타") : [], [catRows, hasType, cat])
  useEffect(() => { setTyp("전체"); setSegIdx(0) }, [cat])
  const byType = (r: EnergyRow) => typ === "전체" || typeOf(cat, r.stype) === typ
  const inSeg = (r: EnergyRow, s: { lo: number; hi: number }) => r.spec != null && r.spec >= s.lo && r.spec < s.hi
  const segCounts = useMemo(() => segs.map((s) => catRows.filter((r) => byType(r) && inSeg(r, s)).length), [catRows, segs, typ])
  useEffect(() => { if (!segCounts.length) return; const b = segCounts.indexOf(Math.max(...segCounts)); if ((segCounts[segIdx] || 0) < 3 && b >= 0) setSegIdx(b) }, [typ, loaded]) // eslint-disable-line
  const seg = segs[segIdx] || segs[0]
  const segRows = useMemo(() => catRows.filter((r) => byType(r) && seg && inSeg(r, seg)), [catRows, seg, typ])

  const rank = useMemo(() => {
    const by: Record<string, number[]> = {}; for (const r of segRows) (by[r.brand] = by[r.brand] || []).push(r.eff!)
    return Object.entries(by).map(([name, a]) => ({ name, v: avgOf(a)!, n: a.length })).filter((x) => x.n >= 2).sort((a, b) => b.v - a.v).slice(0, 8)
  }, [segRows])
  const lgR = rank.find((r) => /^lg$/i.test(r.name)); const lgRk = lgR ? rank.indexOf(lgR) + 1 : 0
  const gap = lgR && rank[0] ? ((rank[0].v - lgR.v) / lgR.v) * 100 : null

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

  // TCO — 선택 세그먼트 LG vs 리더 vs 평균 월 전기요금(₱)
  const tco = useMemo(() => {
    const kwhAll = segRows.map((r) => r.kwh).filter((v): v is number => v != null && v > 0)
    const lgK = segRows.filter((r) => /^lg$/i.test(r.brand)).map((r) => r.kwh).filter((v): v is number => v != null && v > 0)
    // 리더(효율 1위 브랜드)
    const leadName = rank[0]?.name
    const ldK = leadName ? segRows.filter((r) => r.brand === leadName).map((r) => r.kwh).filter((v): v is number => v != null && v > 0) : []
    const g = [
      { label: "LG", kwh: avgOf(lgK) },
      { label: leadName || "리더", kwh: avgOf(ldK) },
      { label: "시장평균", kwh: avgOf(kwhAll) },
    ].filter((x) => x.kwh != null)
    return g.map((x) => ({ label: x.label, cost: Math.round((x.kwh as number) * rate) }))
  }, [segRows, rank, rate])

  const grade = useMemo(() => {
    const by: Record<string, EnergyRow[]> = {}; for (const r of segRows) (by[r.brand] = by[r.brand] || []).push(r)
    return Object.entries(by).map(([name, a]) => { const st = a.filter((r) => r.star != null); const p = (f: (s: number) => boolean) => st.length ? st.filter((r) => f(r.star ?? 0)).length / st.length * 100 : 0; return { name, n: a.length, s5: p((s) => s >= 5), s4: p((s) => s === 4), s3: p((s) => s <= 3) } }).filter((x) => x.n >= 3).sort((a, b) => b.s5 - a.s5).slice(0, 6)
  }, [segRows])

  // LG 강·약 세그먼트(분석 요약)
  const simBrands = useMemo(() => { const by: Record<string, number[]> = {}; for (const r of segRows) if (r.kwh != null && r.kwh > 0) (by[r.brand] = by[r.brand] || []).push(r.kwh); return Object.entries(by).map(([name, a]) => ({ name, kwh: avgOf(a)! })).filter((x) => x.kwh > 0).sort((a, b) => a.kwh - b.kwh) }, [segRows])
  const lgKwh = simBrands.find((b) => /^lg$/i.test(b.name))?.kwh ?? null
  const lgSegPos = useMemo(() => bySegChart.map((g) => ({ label: g.label, diff: g.lg != null ? g.lg - g.mkt : null })).filter((x) => x.diff != null) as { label: string; diff: number }[], [bySegChart])
  const strong = [...lgSegPos].sort((a, b) => b.diff - a.diff)[0]
  const weak = [...lgSegPos].sort((a, b) => a.diff - b.diff)[0]
  const lgGrade = grade.find((g) => /^lg$/i.test(g.name))

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes growBar{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}"}</style>

      <div className="overflow-hidden rounded-xl border border-teal-100 dark:border-teal-500/25 bg-gradient-to-r from-teal-50 dark:from-teal-500/10 via-teal-50/40 dark:via-transparent to-white dark:to-gray-900 shadow-sm" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both" }}>
        <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer select-none items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg></div>
          <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700 dark:text-gray-200">{loaded && lgR && rank[0] ? <><b className="font-semibold text-gray-900 dark:text-gray-50">에너지 효율 · {cur.label} {typ !== "전체" ? typ + " " : ""}{seg?.k}</b> — LG {lgRk}위/{rank.length}개사, 리더 {rank[0].name}({rank[0].v.toFixed(2)}) 대비 {gap != null ? gap.toFixed(0) : "—"}% 낮음 · 같은 스펙 비교</> : <><b className="font-semibold text-gray-900 dark:text-gray-50">에너지 효율</b> — DOE 라벨 세그먼트별 브랜드 {cur.metric} 분석</>}</div>
          {loaded && lgR && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-teal-500 dark:text-teal-300 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>}
        </div>
        {loaded && lgR && (
          <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
            <div className="overflow-hidden"><div className="border-t border-teal-100/70 dark:border-teal-500/25 px-4 pb-3.5 pt-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">LG {cur.label} 효율 경쟁력 진단 — {typ !== "전체" ? typ + " · " : ""}{seg?.k}</div>
              <ul className="space-y-1 text-[12px] leading-relaxed text-gray-700 dark:text-gray-200">
                <li>• <b>포지션</b>: 이 세그먼트 {rank.length}개사 중 <b className="text-teal-700 dark:text-teal-300">{lgRk}위</b>({cur.metric} {lgR.v.toFixed(2)}), 리더 {rank[0]?.name} 대비 {gap != null ? gap.toFixed(0) : "—"}% {gap != null && gap > 0 ? "낮음" : "높음"}.</li>
                {strong && weak && <li>• <b>용량대 강·약</b>: <b className="text-emerald-600 dark:text-emerald-400">{strong.label}</b> 시장평균 +{strong.diff.toFixed(2)} 강세, <b className="text-rose-600 dark:text-rose-400">{weak.label}</b> {weak.diff.toFixed(2)} 열세 → 차기 개발 우선순위.</li>}
                {lgGrade && <li>• <b>등급 믹스</b>: LG 5성 {lgGrade.s5.toFixed(0)}%(4성 {lgGrade.s4.toFixed(0)}%) — {lgGrade.s5 >= 60 ? "프리미엄 효율 라인 견고" : "5성 확대 여지"}.</li>}
                {tco.length >= 2 && tco[0].label === "LG" && <li>• <b>전력비용(TCO)</b>: LG 월 약 <b>₱{tco[0].cost.toLocaleString()}</b>, 리더 대비 {tco[1] ? (tco[0].cost - tco[1].cost > 0 ? `₱${(tco[0].cost - tco[1].cost).toLocaleString()} 높음(효율 개선 시 절감 소구)` : `₱${(tco[1].cost - tco[0].cost).toLocaleString()} 낮음(절감 마케팅 가능)`) : "—"}.</li>}
              </ul>
            </div></div>
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both" }}>
          <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-teal-500" />
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">에너지 효율</h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">DOE 라벨 · 같은 {cur.specUnit} 세그먼트 내 {cur.metric} 분석</span>
            <span className="ml-auto"><Segmented size="sm" value={cat} onChange={setCat} options={CATS.map((c) => ({ k: c.key, label: c.label }))} /></span>
          </header>

          <div className="mb-3.5 flex flex-col gap-2">
            {hasType && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 w-9 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">설치</span>
                {["전체", ...types].map((t) => <button key={t} onClick={() => setTyp(t)} className={"rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all " + (typ === t ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-500/15")}>{t}</button>)}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 w-9 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{cur.specUnit.slice(0, 2)}</span>
              {segs.map((s, i) => <button key={s.k} onClick={() => setSegIdx(i)} disabled={(segCounts[i] || 0) < 3} className={"rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all disabled:opacity-25 " + (segIdx === i ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200")}>{s.k}<span className="ml-1 text-[10px] opacity-60">{segCounts[i]}</span></button>)}
            </div>
          </div>


          {!loaded ? (
            <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" />)}</div>
          ) : (
            <>
            {/* LG 커버리지 매트릭스 — 카테고리 전체(필터 무관). 잠시 숨김(false) — 복원 시 true로. */}
            {false && (
            <div key={"cov-" + cat} className="mb-4 flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both" }}>
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">LG {cur.label} 라인업 커버리지</h3>
                <span className="shrink-0 rounded bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-300">전체 {coverage.lgTotal}개 모델</span>
                <span className="ml-auto text-[10.5px] text-gray-400 dark:text-gray-500">설치형 × 용량 · 색=효율</span>
              </div>
              <Heatmap rowLabels={coverage.rowLabels} colLabels={coverage.colLabels} cells={coverage.cells} metric={cur.metric} effLo={coverage.effLo} effHi={coverage.effHi} />
              <p className="mt-2.5 border-l-2 border-teal-300 dark:border-teal-500/40 pl-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">LG는 <b>{coverage.lgTotal}개</b> 모델을 {coverage.rowLabels.length}개 설치형·{coverage.colLabels.length}개 용량대에 걸쳐 등록. <b>빈 셀=미출시 공백</b>(진입 기회), 색이 옅은 셀=효율 열세(개선 타깃).</p>
            </div>
            )}
            <div key={`seg-${typ}-${segIdx}`} className="grid items-stretch gap-4 sm:grid-cols-2">
              <Sub idx={0} title="브랜드 효율 랭킹" seg={`${typ !== "전체" ? typ + " " : ""}${seg?.k}`} note={lgR ? <>같은 스펙 내 평균 {cur.metric}. LG {lgRk}위·리더 대비 {gap != null ? gap.toFixed(0) : "—"}% {gap != null && gap > 0 ? "낮아 최고효율 격차가 곧 개발 타깃" : "높아 프리미엄 소구 가능"}. 막대 hover 시 모델수.</> : <><b>LG는 이 세그먼트에 등록 모델 없음</b>(현지 미출시) — 시장 브랜드만 비교. 진입 검토 시 벤치마크로 활용.</>}><HBar items={rank} hiName="LG" /></Sub>
              <Sub idx={1} title="효율 ↔ 월전력 관계" seg={seg?.k} note={<>가로=효율({cur.metric}), 세로=월 소비전력. <b>우측·상단</b>이 고효율·저전력(우수). LG 점 위치로 <b>효율 대비 실제 전력소비</b> 경쟁력 확인.</>}><Scatter pts={scatterData} metric={cur.metric} /></Sub>
              <Sub idx={2} title="용량대별 LG vs 시장" note={<>용량 세그먼트별 평균 {cur.metric}. {weak ? <>LG는 <b className="text-rose-600 dark:text-rose-400">{weak.label}</b>에서 시장 대비 열세 — 차기 라인업의 효율 스펙 상향 1순위.</> : "세그먼트별 LG 포지션."}</>}><GroupBars groups={bySegChart} /></Sub>
              <Sub idx={3} title="월 전기요금 (TCO)" seg={seg?.k} note={<>평균 월 소비전력×가정용 전기료(Meralco ₱{rate.toFixed(1)}/kWh{rateAsOf?" · "+rateAsOf:""}) 추정. 효율이 높을수록 전기요금↓ — <b>에너지 절감액을 판매 메시지로 전환</b>(고효율 프리미엄 정당화).</>}>
                <div className="w-full">{tco.length === 0 ? <div className="flex h-28 items-center justify-center text-[12px] text-gray-400">데이터 부족</div> : (() => {
                  const mx = Math.max(...tco.map((t) => t.cost), 1)
                  return <div className="flex flex-col gap-2">{tco.map((t, i) => { const isLG = t.label === "LG"; return (
                    <div key={t.label} className="flex items-center gap-2">
                      <span className={"w-14 shrink-0 truncate text-right text-[11px] " + (isLG ? "font-bold text-teal-600 dark:text-teal-400" : "text-gray-500 dark:text-gray-400")}>{t.label}</span>
                      <span className="h-4 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800"><span className="block h-full rounded" style={{ width: (t.cost / mx * 100) + "%", background: isLG ? TEAL : GRAY, animation: "growX .5s ease both", animationDelay: (0.1 + i * 0.05) + "s", transformOrigin: "left" }} /></span>
                      <span className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">₱{t.cost.toLocaleString()}</span>
                    </div>
                  ) })}<span className="mt-0.5 text-[9.5px] text-gray-400">월 추정 · 낮을수록 유리</span></div>
                })()}</div>
              </Sub>
              <Sub idx={4} title="브랜드 등급 분포(별점)" seg={seg?.k} note="라인업의 5·4·3성↓ 구성. 소형 니치는 5성 100%가 흔하므로 모델수와 함께 해석.">
                <div className="w-full">{grade.length === 0 ? <div className="flex h-28 items-center justify-center text-[12px] text-gray-400">데이터 부족</div> : (
                  <div className="flex flex-col gap-1.5">
                    {grade.map((g, i) => { const isLG = /^lg$/i.test(g.name); return (
                      <div key={g.name} className="flex items-center gap-2" title={`${g.name} · 5성 ${g.s5.toFixed(0)}% · 4성 ${g.s4.toFixed(0)}% · 3성↓ ${g.s3.toFixed(0)}% · ${g.n}모델`}>
                        <span className={"w-[54px] shrink-0 truncate text-right text-[10.5px] " + (isLG ? "font-bold text-teal-600 dark:text-teal-400" : "text-gray-500 dark:text-gray-400")}>{g.name}</span>
                        <span className="flex h-3 flex-1 overflow-hidden rounded"><span style={{ width: g.s5 + "%", background: "#10b981", animation: "growX .5s ease both", animationDelay: (0.1 + i * 0.04) + "s", transformOrigin: "left" }} /><span style={{ width: g.s4 + "%", background: AMBER }} /><span className="bg-gray-300 dark:bg-gray-600" style={{ width: g.s3 + "%" }} /></span>
                        <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{g.s5.toFixed(0)}%</span>
                      </div>
                    ) })}
                    <div className="mt-0.5 flex items-center gap-3 text-[9.5px] text-gray-400"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />5성</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: AMBER }} />4성</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />3성↓</span></div>
                  </div>
                )}</div>
              </Sub>
              {cat === "acu" && refrigMix.mkt.tot > 0 && (() => {
                const RC: Record<string, string> = { R32: "#10b981", R290: "#0d9488", R600a: "#22c55e", R410A: "#dc2626", R134a: "#f59e0b" }
                const lgR32 = refrigMix.lg.tot ? (refrigMix.lg.m.R32 || 0) / refrigMix.lg.tot * 100 : null
                const Bar = ({ t, m }: { t: number; m: Record<string, number> }) => <span className="flex h-4 flex-1 overflow-hidden rounded">{refrigMix.keys.map((k, i) => { const w = t ? (m[k] || 0) / t * 100 : 0; if (!w) return null; return <span key={k} title={`${k} ${w.toFixed(0)}%`} style={{ width: w + "%", background: RC[k] || "#94a3b8", animation: "growX .5s ease both", animationDelay: (0.1 + i * 0.05) + "s", transformOrigin: "left" }} /> })}</span>
                return (
                  <Sub idx={5} title="냉매 믹스 (환경·GWP)" seg={seg?.k} note={<>저GWP 냉매(R32·R290) 비중 = 환경규제 대응력. LG R32 {lgR32 != null ? <b>{lgR32.toFixed(0)}%</b> : "—"} — <b>친환경 냉매 소구</b>는 유럽·규제강화 시장의 프리미엄 근거.</>}>
                    <div className="flex w-full flex-col gap-2.5">
                      <div className="flex items-center gap-2"><span className="w-12 shrink-0 text-right text-[11px] font-bold text-teal-600 dark:text-teal-400">LG</span>{refrigMix.lg.tot ? <Bar t={refrigMix.lg.tot} m={refrigMix.lg.m} /> : <span className="flex-1 text-[10px] text-gray-400">데이터 없음</span>}</div>
                      <div className="flex items-center gap-2"><span className="w-12 shrink-0 text-right text-[11px] text-gray-500 dark:text-gray-400">시장</span><Bar t={refrigMix.mkt.tot} m={refrigMix.mkt.m} /></div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9.5px] text-gray-400">{refrigMix.keys.slice(0, 5).map((k) => <span key={k} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: RC[k] || "#94a3b8" }} />{k}</span>)}<span className="text-gray-400">· 녹색=저GWP</span></div>
                    </div>
                  </Sub>
                )
              })()}
            </div>
            <button type="button" onClick={() => setSimOpen(true)} className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/10 px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both", animationDelay: ".3s" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h8M8 14h3" /></svg></span>
              <span className="flex-1"><span className="block text-[13.5px] font-bold text-gray-900 dark:text-gray-50">전기요금 계산기 열기</span><span className="block text-[11px] text-gray-500 dark:text-gray-400">브랜드·사용강도·요금 조정 → 월/연 전기요금·LG 절감액</span></span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-teal-500"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            </>
          )}
        </section>
        <aside className="flex flex-col gap-4"><AgendaCard /></aside>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">출처 필리핀 DOE 에너지효율 라벨 등록 데이터(공식) · 설치형·용량 세그먼트별 브랜드 평균 {cur.metric}(높을수록 고효율) · TCO=DOE 라벨 월소비전력×Meralco 가정용 요금(₱{rate.toFixed(1)}/kWh) 추정 · 전체 평균은 스펙 혼합 왜곡</p>

      {simOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" style={{ animation: "fadeIn .2s ease both" }} onClick={() => setSimOpen(false)}>
          <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl" style={{ animation: "fadeUp .3s cubic-bezier(.16,1,.3,1) both" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 bg-teal-50/60 dark:bg-teal-500/10 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h8M8 14h3" /></svg></span>
              <div className="flex-1"><div className="text-[14px] font-bold text-gray-900 dark:text-gray-50">전기요금 계산기</div><div className="text-[11px] text-gray-500 dark:text-gray-400">{cur.label} {typ !== "전체" ? typ + " " : ""}{seg?.k} · DOE 표준 월소비전력 기반</div></div>
              <button type="button" onClick={() => setSimOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
            </div>
            <div className="p-4"><EnergySim brands={simBrands} lgKwh={lgKwh} rate0={rate} /></div>
          </div>
        </div>
      )}
    </div>
  )
}
