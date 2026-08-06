"use client"

// 이상치 알림 — 제품(카테고리)별로 '진짜 인사이트'만 큐레이션.
// 신호: 가격 급락/급등 · 프로모(깊은할인) · 경쟁사 광고(종료임박·신규) · 재고(보조).
// 데이터: v_competitor_3d(가격) + v_competitor_ads_board(광고). 유리(기회)/불리(경보·주의) 시맨틱.
import React from "react"
import { createPortal } from "react-dom"
import { fmtStamp, type PriceRow, type CompAd } from "@/lib/supabase"
import { canonCode, pmFormOf } from "@/lib/classify"
import { peso, md, pmShopLabel, PmDrop } from "@/components/competitors/shared"
import { T } from "@/lib/i18n"

const SEV_META: Record<string, { label: string; dot: string; chip: string; order: number }> = {
  alert: { label: "경보", dot: "bg-rose-500", chip: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400", order: 0 },
  warn: { label: "주의", dot: "bg-amber-500", chip: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300", order: 1 },
  opp: { label: "기회", dot: "bg-emerald-500", chip: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", order: 2 },
}

const KIND_ORDER = ["price", "promo", "ad", "stock"] as const
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
  channel: string | null; url: string | null; score: number; day: "today" | "yesterday"; spec: string | null; model: string; type?: string
}
type Bubble = { key: string; brand: string; own: boolean; cat: string; catsIn: string[]; sev: string; rep: Signal; products: { title: string; rep: Signal; all: Signal[] }[]; nProd: number; kinds: string[] }

export function AnomalyView({ rows, ads, stamp }: { rows: PriceRow[] | null; ads: CompAd[] | null; stamp: string | null }) {
  const [kind, setKind] = React.useState("전체")
  const [catF, setCatF] = React.useState("전체")
  const [daySel, setDaySel] = React.useState<"today" | "yesterday">("today") // 상단 날짜 네비게이터
  const [brandF, setBrandF] = React.useState("전체") // 브랜드: 전체·경쟁사(__comp)·개별 브랜드
  const [typeF, setTypeF] = React.useState("전체") // 유형(폼팩터)
  const DAY_LABEL: Record<string, string> = { today: T("오늘", "Today"), yesterday: T("어제", "Yesterday") }
  const R = rows ?? []
  // 오늘/어제 대표 날짜(스크랩일) — 네비게이터·달력에 사용
  const dayDate = React.useMemo(() => {
    const mode = (k: "d0" | "d1") => { const m = new Map<string, number>(); R.forEach((r) => { const v = r[k]; if (v) m.set(v, (m.get(v) || 0) + 1) }); let best: string | null = null, bc = 0; m.forEach((c, d) => { if (c > bc) { bc = c; best = d } }); return best }
    return { today: mode("d0"), yesterday: mode("d1") }
  }, [R])
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
      const ptype = pmFormOf(r.category, `${r.model || ""} ${r.capacity || ""}`, r.brand) || ""
      const label = r.code && r.code.length >= 4 && r.code !== "N/A" ? r.code : cc
      const nm = `${r.brand} ${label}`
      // 가격 급락/급등 — 오늘(d1→d0)·어제(d2→d1)
      const spans: [number | null, number | null][] = [[r.p1, r.p0], [r.p2, r.p1]]
      spans.forEach(([bef, aft], si) => {
        if (bef == null || aft == null || bef <= 0) return
        const day: "today" | "yesterday" = si === 0 ? "today" : "yesterday"
        const chg = (aft - bef) / bef, pctN = Math.round(chg * 100)
        if (chg <= -0.06) {
          add({ id: `p${i}-d${si}`, kind: "price", sev: own ? "opp" : (chg <= -0.13 ? "alert" : "warn"), cat, brand: r.brand, own, title: nm, detail: own ? T("자사 실판매가 인하 — 가격 경쟁력↑", "Own street price cut — pricing edge up") : `${pmShopLabel(r.retailer)}${T(" 실판매가 급락 — 자사 최저가 위협", " street price plunge — threatens our floor")}`, metric: `${pctN}%`, metricTone: "down", before: bef, after: aft, channel: r.retailer, url: r.url, score: Math.abs(chg) * 100 * (own ? 0.8 : 1.25), day, spec: r.capacity ?? null, model: label, type: ptype })
        } else if (chg >= 0.08 && !own) {
          add({ id: `r${i}-d${si}`, kind: "price", sev: "opp", cat, brand: r.brand, own, title: nm, detail: `${pmShopLabel(r.retailer)}${T(" 가격 인상 — 자사 상대 우위 확대", " price hike — widens our relative edge")}`, metric: `+${pctN}%`, metricTone: "up", before: bef, after: aft, channel: r.retailer, url: r.url, score: chg * 100 * 0.8, day, spec: r.capacity ?? null, model: label, type: ptype })
        }
      })
      // 깊은 할인(프로모 성격) — 오늘 스냅샷
      if ((r.discountPct ?? 0) >= 30 && r.d0) {
        const d = Math.round(r.discountPct as number)
        add({ id: `d${i}`, kind: "promo", sev: own ? "opp" : "warn", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)}${T(" 자사 프로모 강세", " strong own promo")}` : `${pmShopLabel(r.retailer)}${T(" 경쟁 공격적 할인", " aggressive rival discount")}`, metric: `-${d}%`, metricTone: "down", before: r.srp, after: r.p0, channel: r.retailer, url: r.url, score: d * (own ? 0.75 : 1), day: "today", spec: r.capacity ?? null, model: label, type: ptype })
      }
      // 재고(보조) — 점수 낮춰 편중 방지. 경쟁사 품절은 반사이익, 자사 품절은 손실.
      if (r.availability === "OutOfStock" && r.d0) {
        add({ id: `s${i}`, kind: "stock", sev: own ? "alert" : "opp", cat, brand: r.brand, own, title: nm, detail: own ? `${pmShopLabel(r.retailer)}${T(" 자사 품절 — 판매 기회 손실", " own stockout — lost sales opportunity")}` : `${pmShopLabel(r.retailer)}${T(" 경쟁사 품절 — 반사이익", " rival stockout — our gain")}`, metric: "품절", metricTone: "flat", before: null, after: null, channel: r.retailer, url: r.url, score: own ? 42 : 16, day: "today", spec: r.capacity ?? null, model: label, type: ptype })
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

  const [openBub, setOpenBub] = React.useState<Bubble | null>(null) // 클릭 시 팝업 리스트

  // 말풍선 스트림 — 날짜(오늘/어제) > 말풍선(제품 묶음: 브랜드+모델). 각 말풍선 안에 거래선별 변동(펼침).
  // 묶음 기준: 브랜드+제품(title)+신호종류 → 대표 신호 + 거래선 all. 심각도>점수 순, 같은 브랜드는 인접.
  const byDay = React.useMemo(() => {
    const filtered = signals.filter((s) => (kind === "전체" || s.kind === kind) && (catF === "전체" || s.cat === catF) && s.day === daySel && (typeF === "전체" || (s.type || "") === typeF) && (brandF === "전체" || (brandF === "__comp" ? !s.own : s.brand === brandF)))
    const DAY_ORDER: ("today" | "yesterday")[] = ["today", "yesterday"]
    return DAY_ORDER.map((day) => {
      const ds = filtered.filter((s) => s.day === day)
      // 브랜드 1말풍선으로 요약(제품·카테고리 구분 없이 전부 합침). 말풍선 안에 제품(모델)별 변동을 펼침.
      const bm = new Map<string, Signal[]>()
      for (const s of ds) { const arr = bm.get(s.brand); if (arr) arr.push(s); else bm.set(s.brand, [s]) }
      const bubbles = Array.from(bm.entries()).map(([brand, arr]) => {
        // 제품(모델=title)별 묶기 — 대표 신호 + 거래선 all
        const pm = new Map<string, Signal[]>()
        for (const s of arr) { const a = pm.get(s.title); if (a) a.push(s); else pm.set(s.title, [s]) }
        const products = Array.from(pm.entries()).map(([title, sigs]) => {
          sigs.sort((x, y) => SEV_META[x.sev].order - SEV_META[y.sev].order || y.score - x.score)
          return { title, rep: sigs[0], all: sigs }
        }).sort((a, b) => SEV_META[a.rep.sev].order - SEV_META[b.rep.sev].order || b.rep.score - a.rep.score)
        arr.sort((x, y) => SEV_META[x.sev].order - SEV_META[y.sev].order || y.score - x.score)
        const rep = arr[0]
        const kinds = KIND_ORDER.filter((k) => arr.some((s) => s.kind === k))
        const catsIn = CATS.filter((c) => arr.some((s) => s.cat === c)) // 이 브랜드가 걸친 제품군
        return { key: day + "|" + brand, brand, own: rep.own, cat: rep.cat, catsIn, sev: rep.sev, rep, products, nProd: products.length, kinds, order: SEV_META[rep.sev].order, score: Math.max(...arr.map((s) => s.score)) }
      }).sort((a, b) => a.order - b.order || (a.own === b.own ? 0 : a.own ? 1 : -1) || a.brand.localeCompare(b.brand) || b.score - a.score)
      return { day, bubbles, n: ds.length }
    }).filter((d) => d.n > 0)
  }, [signals, kind, catF, daySel, brandF, typeF])
  const total = byDay.reduce((s, d) => s + d.n, 0)

  const catCounts = React.useMemo(() => { const c: Record<string, number> = {}; signals.forEach((s) => { c[s.cat] = (c[s.cat] || 0) + 1 }); return c }, [signals])
  // 브랜드 옵션 — 전체·경쟁사 + 개별 브랜드(LG 먼저, 나머지 알파벳). 신호 존재 브랜드만.
  const brandOpts = React.useMemo(() => {
    const set = new Set(signals.map((s) => s.brand))
    const rest = Array.from(set).filter((b) => b !== "LG").sort((a, b) => a.localeCompare(b))
    const list = [{ k: "전체", t: T("전체", "All") }, { k: "__comp", t: T("경쟁사", "Rivals") }]
    if (set.has("LG")) list.push({ k: "LG", t: "LG" })
    rest.forEach((b) => list.push({ k: b, t: b }))
    return list
  }, [signals])
  // 유형 옵션 — 선택 제품(catF)에 존재하는 폼팩터만. 전체 포함.
  const typeOpts = React.useMemo(() => {
    const set = new Set<string>()
    signals.forEach((s) => { if ((s.type || "") && (catF === "전체" || s.cat === catF)) set.add(s.type as string) })
    return [{ k: "전체", t: T("전체", "All") }, ...Array.from(set).sort((a, b) => a.localeCompare(b)).map((tp) => ({ k: tp, t: tp }))]
  }, [signals, catF])

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
        {/* 날짜 네비게이터 — 채널별 가격비교(BoardView) 스타일: ◀ 이전 · ▶ 다음 · 📅 달력(실작동) */}
        <div className="flex items-center gap-0.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-1 py-0.5">
          <button type="button" onClick={() => setDaySel("yesterday")} disabled={daySel === "yesterday"} aria-label={T("이전 날짜", "Previous date")} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <span className="min-w-[74px] text-center text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{md(dayDate[daySel] ?? null)}{daySel === "today" && <span className="ml-1 rounded bg-emerald-50 dark:bg-emerald-500/10 px-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">{T("최신", "Latest")}</span>}</span>
          <button type="button" onClick={() => setDaySel("today")} disabled={daySel === "today"} aria-label={T("다음 날짜", "Next date")} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
          <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400" title={T("달력에서 날짜 선택", "Pick a date from the calendar")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            <input type="date" value={dayDate[daySel] ?? ""} min={dayDate.yesterday ?? undefined} max={dayDate.today ?? undefined} onChange={(e) => { setDaySel(e.target.value === dayDate.today ? "today" : "yesterday") }} className="absolute inset-0 cursor-pointer opacity-0" aria-label={T("날짜 선택", "Select date")} />
          </label>
        </div>
        <PmDrop label={T("브랜드", "Brand")} sel={brandF} options={brandOpts} onSelect={setBrandF} />
        <PmDrop label={T("제품", "Div")} sel={catF} options={["전체", ...CATS].filter((c) => c === "전체" || (catCounts[c] ?? 0) > 0).map((c) => ({ k: c, t: c === "전체" ? T("전체", "All") : (CAT_LABEL[c] ?? c) }))} onSelect={(k) => { setCatF(k); setTypeF("전체") }} />
        {typeOpts.length > 1 && <PmDrop label={T("유형", "Type")} sel={typeF} options={typeOpts} onSelect={setTypeF} />}
        <PmDrop label={T("신호", "Signal")} sel={kind} options={KIND_FILTERS.map((f) => ({ k: f.k, t: f.k === "전체" ? T("전체", "All") : KIND_LABEL[f.k] }))} onSelect={setKind} />
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:flex">{T("최신", "Updated")} {stamp ? fmtStamp(stamp) : "—"}<span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">C</span></span>
      </div>

      {/* 말풍선 스트림 — 브랜드 1개당 1말풍선(제품 전부 합침). 화면 고정 높이 + 초과 시 내부 스크롤. */}
      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-16 text-center text-[12.5px] text-gray-400 dark:text-gray-500">{T("해당 신호가 없습니다.", "No matching signals.")}</div>
      ) : (
        <div className="flex min-h-[1200px] flex-col gap-3">
          {byDay.map((dg) => {
            const dnum = dg.day === "today" ? new Date() : new Date(Date.now() - 86400000)
            const mmdd = `${String(dnum.getMonth() + 1).padStart(2, "0")}/${String(dnum.getDate()).padStart(2, "0")}`
            const st = stamp ? new Date(stamp) : null
            const bubTime = dg.day === "today" && st ? `${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}` : mmdd
            return (
            <div key={dg.day}>
              {/* 날짜는 상단 네비게이터로 선택 — 여기선 건수만 표시 */}
              <div className="mb-1.5 flex items-center gap-2 px-0.5"><span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{DAY_LABEL[dg.day]} <span className="tabular-nums text-gray-400 dark:text-gray-500">{mmdd}</span></span><span className="text-[11px] text-gray-400 dark:text-gray-500">· {dg.n}{T("건", "")}</span></div>
              {/* 브랜드별 말풍선 스트림(전부 왼쪽·시각 표시) — 브랜드만 분리 */}
              <div className="flex flex-col gap-3.5">
                {dg.bubbles.map((bg) => { const s = bg.rep; const sm = SEV_META[bg.sev]
                  const bub = bg.own ? "border-indigo-200 bg-indigo-50/70 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                    : bg.sev === "alert" ? "border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10"
                    : bg.sev === "warn" ? "border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10"
                    : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  // 말풍선(아바타+꼬리) — 한 줄 핵심 요약, 클릭하면 팝업 리스트
                  return (
                    <div key={bg.key} className="flex items-end gap-2" style={{ animation: "rowIn .3s ease both" }}>
                      <div className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm " + (bg.own ? "bg-indigo-500" : "bg-gray-400 dark:bg-gray-600")} title={bg.brand}>{bg.brand.slice(0, 2).toUpperCase()}</div>
                      <button type="button" onClick={() => setOpenBub(bg)} className={"relative flex max-w-[88%] items-center gap-2 rounded-2xl rounded-bl-sm border px-3 py-1.5 text-left shadow-sm transition-all duration-150 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-md " + bub}>
                        <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + sm.dot} title={SEV_LABEL[bg.sev]} />
                        <span className="min-w-0 flex-1 truncate text-[12px] leading-snug text-gray-600 dark:text-gray-300"><b className={bg.own ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-gray-50"}>{bg.brand}</b> · {s.detail}{bg.nProd > 1 ? T(` 외 ${bg.nProd - 1}건`, ` +${bg.nProd - 1}`) : ""}</span>
                        <span className="hidden shrink-0 items-center gap-1 sm:flex">{bg.catsIn.slice(0, 3).map((c) => <span key={c} className="whitespace-nowrap rounded bg-gray-100 px-1 py-px text-[9px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{CAT_LABEL[c] ?? c}</span>)}</span>
                        <span className="shrink-0">{metricChip(s)}</span>
                        <span className="hidden shrink-0 text-[9px] tabular-nums text-gray-400 dark:text-gray-500 sm:inline">{bubTime}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400"><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    </div>
                  ) })}
              </div>
            </div>
          )})}
        </div>
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{T("감지 룰: 가격 급락/급등(3일 실판매가 −6%↓·+8%↑) · 프로모(SRP 대비 ≥30% 할인) · 광고(종료 D-5 이내·신규 D+3 이내, v_competitor_ads_board) · 재고(보조) · 전체 상위 신호 큐레이션 · 유리(기회)/불리(경보·주의)", "Detection rules: price plunge/spike (3-day street price −6%↓·+8%↑) · promo (≥30% off SRP) · ads (ending within D-5 · new within D+3, v_competitor_ads_board) · stock (secondary) · curated top signals overall · favorable (opportunity)/adverse (alert·watch)")}</p>

      {/* 클릭 팝업 — 선택 브랜드×제품군의 신호 리스트 + 링크 바로가기. 뷰포트 전체 기준으로 뜨도록 body에 포털(부모 transform 컨테이닝블록 회피). */}
      {openBub && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" style={{ animation: "fadeUp .2s ease both" }} onClick={() => setOpenBub(null)}>
          <div className="flex max-h-[82vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-2xl dark:bg-gray-900 dark:ring-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
              <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white " + (openBub.own ? "bg-indigo-500" : "bg-gray-400 dark:bg-gray-600")}>{openBub.brand.slice(0, 2).toUpperCase()}</span>
              <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{openBub.brand} · {CAT_LABEL[openBub.cat] ?? openBub.cat}</h3>
              <span className={"rounded px-1.5 py-px text-[10px] font-bold " + SEV_META[openBub.sev].chip}>{SEV_LABEL[openBub.sev]}</span>
              <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-px text-[10px] font-semibold text-gray-500 dark:text-gray-400">{openBub.nProd}{T("건", " items")}</span>
              <button type="button" onClick={() => setOpenBub(null)} aria-label={T("닫기", "Close")} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-gray-500 transition hover:bg-black/10 active:scale-90 dark:bg-white/10 dark:text-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div className="flex flex-col gap-2.5">
                {openBub.products.map((p) => (
                  <div key={p.title} className="rounded-lg border border-gray-100 dark:border-gray-800 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + SEV_META[p.rep.sev].dot} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-gray-800 dark:text-gray-100">{p.rep.spec || (CAT_LABEL[p.rep.cat] ?? p.rep.cat)}{p.rep.model ? <span className="font-normal text-gray-400 dark:text-gray-500"> ({p.rep.model})</span> : null}</span>
                      <span className="shrink-0">{metricChip(p.rep)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1 border-t border-gray-50 dark:border-gray-800/60 pt-1.5">
                      {p.all.map((sig, si) => (
                        <div key={sig.id + si} className="flex items-center gap-2">
                          {sig.channel ? (sig.url ? <a href={sig.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-24 shrink-0 items-center gap-0.5 truncate text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{pmShopLabel(sig.channel)}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg></a> : <span className="w-24 shrink-0 truncate text-[11px] font-semibold text-gray-600 dark:text-gray-300">{pmShopLabel(sig.channel)}</span>) : <span className="w-24 shrink-0 text-[11px] text-gray-400">—</span>}
                          <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500 dark:text-gray-400">{sig.detail}</span>
                          <span className="shrink-0">{metricChip(sig)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
