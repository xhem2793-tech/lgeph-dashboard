"use client"

import React from "react"
import { competitorTable, type PriceRow } from "@/lib/supabase"

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
      { key: "movers", no: 1, label: "일일 가격 변동", desc: "3일 가격·변동폭·할인율", status: "live" },
      { key: "outlier", no: 12, label: "이상치 알림", desc: "임계 초과 급변 · VALIDATION REQ", status: "next" },
    ],
  },
  {
    group: "포지션",
    items: [
      { key: "asp", no: 2, label: "ASP 포지셔닝", desc: "스펙버킷 × 가격대 · LG 위치", status: "next" },
      { key: "gap", no: 3, label: "LG vs 경쟁 갭", desc: "동급 스펙 가격차(%) · 프리미엄/디스카운트", status: "next" },
      { key: "trend", no: 5, label: "ASP 추세", desc: "주·월 평균가 시계열 · 가격 인덱스(100)", status: "next" },
    ],
  },
  {
    group: "채널·프로모",
    items: [
      { key: "promo", no: 4, label: "프로모션 트래커", desc: "할인율·기간 · SRP 복귀(종료) 감지", status: "next" },
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
const CATS = ["전체", "냉장고", "세탁기", "TV", "에어컨"]
const BRANDS = ["LG", "Samsung", "Panasonic", "TCL", "Midea", "Hisense"]
const SHOPS = ["Anson's", "Abenson", "SM Appliance"]

const BADGE: Record<Status, { t: string; c: string }> = {
  live: { t: "LIVE", c: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  next: { t: "NEXT", c: "border-indigo-200 bg-indigo-50 text-indigo-600" },
  plan: { t: "PLAN", c: "border-gray-200 bg-gray-50 text-gray-500" },
}

const peso = (n: number | null) => (n == null ? "—" : "₱" + Math.round(n).toLocaleString("en-US"))
const pct = (n: number | null) => (n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%")
const md = (s: string | null) => (s ? s.slice(5).replace("-", "/") : "—")

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

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="num mt-0.5 text-[17px] font-semibold text-gray-900">{value}</p>
      {sub ? <p className="text-[10px] text-gray-500">{sub}</p> : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 px-3 py-3 first:border-t-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      {children}
    </div>
  )
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-2 py-1 text-[12px] transition-all duration-200 active:scale-95 " +
        (on
          ? "border-indigo-200 bg-indigo-50 font-medium text-indigo-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-indigo-600")
      }
    >
      {children}
    </button>
  )
}

const COLS: { k: keyof PriceRow | "d2" | "d1" | "d0"; t: string; num?: boolean }[] = [
  { k: "retailer", t: "유통" },
  { k: "brand", t: "브랜드" },
  { k: "category", t: "카테고리" },
  { k: "code", t: "모델코드" },
  { k: "srp", t: "SRP", num: true },
  { k: "p2", t: "D-2", num: true },
  { k: "p1", t: "D-1", num: true },
  { k: "p0", t: "당일", num: true },
  { k: "deltaPhp", t: "전일변동₱", num: true },
  { k: "deltaPct", t: "전일변동%", num: true },
  { k: "delta3Pct", t: "3일변동%", num: true },
  { k: "discountPct", t: "할인율", num: true },
]

export default function Competitors() {
  const [view, setView] = React.useState("movers")
  const [cat, setCat] = React.useState("전체")
  const [brands, setBrands] = React.useState<string[]>(["LG"])
  const [shops, setShops] = React.useState<string[]>([...SHOPS])
  const [onlyMoved, setOnlyMoved] = React.useState(false)
  const [rows, setRows] = React.useState<PriceRow[] | null>(null)
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<{ k: string; asc: boolean }>({ k: "deltaPct", asc: true })

  React.useEffect(() => {
    competitorTable(4000)
      .then(setRows)
      .catch(() => setRows([]))
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
  }, [rows, cat, brands, shops, onlyMoved, q, sort])

  const moved = data.filter((r) => r.deltaPct != null && r.deltaPct !== 0)
  const cuts = moved.filter((r) => (r.deltaPct ?? 0) < 0)
  const hikes = moved.filter((r) => (r.deltaPct ?? 0) > 0)
  const avg = (a: PriceRow[], f: (r: PriceRow) => number | null) => {
    const v = a.map(f).filter((x): x is number => x != null)
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
  }
  const asOf = rows && rows[0] ? rows[0].d0 : "—"
  const active = ALL.find((v) => v.key === view)

  return (
    <div className="px-4 py-4 sm:px-6">
      <style>{"@keyframes viewIn{from{opacity:0;transform:translateY(8px) scale(.995)}to{opacity:1;transform:none}}"}</style>

      <h1 className="text-[20px] font-bold tracking-tight text-gray-900">가격 동향</h1>
      <p className="mt-0.5 text-[12px] text-gray-500">
        Anson&apos;s · Abenson · SM 온라인 매장 일 1회 스크래핑 · LG · Samsung · Panasonic · TCL · Midea · Hisense
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(172px,0.7fr)_4fr]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm">
          {GROUPS.map((g) => (
            <Section key={g.group} title={g.group}>
              <div className="flex flex-col gap-0.5">
                {g.items.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setView(it.key)}
                    className={
                      "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-200 active:scale-[.99] " +
                      (view === it.key ? "bg-indigo-50" : "hover:bg-gray-50")
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="num w-4 shrink-0 text-[10px] text-gray-400">{it.no}</span>
                      <span
                        className={
                          "flex-1 text-[13px] transition-colors duration-200 " +
                          (view === it.key
                            ? "font-semibold text-indigo-700"
                            : "font-medium text-gray-800 group-hover:text-indigo-600")
                        }
                      >
                        {it.label}
                      </span>
                      <span className={"shrink-0 rounded border px-1 py-px text-[9px] font-semibold " + BADGE[it.status].c}>
                        {BADGE[it.status].t}
                      </span>
                    </span>
                    <span className="ml-[22px] block text-[11px] leading-snug text-gray-500">{it.desc}</span>
                  </button>
                ))}
              </div>
            </Section>
          ))}

          <Section title="카테고리">
            <div className="flex flex-wrap gap-1.5">
              {CATS.map((c) => (
                <Chip key={c} on={cat === c} onClick={() => setCat(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="브랜드">
            <div className="flex flex-wrap gap-1.5">
              {BRANDS.map((b) => (
                <Chip key={b} on={brands.includes(b)} onClick={() => toggle(brands, b, setBrands)}>
                  {b}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="유통">
            <div className="flex flex-wrap gap-1.5">
              {SHOPS.map((s) => (
                <Chip key={s} on={shops.includes(s)} onClick={() => toggle(shops, s, setShops)}>
                  {s === "SM Appliance" ? "SM" : s}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="보기 옵션">
            <Chip on={onlyMoved} onClick={() => setOnlyMoved(!onlyMoved)}>
              가격 변동분만
            </Chip>
          </Section>

          <div className="border-t border-gray-100 px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                setCat("전체")
                setBrands(["LG"])
                setShops([...SHOPS])
                setOnlyMoved(false)
                setQ("")
              }}
              className="w-full rounded-md border border-gray-200 py-1.5 text-[12px] text-gray-600 transition-all duration-200 hover:border-gray-300 hover:text-indigo-600 active:scale-[.98]"
            >
              필터 초기화
            </button>
          </div>
        </aside>

        <section
          key={view}
          className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          style={{ animation: "viewIn .32s cubic-bezier(.22,1,.36,1) both" }}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-2">
            <h2 className="flex items-baseline gap-2 text-[16px] font-bold tracking-tight text-gray-900">
              {active?.label}
              <span className={"rounded border px-1 py-px text-[9px] font-semibold " + BADGE[active?.status ?? "plan"].c}>
                {BADGE[active?.status ?? "plan"].t}
              </span>
            </h2>
            <span className="text-[11px] text-gray-500">
              최종 갱신 {asOf} · {cat} · {brands.length ? brands.join("·") : "브랜드 미선택"} · {shops.length}개 유통
            </span>
          </header>

          {active?.status !== "live" ? (
            <div className="flex min-h-[440px] flex-col items-center justify-center gap-1">
              <p className="text-[13px] font-medium text-gray-600">{active?.desc}</p>
              <p className="text-[12px] text-gray-400">데이터 연결 예정 — 뷰 확정 후 구현</p>
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Kpi label="평균가" value={peso(avg(data, (r) => r.p0))} sub={data.length + "개 리스팅"} />
                <Kpi label="평균 할인율" value={pct(avg(data, (r) => r.discountPct))} sub="SRP 대비" />
                <Kpi label="인하" value={String(cuts.length)} sub={"평균 " + pct(avg(cuts, (r) => r.deltaPct))} />
                <Kpi label="인상" value={String(hikes.length)} sub={"평균 " + pct(avg(hikes, (r) => r.deltaPct))} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={q}
                  onChange={(ev) => setQ(ev.target.value)}
                  placeholder="모델코드·모델명 검색"
                  className="w-56 rounded-md border border-gray-200 px-2 py-1 text-[12px] outline-none transition-colors duration-200 focus:border-indigo-300"
                />
                <span className="num text-[11px] text-gray-500">{data.length}행</span>
                <button
                  type="button"
                  onClick={() => exportCsv(data, "LGEPH_경쟁사가격_" + asOf + ".csv")}
                  className="ml-auto rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-100 active:scale-95"
                >
                  엑셀(CSV) 내보내기
                </button>
              </div>

              <div className="mt-2 max-h-[600px] overflow-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr>
                      {COLS.map((c) => (
                        <th
                          key={c.k as string}
                          onClick={() => setSort((s) => ({ k: c.k as string, asc: s.k === c.k ? !s.asc : true }))}
                          className={
                            "cursor-pointer select-none whitespace-nowrap border-b border-gray-200 px-2 py-1.5 font-semibold text-gray-600 transition-colors duration-200 hover:text-indigo-600 " +
                            (c.num ? "text-right" : "text-left")
                          }
                        >
                          {c.t === "D-2" ? "D-2 " + md(rows?.[0]?.d2 ?? null) : c.t === "D-1" ? "D-1 " + md(rows?.[0]?.d1 ?? null) : c.t === "당일" ? "당일 " + md(asOf) : c.t}
                          {sort.k === c.k ? <span className="ml-0.5 text-indigo-500">{sort.asc ? "▲" : "▼"}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows === null ? (
                      <tr>
                        <td colSpan={COLS.length} className="px-2 py-10 text-center text-[12px] text-gray-400">
                          불러오는 중…
                        </td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={COLS.length} className="px-2 py-10 text-center text-[12px] text-gray-400">
                          조건에 맞는 행 없음
                        </td>
                      </tr>
                    ) : (
                      data.slice(0, 600).map((r, i) => {
                        const up = (r.deltaPhp ?? 0) > 0
                        const dn = (r.deltaPhp ?? 0) < 0
                        const dcol = dn ? "text-emerald-700" : up ? "text-red-700" : "text-gray-400"
                        return (
                          <tr key={i} className="border-b border-gray-100 transition-colors duration-200 hover:bg-indigo-50/40">
                            <td className="whitespace-nowrap px-2 py-1 text-gray-500">{r.retailer}</td>
                            <td className="px-2 py-1 font-medium text-gray-800">{r.brand}</td>
                            <td className="px-2 py-1 text-gray-600">{r.category}</td>
                            <td className="whitespace-nowrap px-2 py-1 font-medium text-gray-800" title={r.model}>
                              {r.code}
                            </td>
                            <td className="num px-2 py-1 text-right text-gray-400">{peso(r.srp)}</td>
                            <td className="num px-2 py-1 text-right text-gray-500">{peso(r.p2)}</td>
                            <td className="num px-2 py-1 text-right text-gray-500">{peso(r.p1)}</td>
                            <td className="num px-2 py-1 text-right font-semibold text-gray-900">{peso(r.p0)}</td>
                            <td className={"num px-2 py-1 text-right " + dcol}>
                              {r.deltaPhp == null || r.deltaPhp === 0 ? "—" : (dn ? "−" : "+") + peso(Math.abs(r.deltaPhp)).slice(1)}
                            </td>
                            <td className={"num px-2 py-1 text-right font-semibold " + dcol}>
                              {r.deltaPct == null || r.deltaPct === 0 ? "—" : pct(r.deltaPct)}
                            </td>
                            <td
                              className={
                                "num px-2 py-1 text-right " +
                                ((r.delta3Pct ?? 0) < 0 ? "text-emerald-700" : (r.delta3Pct ?? 0) > 0 ? "text-red-700" : "text-gray-400")
                              }
                            >
                              {r.delta3Pct == null || r.delta3Pct === 0 ? "—" : pct(r.delta3Pct)}
                            </td>
                            <td className="num px-2 py-1 text-right text-gray-600">
                              {r.discountPct == null ? "—" : r.discountPct.toFixed(0) + "%"}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                표는 최대 600행 표시 · 내보내기는 필터된 전체 {data.length}행(모델명·URL 포함) · 모델코드에 마우스를 올리면 원문 모델명
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
