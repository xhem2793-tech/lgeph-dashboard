"use client"

import React from "react"
import { fxStrip, pageBanner } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"
import { useIsDark, chartColors } from "@/components/EconChart"
import { InsightBanner, type Banner } from "@/components/InsightBanner"

/** 배너 폴백 — 매니페스트(public/banners.json) 로드 실패 시 표시(월간 자동 갱신 대상) */
const FX_BANNER: Banner = {
  title: "페소 약세 심화",
  summary: "월말 ₱/USD 61.3·일별 61.7 사상최저 근접(5년 전 50.0), 동남아 6개국 중 최대 낙폭 · NEER 88.7 하락하나 REER 98.1 유지(물가가 명목약세 상쇄)",
  body: "페소는 대달러 **월말 ₱/USD 61.3**(일별로는 **61.7 사상최저** 근접)으로 5년 전(50.0) 대비 크게 약세이고, 동남아 6개국을 대미달러로 지수화하면 **페소 낙폭이 가장 큽니다**. BIS 명목실효환율(NEER)도 96.8→88.7로 하락. 다만 실질실효환율(REER)은 **98.1로 거의 유지** — 필리핀 물가가 교역상대국보다 빨리 올라 명목 약세를 상쇄했기 때문입니다.",
  insight: "**NEER↓ = 원가 압박**(조달통화 대비 페소 약세로 수입 가전 COGS 상방), **REER 유지 = 실질 구매력 정체**(대형·프리미엄 수요 부담). 위안 강세(대페소 +17%)로 중국 조달 방어가 1순위.",
  insightLabel: "LG 관점",
  period: "2026-07",
}

/** 환율 뷰 — 전부 실측 데이터.
 *  · 시계열: Alpha Vantage 월별 양자환율(역내 6개국·원·위안·루피·엔·유로·₱/USD) + BIS 공식 실효환율(NEER·REER, Broad 64개국).
 *  · 기간 토글(1Y/3Y/5Y): 유가/일별지표와 동일한 슬라이딩 알약 토글(Segmented).
 *  · 카드: 차트 → 지표 의미(간단) → AI 분석(시사점, 색=신호) → 고정 출처(mt-auto). */

type Strip = { asOf: string | null; pairs: Record<string, any>; peers: any[] }

// ── 실측 데이터 (2021.7–2026.6 월별) ──────────────────────────────────────
const DATA = {"labels": ["21.7", "21.8", "21.9", "21.10", "21.11", "21.12", "22.1", "22.2", "22.3", "22.4", "22.5", "22.6", "22.7", "22.8", "22.9", "22.10", "22.11", "22.12", "23.1", "23.2", "23.3", "23.4", "23.5", "23.6", "23.7", "23.8", "23.9", "23.10", "23.11", "23.12", "24.1", "24.2", "24.3", "24.4", "24.5", "24.6", "24.7", "24.8", "24.9", "24.10", "24.11", "24.12", "25.1", "25.2", "25.3", "25.4", "25.5", "25.6", "25.7", "25.8", "25.9", "25.10", "25.11", "25.12", "26.1", "26.2", "26.3", "26.4", "26.5", "26.6"], "region": {"ph": [49.97, 49.63, 51.08, 50.521, 50.41, 50.99, 51.07, 51.17, 51.71, 52.31, 52.44, 54.97, 55.34, 56.24, 58.75, 58.08, 56.47, 55.67, 54.71, 55.32, 54.266, 55.47, 56.353, 55.264, 54.91, 56.64, 56.69, 56.865, 55.46, 55.388, 56.29, 56.2, 56.16, 57.71, 58.575, 58.48, 58.32, 56.221, 55.98, 58.334, 58.62, 58.076, 58.411, 57.952, 57.251, 55.771, 55.776, 56.275, 58.221, 57.11, 58.279, 58.695, 58.573, 58.8, 58.845, 57.642, 60.557, 61.263, 61.513, 61.32], "id": [14460, 14302, 14265, 14168, 14315, 14275, 14390, 14366, 14352, 14495, 14575, 14880, 14955, 14850, 15225, 15595, 15729, 15565, 14984, 15236, 14989, 14664, 14984, 14989, 15074, 15232, 15485, 15879, 15504, 15394, 15774, 15709, 15850, 16255, 16244, 16369, 16254, 15449, 15134, 15689, 15839, 16089, 16294, 16574, 16554, 16594, 16295, 16230, 16450, 16485, 16660, 16625, 16650, 16670, 16780, 16760, 16990, 17305, 17865, 17875], "my": [4.218, 4.155, 4.185, 4.139, 4.2, 4.164, 4.184, 4.196, 4.203, 4.352, 4.377, 4.406, 4.448, 4.474, 4.635, 4.726, 4.443, 4.4, 4.263, 4.485, 4.41, 4.458, 4.613, 4.665, 4.507, 4.637, 4.694, 4.762, 4.657, 4.585, 4.727, 4.742, 4.722, 4.77, 4.704, 4.715, 4.592, 4.318, 4.121, 4.375, 4.44, 4.468, 4.45, 4.46, 4.435, 4.312, 4.253, 4.21, 4.26, 4.222, 4.206, 4.184, 4.13, 4.056, 3.939, 3.888, 4.046, 3.967, 3.963, 4.082], "th": [32.91, 32.114, 33.663, 33.273, 33.747, 33.205, 33.21, 32.68, 33.228, 34.368, 34.271, 35.24, 36.29, 36.537, 37.853, 38.01, 35.091, 34.6, 32.83, 35.19, 34.15, 34.11, 34.523, 35.29, 34.01, 34.98, 36.426, 36.09, 35.3, 34.37, 35.52, 35.88, 36.36, 37.135, 36.685, 36.76, 35.52, 33.944, 32.4, 33.76, 34.26, 34.27, 33.76, 34.2, 33.93, 33.349, 32.8, 32.41, 32.74, 32.28, 32.44, 32.36, 32.1, 31.48, 31.53, 31.0, 32.56, 32.45, 32.44, 33.2], "vn": [23004, 22774, 22750, 22755, 22687, 22825, 22644, 22805, 22838, 22940, 23185, 23255, 23335, 23450, 23855, 24840, 24630, 23610, 23445, 23740, 23450, 23450, 23485, 23574, 23680, 24060, 24278, 24558, 24250, 24260, 24415, 24640, 24810, 25329, 25440, 25444, 25235, 24860, 24370, 25270, 25343, 25480, 25060, 25530, 25565, 25980, 26030, 26118, 26197, 26340, 26425, 26310, 26330, 26295, 25880, 26040, 26323, 26355, 26255, 26255], "sg": [1.3536, 1.3444, 1.3576, 1.3488, 1.3648, 1.3482, 1.3511, 1.3548, 1.3539, 1.3835, 1.3702, 1.3892, 1.38, 1.3968, 1.435, 1.4155, 1.3608, 1.34, 1.3137, 1.3483, 1.3306, 1.3339, 1.3514, 1.3514, 1.3289, 1.3504, 1.3652, 1.3699, 1.3373, 1.3192, 1.3396, 1.3455, 1.348, 1.3651, 1.351, 1.3556, 1.3356, 1.3065, 1.2841, 1.3201, 1.3374, 1.3649, 1.3575, 1.3507, 1.3425, 1.3058, 1.2907, 1.2711, 1.298, 1.2834, 1.2895, 1.3005, 1.2957, 1.2855, 1.2721, 1.2645, 1.2857, 1.2724, 1.2764, 1.2933]}, "fxusd": [49.97, 49.63, 51.08, 50.521, 50.41, 50.99, 51.07, 51.17, 51.71, 52.31, 52.44, 54.97, 55.34, 56.24, 58.75, 58.08, 56.47, 55.67, 54.71, 55.32, 54.266, 55.47, 56.353, 55.264, 54.91, 56.64, 56.69, 56.865, 55.46, 55.388, 56.29, 56.2, 56.16, 57.71, 58.575, 58.48, 58.32, 56.221, 55.98, 58.334, 58.62, 58.076, 58.411, 57.952, 57.251, 55.771, 55.776, 56.275, 58.221, 57.11, 58.279, 58.695, 58.573, 58.8, 58.845, 57.642, 60.557, 61.263, 61.513, 61.32], "asia": {"cny": [7.7336, 7.6821, 7.9258, 7.887, 7.9205, 8.0222, 8.0281, 8.1108, 8.1564, 7.9156, 7.8597, 8.2062, 8.2056, 8.1641, 8.2584, 7.9545, 7.9671, 8.0714, 8.1015, 7.9787, 7.8938, 8.0183, 7.927, 7.6216, 7.6867, 7.8022, 7.7636, 7.7721, 7.773, 7.8035, 7.8513, 7.8188, 7.7768, 7.9686, 8.0881, 8.0471, 8.0703, 7.9274, 7.9727, 8.1957, 8.0877, 7.9563, 8.0559, 7.9607, 7.8891, 7.6785, 7.7509, 7.8557, 8.0865, 8.0094, 8.1841, 8.2437, 8.28, 8.4145, 8.4589, 8.399, 8.7915, 8.9684, 9.0911, 9.0336], "inr": [0.6722, 0.6804, 0.6887, 0.6744, 0.6713, 0.6848, 0.6851, 0.6778, 0.681, 0.684, 0.6759, 0.6963, 0.6975, 0.7074, 0.7209, 0.7019, 0.6941, 0.6731, 0.6695, 0.6696, 0.6607, 0.6789, 0.6819, 0.6737, 0.6679, 0.685, 0.6826, 0.6832, 0.6655, 0.666, 0.6778, 0.6781, 0.6739, 0.6916, 0.7022, 0.7017, 0.6969, 0.6705, 0.6685, 0.6941, 0.6934, 0.679, 0.6752, 0.6627, 0.6702, 0.6596, 0.6525, 0.6567, 0.6654, 0.6479, 0.6562, 0.6614, 0.6555, 0.6544, 0.6419, 0.6331, 0.648, 0.6456, 0.6475, 0.6478]}, "eer": {"neer": [96.84, 96.83, 96.65, 96.24, 97.16, 97.51, 95.67, 95.54, 95.42, 97.07, 98.63, 96.92, 94.64, 94.87, 94.8, 94.96, 95.1, 95.41, 94.43, 95.44, 96.46, 94.77, 95.09, 96.28, 97.67, 96.55, 96.92, 97.75, 98.13, 97.18, 96.96, 97.75, 98.11, 97.49, 96.04, 95.01, 95.26, 95.32, 95.41, 94.26, 94.06, 95.45, 96.11, 95.93, 96.4, 96.5, 96.87, 94.82, 93.91, 93.92, 93.46, 92.45, 92.21, 91.68, 90.81, 91.69, 90.67, 89.26, 87.62, 88.71], "reer": [98.77, 99.1, 98.47, 97.76, 98.94, 99.35, 98.13, 97.32, 97.14, 99.12, 100.72, 99.26, 97.28, 97.78, 97.67, 98.47, 99.47, 99.98, 100.16, 101.04, 101.75, 99.63, 100.0, 101.18, 102.42, 101.87, 103.15, 103.71, 104.54, 103.53, 103.86, 104.44, 105.03, 104.09, 102.46, 101.33, 101.99, 101.82, 101.61, 100.5, 100.79, 102.57, 103.68, 102.99, 103.18, 102.78, 103.07, 100.84, 99.93, 100.42, 99.77, 98.56, 98.54, 98.6, 98.54, 99.02, 99.17, 99.72, 97.19, 98.1]}, "extra": {"wonperpeso": [23.05, 23.36, 23.19, 23.25, 23.46, 23.3, 23.59, 23.45, 23.48, 24.14, 23.69, 23.42, 23.54, 23.86, 24.51, 24.54, 23.05, 22.67, 22.54, 23.92, 24.07, 24.12, 23.42, 23.81, 23.25, 23.37, 23.85, 23.76, 23.43, 23.37, 23.69, 23.75, 23.95, 23.98, 23.59, 23.61, 23.45, 23.77, 23.5, 23.52, 23.79, 25.43, 24.92, 25.22, 25.71, 25.53, 24.78, 24.03, 23.91, 24.32, 24.09, 24.34, 25.05, 24.5, 24.65, 24.97, 24.87, 24.05, 24.5, 25.23], "pesoperjpy": [0.4559, 0.4512, 0.459, 0.4432, 0.4455, 0.4431, 0.4439, 0.445, 0.425, 0.4029, 0.4075, 0.405, 0.4155, 0.4044, 0.4059, 0.3905, 0.4091, 0.4247, 0.4206, 0.4063, 0.4086, 0.4071, 0.4045, 0.3831, 0.386, 0.3893, 0.3796, 0.375, 0.3743, 0.3928, 0.3832, 0.3747, 0.3712, 0.3659, 0.3724, 0.3636, 0.3892, 0.3846, 0.3899, 0.3837, 0.3915, 0.3694, 0.3764, 0.3849, 0.3819, 0.3901, 0.3873, 0.3908, 0.3862, 0.3885, 0.394, 0.3811, 0.3751, 0.3754, 0.3802, 0.3694, 0.3816, 0.3913, 0.3862, 0.3773], "pesopereur": [59.3186, 58.6435, 59.1615, 58.4125, 57.1672, 57.9893, 57.3949, 57.417, 57.252, 55.1793, 56.2963, 57.6205, 56.5964, 56.5453, 57.5811, 57.414, 58.7923, 59.6102, 59.4415, 58.5211, 58.8632, 61.1172, 60.2448, 60.3055, 60.407, 61.425, 59.9514, 60.1619, 60.4008, 61.1482, 60.9067, 60.7436, 60.6349, 61.5836, 63.5786, 62.6661, 63.1647, 62.1433, 62.3455, 63.5032, 62.0252, 60.145, 60.5295, 60.1349, 61.96, 63.2109, 63.3099, 66.3464, 66.4623, 66.7485, 68.3865, 67.7146, 67.9265, 69.0627, 69.7464, 68.1026, 69.9757, 71.8881, 71.7269, 70.04]}}

const WINDOWS = [{ k: "1Y", n: 12 }, { k: "2Y", n: 24 }, { k: "5Y", n: 60 }, { k: "전체", n: 120 }]
const lastN = <T,>(a: T[], n: number) => a.slice(Math.max(0, a.length - n))
const strengthOf = (a: number[]) => a.map((v) => +((v / a[0]) * 100).toFixed(1)) // 대미달러, 시작=100 (위=약세·절하)
const idx100 = (a: number[]) => a.map((v) => +((v / a[0]) * 100).toFixed(1))

// ── 인터랙티브 라인차트 (ProChart 어법 · N시리즈 단일축, 모든 구간 호버 대응) ──
type SLine = { name: string; color: string; data: number[]; w?: number; endLabel?: string }
function FxChart({ series, labels, decimals = 1, unit = "" }: { series: SLine[]; labels: string[]; decimals?: number; unit?: string }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)
  const dark = useIsDark()
  React.useEffect(() => {
    const svg = svgRef.current, tip = tipRef.current
    if (!svg || !tip) return
    const CO = chartColors(dark)
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    tip.innerHTML = ""
    const NS = "http://www.w3.org/2000/svg"
    const n = labels.length
    const L = 36, R = 292, T = 6, B = 58 // 핵심요약 ProChart와 동일 프레임(끝점 라벨은 차트 밖으로 넘김)
    const el = (t: string, a: Record<string, string | number>) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, String(a[k])); return e }
    const all = series.flatMap((s) => s.data).filter((v) => Number.isFinite(v))
    let lo = Math.min(...all), hi = Math.max(...all)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad
    const X = (i: number) => (n <= 1 ? (L + R) / 2 : L + (i / (n - 1)) * (R - L))
    const Y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T)
    const dec2 = hi - lo < 20 ? 1 : 0
    // 그리드 5분할 + 축 라벨(핵심요약 어법: #eceef1 / #9ca3af / 9px)
    for (let k = 0; k <= 5; k++) {
      const v = lo + ((hi - lo) * k) / 5, y = Y(v)
      svg.appendChild(el("line", { x1: L, y1: y, x2: R, y2: y, stroke: CO.grid, "stroke-width": 1 }))
      const tl = el("text", { x: L - 6, y: y + 3, "text-anchor": "end", "font-size": 9, fill: "#9ca3af" }); tl.textContent = v.toFixed(dec2); svg.appendChild(tl)
    }
    const yearFirst: number[] = []; let ly = ""
    labels.forEach((lb, i) => { const y = String(lb || "").split(".")[0]; if (y && y !== ly) { yearFirst.push(i); ly = y } })
    let showIdx: number[]
    if (yearFirst.length >= 3) { const step = Math.max(1, Math.ceil(yearFirst.length / 8)); showIdx = yearFirst.filter((_, k) => k % step === 0) }
    else { const k = Math.min(5, n); showIdx = Array.from({ length: k }, (_, j) => Math.round((j * (n - 1)) / (k - 1 || 1))) }
    const showSet = new Set(showIdx)
    labels.forEach((lb, i) => { if (!showSet.has(i)) return; const an = i <= 1 ? "start" : i >= n - 2 ? "end" : "middle"; const tx = el("text", { x: X(i), y: B + 13, "text-anchor": an, "font-size": 8.5, fill: "#9ca3af" }); tx.textContent = lb; svg.appendChild(tx) })
    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: CO.cross, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 }); svg.appendChild(cross)
    // 라인 + 주 시리즈 그라디언트 면적 + 적응형 점(EconChart와 동일 어법)
    const gid = "fxg" + Math.random().toString(36).slice(2, 8)
    const showDots = n <= 16
    const prim = series.find((s) => (s.w ?? 1.6) >= 2) ?? series[0]
    if (prim) { const defs = el("defs", {}); defs.innerHTML = '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + prim.color + '" stop-opacity="0.16"/><stop offset="100%" stop-color="' + prim.color + '" stop-opacity="0"/></linearGradient>'; svg.appendChild(defs) }
    series.forEach((s) => {
      const w = s.w ?? 1.6, isPrim = s === prim
      const pts = s.data.map((v, i) => [X(i), Y(v)])
      if (isPrim && pts.length > 1) {
        const ar = el("polygon", { points: pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + " " + pts[pts.length - 1][0].toFixed(1) + "," + B + " " + pts[0][0].toFixed(1) + "," + B, fill: "url(#" + gid + ")", stroke: "none" })
        ar.style.opacity = "0"; svg.appendChild(ar); void (ar as unknown as SVGGraphicsElement).getBoundingClientRect(); ar.style.transition = "opacity .8s ease .55s"; ar.style.opacity = "1"
      }
      const pl = el("polyline", { points: pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "), fill: "none", stroke: s.color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round" }); svg.appendChild(pl)
      const len = (pl as unknown as SVGPolylineElement).getTotalLength()
      pl.style.strokeDasharray = String(len); pl.style.strokeDashoffset = String(len)
      void (pl as unknown as SVGGraphicsElement).getBoundingClientRect()
      pl.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.22,1,.36,1)"; pl.style.transitionDelay = "0.18s"
      pl.style.strokeDashoffset = "0"
      if (showDots) pts.forEach((p) => { const c = el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: w >= 2 ? 2.5 : 2.1, fill: CO.halo, stroke: s.color, "stroke-width": 1.3 }); c.style.opacity = "0"; svg.appendChild(c); void (c as unknown as SVGGraphicsElement).getBoundingClientRect(); c.style.transition = "opacity .5s ease 1.5s"; c.style.opacity = "1" })
    })
    // 끝점 라벨 카드 — 필리핀 위치를 우측 끝 소형 핀 카드로(굵기 강조 대체)
    series.forEach((s) => {
      if (!s.endLabel) return
      let li = -1; for (let i = s.data.length - 1; i >= 0; i--) { if (Number.isFinite(s.data[i])) { li = i; break } }
      if (li < 0) return
      const ex = X(li), ey = Y(s.data[li]), py = Math.max(T + 7, Math.min(B - 7, ey)), tw = s.endLabel.length * 6.2 + 12
      const g = el("g", {}); g.style.opacity = "0"; g.style.transition = "opacity .5s ease"; g.style.transitionDelay = "1.4s"
      g.appendChild(el("circle", { cx: ex, cy: ey, r: 2.4, fill: s.color, stroke: CO.halo, "stroke-width": 1.2 }))
      if (Math.abs(py - ey) > 1) g.appendChild(el("line", { x1: ex, y1: ey, x2: ex + 5, y2: py, stroke: s.color, "stroke-width": 1, opacity: 0.5 }))
      g.appendChild(el("rect", { x: ex + 5, y: py - 7, width: tw, height: 14, rx: 4, fill: CO.halo, stroke: s.color, "stroke-width": 1.1 }))
      const t = el("text", { x: ex + 5 + tw / 2, y: py + 2.9, "text-anchor": "middle", "font-size": 8.4, "font-weight": 800, fill: s.color }); t.textContent = s.endLabel
      g.appendChild(t); svg.appendChild(g)
      void (g as unknown as SVGGraphicsElement).getBoundingClientRect(); g.style.opacity = "1"
    })
    // 호버 활성점: 시리즈당 1개, 평소 opacity 0 (핵심요약 호버와 동일한 어법)
    const adots: SVGElement[] = series.map((s) => {
      const c = el("circle", { r: 4.2, fill: s.color, stroke: CO.halo, "stroke-width": 1.6, opacity: 0 }); svg.appendChild(c); return c
    })
    const head = document.createElement("div"); head.className = "mb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500"; tip.appendChild(head)
    const valNodes: HTMLElement[] = []
    series.forEach((s) => {
      const row = document.createElement("div"); row.className = "flex items-center gap-2 whitespace-nowrap text-[11px] leading-4"
      const dot = document.createElement("span"); dot.className = "inline-block h-2 w-2 shrink-0 rounded-full"; dot.style.background = s.color
      const nm = document.createElement("span"); nm.className = "text-gray-500 dark:text-gray-400"; nm.textContent = s.name
      const v = document.createElement("b"); v.className = "ml-auto tabular-nums font-semibold text-gray-800 dark:text-gray-100"
      row.appendChild(dot); row.appendChild(nm); row.appendChild(v); tip.appendChild(row); valNodes.push(v)
    })
    let active = -1, curX = X(0), tgtX = X(0), cOp = 0, tOp = 0, curTop = T, tgtTop = T, rectW = 300, rectH = 120, raf = 0
    const place = (i: number) => {
      active = i; head.textContent = "20" + labels[i]
      const tops: number[] = []
      series.forEach((s, si) => {
        const v = s.data[i]; valNodes[si].textContent = v.toFixed(decimals) + unit; const y = Y(v); tops.push(y)
        adots[si].setAttribute("cx", X(i).toFixed(1)); adots[si].setAttribute("cy", y.toFixed(1))
      })
      tgtTop = tops.length ? Math.min(...tops) : T
    }
    const loop = () => {
      curX += (tgtX - curX) * 0.3; curTop += (tgtTop - curTop) * 0.3; cOp += (tOp - cOp) * 0.3
      cross.setAttribute("x1", curX.toFixed(1)); cross.setAttribute("x2", curX.toFixed(1)); cross.setAttribute("opacity", cOp.toFixed(2))
      adots.forEach((d) => d.setAttribute("opacity", cOp.toFixed(2)))
      const sx = rectW / 300, sy = rectH / 74
      tip.style.left = (curX * sx).toFixed(1) + "px"; tip.style.top = (curTop * sy - 12).toFixed(1) + "px"; tip.style.transform = "translate(-50%,-100%)"
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect(); rectW = rect.width; rectH = rect.height
      const px = ((e.clientX - rect.left) / rect.width) * 300
      const i = Math.max(0, Math.min(n - 1, Math.round((px - L) / (R - L) * (n - 1))))
      tgtX = X(i); if (i !== active) place(i); tOp = 1; tip.style.opacity = "1"
    }
    const leave = () => { tOp = 0; tip.style.opacity = "0"; active = -1 }
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", leave)
    return () => { cancelAnimationFrame(raf); svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerdown", move); svg.removeEventListener("pointerleave", leave) }
  }, [series, labels, decimals, unit, dark])
  return (
    <div className="relative mt-1 mx-auto w-full max-w-[900px]" style={{ touchAction: "none" }}>
      <svg ref={svgRef} viewBox="0 0 300 74" width="100%" style={{ height: "auto", display: "block", cursor: "crosshair", overflow: "visible" }} />
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 z-10 w-max whitespace-nowrap rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 shadow-lg transition-opacity" style={{ opacity: 0 }} />
    </div>
  )
}

function Lg({ c, t, b }: { c: string; t: string; b?: boolean }) {
  return <span className="inline-flex items-center gap-1.5" style={{ color: b ? "#6366f1" : "#6b7280", fontWeight: b ? 700 : 500 }}><span className="inline-block h-0 w-3" style={{ borderTop: "2.4px solid " + c }} />{t}</span>
}

// 색=신호(DESIGN §1): 채운 배지·틴트 카드 금지 — 강조는 indigo, 신호는 dot
type Tone = "rose" | "amber" | "emerald"

function ChartCard({ title, unit, legend, series, labels, decimals, seriesUnit, meaning, ai, src }: {
  title: string; unit?: string; legend: React.ReactNode; series: SLine[]; labels: string[]; decimals?: number; seriesUnit?: string
  meaning: React.ReactNode; ai: React.ReactNode; tone: Tone; src: React.ReactNode
}) {
  const [aiOpen, setAiOpen] = React.useState(false)
  return (
    <div className="relative z-0 flex h-full flex-col rounded-xl p-3.5 transition-all duration-300 ease-out hover:z-30 hover:-translate-y-0.5 hover:shadow-md" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex items-center gap-2">
        <h3 className="text-[13.5px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h3>
        {unit && <span className="text-[10.5px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>}
      </div>
      <div className="mt-1.5 flex min-h-[30px] flex-wrap items-start gap-x-3 gap-y-1 text-[10.5px]">{legend}</div>
      <FxChart series={series} labels={labels} decimals={decimals} unit={seriesUnit} />
      <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">의미</b> {meaning}</p>
      {ai && (
        <>
          <button type="button" onClick={() => setAiOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 transition-colors hover:text-indigo-700 dark:hover:text-indigo-300">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>
            LG 인사이트
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: aiOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div style={{ display: "grid", gridTemplateRows: aiOpen ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(.22,1,.36,1)" }}>
            <div className="overflow-hidden"><div className="mt-1.5 border-l-2 border-indigo-300 dark:border-indigo-500/40 pl-2.5"><p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{ai}</p></div></div>
          </div>
        </>
      )}
      <p className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">{src}</p>
    </div>
  )
}

export default function FxView() {
  const [, setS] = React.useState<Strip | null>(null)
  const [open, setOpen] = React.useState(false)
  const [win, setWin] = React.useState("2Y")
  const [banner, setBanner] = React.useState<Banner>(FX_BANNER)
  React.useEffect(() => { fxStrip().then(setS).catch(() => setS({ asOf: null, pairs: {}, peers: [] })) }, [])
  React.useEffect(() => { pageBanner("fx").then((b) => { if (b) setBanner(b as Banner) }).catch(() => {}) }, [])

  const n = WINDOWS.find((w) => w.k === win)!.n
  const labels = lastN(DATA.labels, n)
  const region = [
    { name: "필리핀", color: "#4338ca", w: 1.6, data: strengthOf(lastN(DATA.region.ph, n)), endLabel: "필리핀" }, // 굵기 강조 대신 우측 끝 라벨 카드로 위치 표기
    { name: "인니", color: "#ef4444", w: 1.6, data: strengthOf(lastN(DATA.region.id, n)) },
    { name: "말련", color: "#0ea5e9", w: 1.6, data: strengthOf(lastN(DATA.region.my, n)) },
    { name: "태국", color: "#10b981", w: 1.6, data: strengthOf(lastN(DATA.region.th, n)) },
    { name: "베트남", color: "#f59e0b", w: 1.6, data: strengthOf(lastN(DATA.region.vn, n)) },
    { name: "싱가포르", color: "#a855f7", w: 1.6, data: strengthOf(lastN(DATA.region.sg, n)) },
  ]
  const fxusd = [{ name: "₱/USD", color: "#6366f1", w: 2, data: lastN(DATA.fxusd, n) }]
  const won = [{ name: "₩/₱", color: "#0f766e", w: 2, data: lastN(DATA.extra.wonperpeso, n) }]
  const asia = [
    { name: "위안 CNY", color: "#dc2626", w: 2, data: idx100(lastN(DATA.asia.cny, n)) },
    { name: "루피 INR", color: "#7c3aed", data: idx100(lastN(DATA.asia.inr, n)) },
  ]
  const jpyeur = [
    { name: "엔 JPY", color: "#0284c7", w: 2, data: idx100(lastN(DATA.extra.pesoperjpy, n)) },
    { name: "유로 EUR", color: "#b45309", data: idx100(lastN(DATA.extra.pesopereur, n)) },
  ]
  const eer = [
    { name: "NEER 명목", color: "#6366f1", w: 2, data: lastN(DATA.eer.neer, n) },
    { name: "REER 실질", color: "#a1795b", data: lastN(DATA.eer.reer, n) },
  ]


  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      {/* 카테고리별 인사이트 배너 — 다른 카테고리와 통일해 잠깐 숨김(추후 false 제거로 복구) */}
      {false && <InsightBanner banner={banner} open={open} onToggle={() => setOpen((v) => !v)} />}

      {/* 본문: 차트(우측 위젯 제거 — 경제일정 레일과 중복) */}
      <div className="grid items-start gap-4">
        <section className="min-w-0 rounded-xl p-4" style={{ animation: "fadeUp .34s cubic-bezier(.22,1,.36,1) both" }}>
          <header className="mb-3.5 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">환율</h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">필리핀 페소 · 대달러·역내·조달통화·실효환율</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="hidden text-[10.5px] text-gray-400 dark:text-gray-500 sm:inline">{labels[0]} → {labels[labels.length - 1]}</span>
              <Segmented size="sm" value={win} onChange={setWin} options={WINDOWS.map((w) => ({ k: w.k, label: w.k }))} />
            </span>
          </header>
          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            <ChartCard title="동남아 6개국 통화 약세도" unit="대미달러 · 창 시작=100 · 위=절하" labels={labels} series={region} tone="rose"
              legend={<><Lg c="#4338ca" t="필리핀" b /><Lg c="#ef4444" t="인니" /><Lg c="#0ea5e9" t="말련" /><Lg c="#10b981" t="태국" /><Lg c="#f59e0b" t="베트남" /><Lg c="#a855f7" t="싱가포르" /></>}
              meaning={<>대미달러 가치 지수화(시작=100) — <b className="text-gray-700 dark:text-gray-200">아래로 갈수록 약세</b></>}
              ai={<>페소는 5년간 대미달러 약 18% 절하로 <b className="font-semibold text-rose-600 dark:text-rose-400">역내 최대 낙폭</b>. 페소로 결제하지 않는 한 경쟁국 대비 원가 방어력이 약함 → 헤지·현지조달 확대 검토.</>}
              src={<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> Alpha Vantage 월별 양자환율</>} />
            <ChartCard title="₱/USD 기본 환율" unit="달러당 페소" labels={labels} series={fxusd} seriesUnit="" decimals={2} tone="rose"
              legend={<Lg c="#6366f1" t="₱/USD 월 종가" b />}
              meaning={<>조달·결제의 기준 환율. <b className="text-gray-700 dark:text-gray-200">오를수록 페소 약세</b>.</>}
              ai={<>₱/USD가 <b className="font-semibold text-rose-600 dark:text-rose-400">60선을 넘어 사상 최저권</b>. 달러결제 부품·완제품 원가가 구조적 상방 → 판가 전가 여력·달러 헤지 비율 점검.</>}
              src={<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> Alpha Vantage 월별 (USD/PHP) · 일별 BSP fx_daily</>} />
            <ChartCard title="원/페소 (한국 조달)" unit="페소당 원" labels={labels} series={won} seriesUnit="" decimals={2} tone="emerald"
              legend={<Lg c="#0f766e" t="₩/₱ 월 종가" b />}
              meaning={<>페소로 살 수 있는 원. <b className="text-gray-700 dark:text-gray-200">오를수록 페소가 원에 강세</b>(한국 조달 유리).</>}
              ai={<>원/페소 25선으로 <b className="font-semibold text-emerald-600 dark:text-emerald-400">페소가 원에 상대적 강세</b> → 한국 조달분(비중 大) 원가는 상대적 완충. 원 약세 지속 시 한국 소싱 확대가 유리.</>}
              src={<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> Alpha Vantage 월별 (USD/KRW ÷ USD/PHP)</>} />
            <ChartCard title="위안·루피의 대페소 가치" unit="창 시작=100" labels={labels} series={asia} tone="rose"
              legend={<><Lg c="#dc2626" t="위안 CNY/₱" /><Lg c="#7c3aed" t="루피 INR/₱" /></>}
              meaning={<>가전 조달통화(중국·인도)의 대페소 가치 — <b className="text-gray-700 dark:text-gray-200">오를수록 조달비 상승</b>.</>}
              ai={<>위안이 대페소 <b className="font-semibold text-rose-600 dark:text-rose-400">+17% 강세</b> — 중국 조달 비중이 큰 만큼 원가 압박의 핵심. 대체 소싱(인도·인니)·결제통화 조정이 방어 1순위.</>}
              src={<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> Alpha Vantage 월별 · 대페소 환산, 창 시작=100</>} />
            <ChartCard title="엔·유로의 대페소 가치" unit="창 시작=100" labels={labels} series={jpyeur} tone="amber"
              legend={<><Lg c="#0284c7" t="엔 JPY/₱" /><Lg c="#b45309" t="유로 EUR/₱" /></>}
              meaning={<>일본·유럽 조달통화의 대페소 가치 — <b className="text-gray-700 dark:text-gray-200">오를수록 조달비 상승</b>.</>}
              ai={<>엔은 대페소 <b className="font-semibold text-emerald-600 dark:text-emerald-400">약세</b>로 일본 조달·부품 원가 우호적, 유로는 <b className="font-semibold text-amber-600 dark:text-amber-400">+18% 강세</b>로 유럽 조달 부담. 통화 국면에 맞춰 소싱 믹스 조정.</>}
              src={<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> Alpha Vantage 월별 · 대페소 환산, 창 시작=100</>} />
            <ChartCard title="페소 실효환율 NEER·REER" unit="BIS · 2020=100" labels={labels} series={eer} tone="amber"
              legend={<><Lg c="#6366f1" t="NEER 명목" b /><Lg c="#a1795b" t="REER 실질" /></>}
              meaning={<><b className="text-gray-700 dark:text-gray-200">NEER</b>=명목 교역가중, <b className="text-gray-700 dark:text-gray-200">REER</b>=물가반영 실질</>}
              ai={<>명목(NEER) 96.8→88.7 약세지만 실질(REER)은 98선 유지 — <b className="font-semibold text-amber-600 dark:text-amber-400">물가가 명목 약세를 상쇄</b>. 원가는 오르는데 실질 구매력은 정체 → 저가·필수형 우선, 프리미엄은 심리 반등 후.</>}
              src={<><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> BIS 실효환율 공식통계 (Broad, 64개국)</>} />
          </div>
        </section>

      </div>
    </div>
  )
}
