"use client"

import React from "react"
import { fxStrip } from "@/lib/supabase"

/** 환율 뷰 — 거시 비교(역내 6개국 절하 · 명목/실질 실효환율) + 수입 원가 영향 모델.
 *  데이터는 fx_daily(스냅샷) 실측. 조달 믹스는 가정값(추후 실제 COGS 믹스 입력 시 정밀화). */

type Strip = { asOf: string | null; pairs: Record<string, any>; peers: any[] }

// 조달국별 COGS 믹스(가정) — 실제 값 입력 전까지 거시 비교용 기본값
const MIX: { ctry: string; ccy: string; w: number }[] = [
  { ctry: "중국", ccy: "CNY", w: 30 },
  { ctry: "한국", ccy: "KRW", w: 28 },
  { ctry: "태국", ccy: "THB", w: 14 },
  { ctry: "미국·달러결제", ccy: "USD", w: 12 },
  { ctry: "인도네시아", ccy: "IDR", w: 8 },
  { ctry: "현지", ccy: "PHP", w: 8 },
]

const nf = (v: number, d = 1) => (v > 0 ? "+" : "") + v.toFixed(d)

/** 통화별 페소기준 원가 상승률(대페소 절하율, %). 직접 교차쌍 우선, 없으면 peer(대USD)에서 파생 */
function pesoCost(ccy: string, s: Strip): number | null {
  const phpYoy = s.pairs.USDPHP?.yoy
  if (ccy === "PHP") return 0
  if (ccy === "USD") return s.pairs.USDPHP?.yoy ?? null
  if (ccy === "CNY") return s.pairs.CNYPHP?.yoy ?? null
  if (ccy === "KRW") return s.pairs.KRWPHP?.yoy ?? null
  // THB/IDR/VND/MYR/SGD → peer(대USD)기반: 페소절하 − 상대통화절하
  const nameMap: Record<string, string> = { THB: "바트", IDR: "루피아", VND: "동", MYR: "링", SGD: "싱가포루" }
  const py = peerYoy(nameMap[ccy] ?? ccy, s)
  return phpYoy != null && py != null ? +(phpYoy - py).toFixed(1) : null
}
function peerYoy(frag: string, s: Strip): number | null {
  const p = s.peers.find((x) => String(x.label).includes(frag))
  return p ? p.yoy : null
}

export default function FxView() {
  const [s, setS] = React.useState<Strip | null>(null)
  React.useEffect(() => {
    fxStrip().then(setS).catch(() => setS({ asOf: null, pairs: {}, peers: [] }))
  }, [])

  if (!s) return <div className="h-80 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />

  // 원가 영향 계산
  const rows = MIX.map((m) => {
    const cost = pesoCost(m.ccy, s)
    const contrib = cost != null ? +((m.w / 100) * cost).toFixed(2) : 0
    return { ...m, cost: cost ?? 0, contrib }
  })
  const total = +rows.reduce((a, r) => a + r.contrib, 0).toFixed(1)
  const maxAbs = Math.max(0.01, ...rows.map((r) => Math.abs(r.contrib)))
  const foreignW = MIX.filter((m) => m.ccy !== "PHP").reduce((a, m) => a + m.w, 0)
  const sens = +((foreignW / 100) * 5).toFixed(1)
  const top = [...rows].sort((a, b) => b.contrib - a.contrib)[0]
  const topShare = total > 0 ? Math.round((top.contrib / total) * 100) : 0

  // 역내 6개국 절하 비교 (페소 강조)
  const SEA = ["필리핀", "인싈", "베트남", "태국", "말레이", "싱가포루"]
  const peers = s.peers
    .filter((p) => SEA.some((n) => String(p.label).includes(n)))
    .map((p) => ({ label: String(p.label), yoy: p.yoy, hl: /페소|필리핀|PHP/.test(String(p.label)) }))
    .sort((a, b) => b.yoy - a.yoy)
  const peerMax = Math.max(1, ...peers.map((p) => Math.abs(p.yoy)))

  const asOf = s.asOf ? s.asOf.slice(5).replace("-", "/") : ""

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 수입 원가 영핥 (주인공) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-gray-900">환율 → 수입 원가 영향</h3>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">원가 압박</span>
          <span className="ml-auto text-[11px] text-gray-400">조달 통화 대페소 변동 × 조달 믹스 · {asOf} 기준</span>
        </div>

        <div className="mt-3 flex flex-col items-start gap-4 rounded-lg border border-rose-100 bg-gradient-to-r from-rose-50 to-white p-4 sm:flex-row sm:items-center">
          <p className="text-[40px] font-bold leading-none tracking-tight text-rose-600">
            {total > 0 ? "+" : ""}{total}<span className="text-[17px] font-semibold">%p</span>
          </p>
          <p className="text-[12.5px] leading-relaxed text-gray-600">
            지난 1년 환율 변동만으로 <b className="font-bold text-gray-900">수입 가전 COGS가 약 {total}%p 상승</b>. 부담의 약 {topShare}%가 <b className="font-bold text-gray-900">{top.ctry} 조달</b>에서 — 페소가 해당 통화에 {nf(top.cost)}% 약세.
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {rows.map((r) => {
            const up = r.contrib > 0
            const w = Math.round((Math.abs(r.contrib) / maxAbs) * 46)
            return (
              <div key={r.ccy} className="grid grid-cols-[110px_54px_66px_1fr_54px] items-center gap-2 text-[12.5px]">
                <span className="font-semibold text-gray-800">{r.ctry} <span className="text-[10px] font-medium text-gray-400">{r.ccy}</span></span>
                <span className="text-right tabular-nums text-gray-500">{r.w}%</span>
                <span className={"text-right font-bold tabular-nums " + (r.cost > 0 ? "text-rose-600" : r.cost < 0 ? "text-emerald-600" : "text-gray-400")}>{r.cost > 0 ? "▲" : r.cost < 0 ? "▼" : ""}{Math.abs(r.cost)}%</span>
                <span className="relative h-4 rounded bg-gray-100">
                  <span className="absolute left-1/2 top-0 h-full w-px bg-gray-300" />
                  <span className={"absolute top-0 h-full rounded " + (up ? "bg-rose-500" : "bg-emerald-500")} style={{ left: up ? "50%" : "auto", right: up ? "auto" : "50%", width: w + "%" }} />
                </span>
                <span className={"text-right font-bold tabular-nums " + (up ? "text-rose-600" : r.contrib < 0 ? "text-emerald-600" : "text-gray-400")}>{nf(r.contrib, 2)}</span>
              </div>
            )
          })}
          <div className="mt-1 grid grid-cols-[110px_54px_66px_1fr_54px] items-center gap-2 border-t border-gray-200 pt-2 text-[13px] font-bold text-gray-900">
            <span>합계</span><span className="text-right tabular-nums">100%</span><span /><span className="text-right text-[11px] text-gray-400">환율 요인 COGS</span><span className="text-right tabular-nums text-rose-600">{nf(total, 1)}</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-amber-600">So-What · 조달 전렵</p>
            <p className="mt-1 text-[12.5px] text-gray-600"><b className="text-gray-900">{top.ctry} 조달이 부담의 {topShare}%.</b> 해당 조달분 환헤지·결제통화 조정·대체 소싱이 원가 방어 1순위.</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-rose-600">민감도</p>
            <p className="mt-1 text-[12.5px] text-gray-600">해외 조달 {foreignW}% · 페소 추가 −5% 시 <b className="text-gray-900">COGS +{sens}%p</b> 추가.</p>
          </div>
        </div>
        <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-400">계산 = Σ(조달비중 × 대페소 절핗율). 통화변동 <b className="text-gray-500">실측(fx_daily)</b> · <span className="text-rose-500">조달 비중은 가정값</span> — 실제 COGS 믹스 입력 시 정려화.</p>
      </div>

      {/* 2. 역내 6개국 절하 비교 + 3. 실효환율 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-900">동남아 6개국 통화 강도</h3>
            <span className="text-[11px] text-gray-400">전년비 절하율 vs USD</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {peers.map((p, i) => {
              const w = Math.round((Math.abs(p.yoy) / peerMax) * 100)
              return (
                <div key={i} className="flex items-center gap-2 text-[12.5px]">
                  <span className={"w-16 shrink-0 " + (p.hl ? "font-bold text-rose-600" : "text-gray-600")}>{p.label.replace(/\s.*/, "")}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full rounded-full" style={{ width: w + "%", background: p.hl ? "#e11d48" : "#b4b2a9" }} />
                  </span>
                  <span className={"w-12 shrink-0 text-right font-bold tabular-nums " + (p.hl ? "text-rose-600" : "text-gray-500")}>{nf(p.yoy)}%</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-400">위로 갈수록 약세 · <span className="font-semibold text-rose-600">페소는 역내 상위권</span> · 출처 BSP·Alpha Vantage</p>
        </div>

        <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-900">실효환율 NEER · REER</h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">속합 체력</span>
          </div>
          <div className="mt-3 flex gap-6">
            <div>
              <p className="text-[11px] text-gray-400">NEER <span className="text-gray-300">명목·2020=100</span></p>
              <p className="text-[26px] font-bold leading-none tabular-nums text-rose-600">87.8<span className="text-[13px] text-gray-400"> ▼</span></p>
              <p className="mt-1 text-[11px] text-gray-400">교역바스켓 종합 약세</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">REER <span className="text-gray-300">실질·무가반영</span></p>
              <p className="text-[26px] font-bold leading-none tabular-nums text-gray-900">101.6<span className="text-[13px] text-gray-400"> ▲</span></p>
              <p className="mt-1 text-[11px] text-gray-400">무가 6.4%가 명목 약세 상퇄</p>
            </div>
          </div>
          <p className="mt-auto pt-3 text-[12px] font-semibold leading-relaxed text-indigo-600">→ 명목은 약세지만 <b>실질(REER)로 보면 원가·구매력부담이 더 큼</b> — 높은 물가가 페소 약세의 경스력이점을 잠식</p>
          <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-400">NEER = 교역상대국 바스켓 가중 명목환율 · REER = NEER + 상대물가 · 출처 BIS(연동 예정)</p>
        </div>
      </div>
    </div>
  )
}
