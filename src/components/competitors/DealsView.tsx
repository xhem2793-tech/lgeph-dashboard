"use client"

// 프로모 딜 — 동일 스펙 경쟁사 비교(쿠폰·번들·할부·배송·사은품 + 가격대 슬라이더).
import React from "react"
import { type PriceRow, type DealRow } from "@/lib/supabase"
import { canonCode, isAC, PM_CATS, pmFormsFor, pmFormHit, pmSizeList, pmSizeBucket } from "@/lib/classify"
import { peso, pmShopLabel, PmDrop } from "@/components/competitors/shared"

const PTYPES: { k: "c" | "b" | "i" | "f" | "g"; label: string; cls: string }[] = [
  { k: "c", label: "쿠폰", cls: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  { k: "b", label: "번들", cls: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  { k: "i", label: "할부", cls: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { k: "f", label: "배송", cls: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { k: "g", label: "사은품", cls: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300" },
]
// 프로모 문구 → 종류별 상세({c,b,i,f,g})
const promoTypes = (txt: string | null): Partial<Record<string, string>> => {
  const s = txt || ""; const o: Partial<Record<string, string>> = {}
  // 할부 — 개월수 명시
  const inst = s.match(/x\s*(\d+)\s*mos|(\d+)\s*개월/i); if (inst || /installment|무이자|0 ?% ?install/i.test(s)) o.i = inst ? `${inst[1] || inst[2]}개월` : "무이자"
  // 배송
  if (/free ?ship|free ?deliv|무료 ?배송/i.test(s)) o.f = "무료배송"
  // 사은품 — "with FREE X" 품목 우선
  const gift = s.match(/with\s+(?:a\s+)?free\s+([^·|,]{2,22})/i)
  if (gift) o.g = gift[1].replace(/&#\d+;.*/, "").trim().slice(0, 16)
  else if (/사은품|경품|free ?gift|freebie|gift ?with/i.test(s)) o.g = "사은품"
  // 쿠폰 — ₱ 금액 우선
  const coup = s.match(/₱\s*([\d,]+)\s*(?:off|쿠폰|voucher|coupon|discount|할인)|(?:coupon|voucher|쿠폰)[^₱]{0,10}₱\s*([\d,]+)/i)
  if (coup) o.c = "₱" + (coup[1] || coup[2])
  else if (/coupon|voucher|쿠폰|promo ?code/i.test(s)) o.c = "쿠폰"
  // 번들 — 구성 품목 우선
  const bund = s.match(/bundle[:\s]+([^·|,]{2,18})|combo[:\s]+([^·|,]{2,18})/i)
  if (bund) o.b = (bund[1] || bund[2]).trim().slice(0, 14)
  else if (/bundle|번들|combo ?deal|set ?deal/i.test(s)) o.b = "번들"
  return o
}
type SCOffer = { cc: string; brand: string; own: boolean; model: string; at: string | null; list: number | null; net: number; url: string | null; image: string | null; promoByRet: Record<string, Partial<Record<string, string>>>; sizeB: string | null }
/** 동일 스펙 경쟁사 비교 — 유형(+용량) 고정, 브랜드=행·프로모 종류별 컬럼(쿠폰·번들·할부·배송·사은품).
 *  제품사진·유형/용량/브랜드 필터·가격대 세그먼트 토글·검색·vs 자사·시사점. 레이아웃: Claude Design `spec-compare-photo.reference.html`. */
export function DealsView({ rows, deals }: { rows: PriceRow[] | null; deals: DealRow[] | null }) {
  const [cat, setCat] = React.useState("냉장고")
  const [form, setForm] = React.useState("SxS")
  const [size, setSize] = React.useState("전체")
  const [brand, setBrand] = React.useState("전체")
  const [rmin, setRmin] = React.useState(0)
  const [rmax, setRmax] = React.useState(0)
  const [q, setQ] = React.useState("")
  const R = rows ?? []
  const cats = React.useMemo(() => { const av = PM_CATS.filter((c) => R.some((r) => r.category === c)); return av.length ? av : PM_CATS }, [R])
  const formList = pmFormsFor(cat)
  const effForm = formList.includes(form) ? form : (formList[0] ?? "전체")
  const sizes = pmSizeList(cat)
  const effSize = size === "전체" || sizes.includes(size) ? size : "전체"
  const promoLU = React.useMemo(() => { const m: Record<string, string> = {}; (deals ?? []).forEach((d) => { const k = canonCode(d.model, null) + "|" + d.retailer; if (!m[k] && d.promo) m[k] = d.promo }); return m }, [deals])

  // 세그먼트 = 현재 유형(cat+form)의 모델별 최저오퍼
  const segment = React.useMemo(() => {
    const g: Record<string, PriceRow[]> = {}
    R.forEach((r) => { if (r.category !== cat || r.p0 == null) return; if (!pmFormHit(cat, r.model + " " + (r.capacity || ""), effForm, r.brand)) return; const cc = canonCode(r.model, r.code); if (cc.length < 5) return; (g[cc] = g[cc] || []).push(r) })
    return Object.entries(g).map(([cc, list]) => {
      const best = list.reduce((a, x) => ((x.p0 ?? Infinity) < (a.p0 ?? Infinity) ? x : a))
      const srps = list.map((x) => x.srp).filter((v): v is number => v != null)
      const promoByRet: Record<string, Partial<Record<string, string>>> = {}
      Array.from(new Set(list.map((x) => x.retailer))).forEach((ret) => { const p = promoLU[cc + "|" + ret]; if (p) promoByRet[ret] = promoTypes(p) })
      const label = best.code && best.code.length >= 4 && best.code !== "N/A" && !/^[≈]/.test(best.code) ? best.code : cc
      const img = list.map((x) => x.image).find((v) => v && /^https?:/.test(v)) ?? null
      return { cc, brand: best.brand, own: best.brand === "LG", model: label, at: best.retailer ?? null, list: srps.length ? Math.max(...srps) : null, net: best.p0 as number, url: best.url ?? null, image: img, promoByRet, sizeB: pmSizeBucket(cat, best.model, best.capacity) } as SCOffer
    })
  }, [R, cat, effForm, promoLU])

  const brandsL = React.useMemo(() => ["전체", ...Array.from(new Set(segment.map((o) => o.brand))).filter(Boolean)], [segment])
  const lgRef = React.useMemo(() => { const lgs = segment.filter((o) => o.own && (effSize === "전체" || o.sizeB === effSize)); return lgs.length ? lgs.reduce((a, x) => (x.net < a.net ? x : a)) : null }, [segment, effSize])
  // 가격대 도메인(현재 유형·용량 오퍼의 net 범위, 1,000 단위 여유) — 유형·용량 바뀌면 리셋
  const sizeOffers = React.useMemo(() => segment.filter((o) => effSize === "전체" || o.sizeB === effSize), [segment, effSize])
  const dom = React.useMemo(() => { const vals = sizeOffers.map((o) => o.net); if (!vals.length) return [0, 0] as [number, number]; const lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max(1000, Math.round((hi - lo) * 0.2 / 1000) * 1000); return [Math.floor((lo - pad) / 1000) * 1000, Math.ceil((hi + pad) / 1000) * 1000] as [number, number] }, [sizeOffers])
  const domKey = cat + "|" + effForm + "|" + effSize + "|" + dom[0] + "|" + dom[1]
  const domKeyRef = React.useRef("")
  React.useEffect(() => { if (domKeyRef.current !== domKey) { domKeyRef.current = domKey; setRmin(dom[0]); setRmax(dom[1]) } }, [domKey, dom])
  const kw = q.trim().toLowerCase()
  const list = React.useMemo(() => segment.filter((o) =>
    (effSize === "전체" || o.sizeB === effSize) &&
    (brand === "전체" || o.brand === brand) &&
    o.net >= rmin && o.net <= rmax &&
    (!kw || (o.brand + " " + o.model).toLowerCase().includes(kw))
  ).sort((a, b) => a.net - b.net), [segment, effSize, brand, rmin, rmax, kw])
  const best = list.length ? list[0].net : 0
  // 이중 드래그 슬라이더(선 위 2핸들 + 브랜드 가격점) — 지도 기간 슬라이더와 동일 인터랙션
  const trackRef = React.useRef<HTMLDivElement>(null)
  const rangeRef = React.useRef({ lo: rmin, hi: rmax }); rangeRef.current = { lo: rmin, hi: rmax }
  const pctOf = (v: number) => (dom[1] === dom[0] ? 0 : ((v - dom[0]) / (dom[1] - dom[0])) * 100)
  const startDrag = (isLo: boolean) => (e: React.PointerEvent) => {
    e.preventDefault(); const track = trackRef.current; if (!track) return; const gap = Math.max(1000, (dom[1] - dom[0]) * 0.03)
    const move = (ev: PointerEvent) => { const r = track.getBoundingClientRect(); let t = (ev.clientX - r.left) / r.width; t = Math.max(0, Math.min(1, t)); const v = Math.round((dom[0] + t * (dom[1] - dom[0])) / 500) * 500; if (isLo) setRmin(Math.max(dom[0], Math.min(v, rangeRef.current.hi - gap))); else setRmax(Math.min(dom[1], Math.max(v, rangeRef.current.lo + gap))) }
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up) }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up)
  }

  const promoAt = (o: SCOffer, k: string): { val: string; at: string; other: boolean } | null => {
    if (o.at && o.promoByRet[o.at] && o.promoByRet[o.at][k]) return { val: o.promoByRet[o.at][k] as string, at: o.at, other: false }
    for (const ret of Object.keys(o.promoByRet)) { if (o.promoByRet[ret][k]) return { val: o.promoByRet[ret][k] as string, at: ret, other: true } }
    return null
  }
  const won = (n: number | null) => peso(n)
  const lgRank = list.findIndex((o) => o.own) + 1
  const cheaper = list.filter((o) => !o.own && lgRef && o.net < lgRef.net)
  const lgTypes = new Set(lgRef ? Object.keys(lgRef.promoByRet[lgRef.at ?? ""] || {}) : [])
  const rivalOnly = PTYPES.filter((p) => !lgTypes.has(p.k) && list.some((o) => !o.own && promoAt(o, p.k)))
  const win = lgRank === 1 && !!lgRef
  const gapCell = (o: SCOffer) => o.own ? <span className="text-gray-300 dark:text-gray-600">기준</span> : !lgRef ? <span className="text-gray-300">—</span> : (o.net - lgRef.net) > 0 ? <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{won(o.net - lgRef.net)}</span> : <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{won(o.net - lgRef.net)}</span>

  if (rows === null) return <div className="flex min-h-[440px] items-center justify-center text-[12.5px] text-gray-400 dark:text-gray-500">불러오는 중</div>

  return (
    <div className="mt-3 overflow-hidden rounded-xl">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <span className="h-4 w-1 rounded bg-indigo-500" />
        <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">동일 스펙 경쟁사 비교</h2>
        <span className="rounded border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-600 dark:text-rose-400">INTERNAL USE ONLY</span>
        <div className="ml-auto flex items-center gap-1"><span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">종류</span>{PTYPES.map((p) => <span key={p.k} className={"rounded px-1.5 py-0.5 text-[10.5px] font-bold " + p.cls}>{p.label}</span>)}</div>
      </header>
      {/* 필터 */}
      <div className="flex flex-col gap-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="w-fit"><PmDrop label="제품" sel={cat} options={cats.map((c) => ({ k: c, t: c }))} onSelect={(k) => { setCat(k); setForm(pmFormsFor(k)[0] ?? "전체"); setSize("전체"); setBrand("전체") }} /></div>
          {formList.length > 0 && <div className="w-fit"><PmDrop label="유형" sel={effForm} options={formList.map((t) => ({ k: t, t }))} onSelect={(k) => { setForm(k); setBrand("전체") }} /></div>}
          <div className="w-fit"><PmDrop label={isAC(cat) ? "마력" : cat === "TV" ? "화면" : "용량"} sel={effSize} options={["전체", ...sizes].map((t) => ({ k: t, t }))} onSelect={setSize} /></div>
          <div className="w-fit"><PmDrop label="브랜드" sel={brand} options={brandsL.map((b) => ({ k: b, t: b }))} onSelect={setBrand} /></div>
          <div className="relative ml-auto">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="모델·브랜드 검색" className="w-[200px] rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="w-9 shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">가격대</span>
          <span className="w-[74px] shrink-0 text-right text-[12px] font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{peso(rmin)}</span>
          <div ref={trackRef} className="relative h-6 w-[320px] shrink-0 select-none">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-indigo-500" style={{ left: pctOf(rmin) + "%", width: (pctOf(rmax) - pctOf(rmin)) + "%" }} />
            <div className="pointer-events-none absolute inset-0">{sizeOffers.map((o, i) => { const inR = o.net >= rmin && o.net <= rmax; return <span key={i} className={"absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity " + (o.own ? "bg-indigo-500" : "bg-gray-400") + (inR ? "" : " opacity-25")} style={{ left: pctOf(o.net) + "%" }} /> })}</div>
            <div onPointerDown={startDrag(true)} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-indigo-500 bg-white dark:bg-gray-900 shadow transition-transform active:scale-110" style={{ left: pctOf(rmin) + "%" }} />
            <div onPointerDown={startDrag(false)} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-indigo-500 bg-white dark:bg-gray-900 shadow transition-transform active:scale-110" style={{ left: pctOf(rmax) + "%" }} />
          </div>
          <span className="w-[74px] shrink-0 text-[12px] font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{peso(rmax)}</span>
          <button type="button" onClick={() => { setRmin(dom[0]); setRmax(dom[1]) }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 transition hover:bg-white dark:hover:bg-gray-800">초기화</button>
          <p className="ml-auto text-[11.5px] text-gray-500 dark:text-gray-400">{lgRef ? <>자사 <b className="text-indigo-700 dark:text-indigo-300">{lgRef.model}</b> 기준</> : "자사(LG) 모델 없음"} · 표시 <b className="tabular-nums">{list.length}</b></p>
        </div>
      </div>
      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] table-fixed border-collapse text-[12px]">
          <colgroup>
            <col style={{ width: 62 }} /><col style={{ width: 220 }} /><col style={{ width: 92 }} /><col style={{ width: 110 }} /><col style={{ width: 72 }} /><col style={{ width: 96 }} />
            {PTYPES.map((p) => <col key={p.k} style={{ width: 118 }} />)}
          </colgroup>
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-[11.5px]">
              <th className="border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">제품</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">브랜드 · 모델</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">최저 채널</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">실판매가</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">할인율</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">vs 자사</th>
              {PTYPES.map((p) => <th key={p.k} className="border-b border-l border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">{p.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-[12px] text-gray-400 dark:text-gray-500">선택한 조건에 해당하는 제품이 없습니다.</td></tr>
            ) : list.slice(0, 80).map((o, ri) => {
              const isBest = o.net === best, disc = o.list != null && o.list > o.net ? Math.round((o.list - o.net) / o.list * 100) : 0
              return (
                <tr key={o.cc + ri} className={"border-b border-gray-100 dark:border-gray-800/60 last:border-0 " + (o.own ? "bg-indigo-50/40 dark:bg-indigo-500/5" : "hover:bg-gray-50 dark:hover:bg-gray-800/40")}>
                  <td className="px-3 py-3"><div className={"flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-white dark:bg-gray-900 " + (o.own ? "border-indigo-200 dark:border-indigo-500/40" : "border-gray-200 dark:border-gray-700")}>{o.image ? <img src={o.image} alt={o.model} loading="lazy" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; const s = e.currentTarget.nextElementSibling as HTMLElement | null; if (s) s.style.display = "flex" }} /> : null}<span className={"h-full w-full items-center justify-center text-[14.5px] font-bold " + (o.image ? "hidden " : "flex ") + (o.own ? "text-indigo-500" : "text-gray-400 dark:text-gray-500")}>{o.brand.slice(0, 2)}</span></div></td>
                  <td className={"px-3 py-3 " + (o.own ? "border-r border-indigo-100 dark:border-indigo-500/20" : "")}>
                    <span className="flex flex-wrap items-center gap-1.5">{o.own ? <span className="h-3.5 w-1 rounded bg-indigo-500" /> : null}<span className={"text-[12.5px] font-bold " + (o.own ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{o.brand}</span>{o.own ? <span className="rounded bg-indigo-100 dark:bg-indigo-500/20 px-1 py-px text-[10px] font-bold text-indigo-600 dark:text-indigo-300">자사</span> : isBest ? <span className="rounded bg-emerald-500 px-1 py-px text-[10px] font-bold text-white">최저가</span> : null}</span>
                    <span className={"mt-0.5 block " + (o.own ? "pl-2.5" : "")}>{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-[11px] tabular-nums text-indigo-600 hover:underline dark:text-indigo-400">{o.model}</a> : <span className="text-[11px] tabular-nums text-gray-400">{o.model}</span>}</span>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-gray-600 dark:text-gray-300">{o.at ? pmShopLabel(o.at) : "—"}</td>
                  <td className="px-3 py-3 text-right"><span className={"text-[13.5px] tabular-nums font-bold " + (o.own ? "text-indigo-700 dark:text-indigo-300" : isBest ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-gray-50")}>{won(o.net)}</span>{o.list != null && o.list > o.net ? <div className="text-[10.5px] tabular-nums text-gray-400 line-through dark:text-gray-500">{won(o.list)}</div> : null}</td>
                  <td className="px-3 py-3 text-center">{disc > 0 ? <span className="rounded bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400">-{disc}%</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums">{gapCell(o)}</td>
                  {PTYPES.map((p) => { const pa = promoAt(o, p.k); return <td key={p.k} className="border-l border-gray-100 dark:border-gray-800 px-3 py-3 align-top">{pa ? <><span className={"inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold " + p.cls}>{pa.val}</span>{pa.other ? <span className="mt-0.5 block text-[10px] text-amber-600 dark:text-amber-400">↳ {pmShopLabel(pa.at)}</span> : null}</> : <span className="text-[12.5px] text-gray-300 dark:text-gray-600">—</span>}</td> })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* 시사점 */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
        {lgRef ? (
          <p className="flex items-start gap-1.5 text-[12px] leading-relaxed">
            <span className={"mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-white " + (win ? "bg-emerald-600" : "bg-rose-500")}>LG 시사점</span>
            {win ? <span className="text-emerald-800 dark:text-emerald-300">자사 <b>최저가</b> · 할인율 {lgRef.list != null && lgRef.list > lgRef.net ? Math.round((lgRef.list - lgRef.net) / lgRef.list * 100) : 0}%. {rivalOnly.length ? <>단, 경쟁사만 제공하는 <b>{rivalOnly.map((p) => p.label).join("·")}</b> 확인 — 프로모 구성 보완.</> : "프로모 스택도 우위."}</span>
              : <span className="text-rose-700 dark:text-rose-300">자사 <b>{lgRank > 0 ? lgRank + "위" : "범위 밖"}</b>{cheaper.length ? <> · 더 싼 경쟁사 <b>{cheaper.map((c) => c.brand).join(", ")}</b>(최저 −{won(lgRef.net - best)})</> : ""}. {rivalOnly.length ? <>경쟁사만 주는 <b>{rivalOnly.map((p) => p.label).join("·")}</b>도 열세 — 대응 필요.</> : "가격 대응 우선."}</span>}
          </p>
        ) : <p className="text-[12px] text-gray-400 dark:text-gray-500">이 유형·용량에 자사(LG) 모델이 없어 vs 자사 비교를 생략합니다.</p>}
      </div>
    </div>
  )
}

// ── 이상치 알림(AnomalyAlerts) — 스크랩 3일가(p0/p1/p2)·할인율·재고에서 시장 이상 신호 감지 ──
