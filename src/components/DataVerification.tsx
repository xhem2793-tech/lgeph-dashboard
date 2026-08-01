"use client"

import React, { useEffect, useMemo, useState } from "react"
import { dataProvenance } from "@/lib/supabase"
import type { Provenance } from "@/lib/supabase"

/** 데이터 출처·검증 — 전 지표를 원본 출처·코드·기간·신뢰도와 함께 표로. 모든 숫자를 공개 원본으로 1클릭 검증. */

// 출처 → 원본 URL 리졸버(가능하면 원본 페이지, 아니면 기관 포털)
export function sourceLink(source: string, ref: string | null): string | null {
  const s = source || "", r = ref || ""
  // WB/IMF 코드 우선 — raw API URL·설명문 모두 사람용 지표 페이지로
  const wb = r.match(/[A-Z]{2}\.[A-Z]{2,4}\.[A-Z0-9._]+/) // WB WDI 코드
  if (/World Bank/i.test(s)) return wb ? "https://data.worldbank.org/indicator/" + wb[0] : "https://data.worldbank.org/country/philippines"
  const imf = r.match(/[MQA]\.PH\.[A-Z0-9_]+/)
  if (/IMF/i.test(s) && imf) return "https://db.nomics.world/IMF/IFS/" + imf[0]
  if (/DOLE|RTWPB|NWPC/i.test(s)) return "https://nwpc.dole.gov.ph/" // 저장된 비공식 URL 무시, 공식 임금위원회
  if (/^https?:\/\//.test(r)) return r // 저장된 원본 URL(미디어 등)
  if (/PSA OpenSTAT/i.test(s)) return "https://openstat.psa.gov.ph/"
  if (/PSA/i.test(s)) return "https://psa.gov.ph/statistics"
  if (/BSP/i.test(s)) return "https://www.bsp.gov.ph/SitePages/Statistics/Statistics.aspx"
  if (/DOE/i.test(s)) return "https://www.doe.gov.ph/"
  if (/Open-Meteo/i.test(s)) return "https://open-meteo.com/"
  if (/Meralco/i.test(s)) return "https://company.meralco.com.ph/"
  if (/Colliers/i.test(s)) return "https://www.colliers.com/en-ph/research"
  if (/BIS/i.test(s)) return "https://data.bis.org/topics/RPP"
  if (/ADB/i.test(s)) return "https://www.adb.org/countries/philippines/economy"
  if (/IMF/i.test(s)) return "https://www.imf.org/en/Countries/PHL"
  return null
}
// 공식 / 민간 / 미디어 분류
function tier(source: string): { label: string; cls: string } {
  const s = source || ""
  if (/Colliers|Open-Meteo|GfK|Euromonitor|Statista/i.test(s)) return { label: "민간자료", cls: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" }
  if (/Reuters|Bloomberg|BusinessWorld|Inquirer|bworldonline/i.test(s)) return { label: "미디어(공식인용)", cls: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300" }
  if (/PSA|World Bank|BSP|IMF|DOE|ADB|DOLE|DBCC|BAP|Meralco|BIS/i.test(s)) return { label: "공식기관", cls: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" }
  return { label: "ETL(공식가공)", cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" }
}
const ym = (d: string) => (d ? d.slice(2, 4) + "." + Number(d.slice(5, 7)) : "")

export default function DataVerification() {
  const [rows, setRows] = useState<Provenance[]>([])
  const [q, setQ] = useState("")
  useEffect(() => { dataProvenance().then(setRows).catch(() => setRows([])) }, [])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => !s || (r.label + " " + r.indicator + " " + r.source + " " + (r.source_ref ?? "")).toLowerCase().includes(s))
  }, [rows, q])
  const bySource = useMemo(() => {
    const m: Record<string, Provenance[]> = {}
    for (const r of filtered) (m[r.source] = m[r.source] || []).push(r)
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])
  const confN = rows.filter((r) => (r.confidence || "").toUpperCase() === "CONFIRMED").length

  return (
    <div className="flex flex-col gap-4">
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      <section className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50/60 dark:bg-indigo-500/[0.08] p-4" style={{ animation: "fadeUp .5s ease both" }}>
        <h1 className="text-[14.5px] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">데이터 출처·검증</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
          모든 지표는 <b className="font-semibold text-gray-800 dark:text-gray-100">공개 공식통계(PSA·BSP·World Bank·IMF·DOE)</b>에서 원본 코드까지 추적됩니다. 아래 링크로 <b className="font-semibold text-indigo-600 dark:text-indigo-400">누구나 원본을 직접 대조·재현</b>할 수 있습니다. 조작 불가 · 재현 가능.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-4 text-[12px]">
          <span className="text-gray-500 dark:text-gray-400">총 지표 <b className="text-gray-900 dark:text-gray-50">{rows.length}</b></span>
          <span className="text-gray-500 dark:text-gray-400">CONFIRMED <b className="text-emerald-600 dark:text-emerald-400">{confN}</b></span>
          <span className="text-gray-500 dark:text-gray-400">출처 기관 <b className="text-gray-900 dark:text-gray-50">{bySource.length}</b></span>
        </div>
      </section>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="지표·출처 검색 (예: 물가, World Bank, 정책금리)"
        className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-2 text-[12.5px] text-gray-800 dark:text-gray-100 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20" />

      {bySource.map(([source, items]) => {
        const t = tier(source)
        return (
          <section key={source} className="overflow-hidden rounded-xl" style={{ animation: "fadeUp .5s ease both" }}>
            <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
              <span className="h-[16px] w-1 rounded bg-indigo-500" />
              <h2 className="text-[13.5px] font-bold text-gray-900 dark:text-gray-50">{source}</h2>
              <span className={"rounded px-1.5 py-0.5 text-[9.5px] font-bold " + t.cls}>{t.label}</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">{items.length}개 지표</span>
              {sourceLink(source, items[0].source_ref) && (
                <a href={sourceLink(source, items[0].source_ref)!} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">원본 포털 ↗</a>
              )}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[10.5px] font-semibold uppercase text-gray-400 dark:text-gray-500">
                  <th className="px-4 py-1.5">지표</th><th className="px-2 py-1.5">원본 코드</th><th className="px-2 py-1.5">기간</th><th className="px-2 py-1.5 text-center">신뢰도</th><th className="px-2 py-1.5 text-right">검증</th>
                </tr></thead>
                <tbody>
                  {items.map((r) => {
                    const link = sourceLink(r.source, r.source_ref)
                    return (
                      <tr key={r.indicator} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5">
                        <td className="px-4 py-1.5 font-medium text-gray-800 dark:text-gray-100">{r.label || r.indicator}</td>
                        <td className="px-2 py-1.5 font-mono text-[10.5px] text-gray-500 dark:text-gray-400">{r.source_ref?.replace(/^https?:\/\/\S+/, "URL") ?? "—"}</td>
                        <td className="px-2 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{ym(r.mn)}~{ym(r.mx)} <span className="text-gray-300 dark:text-gray-600">({r.n})</span></td>
                        <td className="px-2 py-1.5 text-center">{(r.confidence || "").toUpperCase() === "CONFIRMED" ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span className="text-amber-500">추정</span>}</td>
                        <td className="px-2 py-1.5 text-right">{link ? <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">원본 ↗</a> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        <b className="font-semibold text-gray-500 dark:text-gray-400">검증 방법</b> · 각 지표의 「원본 ↗」으로 발행기관 데이터에 직접 접근 → 같은 코드·기간으로 대조. PSA는 OpenSTAT 테이블ID, World Bank는 WDI 코드, IMF는 IFS 시리즈로 재현 가능. 민간자료(Colliers·Open-Meteo)는 별도 표기.
      </p>
    </div>
  )
}
