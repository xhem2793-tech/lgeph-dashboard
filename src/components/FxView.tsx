"use client"

import React from "react"
import { fxStrip } from "@/lib/supabase"
import { CountUp } from "@/components/ProChartCore"

/** 환율·원가 뷰 — 사이트 공용 어법으로 통일.
 *  · 배너: 주요뉴스·경쟁사와 동일한 접이식 인디고 배너(나침반·헤드라인·LG 관점).
 *  · 차트: DailyIndicators/ProChart와 같은 인터랙티브 SVG(크로스헤어·툴팁·드로우), 다중선·듀얼축 확장.
 *  · 우측: 캘린더 우측 위젯과 동일한 상시 카드(286px) — 환율 핵심 KPI + 연결 일정·뉴스.
 *  · 시계열은 데모(끝점만 실측 근처) · 원가영향 모델은 실측 fx_daily. */

type Strip = { asOf: string | null; pairs: Record<string, any>; peers: any[] }
const nf = (v: number, d = 1) => (v > 0 ? "+" : "") + v.toFixed(d)

const GRID = "#eceef1"
const SURFACE = "#f9fafb"

const XL = ["25.7", "25.9", "25.11", "26.1", "26.3", "26.5", "26.7"]

// ── 인터랙티브 다중선 차트 (ProChart 시각언어 · N시리즈 · 듀얼축) ─────────
type SLine = { name: string; color: string; data: number[]; axis?: "R"; w?: number; unit?: string }
type ChartCfg = { series: SLine[]; yL?: [number, number]; yR?: [number, number]; decimals?: number }

function niceScale(vals: number[]) {
  let mn = Math.min(...vals), mx = Math.max(...vals)
  if (mn === mx) { mn -= 1; mx += 1 }
  const pad = (mx - mn) * 0.12
  return [mn - pad, mx + pad] as [number, number]
}

function FxChart({ cfg }: { cfg: ChartCfg }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const svg = svgRef.current, tip = tipRef.current
    if (!svg || !tip) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    tip.innerHTML = ""

    const NS = "http://www.w3.org/2000/svg"
    const dec = cfg.decimals ?? 1
    const n = XL.length
    const hasR = !!cfg.yR
    const padL = 30, plotR = hasR ? 268 : 291, T = 8, B = 78
    const el = (t: string, a: Record<string, string | number>) => {
      const e = document.createElementNS(NS, t)
      for (const k in a) e.setAttribute(k, String(a[k]))
      return e
    }
    const Ld = cfg.series.filter((s) => s.axis !== "R").flatMap((s) => s.data)
    const Rd = cfg.series.filter((s) => s.axis === "R").flatMap((s) => s.data)
    const [loL, hiL] = cfg.yL ?? niceScale(Ld)
    const [loR, hiR] = cfg.yR ?? (Rd.length ? niceScale(Rd) : [0, 1])
    const X = (i: number) => padL + (i / (n - 1)) * (plotR - padL)
    const YL = (v: number) => B - ((v - loL) / (hiL - loL)) * (B - T)
    const YR = (v: number) => B - ((v - loR) / (hiR - loR)) * (B - T)
    const yOf = (s: SLine, v: number) => (s.axis === "R" ? YR(v) : YL(v))

    // grid + 좌우 축 눈금
    const DIV = 4
    for (let k = 0; k <= DIV; k++) {
      const vL = loL + ((hiL - loL) * k) / DIV, y = YL(vL)
      svg.appendChild(el("line", { x1: padL, y1: y, x2: plotR, y2: y, stroke: GRID, "stroke-width": 1 }))
      const tl = el("text", { x: padL - 5, y: y + 3, "text-anchor": "end", "font-size": 8.5, fill: "#b6bcc6" })
      tl.textContent = vL.toFixed(0)
      svg.appendChild(tl)
      if (hasR) {
        const vR = loR + ((hiR - loR) * k) / DIV
        const tr = el("text", { x: plotR + 5, y: y + 3, "text-anchor": "start", "font-size": 8.5, fill: "#cdb9a6" })
        tr.textContent = vR.toFixed(0)
        svg.appendChild(tr)
      }
    }
    XL.forEach((lb, i) => {
      const tx = el("text", { x: X(i), y: B + 13, "text-anchor": "middle", "font-size": 8.5, fill: "#b6bcc6" })
      tx.textContent = lb
      svg.appendChild(tx)
    })

    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: "#c3c8d0", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 })
    svg.appendChild(cross)

    const base = 3
    const dots: { c: SVGElement; color: string; emph: boolean }[][] = []
    cfg.series.forEach((s, si) => {
      const w = s.w ?? 2
      const pts = s.data.map((v, i) => [X(i), yOf(s, v)])
      const pl = el("polyline", {
        points: pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "),
        fill: "none", stroke: s.color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round",
      })
      svg.appendChild(pl)
      const len = (pl as unknown as SVGPolylineElement).getTotalLength()
      pl.style.strokeDasharray = String(len)
      pl.style.strokeDashoffset = String(len)
      pl.style.transition = "stroke-dashoffset 1200ms cubic-bezier(.22,1,.36,1)"
      pl.style.transitionDelay = 0.12 + si * 0.06 + "s"
      requestAnimationFrame(() => requestAnimationFrame(() => { pl.style.strokeDashoffset = "0" }))
      const row = pts.map((p) => {
        const c = el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: base, fill: SURFACE, stroke: s.color, "stroke-width": 1.6, opacity: 0 })
        c.style.transition = "opacity .3s ease"
        c.style.transitionDelay = 0.9 + si * 0.05 + "s"
        svg.appendChild(c)
        requestAnimationFrame(() => requestAnimationFrame(() => { (c as SVGElement).setAttribute("opacity", "1") }))
        return { c, color: s.color, emph: (s.w ?? 2) > 2.4 }
      })
      dots.push(row)
    })

    // 툴팁 — 헤더 + 시리즈별 행
    const head = document.createElement("div")
    head.className = "mb-1 text-[10.5px] font-medium text-gray-400"
    tip.appendChild(head)
    const valNodes: HTMLElement[] = []
    cfg.series.forEach((s) => {
      const row = document.createElement("div")
      row.className = "flex items-center gap-2 text-[11px] leading-4"
      const dot = document.createElement("span")
      dot.className = "inline-block h-2 w-2 shrink-0 rounded-full"
      dot.style.background = s.color
      const nm = document.createElement("span")
      nm.className = "text-gray-500"
      nm.textContent = s.name
      const v = document.createElement("b")
      v.className = "ml-auto tabular-nums font-semibold text-gray-800"
      row.appendChild(dot); row.appendChild(nm); row.appendChild(v)
      tip.appendChild(row)
      valNodes.push(v)
    })

    let active = -1, shown = false
    let curX = X(0), tgtX = X(0), curTop = T, tgtTop = T, cOp = 0, tOp = 0
    let rectW = 300, rectH = 120, raf = 0

    const setActive = (i: number) => {
      if (i === active) return
      active = i
      head.textContent = "20" + XL[i]
      const tops: number[] = []
      cfg.series.forEach((s, si) => {
        const v = s.data[i]
        valNodes[si].textContent = v.toFixed(dec) + (s.unit ?? "")
        tops.push(yOf(s, v))
      })
      tgtTop = tops.length ? Math.min(...tops) : T
    }
    const loop = () => {
      curX += (tgtX - curX) * 0.28
      curTop += (tgtTop - curTop) * 0.28
      cOp += (tOp - cOp) * 0.25
      cross.setAttribute("x1", curX.toFixed(1)); cross.setAttribute("x2", curX.toFixed(1)); cross.setAttribute("opacity", cOp.toFixed(2))
      dots.forEach((row) => row.forEach((o, j) => {
        const act = shown && j === active
        const tr = act ? (o.emph ? base + 2.4 : base + 1.8) : base
        const cr = parseFloat(o.c.getAttribute("r") || String(base))
        o.c.setAttribute("r", (cr + (tr - cr) * 0.3).toFixed(2))
        o.c.setAttribute("fill", act ? o.color : SURFACE)
      }))
      const sx = rectW / 300, sy = rectH / 100
      tip.style.left = (curX * sx).toFixed(1) + "px"
      tip.style.top = (curTop * sy - 12).toFixed(1) + "px"
      tip.style.transform = "translate(-50%,-100%)"
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect()
      rectW = rect.width; rectH = rect.height
      const px = ((e.clientX - rect.left) / rect.width) * 300
      const xi = Math.max(0, Math.min(n - 1, (px - padL) / (plotR - padL) * (n - 1)))
      tgtX = X(xi)
      setActive(Math.round(xi))
      shown = true; tOp = 1; tip.style.opacity = "1"
    }
    const leave = () => { shown = false; tOp = 0; tip.style.opacity = "0"; active = -1 }
    svg.addEventListener("pointermove", move)
    svg.addEventListener("pointerdown", move)
    svg.addEventListener("pointerleave", leave)
    return () => {
      cancelAnimationFrame(raf)
      svg.removeEventListener("pointermove", move)
      svg.removeEventListener("pointerdown", move)
      svg.removeEventListener("pointerleave", leave)
    }
  }, [cfg])

  return (
    <div className="relative mt-1" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 100" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair" }} />
      <div
        ref={tipRef}
        className="pointer-events-none absolute left-0 top-0 z-10 min-w-[128px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg transition-opacity"
        style={{ opacity: 0 }}
      />
    </div>
  )
}

// ── 차트 카드 (ProChart 카드 어법) ──────────────────────────────────────
function Lg({ c, t, b }: { c: string; t: string; b?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: b ? "#4f46e5" : "#6b7280", fontWeight: b ? 700 : 500 }}>
      <span className="inline-block h-0 w-3" style={{ borderTop: "2.4px solid " + c }} />{t}
    </span>
  )
}
function ChartCard({ title, unit, legend, cfg, src }: { title: string; unit?: string; legend: React.ReactNode; cfg: ChartCfg; src: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-bold tracking-tight text-gray-900">{title}</h3>
        {unit && <span className="text-[10.5px] font-medium text-gray-400">{unit}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px]">{legend}</div>
      <FxChart cfg={cfg} />
      <p className="mt-2 border-t border-gray-100 pt-2 text-[10.5px] leading-relaxed text-gray-400">{src}</p>
    </div>
  )
}

const CFG: Record<string, ChartCfg> = {
  region: {
    yL: [90, 101],
    series: [
      { name: "필리핀", color: "#4f46e5", w: 3, data: [100, 99.3, 98.4, 97.0, 95.5, 93.5, 92.0] },
      { name: "인도네시아", color: "#dc2626", data: [100, 99.5, 99.0, 98.2, 97.4, 96.5, 96.0] },
      { name: "말레이시아", color: "#0284c7", data: [100, 99.7, 99.4, 99.1, 98.9, 98.6, 98.5] },
      { name: "태국", color: "#0f766e", data: [100, 99.8, 99.5, 99.0, 98.6, 98.2, 98.0] },
      { name: "베트남", color: "#d99400", data: [100, 99.9, 99.7, 99.5, 99.3, 99.1, 99.0] },
      { name: "싱가포르", color: "#7c3aed", data: [100, 99.9, 99.8, 99.7, 99.6, 99.5, 99.5] },
    ],
  },
  neer: {
    yL: [56, 63], yR: [86, 94],
    series: [
      { name: "₱/USD", color: "#2563eb", data: [57.1, 57.9, 58.9, 60, 61, 61.5, 61.7] },
      { name: "NEER", color: "#a1795b", axis: "R", data: [92, 91.3, 90.6, 89.7, 88.9, 88.2, 87.8] },
    ],
  },
  asia: {
    yL: [97, 106],
    series: [
      { name: "CNY/PHP", color: "#dc2626", data: [100, 100.5, 101.2, 102.4, 103.6, 104.5, 105] },
      { name: "INR/PHP", color: "#7c3aed", data: [100, 100.3, 100.8, 101.5, 102, 102.4, 102.7] },
    ],
  },
  reer: {
    yL: [86, 104],
    series: [
      { name: "REER", color: "#a1795b", data: [98, 98.7, 99.4, 100.2, 100.9, 101.4, 101.6] },
      { name: "NEER", color: "#6366f1", data: [92, 91.3, 90.6, 89.7, 88.9, 88.2, 87.8] },
    ],
  },
}

// ── 수입 원가영향 모델 (실측 fx_daily) ──────────────────────────────────
const MIX: { ctry: string; ccy: string; w: number }[] = [
  { ctry: "중국", ccy: "CNY", w: 30 }, { ctry: "한국", ccy: "KRW", w: 28 }, { ctry: "태국", ccy: "THB", w: 14 },
  { ctry: "미국·달러결제", ccy: "USD", w: 12 }, { ctry: "인도네시아", ccy: "IDR", w: 8 }, { ctry: "현지", ccy: "PHP", w: 8 },
]
function peerYoy(frag: string, s: Strip): number | null {
  const p = s.peers.find((x) => String(x.label).includes(frag))
  return p ? p.yoy : null
}
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
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => { fxStrip().then(setS).catch(() => setS({ asOf: null, pairs: {}, peers: [] })) }, [])

  const cost = React.useMemo(() => {
    if (!s) return null
    const rows = MIX.map((m) => { const c = pesoCost(m.ccy, s); return { ...m, cost: c ?? 0, contrib: c != null ? +((m.w / 100) * c).toFixed(2) : 0 } })
    const total = +rows.reduce((a, r) => a + r.contrib, 0).toFixed(1)
    const top = [...rows].sort((a, b) => b.contrib - a.contrib)[0]
    const foreignW = MIX.filter((m) => m.ccy !== "PHP").reduce((a, m) => a + m.w, 0)
    return { rows, total, top, sens: +((foreignW / 100) * 5).toFixed(1), maxAbs: Math.max(0.01, ...rows.map((r) => Math.abs(r.contrib))), share: total > 0 ? Math.round((top.contrib / total) * 100) : 0 }
  }, [s])

  // 우측 위젯 KPI — 실측 ₱/USD·₩/₱ + 실효환율(데모)
  const usdphp = s?.pairs.USDPHP?.rate ?? 61.7
  const krwphp = s?.pairs.KRWPHP?.rate ?? 23.76
  const KPI: { n: string; v: number; d: string; tone: "rose" | "teal" | "amber" | "gray"; dec: number }[] = [
    { n: "₱ / USD", v: usdphp, d: "▲4.5", tone: "rose", dec: 1 },
    { n: "₩ / ₱", v: krwphp, d: "−0.3", tone: "gray", dec: 2 },
    { n: "페소 NEER", v: 87.8, d: "▼4.2", tone: "rose", dec: 1 },
    { n: "페소 REER", v: 101.6, d: "+3.6", tone: "amber", dec: 1 },
  ]
  const toneBg: Record<string, string> = { rose: "bg-rose-50 text-rose-700", teal: "bg-teal-50 text-teal-700", amber: "bg-amber-50 text-amber-700", gray: "bg-gray-50 text-gray-600" }
  const AGENDA: { label: string; note: string; date: string; dot: string }[] = [
    { label: "BSP 통화정책회의", note: "금리 → 페소 방향 좌우", date: "2026-08-14", dot: "bg-rose-500" },
    { label: "미국 CPI 발표", note: "달러·페소 변동성", date: "2026-08-12", dot: "bg-amber-500" },
    { label: "필리핀 7월 CPI", note: "실질환율(REER) 재료", date: "2026-08-05", dot: "bg-indigo-500" },
    { label: "6월 국제수지(BoP)", note: "대외 완충·환율 압력", date: "2026-08-19", dot: "bg-emerald-500" },
  ]
  const NEWS: { tag: string; t: string; m: string }[] = [
    { tag: "환율", t: "페소 61.75 사상최저 근접…BSP 개입 관측", m: "Philstar · 오늘" },
    { tag: "원가", t: "위안 강세로 중국산 부품 조달비 상승 압력", m: "BusinessWorld · 어제" },
  ]
  const today = new Date()
  const dday = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000)

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      {/* 배너 — 주요뉴스·경쟁사와 동일 */}
      <div
        onClick={() => setOpen((v) => !v)}
        className="group cursor-pointer select-none overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-indigo-50/40 to-white shadow-sm transition-shadow hover:shadow-md"
        style={{ animation: "fadeUp .5s ease both" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12l5-3" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>
          </div>
          <div className="min-w-0 flex-1 truncate text-[13px] text-gray-700">
            <b className="font-semibold text-gray-900">페소 약세 심화</b> — ₱/USD 61.7로 사상최저 근접(전년比 +₱4.5), 동남아 6개국 중 페소 최고 약세 폭 · 중국 조달 원가 부담 확대
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-400 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
          <div className="overflow-hidden">
            <div className="border-t border-indigo-100/70 px-4 pb-3.5 pt-3">
              <p className="text-[13px] leading-relaxed text-gray-700">
                페소가 <b className="text-gray-900">₱/USD 61.7</b>로 사상최저에 근접(전년比 +₱4.5). 동남아 6개국을 대미달러로 지수화하면 <b className="text-gray-900">페소 낙폭이 가장 크고</b>, 명목실효환율(NEER)도 87.8로 동반 하락. 반면 실질실효환율(REER)은 물가 상승분이 반영돼 101.6으로 올라 <b className="text-gray-900">명목 약세만큼 가격경쟁력이 개선되지는 않음</b>.
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-indigo-700">
                <span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 관점</span>
                <span>수입 조달 통화(위안·바트·달러)의 대페소 절하가 원가를 밀어올림 — 특히 중국 조달 비중이 부담의 대부분. 조달 통화 헤지·결제통화 조정·대체 소싱으로 원가 방어 점검 권고.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 본문: 좌 차트 + 우 상시 위젯(286px) */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        {/* 좌 — 차트 우선 */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
            <header className="mb-3.5 flex items-center gap-2.5 border-b border-gray-100 pb-2.5">
              <span className="h-[18px] w-1 rounded bg-indigo-500" />
              <h2 className="text-[16px] font-bold tracking-tight text-gray-900">환율</h2>
              <span className="text-[11px] font-semibold text-gray-400">필리핀 페소 · 대달러·실효·역내 통화</span>
              <span className="ml-auto flex gap-1">{["1Y", "2Y", "5Y"].map((z, i) => (
                <b key={z} className={"rounded px-2 py-0.5 text-[10.5px] font-bold " + (i === 1 ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500")}>{z}</b>
              ))}</span>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChartCard title="동남아 6개국 통화 강도" unit="대미달러·전년=100"
                legend={<><Lg c="#4f46e5" t="필리핀" b /><Lg c="#dc2626" t="인도네시아" /><Lg c="#0284c7" t="말레이시아" /><Lg c="#0f766e" t="태국" /><Lg c="#d99400" t="베트남" /><Lg c="#7c3aed" t="싱가포르" /></>}
                cfg={CFG.region}
                src={<><b className="font-semibold text-gray-500">주</b> 각국 통화의 대미달러 변동, 전년=100 · <b className="font-semibold" style={{ color: "#4f46e5" }}>아래로 갈수록 약세 · 페소가 역내 최대 낙폭</b> · <b className="font-semibold text-gray-500">자료</b> BIS·FRED·Alpha Vantage</>} />
              <ChartCard title="페소/달러 · 명목실효환율(NEER)"
                legend={<><Lg c="#2563eb" t="₱/USD (좌)" /><Lg c="#a1795b" t="NEER (우, 2020=100)" /></>}
                cfg={CFG.neer}
                src={<><b className="font-semibold text-gray-500">주</b> 대달러 환율(약세)과 실효환율 하락 동행 · <b className="font-semibold text-gray-500">자료</b> BSP·BIS(Broad NEER)</>} />
              <ChartCard title="위안·루피의 대페소 환율" unit="전년=100"
                legend={<><Lg c="#dc2626" t="CNY/PHP" /><Lg c="#7c3aed" t="INR/PHP" /></>}
                cfg={CFG.asia}
                src={<><b className="font-semibold text-gray-500">주</b> 가전 조달 통화(중국·인도) 대페소 강세 = 원가 부담 · <b className="font-semibold text-gray-500">자료</b> FRED·Alpha Vantage</>} />
              <ChartCard title="페소 실질실효환율(REER)"
                legend={<><Lg c="#a1795b" t="REER" /><Lg c="#6366f1" t="NEER" /></>}
                cfg={CFG.reer}
                src={<><b className="font-semibold text-gray-500">주</b> 명목은 약세지만 <b className="font-semibold text-gray-700">물가(6.4%) 반영 REER는 오히려 상승</b> — 실질 구매력·가격경쟁력 시사점 · <b className="font-semibold text-gray-500">자료</b> BIS</>} />
            </div>
          </section>

          {/* 수입 원가영향 모델 (실측) */}
          {cost && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both", animationDelay: "60ms" }}>
              <header className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                <span className="h-[18px] w-1 rounded bg-rose-500" />
                <h2 className="text-[16px] font-bold tracking-tight text-gray-900">환율 → 수입 원가 영향</h2>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">원가 압박</span>
                <span className="ml-auto text-[11px] text-gray-400">실측 fx_daily · 조달 믹스 가정</span>
              </header>
              <div className="mt-3 flex items-baseline gap-3">
                <p className="text-[30px] font-bold leading-none tracking-tight text-rose-600">{cost.total > 0 ? "+" : ""}{cost.total}<span className="text-[15px] font-semibold">%p</span></p>
                <p className="text-[12px] leading-relaxed text-gray-500">환율만으로 <b className="text-gray-900">수입 가전 COGS +{cost.total}%p</b> · 부담 {cost.share}%가 <b className="text-gray-900">{cost.top.ctry}</b> 조달(페소가 해당 통화에 {nf(cost.top.cost)}% 약세)</p>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {cost.rows.map((r) => {
                  const up = r.contrib > 0, w = Math.round((Math.abs(r.contrib) / cost.maxAbs) * 46)
                  return (
                    <div key={r.ccy} className="grid grid-cols-[104px_38px_52px_1fr_46px] items-center gap-2 text-[12px]">
                      <span className="truncate font-semibold text-gray-800">{r.ctry} <span className="text-[9.5px] text-gray-400">{r.ccy}</span></span>
                      <span className="text-right tabular-nums text-gray-500">{r.w}%</span>
                      <span className={"text-right font-bold tabular-nums " + (r.cost > 0 ? "text-rose-600" : r.cost < 0 ? "text-emerald-600" : "text-gray-400")}>{r.cost > 0 ? "▲" : r.cost < 0 ? "▼" : ""}{Math.abs(r.cost)}%</span>
                      <span className="relative h-3.5 rounded bg-gray-100"><span className="absolute left-1/2 top-0 h-full w-px bg-gray-300" /><span className={"absolute top-0 h-full rounded " + (up ? "bg-rose-500" : "bg-emerald-500")} style={{ left: up ? "50%" : "auto", right: up ? "auto" : "50%", width: w + "%" }} /></span>
                      <span className={"text-right font-bold tabular-nums " + (up ? "text-rose-600" : r.contrib < 0 ? "text-emerald-600" : "text-gray-400")}>{nf(r.contrib, 2)}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2.5 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-gray-500"><b className="text-gray-700">So-What</b> {cost.top.ctry} 조달 환헤지·대체 소싱이 방어 1순위 · 페소 −5%면 COGS +{cost.sens}%p 추가. <span className="text-gray-400">통화변동 실측, 조달 비중은 가정값.</span></p>
            </section>
          )}
        </div>

        {/* 우 — 상시 위젯(286px, 캘린더 위젯 어법) */}
        <aside className="flex flex-col gap-4" style={{ animation: "fadeUp .5s ease both", animationDelay: "80ms" }}>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <header className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
              <h2 className="text-[15px] font-bold tracking-tight text-gray-900">환율 핵심 KPI</h2>
              <span className="text-[11px] text-gray-400">{s?.asOf ? s.asOf.slice(0, 10).replace(/-/g, ".") : "—"} 기준</span>
            </header>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {KPI.map((k) => (
                <div key={k.n} className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-gray-500">{k.n}</p>
                  <p className="mt-0.5 text-[19px] font-bold leading-none tabular-nums text-gray-900"><CountUp value={k.v} decimals={k.dec} /></p>
                  <span className={"mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums " + toneBg[k.tone]}>{k.d}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-gray-400">₱/USD·₩/₱ 실측(fx_daily) · NEER·REER는 지수(데모, 데이터 연동 예정)</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <header className="flex items-baseline justify-between border-b border-gray-100 pb-2.5">
              <h2 className="text-[15px] font-bold tracking-tight text-gray-900">연결 일정</h2>
              <span className="text-[11px] text-gray-400">환율 영향</span>
            </header>
            <div className="mt-2 flex flex-col">
              {AGENDA.map((x, i) => {
                const dd = dday(x.date)
                return (
                  <div key={x.label} style={{ animation: "fadeUp .5s ease both", animationDelay: 60 + i * 40 + "ms" }} className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-indigo-50/40">
                    <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + x.dot} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-gray-900">{x.label}</span>
                      <span className="block text-[10.5px] text-gray-500">{x.note}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[11px] font-semibold text-gray-500">{dd === 0 ? "오늘" : dd > 0 ? "D-" + dd : "D+" + -dd}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2.5">
              <p className="mb-1 text-[11px] font-bold text-gray-500">연결 뉴스</p>
              {NEWS.map((nw) => (
                <a key={nw.t} href="/news" className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-indigo-50/40">
                  <span className="mt-0.5 shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">{nw.tag}</span>
                  <span><span className="block text-[12px] font-semibold leading-snug text-gray-700">{nw.t}</span><span className="mt-0.5 block text-[10px] text-gray-400">{nw.m}</span></span>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
