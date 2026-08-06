"use client"

// 이상치 알림 — 제품(카테고리)별로 '진짜 인사이트'만 큐레이션.
// 신호: 가격 급락/급등 · 프로모(깊은할인) · 경쟁사 광고(종료임박·신규) · 재고(보조).
// 데이터: v_competitor_3d(가격) + v_competitor_ads_board(광고). 유리(기회)/불리(경보·주의) 시맨틱.
import React from "react"
import { fmtStamp, type PriceRow, type CompAd } from "@/lib/supabase"
import { canonCode } from "@/lib/classify"
import { peso, pmShopLabel, PmDrop } from "@/components/competitors/shared"
import { T } from "@/lib/i18n"

const SEV_META: Record<string, { label: string; dot: string; chip: string; order: number }> = {
  alert: { label: "경보", dot: "bg-rose-500", chip: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400", order: 0 },
  warn: { label: "주의", dot: "bg-amber-500", chip: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300", order: 1 },
  opp: { label: "기회", dot: "bg-emerald-500", chip: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", order: 2 },
}

// 신호 계열 — 재고 편중 탈피, 가격·프로모·광고를 함께
const KIND_META: Record<string, { label: string; cls: string }> = {
  price: { label: "가격", cls: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  promo: { label: "프로모", cls: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ad: { label: "광고", cls: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  stock: { label: "재고", cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
}
const KIND_FILTERS: { k: string; label: string }[] = [
  { k: "전체", label: "전체" }, { k: "price", label: "가격" }, { k: "promo", label: "프로모" }, { k: "ad", label: "광고" }, { k: "stock", label: "재고" },
]

// 제품 카테고리 — rows(PM_CATS)·ads(에어컨(RAC)·TV·AV·세탁·건조…) 어휘를 단일 축으로 정규화
const CATS = ["냉장고", "세탁기", "TV", "에어컨", "기타"]
const CAT_DOT: Record<string, string> = { 냉장고: "bg-sky-500", 세탁기: "bg-violet-500", TV: "bg-indigo-500", 에어컨: "bg-amber-500", 기타: "bg-gray-400" }
const normCat = (raw?: string | null): string => {
  const s = (raw || "").toLowerCase()
  if (/냉장고|refriger|\bref\b/.test(s)) return "냉장고"
  if (/세탁|washer|건조|dryer|laundry/.test(s)) return "세탁기"
  if (/\btv\b|av|텔레비/.test(s)) return "TV"
  if (/에어컨|aircon|air ?con|\brac\b|\bsac\b|inverter|hvac|에어케어/.test(s)) return "에어컨"
  return "기타"
}
const cleanTxt = (s?: string | null) => (s || "").replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim()

type Signal = {
  id: string; kind: "price" | "promo" | "ad" | "stock"; sev: string; cat: string; brand: string; own: boolean
  title: string; detail: string; metric: string; metricTone: string; before: number | null; after: number | null
  channel: string | null; url: string | null; score: number; day: "today" | "yesterday"; spec: string | null
}

export function AnomalyView({ rows, ads, stamp }: { rows: PriceRow[] | null; ads: CompAd[] | null; stamp: string | null }) {
  const [kind, setKind] = React.useState("전체")
  const [catF, setCatF] = React.useState("전체")
  const [dayF, setDayF] = React.useState("전체") // 날짜: 전체/오늘/어제 (3일 창 데이터 기준)
  const DAY_LABEL: Record<string, string> = { today: T("오늘", "Today"), yesterday: T("어제", "Yesterday") }
  const R = rows ?? []
  const A = ads ?? []
  const AD_TYPE: Record<string, string> = { promo: T("프로모", "Promo"), launch: T("신제품", "New model"), brand: T("브랜드", "Brand"), campaign: T("캠페인", "Campaign"), event: T("행사", "Event"), roadshow: T("로드쇼", "Roadshow"), other: T("광고", "Ad") }
  const SEV_LABEL: Record<string, string> = { alert: T("경보", "Alert"), warn: T("주의", "Watch"), opp: T("기회", "Opportunity") }
  const KIND_LABEL: Record<string, string> = { price: T("가격", "Price"), promo: T("프로모", "Promo"), ad: T("광고", "Ad"), stock: T("재고", "Stock") }
  const CAT_LABEL: Record<string, string> = { "냉장고": T("냉장고", "REF"), "세탁기": T("세탁기", "W/M"), "TV": T("TV", "TV"), "에어컨": T("에어컨", "RAC"), "기타": T("기타", "Other") }

  const signals = React.useMemo(() => {
    const out: Signal[] = []
    const dedup = new Set<string>()
    const add = (s: Signal) => { const k = s.kind + "|" + s.cat + "|" + s.brand + "|" + s.title.slice(0, 36) + "|" + s.metric; if (dedup.has(k)) return; dedup.add(k); out.push(s) }

    // ── 가격·프로모·재고(가격 스크랩) ──
    R.forEach((r, i) => {
      const cat = normCat(r.category)
      const cc = canonCode(r.model, r.code); if (cc.length < 5) return
      const own = r.brand === "LG"
      const label = r.code && r.code.length >= 4 && r.code !== "N/A" ? r.code : cc
      const nm = `${r.brand} ${label}`
      // 가격 급락/급등 — 오늘(d1→d0)·어제(d2→d1)
      const spans: [number | null, number | null][] = [[r.p1, r.p0], [r.p2, r.p1]]
      spans.forEach(([bef, aft], si) => {
        if (bef == null || aft == null || bef <= 0) return
        const day: "today" | "yesterday" = si === 0 ? "today" : "yesterday"
        const chg = (aft - bef) / bef, pctN = Math.round(chg * 100)
        if (chg <= -0.06) {
          add({ id: `p${i}-d${si}`, kind: "price", sev: own ? "opp" : (chg <= -0.13 ? "alert" : "warn"), cat, brand: r.brand, own, title: nm, detail: own ? T("자사 실판매가 인하 — 가격 경쟁력↑", "Own street price cut — pricing edge up") : `${pmShopLabel(r.retailer)}${T(" 실판매가 급락 — 자사 최저가 위협", " street price plunge — threatens our floor")}`, metric: `${pctN}%`, metricTone: "down", before: bef, after: aft, channel: r.retailer, url: r.url, score: Math.abs(chg) * 100 * (own ? 0.8 : 1.25), day, spec: r.capacity ?? null })
        } else if (chg >= 0.08 && !own) {
          add({ id: `r${i}-d${si}`, kind: "price", sev: "opp", cat, brand: r.brand, own, title: nm, detail: `${pmShopLabel(r.retailer)}${T(" 가격 인상 — 자사 상대 우위 확대", " price hike — widens our relative edge")}`, metric: `+${pctN}%`, metricTone: "up", before: bef, after: aft, channel: r.retailer, url: r.url, score: chg * 100 * 0.8, day, spec: r.capacity ?? null })
        }
      })
      // 깊은 할인(프로모 성격) — 오늘 스냅샷
      if ((r.discountPct ?? 0) >= 30 && r.d0) {
        const d = Math.round(r.discountPct as number)
        add({ id: `d${i}`, kind: "promo", sev: own ? "opp" : "warn", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)}${T(" 자사 프로모 강세", " strong own promo")}` : `${pmShopLabel(r.retailer)}${T(" 경쟁 공격적 할인", " aggressive rival discount")}`, metric: `-${d}%`, metricTone: "down", before: r.srp, after: r.p0, channel: r.retailer, url: r.url, score: d * (own ? 0.75 : 1), day: "today", spec: r.capacity ?? null })
      }
      // 재고(보조) — 점수 낮춰 편중 방지. 경쟁사 품절은 반사이익, 자사 품절은 손실.
      if (r.availability === "OutOfStock" && r.d0) {
        add({ id: `s${i}`, kind: "stock", sev: own ? "alert" : "opp", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)}${T(" 자사 품절 — 판매 기회 손실", " own stockout — lost sales opportunity")}` : `${pmShopLabel(r.retailer)}${T(" 경쟁사 품절 — 반사이익", " rival stockout — our gain")}`, metric: "품절", metricTone: "flat", before: null, after: null, channel: r.retailer, url: r.url, score: own ? 42 : 16, day: "today", spec: r.capacity ?? null })
      }
    })

    // ── 경쟁사 광고(종료 임박 · 신규 개시) ──
    A.forEach((ad, i) => {
      const cat = normCat(ad.category)
      const own = /^lg\b|엘지|엘지전자/i.test(ad.brand)
      const head = cleanTxt(ad.headline).slice(0, 44) || (own ? T("자사 광고", "Own ad") : `${ad.brand}${T(" 광고", " ad")}`)
      const at = AD_TYPE[ad.ad_type] ?? T("광고", "Ad")
      const offer = cleanTxt(ad.offer).slice(0, 20)
      // 프로모/광고 종료 임박(D-5 이내) — 경쟁사 종료=압력 완화(기회), 자사 종료=후속 점검(주의)
      if (ad.days_to_end != null && ad.days_to_end >= 0 && ad.days_to_end <= 5) {
        add({ id: `ae${i}`, kind: "ad", sev: own ? "warn" : "opp", cat, brand: ad.brand, own, title: head, detail: own ? T("자사 광고 종료 임박 — 후속 캠페인 점검", "Own ad ending soon — plan follow-up campaign") : `${ad.brand} ${at}${T(" 종료 임박 — 경쟁 압력 완화", " ending soon — competitive pressure easing")}`, metric: `D-${ad.days_to_end}`, metricTone: "flat", before: null, after: null, channel: ad.venue, url: ad.ad_url, score: (6 - ad.days_to_end) * 10 + (offer ? 14 : 0) + (own ? -8 : 0), day: "today", spec: null })
      }
      // 신규 광고 개시(D+3 이내) — 경쟁사 신규 캠페인=주시, 자사=정보
      if (ad.days_since_start != null && ad.days_since_start >= 0 && ad.days_since_start <= 3) {
        add({ id: `an${i}`, kind: "ad", sev: own ? "opp" : "warn", cat, brand: ad.brand, own, title: head, detail: own ? `${T("자사 신규", "New own")} ${at}${T(" 광고 개시", " ad launched")}` : `${ad.brand} ${T("신규", "new")} ${at}${T(" 광고 — 경쟁 캠페인 주시", " ad — monitor rival campaign")}`, metric: offer || at, metricTone: "flat", before: null, after: null, channel: ad.venue, url: ad.ad_url, score: (4 - ad.days_since_start) * 8 + (offer ? 12 : 0) + (own ? -10 : 0), day: "today", spec: null })
      }
    })
    return out
  }, [R, A])

  // 제품(모델)별로 신호를 묶어서 나열 — 같은 모델의 가격/프로모/재고/광고 신호를 한 그룹으로.
  // 그룹 내부는 심각도·점수 순, 그룹 정렬은 대표(최상위) 신호 기준. 중구난방 개별 나열 해소.
  // 단일 통합 리스트 — 카드 그룹 대신 한 줄씩. 정렬: 심각도 → 점수. 각 행에 브랜드·카테고리·스펙·모델 포함.
  const list = React.useMemo(() => {
    return signals
      .filter((s) => (kind === "전체" || s.kind === kind) && (catF === "전체" || s.cat === catF) && (dayF === "전체" || s.day === dayF))
      .sort((a, b) => SEV_META[a.sev].order - SEV_META[b.sev].order || b.score - a.score)
      .slice(0, 80)
  }, [signals, kind, catF, dayF])

  const catCounts = React.useMemo(() => { const c: Record<string, number> = {}; signals.forEach((s) => { c[s.cat] = (c[s.cat] || 0) + 1 }); return c }, [signals])

  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("불러오는 중", "Loading")}</div>

  const metricChip = (s: Signal) => {
    if (s.before != null && s.after != null && s.before > 0) {
      const down = s.metricTone === "down"
      return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300"><span className="text-gray-400 line-through dark:text-gray-500">{peso(s.before)}</span>→<span className="font-bold text-gray-900 dark:text-gray-50">{peso(s.after)}</span><span className={"font-bold " + (down ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{s.metric}</span></span>
    }
    const tone = s.metric.startsWith("D-") ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : s.metric === "품절" ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" : "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
    return <span className={"inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold " + tone}>{s.metric === "품절" ? T("품절", "Sold out") : s.metric}</span>
  }

  return (
    <div className="mt-3 flex flex-col gap-4" style={{ animation: "fadeUp .5s ease both" }}>
      {/* 필터바 — 채널별 가격비교식 드롭다운(제품·신호·날짜) 나란히 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <PmDrop label={T("날짜", "Date")} sel={dayF} options={[{ k: "전체", t: T("전체", "All") }, { k: "today", t: DAY_LABEL.today }, { k: "yesterday", t: DAY_LABEL.yesterday }]} onSelect={setDayF} />
        <PmDrop label={T("제품", "Div")} sel={catF} options={["전체", ...CATS].filter((c) => c === "전체" || (catCounts[c] ?? 0) > 0).map((c) => ({ k: c, t: c === "전체" ? T("전체", "All") : (CAT_LABEL[c] ?? c) }))} onSelect={setCatF} />
        <PmDrop label={T("신호", "Signal")} sel={kind} options={KIND_FILTERS.map((f) => ({ k: f.k, t: f.k === "전체" ? T("전체", "All") : KIND_LABEL[f.k] }))} onSelect={setKind} />
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
      </div>

      {/* 제품(모델)별로 묶은 그룹 카드 — 헤더(제품·카테고리·신호수) + 소속 신호 나열 */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-16 text-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("해당 신호가 없습니다.", "No matching signals.")}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          {/* 단일 통합 리스트 — 한 줄에 타임라인·신호·심각도·제품(브랜드·카테고리·스펙·모델)·내용·지표·채널 */}
          {list.map((s, i) => { const km = KIND_META[s.kind]; return (
            <div key={s.id + i} className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800/60 px-3 py-2.5 transition-colors last:border-0 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10" style={{ animation: "rowIn .32s ease both", animationDelay: Math.min(i, 20) * 0.02 + "s" }}>
              {/* 타임라인(오늘/어제) 먼저 */}
              <span className={"inline-flex w-10 shrink-0 items-center justify-center rounded px-1 py-0.5 text-center text-[10px] font-semibold " + (s.day === "today" ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400")} title={DAY_LABEL[s.day]}>{DAY_LABEL[s.day]}</span>
              <span className={"inline-flex w-12 shrink-0 items-center justify-center rounded px-1 py-0.5 text-center text-[10px] font-semibold " + km.cls}>{KIND_LABEL[s.kind]}</span>
              <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + SEV_META[s.sev].dot} title={SEV_LABEL[s.sev]} />
              {/* 제품 식별 — 브랜드 · 모델 · 카테고리 · 스펙 */}
              <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (CAT_DOT[s.cat] ?? "bg-gray-400")} />
                <span className={"whitespace-nowrap text-[12px] font-bold " + (s.own ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-gray-50")}>{s.title}</span>
                {s.own && <span className="hidden shrink-0 rounded bg-indigo-100 px-1 py-px text-[9px] font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 sm:inline">{T("자사", "Own")}</span>}
                <span className="hidden shrink-0 rounded bg-gray-100 px-1.5 py-px text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400 md:inline">{CAT_LABEL[s.cat] ?? s.cat}</span>
                {s.spec ? <span className="hidden shrink-0 whitespace-nowrap rounded bg-gray-100 px-1.5 py-px text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400 lg:inline">{s.spec}</span> : null}
              </div>
              {/* 내용 */}
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-[12px] text-gray-500 dark:text-gray-400">{s.detail}</span>
              </div>
              <div className="shrink-0 text-right">{metricChip(s)}</div>
              {s.channel ? (s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="hidden w-20 shrink-0 truncate text-right text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400 md:block">{pmShopLabel(s.channel)} ↗</a> : <span className="hidden w-20 shrink-0 truncate text-right text-[11px] text-gray-400 dark:text-gray-500 md:block">{pmShopLabel(s.channel)}</span>) : <span className="hidden w-20 shrink-0 md:block" />}
            </div>
          ) })}
        </div>
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("감지 룰: 가격 급락/급등(3일 실판매가 −6%↓·+8%↑) · 프로모(SRP 대비 ≥30% 할인) · 광고(종료 D-5 이내·신규 D+3 이내, v_competitor_ads_board) · 재고(보조) · 전체 상위 신호 큐레이션 · 유리(기회)/불리(경보·주의)", "Detection rules: price plunge/spike (3-day street price −6%↓·+8%↑) · promo (≥30% off SRP) · ads (ending within D-5 · new within D+3, v_competitor_ads_board) · stock (secondary) · curated top signals overall · favorable (opportunity)/adverse (alert·watch)")}</p>
    </div>
  )
}
