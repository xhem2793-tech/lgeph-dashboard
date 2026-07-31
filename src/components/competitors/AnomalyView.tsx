"use client"

// 이상치 알림 — 가격 급락/급등·깊은할인·품절 이벤트(유리/불리 관점·심각도 필터).
import React from "react"
import { fmtStamp, type PriceRow } from "@/lib/supabase"
import { canonCode, PM_CATS } from "@/lib/classify"
import { peso, pmShopLabel } from "@/components/competitors/shared"

const SEV_META: Record<string, { label: string; dot: string; chip: string; order: number }> = {
  alert: { label: "경보", dot: "bg-rose-500", chip: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400", order: 0 },
  warn: { label: "주의", dot: "bg-amber-500", chip: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300", order: 1 },
  opp: { label: "기회", dot: "bg-emerald-500", chip: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", order: 2 },
  info: { label: "정보", dot: "bg-gray-400", chip: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", order: 3 },
}
type AnomalyRow = { id: string; dkey: string; sev: string; cat: string; brand: string; title: string; detail: string; before: number | null; after: number | null; channel: string; url: string | null; mag: number }
const md2 = (d: string) => { const p = (d || "").split("-"); return p.length === 3 ? `${+p[1]}월 ${+p[2]}일` : d }
export function AnomalyView({ rows, stamp }: { rows: PriceRow[] | null; stamp: string | null }) {
  const [sev, setSev] = React.useState("전체")
  const R = rows ?? []
  const alerts = React.useMemo(() => {
    const out: AnomalyRow[] = []
    const dedup = new Set<string>()
    const add = (a: AnomalyRow) => { const k = a.dkey + "|" + a.cat + "|" + a.brand + "|" + a.title.slice(0, 40); if (dedup.has(k)) return; dedup.add(k); out.push(a) }
    R.forEach((r, i) => {
      if (!PM_CATS.includes(r.category)) return
      const cc = canonCode(r.model, r.code); if (cc.length < 5) return
      const isLG = r.brand === "LG"
      const label = r.code && r.code.length >= 4 && r.code !== "N/A" ? r.code : cc
      const nm = `${r.brand} ${label}`
      // 오늘(d0 vs d1) · 어제(d1 vs d2) 가격 급변
      const spans: [number | null, number | null, string, string][] = [[r.p1, r.p0, r.d0 || "", "오늘"], [r.p2, r.p1, r.d1 || "", "어제"]]
      spans.forEach(([bef, aft, dt, dlabel]) => {
        if (bef == null || aft == null || bef <= 0 || !dt) return
        const chg = (aft - bef) / bef
        if (chg <= -0.06) {
          const sv = isLG ? "opp" : (chg <= -0.13 ? "alert" : "warn")
          add({ id: `${i}-drop-${dlabel}`, dkey: dt, sev: sv, cat: "가격 급락", brand: r.brand, title: nm, detail: isLG ? "자사 실판매가 인하 — 가격 경쟁력↑" : `${r.retailer} 실판매가 급락 — 자사 최저가 위협`, before: bef, after: aft, channel: r.retailer, url: r.url, mag: Math.abs(chg) })
        } else if (chg >= 0.08 && !isLG) {
          add({ id: `${i}-rise-${dlabel}`, dkey: dt, sev: "opp", cat: "가격 급등", brand: r.brand, title: nm, detail: `${r.retailer} 가격 인상 — 자사 상대 우위 확대`, before: bef, after: aft, channel: r.retailer, url: r.url, mag: chg })
        }
      })
      // 깊은 할인
      if ((r.discountPct ?? 0) >= 30 && r.d0) {
        add({ id: `${i}-disc`, dkey: r.d0, sev: isLG ? "opp" : "warn", cat: "깊은 할인", brand: r.brand, title: nm, detail: `${r.retailer} 할인율 ${Math.round(r.discountPct as number)}%${isLG ? " — 자사 프로모 강세" : " — 경쟁 공격적 가격"}`, before: r.srp, after: r.p0, channel: r.retailer, url: r.url, mag: (r.discountPct as number) / 100 })
      }
      // 품절
      if (r.availability === "OutOfStock" && r.d0) {
        add({ id: `${i}-oos`, dkey: r.d0, sev: isLG ? "alert" : "opp", cat: isLG ? "자사 품절" : "경쟁사 품절", brand: r.brand, title: nm, detail: isLG ? `${r.retailer} 품절 — 판매 기회 손실` : `${r.retailer} 경쟁사 품절 — 자사 반사이익`, before: null, after: null, channel: r.retailer, url: r.url, mag: 0.2 })
      }
    })
    return out
  }, [R])

  // 날짜 그룹(최신순) — 각 그룹 내 심각도·변동폭 순
  const days = React.useMemo(() => {
    const byDay: Record<string, AnomalyRow[]> = {}
    alerts.forEach((a) => { (byDay[a.dkey] = byDay[a.dkey] || []).push(a) })
    const dkeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a))
    return dkeys.map((dk, i) => ({ dk, label: i === 0 ? "오늘" : i === 1 ? "어제" : md2(dk), date: md2(dk), items: byDay[dk].filter((a) => sev === "전체" || SEV_META[a.sev].label === sev).sort((x, y) => SEV_META[x.sev].order - SEV_META[y.sev].order || y.mag - x.mag).slice(0, 50) })).filter((g) => g.items.length)
  }, [alerts, sev])

  const counts = React.useMemo(() => { const c: Record<string, number> = { alert: 0, warn: 0, opp: 0, info: 0 }; alerts.forEach((a) => c[a.sev]++); return c }, [alerts])

  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[14px] text-gray-400 dark:text-gray-500">불러오는 중</div>

  const deltaChip = (a: AnomalyRow) => {
    if (a.before == null || a.after == null || a.before <= 0) return null
    const down = a.after < a.before, pct = Math.round((a.after - a.before) / a.before * 100)
    return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-gray-600 dark:text-gray-300"><span className="text-gray-400 line-through dark:text-gray-500">{peso(a.before)}</span>→<span className="font-bold text-gray-900 dark:text-gray-50">{peso(a.after)}</span><span className={"font-bold " + (down ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{pct > 0 ? "+" : ""}{pct}%</span></span>
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* 요약·필터 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-white dark:bg-gray-900 px-4 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {["전체", "경보", "주의", "기회", "정보"].map((f) => <button key={f} type="button" onClick={() => setSev(f)} className={"whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold transition " + (f === sev ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")}>{f}</button>)}
        </div>
        <div className="ml-auto flex items-center gap-3.5 text-[13px]">
          {([["경보", "alert"], ["주의", "warn"], ["기회", "opp"]] as const).map(([l, k]) => <span key={k} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className={"h-2 w-2 rounded-full " + SEV_META[k].dot} />{l} <b className="tabular-nums text-gray-800 dark:text-gray-100">{counts[k]}</b></span>)}
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-gray-500 dark:text-gray-400">총 <b className="tabular-nums text-indigo-600 dark:text-indigo-400">{alerts.length}</b></span>
          <span className="hidden text-[12px] text-gray-400 dark:text-gray-500 sm:inline">최종 {stamp ? fmtStamp(stamp) : "—"}</span>
        </div>
      </div>
      {/* 피드 */}
      {days.length === 0 ? (
        <p className="rounded-xl bg-white dark:bg-gray-900 py-16 text-center text-[14px] text-gray-400 dark:text-gray-500">감지된 이상치가 없습니다.</p>
      ) : days.map((g) => (
        <div key={g.dk}>
          <div className="mb-2 mt-1 flex items-center gap-2">
            <span className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{g.label}</span>
            {g.label !== g.date && <span className="text-[12px] text-gray-400 dark:text-gray-500">{g.date}</span>}
            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-px text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">{g.items.length}</span>
            <span className="ml-1 h-px flex-1 bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="overflow-hidden rounded-xl bg-white dark:bg-gray-900">
            {g.items.map((a, i) => { const sv = SEV_META[a.sev]; return (
              <div key={a.id + i} className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800/60 px-3 py-2.5 transition-colors last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <span className={"h-2 w-2 shrink-0 rounded-full " + sv.dot} />
                <span className={"inline-flex w-11 shrink-0 items-center justify-center rounded px-1 py-0.5 text-[11px] font-bold " + sv.chip}>{sv.label}</span>
                <span className="hidden w-24 shrink-0 truncate rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 xl:inline-block">{a.cat}</span>
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="shrink-0 whitespace-nowrap text-[14px] font-bold text-gray-900 dark:text-gray-50">{a.brand === "LG" ? <span className="text-indigo-700 dark:text-indigo-300">{a.title}</span> : a.title}</span>
                  <span className="truncate text-[13px] text-gray-400 dark:text-gray-500">{a.detail}</span>
                </div>
                <div className="w-[188px] shrink-0 text-right">{deltaChip(a)}</div>
                {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="w-24 shrink-0 truncate text-right text-[12px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">{pmShopLabel(a.channel)} ↗</a> : <span className="w-24 shrink-0 text-right text-[12px] text-gray-400">{pmShopLabel(a.channel)}</span>}
              </div>
            ) })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-gray-400 dark:text-gray-500">감지 룰: 가격 급락/급등(3일 실판매가 ±6~8%↑), 깊은 할인(SRP 대비 ≥30%), 품절(재고) · 시맨틱=유리(기회)/불리(경보·주의) · 데이터 v_competitor_3d</p>
    </div>
  )
}

/** 일일 가격 변동 — 채널별 가격 비교와 동일 레이아웃. 유통 대신 날짜 컬럼(오늘/어제/그제) + 전일비 + 유통.
 *  인하순/인상순 정렬. 데이터 v_competitor_3d(3일 실판매가). */
/* 홈 대시보드 "가격 동향"의 전일비 뱃지 — ₱↔% 4초 토글 · CountUp · 인하(초록)·인상(빨강) */
