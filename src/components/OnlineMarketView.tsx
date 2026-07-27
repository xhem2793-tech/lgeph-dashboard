"use client"

import React, { useEffect, useState } from "react"
import { ChartCard, fmtLabels } from "@/components/EconChart"
import { AgendaCard } from "@/components/EconViews"
import { macroDual, latestMacro } from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"

/** 온라인 시장 — 이커머스 규모·성장 + 디지털/결제/통신 인프라(온라인 가전 구매 저변).
 *  레이아웃: 접이식 배너 + 좌측 차트그리드(표준 카드) + 우측 아젠다(다른 뷰와 동일). */

const C = { ind: "#4f46e5", emer: "#059669", blue: "#2563eb", violet: "#7c3aed", rose: "#e11d48", amber: "#d97706" }
const Lg = ({ c, t }: { c: string; t: string }) => (
  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} /><span className="text-gray-600 dark:text-gray-300">{t}</span></span>
)

type Series = { value: number; date: string }[]
type Spec = { key: string; name: string; color: string; tf?: (v: number) => number }
function build(d: Record<string, Series>, specs: Spec[]) {
  const present = specs.filter((s) => (d[s.key] ?? []).length >= 1)
  const dates = Array.from(new Set(present.flatMap((s) => (d[s.key] ?? []).map((r) => r.date)))).sort()
  const series = present.map((s) => { const m = new Map((d[s.key] ?? []).map((r) => [r.date, r.value])); return { name: s.name, color: s.color, w: 2, data: dates.map((dt) => (m.has(dt) ? (s.tf ? s.tf(m.get(dt)!) : m.get(dt)!) : NaN)) } })
  return { labels: fmtLabels(dates), series, has: series.some((s) => s.data.some((v) => Number.isFinite(v))) }
}

const KEYS = ["internet_penetration", "account_ownership", "mobile_per100", "broadband_per100", "credit_card_ownership", "debit_card_ownership", "credit_card_used", "secure_internet_servers", "saved_at_fi_pct"]

// 동남아 6개국 비교(WB WDI·Findex) — 환율 차트처럼 PH의 상대 위치. ph=강조.
const SEA: Record<string, Record<string, Record<string, number>>> = {"internet":{"2012":{"id":14.5,"my":65.8,"ph":30.8,"sg":72,"th":26.5,"vn":36.8},"2013":{"id":14.9,"my":57.1,"ph":32.7,"sg":80.9,"th":28.9,"vn":38.5},"2014":{"id":17.1,"my":63.7,"ph":34.7,"sg":79.0,"th":34.9,"vn":41},"2015":{"id":22.1,"my":71.1,"ph":36.9,"sg":79.0,"th":39.3,"vn":45},"2016":{"id":25.4,"my":78.8,"ph":39.2,"sg":84.5,"th":47.5,"vn":53},"2017":{"id":32.3,"my":80.1,"ph":41.6,"sg":84.5,"th":52.9,"vn":58.1},"2018":{"id":39.9,"my":81.2,"ph":44.1,"sg":88.2,"th":56.8,"vn":69.8},"2019":{"id":47.7,"my":84.2,"ph":43.0,"sg":88.9,"th":66.7,"vn":68.7},"2020":{"id":53.7,"my":89.6,"ph":53.8,"sg":92.0,"th":77.8,"vn":70.3},"2021":{"id":62.1,"my":96.8,"ph":66.9,"sg":96.9,"th":85.3,"vn":74.2},"2022":{"id":66.5,"my":97.4,"ph":75.2,"sg":96.0,"th":88.0,"vn":78.6},"2023":{"id":69.2,"my":97.7,"ph":77.9,"sg":94.3,"th":89.5,"vn":78.1},"2024":{"id":72.8,"my":98.0,"ph":67.3,"sg":94.4,"th":90.9,"vn":84.2}},"broadband":{"2012":{"id":1.2,"my":9.8,"ph":2.1,"sg":27.1,"th":6.5,"vn":5.3},"2014":{"id":1.3,"my":10.0,"ph":2.8,"sg":27.0,"th":7.7,"vn":6.5},"2016":{"id":2.0,"my":8.6,"ph":2.8,"sg":28.5,"th":10.2,"vn":9.7},"2018":{"id":3.3,"my":8.2,"ph":3.5,"sg":26.5,"th":12.9,"vn":13.5},"2020":{"id":3.9,"my":9.9,"ph":7.1,"sg":26.9,"th":16.0,"vn":17.0},"2021":{"id":4.5,"my":10.9,"ph":8.5,"sg":27.5,"th":17.3,"vn":19.5},"2022":{"id":4.8,"my":12.2,"ph":7.6,"sg":27.6,"th":17.5,"vn":21.4},"2023":{"id":4.8,"my":13.0,"ph":6.5,"sg":27.4,"th":14.5,"vn":22.7},"2024":{"id":4.9,"my":13.5,"ph":7.1,"sg":27.8,"th":14.9,"vn":23.7}},"mobile":{"2012":{"id":111.6,"my":139.3,"ph":101.8,"sg":152.4,"th":122.4,"vn":147.1},"2014":{"id":125.8,"my":146.4,"ph":107.3,"sg":148.5,"th":138.3,"vn":148.5},"2016":{"id":145.7,"my":136.7,"ph":112.5,"sg":151.7,"th":168.9,"vn":128.3},"2018":{"id":118.3,"my":128.9,"ph":123.0,"sg":152.1,"th":175.3,"vn":146.1},"2020":{"id":129.4,"my":129.0,"ph":133.5,"sg":150.3,"th":162.3,"vn":141.7},"2021":{"id":132.2,"my":137.7,"ph":144.4,"sg":158.0,"th":168.5,"vn":136.8},"2022":{"id":122.9,"my":138.2,"ph":147.4,"sg":173.0,"th":176.2,"vn":137.9},"2023":{"id":125.2,"my":142.7,"ph":117.3,"sg":173.2,"th":168.6,"vn":131.0},"2024":{"id":122.5,"my":139.7,"ph":115.3,"sg":170.8,"th":160.6,"vn":127.6}},"account":{"2011":{"id":19.6,"my":66.2,"ph":26.6,"sg":98.2,"th":72.7,"vn":21.4},"2014":{"id":36.1,"my":80.7,"ph":31.3,"sg":96.4,"th":78.1,"vn":31.0},"2017":{"id":48.9,"my":85.3,"ph":34.5,"sg":97.9,"th":81.6,"vn":30.8},"2021":{"id":51.8,"my":88.4,"ph":51.4,"sg":97.5,"th":95.6},"2024":{"id":56.3,"my":88.7,"ph":50.2,"sg":98.0,"th":91.8,"vn":70.6}},"creditcard":{"2011":{"ph":3.2,"id":0.5,"th":4.5,"vn":1.2,"my":11.9,"sg":37.3},"2014":{"ph":3.2,"id":1.6,"th":5.7,"vn":1.9,"my":20.2,"sg":35.4},"2017":{"ph":1.9,"id":2.4,"th":9.8,"vn":4.1,"my":21.3,"sg":48.9},"2021":{"ph":8.1,"id":1.6,"th":22.6,"my":7.9,"sg":41.7},"2024":{"ph":3.0,"id":5.9,"th":8.0,"vn":5.8,"my":13.2}}}
const SEA_NAME: Record<string, string> = { ph: "필리핀", id: "인도네시아", th: "태국", vn: "베트남", my: "말레이시아", sg: "싱가포르" }
const SEA_COL: Record<string, string> = { ph: "#4f46e5", sg: "#0ea5e9", th: "#f59e0b", vn: "#ec4899", my: "#10b981", id: "#94a3b8" }
function seaChart(obj: Record<string, Record<string, number>>) {
  const years = Object.keys(obj).map(Number).sort((a, b) => a - b)
  const labels = years.map((y) => "'" + String(y).slice(2))
  const order = ["id", "vn", "th", "my", "sg", "ph"] // ph 마지막=위에 그려짐
  const series = order.map((c) => ({ name: SEA_NAME[c], color: SEA_COL[c], w: c === "ph" ? 2.4 : 1.4, endLabel: c === "ph" ? "필리핀" : undefined, data: years.map((y) => { const v = obj[String(y)]?.[c]; return v == null || v === 0 ? NaN : v }) }))
  return { labels, series }
}
const seaRank = (obj: Record<string, Record<string, number>>) => { const yrs = Object.keys(obj).map(Number).sort((a, b) => b - a); const last = obj[String(yrs[0])] || {}; const arr = Object.entries(last).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); const r = arr.findIndex(([c]) => c === "ph"); return r >= 0 ? { rank: r + 1, of: arr.length } : null }

export default function OnlineMarketView() {
  const [d, setD] = useState<Record<string, Series>>({})
  const [kv, setKv] = useState<Record<string, { value: number; date: string }>>({})
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"ph" | "sea">("ph")
  const [win, setWin] = useState("전체")
  useEffect(() => {
    Promise.all(KEYS.map((k) => macroDual(k).then((r) => [k, r] as const)))
      .then((rs) => setD(Object.fromEntries(rs))).catch(() => {})
    latestMacro(["account_ownership", "credit_card_ownership", "mobile_per100"]).then(setKv).catch(() => {})
  }, [])

  // 기간 토글(연간 데이터 — 최신연도 기준 N년)
  const WINS = [{ k: "3Y", n: 3 }, { k: "5Y", n: 5 }, { k: "10Y", n: 10 }, { k: "전체", n: 99 }]
  const wn = WINS.find((w) => w.k === win)!.n
  type Chart = { labels: string[]; series: { name: string; color: string; w?: number; endLabel?: string; data: number[] }[]; has?: boolean }
  const winCut = (c: Chart): Chart => {
    const yrOf = (l: string) => { const m = String(l).replace(/[^0-9]/g, "").slice(0, 2); return m ? 2000 + Number(m) : 0 }
    const yrs = c.labels.map(yrOf), mx = Math.max(0, ...yrs), cut = mx - wn + 1
    const idx = c.labels.map((_, i) => i).filter((i) => yrs[i] >= cut)
    return { labels: idx.map((i) => c.labels[i]), series: c.series.map((s) => ({ ...s, data: idx.map((i) => s.data[i]) })), has: c.has }
  }

  // 인터넷 이용률은 WB·ITU(SEA 비교와 동일 소스)로 통일 — DB annual_indicators(89%)와 WB(67%) 불일치 해소
  const phInternet: Series = Object.entries(SEA.internet).map(([y, o]) => ({ date: y + "-01-01", value: o.ph })).filter((x) => x.value != null).sort((a, b) => a.date.localeCompare(b.date))
  const dd = { ...d, internet_wb: phInternet }
  const digital = build(dd, [{ key: "internet_wb", name: "인터넷 이용률", color: C.ind }, { key: "account_ownership", name: "금융계정 보유", color: C.emer }])
  const infra = build(d, [{ key: "mobile_per100", name: "모바일 가입/100", color: C.blue }, { key: "broadband_per100", name: "브로드밴드/100", color: C.violet }])
  const pay = build(d, [{ key: "credit_card_ownership", name: "신용카드 보유", color: C.rose }, { key: "debit_card_ownership", name: "직불카드 보유", color: C.blue }, { key: "credit_card_used", name: "신용카드 사용", color: C.amber }])
  const secure = build(d, [{ key: "secure_internet_servers", name: "보안 인터넷서버", color: C.violet }])

  const rInternet = seaRank(SEA.internet), rCard = seaRank(SEA.creditcard), rAccount = seaRank(SEA.account), rBb = seaRank(SEA.broadband)
  const seaLegend = <>{["ph", "sg", "th", "my", "vn", "id"].map((c) => <Lg key={c} c={SEA_COL[c]} t={SEA_NAME[c]} />)}</>
  // 기간 적용된 차트
  const cDigital = winCut(digital), cPay = winCut(pay), cInfra = winCut(infra), cSecure = winCut(secure)
  const cSi = winCut(seaChart(SEA.internet)), cSa = winCut(seaChart(SEA.account)), cSc = winCut(seaChart(SEA.creditcard)), cSb = winCut(seaChart(SEA.broadband)), cSm = winCut(seaChart(SEA.mobile))

  const src = (t: string) => <><b className="font-semibold text-gray-500 dark:text-gray-400">자료</b> {t}</>

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes fadeOnly{from{opacity:0}to{opacity:1}}"}</style>

      {/* 접이식 배너 */}
      <div className="overflow-hidden rounded-xl border border-violet-100 dark:border-violet-500/25 bg-gradient-to-r from-violet-50 dark:from-violet-500/10 via-violet-50/40 dark:via-transparent to-white dark:to-gray-900 shadow-sm" style={{ animation: "fadeOnly .5s ease both" }}>
        <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer select-none items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg></div>
          <div className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700 dark:text-gray-200"><b className="font-semibold text-gray-900 dark:text-gray-50">온라인 시장</b> — 인터넷 {phInternet.length ? <b className="text-violet-700 dark:text-violet-300">{Math.round(phInternet[phInternet.length - 1].value)}%</b> : "—"}·계정 {kv.account_ownership ? Math.round(kv.account_ownership.value) + "%" : "—"}·모바일 {kv.mobile_per100 ? Math.round(kv.mobile_per100.value) + "/100" : "—"} — 신용카드 3%대(역내 최저), 직불·BNPL 중심 온라인 가전 구매 저변</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-violet-500 dark:text-violet-300 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .36s cubic-bezier(.16,1,.3,1)" }}>
          <div className="overflow-hidden"><div className="border-t border-violet-100/70 dark:border-violet-500/25 px-4 pb-3.5 pt-3 text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">
            인터넷 이용률·금융계정이 빠르게 오르는 반면 <b className="text-gray-900 dark:text-gray-50">신용카드 보유는 3%대로 낮아</b>, 온라인 가전 판매는 <b className="text-violet-700 dark:text-violet-300">직불·현금·리테일러/핀테크 할부(BNPL)</b> 중심으로 설계해야 시장 특성에 맞습니다.
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-violet-700 dark:text-violet-300"><span className="mt-0.5 shrink-0 rounded bg-violet-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 관점</span><span>온라인 전용 모델·D2C·마켓플레이스 플래그십 + 무이자할부/BNPL 제휴로 전환율 제고. 모바일 포화·브로드밴드 확대는 스마트가전 연결성 마케팅 기반.</span></p>
          </div></div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .34s cubic-bezier(.16,1,.3,1) both" }}>
          <header className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <span className="h-[18px] w-1 rounded bg-violet-500" />
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">온라인 시장</h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{tab === "sea" ? "동남아 6개국 비교 · ●필리핀 강조" : "이커머스·디지털·결제 저변"}</span>
            <span className="ml-auto"><Segmented size="sm" value={win} onChange={setWin} options={WINS.map((w) => ({ k: w.k, label: w.k }))} /></span>
          </header>
          <nav className="mb-3.5 flex flex-wrap gap-1.5">
            {[{ k: "ph", label: "이커머스·디지털(PH)" }, { k: "sea", label: "동남아 6개국 비교" }].map((s) => (
              <button key={s.k} type="button" onClick={() => setTab(s.k as "ph" | "sea")}
                className={"rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200 " + (tab === s.k ? "bg-violet-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-violet-500/15 dark:hover:text-violet-300")}>{s.label}</button>
            ))}
          </nav>

          {tab === "ph" && (
          <div key={"ph" + win} className="grid items-stretch gap-4 sm:grid-cols-2" style={{ animation: "fadeUp .35s cubic-bezier(.16,1,.3,1) both" }}>
            {cDigital.has && (
              <ChartCard seg="CE" title="디지털 이용 확산" unit="% · 연간" labels={cDigital.labels} series={cDigital.series} decimals={0} seriesUnit="%"
                legend={<><Lg c={C.ind} t="인터넷 이용률" /><Lg c={C.emer} t="금융계정 보유" /></>}
                meaning={<>인터넷 이용·금융계정 보유 확대 — <b className="text-gray-700 dark:text-gray-200">온라인 가전 구매·전자결제 저변</b></>}
                ai={<>인터넷·계정 보유 상승은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">이커머스·할부·BNPL 채널 확장</b> → 온라인 전용 모델·번들·D2C 강화. <b>트렌드</b>: 계정보유가 2017→2021 급등(팬데믹 디지털금융·정부지원금 계좌지급)했고, 인터넷 2024년 소폭 하락은 <b className="font-semibold">WB·ITU 추정 개정</b>(방법론 조정)에 따른 것.</>}
                src={src("World Bank·ITU 디지털지표 · 연간")} />
            )}
            {cPay.has && (
              <ChartCard seg="CE" title="온라인 결제수단 보급" unit="% 성인 · 연간" labels={cPay.labels} series={cPay.series} decimals={1} seriesUnit="%"
                legend={<><Lg c={C.rose} t="신용카드 보유" /><Lg c={C.blue} t="직불카드 보유" /><Lg c={C.amber} t="신용카드 사용" /></>}
                meaning={<>온라인 결제 기반 카드 보급(Findex) — <b className="text-gray-700 dark:text-gray-200">이커머스 결제·할부 구조</b></>}
                ai={<><b className="font-semibold text-rose-600 dark:text-rose-400">신용카드 3%대로 낮음</b> → 온라인 가전은 직불·현금·<b className="font-semibold text-emerald-600 dark:text-emerald-400">BNPL/핀테크 할부</b> 우선 설계가 전환에 유리. <b>트렌드</b>: 신용·직불카드 모두 2021년 급등(팬데믹 디지털·정부지원금 계좌지급) 후 2024년 반락 — 계좌보유(50%)는 유지된 채 카드만 감소 = <b className="font-semibold">e-wallet(GCash·Maya)으로 대체</b>.</>}
                src={src("World Bank Global Findex 카드 보유·사용율 · 격년")} />
            )}
            {cInfra.has && (
              <ChartCard seg="CE" title="통신 인프라 침투" unit="100명당 · 연간" labels={cInfra.labels} series={cInfra.series} decimals={0} seriesUnit=""
                legend={<><Lg c={C.blue} t="모바일 가입/100" /><Lg c={C.violet} t="브로드밴드/100" /></>}
                meaning={<>모바일·브로드밴드 보급 — <b className="text-gray-700 dark:text-gray-200">모바일 커머스·스마트가전 연결성</b></>}
                ai={<>모바일 포화·브로드밴드 확대는 <b className="font-semibold text-emerald-600 dark:text-emerald-400">앱 기반 구매·IoT 가전</b> 수요 기반 → 스마트홈 연계 마케팅. <b>트렌드</b>: 모바일 100%+ 포화·브로드밴드 완만 상승 — 필리핀은 <b className="font-semibold">고정망보다 모바일 의존</b>이 구조적.</>}
                src={src("World Bank·ITU 통신지표 · 연간")} />
            )}
            {cSecure.has && (
              <ChartCard seg="B2B" title="이커머스 인프라 (보안서버)" unit="백만명당 · 연간" labels={cSecure.labels} series={cSecure.series} decimals={0} seriesUnit=""
                legend={<Lg c={C.violet} t="보안 인터넷서버/100만" />}
                meaning={<>보안 인터넷서버 밀도 — <b className="text-gray-700 dark:text-gray-200">전자상거래·결제 신뢰 인프라 성숙도</b></>}
                ai={<>보안 인프라 확충은 <b className="font-semibold text-emerald-600 dark:text-emerald-400">온라인 결제 신뢰·플랫폼 성숙</b> → 공식몰·마켓플레이스 플래그십 확대 여건. <b>트렌드</b>: 2023년 급등·2024년 반락은 인증서버 집계 변동(연도별 편차 큼) — 절대수준보다 추세로 해석 권고.</>}
                src={src("World Bank WDI 보안 인터넷서버 · 연간")} />
            )}
          </div>
          )}

          {tab === "sea" && (
          <div key={"sea" + win} className="grid items-stretch gap-4 sm:grid-cols-2" style={{ animation: "fadeUp .35s cubic-bezier(.16,1,.3,1) both" }}>
            <ChartCard seg="CE" title="인터넷 이용률 — 6개국" unit="% · 연간" labels={cSi.labels} series={cSi.series} decimals={0} seriesUnit="%"
              legend={seaLegend}
              meaning={<>동남아 인터넷 침투 비교 — 필리핀 {rInternet ? <b className="text-gray-700 dark:text-gray-200">{rInternet.of}개국 중 {rInternet.rank}위</b> : ""}</>}
              ai={<>필리핀 인터넷 침투는 <b className="font-semibold text-amber-600 dark:text-amber-400">역내 중하위권</b> — 도시·청년층 집중 온라인 캠페인 여지, 지방 커버리지 확대가 이커머스 볼륨의 관건. <b>트렌드</b>: 2020~22 팬데믹기 급상승 후 필리핀 2024 소폭 반락(WB·ITU 추정 개정), 여전히 태국·말련·싱가포르(90%+)에 뒤짐.</>}
              src={src("World Bank·ITU 인터넷 이용률 · 6개국 연간")} />
            <ChartCard seg="CE" title="금융계정 보유율 — 6개국" unit="% 성인 · 연간" labels={cSa.labels} series={cSa.series} decimals={0} seriesUnit="%"
              legend={seaLegend}
              meaning={<>계정 보유(전자결제 저변) 비교 — 필리핀 {rAccount ? <b className="text-gray-700 dark:text-gray-200">{rAccount.of}개국 중 {rAccount.rank}위</b> : ""}</>}
              ai={<>계정 보유는 급상승했으나 <b className="font-semibold text-amber-600 dark:text-amber-400">태국·말련 대비 낮음</b> → 이커머스 성장여력 큼(미포용층 = 신규 온라인 수요 풀). <b>트렌드</b>: 필리핀 34%(2017)→51%(2021) 급등은 팬데믹 정부지원금 계좌지급·디지털금융 드라이브 효과, 이후 유지.</>}
              src={src("World Bank Global Findex 계정 보유율 · 6개국")} />
            <ChartCard seg="CE" title="신용카드 보유율 — 6개국" unit="% 성인 · 연간" labels={cSc.labels} series={cSc.series} decimals={0} seriesUnit="%"
              legend={seaLegend}
              meaning={<>신용카드 보급 비교 — 필리핀 {rCard ? <b className="text-rose-600 dark:text-rose-400">{rCard.of}개국 중 {rCard.rank}위(최하위권)</b> : ""}</>}
              ai={<>필리핀 신용카드 <b className="font-semibold text-rose-600 dark:text-rose-400">3%로 역내 최저</b> — 카드할부 의존 어려움 → <b className="font-semibold text-emerald-600 dark:text-emerald-400">BNPL·직불·현금·리테일러 할부</b>가 온라인 가전 전환의 핵심. <b>트렌드</b>: 필리핀만 2021년 8%로 튄 뒤 2024년 3% 복귀(팬데믹 일시효과+표본오차) — 싱가포르(40%+)와 구조적 격차 지속.</>}
              src={src("World Bank Global Findex 신용카드 보유율 · 6개국")} />
            <ChartCard seg="CE" title="고정 브로드밴드 — 6개국" unit="100명당 · 연간" labels={cSb.labels} series={cSb.series} decimals={0} seriesUnit=""
              legend={seaLegend}
              meaning={<>고정 브로드밴드 보급 비교 — 필리핀 {rBb ? <b className="text-gray-700 dark:text-gray-200">{rBb.of}개국 중 {rBb.rank}위</b> : ""}</>}
              ai={<>고정망 보급 낮아 <b className="font-semibold text-amber-600 dark:text-amber-400">모바일 우선(mobile-first) 커머스</b> 구조 → 앱·모바일 최적화 스토어·결제가 필수. <b>트렌드</b>: 필리핀 고정 브로드밴드 7%대로 베트남·태국에도 뒤져 역내 하위 — 광케이블 인프라 지연이 구조적 배경.</>}
              src={src("World Bank·ITU 고정 브로드밴드 · 6개국")} />
            <ChartCard seg="CE" title="모바일 가입 — 6개국" unit="100명당 · 연간" labels={cSm.labels} series={cSm.series} decimals={0} seriesUnit=""
              legend={seaLegend}
              meaning={<>모바일 가입 밀도 비교 — 역내 대부분 100%+ 포화</>}
              ai={<>모바일은 역내 공통 포화 = <b className="font-semibold text-emerald-600 dark:text-emerald-400">모바일 커머스·앱 채널이 온라인 가전 판매의 기본 인프라</b></>}
              src={src("World Bank·ITU 모바일 가입 · 6개국")} />
          </div>
          )}
        </section>

        <aside className="flex flex-col gap-4"><AgendaCard /></aside>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">출처 디지털/결제/인프라·6개국 비교=World Bank(WDI·Global Findex)·ITU 연간 실측 · 신용카드·계정 보유율은 격년 서베이(2011~2024) · 인터넷은 WB·ITU 기준(교차국 비교 일치)</p>
    </div>
  )
}
