"use client"

import React from "react"
import {
  competitorTable,
  freshness,
  fmtStamp,
  promoIntensity,
  promoCampaigns,
  type PriceRow,
  type PromoIntensity,
  type PromoCampaign,
} from "@/lib/supabase"
import { Segmented } from "@/components/Segmented"

/** 경쟁사 가격 — 좌 1/4 메뉴판 + 우 3/4 콘텐츠.
 *
 *  메뉴는 2026-07-10에 정리한 "가격 데이터로 만들 수 있는 분석 13종" 로드맵을 그대로 옮긴 것.
 *  status: live=데이터 연결됨, next=다음 구현, plan=인프라(스펙버킷·롤업) 선행 필요
 *
 *  애니메이션 철학은 대시보드와 동일: fadeUp(진입) · 0.2~0.35s · cubic-bezier(.22,1,.36,1) ·
 *  hover는 indigo-600으로 색만 바뀌고, 클릭은 active:scale로 아주 살짝 눌린다.
 */

type Status = "live" | "next" | "plan"

const GROUPS: { group: string; items: { key: string; no: number; label: string; desc: string; status: Status }[] }[] = [
  {
    group: "매일 보는 것",
    items: [
      { key: "board", no: 0, label: "오늘의 가격 비교", desc: "5개 거래선 × 대표 제품 오늘가 매트릭스", status: "live" },
      { key: "movers", no: 1, label: "일일 가격 변동", desc: "3일 가격·변동폭·할인율", status: "live" },
      { key: "outlier", no: 12, label: "이상치 알림", desc: "임계 초과 급변 · VALIDATION REQ", status: "next" },
    ],
  },
  {
    group: "포지션",
    items: [
      { key: "asp", no: 2, label: "가격 포지셔닝", desc: "브랜드 × 가격대 산점도 · New DOE ★ · LG 위치", status: "live" },
      { key: "gap", no: 3, label: "LG vs 경쟁 갭", desc: "동급 스펙 가격차(%) · 프리미엄/디스카운트", status: "next" },
      { key: "trend", no: 5, label: "ASP 추세", desc: "주·월 평균가 시계열 · 가격 인덱스(100)", status: "next" },
    ],
  },
  {
    group: "채널·프로모",
    items: [
      { key: "promo", no: 4, label: "프로모션 트래커", desc: "브랜드별 프로모 강도 · 유통 캠페인", status: "live" },
      { key: "channel", no: 6, label: "채널별 가격 비교", desc: "동일모델 유통 최저가 · 온·오프 격차", status: "plan" },
    ],
  },
  {
    group: "시장 신호",
    items: [
      { key: "lifecycle", no: 7, label: "신제품·EOL 감지", desc: "신규 리스팅 등장 / 구모델 소멸", status: "plan" },
      { key: "volatility", no: 8, label: "가격 변동성", desc: "모델별 변경 빈도·표준편차 랭킹", status: "plan" },
      { key: "intensity", no: 9, label: "경쟁 강도 지수", desc: "취급 브랜드 수·가격 밀집도", status: "plan" },
      { key: "listing", no: 10, label: "취급·노출 시그널", desc: "브랜드별 리스팅 수 변화", status: "plan" },
      { key: "fx", no: 11, label: "환율 연동 분석", desc: "페소 약세 ↔ 수입가전 가격 상관", status: "plan" },
      { key: "sowhat", no: 13, label: "경쟁분석 요약", desc: "핵심 인사이트 · 액션(Owner·Timing)", status: "plan" },
    ],
  },
]

const ALL = GROUPS.flatMap((g) => g.items)
const BRANDS = ["LG", "Samsung", "Panasonic", "TCL", "Midea", "Hisense"]
const SHOPS = ["Anson's", "Abenson", "SM Appliance", "Western Appliances", "Robinsons Appliances"]

/** 세그먼트 — 유통 매장이 실제로 진열을 나누는 축(설치형태·도어·급) */
const SEGMENTS: Record<string, { t: string; re: RegExp }[]> = {
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

/** 가격대 — 절대 금액이 아니라 "급". 프로모 판단이 급별로 갈린다 */
const BANDS: { t: string; lo: number; hi: number }[] = [
  { t: "엔트리 <₱25k", lo: 0, hi: 25000 },
  { t: "미드 ₱25~60k", lo: 25000, hi: 60000 },
  { t: "프리미엄 ₱60k+", lo: 60000, hi: Infinity },
]

const BADGE: Record<Status, { t: string; c: string }> = {
  live: { t: "LIVE", c: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  next: { t: "SOON", c: "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  plan: { t: "PLAN", c: "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400" },
}

const peso = (n: number | null) => (n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US"))
const pct = (n: number | null) => (n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%")
const md = (s: string | null) => (s ? s.slice(5).replace("-", "/") : "—")

/* ─── 오늘의 가격 비교 보드(제품 × 거래선 매트릭스) ─────────────────────────────
 *  열 = 5개 거래선(현재 3사 라이브 + Western·Robinsons 수집 예정),
 *  행 = 카테고리별 대표 제품(하이브리드: ⭐동일SKU + 대표 스펙 앵커).
 *  셀 = 해당 거래선의 매칭 리스팅 오늘가 최저값. 행 내 최저가 강조, LG 행 인디고.       */
const BOARD_SHOPS: { k: string; label: string; live: boolean }[] = [
  { k: "Anson's", label: "Anson's", live: true },
  { k: "Abenson", label: "Abenson", live: true },
  { k: "SM Appliance", label: "SM Appliance", live: true },
  { k: "Western Appliances", label: "Western", live: true },
  { k: "Robinsons Appliances", label: "Robinsons", live: true },
]

type Anchor = { id: string; label: string; note?: string; brand: string; lg?: boolean; sku?: boolean; match: (r: PriceRow) => boolean }
type BoardGroup = { cat: string; icon: string; rows: Anchor[] }

/** 매처 빌더 — 브랜드+카테고리(+모델 정규식, 가격밴드) */
const mk = (brand: string, cat: string, re?: RegExp, lo = 0, hi = Infinity) => (r: PriceRow) =>
  r.brand === brand && r.category === cat && (re ? re.test(r.model) : true) && r.p0 != null && r.p0 >= lo && r.p0 < hi

const BOARD_GROUPS: BoardGroup[] = [
  { cat: "에어컨", icon: "❄️", rows: [
    { id: "ac-lg", label: "LG 에어컨 최저", note: "거래선별 엔트리가", brand: "LG", lg: true, match: mk("LG", "에어컨") },
    { id: "ac-dk", label: "Daikin 에어컨 최저", brand: "Daikin", match: mk("Daikin", "에어컨") },
    { id: "ac-pa", label: "Panasonic 에어컨 최저", brand: "Panasonic", match: mk("Panasonic", "에어컨") },
    { id: "ac-tcl", label: "TCL 에어컨 최저", note: "중국 가성비", brand: "TCL", match: mk("TCL", "에어컨") },
  ] },
  { cat: "냉장고", icon: "🧊", rows: [
    { id: "rf-lg1", label: "LG 프렌치도어 20.8", note: "RVF-X208MC · 동일SKU", brand: "LG", lg: true, sku: true, match: mk("LG", "냉장고", /RVF.?X208/i) },
    { id: "rf-lg2", label: "LG 양문형 23.8", note: "RVS-X238MC · 동일SKU", brand: "LG", lg: true, sku: true, match: mk("LG", "냉장고", /RVS.?X238/i) },
    { id: "rf-ss", label: "Samsung 양문형(SBS)", brand: "Samsung", match: mk("Samsung", "냉장고", /side by side|sbs/i, 40000) },
    { id: "rf-cd", label: "Condura 2도어 중형", note: "현지 가성비", brand: "Condura", match: mk("Condura", "냉장고", undefined, 15000, 45000) },
  ] },
  { cat: "TV", icon: "📺", rows: [
    { id: "tv-lg", label: 'LG UHD 43"', note: "43UA73 · 동일SKU", brand: "LG", lg: true, sku: true, match: mk("LG", "TV", /43UA7|43UA/i) },
    { id: "tv-tcl", label: 'TCL 43" QLED/FHD', note: "43S5K · 동일SKU", brand: "TCL", sku: true, match: mk("TCL", "TV", /43S5K/i) },
    { id: "tv-hs", label: 'Hisense 43" 4K', note: "43A6Q", brand: "Hisense", match: mk("Hisense", "TV", /43A6Q|43A6|43A4/i) },
    { id: "tv-ss", label: 'Samsung 55" 4K', brand: "Samsung", match: mk("Samsung", "TV", /55/, 25000, 90000) },
  ] },
  { cat: "세탁기", icon: "🌀", rows: [
    { id: "wm-lg1", label: "LG 워시타워 올인원", note: "WT2117NHB · 동일SKU", brand: "LG", lg: true, sku: true, match: mk("LG", "세탁기", /WT2117/i) },
    { id: "wm-lg2", label: "LG 드럼 12kg", note: "FV1412 · 동일SKU", brand: "LG", lg: true, sku: true, match: mk("LG", "세탁기", /FV1412/i) },
    { id: "wm-pa", label: "Panasonic 세탁기", brand: "Panasonic", match: mk("Panasonic", "세탁기", undefined, 12000, 60000) },
    { id: "wm-ss", label: "Samsung 세탁기", brand: "Samsung", match: mk("Samsung", "세탁기", undefined, 15000, 70000) },
  ] },
]

type Cell = { live: boolean; price: number | null; n: number; delta: number | null; disc: number | null; isLow: boolean; heat: string }

/** 히트맵 조건부 서식 — 행 내 저가(연녹)→고가(연적) 3-stop 보간(디자인 시안 1c 방식). */
const HEAT_STOPS = [[209, 239, 214], [253, 246, 201], [250, 214, 214]]
const heatRgb = (t: number) => {
  const lerp = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k))
  const c = t < 0.5 ? lerp(HEAT_STOPS[0], HEAT_STOPS[1], t / 0.5) : lerp(HEAT_STOPS[1], HEAT_STOPS[2], (t - 0.5) / 0.5)
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
const deltaFmt = (d: number | null) => (d == null || d === 0 ? "—" : (d < 0 ? "▼ " : "▲ ") + peso(Math.abs(d)).slice(1))
const deltaCol = (d: number | null) => (d == null || d === 0 ? "text-gray-400 dark:text-gray-500" : d < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")

function BoardView({ rows, stamp, asOf }: { rows: PriceRow[] | null; stamp: string | null; asOf: string }) {
  const [mode, setMode] = React.useState<"표준" | "히트맵">("표준")
  const R = rows ?? []
  const loading = rows === null
  const compute = (row: Anchor): { cells: Cell[]; min: number | null; spread: number | null } => {
    const cells: Cell[] = BOARD_SHOPS.map((s) => {
      if (!s.live) return { live: false, price: null, n: 0, delta: null, disc: null, isLow: false, heat: "" }
      const ms = R.filter((r) => r.retailer === s.k && r.p0 != null && row.match(r))
      if (!ms.length) return { live: true, price: null, n: 0, delta: null, disc: null, isLow: false, heat: "" }
      const best = ms.reduce((a, b) => ((b.p0 as number) < (a.p0 as number) ? b : a))
      return { live: true, price: best.p0 as number, n: ms.length, delta: best.deltaPhp ?? null, disc: best.discountPct ?? null, isLow: false, heat: "" }
    })
    const prices = cells.filter((c) => c.live && c.price != null).map((c) => c.price as number)
    const min = prices.length ? Math.min(...prices) : null
    const max = prices.length ? Math.max(...prices) : null
    cells.forEach((c) => {
      if (c.live && c.price != null && min != null) {
        c.isLow = c.price === min
        c.heat = max != null && max > min ? heatRgb((c.price - min) / (max - min)) : heatRgb(0)
      }
    })
    const spread = min != null && max != null && min > 0 && max > min ? ((max - min) / min) * 100 : null
    return { cells, min, spread }
  }
  const heat = mode === "히트맵"
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
5개 거래선 × 대표 제품 <b className="text-gray-700 dark:text-gray-200">오늘가</b> · 행 내 <span className="font-semibold text-emerald-600 dark:text-emerald-400">최저가 강조</span> · ⭐<span className="font-medium">동일 SKU</span>는 여러 거래선 같은 모델
        </p>
        <div className="ml-auto flex items-center gap-2.5">
          {heat ? (
            <span className="flex items-center gap-1.5 text-[10.5px] text-gray-500 dark:text-gray-400">싸다<span className="inline-block h-2.5 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#d1efd6,#fdf6c9,#fad6d6)" }} />비싸다</span>
          ) : (
            <span className="flex items-center gap-2 text-[10.5px] text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1"><span className="rounded bg-emerald-100 dark:bg-emerald-500/15 px-1 text-[8.5px] font-bold text-emerald-700 dark:text-emerald-300">최저</span>행 최저가</span>
              <span className="inline-flex items-center gap-1"><span className="text-emerald-600">▼</span>전일↓</span>
              <span className="inline-flex items-center gap-1"><span className="text-rose-600">▲</span>전일↑</span>
            </span>
          )}
          <Segmented size="sm" value={mode} onChange={(k) => setMode(k as "표준" | "히트맵")} options={[{ k: "표준", label: "표준" }, { k: "히트맵", label: "히트맵" }]} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[860px] border-collapse text-[12px]">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="whitespace-nowrap border-b border-r border-gray-200 dark:border-gray-800 px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">제품 / 모델</th>
              {BOARD_SHOPS.map((s) => (
                <th key={s.k} className={"whitespace-nowrap border-b border-l border-gray-100 dark:border-gray-800 px-3 py-2 " + (heat ? "text-center " : "text-right ") + "font-semibold " + (s.live ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-600")}>
                  {s.label}
                  {!s.live && <span className="ml-1 rounded bg-gray-100 dark:bg-gray-800 px-1 py-px text-[8.5px] font-medium text-gray-400 dark:text-gray-500">수집예정</span>}
                </th>
              ))}
              <th className="whitespace-nowrap border-b border-l border-gray-200 dark:border-gray-800 px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300" title="라이브 거래선 간 최고가/최저가 격차">스프레드</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={BOARD_SHOPS.length + 2} className="px-3 py-12 text-center text-[12px] text-gray-400 dark:text-gray-500">불러오는 중…</td></tr>
            ) : BOARD_GROUPS.map((g) => (
              <React.Fragment key={g.cat}>
                <tr className="bg-gray-50/70 dark:bg-gray-800/40">
                  <td colSpan={BOARD_SHOPS.length + 2} className="border-b border-t border-gray-100 dark:border-gray-800 px-3 py-1.5 text-[11px] font-bold tracking-tight text-gray-700 dark:text-gray-200">
                    <span className="mr-1.5">{g.icon}</span>{g.cat}
                  </td>
                </tr>
                {g.rows.map((row, ri) => {
                  const { cells, spread } = compute(row)
                  return (
                    <tr key={row.id} style={{ animation: "rowIn .3s ease both", animationDelay: Math.min(ri, 8) * 0.03 + "s" }}
                      className={"border-b border-gray-100 dark:border-gray-800 transition-colors " + (row.lg && !heat ? "bg-indigo-50/40 dark:bg-indigo-500/5 hover:bg-indigo-50/70 dark:hover:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/40")}>
                      <td className={"whitespace-nowrap border-r px-3 py-2 align-top " + (row.lg ? "border-indigo-100 dark:border-indigo-500/20" : "border-gray-100 dark:border-gray-800")}>
                        <span className="flex items-center gap-1.5">
                          {row.lg && <span className="h-3.5 w-1 shrink-0 rounded bg-indigo-500" />}
                          {row.sku && <span title="3사 동일 모델" className="shrink-0 text-[10px]">⭐</span>}
                          <span className={"font-semibold " + (row.lg ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{row.label}</span>
                        </span>
                        {row.note && <span className="mt-0.5 block pl-2.5 text-[10px] text-gray-400 dark:text-gray-500">{row.note}</span>}
                      </td>
                      {cells.map((c, i) => (
                        heat ? (
                          <td key={i} className="border-l border-white dark:border-gray-900 px-2 py-2 text-center align-middle" style={c.live && c.price != null ? { background: c.heat } : undefined}>
                            {!c.live ? <span className="text-[11px] text-gray-300 dark:text-gray-700">·</span> : c.price == null ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                              <>
                                <div className="text-[13px] font-bold tabular-nums text-gray-900">{peso(c.price)}</div>
                                <div className={"text-[10px] tabular-nums " + (c.delta == null || c.delta === 0 ? "text-gray-500" : c.delta < 0 ? "text-emerald-700" : "text-rose-700")}>{deltaFmt(c.delta)}</div>
                              </>
                            )}
                          </td>
                        ) : (
                          <td key={i} className="border-l border-gray-100 dark:border-gray-800 px-3 py-2 align-top" style={c.live && c.isLow ? { background: "rgba(16,185,129,0.06)" } : undefined}>
                            {!c.live ? (
                              <div className="text-right text-[11px] text-gray-300 dark:text-gray-700">·</div>
                            ) : c.price == null ? (
                              <div className="text-right text-gray-300 dark:text-gray-600">—</div>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-baseline gap-1.5">
                                  <span className={"text-[14px] font-bold tabular-nums " + (c.isLow ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-gray-50")}>{peso(c.price)}</span>
                                  <span className={"text-[10px] tabular-nums " + deltaCol(c.delta)}>{deltaFmt(c.delta)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {c.disc != null && c.disc > 0 && <span className="rounded bg-amber-50 dark:bg-amber-500/10 px-1 py-px text-[9px] font-bold tabular-nums text-amber-700 dark:text-amber-300">-{c.disc.toFixed(0)}%</span>}
                                  {c.isLow && <span className="rounded bg-emerald-600 px-1.5 py-px text-[8.5px] font-bold text-white">최저</span>}
                                </div>
                              </div>
                            )}
                          </td>
                        )
                      ))}
                      <td className="whitespace-nowrap border-l border-gray-200 dark:border-gray-800 px-3 py-2 text-right align-top tabular-nums">
                        {spread == null ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                          <span className={"font-semibold " + (spread >= 5 ? "text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400")}>{spread.toFixed(1)}%</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-0.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-indigo-700 dark:text-indigo-300">
        <span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 시사점</span>
        <span>⭐동일 SKU 행의 <b>스프레드 ≥5%</b>(적색)는 채널 간 가격 정합성·MAP 이슈 신호 — 우선 점검 대상. 대량존(엔트리 인버터·43″)은 현지·중국 브랜드와 직접 경합하므로 프로모 대응 트리거로 활용.</span>
      </p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">셀 = 각 거래선 매칭 리스팅의 오늘가 최저값 · 전일변동·할인율(SRP 대비)은 해당 리스팅 기준 · 스프레드 = (최고−최저)/최저 · 기준일 {md(asOf)}{stamp ? " · 최종 " + fmtStamp(stamp) : ""}</p>
    </div>
  )
}

/* ─── 가격 포지셔닝 매트릭스(ASP) — 실데이터 기반 ────────────────────────────────
 *  세로=5개 유통 평균 단가(위=고가), 가로=브랜드(좌 저가→우 고가). 카드=브랜드×가격
 *  세그먼트(프리미엄/미드/엔트리) 평균가·가격지수·취급 유통수. 자사(LG) 인디고 강조.
 *  제품(카테고리)·스펙(세그먼트) 선택. New DOE ★는 미수집 → 가격 세그먼트로 대체.   */
const PM_CATS = ["에어컨", "냉장고", "TV", "세탁기"]
const pmMean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pmTicks = (min: number, max: number, count = 5): number[] => {
  const range = (max - min) || 1, raw = range / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-6; v += step) out.push(v)
  return out
}
const pmShort = (n: number) => (n >= 1000 ? "₱" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : "₱" + Math.round(n))
type PMCard = { b: string; tier: string; avg: number; shops: number; n: number; idx: number; left: number; top: number }

function PositioningMatrix({ rows }: { rows: PriceRow[] | null }) {
  const [cat, setCat] = React.useState("에어컨")
  const [spec, setSpec] = React.useState("전체")
  const R = rows ?? []
  const H = 520, PAD = 20, BOTTOM = 10, CARD_W = 116, GAP = 44, GUT = 60
  const cats = React.useMemo(() => PM_CATS.filter((c) => R.some((r) => r.category === c)), [R])
  const segs = SEGMENTS[cat] ?? []
  const effSpec = spec === "전체" || segs.some((s) => s.t === spec) ? spec : "전체"

  const { cards, brands, ticks, gmin, gmax, count } = React.useMemo(() => {
    const seg = segs.find((s) => s.t === effSpec)
    const f = R.filter((r) => r.category === cat && r.p0 != null && (effSpec === "전체" || (seg ? seg.re.test(r.model) : true)))
    if (f.length < 3) return { cards: [] as PMCard[], brands: [] as string[], ticks: [] as number[], gmin: 0, gmax: 0, count: f.length }
    const prices = f.map((r) => r.p0 as number)
    const pmin = Math.min(...prices), pmax = Math.max(...prices)
    const tierOf = (p: number) => { const t = (p - pmin) / ((pmax - pmin) || 1); return t >= 0.6 ? "프리미엄" : t >= 0.3 ? "미드" : "엔트리" }
    const byBrand: Record<string, PriceRow[]> = {}
    f.forEach((r) => { (byBrand[r.brand] = byBrand[r.brand] || []).push(r) })
    const bl = Object.entries(byBrand).map(([b, list]) => ({ b, n: list.length, avg: pmMean(list.map((x) => x.p0 as number)) })).filter((x) => x.n >= 2).sort((a, b) => a.avg - b.avg)
    let brands = bl.slice(0, 9).map((x) => x.b)
    if (!brands.includes("LG") && byBrand["LG"] && byBrand["LG"].length) brands = [...brands.slice(0, 8), "LG"]
    const cards: PMCard[] = []
    brands.forEach((b) => {
      const g: Record<string, PriceRow[]> = {}
      byBrand[b].forEach((r) => { const t = tierOf(r.p0 as number); (g[t] = g[t] || []).push(r) })
      Object.entries(g).forEach(([t, list]) => cards.push({ b, tier: t, avg: pmMean(list.map((x) => x.p0 as number)), shops: new Set(list.map((x) => x.retailer)).size, n: list.length, idx: 0, left: 0, top: 0 }))
    })
    const cmin = Math.min(...cards.map((c) => c.avg)), cmax = Math.max(...cards.map((c) => c.avg))
    const ticks = pmTicks(cmin, cmax, 5)
    const axMin = Math.min(cmin, ticks[0] ?? cmin), axMax = Math.max(cmax, ticks[ticks.length - 1] ?? cmax)
    const topFor = (p: number) => PAD + ((axMax - p) / ((axMax - axMin) || 1)) * (H - PAD - BOTTOM)
    cards.forEach((c) => { c.idx = Math.round((c.avg / cmin) * 100); c.left = ((brands.indexOf(c.b) + 0.5) / brands.length) * 100; c.top = topFor(c.avg) })
    const cols: Record<string, PMCard[]> = {}
    cards.forEach((c) => { (cols[c.b] = cols[c.b] || []).push(c) })
    Object.values(cols).forEach((list) => { list.sort((a, b) => a.top - b.top); for (let i = 1; i < list.length; i++) if (list[i].top - list[i - 1].top < GAP) list[i].top = list[i - 1].top + GAP })
    return { cards, brands, ticks, gmin: axMin, gmax: axMax, count: f.length }
  }, [R, cat, effSpec]) // eslint-disable-line
  const topFor = (p: number) => PAD + ((gmax - p) / ((gmax - gmin) || 1)) * (H - PAD - BOTTOM)
  const brandN = (b: string) => cards.filter((c) => c.b === b).reduce((s, c) => s + c.n, 0)
  const chip = (on: boolean) => "rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 " + (on ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-500/40")

  return (
    <div className="flex flex-col gap-3" style={{ animation: "fadeUp .5s ease both" }}>
      {/* 컨트롤: 제품(카테고리) + 스펙(세그먼트) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">제품</span>
          {cats.map((c) => <button key={c} type="button" onClick={() => { setCat(c); setSpec("전체") }} className={chip(cat === c)}>{c}</button>)}
        </div>
        {segs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">스펙</span>
            <button type="button" onClick={() => setSpec("전체")} className={chip(effSpec === "전체")}>전체</button>
            {segs.map((s) => <button key={s.t} type="button" onClick={() => setSpec(s.t)} className={chip(effSpec === s.t)}>{s.t}</button>)}
          </div>
        )}
        <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500"><b className="text-gray-600 dark:text-gray-300">{count}</b> 리스팅 · 5개 유통 평균</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
            <span className="h-4 w-1 rounded bg-indigo-500" />
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">가격 포지셔닝 · {cat}{effSpec !== "전체" ? " · " + effSpec : ""}</h2>
            <span className="ml-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 dark:text-gray-400">내부용</span>
          </header>
          <p className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-4 py-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            세로축 = <b className="text-gray-700 dark:text-gray-200">5개 유통 평균 단가</b>(위=고가) · 가로축 = 브랜드(좌 저가→우 고가) · 카드 = 가격대 세그먼트별 평균가 · <span className="tabular-nums">( )</span> = 가격지수(최저 평균=100) · <span className="tabular-nums">n곳</span> = 취급 유통 수
          </p>

          {/* 브랜드 컬럼 헤더(플롯과 정렬: 좌측 축 게이지 폭만큼 들여쓰기) */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 py-2 pr-3" style={{ paddingLeft: GUT + 12 }}>
            {brands.map((b) => { const lg = b === "LG"; return (
              <div key={b} className={"flex-1 border-b-2 pb-1 text-center " + (lg ? "border-indigo-500" : "border-transparent")}>
                <div className={"text-[11px] font-bold " + (lg ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300")}>{b}</div>
                <div className="text-[9.5px] tabular-nums text-gray-400 dark:text-gray-500">{brandN(b)}개</div>
              </div>
            ) })}
          </div>

          {/* 플롯 — 좌 축 게이지 + 산점 */}
          <div key={cat + effSpec} className="flex px-3 pb-2 pt-2" style={{ animation: "viewIn .42s cubic-bezier(.16,1,.3,1) both" }}>
            {cards.length === 0 ? (
              <div className="flex h-40 w-full items-center justify-center text-[12px] text-gray-400 dark:text-gray-500">해당 조건의 데이터가 부족합니다</div>
            ) : (
              <>
                {/* 세로축 라벨(₱) */}
                <div className="relative shrink-0" style={{ width: GUT, height: H }}>
                  {ticks.map((v) => (
                    <span key={v} className="absolute right-1 -translate-y-1/2 text-[9.5px] font-medium tabular-nums text-gray-400 dark:text-gray-500" style={{ top: topFor(v) }}>{pmShort(v)}</span>
                  ))}
                  <span className="absolute -left-1 top-1 text-[9px] font-bold uppercase tracking-wide text-gray-300 dark:text-gray-600">고가</span>
                  <span className="absolute -left-1 text-[9px] font-bold uppercase tracking-wide text-gray-300 dark:text-gray-600" style={{ bottom: 2 }}>저가</span>
                </div>
                {/* 산점 영역 */}
                <div className="relative flex-1" style={{ height: H }}>
                  {ticks.map((v) => (
                    <div key={v} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-100 dark:border-gray-800/70" style={{ top: topFor(v) }} />
                  ))}
                  {cards.map((c, i) => { const lg = c.b === "LG"; return (
                    <div key={c.b + c.tier} title={`${c.b} · ${c.tier} · 평균 ${peso(c.avg)} · ${c.shops}개 유통 · ${c.n}개 리스팅`}
                      className={"absolute -translate-x-1/2 overflow-hidden rounded-lg border transition-all duration-200 hover:z-30 hover:-translate-y-0.5 hover:shadow-md " + (lg ? "z-10 border-transparent bg-indigo-600 text-white shadow-sm" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50")}
                      style={{ left: c.left + "%", top: c.top, width: CARD_W, animation: "rowIn .4s cubic-bezier(.16,1,.3,1) backwards", animationDelay: Math.min(i, 20) * 0.025 + "s" }}>
                      <span className={"absolute inset-y-0 left-0 w-1 " + (lg ? "bg-indigo-300" : "bg-gray-400 dark:bg-gray-600")} />
                      <div className="py-1.5 pl-3 pr-2">
                        <div className="flex items-center gap-1">
                          <span className={"text-[10px] font-medium " + (lg ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>{c.tier}</span>
                          <span className={"ml-auto rounded px-1 text-[9px] font-bold leading-4 tabular-nums " + (lg ? "bg-indigo-500/60 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400")}>{c.shops}곳</span>
                        </div>
                        <div className="mt-0.5 text-[13.5px] font-bold leading-tight tabular-nums">{peso(c.avg)} <span className={"text-[10px] font-medium " + (lg ? "text-indigo-200" : "text-gray-400 dark:text-gray-500")}>({c.idx})</span></div>
                      </div>
                    </div>
                  ) })}
                </div>
              </>
            )}
          </div>

          <footer className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-600 dark:text-gray-300">가격 세그먼트</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-300 dark:bg-gray-600" />엔트리 · 미드 · 프리미엄 (해당 조건 가격 3분위 자동)</span>
            <span className="ml-auto inline-flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded bg-indigo-600" />자사(LG) · <span className="inline-block h-3 w-4 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />경쟁사</span>
          </footer>
        </div>
        <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">데이터 = v_competitor_3d 5개 유통 최신 현금가 평균(브랜드×가격 세그먼트) · 가격지수 = 평균 ÷ 최저 세그먼트 평균 × 100 · New DOE ★등급은 별도 내부 데이터(미연동)</p>
      </div>
    </div>
  )
}

/** 화면 표 = CSV. Excel에서 바로 열리도록 UTF-8 BOM */
function exportCsv(rows: PriceRow[], name: string) {
  const head = ["유통", "브랜드", "카테고리", "모델코드", "모델명", "SRP(₱)", "D-2(₱)", "D-1(₱)", "당일(₱)", "전일변동(₱)", "전일변동(%)", "3일변동(%)", "할인율(%)", "URL"]
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const body = rows.map((r) =>
    [r.retailer, r.brand, r.category, r.code, r.model, r.srp, r.p2, r.p1, r.p0, r.deltaPhp, r.deltaPct?.toFixed(1), r.delta3Pct?.toFixed(1), r.discountPct, r.url]
      .map(esc)
      .join(","),
  )
  const csv = "\uFEFF" + [head.join(","), ...body].join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** 3일 미니 라인 — 숫자 3개를 눈으로 비교하는 대신 모양으로 읽는다 */
function Spark({ p2, p1, p0 }: { p2: number | null; p1: number | null; p0: number | null }) {
  const v = [p2, p1, p0]
  if (v.some((x) => x == null)) return <span className="text-gray-300 dark:text-gray-600">—</span>
  const arr = v as number[]
  const mn = Math.min(...arr)
  const mx = Math.max(...arr)
  const W = 40
  const H = 14
  const y = (n: number) => (mx === mn ? H / 2 : H - 2 - ((n - mn) / (mx - mn)) * (H - 4))
  const pts = arr.map((n, i) => (i * (W - 2)) / 2 + 1 + "," + y(n)).join(" ")
  const dn = arr[2] < arr[0]
  const flat = arr[2] === arr[0]
  const col = flat ? "#9ca3af" : dn ? "#047857" : "#b91c1c"
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W - 1} cy={y(arr[2])} r="1.8" fill={col} />
    </svg>
  )
}

function FacetMenu({ label, value, active, children }: { label: string; value: string; active: boolean; children: React.ReactNode }) {
  return (
    <details className="group relative">
      <summary
        className={
          "flex cursor-pointer list-none items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors [&::-webkit-details-marker]:hidden " +
          (active ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-500/40")
        }
      >
        <span className={"font-semibold " + (active ? "text-indigo-400 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500")}>{label}</span>
        <span className={"font-semibold " + (active ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>{value}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="text-gray-300 dark:text-gray-600 transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[280px] w-[190px] overflow-auto rounded-[10px] border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
        {children}
      </div>
    </details>
  )
}

function Opt({ on, count, multi, onClick, children }: { on: boolean; count?: number | null; multi?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors " +
        (on && !multi ? "bg-indigo-50 dark:bg-indigo-500/10 font-semibold text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900")
      }
    >
      <span className="flex items-center gap-2">
        {multi ? (
          <span className={"flex h-[15px] w-[15px] items-center justify-center rounded border " + (on ? "border-indigo-600 bg-indigo-600" : "border-gray-300 dark:border-gray-700")}>
            {on ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg> : null}
          </span>
        ) : null}
        {children}
      </span>
      {count != null ? <span className="num text-[10px] text-gray-400 dark:text-gray-500">{count}</span> : null}
    </button>
  )
}

const COLS: { k: string; t: string; num?: boolean }[] = [
  { k: "brand", t: "브랜드" },
  { k: "category", t: "카테고리" },
  { k: "code", t: "모델코드" },
  { k: "retailer", t: "유통" },
  { k: "p1", t: "D-1", num: true },
  { k: "p0", t: "당일", num: true },
  { k: "deltaPhp", t: "전일변동₱", num: true },
  { k: "deltaPct", t: "전일변동%", num: true },
  { k: "spark", t: "3일 추이" },
  { k: "srp", t: "SRP", num: true },
  { k: "discountPct", t: "할인율", num: true },
]


/** 프로모션 트래커 — 브랜드별 프로모 강도(전주 대비) + 유통 캠페인.
 *  ⚠ Anson's는 정가 필드가 항상 세일가로 잡혀 '비중'이 구조적으로 100%가 된다.
 *     따라서 판단은 '전주 대비 변화'와 '평균 할인율'로만 한다. */
function PromoView({ rows, camps }: { rows: PromoIntensity[] | null; camps: PromoCampaign[] }) {
  if (rows === null) {
    return <div className="flex min-h-[440px] items-center justify-center text-[13px] text-gray-400 dark:text-gray-500">불러오는 중</div>
  }
  if (rows.length === 0) {
    return <div className="flex min-h-[440px] items-center justify-center text-[13px] text-gray-400 dark:text-gray-500">데이터 없음</div>
  }
  const wow = (n: number) => (n > 0 ? "+" + n : String(n))
  const tone = (n: number) =>
    n > 0 ? "text-rose-600 dark:text-rose-400" : n < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/70 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 text-left">브랜드</th>
              <th className="px-3 py-2 text-left">유통</th>
              <th className="px-3 py-2 text-right">프로모 모델</th>
              <th className="px-3 py-2 text-right">전주 대비</th>
              <th className="px-3 py-2 text-right">평균 할인율</th>
              <th className="px-3 py-2 text-right">전주 대비</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.brand + r.retailer}
                className="border-b border-gray-50 dark:border-gray-800 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
                style={{ animation: "rowIn .3s cubic-bezier(.16,1,.3,1) both", animationDelay: i * 22 + "ms" }}
              >
                <td className={"px-3 py-2 font-semibold " + (r.brand === "LG" ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-100")}>
                  {r.brand}
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.retailer}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                  {r.promoModels}
                  <span className="text-[10px] text-gray-400 dark:text-gray-500"> / {r.listedModels}</span>
                </td>
                <td className={"px-3 py-2 text-right tabular-nums font-semibold " + tone(r.promoModelsWow)}>
                  {wow(r.promoModelsWow)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                  {r.avgDiscount === null ? "—" : r.avgDiscount.toFixed(1) + "%"}
                </td>
                <td className={"px-3 py-2 text-right tabular-nums font-semibold " + tone(r.avgDiscountWowPp ?? 0)}>
                  {r.avgDiscountWowPp === null ? "—" : wow(r.avgDiscountWowPp) + "%p"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {camps.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-200">유통 캠페인 (진행 중)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {camps.map((c) => (
              <a
                key={c.retailer + c.title}
                href={c.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 transition-all duration-200 hover:-translate-y-px hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-sm"
              >
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{c.retailer}</p>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50">{c.title}</p>
                <p className="mt-1 text-[11.5px] text-gray-600 dark:text-gray-300">
                  {c.liveDiscounted !== null && <span>할인 {c.liveDiscounted}종 · 평균 {c.avgDiscount}% · 최대 {c.maxDiscount}%</span>}
                  {c.onSaleCount !== null && <span>세일 중 {c.onSaleCount.toLocaleString()}종</span>}
                </p>
                {c.brands.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500">{c.brands.join(" · ")}</p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        프로모 모델 = 할인가 또는 프로모 문구가 걸린 리스팅 · 전주 대비는 7일 전 대비 변화
        <br />
        Anson&apos;s는 정가 필드가 세일가로 표기돼 비중이 항상 100% — 판단은 전주 대비 변화와 평균 할인율 기준
      </p>
    </div>
  )
}

export default function Competitors() {
  const [view, setView] = React.useState("board")
  const [cat, setCat] = React.useState("전체")
  const [brands, setBrands] = React.useState<string[]>(["LG"])
  const [shops, setShops] = React.useState<string[]>([...SHOPS])
  const [seg, setSeg] = React.useState("전체")
  const [band, setBand] = React.useState("전체")
  const [onlyMoved, setOnlyMoved] = React.useState(false)
  const [rows, setRows] = React.useState<PriceRow[] | null>(null)
  const [stamp, setStamp] = React.useState<string | null>(null)
  const [q, setQ] = React.useState("")
  const [priceOpen, setPriceOpen] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "deltaPct", asc: true })
  const [promo, setPromo] = React.useState<PromoIntensity[] | null>(null)
  const [camps, setCamps] = React.useState<PromoCampaign[]>([])

  React.useEffect(() => {
    freshness()
      .then((f) => setStamp(f.prices ?? null))
      .catch(() => {})
    competitorTable(4000)
      .then(setRows)
      .catch(() => setRows([]))
    promoIntensity(14)
      .then(setPromo)
      .catch(() => setPromo([]))
    promoCampaigns()
      .then(setCamps)
      .catch(() => setCamps([]))
  }, [])

  const toggle = (arr: string[], x: string, set: (v: string[]) => void) =>
    set(arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x])

  /** 필터 → 검색 → 정렬. 표에 보이는 것이 곧 CSV로 나가는 것 */
  const data = React.useMemo(() => {
    let d = (rows ?? []).filter(
      (r) =>
        (cat === "전체" || r.category === cat) &&
        (brands.length === 0 || brands.includes(r.brand)) &&
        (shops.length === 0 || shops.includes(r.retailer)),
    )
    if (onlyMoved) d = d.filter((r) => r.deltaPct != null && r.deltaPct !== 0)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      d = d.filter((r) => (r.model + " " + r.code + " " + r.brand + " " + r.category).toLowerCase().includes(k))
    }
    const dir = sort.asc ? 1 : -1
    return [...d].sort((a: any, b: any) => {
      const x = a[sort.k]
      const y = b[sort.k]
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir
    })
  }, [rows, cat, seg, band, brands, shops, onlyMoved, q, sort])

  // 일별 움직임 데이터가 아직 없으면(스냅샷) 전일변동·3일추이 컬럼을 숨김 — 빈 '—' 컬럼이 버그처럼 보이지 않게
  const hasTrend = React.useMemo(() => (rows ?? []).some((r) => r.deltaPhp != null && r.deltaPhp !== 0), [rows])
  const activeCols = React.useMemo(() => COLS.filter((c) => hasTrend || !["deltaPhp", "deltaPct", "spark"].includes(c.k)), [hasTrend])

  const avg = (a: PriceRow[], f: (r: PriceRow) => number | null) => {
    const v = a.map(f).filter((x): x is number => x != null)
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
  }
  /** 카테고리는 리스팅에서 실제로 나온 것만 — 건수 많은 순 */
  const CATS = React.useMemo(() => {
    const m = new Map<string, number>()
    ;(rows ?? []).forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + 1))
    return ["전체", ...Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0])]
  }, [rows])
  const asOf = rows && rows[0] ? rows[0].d0 : "—"
  const active = ALL.find((v) => v.key === view)

  return (
    <div className="mx-auto max-w-[1536px] px-4 pb-6 pt-4 sm:px-6 sm:pb-8">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes rowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"}</style>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside style={{ animation: "fadeUp .5s ease both" }} className="h-fit rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm lg:sticky lg:top-[61px]">
          {/* 좌 메뉴 — 뉴스·경쟁사 광고 사이드바와 동일한 구조(아이콘 헤더·그룹 라벨·우측 상태 메타) */}
          <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 px-3 py-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
            <p className="text-[14px] font-bold tracking-tight text-gray-900 dark:text-gray-50">분석</p>
          </div>
          <div className="px-3 py-3">
            <div className="flex flex-col gap-0.5">
              {GROUPS.map((g) => (
                <React.Fragment key={g.group}>
                  <p className="mb-1 mt-2.5 px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 first:mt-0">{g.group}</p>
                  {g.items.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setView(it.key)}
                      className={
                        "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[.98] " +
                        (view === it.key ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10")
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={"flex-1 truncate text-[13px] transition-colors duration-300 " + (view === it.key ? "font-semibold text-indigo-700 dark:text-indigo-300" : "font-medium text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400")}>{it.label}</span>
                        {it.status === "live"
                          ? <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-px text-[9px] font-bold text-emerald-600 dark:text-emerald-400">LIVE</span>
                          : <span className="shrink-0 text-[9.5px] font-medium text-gray-400 dark:text-gray-500">예정</span>}
                      </span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                setCat("전체")
                setSeg("전체")
                setBand("전체")
                setBrands(["LG"])
                setShops([...SHOPS])
                setOnlyMoved(false)
                setQ("")
              }}
              className="w-full rounded-md border border-gray-200 dark:border-gray-800 py-1.5 text-[12px] text-gray-600 dark:text-gray-300 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-[.98]"
            >
              필터 초기화
            </button>
          </div>
        </aside>

        <div style={{ animation: "fadeUp .5s ease both" }} className="flex min-w-0 flex-col gap-4">
        {view === "movers" ? (() => {
          const R = rows || []
          const cu = R.filter((r) => (r.deltaPct ?? 0) < 0).length
          const hi = R.filter((r) => (r.deltaPct ?? 0) > 0).length
          const nMoved = cu + hi
          const total = R.length
          const lgDisc = avg(R.filter((r) => r.brand === "LG"), (r) => r.discountPct)
          const cxDisc = avg(R.filter((r) => r.brand !== "LG"), (r) => r.discountPct)
          return (
            <div onClick={() => setPriceOpen((v) => !v)} className="group cursor-pointer select-none overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 dark:from-indigo-500/10 via-indigo-50/40 dark:via-transparent to-white dark:to-gray-900 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
                </div>
                <span className="shrink-0 text-[12px] font-bold text-gray-900 dark:text-gray-50">가격 읽기</span>
                {!priceOpen && (
                  <div className="min-w-0 flex-1 truncate text-[13px] text-gray-700 dark:text-gray-200">
                    {nMoved === 0 ? (
                      <><b className="font-semibold text-gray-900 dark:text-gray-50">시장 가격 보합</b> — 관측 {total}개 중 오늘 변동 없음 · LG 할인 {pct(lgDisc)} vs 경쟁 {pct(cxDisc)}</>
                    ) : (
                      <><b className="font-semibold text-gray-900 dark:text-gray-50">오늘 변동 {nMoved}건</b> (인하 {cu}·인상 {hi}) — 관측 {total}개 · LG 할인 {pct(lgDisc)} vs 경쟁 {pct(cxDisc)}</>
                    )}
                  </div>
                )}
                <span className="ml-auto shrink-0 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">더보기 <span className={"inline-block transition-transform " + (priceOpen ? "rotate-180" : "")}>▾</span></span>
              </div>
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: priceOpen ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <div className="border-t border-indigo-100/70 dark:border-indigo-500/25 px-4 pb-3.5 pt-3">
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-500 dark:text-gray-400">
                      <span>관측 <b className="text-gray-800 dark:text-gray-100">{total}</b></span>
                      <span>오늘 변동 <b className="text-gray-800 dark:text-gray-100">{nMoved}건</b> (인하 {cu}·인상 {hi})</span>
                      <span>LG 할인 <b className="text-gray-800 dark:text-gray-100">{pct(lgDisc)}</b> vs 경쟁 {pct(cxDisc)}</span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-200">관측 <b className="text-gray-900 dark:text-gray-50">{total}개 리스팅</b> 기준, 오늘 가격 변동은 <b className="text-gray-900 dark:text-gray-50">{nMoved}건</b>(인하 {cu}·인상 {hi}). LG 자사 리스팅 평균 할인율은 <b className="text-gray-900 dark:text-gray-50">{pct(lgDisc)}</b>로 경쟁({pct(cxDisc)})과 비교됩니다.</p>
                    <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-indigo-700 dark:text-indigo-300"><span className="mt-0.5 shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">LG 시사점</span><span>변동 건수·폭과 경쟁사 SRP 복귀 시점을 주시. 대량 인하 신호 유무로 성수기 프로모 개시 타이밍을 판단.</span></p>
                  </div>
                </div>
              </div>
            </div>
          )
        })() : null}
        <section
          key={view}
          className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
          style={{ animation: "viewIn .42s cubic-bezier(.16,1,.3,1) both" }}
        >
          {view !== "movers" && view !== "asp" && (<header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
            <h2 className="flex items-baseline gap-2 text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {active?.label}
              <span className={"rounded border px-1 py-px text-[9px] font-semibold " + BADGE[active?.status ?? "plan"].c}>
                {BADGE[active?.status ?? "plan"].t}
              </span>
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              최종 갱신 {stamp ? fmtStamp(stamp) : md(asOf)}
              <span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                CONFIRMED
              </span>
            </span>
          </header>)}

          {view === "board" ? (
            <BoardView rows={rows} stamp={stamp} asOf={asOf} />
          ) : view === "asp" ? (
            <PositioningMatrix rows={rows} />
          ) : view === "promo" ? (
            <PromoView rows={promo} camps={camps} />
          ) : active?.status !== "live" ? (
            <div className="flex min-h-[440px] flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">{active?.desc}</p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500">데이터 연결 예정 — 뷰 확정 후 구현</p>
            </div>
          ) : (
            <>
              


              {/* 필터 바 — 매장이 실제로 진열을 나누는 축 순서: 카테고리 → 세그먼트 → 가격대 → 브랜드 → 유통 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                <FacetMenu label="카테고리" value={cat} active={cat !== "전체"}>
                  {CATS.map((c) => (
                    <Opt key={c} on={cat === c} count={rows ? (c === "전체" ? rows.length : rows.filter((r) => r.category === c).length) : null} onClick={() => { setCat(c); setSeg("전체") }}>{c}</Opt>
                  ))}
                </FacetMenu>
                {(SEGMENTS[cat] ?? []).length > 0 ? (
                  <FacetMenu label="세그먼트" value={seg} active={seg !== "전체"}>
                    <Opt on={seg === "전체"} onClick={() => setSeg("전체")}>전체</Opt>
                    {(SEGMENTS[cat] ?? []).map((s) => (
                      <Opt key={s.t} on={seg === s.t} onClick={() => setSeg(s.t)}>{s.t}</Opt>
                    ))}
                  </FacetMenu>
                ) : null}
                <FacetMenu label="가격대" value={band} active={band !== "전체"}>
                  <Opt on={band === "전체"} onClick={() => setBand("전체")}>전체</Opt>
                  {BANDS.map((b) => (
                    <Opt key={b.t} on={band === b.t} onClick={() => setBand(b.t)}>{b.t}</Opt>
                  ))}
                </FacetMenu>
                <FacetMenu label="브랜드" value={brands.length === BRANDS.length ? "전체" : brands.length + "개"} active={brands.length !== BRANDS.length}>
                  {BRANDS.map((b) => (
                    <Opt key={b} multi on={brands.includes(b)} count={rows ? rows.filter((r) => r.brand === b).length : null} onClick={() => toggle(brands, b, setBrands)}>{b}</Opt>
                  ))}
                </FacetMenu>
                <FacetMenu label="유통" value={shops.length === SHOPS.length ? "전체" : shops.length + "곳"} active={shops.length !== SHOPS.length}>
                  {SHOPS.map((s) => (
                    <Opt key={s} multi on={shops.includes(s)} count={rows ? rows.filter((r) => r.retailer === s).length : null} onClick={() => toggle(shops, s, setShops)}>{s === "SM Appliance" ? "SM" : s}</Opt>
                  ))}
                </FacetMenu>
                <button type="button" onClick={() => setOnlyMoved(!onlyMoved)} className={"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors " + (onlyMoved ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-transparent bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700")}>
                  <span className={"flex h-4 w-7 items-center rounded-full px-0.5 transition-colors " + (onlyMoved ? "bg-indigo-600" : "bg-gray-300")}><span className={"h-3 w-3 rounded-full bg-white dark:bg-gray-900 transition-transform " + (onlyMoved ? "translate-x-3" : "")} /></span>
                  변동분만
                </button>
                <div className="ml-auto flex items-center gap-2.5">
                  <div className="relative">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
                    <input value={q} onChange={(ev) => setQ(ev.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="모델코드·모델명 검색" className={"rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-3 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] " + (focused || q ? "w-[360px]" : "w-[260px]")} />
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500"><b className="text-gray-700 dark:text-gray-200">{data.length}</b>행{stamp ? " · 최종 " + fmtStamp(stamp) : ""} <span className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">CONFIRMED</span></span>
                  <button type="button" onClick={() => exportCsv(data, "LGEPH_경쟁사가격_" + asOf + ".csv")} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 transition hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-300">엑셀</button>
                </div>
              </div>

              <div className="mt-2 max-h-[600px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {activeCols.map((c) => (
                        <th
                          key={c.k as string}
                          onClick={() => setSort((s) => ({ k: c.k as string, asc: s.k === c.k ? !s.asc : true }))}
                          className={
                            "cursor-pointer select-none whitespace-nowrap border-b border-gray-200 dark:border-gray-800 px-2 py-1.5 font-semibold text-gray-600 dark:text-gray-300 transition-colors duration-200 hover:text-indigo-600 dark:hover:text-indigo-400 " +
                            (c.num ? "text-right" : "text-left")
                          }
                        >
                          {c.t === "D-2" ? "D-2 " + md(rows?.[0]?.d2 ?? null) : c.t === "D-1" ? "D-1 " + md(rows?.[0]?.d1 ?? null) : c.t === "당일" ? "당일 " + md(asOf) : c.t}
                          {sort.k === c.k ? <span className="ml-0.5 text-indigo-500 dark:text-indigo-400">{sort.asc ? "▲" : "▼"}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody key={cat + brands.join() + shops.join() + band + seg + sort.k + String(sort.asc) + q + String(onlyMoved)}>
                    {rows === null ? (
                      <tr>
                        <td colSpan={activeCols.length} className="px-2 py-10 text-center text-[12px] text-gray-400 dark:text-gray-500">
                          불러오는 중…
                        </td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={activeCols.length} className="px-2 py-10 text-center text-[12px] text-gray-400 dark:text-gray-500">
                          조건에 맞는 행 없음
                        </td>
                      </tr>
                    ) : (
                      data.slice(0, 100).map((r, i) => {
                        const up = (r.deltaPhp ?? 0) > 0
                        const dn = (r.deltaPhp ?? 0) < 0
                        const dcol = dn ? "text-emerald-700 dark:text-emerald-300" : up ? "text-red-700 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
                        return (
                          <tr
                            key={i}
                            style={{ animation: "rowIn .28s ease both", animationDelay: Math.min(i, 24) * 0.02 + "s" }}
                            className="border-b border-gray-100 dark:border-gray-800 transition-all duration-200 hover:-translate-y-px hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 hover:shadow-[0_1px_0_0_rgba(99,102,241,.25)]"
                          >
                            <td className="px-2 py-1 font-medium text-gray-800 dark:text-gray-100">{r.brand}</td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-300">{r.category}</td>
                            <td className="whitespace-nowrap px-2 py-1 font-medium text-gray-800 dark:text-gray-100" title={r.model}>
                              {r.code}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 text-gray-500 dark:text-gray-400">{r.retailer}</td>
                            <td className="num px-2 py-1 text-right text-gray-500 dark:text-gray-400">{peso(r.p1)}</td>
                            <td className="num px-2 py-1 text-right font-semibold text-gray-900 dark:text-gray-50">{peso(r.p0)}</td>
                            {hasTrend && (
                              <>
                                <td className={"num px-2 py-1 text-right " + dcol}>
                                  {r.deltaPhp == null || r.deltaPhp === 0 ? "—" : (dn ? "−" : "+") + peso(Math.abs(r.deltaPhp)).slice(1)}
                                </td>
                                <td className={"num px-2 py-1 text-right font-semibold " + dcol}>
                                  {r.deltaPct == null || r.deltaPct === 0 ? "—" : pct(r.deltaPct)}
                                </td>
                                <td className="px-2 py-1"><Spark p2={r.p2} p1={r.p1} p0={r.p0} /></td>
                              </>
                            )}
                            <td className="num px-2 py-1 text-right text-gray-400 dark:text-gray-500">{peso(r.srp)}</td>
                            <td className="num px-2 py-1 text-right text-gray-600 dark:text-gray-300">
                              {r.discountPct == null ? "—" : r.discountPct.toFixed(0) + "%"}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                표는 상위 100행만 표시(정렬 기준) · 엑셀(CSV)에는 필터된 전체 {data.length}행 전부 · 모델코드에 마우스를 올리면 원문 모델명
              </p>
            </>
          )}
        </section>
        </div>
      </div>
    </div>
  )
}
