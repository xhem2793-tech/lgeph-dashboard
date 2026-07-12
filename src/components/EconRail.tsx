"use client"

import React from "react"
import { homeBand, econSeries } from "@/lib/supabase"
import { ProChart, CountUp } from "@/components/ProChartCore"

/** 주요지표 레일 — 월별·분기 지표.
 *
 *  ■ 일별(환율)·주간(유가)·수시(태풍)는 없다
 *   같은 홈 화면 아래에 경제지표 3카드(환율·유가·날씨)가 그대로 있다. 두 번 보여줄 이유가 없다.
 *   레일은 "느리지만 수요를 결정하는 축"(물가·전기요금·가전물가·송금·소비심리·성장률)만 맡는다.
 *
 *  ■ 접힌 줄에도 추세가 보인다
 *   한 줄 = 지표명 · 미리보기 선 · 현재값(단위·부호 포함) · 변화 배지.
 *   누르면 경제지표 페이지와 **같은 코드**(ProChartCore)로 차트를 펼친다. 축소판을 새로 그리지 않는다.
 *
 *  ■ 색은 방향이 아니라 사업영향 (BRANDING_GUIDE §4.1)
 */
type Card = Awaited<ReturnType<typeof homeBand>>[number]
type Series = Awaited<ReturnType<typeof econSeries>>[string]

const IND = "#6366f1"

const pctUnit = (l: string) => (l.includes("%p") ? "%p" : "%")

function impact(c: Card) {
  const up = (c.delta ?? 0) > 0
  const bad = c.dir === "bad" ? up : !up
  return { bad, up }
}

/** 기간 라벨 — 월별 "6월", 분기 "2Q26" */
function periodLabel(iso: string, freq: string) {
  const y = iso.slice(2, 4)
  const m = Number(iso.slice(5, 7))
  return freq === "분기" ? `${Math.floor((m - 1) / 3) + 1}Q${y}` : `${m}월`
}

/** 송금 원자료는 절대값(달러) — 10억 단위로 읽는다 */
const scale = (key: string, v: number) => (key === "remit" ? v / 1e9 : v)

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
        "inline-flex w-[66px] items-center rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums transition-transform duration-300 ease-out hover:-translate-y-0.5 " +
        (bad ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")
      }
    >
      <span className="w-[9px] shrink-0 text-left">{up ? "↑" : "↓"}</span>
      <span key={mode} className="flex-1 text-right" style={{ animation: "badgeSwap .45s cubic-bezier(.22,1,.36,1) both" }}>
        {mode === 1 ? (
          <CountUp value={Number(c.value)} prefix={c.prefix} suffix={c.suffix} decimals={c.key === "remit" ? 2 : 1} />
        ) : (
          <CountUp value={Math.abs(c.delta)} suffix={pctUnit(c.deltaLabel ?? "")} decimals={1} />
        )}
      </span>
    </span>
  )
}

/** 접힌 줄의 추세 미리보기 — 축 없음, 마지막 점만 */
function Preview({ pts }: { pts: number[] }) {
  if (!pts || pts.length < 2) return <div className="h-[22px] w-[54px] shrink-0" />
  const W = 54, H = 22, L = 1, R = W - 3, T = 3, B = H - 3
  const lo = Math.min(...pts), hi = Math.max(...pts)
  const pad = (hi - lo || 1) * 0.2
  const LO = lo - pad, HI = hi + pad, n = pts.length
  const X = (i: number) => L + (i / (n - 1)) * (R - L)
  const Y = (v: number) => B - ((v - LO) / (HI - LO)) * (B - T)
  const line = pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
      <path d={`M${pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L")} L${R},${B} L${L},${B} Z`} fill={IND} opacity={0.07} />
      <polyline points={line} fill="none" stroke={IND} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(n - 1)} cy={Y(pts[n - 1])} r={2.3} fill={IND} stroke="#fff" strokeWidth={1} />
    </svg>
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

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      <header className="flex items-baseline justify-between border-b border-gray-100 px-3.5 py-2.5">
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
              <p className="border-b border-gray-100 bg-gray-50/70 px-3.5 py-1 text-[10px] font-semibold text-gray-400">{g} 지표</p>
              {(rows ? list : (Array.from({ length: 4 }) as (Card | undefined)[])).map((c, i) =>
                !c ? (
                  <div key={i} className="h-[36px] border-b border-gray-50" />
                ) : (
                  <div key={c.key}>
                    <button
                      type="button"
                      onClick={() => setOpen(open === c.key ? null : c.key)}
                      className={
                        "flex w-full items-center gap-2 border-b border-gray-50 px-3 py-1.5 text-left transition-all duration-300 ease-out " +
                        (open === c.key ? "bg-indigo-50/60" : "hover:-translate-y-0.5 hover:bg-gray-50")
                      }
                    >
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-800">{c.label}</p>

                      <Preview pts={(series[c.key]?.points ?? []).map((v) => scale(c.key, v))} />

                      <p className="w-[58px] shrink-0 text-right text-[13px] font-bold tabular-nums text-gray-900">
                        {c.prefix}
                        {c.value}
                        {c.suffix}
                      </p>

                      <DeltaBadge c={c} />

                    </button>

                    {open === c.key && series[c.key] ? (
                      <Detail c={c} s={series[c.key]} />
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

/** 펼침 — 경제지표 페이지 카드와 같은 어법(회색 서피스 · 값 CountUp · ProChart · 출처) */
function Detail({ c, s }: { c: Card; s: Series }) {
  const cur = s.points.map((v) => scale(c.key, v))
  const prevArr = s.prev.map((v) => (v == null ? NaN : scale(c.key, v)))
  // 전년 값이 하나라도 비면 선이 끊겨 차트가 깨진다 — 전 구간이 있을 때만 그린다
  const hasPrev = prevArr.length === cur.length && prevArr.every((v) => Number.isFinite(v))
  const labels = s.dates.map((d) => periodLabel(d, c.freq))
  const yr = s.dates[s.dates.length - 1]?.slice(0, 4) ?? ""
  const dec = c.key === "remit" ? 2 : 1

  return (
    <div className="px-2.5 pb-2.5" style={{ animation: "fadeUp .35s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="rounded-xl bg-[#f9fafb] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-gray-700">{c.label}</span>
          <div className="flex shrink-0 items-center gap-2.5 text-[10px] text-gray-400">
            {hasPrev ? (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#b4b2a9" }} />
                {String(Number(yr) - 1)}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: IND }} />
              {yr}
            </span>
          </div>
        </div>

        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[20px] font-semibold tabular-nums text-gray-900">
            <CountUp value={Number(c.value)} prefix={c.prefix} suffix={c.suffix} decimals={dec} />
          </span>
          <span className="text-[10px] text-gray-400/90">{c.asOf?.slice(0, 7).replace("-", ".")} 기준</span>
        </p>

        <ProChart
          cur={cur}
          prev={hasPrev ? prevArr : undefined}
          labels={labels}
          unit={c.suffix}
          curName={yr}
          prevName={String(Number(yr) - 1)}
          decimals={dec}
        />

        <div className="mt-2 border-t border-gray-200 pt-2">
          <span className="text-[10px] text-gray-400">출처 {c.freq === "분기" ? "BSP·PSA 분기" : "PSA·BSP 월별"} · {c.deltaLabel}</span>
        </div>
      </div>
    </div>
  )
}
