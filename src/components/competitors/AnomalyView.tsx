"use client"

// 이상치 알림 — 제품(카테고리)별로 '진짜 인사이트'만 큐레이션.
// 신호: 가격 급락/급등 · 프로모(깊은할인) · 경쟁사 광고(종료임박·신규) · 재고(보조).
// 데이터: v_competitor_3d(가격) + v_competitor_ads_board(광고). 유리(기회)/불리(경보·주의) 시맨틱.
import React from "react"
import { fmtStamp, type PriceRow, type CompAd } from "@/lib/supabase"
import { canonCode } from "@/lib/classify"
import { peso, pmShopLabel } from "@/components/competitors/shared"

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
const AD_TYPE: Record<string, string> = { promo: "프로모", launch: "신제품", brand: "브랜드", campaign: "캠페인", event: "행사", roadshow: "로드쇼", other: "광고" }

type Signal = {
  id: string; kind: "price" | "promo" | "ad" | "stock"; sev: string; cat: string; brand: string; own: boolean
  title: string; detail: string; metric: string; metricTone: string; before: number | null; after: number | null
  channel: string | null; url: string | null; score: number
}

export function AnomalyView({ rows, ads, stamp }: { rows: PriceRow[] | null; ads: CompAd[] | null; stamp: string | null }) {
  const [kind, setKind] = React.useState("전체")
  const [catF, setCatF] = React.useState("전체")
  const R = rows ?? []
  const A = ads ?? []

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
        const chg = (aft - bef) / bef, pctN = Math.round(chg * 100)
        if (chg <= -0.06) {
          add({ id: `p${i}-d${si}`, kind: "price", sev: own ? "opp" : (chg <= -0.13 ? "alert" : "warn"), cat, brand: r.brand, own, title: nm, detail: own ? "자사 실판매가 인하 — 가격 경쟁력↑" : `${pmShopLabel(r.retailer)} 실판매가 급락 — 자사 최저가 위협`, metric: `${pctN}%`, metricTone: "down", before: bef, after: aft, channel: r.retailer, url: r.url, score: Math.abs(chg) * 100 * (own ? 0.8 : 1.25) })
        } else if (chg >= 0.08 && !own) {
          add({ id: `r${i}-d${si}`, kind: "price", sev: "opp", cat, brand: r.brand, own, title: nm, detail: `${pmShopLabel(r.retailer)} 가격 인상 — 자사 상대 우위 확대`, metric: `+${pctN}%`, metricTone: "up", before: bef, after: aft, channel: r.retailer, url: r.url, score: chg * 100 * 0.8 })
        }
      })
      // 깊은 할인(프로모 성격)
      if ((r.discountPct ?? 0) >= 30 && r.d0) {
        const d = Math.round(r.discountPct as number)
        add({ id: `d${i}`, kind: "promo", sev: own ? "opp" : "warn", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)} 자사 프로모 강세` : `${pmShopLabel(r.retailer)} 경쟁 공격적 할인`, metric: `-${d}%`, metricTone: "down", before: r.srp, after: r.p0, channel: r.retailer, url: r.url, score: d * (own ? 0.75 : 1) })
      }
      // 재고(보조) — 점수 낮춰 편중 방지. 경쟁사 품절은 반사이익, 자사 품절은 손실.
      if (r.availability === "OutOfStock" && r.d0) {
        add({ id: `s${i}`, kind: "stock", sev: own ? "alert" : "opp", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)} 자사 품절 — 판매 기회 손실` : `${pmShopLabel(r.retailer)} 경쟁사 품절 — 반사이익`, metric: "품절", metricTone: "flat", before: null, after: null, channel: r.retailer, url: r.url, score: own ? 42 : 16 })
      }
    })

    // ── 경쟁사 광고(종료 임박 · 신규 개시) ──
    A.forEach((ad, i) => {
      const cat = normCat(ad.category)
      const own = /^lg\b|엘지|엘지전자/i.test(ad.brand)
      const head = cleanTxt(ad.headline).slice(0, 44) || (own ? "자사 광고" : `${ad.brand} 광고`)
      const at = AD_TYPE[ad.ad_type] ?? "광고"
      const offer = cleanTxt(ad.offer).slice(0, 20)
      // 프로모/광고 종료 임박(D-5 이내) — 경쟁사 종료=압력 완화(기회), 자사 종료=후속 점검(주의)
      if (ad.days_to_end != null && ad.days_to_end >= 0 && ad.days_to_end <= 5) {
        add({ id: `ae${i}`, kind: "ad", sev: own ? "warn" : "opp", cat, brand: ad.brand, own, title: head, detail: own ? "자사 광고 종료 임박 — 후속 캠페인 점검" : `${ad.brand} ${at} 종료 임박 — 경쟁 압력 완화`, metric: `D-${ad.days_to_end}`, metricTone: "flat", before: null, after: null, channel: ad.venue, url: ad.ad_url, score: (6 - ad.days_to_end) * 10 + (offer ? 14 : 0) + (own ? -8 : 0) })
      }
      // 신규 광고 개시(D+3 이내) — 경쟁사 신규 캠페인=주시, 자사=정보
      if (ad.days_since_start != null && ad.days_since_start >= 0 && ad.days_since_start <= 3) {
        add({ id: `an${i}`, kind: "ad", sev: own ? "opp" : "warn", cat, brand: ad.brand, own, title: head, detail: own ? `자사 신규 ${at} 광고 개시` : `${ad.brand} 신규 ${at} 광고 — 경쟁 캠페인 주시`, metric: offer || at, metricTone: "flat", before: null, after: null, channel: ad.venue, url: ad.ad_url, score: (4 - ad.days_since_start) * 8 + (offer ? 12 : 0) + (own ? -10 : 0) })
      }
    })
    return out
  }, [R, A])

  // 카테고리별 큐레이션 — 심각도·점수 순 상위만(중구난방 해소)
  // 전체 기준 단일 정렬 리스트(제품별 섹션 X) — 심각도·점수 순 상위. 제품 선택 시 해당 제품만.
  const list = React.useMemo(() =>
    signals
      .filter((s) => (kind === "전체" || s.kind === kind) && (catF === "전체" || s.cat === catF))
      .sort((a, b) => SEV_META[a.sev].order - SEV_META[b.sev].order || b.score - a.score)
      .slice(0, 60)
  , [signals, kind, catF])

  const counts = React.useMemo(() => { const c: Record<string, number> = { price: 0, promo: 0, ad: 0, stock: 0 }; signals.forEach((s) => c[s.kind]++); return c }, [signals])
  const catCounts = React.useMemo(() => { const c: Record<string, number> = {}; signals.forEach((s) => { c[s.cat] = (c[s.cat] || 0) + 1 }); return c }, [signals])

  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">불러오는 중</div>

  const metricChip = (s: Signal) => {
    if (s.before != null && s.after != null && s.before > 0) {
      const down = s.metricTone === "down"
      return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300"><span className="text-gray-400 line-through dark:text-gray-500">{peso(s.before)}</span>→<span className="font-bold text-gray-900 dark:text-gray-50">{peso(s.after)}</span><span className={"font-bold " + (down ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{s.metric}</span></span>
    }
    const tone = s.metric.startsWith("D-") ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : s.metric === "품절" ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" : "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
    return <span className={"inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold " + tone}>{s.metric}</span>
  }

  return (
    <div className="mt-3 flex flex-col gap-4" style={{ animation: "fadeUp .5s ease both" }}>
      {/* 필터바 — 일일 가격 변동과 동일한 상단 묶음(bordered) */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">제품</span>
        {["전체", ...CATS].map((c) => {
          const n = c === "전체" ? signals.length : (catCounts[c] ?? 0)
          if (c !== "전체" && n === 0) return null
          return <button key={c} type="button" onClick={() => setCatF(c)} className={"inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold transition-all duration-200 active:scale-95 " + (c === catF ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300")}>{c === "전체" ? "전체" : <><span className={"h-1.5 w-1.5 rounded-full " + (CAT_DOT[c] ?? "bg-gray-400")} />{c}</>}<span className={"tabular-nums text-[10.5px] " + (c === catF ? "text-indigo-100" : "text-gray-400 dark:text-gray-500")}>{n}</span></button>
        })}
        <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">신호</span>
        {KIND_FILTERS.map((f) => {
          const n = f.k === "전체" ? signals.length : counts[f.k]
          return <button key={f.k} type="button" onClick={() => setKind(f.k)} className={"inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold transition-all duration-200 active:scale-95 " + (f.k === kind ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300")}>{f.label}<span className={"tabular-nums text-[10.5px] " + (f.k === kind ? "text-indigo-100" : "text-gray-400 dark:text-gray-500")}>{n}</span></button>
        })}
        <span className="ml-auto hidden text-[11px] text-gray-400 dark:text-gray-500 sm:inline">최신 {stamp ? fmtStamp(stamp) : "—"}</span>
      </div>

      {/* 전체 기준 단일 리스트(제품별 섹션 X) — 각 행에 제품 태그 표시 */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-16 text-center text-[12.5px] text-gray-400 dark:text-gray-500">해당 신호가 없습니다.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          {list.map((s, i) => { const km = KIND_META[s.kind]; return (
            <div key={s.id + i} className="flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800/60 px-3 py-2.5 transition-colors last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40" style={{ animation: "rowIn .4s cubic-bezier(.22,1,.36,1) both", animationDelay: Math.min(i, 12) * 0.02 + "s" }}>
              <span className={"inline-flex w-12 shrink-0 items-center justify-center rounded px-1 py-0.5 text-center text-[10px] font-semibold " + km.cls}>{km.label}</span>
              <span className="hidden w-16 shrink-0 items-center gap-1 sm:inline-flex"><span className={"h-1.5 w-1.5 shrink-0 rounded-full " + (CAT_DOT[s.cat] ?? "bg-gray-400")} /><span className="truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{s.cat}</span></span>
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="shrink-0 whitespace-nowrap text-[12.5px] font-bold text-gray-900 dark:text-gray-50">{s.own ? <span className="text-indigo-700 dark:text-indigo-300">{s.title}</span> : s.title}</span>
                <span className="truncate text-[12px] text-gray-400 dark:text-gray-500">{s.detail}</span>
              </div>
              <div className="shrink-0 text-right">{metricChip(s)}</div>
              {s.channel ? (s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="hidden w-20 shrink-0 truncate text-right text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400 md:block">{pmShopLabel(s.channel)} ↗</a> : <span className="hidden w-20 shrink-0 truncate text-right text-[11px] text-gray-400 dark:text-gray-500 md:block">{pmShopLabel(s.channel)}</span>) : <span className="hidden w-20 shrink-0 md:block" />}
            </div>
          ) })}
        </div>
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-500">감지 룰: 가격 급락/급등(3일 실판매가 −6%↓·+8%↑) · 프로모(SRP 대비 ≥30% 할인) · 광고(종료 D-5 이내·신규 D+3 이내, v_competitor_ads_board) · 재고(보조) · 전체 상위 신호 큐레이션 · 유리(기회)/불리(경보·주의)</p>
    </div>
  )
}
