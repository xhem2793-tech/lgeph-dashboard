"use client"

// 경쟁사 뷰 공용 프리미티브 — 포맷·라벨·DOE정규화·진열 세그먼트 + 드롭다운 컴포넌트.
// 여러 뷰(BoardView·PositioningMatrix·DealsView·AnomalyView·MoversView)에서 공유.

/** 세그먼트 — 유통 매장이 실제로 진열을 나누는 축(설치형태·도어·급) */
export const SEGMENTS: Record<string, { t: string; re: RegExp }[]> = {
  에어컨: [
    { t: "윈도우", re: /window/i },
    { t: "스플릿", re: /split|wall[- ]?mount/i },
    { t: "플로어·천장", re: /floor|ceiling|cassette/i },
    { t: "포터블", re: /portable/i },
    { t: "인버터", re: /inverter/i },
  ],
  냉장고: [
    { t: "양문형(SxS)", re: /side by side|sxs/i },
    { t: "상냉동", re: /top mount|two door|2 door/i },
    { t: "하냉동·프렌치", re: /bottom|french|multi ?door/i },
    { t: "인버터", re: /inverter/i },
  ],
  세탁기: [
    { t: "프론트로드", re: /front load/i },
    { t: "탑로드", re: /top load/i },
    { t: "트윈워시", re: /twin/i },
  ],
  TV: [
    { t: "OLED", re: /oled/i },
    { t: "QNED·NANO", re: /qned|nano/i },
    { t: "UHD·4K", re: /uhd|4k/i },
  ],
}

export const peso = (n: number | null) => (n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US"))
export const pct = (n: number | null) => (n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%")
export const md = (s: string | null) => (s ? s.slice(5).replace("-", "/") : "—")
export const deltaCol = (d: number | null) => (d == null || d === 0 ? "text-gray-400 dark:text-gray-500" : d < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")

export const pmMean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
export const pmTicks = (min: number, max: number, count = 5): number[] => {
  const range = (max - min) || 1, raw = range / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-6; v += step) out.push(v)
  return out
}
export const pmShort = (n: number) => (n >= 1000 ? "₱" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : "₱" + Math.round(n))

export const DOE_CODE: Record<string, string> = { "RAC": "acu", "SAC": "acu", "TV": "tvl", "냉장고": "ref", "세탁기": "cwm" }
const pmNorm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
// DOE 매칭용 카테고리 인지 정규화 — 에어컨(acu)은 리테일의 실내/실외기 프리픽스(HSN·HSU·HSN/U)를
//   DOE 등록코드(HS-12IPX3=HS+숫자)에 맞춰 HS로 접는다. 이 한 줄로 스플릿 AC 매칭 67%→91%.
export const doeNorm = (doeCode: string, s: string) => { const n = pmNorm(s); return doeCode === "acu" ? n.replace(/HS[NU]+/g, "HS") : n }
export const pmShopLabel = (s: string) => (s === "SM Appliance" ? "SM" : s === "Western Appliances" ? "Western" : s === "Robinsons Appliances" ? "Robinsons" : s)
export const pmStarCls = (s: number | null) => (s == null ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500" : s >= 4 ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : s >= 2 ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300")
// 가격대(tier) 라벨·색 — 엔트리=LOW(초록) · 미드=MED(파랑) · 프리미엄(주황)
export const pmTierLabel = (t: string) => (t === "프리미엄" ? "프리미엄" : t === "미드" ? "MED" : "LOW")
// 카드 왼쪽 세로 스트립 색 — 가격대 구분(배지 대신)
export const pmTierBar = (t: string) => (t === "프리미엄" ? "bg-amber-400 dark:bg-amber-500" : t === "미드" ? "bg-sky-400 dark:bg-sky-500" : "bg-emerald-400 dark:bg-emerald-500")

// 호버 드롭다운 선택 — 좌측 세로 메뉴(마우스 오버로 옵션 펼침)
export function PmDrop({ label, sel, options, onSelect }: { label: string; sel: string; options: { k: string; t: string }[]; onSelect: (k: string) => void }) {
  const cur = options.find((o) => o.k === sel)?.t ?? sel
  return (
    <div className="group relative shrink-0">
      <button type="button" className="flex w-full items-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-left transition-colors group-hover:border-indigo-300 dark:group-hover:border-indigo-500/40">
        <span className="shrink-0 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
        <span className="ml-1.5 whitespace-nowrap text-[12px] font-semibold text-gray-800 dark:text-gray-100">{cur}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 transition-transform duration-200 group-hover:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="invisible absolute left-0 top-[calc(100%-2px)] z-40 max-h-[280px] w-max min-w-full max-w-[280px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {options.map((o) => <button key={o.k} type="button" onClick={() => onSelect(o.k)} className={"block w-full whitespace-nowrap rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " + (o.k === sel ? "bg-indigo-600 font-semibold text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800")}>{o.t}</button>)}
      </div>
    </div>
  )
}
