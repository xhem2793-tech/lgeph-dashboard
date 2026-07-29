"use client"

import React, { useEffect, useMemo, useState } from "react"
import { dataProvenance, allIndicatorLatest, type Provenance } from "@/lib/supabase"

/** 전체 지표 리스트 — 분류별로 나눠 보는 대신 모든 지표를 한 화면에서 검색·정렬로 훑어보는 목록 뷰(캘린더 리스트와 동일 개념).
 *  각 지표의 최신값·직전 대비·데이터 기간·출처·신뢰도를 한 줄로. */

// 카테고리 분류(경제지표 네비와 정합) — 지표키+라벨 키워드 매칭, 위에서부터 우선
const CATS: { key: string; ko: string; re: RegExp }[] = [
  { key: "prices", ko: "물가·생활비", re: /cpi|inflation|price|물가|가격|생활비|유가|fuel|diesel|gasoline|meralco|전기|electric/i },
  { key: "growth", ko: "국민계정·성장", re: /gdp|gva|growth|investment|construction|industrial|capacity|manufactur|생산|성장|투자|건설|permit|가동/i },
  { key: "labor", ko: "고용·임금·소득", re: /unemploy|employ|wage|labor|labour|ofw|remittance|고용|임금|실업|송금|소득|income/i },
  { key: "sentiment", ko: "기업·소비 심리", re: /confidence|sentiment|cci|bci|bes|expectation|심리|기대|경기전망/i },
  { key: "housing", ko: "부동산·주택", re: /rppi|rrepi|housing|vacancy|property|residential|mortgage|주택|부동산|공실|건축허가|floorarea/i },
  { key: "fx", ko: "환율·원가", re: /fx|usd|neer|reer|peso|exchange|dollar|환율|페소|실효환율/i },
  { key: "rates", ko: "통화·금리·신용", re: /policy_rate|m3|money_supply|money|credit|loan|deposit|금리|통화|대출|신용|카드/i },
  { key: "appliance", ko: "가전 선행지표", re: /appliance|_ppi|producer_price|가전|내구재/i },
  { key: "energy", ko: "에너지 라벨", re: /energy_label|energy_star|doe_|효율|별점|star_rating/i },
  { key: "importprice", ko: "수입 단가", re: /import|comtrade|수입|cif/i },
  { key: "weather", ko: "날씨·재난", re: /cdd|temperature|temp_|typhoon|earthquake|quake|weather|enso|oni|기온|태풍|지진|냉방도일/i },
]
function classify(ind: string, label: string): { key: string; ko: string } {
  const hay = ind + " " + label
  for (const c of CATS) if (c.re.test(hay)) return { key: c.key, ko: c.ko }
  return { key: "etc", ko: "기타" }
}

const ym = (d: string) => (d ? d.slice(0, 4) + "." + Number(d.slice(5, 7)) + "월" : "—")
function fmtVal(v: number): string {
  if (v == null || Number.isNaN(v)) return "—"
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B"
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M"
  if (a >= 1e4) return Math.round(v).toLocaleString()
  if (a >= 100) return v.toFixed(1)
  return v.toFixed(2)
}

type Row = Provenance & { cat: string; catKo: string; value: number | null; period: string; prev: number | null }

export default function AllIndicatorsView() {
  const [prov, setProv] = useState<Provenance[]>([])
  const [latest, setLatest] = useState<Record<string, { value: number; period: string; prev: number | null }>>({})
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")

  useEffect(() => {
    dataProvenance().then(setProv).catch(() => setProv([]))
    allIndicatorLatest().then(setLatest).catch(() => setLatest({}))
  }, [])

  const rows: Row[] = useMemo(() => {
    return prov.map((p) => {
      const c = classify(p.indicator, p.label || "")
      const lv = latest[p.indicator]
      return { ...p, cat: c.key, catKo: c.ko, value: lv ? lv.value : null, period: lv ? lv.period : p.mx, prev: lv ? lv.prev : null }
    })
  }, [prov, latest])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) m[r.cat] = (m[r.cat] || 0) + 1
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => (cat === "all" || r.cat === cat) && (!s || (r.label + " " + r.indicator + " " + r.source + " " + r.catKo).toLowerCase().includes(s)))
  }, [rows, q, cat])

  // 카테고리별 그룹핑(전체 보기일 때)
  const grouped = useMemo(() => {
    const order = [...CATS.map((c) => c.key), "etc"]
    const m: Record<string, Row[]> = {}
    for (const r of filtered) (m[r.cat] = m[r.cat] || []).push(r)
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.label || a.indicator).localeCompare(b.label || b.indicator, "ko"))
    return order.filter((k) => m[k]?.length).map((k) => [k, m[k]] as [string, Row[]])
  }, [filtered])

  const catKo = (k: string) => (k === "etc" ? "기타" : CATS.find((c) => c.key === k)?.ko || k)

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      <section className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 via-indigo-50/40 to-white dark:from-indigo-500/10 dark:via-transparent dark:to-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <h1 className="text-[18px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">전체 지표 리스트</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
          분류별 차트 대신 <b className="font-semibold text-gray-800 dark:text-gray-100">모든 지표를 한 화면에서</b> — 최신값·직전 대비·데이터 기간·출처·신뢰도를 한 줄로 검색·훑어보기.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-4 text-[12px]">
          <span className="text-gray-500 dark:text-gray-400">총 지표 <b className="text-gray-900 dark:text-gray-50">{rows.length}</b></span>
          <span className="text-gray-500 dark:text-gray-400">검색 결과 <b className="text-indigo-600 dark:text-indigo-400">{filtered.length}</b></span>
          <span className="text-gray-500 dark:text-gray-400">분류 <b className="text-gray-900 dark:text-gray-50">{Object.keys(catCounts).length}</b></span>
        </div>
      </section>

      {/* 검색 + 카테고리 필터 */}
      <div className="flex flex-col gap-2.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="지표·출처·분류 검색 (예: 물가, 정책금리, RPPI, World Bank)"
          className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-2 text-[13px] text-gray-800 dark:text-gray-100 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20" />
        <div className="flex flex-wrap gap-1.5">
          <FCat k="all" ko="전체" n={rows.length} cat={cat} setCat={setCat} />
          {[...CATS.map((c) => c.key), "etc"].filter((k) => catCounts[k]).map((k) => (
            <FCat key={k} k={k} ko={catKo(k)} n={catCounts[k]} cat={cat} setCat={setCat} />
          ))}
        </div>
      </div>

      {grouped.map(([k, items]) => (
        <section key={k} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
          <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <span className="h-[16px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{catKo(k)}</h2>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{items.length}개 지표</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12px]">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">
                <th className="px-4 py-1.5">지표</th><th className="px-2 py-1.5 text-right">최신값</th><th className="px-2 py-1.5 text-right">직전 대비</th><th className="px-2 py-1.5">기준</th><th className="px-2 py-1.5">기간</th><th className="px-2 py-1.5">출처</th><th className="px-2 py-1.5 text-center">신뢰도</th>
              </tr></thead>
              <tbody>
                {items.map((r) => {
                  const chg = r.value != null && r.prev != null && r.prev !== 0 ? r.value - r.prev : null
                  const up = chg != null && chg >= 0
                  return (
                    <tr key={r.indicator} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5">
                      <td className="px-4 py-1.5 font-medium text-gray-800 dark:text-gray-100">{r.label || r.indicator}<span className="ml-1.5 font-mono text-[10px] text-gray-300 dark:text-gray-600">{r.indicator}</span></td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums text-gray-900 dark:text-gray-50">{r.value != null ? fmtVal(r.value) : "—"}</td>
                      <td className={"px-2 py-1.5 text-right tabular-nums " + (chg == null ? "text-gray-300 dark:text-gray-600" : up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{chg == null ? "—" : (up ? "▲" : "▼") + fmtVal(Math.abs(chg))}</td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{ym(r.period)}</td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-400 dark:text-gray-500">{ym(r.mn)}~{ym(r.mx)} <span className="text-gray-300 dark:text-gray-600">({r.n})</span></td>
                      <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{r.source}</td>
                      <td className="px-2 py-1.5 text-center">{(r.confidence || "").toUpperCase() === "CONFIRMED" ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span className="text-amber-500">추정</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {prov.length > 0 && filtered.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[13px] text-gray-400">검색 결과 없음</div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        최신값=국가지표(PHILIPPINES) 최신 관측 · 직전 대비=직전 관측 대비 증감 · 기간=데이터 보유 범위(관측수) · 출처·신뢰도는 「데이터 출처·검증」과 동일. 분류는 자동 키워드 매칭이며 원본 출처별 검증은 부록 참조.
      </p>
    </div>
  )
}

function FCat({ k, ko, n, cat, setCat }: { k: string; ko: string; n: number; cat: string; setCat: (v: string) => void }) {
  const on = cat === k
  return (
    <button type="button" onClick={() => setCat(k)}
      className={"rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all duration-200 " + (on ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300")}>
      {ko} <span className={"ml-0.5 text-[10px] tabular-nums " + (on ? "text-indigo-200" : "text-gray-400 dark:text-gray-500")}>{n}</span>
    </button>
  )
}
