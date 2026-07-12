"use client"

import React from "react"
import { homeBand, econSpark, competitorMovers } from "@/lib/supabase"

/** 경제지표 + 가격 레일 — 야후 Trending tickers 어법(테두리 카드 · 미니차트 · 변화폭).
 *
 *  ■ 색은 방향이 아니라 **사업영향** 기준 (BRANDING_GUIDE §4.1)
 *   dir='bad'  : 오르면 나쁜 지표(환율·유가·물가) → 상승 = 로즈
 *   dir='good' : 오르면 좋은 지표(송금·소비심리) → 하락 = 로즈
 *   단순 상승=녹색 금지.
 *
 *  ■ 미니차트는 최근 12개 관측치. 축·눈금 없음(장식 아님, 추세만 읽는 용도).
 *  ■ 지표만으로는 "우리 시장"이 안 보여 오늘의 가격 변화를 같은 카드에 붙임.
 */
type Card = Awaited<ReturnType<typeof homeBand>>[number]
type Mover = Awaited<ReturnType<typeof competitorMovers>>[number]

function impact(c: Card): { cls: string; arrow: string; bad: boolean } {
  if (c.delta == null || c.dir === "neutral" || c.delta === 0)
    return { cls: "text-gray-400", arrow: "", bad: false }
  const up = c.delta > 0
  const bad = c.dir === "bad" ? up : !up
  return {
    cls: bad ? "text-rose-600" : "text-emerald-600",
    arrow: up ? "↑" : "↓",
    bad,
  }
}
const unit = (l: string) => (l.includes("%p") ? "%p" : "%")


/** 숫자 롤링 — 경제지표(유가·환율) 카드와 같은 어법. 지속 4s, ease-out cubic.
 *  값이 "차오르는" 4초 동안 사용자의 시선이 숫자에 머문다. 장식이 아니라 주의 유도. */
const DURATION = 4000
function CountUp({ text }: { text: string }) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    // 숫자가 아닌 값(예: 태풍명)은 애니메이션 대상이 아님 — 그대로 표시
    const m = text.match(/-?[\d,]+(\.\d+)?/)
    if (!m) { node.textContent = text; return }
    const raw = m[0]
    const to = Number(raw.replace(/,/g, ""))
    if (!Number.isFinite(to)) { node.textContent = text; return }
    const dec = raw.includes(".") ? raw.split(".")[1].length : 0
    const grouped = raw.includes(",")
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min((t - t0) / DURATION, 1)
      const e = 1 - Math.pow(1 - k, 3)
      const v = to * e
      const shown = grouped
        ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })
        : v.toFixed(dec)
      node.textContent = text.replace(raw, shown)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text])
  return <span ref={ref}>{text}</span>
}

/** 미니 차트 — 경제지표 페이지의 ProChart와 같은 어법.
 *  선을 stroke-dash로 1.5s 동안 "그려 나간다"(cubic-bezier(.22,1,.36,1)).
 *  값의 추세를 눈으로 따라가게 만드는 장치. 축·눈금 없음(시세판 아님). */
function Spark({ pts, bad }: { pts: number[]; bad: boolean }) {
  const ref = React.useRef<SVGPolylineElement | null>(null)
  const W = 60
  const H = 26

  React.useEffect(() => {
    const pl = ref.current
    if (!pl) return
    const len = pl.getTotalLength()
    pl.style.strokeDasharray = String(len)
    pl.style.strokeDashoffset = String(len)
    pl.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.22,1,.36,1)"
    pl.style.transitionDelay = "0.18s"
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        pl.style.strokeDashoffset = "0"
      }),
    )
  }, [pts])

  if (!pts || pts.length < 2) return <div style={{ width: W, height: H }} className="shrink-0" />

  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const step = W / (pts.length - 1)
  const xy = pts.map((v, i) => [i * step, H - ((v - min) / span) * (H - 6) - 3] as const)
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${xy[0][0]},${H} ${line} ${xy[xy.length - 1][0]},${H}`
  const stroke = bad ? "#e11d48" : "#059669"
  const fill = bad ? "rgba(225,29,72,.10)" : "rgba(5,150,105,.10)"
  const last = xy[xy.length - 1]

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
      <polygon points={area} fill={fill} />
      <polyline
        ref={ref}
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill="#fff" stroke={stroke} strokeWidth="1.4" />
    </svg>
  )
}

export default function EconRail() {
  const [rows, setRows] = React.useState<Card[] | null>(null)
  const [spark, setSpark] = React.useState<Record<string, number[]>>({})
  const [movers, setMovers] = React.useState<Mover[] | null>(null)
  const [err, setErr] = React.useState(false)

  React.useEffect(() => {
    Promise.all([homeBand(), econSpark(), competitorMovers(40)])
      .then(([b, s, m]) => {
        setRows(b)
        setSpark(s)
        // 오늘 실제로 움직인 것만, 변동폭 큰 순
        setMovers(
          m
            .filter((x) => x.pct != null && x.pct !== 0)
            .sort((a, b2) => Math.abs(b2.pct) - Math.abs(a.pct))
            .slice(0, 5),
        )
      })
      .catch(() => setErr(true))
  }, [])

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md" style={{ animation: "fadeUp .5s ease both" }}>
      <header className="flex items-baseline justify-between border-b border-gray-100 px-3 py-2">
        <h2 className="text-[16px] font-bold tracking-tight text-gray-900">경제지표</h2>
        <a
          href="/economy"
          className="text-[11px] text-gray-400 transition-colors duration-200 hover:text-indigo-600"
        >
          상세 ›
        </a>
      </header>

      {err ? (
        <p className="px-3 py-6 text-center text-[12px] text-gray-400">지표를 불러오지 못함 · 확인 필요</p>
      ) : (
        <div>
          {/* 주기별 섹션 — 일별 지표와 분기 지표를 한 줄에 섞으면
              "오늘 바뀐 것"과 "석 달에 한 번 바뀌는 것"이 같은 무게로 읽힌다. 갱신 주기가 다르면 자리를 나눈다 */}
          {["일별", "주간", "월별", "분기", "수시"].map((grp) => {
            const list = (rows ?? []).filter((c) => c.freq === grp)
            if (!rows) return null
            if (list.length === 0) return null
            return (
              <div key={grp} className="border-b border-gray-100 last:border-0">
                <p className="bg-gray-50/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {grp}
                </p>
                <div className="divide-y divide-gray-50">
                  {list.map((c) => (
                    <a
                      key={c.key}
                      href={"/economy#" + c.key}
                      className="group flex items-center gap-2 px-3 py-0.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold leading-tight text-gray-800 transition-colors duration-200 group-hover:text-indigo-600">
                          {c.label}
                        </p>
                        <p className="text-[10px] leading-tight text-gray-400">
                          {c.asOf?.slice(5).replace("-", "/")}
                        </p>
                      </div>

                      <Spark pts={spark[c.key] ?? []} bad={impact(c).bad} />

                      <div className="w-[92px] shrink-0 text-right">
                        <p className="text-[14px] font-bold leading-tight tabular-nums text-gray-900">
                          {c.prefix}
                          <CountUp text={c.value} />
                        </p>
                        {c.delta != null && c.delta !== 0 ? (
                          <p className={"text-[12px] font-semibold leading-tight tabular-nums " + impact(c).cls}>
                            <CountUp text={Math.abs(c.delta).toFixed(1)} />
                            {unit(c.deltaLabel ?? "")}
                            {impact(c).arrow}
                          </p>
                        ) : (
                          <p className="text-[12px] leading-tight text-gray-400">보합</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
          {!rows
            ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[30px]" />)
            : null}
        </div>
      )}

      {/* 가격 변화 — 지표만 보면 우리 시장이 안 보인다 */}
      <div className="border-t border-gray-200">
        <header className="flex items-baseline justify-between px-3 py-2">
          <h3 className="text-[14px] font-bold tracking-tight text-gray-900">오늘의 가격 변화</h3>
          <a
            href="/competitors"
            className="text-[11px] text-gray-400 transition-colors duration-200 hover:text-indigo-600"
          >
            전체 ›
          </a>
        </header>

        {movers && movers.length === 0 ? (
          <p className="px-3 pb-3 text-[12px] text-gray-400">오늘 가격 변동 없음</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {(movers ?? Array.from({ length: 3 })).map((m, i) =>
              !m ? (
                <div key={i} className="h-[34px]" />
              ) : (
                <a
                  key={i}
                  href="/competitors"
                  className="group flex items-center gap-2 px-3 py-1 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-gray-800 transition-colors duration-200 group-hover:text-indigo-600">
                      {m.brand} {m.category}
                    </p>
                    <p className="truncate text-[10px] text-gray-400">{m.retailer}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-bold tabular-nums text-gray-900">
                      ₱<CountUp text={Number(m.promo).toLocaleString("en-US")} />
                    </p>
                    <p
                      className={
                        "text-[12px] font-semibold tabular-nums " +
                        (m.pct < 0 ? "text-emerald-600" : "text-rose-600")
                      }
                    >
                      <CountUp text={Math.abs(m.pct).toFixed(1)} />%{m.pct < 0 ? "↓" : "↑"}
                    </p>
                  </div>
                </a>
              ),
            )}
          </div>
        )}
      </div>

      <p className="border-t border-gray-100 px-3 py-2 text-[10px] leading-snug text-gray-400">
        색은 <b className="font-semibold text-gray-500">사업영향</b> 기준 · 원가·물가↑는 로즈,
        수요·구매력 개선은 에메랄드 (단순 상승=녹색 아님)
      </p>
    </section>
  )
}
