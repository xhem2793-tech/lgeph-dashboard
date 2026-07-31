"use client"

// 가격 포지셔닝 매트릭스 — 브랜드×가격대 카드맵(로그축·재고필터·MED밴드·★조인).
import React from "react"
import { fmtStamp, type PriceRow, type EnergyRow } from "@/lib/supabase"
import { canonCode, isAC, PM_CATS, pmFormOf, pmFormsFor, pmFormHit, pmSizeList, pmSizeHit, pmTierOf, PM_TIER_BANDS } from "@/lib/classify"
import { peso, pmShopLabel, pmStarCls, pmTierLabel, pmTierBar, DOE_CODE, doeNorm, pmMean, pmTicks, pmShort, PmDrop } from "@/components/competitors/shared"

type PMCard = { b: string; tier: string; label: string; avg: number; shops: number; n: number; star: number | null; kwh: number | null; url: string | null; retailer: string | null; oos: boolean; idx: number; left: number; top: number }

export function PositioningMatrix({ rows, elabels, stamp }: { rows: PriceRow[] | null; elabels: EnergyRow[] | null; stamp: string | null }) {
  const [cat, setCat] = React.useState("냉장고")
  const [spec, setSpec] = React.useState("전체")
  const [form, setForm] = React.useState("SxS")   // 유형 기본값(전체 없음) — 냉장고×SxS
  const [stockF, setStockF] = React.useState("전체")
  const [shop, setShop] = React.useState("전체")
  const [q, setQ] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [dling, setDling] = React.useState(false)
  const [logY, setLogY] = React.useState(true)   // 세로축 스케일 기본=로그(가격 범위 넓어 저가 구간 펼침), Auto=선형
  const cardRef = React.useRef<HTMLDivElement>(null)
  const R = rows ?? []
  // 모델명 검색 → 그 모델이 속한 분류(제품·유형)로 자동 이동. 현재 화면에 없고 다른 분류에 있으면 전환.
  React.useEffect(() => {
    const kw = q.trim().toLowerCase()
    if (kw.length < 2) return
    const inCur = R.some((r) => r.category === cat && ((r.model || "") + " " + (r.code || "")).toLowerCase().includes(kw))
    if (inCur) return
    const hit = R.find((r) => PM_CATS.includes(r.category) && ((r.model || "") + " " + (r.code || "")).toLowerCase().includes(kw))
    if (hit) { setCat(hit.category); const f = pmFormOf(hit.category, (hit.model || "") + " " + (hit.capacity || ""), hit.brand); setForm(f ?? pmFormsFor(hit.category)[0] ?? "전체") }
  }, [q, R]) // eslint-disable-line
  // 화면 플롯 높이 940(뉴스처럼 길게). 이미지 다운로드 시엔 이전 PPT 슬라이드 비율(560)로 압축 캡처
  const [H, setH] = React.useState(940)
  const PAD = 18, BOTTOM = 14, CARD_H = 56, CARD_W = 116, GAP = 50, GUT = 50
  const dlPng = React.useCallback(async () => {
    const node = cardRef.current; if (!node) return
    setDling(true); setH(560) // PPT 슬라이드(16:9) 비율로 압축
    await new Promise((r) => setTimeout(r, 380)) // 재렌더+페인트 대기
    try {
      const { toPng } = await import("html-to-image")
      const url = await toPng(node, { pixelRatio: 2.5, backgroundColor: "#ffffff", cacheBust: true, filter: (n) => !(n instanceof HTMLElement && n.dataset.noexport === "1") })
      const a = document.createElement("a")
      a.href = url
      a.download = `LGEPH_가격포지셔닝_${cat}${form !== "전체" ? "_" + form : ""}_${stamp ? String(stamp).slice(0, 10) : "latest"}.png`
      a.click()
    } catch (e) { console.error(e) } finally { setH(940); setDling(false) }
  }, [cat, form, stamp])
  const cats = React.useMemo(() => PM_CATS.filter((c) => R.some((r) => r.category === c)), [R])
  const shopList = React.useMemo(() => Array.from(new Set(R.filter((r) => r.category === cat).map((r) => r.retailer))).filter(Boolean), [R, cat])
  const sizeList = pmSizeList(cat)   // 스펙(사이즈) 축: 에어컨=HP · 냉장고=cu.ft · 세탁기=kg · TV=인치
  const formList = pmFormsFor(cat)   // 유형(형태) 축: 에어컨=창문/벽걸이/스탠드 · 그 외=SEGMENTS(도어/패널/로드)
  const effSpec = spec === "전체" || sizeList.includes(spec) ? spec : "전체"
  const effForm = formList.includes(form) ? form : (formList[0] ?? form)   // 유형 '전체' 없음 → 미매칭 시 첫 유형
  const effShop = shop === "전체" || shopList.includes(shop) ? shop : "전체"
  const exact = effShop !== "전체" // 거래선 지정 시 평균이 아니라 그 거래선 정확 단가

  // DOE 라벨 인덱스 — 모델코드로 에너지등급(★)+전력소비(월kWh) 조인
  const starIdx = React.useMemo(() => {
    const code = DOE_CODE[cat]
    if (!code || !elabels) return [] as { codeN: string; star: number | null; kwh: number | null }[]
    return elabels.filter((e) => e.category === code && e.model && e.model.length >= 5)
      .map((e) => ({ codeN: doeNorm(code, e.model), star: e.star, kwh: e.kwh })).filter((e) => e.codeN.length >= 5)
  }, [elabels, cat])
  // 매칭: DOE코드 ⊆ 모델(정확) OR 모델canon(≥8자) ⊆ DOE코드(DOE 변형접미어 ZTNQ36GNLE0ZUAC1 등 흡수)
  const matchOf = React.useCallback((model: string) => { const dc = DOE_CODE[cat] || ""; const m = doeNorm(dc, model); const cc = doeNorm(dc, canonCode(model, null)); for (const e of starIdx) { if (m.includes(e.codeN)) return e; if (cc.length >= 8 && e.codeN.includes(cc)) return e } return null }, [starIdx, cat])

  // 스펙은 모델(canon)마다 동일 → 같은 모델의 모든 거래선 리스팅의 이름+capacity(구조화 스펙 포함)를 합쳐
  //   하나의 스펙문자열로 만든다. 어느 한 거래선이 서술적 이름/구조화 스펙을 가지면 그 모델 전체가 정확 분류됨(99% 레버).
  const specText = React.useMemo(() => {
    const m: Record<string, string> = {}
    R.forEach((r) => { if (r.category !== cat) return; const cc = canonCode(r.model, r.code); if (!cc) return; m[cc] = (m[cc] || "") + " " + r.model + " " + (r.capacity || "") })
    return m
  }, [R, cat])
  const specOf = React.useCallback((r: PriceRow) => { const cc = canonCode(r.model, r.code); return (cc && specText[cc]) || (r.model + " " + (r.capacity || "")) }, [specText])

  const { cards, brands, ticks, gmin, gmax, plotH } = React.useMemo(() => {
    const f0 = R.filter((r) => r.category === cat && r.p0 != null && (effShop === "전체" || r.retailer === effShop) && pmSizeHit(cat, specOf(r), null, effSpec) && pmFormHit(cat, specOf(r), effForm, r.brand))
    const empty = { cards: [] as PMCard[], brands: [] as string[], ticks: [] as number[], gmin: 0, gmax: 0, plotH: H, count: f0.length, matched: 0 }
    if (f0.length < 3) return empty
    // 가격대는 카테고리별 절대 기준(PM_TIER_BANDS) — 상대백분위 아님
    const tierOf = (p: number) => pmTierOf(cat, p)
    // 브랜드 선정: 리스팅 수 상위 6~8개(제일 큰 브랜드) · null/빈 브랜드 제외 · LG는 항상 맨 오른쪽
    const byB0: Record<string, PriceRow[]> = {}
    f0.forEach((r) => { (byB0[r.brand] = byB0[r.brand] || []).push(r) })
    // n>=1 — 좁은 필터(특정 유형·거래선)에서 리스팅 1개뿐인 브랜드(예: Emcor 벽걸이 Carrier)가 통째로 사라지지 않게
    const bl = Object.entries(byB0).map(([b, list]) => ({ b, n: list.length, avg: pmMean(list.map((x) => x.p0 as number)) })).filter((x) => x.n >= 1 && x.b && x.b.trim() && x.b.toLowerCase() !== "null")
    // 포지셔닝에는 8개만 노출 — 규모(리스팅 수) 상위로 뽑고 LG는 항상 포함
    const cap = 8
    let top = bl.slice().sort((a, b) => b.n - a.n).slice(0, cap)
    if (!top.some((x) => x.b === "LG")) { const lg = bl.find((x) => x.b === "LG"); if (lg) top = [...top.slice(0, cap - 1), lg] }
    const ordered = top.sort((a, b) => a.avg - b.avg).map((x) => x.b)
    const brands = [...ordered.filter((b) => b !== "LG"), ...(ordered.includes("LG") ? ["LG"] : [])] // LG 맨 오른쪽
    const brandSet = new Set(brands)
    const withStar = f0.filter((r) => brandSet.has(r.brand)).map((r) => { const el = matchOf(r.model); return { ...r, star: el ? el.star : null, kwh: el ? el.kwh : null } })
    const matched = withStar.filter((r) => r.star != null).length
    const f = withStar   // 재고 필터는 모델 집계 후(모델 단위 품절 판정) 적용
    if (!f.length) return { ...empty, matched }
    const modeStar = (arr: (number | null)[]) => { const v = arr.filter((x): x is number => x != null); if (!v.length) return null; const m: Record<number, number> = {}; v.forEach((x) => { m[x] = (m[x] || 0) + 1 }); return Number(Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]) }
    // 모델 단위 — 각 모델의 "최저가 리스팅"을 카드로(가격=그 리스팅 가격, 링크·거래선도 동일 리스팅 → 가격↔링크 정확 일치)
    const cards: PMCard[] = []
    brands.forEach((b) => {
      const g: Record<string, typeof f> = {}
      // 카드 병합 키 = canonCode(거래선마다 다른 r.code로 쪼개지지 않게). 같은 모델 = 1카드
      f.filter((r) => r.brand === b && canonCode(r.model, r.code).length >= 5).forEach((r) => { const cc = canonCode(r.model, r.code); (g[cc] = g[cc] || []).push(r) })
      const models = Object.entries(g).map(([code, list]) => {
        const best = list.reduce((a, x) => ((x.p0 ?? Infinity) < (a.p0 ?? Infinity) ? x : a))
        const kwhs = list.map((x) => x.kwh).filter((v): v is number => v != null).sort((a, x) => a - x)
        // 같은 모델(canonCode)로 병합 후 가격 = 최저가 기준(거래선 전체·특정 무관)
        const price = best.p0 as number
        // 재고: 모든 리스팅이 OutOfStock이면 품절(하나라도 InStock이면 재고있음)
        const oos = list.length > 0 && list.every((x) => x.availability === "OutOfStock")
        const label = best.code && best.code.length >= 4 && best.code !== "N/A" && !/^[≈]/.test(best.code) ? best.code : code
        return { code: label, price, url: best.url ?? null, retailer: best.retailer ?? null, shops: new Set(list.map((x) => x.retailer)).size, n: list.length, star: modeStar(list.map((x) => x.star)), kwh: kwhs.length ? kwhs[Math.floor(kwhs.length / 2)] : null, oos }
      }).filter((m) => m.price != null && (stockF === "전체" || (stockF === "재고있음" ? !m.oos : m.oos)))
      // 전체 모델 표시(상위 N 제한 없음) — 취급 거래선↓·가격↑ 순 정렬만 유지
      models.sort((a, b2) => b2.shops - a.shops || a.price - b2.price).forEach((m) => cards.push({ b, tier: tierOf(m.price), label: m.code, avg: m.price, shops: m.shops, n: m.n, star: m.star, kwh: m.kwh, url: m.url, retailer: m.retailer, oos: m.oos, idx: 0, left: 0, top: 0 }))
    })
    if (!cards.length) return { ...empty, matched }
    const cmin = Math.min(...cards.map((c) => c.avg)), cmax = Math.max(...cards.map((c) => c.avg))
    const ticks = pmTicks(cmin, cmax, 4)
    const axMin = Math.min(cmin, ticks[0] ?? cmin), axMax = Math.max(cmax, ticks[ticks.length - 1] ?? cmax)
    // 브랜드별 카드 수에 맞춰 플롯 높이 동적 확장 — 전체 모델 표시 시 세로로 겹치지 않게(최소 H 보장)
    const colN: Record<string, number> = {}
    cards.forEach((c) => { colN[c.b] = (colN[c.b] || 0) + 1 })
    const maxCol = Math.max(1, ...Object.values(colN))
    const plotH = Math.max(H, PAD + BOTTOM + CARD_H + (maxCol - 1) * GAP)
    const lgv = (v: number) => Math.log(Math.max(1, v))
    const topFor = (p: number) => PAD + ((logY ? lgv(axMax) - lgv(p) : axMax - p) / ((logY ? lgv(axMax) - lgv(axMin) : axMax - axMin) || 1)) * (plotH - PAD - BOTTOM - CARD_H)
    const maxTop = plotH - BOTTOM - CARD_H
    cards.forEach((c) => { c.idx = Math.round((c.avg / cmin) * 100); c.top = topFor(c.avg) })
    const cols: Record<string, PMCard[]> = {}
    cards.forEach((c) => { (cols[c.b] = cols[c.b] || []).push(c) })
    Object.values(cols).forEach((list) => { list.sort((a, b) => a.top - b.top); for (let i = 1; i < list.length; i++) if (list[i].top - list[i - 1].top < GAP) list[i].top = Math.min(list[i - 1].top + GAP, maxTop) })
    return { cards, brands, ticks, gmin: axMin, gmax: axMax, plotH, count: f0.length, matched }
  }, [R, cat, effSpec, effForm, effShop, stockF, matchOf, specOf, H, logY]) // eslint-disable-line
  const lgv = (v: number) => Math.log(Math.max(1, v))
  const topFor = (p: number) => PAD + ((logY ? lgv(gmax) - lgv(p) : gmax - p) / ((logY ? lgv(gmax) - lgv(gmin) : gmax - gmin) || 1)) * (plotH - PAD - BOTTOM - CARD_H)
  const brandN = (b: string) => cards.filter((c) => c.b === b).reduce((s, c) => s + c.n, 0)
  const minW = Math.max(1040, GUT + brands.length * 138 + 20)
  const qq = q.trim().toLowerCase()
  return (
    <div className="flex flex-col gap-3" style={{ animation: "fadeUp .5s ease both" }}>
      {/* 상단 가로 필터 — 드롭다운 + 뉴스형 검색 + 최종갱신 */}
      <div className="relative z-20 flex flex-wrap items-center gap-2">
        <div className="w-fit"><PmDrop label="제품" sel={cat} options={cats.map((c) => ({ k: c, t: c }))} onSelect={(k) => { setCat(k); setSpec("전체"); setForm(pmFormsFor(k)[0] ?? "전체"); setShop("전체") }} /></div>
        {formList.length > 0 && <div className="w-fit"><PmDrop label="유형" sel={effForm} options={formList.map((t) => ({ k: t, t }))} onSelect={setForm} /></div>}
        {sizeList.length > 0 && <div className="w-fit"><PmDrop label={isAC(cat) ? "마력" : cat === "TV" ? "화면" : "용량"} sel={effSpec} options={[{ k: "전체", t: "전체" }, ...sizeList.map((t) => ({ k: t, t }))]} onSelect={setSpec} /></div>}
        <div className="w-fit"><PmDrop label="거래선" sel={effShop} options={[{ k: "전체", t: "전체" }, ...shopList.map((s) => ({ k: s, t: pmShopLabel(s) }))]} onSelect={setShop} /></div>
        <div className="w-fit"><PmDrop label="재고" sel={stockF} options={["전체", "재고있음", "재고없음"].map((s) => ({ k: s, t: s }))} onSelect={setStockF} /></div>
        <div className={"group relative ml-auto transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-[300px]" : "w-[200px]")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="모델·브랜드 검색"
            className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[13px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="지우기" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-gray-400 dark:text-gray-500 lg:flex">최종 {stamp ? fmtStamp(stamp) : "—"}<span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">CONFIRMED</span></span>
      </div>

      {/* 매트릭스 */}
      <div className="overflow-x-auto">
        <div ref={cardRef} className="overflow-hidden rounded-xl" style={{ minWidth: minW }}>
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <span className="h-4 w-1 rounded bg-indigo-500" />
            {(() => { const sp = effSpec !== "전체" ? effSpec : effForm !== "전체" ? effForm : ""; return (
              <span className="text-[25px] font-bold leading-tight text-gray-800 dark:text-gray-100">{cat} <span className="font-semibold text-gray-400 dark:text-gray-500">vs 경쟁사</span> <span className="text-indigo-600 dark:text-indigo-400">{sp ? sp + " " : ""}가격</span></span>
            ) })()}
            <div className="ml-auto flex items-center gap-1.5">
              {/* 세로축 스케일: Auto(선형) / 로그 */}
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 text-[11.5px] font-semibold" title="세로축 가격 스케일 — 로그는 가격대가 넓을 때 저가 구간을 펼쳐 봄">
                <button type="button" onClick={() => setLogY(false)} className={"rounded-md px-2 py-0.5 transition " + (!logY ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-300" : "text-gray-500 dark:text-gray-400")}>Auto</button>
                <button type="button" onClick={() => setLogY(true)} className={"rounded-md px-2 py-0.5 transition " + (logY ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-300" : "text-gray-500 dark:text-gray-400")}>로그</button>
              </div>
              <button type="button" onClick={dlPng} disabled={dling} data-noexport="1" title="카드 전체를 PPT 슬라이드 크기 이미지로 저장" className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-[11.5px] font-semibold text-gray-600 dark:text-gray-300 transition hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                {dling ? "생성중…" : "이미지"}
              </button>
            </div>
          </header>

          {/* 브랜드 컬럼 헤더 — 플롯과 동일 구조(px-4 + 게이지 GUT + flex-1)로 1:1 정렬 */}
          <div className="flex border-b-2 border-gray-200 dark:border-gray-700 px-4 py-2">
            <div className="shrink-0" style={{ width: GUT }} />
            <div className="flex flex-1">
              {brands.map((b) => { const lg = b === "LG"; return (
                <div key={b} className="min-w-0 flex-1 px-1 text-center">
                  <div className={"truncate text-[14px] font-extrabold tracking-tight " + (lg ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{b}</div>
                  <div className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">{brandN(b)}개</div>
                </div>
              ) })}
            </div>
          </div>

          {/* 플롯 — 좌 축 게이지 + 브랜드별 세로 레인(카드는 레인 내부에 가격순 배치) */}
          <div key={cat + effSpec + effShop + stockF} className="flex px-4 pb-3 pt-3">
            {cards.length === 0 ? (
              <div className="flex h-44 w-full items-center justify-center text-[13.5px] text-gray-400 dark:text-gray-500">해당 조건의 데이터가 부족합니다</div>
            ) : (
              <>
                <div className="relative shrink-0" style={{ width: GUT, height: plotH }}>
                  {ticks.map((v) => (
                    <span key={v} className="absolute right-2 -translate-y-1/2 text-[12px] font-semibold tabular-nums text-gray-500 dark:text-gray-400" style={{ top: topFor(v) }}>{pmShort(v)}</span>
                  ))}
                  <span className="absolute right-2 top-0 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">고가</span>
                  <span className="absolute right-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500" style={{ bottom: 2 }}>저가</span>
                </div>
                <div className="relative flex-1" style={{ height: plotH }}>
                  {/* 좌측 세로축(absolute → 컬럼 폭에 영향 없음, 정렬 유지) */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 border-l-2 border-gray-200 dark:border-gray-700" />
                  {/* 중간 가격대(MED) 밴드 — 절대 기준(PM_TIER_BANDS) 구간 강조(상·하단 점선 경계 + 옅은 파랑 배경) */}
                  {(() => { const b = PM_TIER_BANDS[cat] || [25000, 60000]; const t = topFor(Math.min(b[1], gmax)); const bot = topFor(Math.max(b[0], gmin)); return <div className="pointer-events-none absolute inset-x-0 border-y border-dashed border-sky-300/70 dark:border-sky-500/30 bg-sky-50/60 dark:bg-sky-500/10" style={{ top: t, height: Math.max(0, bot - t) }} /> })()}
                  {ticks.map((v) => (
                    <div key={v} className="pointer-events-none absolute inset-x-0 border-t border-gray-200/80 dark:border-gray-700/60" style={{ top: topFor(v) }} />
                  ))}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-gray-200 dark:border-gray-700" />
                  {/* 브랜드 컬럼 세로 구분선(가시성) */}
                  {brands.map((b, i) => (i > 0 ? <div key={"v" + b} className="pointer-events-none absolute inset-y-0 border-l border-gray-200/70 dark:border-gray-700/50" style={{ left: (i / brands.length) * 100 + "%" }} /> : null))}
                  <div className="absolute inset-0 flex">
                    {brands.map((b, bi) => { const lg = b === "LG"; return (
                      <div key={b} className={"relative min-w-0 flex-1 " + (lg ? "bg-indigo-50/40 dark:bg-indigo-500/5" : bi % 2 === 1 ? "bg-gray-50/50 dark:bg-gray-800/20" : "")}>
                        {cards.filter((c) => c.b === b).map((c, ci) => { const hit = !qq || (c.b + " " + c.label).toLowerCase().includes(qq); return (
                          <a key={c.label + ci} href={c.url ?? undefined} target={c.url ? "_blank" : undefined} rel="noreferrer"
                            title={`${c.b} · ${c.label} · ${peso(c.avg)}${c.retailer ? " @ " + pmShopLabel(c.retailer) : ""} · ${c.shops}개 유통 취급${c.star != null ? " · New DOE ★" + c.star : ""}${c.kwh != null ? " · " + Math.round(c.kwh) + "kWh/월" : ""}${c.url ? " · 클릭→원문" : ""}`}
                            className={"absolute block overflow-hidden rounded-lg border transition-all duration-200 hover:z-30 hover:shadow-md " + (c.url ? "cursor-pointer " : "cursor-default ") + (qq && !hit ? "opacity-20 " : "") + (qq && hit ? "z-20 ring-2 ring-indigo-500 " : "") + (c.oos ? "border-dashed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 opacity-70 grayscale" : lg ? "z-10 border-transparent bg-indigo-600 text-white" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50")}
                            style={{ top: c.top, left: "50%", marginLeft: -(CARD_W / 2), width: CARD_W, animation: "rowIn .5s cubic-bezier(.22,1,.36,1) both", animationDelay: (Math.min(ci, 8) * 0.03) + "s", willChange: "opacity" }}>
                            {/* 왼쪽 세로 스트립 = 가격대 색(LOW 초록·MED 파랑·프리미엄 주황) — 배지 대체 */}
                            <span className={"absolute inset-y-0 left-0 w-1.5 " + pmTierBar(c.tier)} title={"가격대: " + pmTierLabel(c.tier)} />
                            <div className="pl-2.5 pr-2">
                              {/* 1행 — 모델 서픽스 + 에너지등급(★) */}
                              <div className="flex items-center gap-1 py-0.5">
                                <span className={"truncate text-[10.5px] font-medium " + (c.oos ? "text-gray-400 dark:text-gray-500" : lg ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>{c.label}</span>
                                {c.oos ? <span className="ml-auto shrink-0 rounded bg-gray-300 dark:bg-gray-600 px-1 text-[9px] font-bold leading-4 text-gray-600 dark:text-gray-200">품절</span> : c.star != null && <span className={"ml-auto shrink-0 rounded px-1 text-[10px] font-bold leading-4 " + pmStarCls(c.star)}>★{c.star}</span>}
                              </div>
                              {/* 2행 — 가격 + 지수(최저가=100). 가격대는 왼쪽 색 스트립으로 표시 */}
                              <div className={"flex items-center gap-1 border-t py-0.5 " + (lg ? "border-indigo-400/40" : "border-gray-100 dark:border-gray-700/60")}>
                                <span className="text-[14px] font-bold leading-tight tabular-nums">{peso(c.avg)}</span>
                                <span className={"ml-auto tabular-nums text-[10px] font-semibold leading-none " + (lg ? "text-indigo-200" : "text-gray-400 dark:text-gray-500")} title="최저가=100 기준 지수">{c.idx}</span>
                              </div>
                              {/* 3행 — 전력효율(월 소비전력) */}
                              <div className={"flex items-center justify-between gap-1 border-t py-0.5 text-[10px] " + (lg ? "border-indigo-400/40" : "border-gray-100 dark:border-gray-700/60")}>
                                <span className={lg ? "text-indigo-200" : "text-gray-400 dark:text-gray-500"}>전력</span>
                                <span className={"tabular-nums font-semibold " + (lg ? "text-white" : "text-gray-600 dark:text-gray-300")}>{c.kwh != null ? Math.round(c.kwh) + " kWh" : "—"}</span>
                              </div>
                            </div>
                          </a>
                        ) })}
                      </div>
                    ) })}
                  </div>
                </div>
              </>
            )}
          </div>

          <footer className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-600 dark:text-gray-300">New DOE ★</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[10px] font-bold " + pmStarCls(5)}>★5·4</span>고효율</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[10px] font-bold " + pmStarCls(3)}>★3·2</span></span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[10px] font-bold " + pmStarCls(1)}>★1</span>저효율</span>
            <span className="mx-0.5 h-3 w-px bg-gray-200 dark:bg-gray-700" />
            <span className="font-semibold text-gray-600 dark:text-gray-300">가격대</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-1.5 rounded-sm bg-emerald-400 dark:bg-emerald-500" />LOW 〈₱{Math.round((PM_TIER_BANDS[cat]?.[0] ?? 25000) / 10000)}만</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-1.5 rounded-sm bg-sky-400 dark:bg-sky-500" />MED</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-1.5 rounded-sm bg-amber-400 dark:bg-amber-500" />프리미엄 ₱{Math.round((PM_TIER_BANDS[cat]?.[1] ?? 60000) / 10000)}만+</span>
            <span className="ml-auto inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded bg-indigo-600" />자사(LG) · <span className="inline-block h-3 w-4 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />경쟁사</span>
          </footer>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          세로축 = <b className="text-gray-500 dark:text-gray-300">{exact ? pmShopLabel(effShop) + " 현금가" : "거래선 최저 현금가"}</b>(위=고가) · 가로축 = 브랜드(좌 저가→우 <b className="text-indigo-500 dark:text-indigo-400">LG</b>) · 카드 = 모델별(동일모델 거래선 병합, 우상단 ★=New DOE) · <span className="tabular-nums">( )</span> = 가격지수(최저=100) · 카드 클릭 → 원문
        </p>
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">New DOE ★ = <b className="text-gray-500 dark:text-gray-400">2026 개정 에너지효율등급</b>(energy_labels 모델코드 {DOE_CODE[cat] || "-"} 매칭) · 가격 데이터 <b className="tabular-nums">{stamp ? fmtStamp(stamp) : "—"}</b> 기준 조인</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          ※ 유형·스펙 분류는 유통 상품속성·모델명에서 추출(모델 단위로 전 거래선 공유). <b className="font-semibold text-gray-500 dark:text-gray-400">정확도 전브랜드 유형 96%·스펙 93%(자사 LG 96%·91%)</b> · 분류 안 되는 잔여는 <b className="font-semibold">기타</b>로 노출돼 필터에서 사라지지 않음 · 가격·스펙·프로모는 수집 가능하나 판매량·점유율은 GfK 패널(비공개) 필요
        </p>
      </div>
    </div>
  )
}

/** 화면 표 = CSV. Excel에서 바로 열리도록 UTF-8 BOM */
