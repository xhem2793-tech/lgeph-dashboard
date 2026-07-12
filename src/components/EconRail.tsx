"use client"

import React from "react"
import { homeBand, econSeries } from "@/lib/supabase"

/** 주요지표 레일 — 월별·분기 지표만.
 *
 *  ■ 왜 일별(환율)·주간(유가)·수시(태풍)를 뺐나
 *   같은 홈 화면 아래에 경제지표 3카드(환율·유가·날씨)가 그대로 있다. 두 번 보여줄 이유가 없다.
 *   레일은 "느리게 움직이지만 수요를 결정하는 축"(물가·전기요금·송금·소비심리)만 맡는다.
 *
 *  ■ 접힌 줄에도 추세가 보인다
 *   미리보기 선(축 없음) = 그 줄의 최근 12개 관측치. 누르면 같은 데이터를 경제지표 페이지와
 *   동일한 어법(인디고 선+점, 전년 회색 선, 축·그리드, 크로스헤어 툴팁)으로 펼친다.
 *   축소판을 따로 만들지 않고 원본을 펼치기 때문에 두 화면의 시각 언어가 어긋나지 않는다.
 *
 *  ■ 색은 방향이 아니라 사업영향 (BRANDING_GUIDE §4.1)
 *   dir='bad'  : 오르면 나쁜 지표(물가·전기요금) → 상승 = 로즈
 *   dir='good' : 오르면 좋은 지표(송금·소비심리) → 하락 = 로즈
 */
type Card = Awaited<ReturnType<typeof homeBand>>[number]
type Series = Awaited<ReturnType<typeof econSeries>>[string]

const IND = "#4f46e5"
const GRY = "#9ca3af"
const GRID = "#e5e7eb"

const unit = (l: string) => (l.includes("%p") ? "%p" : "%")

function impact(c: Card): { bad: boolean; up: boolean } {
  const up = (c.delta ?? 0) > 0
  const bad = c.dir === "bad" ? up : !up
  return { bad, up }
}

/** 기간 라벨 — 월별은 "6월", 분기는 "2Q26" */
function periodLabel(iso: string, freq: string) {
  const y = iso.slice(2, 4)
  const m = Number(iso.slice(5, 7))
  if (freq === "분기") return `${Math.floor((m - 1) / 3) + 1}Q${y}`
  return `${m}월`
}

/** 송금은 원자료가 절대값(달러) — 10억 단위로 읽는다 */
const scale = (key: string, v: number) => (key === "remit" ? v / 1e9 : v)
const fmt = (key: string, v: number) => (key === "remit" ? `$${scale(key, v).toFixed(2)}B` : v.toFixed(1))

/** 변화 배지 — 가격 동향(MoverDelta)과 동일: 화살표 + 4초마다 변화폭 ↔ 값 교대 */
function DeltaBadge({ c }: { c: Card }) {
  const { bad, up } = impact(c)
  const [mode, setMode] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setMode((m) => (m === 0 ? 1 : 0)), 4000)
    return () => clearInterval(id)
  }, [])
  if (c.delta == null || c.delta === 0) return <span className="text-[10px] text-gray-400">보합</span>
  return (
    <span
      className={
        "inline-flex w-[64px] items-center rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums transition-transform duration-300 ease-out hover:-translate-y-0.5 " +
        (bad ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")
      }
    >
      <span className="w-[9px] shrink-0 text-left">{up ? "↑" : "↓"}</span>
      <span key={mode} className="flex-1 text-right" style={{ animation: "badgeSwap .45s cubic-bezier(.22,1,.36,1) both" }}>
        {mode === 1 ? `${c.prefix}${c.value}` : `${Math.abs(c.delta).toFixed(1)}${unit(c.deltaLabel ?? "")}`}
      </span>
    </span>
  )
}

/** 접힌 줄의 추세 미리보기 — 축·그리드 없음, 마지막 점만 강조 */
function Preview({ pts }: { pts: number[] }) {
  if (!pts || pts.length < 2) return <div className="h-[26px] w-[58px] shrink-0" />
  const W = 58, H = 26, L = 1, R = W - 3, T = 4, B = H - 4
  const lo = Math.min(...pts), hi = Math.max(...pts)
  const pad = (hi - lo || 1) * 0.2
  const LO = lo - pad, HI = hi + pad, n = pts.length
  const X = (i: number) => L + (i / (n - 1)) * (R - L)
  const Y = (v: number) => B - ((v - LO) / (HI - LO)) * (B - T)
  const line = pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")
  const area = `M${pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L")} L${R},${B} L${L},${B} Z`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
      <path d={area} fill={IND} opacity={0.07} />
      <polyline points={line} fill="none" stroke={IND} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(n - 1)} cy={Y(pts[n - 1])} r={2.4} fill={IND} stroke="#fff" strokeWidth={1} />
    </svg>
  )
}

/** 펼침 차트 — 경제지표 페이지 ProChart와 동일 어법 */
function ProChart({ s, freq, keyName }: { s: Series; freq: string; keyName: string }) {
  const ref = React.useRef<SVGSVGElement | null>(null)
  const tipRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const svg = ref.current
    const tip = tipRef.current
    if (!svg || !tip) return
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const NS = "http://www.w3.org/2000/svg"
    const el = (n: string, a: Record<string, string | number>) => {
      const e = document.createElementNS(NS, n)
      for (const k in a) e.setAttribute(k, String(a[k]))
      return e
    }
    const cur = s.points.map((v) => scale(keyName, v))
    const prevRaw = s.prev
    const prev = prevRaw.every((v) => v == null) ? null : prevRaw.map((v) => (v == null ? NaN : scale(keyName, v)))
    const all = [...cur, ...(prev ?? [])].filter((v) => Number.isFinite(v))
    if (all.length < 2) return

    const W = 300, H = 104, L = 30, R = 294, T = 8, B = 78
    const lo = Math.min(...all), hi = Math.max(...all)
    const pad = (hi - lo || 1) * 0.15
    const LO = lo - pad, HI = hi + pad, n = cur.length
    const X = (i: number) => L + (i / (n - 1)) * (R - L)
    const Y = (v: number) => B - ((v - LO) / (HI - LO)) * (B - T)

    for (const t of [LO + (HI - LO) * 0.06, (LO + HI) / 2, HI - (HI - LO) * 0.06]) {
      svg.appendChild(el("line", { x1: L, y1: Y(t), x2: R, y2: Y(t), stroke: GRID, "stroke-width": 1 }))
      const tx = el("text", { x: L - 5, y: Y(t) + 3, "text-anchor": "end", "font-size": 8, fill: "#9ca3af" })
      tx.textContent = t.toFixed(1)
      svg.appendChild(tx)
    }
    const labels = s.dates.map((d) => periodLabel(d, freq))
    const every = Math.ceil(n / 6)
    labels.forEach((lb, i) => {
      if ((n - 1 - i) % every) return
      const tx = el("text", { x: X(i), y: B + 13, "text-anchor": "middle", "font-size": 8, fill: "#9ca3af" })
      tx.textContent = lb
      svg.appendChild(tx)
    })

    const draw = (vals: number[], color: string, w: number) => {
      const pts = vals.map((v, i) => [X(i), Y(v)] as const).filter((p) => Number.isFinite(p[1]))
      const pl = el("polyline", {
        points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
        fill: "none", stroke: color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round",
      }) as SVGPolylineElement
      svg.appendChild(pl)
      const dots = vals.map((v, i) => {
        if (!Number.isFinite(v)) return null
        const c = el("circle", { cx: X(i), cy: Y(v), r: 3, fill: "#fff", stroke: color, "stroke-width": 1.4 })
        svg.appendChild(c)
        return c
      })
      const len = pl.getTotalLength()
      pl.style.strokeDasharray = String(len)
      pl.style.strokeDashoffset = String(len)
      pl.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.22,1,.36,1)"
      pl.style.transitionDelay = "0.15s"
      requestAnimationFrame(() => requestAnimationFrame(() => { pl.style.strokeDashoffset = "0" }))
      return dots
    }
    const dPrev = prev ? draw(prev, GRY, 1.6) : null
    const dCur = draw(cur, IND, 2)

    const cross = el("line", { x1: 0, y1: T, x2: 0, y2: B, stroke: "#c3c8d0", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0 })
    svg.appendChild(cross)

    const onMove = (e: MouseEvent) => {
      const bb = svg.getBoundingClientRect()
      const i = Math.max(0, Math.min(n - 1, Math.round((((e.clientX - bb.left) / bb.width) * W - L) / ((R - L) / (n - 1)))))
      cross.setAttribute("x1", String(X(i)))
      cross.setAttribute("x2", String(X(i)))
      cross.setAttribute("opacity", "1")
      const sets: [(SVGElement | null)[] | null, string][] = [[dCur, IND], [dPrev, GRY]]
      for (const [ds, col] of sets) {
        if (!ds) continue
        ds.forEach((c, j) => {
          if (!c) return
          c.setAttribute("r", j === i ? "5" : "3")
          c.setAttribute("fill", j === i ? col : "#fff")
        })
      }
      tip.style.opacity = "1"
      tip.innerHTML =
        `<div class="text-[10px] text-gray-400">${labels[i]}</div>` +
        (prev && Number.isFinite(prev[i])
          ? `<div class="flex justify-between gap-3"><span class="text-gray-500">전년</span><b class="text-gray-500">${fmt(keyName, prevRaw[i] as number)}</b></div>`
          : "") +
        `<div class="flex justify-between gap-3"><span class="text-gray-500">현재</span><b class="text-indigo-600">${fmt(keyName, s.points[i])}</b></div>`
      tip.style.left = `${(X(i) / W) * bb.width}px`
      tip.style.top = `${(Y(cur[i]) / H) * 108 - 10}px`
      tip.style.transform = "translate(-50%,-100%)"
    }
    const onLeave = () => {
      cross.setAttribute("opacity", "0")
      tip.style.opacity = "0"
      for (const ds of [dCur, dPrev]) ds?.forEach((c) => { if (c) { c.setAttribute("r", "3"); c.setAttribute("fill", "#fff") } })
    }
    svg.addEventListener("mousemove", onMove)
    svg.addEventListener("mouseleave", onLeave)
    return () => {
      svg.removeEventListener("mousemove", onMove)
      svg.removeEventListener("mouseleave", onLeave)
    }
  }, [s, freq, keyName])

  const hasPrev = !s.prev.every((v) => v == null)
  return (
    <div className="mx-2.5 mb-2.5 rounded-lg bg-[#f9fafb] p-2">
      <div className="flex justify-end gap-2.5 px-1 pb-1 text-[10px] text-gray-400">
        {hasPrev ? (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: GRY }} />전년
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: IND }} />현재
        </span>
      </div>
      <div className="relative">
        <svg ref={ref} viewBox="0 0 300 104" width="100%" height="108" style={{ overflow: "visible" }} />
        <div
          ref={tipRef}
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] shadow-lg transition-opacity duration-150"
          style={{ opacity: 0 }}
        />
      </div>
    </div>
  )
}

const GROUPS = ["월별", "분기"] as const

export default function EconRail() {
  const [rows, setRows] = React.useState<Card[] | null>(null)
  const [series, setSeries] = React.useState<Record<string, Series>>({})
  const [open, setOpen] = React.useState<string | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    Promise.all([homeBand(), econSeries()])
      .then(([b, s]) => {
        setRows(b.filter((c) => c.freq === "월별" || c.freq === "분기"))
        setSeries(s)
      })
      .catch(() => setErr(true))
  }, [])

  const asOf = (c: Card) => (c.asOf ? `${c.asOf.slice(0, 4)}.${c.asOf.slice(5, 7)} 기준` : "—")

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      <header className="flex items-baseline justify-between border-b border-gray-100 px-3.5 py-3.5">
        <a href="/economy" className="group flex items-baseline gap-1">
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">주요지표</h2>
          <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
        </a>
        <span className="text-[10px] text-gray-400">누르면 상세 차트</span>
      </header>

      {err ? (
        <p className="px-3 py-6 text-center text-[12px] text-gray-400">지표를 불러오지 못함 · 확인 필요</p>
      ) : (
        GROUPS.map((g) => {
          const list = (rows ?? []).filter((c) => c.freq === g)
          if (rows && list.length === 0) return null
          return (
            <div key={g}>
              <p className="border-b border-gray-100 bg-gray-50/70 px-3.5 py-1.5 text-[10px] font-semibold text-gray-400">{g} 지표</p>
              {(rows ? list : (Array.from({ length: 3 }) as (Card | undefined)[])).map((c, i) =>
                !c ? (
                  <div key={i} className="h-[46px] border-b border-gray-50" />
                ) : (
                  <div key={c.key}>
                    <button
                      type="button"
                      onClick={() => setOpen(open === c.key ? null : c.key)}
                      className={
                        "flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2 text-left transition-all duration-300 ease-out " +
                        (open === c.key ? "bg-indigo-50/60" : "hover:-translate-y-0.5 hover:bg-gray-50")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-gray-700">{c.label}</p>
                        <p className="text-[10px] text-gray-400">{asOf(c)}</p>
                      </div>

                      <Preview pts={(series[c.key]?.points ?? []).map((v) => scale(c.key, v))} />

                      <div className="flex w-[66px] shrink-0 flex-col items-end gap-0.5">
                        <p className="text-[14px] font-bold tabular-nums text-gray-900">
                          {c.prefix}
                          {c.value}
                        </p>
                        <DeltaBadge c={c} />
                      </div>

                      <span className={"shrink-0 text-[10px] text-gray-300 transition-transform duration-300 " + (open === c.key ? "rotate-180" : "")}>▾</span>
                    </button>

                    {open === c.key && series[c.key] ? (
                      <div style={{ animation: "fadeUp .35s cubic-bezier(.22,1,.36,1) both" }}>
                        <ProChart s={series[c.key]} freq={c.freq} keyName={c.key} />
                      </div>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          )
        })
      )}

      <p className="border-t border-gray-100 px-3.5 py-2 text-[10px] leading-snug text-gray-400">
        배지 색은 <b className="font-semibold text-gray-500">사업영향</b> 기준 · 4초마다 변화폭 ↔ 값 교대
      </p>
    </section>
  )
}
