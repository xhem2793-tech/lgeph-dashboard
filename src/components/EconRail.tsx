"use client"

import React from "react"
import { homeBand, econSeries, calendarMonth } from "@/lib/supabase"
import { ProChart, CountUp } from "@/components/ProChartCore"
import { useLang } from "@/lib/i18n"

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


/** 기간 라벨 — 월별 "6월", 분기 "2Q26" */
function periodLabel(iso: string, freq: string) {
  const y = iso.slice(2, 4)
  const m = Number(iso.slice(5, 7))
  return freq === "분기" ? `${Math.floor((m - 1) / 3) + 1}Q${y}` : `${m}월`
}

/** 송금 원자료는 절대값(달러) — 10억 단위로 읽는다 */
const scale = (key: string, v: number) => (key === "remit" ? v / 1e9 : v)

/** 변동률 두 칸 — 전월비 / 전년비를 각각 표기(교대 없음).
 *  숫자 글꼴은 기본(한글판과 동일) · tabular-nums. 레이아웃은 한글 기준 고정. */
function DeltaCell({ d, dir, unit, muted }: { d: number | null; dir: string | null; unit: string | null; muted?: boolean }) {
  if (d == null)
    return (
      <span className="num w-[60px] shrink-0 text-right text-[9px] text-gray-300">
        —
      </span>
    )
  const up = d > 0
  const flat = d === 0
  const bad = dir === "bad" ? up : !up
  return (
    <span
      className={
        "num inline-flex font-semibold w-[60px] shrink-0 items-center justify-end gap-0.5 rounded px-1 py-0.5 text-[9px] leading-4 " +
        (muted || flat ? "bg-gray-100 text-gray-500" : bad ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")
      }
    >
      <span>{flat ? "·" : up ? "↑" : "↓"}</span>
      <span key={String(d)} style={{ animation: "badgeSwap .45s cubic-bezier(.22,1,.36,1) both" }}>
        <CountUp value={Math.abs(d)} suffix={unit ?? ""} decimals={1} />
      </span>
    </span>
  )
}

/** 접힌 줄의 추세 미리보기 — 축 없음, 마지막 점만 */
function Preview({ pts }: { pts: number[] }) {
  if (!pts || pts.length < 2) return <div className="h-[20px] w-[40px] shrink-0" />
  const W = 40, H = 20, L = 1, R = W - 3, T = 3, B = H - 3
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

/** EN 라벨 축약 — 레이아웃은 한글 기준 고정이므로 영문은 약어로 맞춘다 */
const EN_SHORT: Record<string, string> = {
  fx: "USD/PHP",
  oil: "Diesel",
  elec: "Power CPI",
  cpi: "CPI",
  appinf: "Appl. CPI",
  acinf: "AC CPI",
  riceinf: "Rice CPI",
  foodinf: "Food CPI",
  traninf: "Transp. CPI",
  lpginf: "LPG CPI",
  ppiapp: "Appl. PPI",
  remit: "OFW Remit.",
  cci: "Cons. Conf.",
  durable: "Durables",
  retgva: "Retail GVA",
  congva: "Constr. GVA",
}

export default function EconRail() {
  const { lang, t, pick } = useLang()
  /** 변동률 기준을 4초마다 교대 — 지금 무엇을 보고 있는지는 헤더 우측 배지로 알린다 */
  const [mode, setMode] = React.useState<"mom" | "yoy">("yoy")
  /** 다음 발표 2건 — 캘린더까지 스크롤하지 않아도 "무엇이 다가오는가"가 보이게 */
  const [next2, setNext2] = React.useState<{ d: string; t: string }[]>([])
  React.useEffect(() => {
    calendarMonth()
      .then((cal: any[]) => {
        const up = (cal ?? [])
          .filter((e) => !e.past)
          .slice(0, 2)
          .map((e) => ({
            d: String(e.date).slice(5).replace("-", "/"),
            t: String(e.event).split("\u2014")[0].replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().slice(0, 18),
          }))
        setNext2(up)
      })
      .catch(() => {})
  }, [])
  React.useEffect(() => {
    const id = setInterval(() => setMode((m) => (m === "yoy" ? "mom" : "yoy")), 4000)
    return () => clearInterval(id)
  }, [])
  const [rows, setRows] = React.useState<Card[] | null>(null)
  /** 색은 "이번에 실제로 움직인" 상위 4개에만 — 나머지는 회색으로 눌러 시선 분산 방지 */
  const hot = React.useMemo(() => {
    const arr = (rows ?? []).map((c) => ({
      k: c.key,
      v: Math.abs(Number(mode === "mom" ? c.deltaMom ?? c.deltaYoy : c.deltaYoy ?? c.deltaMom) || 0),
    }))
    arr.sort((a, b) => b.v - a.v)
    return new Set(arr.filter((x) => x.v > 0).slice(0, 4).map((x) => x.k))
  }, [rows, mode])
  const [series, setSeries] = React.useState<Record<string, Series>>({})
  const [open, setOpen] = React.useState<string | null>(null)
  const [seen, setSeen] = React.useState<Set<string>>(new Set())
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
          <h2 className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">{t("rail_title")}</h2>
          <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">›</span>
        </a>
        {/* 지금 보고 있는 변동률 기준 — 4초마다 교대 */}
        <span
          key={mode}
          className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600"
          style={{ animation: "badgeSwap .45s cubic-bezier(.22,1,.36,1) both" }}
        >
          {mode === "yoy" ? (lang === "en" ? "YoY" : "전년비") : lang === "en" ? "MoM" : "전월비"}
        </span>
      </header>

      {next2.length > 0 ? (
        <p className="flex items-center gap-1.5 border-b border-gray-100 bg-indigo-50/40 px-3 py-1 text-[10px] text-gray-600">
          <span className="shrink-0 font-semibold text-indigo-600">{lang === "en" ? "Next" : "다음 발표"}</span>
          {next2.map((n, i) => (
            <span key={i} className="truncate">
              {i > 0 ? "· " : ""}
              <span className="num font-medium text-gray-800">{n.d}</span> {n.t}
            </span>
          ))}
        </p>
      ) : null}

      {err ? (
        <p className="px-3 py-6 text-center text-[12px] text-gray-400">{t("rail_fail")}</p>
      ) : (
        GROUPS.map((g) => {
          const list = (rows ?? []).filter((c) => c.freq === g)
          if (rows && list.length === 0) return null
          return (
            <div key={g}>
              <p className="border-b border-gray-100 bg-gray-50/70 px-2.5 py-0.5 text-[10px] font-normal text-gray-400">{g === "월별" ? t("rail_monthly") : t("rail_quarterly")}</p>
              {(rows ? list : (Array.from({ length: 4 }) as (Card | undefined)[])).map((c, i) =>
                !c ? (
                  <div key={i} className="h-[36px] border-b border-gray-50" />
                ) : (
                  <div key={c.key} className="mx-2.5 border-b border-dashed border-gray-300 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                    setSeen((s) => (s.has(c.key) ? s : new Set(s).add(c.key)))
                    setOpen(open === c.key ? null : c.key)
                  }}
                      className={
                        "group flex min-h-[26px] w-full items-center gap-1.5 transition-colors duration-300 px-0 py-0.5 text-left transition-all duration-300 ease-out " +
                        (open === c.key ? "bg-indigo-50/60" : "hover:-translate-y-0.5 hover:bg-gray-50")
                      }
                    >
                      <p
                        className={
                          "w-[104px] shrink-0 text-[13px] font-medium leading-snug text-gray-800 transition-colors duration-300 group-hover:text-indigo-600 " +
                          (lang === "en" ? "truncate text-[12px]" : "truncate text-[13px]")
                        }
                      >
                        {lang === "en" ? EN_SHORT[c.key] ?? pick(c.label, c.labelEn) : c.label}
                      </p>

                      <Preview pts={(series[c.key]?.points ?? []).map((v) => scale(c.key, v))} />

                      <p className="num min-w-0 flex-1 whitespace-nowrap pr-2 text-right text-[12px] font-semibold text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
                        <CountUp value={Number(c.value)} prefix={c.prefix ?? ""} suffix={c.suffix ?? ""} decimals={c.key === "remit" ? 2 : 1} />
                      </p>

                      <DeltaCell d={mode === "mom" ? c.deltaMom ?? c.deltaYoy : c.deltaYoy ?? c.deltaMom} dir={c.dir} unit={c.deltaUnit} muted={!hot.has(c.key)} />

                    </button>

                    {seen.has(c.key) && series[c.key] ? (
                      <div
                        className="grid transition-all duration-300 ease-out"
                        style={{ gridTemplateRows: open === c.key ? "1fr" : "0fr", opacity: open === c.key ? 1 : 0 }}
                      >
                        <div className="overflow-hidden">
                          <Detail c={c} s={series[c.key]} />
                        </div>
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
        {t("rail_note")}
      </p>
    </section>
  )
}

/** 펼침 — 경제지표 페이지 카드와 같은 어법(회색 서피스 · 값 CountUp · ProChart · 출처) */
function Detail({ c, s }: { c: Card; s: Series }) {
  const { lang, pick } = useLang()
  const cur = s.points.map((v) => scale(c.key, v))
  const prevArr = s.prev.map((v) => (v == null ? NaN : scale(c.key, v)))
  // 전년 값이 하나라도 비면 선이 끊겨 차트가 깨진다 — 전 구간이 있을 때만 그린다
  const hasPrev = prevArr.length === cur.length && prevArr.every((v) => Number.isFinite(v))
  const labels = s.dates.map((d) => periodLabel(d, c.freq))
  const yr = s.dates[s.dates.length - 1]?.slice(0, 4) ?? ""
  const dec = c.key === "remit" ? 2 : 1

  return (
    <div className="pb-2.5 pt-2.5" style={{ animation: "fadeUp .35s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="rounded-xl bg-[#f9fafb] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className={(lang === "en" ? "text-[12px]" : "text-[13px]") + " font-medium text-gray-800"}>{pick(c.label, c.labelEn)}</span>
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
          <span className="num text-[20px] font-semibold text-gray-900">
            <CountUp value={Number(c.value)} prefix={c.prefix} suffix={c.suffix} decimals={dec} />
          </span>
          <span className="text-[10px] text-gray-400/90">{c.asOf?.slice(0, 7).replace("-", ".")} 기준</span>
        </p>

        {/* 변동률 라벨은 상세에서 본다 — 목록 배지에는 숫자만 */}
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums">
          {c.deltaMom != null ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
              {lang === "en" ? (c.freq === "분기" ? "QoQ" : "MoM") : c.freq === "분기" ? "전분기" : "전월"}{" "}
              {c.deltaMom > 0 ? "↑" : c.deltaMom < 0 ? "↓" : "·"} {Math.abs(c.deltaMom).toFixed(1)}
              {c.deltaUnit}
            </span>
          ) : null}
          {c.deltaYoy != null ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
              {lang === "en" ? "YoY" : "전년"} {c.deltaYoy > 0 ? "↑" : c.deltaYoy < 0 ? "↓" : "·"}{" "}
              {Math.abs(c.deltaYoy).toFixed(1)}
              {c.deltaUnit}
            </span>
          ) : null}
        </div>

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
