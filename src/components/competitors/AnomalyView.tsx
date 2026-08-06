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
  channel: string | null; url: string | null; score: number; day: "today" | "yesterday"; spec: string | null; model: string
}

export function AnomalyView({ rows, ads, stamp }: { rows: PriceRow[] | null; ads: CompAd[] | null; stamp: string | null }) {
  const [kind, setKind] = React.useState("전체")
  const [catF, setCatF] = React.useState("전체")
  const [dayF, setDayF] = React.useState("전체")
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
          add({ id: `p${i}-d${si}`, kind: "price", sev: own ? "opp" : (chg <= -0.13 ? "alert" : "warn"), cat, brand: r.brand, own, title: nm, detail: own ? T("자사 실판매가 인하 — 가격 경쟁력↑", "Own street price cut — pricing edge up") : `${pmShopLabel(r.retailer)}${T(" 실판매가 급락 — 자사 최저가 위협", " street price plunge — threatens our floor")}`, metric: `${pctN}%`, metricTone: "down", before: bef, after: aft, channel: r.retailer, url: r.url, score: Math.abs(chg) * 100 * (own ? 0.8 : 1.25), day, spec: r.capacity ?? null, model: label })
        } else if (chg >= 0.08 && !own) {
          add({ id: `r${i}-d${si}`, kind: "price", sev: "opp", cat, brand: r.brand, own, title: nm, detail: `${pmShopLabel(r.retailer)}${T(" 가격 인상 — 자사 상대 우위 확대", " price hike — widens our relative edge")}`, metric: `+${pctN}%`, metricTone: "up", before: bef, after: aft, channel: r.retailer, url: r.url, score: chg * 100 * 0.8, day, spec: r.capacity ?? null, model: label })
        }
      })
      // 깊은 할인(프로모 성격) — 오늘 스냅샷
      if ((r.discountPct ?? 0) >= 30 && r.d0) {
        const d = Math.round(r.discountPct as number)
        add({ id: `d${i}`, kind: "promo", sev: own ? "opp" : "warn", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)}${T(" 자사 프로모 강세", " strong own promo")}` : `${pmShopLabel(r.retailer)}${T(" 경쟁 공격적 할인", " aggressive rival discount")}`, metric: `-${d}%`, metricTone: "down", before: r.srp, after: r.p0, channel: r.retailer, url: r.url, score: d * (own ? 0.75 : 1), day: "today", spec: r.capacity ?? null, model: label })
      }
      // 재고(보조) — 점수 낮춰 편중 방지. 경쟁사 품절은 반사이익, 자사 품절은 손실.
      if (r.availability === "OutOfStock" && r.d0) {
        add({ id: `s${i}`, kind: "stock", sev: own ? "alert" : "opp", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)}${T(" 자사 품절 — 판매 기회 손실", " own stockout — lost sales opportunity")}` : `${pmShopLabel(r.retailer)}${T(" 경쟁사 품절 — 반사이익", " rival stockout — our gain")}`, metric: "품절", metricTone: "flat", before: null, after: null, channel: r.retailer, url: r.url, score: own ? 42 : 16, day: "today", spec: r.capacity ?? null, model: label })
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
        add({ id: `ae${i}`, kind: "ad", sev: own ? "warn" : "opp", cat, brand: ad.brand, own, title: head, detail: own ? T("자사 광고 종료 임박 — 후속 캠페인 점검", "Own ad ending soon — plan follow-up campaign") : `${ad.brand} ${at}${T(" 종료 임박 — 경쟁 압력 완화", " ending soon — competitive pressure easing")}`, metric: `D-${ad.days_to_end}`, metricTone: "flat", before: null, after: null, channel: ad.venue, url: ad.ad_url, score: (6 - ad.days_to_end) * 10 + (offer ? 14 : 0) + (own ? -8 : 0), day: "today", spec: null, model: "" })
      }
      // 신규 광고 개시(D+3 이내) — 경쟁사 신규 캠페인=주시, 자사=정보
      if (ad.days_since_start != null && ad.days_since_start >= 0 && ad.days_since_start <= 3) {
        add({ id: `an${i}`, kind: "ad", sev: own ? "opp" : "warn", cat, brand: ad.brand, own, title: head, detail: own ? `${T("자사 신규", "New own")} ${at}${T(" 광고 개시", " ad launched")}` : `${ad.brand} ${T("신규", "new")} ${at}${T(" 광고 — 경쟁 캠페인 주시", " ad — monitor rival campaign")}`, metric: offer || at, metricTone: "flat", before: null, after: null, channel: ad.venue, url: ad.ad_url, score: (4 - ad.days_since_start) * 8 + (offer ? 12 : 0) + (own ? -10 : 0), day: "today", spec: null, model: "" })
      }
    })
    return out
  }, [R, A])

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const toggleExp = (k: string) => setExpanded((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  // 말풍선 스트림 — 날짜(오늘/어제) > 말풍선(제품 묶음: 브랜드+모델). 각 말풍선 안에 거래선별 변동(펼침).
  // 묶음 기준: 브랜드+제품(title)+신호종류 → 대표 신호 + 거래선 all. 심각도>점수 순, 같은 브랜드는 인접.
  const byDay = React.useMemo(() => {
    const filtered = signals.filter((s) => (kind === "전체" || s.kind === kind) && (catF === "전체" || s.cat === catF) && (dayF === "전체" || s.day === dayF))
    const DAY_ORDER: ("today" | "yesterday")[] = ["today", "yesterday"]
    return DAY_ORDER.map((day) => {
      const ds = filtered.filter((s) => s.day === day)
      const pm = new Map<string, Signal[]>()
      for (const s of ds) { const key = s.kind + "|" + s.brand + "|" + s.title; const arr = pm.get(key); if (arr) arr.push(s); else pm.set(key, [s]) }
      const bubbles = Array.from(pm.entries()).map(([key, arr]) => {
        arr.sort((x, y) => SEV_META[x.sev].order - SEV_META[y.sev].order || y.score - x.score)
        const rep = arr[0]
        return { key: day + "|" + key, kind: rep.kind, brand: rep.brand, own: rep.own, cat: rep.cat, sev: rep.sev, rep, all: arr, order: SEV_META[rep.sev].order, score: Math.max(...arr.map((s) => s.score)) }
      }).sort((a, b) => a.order - b.order || (a.own === b.own ? 0 : a.own ? 1 : -1) || a.brand.localeCompare(b.brand) || b.score - a.score)
      return { day, bubbles, n: ds.length }
    }).filter((d) => d.n > 0)
  }, [signals, kind, catF, dayF])
  const total = byDay.reduce((s, d) => s + d.n, 0)

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
      {/* 필터바 — 채널비교식 드롭다운(날짜·제품·신호) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2.5">
        <PmDrop label={T("날짜", "Date")} sel={dayF} options={[{ k: "전체", t: T("전체", "All") }, { k: "today", t: DAY_LABEL.today }, { k: "yesterday", t: DAY_LABEL.yesterday }]} onSelect={setDayF} />
        <PmDrop label={T("제품", "Div")} sel={catF} options={["전체", ...CATS].filter((c) => c === "전체" || (catCounts[c] ?? 0) > 0).map((c) => ({ k: c, t: c === "전체" ? T("전체", "All") : (CAT_LABEL[c] ?? c) }))} onSelect={setCatF} />
        <PmDrop label={T("신호", "Signal")} sel={kind} options={KIND_FILTERS.map((f) => ({ k: f.k, t: f.k === "전체" ? T("전체", "All") : KIND_LABEL[f.k] }))} onSelect={setKind} />
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
      </div>

      {/* 시간별 리스트 — 날짜(오늘/어제) 섹션 + 제품 행(헤드라인) · 펼치면 거래선별 변동 */}
      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-16 text-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("해당 신호가 없습니다.", "No matching signals.")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {byDay.map((dg) => {
            const dnum = dg.day === "today" ? new Date() : new Date(Date.now() - 86400000)
            const mmdd = `${String(dnum.getMonth() + 1).padStart(2, "0")}/${String(dnum.getDate()).padStart(2, "0")}`
            return (
            <div key={dg.day}>
              {/* 날짜 헤더 — 채널비교 날짜 pill 디자인(테두리 알약·볼드 tabular·최신 배지)+애니메이션 */}
              <div className="mb-1.5 flex items-center gap-2" style={{ animation: "viewIn .42s cubic-bezier(.22,1,.36,1) both" }}>
                <div className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1">
                  <span className={"h-1.5 w-1.5 rounded-full " + (dg.day === "today" ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600")} />
                  <span className="text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{mmdd}</span>
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{DAY_LABEL[dg.day]}</span>
                  {dg.day === "today" && <span className="rounded bg-emerald-50 dark:bg-emerald-500/10 px-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">{T("최신", "Latest")}</span>}
                </div>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">{dg.n}{T("건", "")}</span>
              </div>
              {/* 말풍선 스트림 — 자사(LG)=우측·경쟁사=좌측. 말풍선=제품 묶음, 심각도별 색·펼치면 거래선별 */}
              <div className="flex flex-col gap-2">
                {dg.bubbles.map((bg) => { const s = bg.rep; const open = expanded.has(bg.key); const sm = SEV_META[bg.sev]; const km = KIND_META[bg.kind]
                  const bub = bg.own ? "border-indigo-200 bg-indigo-50/70 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                    : bg.sev === "alert" ? "border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10"
                    : bg.sev === "warn" ? "border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10"
                    : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  return (
                  <div key={bg.key} className={"flex items-end gap-2 " + (bg.own ? "flex-row-reverse" : "")} style={{ animation: "rowIn .3s ease both" }}>
                    {/* 아바타(브랜드 이니셜) */}
                    <div className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm " + (bg.own ? "bg-indigo-500" : "bg-gray-400 dark:bg-gray-600")} title={bg.brand}>{bg.brand.slice(0, 2).toUpperCase()}</div>
                    {/* 말풍선 */}
                    <div className={"relative max-w-[88%] rounded-2xl border px-3 py-2 shadow-sm " + bub + (bg.own ? " rounded-br-sm" : " rounded-bl-sm")}>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + sm.dot} title={SEV_LABEL[bg.sev]} />
                        <span className={"whitespace-nowrap text-[12.5px] font-bold " + (bg.own ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{bg.brand}</span>
                        <span className="text-[11px] text-gray-300 dark:text-gray-600">·</span>
                        <span className="whitespace-nowrap text-[11.5px] font-medium text-gray-700 dark:text-gray-200">{s.spec ? s.spec : (CAT_LABEL[bg.cat] ?? bg.cat)}</span>
                        {s.model && <span className="text-[10.5px] text-gray-400 dark:text-gray-500">({s.model})</span>}
                        <span className={"inline-flex items-center rounded px-1.5 py-px text-[9.5px] font-bold " + km.cls}>{KIND_LABEL[bg.kind]}</span>
                        <span className={"inline-flex items-center rounded px-1.5 py-px text-[9.5px] font-bold " + sm.chip}>{SEV_LABEL[bg.sev]}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-gray-600 dark:text-gray-300">{s.detail}</span>
                        <span className="shrink-0">{metricChip(s)}</span>
                      </div>
                      {bg.all.length > 1 && (
                        <button type="button" onClick={() => toggleExp(bg.key)} className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-gray-500 transition-colors hover:text-indigo-600 dark:bg-gray-900/40 dark:text-gray-400 dark:hover:text-indigo-300">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200" style={{ transform: open ? "rotate(90deg)" : "none" }}><path d="M9 18l6-6-6-6" /></svg>
                          {bg.all.length}{T("개 거래선", " retailers")}
                        </button>
                      )}
                      {open && bg.all.length > 1 && (
                        <div className="mt-1.5 flex flex-col gap-1 border-t border-black/5 pt-1.5 dark:border-white/10" style={{ animation: "rowIn .28s ease both" }}>
                          {bg.all.map((sig, si) => (
                            <div key={sig.id + si} className="flex items-center gap-2">
                              {sig.channel ? (sig.url ? <a href={sig.url} target="_blank" rel="noopener noreferrer" className="w-20 shrink-0 truncate text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{pmShopLabel(sig.channel)}</a> : <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-gray-600 dark:text-gray-300">{pmShopLabel(sig.channel)}</span>) : <span className="w-20 shrink-0 text-[11px] text-gray-400">—</span>}
                              <span className="min-w-0 flex-1 truncate text-[11.5px] text-gray-500 dark:text-gray-400">{sig.detail}</span>
                              <span className="shrink-0">{metricChip(sig)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) })}
              </div>
            </div>
          )})}
        </div>
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("감지 룰: 가격 급락/급등(3일 실판매가 −6%↓·+8%↑) · 프로모(SRP 대비 ≥30% 할인) · 광고(종료 D-5 이내·신규 D+3 이내, v_competitor_ads_board) · 재고(보조) · 전체 상위 신호 큐레이션 · 유리(기회)/불리(경보·주의)", "Detection rules: price plunge/spike (3-day street price −6%↓·+8%↑) · promo (≥30% off SRP) · ads (ending within D-5 · new within D+3, v_competitor_ads_board) · stock (secondary) · curated top signals overall · favorable (opportunity)/adverse (alert·watch)")}</p>
    </div>
  )
}
