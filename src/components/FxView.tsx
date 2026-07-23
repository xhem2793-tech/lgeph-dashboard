"use client"

import React from "react"
import { fxStrip } from "@/lib/supabase"

/** 환율 뷰 — ECOS형 차트 우선. 슬림 진단 배너 + 2×2 리치 라인차트(역내 6개국·페소/달러+NEER·위안/루피·REER)
 *  + 우측 레일(이달의 환율 핵심·연결) + 수입 원가 영향 모델(실측 fx_daily). 시계열은 데모(실측 연동 예정). */

type Strip = { asOf: string | null; pairs: Record<string, any>; peers: any[] }
const nf = (v: number, d = 1) => (v > 0 ? "+" : "") + v.toFixed(d)

const X = ["25.7", "25.9", "25.11", "26.1", "26.3", "26.5", "26.7"]
type Cfg = { yL: [number, number]; yR?: [number, number]; series: { c: string; w?: number; axis?: string; d: number[] }[] }
const CFG: Record<string, Cfg> = {
  region: { yL: [90, 101], series: [
    { c: "#4f46e5", w: 3.2, d: [100, 99.3, 98.4, 97.0, 95.5, 93.5, 92.0] },
    { c: "#dc2626", d: [100, 99.5, 99.0, 98.2, 97.4, 96.5, 96.0] },
    { c: "#0284c7", d: [100, 99.7, 99.4, 99.1, 98.9, 98.6, 98.5] },
    { c: "#0f766e", d: [100, 99.8, 99.5, 99.0, 98.6, 98.2, 98.0] },
    { c: "#d99400", d: [100, 99.9, 99.7, 99.5, 99.3, 99.1, 99.0] },
    { c: "#7c3aed", d: [100, 99.9, 99.8, 99.7, 99.6, 99.5, 99.5] }] },
  neer: { yL: [56, 63], yR: [86, 94], series: [
    { c: "#2563eb", d: [57.1, 57.9, 58.9, 60, 61, 61.5, 61.7] },
    { c: "#a1795b", axis: "R", d: [92, 91.3, 90.6, 89.7, 88.9, 88.2, 87.8] }] },
  asia: { yL: [97, 106], series: [
    { c: "#dc2626", d: [100, 100.5, 101.2, 102.4, 103.6, 104.5, 105] },
    { c: "#7c3aed", d: [100, 100.3, 100.8, 101.5, 102, 102.4, 102.7] }] },
  reer: { yL: [86, 104], series: [
    { c: "#a1795b", d: [98, 98.7, 99.4, 100.2, 100.9, 101.4, 101.6] },
    { c: "#5b5bd6", d: [92, 91.3, 90.6, 89.7, 88.9, 88.2, 87.8] }] },
}

function buildSvg(cfg: Cfg): string {
  const W = 400, H = 196, padL = 32, padR = cfg.yR ? 32 : 8, padT = 10, padB = 22, iw = W - padL - padR, ih = H - padT - padB
  const [lmin, lmax] = cfg.yL
  const xr = (i: number) => padL + iw * (i / (X.length - 1))
  const yl = (v: number) => padT + ih * (1 - (v - lmin) / (lmax - lmin))
  const yr = cfg.yR ? (v: number) => padT + ih * (1 - (v - (cfg.yR as number[])[0]) / ((cfg.yR as number[])[1] - (cfg.yR as number[])[0])) : null
  let svg = ""; const T = 5
  for (let k = 0; k < T; k++) {
    const val = lmin + (lmax - lmin) * k / (T - 1), y = yl(val)
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#f1f2f5"/><text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="8.5" fill="#b6bcc6">${val.toFixed(0)}</text>`
    if (cfg.yR) { const rv = cfg.yR[0] + (cfg.yR[1] - cfg.yR[0]) * k / (T - 1); svg += `<text x="${W - padR + 5}" y="${y + 3}" text-anchor="start" font-size="8.5" fill="#cdb9a6">${rv.toFixed(0)}</text>` }
  }
  const xl = X.map((t, i) => `<text x="${xr(i)}" y="${H - 5}" text-anchor="middle" font-size="8.5" fill="#b6bcc6">${t}</text>`).join("")
  cfg.series.forEach((s, si) => {
    const f = (s.axis === "R" && yr) ? yr : yl
    const pts = s.d.map((v, i) => `${xr(i)},${f(v)}`).join(" ")
    svg += `<polyline points="${pts}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2.3}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="fxaline" style="animation-delay:${si * 0.08}s"/>`
    const lv = s.d[s.d.length - 1]
    svg += `<circle cx="${xr(X.length - 1)}" cy="${f(lv)}" r="${s.w ? 3.6 : 3}" fill="#fff" stroke="${s.c}" stroke-width="${s.w ? 2.6 : 2.1}" class="fxrefline"/>`
  })
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${svg}${xl}</svg>`
}

function Lg({ c, t, b }: { c: string; t: string; b?: boolean }) {
  return <span className="inline-flex items-center gap-1.5" style={{ color: c, fontWeight: b ? 800 : 600 }}><span className="inline-block h-0 w-3.5" style={{ borderTop: "2.4px solid " + c }} />{t}</span>
}
function Chart({ id, title, unit, legend, src }: { id: string; title: string; unit?: string; legend: React.ReactNode; src: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-t-[3px] border-indigo-500 px-3.5 pb-2 pt-2.5">
        <span className="text-[12px] text-amber-500">☆</span>
        <h3 className="text-[13.5px] font-bold text-gray-900">{title}{unit && <span className="ml-1 text-[10.5px] font-medium text-gray-400">{unit}</span>}</h3>
        <span className="ml-auto flex gap-1">{["⤢", "DATA", "↓"].map((t) => <i key={t} className="grid h-[19px] min-w-[19px] place-items-center rounded border border-gray-200 px-1 text-[8px] font-bold not-italic text-gray-400">{t}</i>)}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3.5 pb-1 text-[10.5px]">{legend}</div>
      <div className="px-1.5 pb-1" dangerouslySetInnerHTML={{ __html: buildSvg(CFG[id]) }} />
      <div className="border-t border-gray-100 px-3.5 pb-2.5 pt-1.5 text-[10px] leading-relaxed text-gray-400">{src}</div>
    </div>
  )
}

// ── 수입 원가 영향(실측)
const MIX: { ctry: string; ccy: string; w: number }[] = [
  { ctry: "중국", ccy: "CNY", w: 30 }, { ctry: "한국", ccy: "KRW", w: 28 }, { ctry: "태국", ccy: "THB", w: 14 },
  { ctry: "미국·달러결제", ccy: "USD", w: 12 }, { ctry: "인도네시아", ccy: "IDR", w: 8 }, { ctry: "현지", ccy: "PHP", w: 8 },
]
function peerYoy(frag: string, s: Strip): number | null { const p = s.peers.find((x) => String(x.label).includes(frag)); return p ? p.yoy : null }
function pesoCost(ccy: string, s: Strip): number | null {
  const phpYoy = s.pairs.USDPHP?.yoy
  if (ccy === "PHP") return 0
  if (ccy === "USD") return s.pairs.USDPHP?.yoy ?? null
  if (ccy === "CNY") return s.pairs.CNYPHP?.yoy ?? null
  if (ccy === "KRW") return s.pairs.KRWPHP?.yoy ?? null
  const nm: Record<string, string> = { THB: "바트", IDR: "루피아" }
  const py = peerYoy(nm[ccy] ?? ccy, s)
  return phpYoy != null && py != null ? +(phpYoy - py).toFixed(1) : null
}

export default function FxView() {
  const [s, setS] = React.useState<Strip | null>(null)
  React.useEffect(() => { fxStrip().then(setS).catch(() => setS({ asOf: null, pairs: {}, peers: [] })) }, [])

  const cost = React.useMemo(() => {
    if (!s) return null
    const rows = MIX.map((m) => { const c = pesoCost(m.ccy, s); return { ...m, cost: c ?? 0, contrib: c != null ? +((m.w / 100) * c).toFixed(2) : 0 } })
    const total = +rows.reduce((a, r) => a + r.contrib, 0).toFixed(1)
    const top = [...rows].sort((a, b) => b.contrib - a.contrib)[0]
    const foreignW = MIX.filter((m) => m.ccy !== "PHP").reduce((a, m) => a + m.w, 0)
    return { rows, total, top, foreignW, sens: +((foreignW / 100) * 5).toFixed(1), maxAbs: Math.max(0.01, ...rows.map((r) => Math.abs(r.contrib))), share: total > 0 ? Math.round((top.contrib / total) * 100) : 0 }
  }, [s])

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fxdash{to{stroke-dashoffset:0}}@keyframes fxfade{to{opacity:1}}.fxaline{stroke-dasharray:1;stroke-dashoffset:1;animation:fxdash 1.15s cubic-bezier(.33,1,.68,1) forwards}.fxrefline{opacity:0;animation:fxfade .7s ease .35s forwards}"}</style>

      {/* 슬림 진단 배너 */}
      <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-6 4 4 6-7" /></svg>
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-600">
          <b className="font-bold text-gray-900">페소 약세 심화</b> — ₱/USD <b className="font-bold text-rose-600">61.7</b>로 사상최저 근접(전년比 +₱4.5), <b className="font-bold text-gray-900">동남아 6개국 중 약세 폭 최상위</b>. 명목실효환율(NEER)도 하락 — 수입 원가·본사 환산 부담 → 달러 원가 환헤지·현지 조달 점검.
        </p>
        <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-[10.5px] font-bold text-indigo-700">당월 2026.07</span>
      </div>

      {/* 2-col: 차트 + 우측 레일 */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3.5 flex items-center gap-2.5 border-b border-gray-100 pb-3">
            <span className="h-[18px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[16px] font-bold text-gray-900">환율</h2>
            <span className="text-[11px] font-semibold text-gray-400">필리핀 페소 · 대달러·실효·지역 통화</span>
            <span className="ml-auto flex gap-1">{["1Y", "2Y", "5Y", "Max"].map((z, i) => <b key={z} className={"rounded px-2 py-0.5 text-[10.5px] font-bold " + (i === 1 ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500")}>{z}</b>)}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Chart id="region" title="동남아 6개국 통화 강도" unit="대미달러·전년=100"
              legend={<><Lg c="#4f46e5" t="필리핀" b /><Lg c="#dc2626" t="인도네시아" /><Lg c="#0284c7" t="말레이시아" /><Lg c="#0f766e" t="태국" /><Lg c="#d99400" t="베트남" /><Lg c="#7c3aed" t="싱가포르" /></>}
              src={<><b className="font-semibold text-gray-500">주</b> 각국 통화의 대미달러 환율, 전년 동월=100 · <b className="font-semibold" style={{ color: "#4f46e5" }}>아래로 갈수록 약세 · 페소가 역내 약세 폭 상위</b> · <b className="font-semibold text-gray-500">자료</b> BIS·FRED·Alpha Vantage</>} />
            <Chart id="neer" title="페소/달러 및 페소 명목실효환율"
              legend={<><Lg c="#2563eb" t="₱/USD (좌)" /><Lg c="#a1795b" t="페소 NEER (우, 2020=100)" /></>}
              src={<><b className="font-semibold text-gray-500">주</b> 대달러 상승(약세)과 실효환율 하락 동행 · <b className="font-semibold text-gray-500">자료</b> BSP·BIS(Broad NEER)</>} />
            <Chart id="asia" title="위안·루피의 대페소 환율"
              legend={<><Lg c="#dc2626" t="CNY/PHP" /><Lg c="#7c3aed" t="INR/PHP" /></>}
              src={<><b className="font-semibold text-gray-500">주</b> 가전 공급망·경쟁(중국·인도) 통화 대비 페소 강도, 전년=100 · <b className="font-semibold text-gray-500">자료</b> FRED·Alpha Vantage</>} />
            <Chart id="reer" title="페소 실질실효환율(REER)"
              legend={<><Lg c="#a1795b" t="REER" /><Lg c="#5b5bd6" t="NEER" /></>}
              src={<><b className="font-semibold text-gray-500">주</b> 명목은 약세지만 <b className="font-semibold text-gray-700">물가(6.4%) 반영 REER는 완만 상승</b> — 실질 구매력 시사점 · <b className="font-semibold text-gray-500">자료</b> BIS</>} />
          </div>
        </div>

        {/* 우측 레일 */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-2.5 text-[12.5px] font-bold text-gray-900">이달의 환율 핵심</h4>
            {[["₱ / USD", "61.7", "▲4.5", "up"], ["₩ / ₱ (본사 환산)", "23.76", "−0.3", "g"], ["페소 NEER", "87.8", "▼4.2", "up"], ["페소 REER", "101.6", "+3.6", "g"]].map(([n, v, d, t], i) => (
              <div key={i} className="flex items-center gap-2 border-b border-gray-100 py-2 last:border-none">
                <span className={"h-1.5 w-1.5 rounded-full " + (t === "up" ? "bg-amber-500" : "bg-gray-300")} />
                <span className="text-[12px] font-medium text-gray-600">{n}</span>
                <span className="ml-auto text-[14px] font-bold tabular-nums text-gray-900">{v}</span>
                <span className={"w-11 text-right text-[10.5px] font-bold tabular-nums " + (t === "up" ? "text-rose-600" : "text-gray-400")}>{d}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-1.5 text-[12.5px] font-bold text-gray-900">연결 · 관련 뉴스</h4>
            {[["거시", "페소 61.75 사상최저 타이…BSP 달러매도 개입", "Philstar · 오늘"], ["거시", "6월 국제수지 흑자 34억달러…대외완충 개선", "BusinessWorld · 오늘"], ["원가", "페소 약세, 수입 완제품·부품 원가 상승 압력", "Inquirer · 오늘"]].map(([tag, tt, mt], i) => (
              <a key={i} href="#" className="flex items-start gap-2 border-b border-gray-100 py-2.5 last:border-none">
                <span className="mt-0.5 shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">{tag}</span>
                <span><span className="block text-[12px] font-semibold leading-snug text-gray-700">{tt}</span><span className="mt-0.5 block text-[10px] text-gray-400">{mt}</span></span>
              </a>
            ))}
          </div>
        </aside>
      </div>

      {/* 수입 원가 영향(실측) */}
      {cost && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-gray-900">환율 → 수입 원가 영향</h3>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">원가 압박</span>
            <span className="ml-auto text-[11px] text-gray-400">조달 믹스 × 대페소 변동 · 실측 fx_daily</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <p className="text-[32px] font-bold leading-none tracking-tight text-rose-600">{cost.total > 0 ? "+" : ""}{cost.total}<span className="text-[15px] font-semibold">%p</span></p>
            <p className="text-[12px] text-gray-500">환율만으로 <b className="text-gray-900">COGS +{cost.total}%p</b> · 부담 {cost.share}%가 <b className="text-gray-900">{cost.top.ctry}</b> 조달(페소가 해당 통화에 {nf(cost.top.cost)}% 약세)</p>
          </div>
          <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {cost.rows.map((r) => {
              const up = r.contrib > 0, w = Math.round((Math.abs(r.contrib) / cost.maxAbs) * 46)
              return (
                <div key={r.ccy} className="grid grid-cols-[92px_40px_54px_1fr_50px] items-center gap-2 text-[12px]">
                  <span className="font-semibold text-gray-800">{r.ctry} <span className="text-[9.5px] text-gray-400">{r.ccy}</span></span>
                  <span className="text-right tabular-nums text-gray-500">{r.w}%</span>
                  <span className={"text-right font-bold tabular-nums " + (r.cost > 0 ? "text-rose-600" : r.cost < 0 ? "text-emerald-600" : "text-gray-400")}>{r.cost > 0 ? "▲" : r.cost < 0 ? "▼" : ""}{Math.abs(r.cost)}%</span>
                  <span className="relative h-3.5 rounded bg-gray-100"><span className="absolute left-1/2 top-0 h-full w-px bg-gray-300" /><span className={"absolute top-0 h-full rounded " + (up ? "bg-rose-500" : "bg-emerald-500")} style={{ left: up ? "50%" : "auto", right: up ? "auto" : "50%", width: w + "%" }} /></span>
                  <span className={"text-right font-bold tabular-nums " + (up ? "text-rose-600" : r.contrib < 0 ? "text-emerald-600" : "text-gray-400")}>{nf(r.contrib, 2)}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2.5 border-t border-gray-100 pt-2 text-[11px] text-gray-500"><b className="text-gray-700">So-What</b> {cost.top.ctry} 조달 환헤지·대체 소싱이 방어 1순위 · 페소 −5%면 COGS +{cost.sens}%p 추가. <span className="text-gray-400">통화변동 실측, 조달 비중은 가정값.</span></p>
        </div>
      )}
    </div>
  )
}
