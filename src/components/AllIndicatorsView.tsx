"use client"

import React, { useEffect, useMemo, useState } from "react"
import { dataProvenance, allIndicatorLatest, fmtStamp, type Provenance } from "@/lib/supabase"
import { sourceLink } from "@/components/DataVerification"
import { Segmented } from "@/components/Segmented"
import { CATS, NAV_IDS, classify, catKo } from "@/lib/indicatorCats"

/** 전체 지표 리스트(+데이터 출처·검증 통합) — 분류별 차트 대신 모든 지표를 한 화면에서 검색·정렬로 훑어보고,
 *  각 지표의 최신값·직전 대비·데이터 기간·원본 코드·출처 링크·신뢰도를 한 줄로. 행 클릭 시 해당 분류 차트로 이동. */

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

/** 검색어 하이라이트 — 뉴스 검색과 동일(노란 mark) */
function Hi({ text, q }: { text: string; q: string }) {
  const k = q.trim()
  if (!k || !text) return <>{text}</>
  const parts = text.split(new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"))
  return <>{parts.map((p, i) => (p.toLowerCase() === k.toLowerCase() ? <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-gray-900 dark:text-gray-50">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}</>
}

type Row = Provenance & { cat: string; catKo: string; value: number | null; period: string; prev: number | null }

export default function AllIndicatorsView({ onPick }: { onPick?: (catKey: string) => void }) {
  const [prov, setProv] = useState<Provenance[]>([])
  const [latest, setLatest] = useState<Record<string, { value: number; period: string; prev: number | null }>>({})
  const [q, setQ] = useState("")
  const [focused, setFocused] = useState(false)
  const [cat, setCat] = useState("all")
  const [sort, setSort] = useState<"cat" | "recent">("cat")
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)

  useEffect(() => {
    Promise.all([dataProvenance().catch(() => []), allIndicatorLatest().catch(() => ({}))]).then(([p, l]) => {
      setProv(p as Provenance[]); setLatest(l as Record<string, { value: number; period: string; prev: number | null }>); setLoadedAt(new Date())
    })
  }, [])

  // 행 클릭 → 해당 분류 차트로 이동(onPick 있으면 동일 페이지 전환, 없으면 경제지표로 라우팅)
  function goChart(catKey: string) {
    if (!NAV_IDS.has(catKey)) return
    if (onPick) onPick(catKey)
    else if (typeof window !== "undefined") window.location.href = "/economy/?v=" + catKey
  }

  const rows: Row[] = useMemo(() => {
    const mapped = prov.map((p) => {
      const c = classify(p.indicator, p.label || "")
      const lv = latest[p.indicator]
      return { ...p, cat: c.key, catKo: c.ko, value: lv ? lv.value : null, period: lv ? lv.period : p.mx, prev: lv ? lv.prev : null }
    })
    // 중복 라벨 제거(전기 보급률 등) — 값 있음>CONFIRMED>관측수 순으로 대표 1개만
    const score = (r: Row) => (r.value != null ? 4 : 0) + ((r.confidence || "").toUpperCase() === "CONFIRMED" ? 2 : 0) + (r.n || 0) / 1e6
    const byLabel = new Map<string, Row>()
    for (const r of mapped) {
      const key = (r.label || r.indicator).trim().toLowerCase()
      const ex = byLabel.get(key)
      if (!ex || score(r) > score(ex)) byLabel.set(key, r)
    }
    return Array.from(byLabel.values())
  }, [prov, latest])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) m[r.cat] = (m[r.cat] || 0) + 1
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => (cat === "all" || r.cat === cat) && (!s || (r.label + " " + r.indicator + " " + r.source + " " + (r.source_ref ?? "") + " " + r.catKo).toLowerCase().includes(s)))
  }, [rows, q, cat])

  // 분류순: 카테고리별 그룹 / 최신순: 최신 관측일(period) 내림차순 플랫
  const grouped = useMemo(() => {
    if (sort === "recent") return null
    const order = [...CATS.map((c) => c.key), "etc"]
    const m: Record<string, Row[]> = {}
    for (const r of filtered) (m[r.cat] = m[r.cat] || []).push(r)
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.label || a.indicator).localeCompare(b.label || b.indicator, "ko"))
    return order.filter((k) => m[k]?.length).map((k) => [k, m[k]] as [string, Row[]])
  }, [filtered, sort])

  const flat = useMemo(() => {
    if (sort !== "recent") return null
    return [...filtered].sort((a, b) => (b.period || "").localeCompare(a.period || ""))
  }, [filtered, sort])

  const confN = rows.filter((r) => (r.confidence || "").toUpperCase() === "CONFIRMED").length

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

      <section className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50 via-indigo-50/40 to-white dark:from-indigo-500/10 dark:via-transparent dark:to-gray-900 p-4 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
        <h1 className="text-[18px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">전체 지표 리스트 · 출처 검증</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
          분류별 차트 대신 <b className="font-semibold text-gray-800 dark:text-gray-100">모든 지표를 한 화면에서</b> — 최신값·직전 대비·데이터 기간·<b className="font-semibold text-gray-800 dark:text-gray-100">원본 코드·출처 링크·신뢰도</b>까지. 지표 행을 클릭하면 <b className="font-semibold text-indigo-600 dark:text-indigo-400">해당 분류 차트로 이동</b>합니다.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[12px]">
          <span className="text-gray-500 dark:text-gray-400">총 지표 <b className="text-gray-900 dark:text-gray-50">{rows.length}</b></span>
          <span className="text-gray-500 dark:text-gray-400">검색 결과 <b className="text-indigo-600 dark:text-indigo-400">{filtered.length}</b></span>
          <span className="text-gray-500 dark:text-gray-400">CONFIRMED <b className="text-emerald-600 dark:text-emerald-400">{confN}</b></span>
          <span className="text-gray-500 dark:text-gray-400">분류 <b className="text-gray-900 dark:text-gray-50">{Object.keys(catCounts).length}</b></span>
        </div>
      </section>

      {/* 정렬(주요뉴스와 동일 Segmented) + 검색(우측) + 최종 갱신(뉴스와 동일 위치·포맷) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
        <Segmented value={sort} onChange={(k) => setSort(k as "cat" | "recent")} options={[{ k: "cat", label: "분류순" }, { k: "recent", label: "최신순" }]} size="sm" />
        <div className={"group relative ml-auto transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] " + (focused || q ? "w-full max-w-[420px]" : "w-full max-w-[320px]")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder="지표 · 원본코드 · 출처 · 분류 검색"
            className="w-full rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-1.5 pl-9 pr-9 text-[12px] outline-none transition-all duration-300 ease-out placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-900 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-gray-900 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="검색어 지우기"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          최종 갱신 {loadedAt ? fmtStamp(loadedAt.toISOString()) : "—"}
          <span title="CONFIRMED" className="rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-px text-[10px] font-bold text-emerald-700 dark:text-emerald-300">C</span>
        </span>
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="flex flex-wrap gap-1.5">
        <FCat k="all" ko="전체" n={rows.length} cat={cat} setCat={setCat} />
        {[...CATS.map((c) => c.key), "etc"].filter((k) => catCounts[k]).map((k) => (
          <FCat key={k} k={k} ko={catKo(k)} n={catCounts[k]} cat={cat} setCat={setCat} />
        ))}
      </div>

      {/* 분류순: 카테고리별 섹션 */}
      {grouped && grouped.map(([k, items]) => (
        <section key={k} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
          <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <span className="h-[16px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">{catKo(k)}</h2>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{items.length}개 지표</span>
            {NAV_IDS.has(k) && <button type="button" onClick={() => goChart(k)} className="ml-auto text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">차트 전체 보기 →</button>}
          </header>
          <IndTable items={items} q={q} showCat={false} onRow={goChart} />
        </section>
      ))}

      {/* 최신순: 단일 플랫 테이블 */}
      {flat && (
        <section className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm" style={{ animation: "fadeUp .5s ease both" }}>
          <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <span className="h-[16px] w-1 rounded bg-indigo-500" />
            <h2 className="text-[14px] font-bold text-gray-900 dark:text-gray-50">최신 업데이트순</h2>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{flat.length}개 지표 · 최근 관측 우선</span>
          </header>
          <IndTable items={flat} q={q} showCat onRow={goChart} />
        </section>
      )}

      {prov.length > 0 && filtered.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[13px] text-gray-400">검색 결과 없음</div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        최신값=국가지표(PHILIPPINES) 최신 관측 · 직전 대비=직전 관측 대비 증감 · 기간=데이터 보유 범위(관측수) · <b className="font-semibold text-gray-500 dark:text-gray-400">「원본 ↗」으로 발행기관 원본에 직접 접근·재현</b>. 분류는 자동 키워드 매칭.
      </p>
    </div>
  )
}

function IndTable({ items, q, showCat, onRow }: { items: Row[]; q: string; showCat: boolean; onRow: (cat: string) => void }) {
  // 고정 컬럼폭 — 카테고리별 표가 동일 위치에 정렬되도록(table-layout:fixed)
  const cols = showCat ? ["22%", "9%", "9%", "9%", "8%", "13%", "13%", "12%", "5%"] : ["26%", "10%", "10%", "9%", "14%", "14%", "12%", "5%"]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] table-fixed text-[12px]">
        <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">
          <th className="px-4 py-1.5">지표</th>
          {showCat && <th className="px-2 py-1.5">분류</th>}
          <th className="px-2 py-1.5 text-right">최신값</th><th className="px-2 py-1.5 text-right">직전 대비</th><th className="px-2 py-1.5">기준</th><th className="px-2 py-1.5">기간</th><th className="px-2 py-1.5">원본 코드</th><th className="px-2 py-1.5">출처</th><th className="px-2 py-1.5 text-center">검증</th>
        </tr></thead>
        <tbody>
          {items.map((r) => {
            const chg = r.value != null && r.prev != null && r.prev !== 0 ? r.value - r.prev : null
            const up = chg != null && chg >= 0
            const nav = NAV_IDS.has(r.cat)
            const link = sourceLink(r.source, r.source_ref)
            return (
              <tr key={r.indicator} onClick={nav ? () => onRow(r.cat) : undefined}
                className={"group border-b border-gray-50 dark:border-gray-800/50 transition-colors " + (nav ? "cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30")}>
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={"truncate font-medium " + (nav ? "text-gray-800 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300" : "text-gray-800 dark:text-gray-100")} title={r.label || r.indicator}><Hi text={r.label || r.indicator} q={q} /></span>
                    {nav && <span className="shrink-0 text-[10px] font-semibold text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100">차트 →</span>}
                  </div>
                </td>
                {showCat && <td className="truncate px-2 py-1.5 text-gray-500 dark:text-gray-400">{r.catKo}</td>}
                <td className="px-2 py-1.5 text-right font-bold tabular-nums text-gray-900 dark:text-gray-50">{r.value != null ? fmtVal(r.value) : "—"}</td>
                <td className={"px-2 py-1.5 text-right tabular-nums " + (chg == null ? "text-gray-300 dark:text-gray-600" : up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{chg == null ? "—" : (up ? "▲" : "▼") + fmtVal(Math.abs(chg))}</td>
                <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{ym(r.period)}</td>
                <td className="px-2 py-1.5 tabular-nums text-gray-400 dark:text-gray-500">{ym(r.mn)}~{ym(r.mx)} <span className="text-gray-300 dark:text-gray-600">({r.n})</span></td>
                <td className="truncate px-2 py-1.5 font-mono text-[10.5px] text-gray-500 dark:text-gray-400" title={r.source_ref ?? ""}><Hi text={r.source_ref?.replace(/^https?:\/\/\S+/, "URL") ?? "—"} q={q} /></td>
                <td className="truncate px-2 py-1.5" title={r.source}>{link ? <a href={link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"><Hi text={r.source} q={q} /> ↗</a> : <span className="text-gray-500 dark:text-gray-400"><Hi text={r.source} q={q} /></span>}</td>
                <td className="px-2 py-1.5 text-center">{(r.confidence || "").toUpperCase() === "CONFIRMED" ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span className="text-amber-500">추정</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FCat({ k, ko, n, cat, setCat }: { k: string; ko: string; n: number; cat: string; setCat: (v: string) => void }) {
  const on = cat === k
  // 타 경제지표 뷰의 서브카테고리 탭과 동일 크기(px-3 py-1.5 text-[12.5px])
  return (
    <button type="button" onClick={() => setCat(k)}
      className={"rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200 " + (on ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300")}>
      {ko} <span className={"ml-0.5 text-[10px] tabular-nums " + (on ? "text-indigo-200" : "text-gray-400 dark:text-gray-500")}>{n}</span>
    </button>
  )
}
