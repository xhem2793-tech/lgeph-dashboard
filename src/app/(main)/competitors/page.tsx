"use client"

import React from "react"

/** 경쟁사 가격 — 좌 1/4 메뉴판 + 우 3/4 콘텐츠.
 *
 *  메뉴는 "무엇을 볼 것인가(뷰)" → "무엇으로 좁힐 것인가(필터)" 순서.
 *  뷰는 하나만 선택, 필터는 다중 선택. 데이터 연결은 다음 단계.
 */

const VIEWS = [
  { key: "movers", label: "오늘의 가격 무버", desc: "전일 대비 인상·인하 상위" },
  { key: "position", label: "가격 포지셔닝", desc: "카테고리별 ASP·가격대 분포" },
  { key: "gap", label: "LG vs 경쟁 갭", desc: "동급 모델 가격 차이" },
  { key: "promo", label: "프로모 트래커", desc: "할인율·행사 지속 기간" },
  { key: "model", label: "모델 조회", desc: "모델코드로 가격 이력 추적" },
] as const

const CATS = ["전체", "냉장고", "세탁기", "TV", "에어컨"]
const BRANDS = ["LG", "Samsung", "Panasonic", "TCL", "Midea", "Hisense"]
const SHOPS = ["Anson's", "Abenson", "SM"]
const PERIODS = ["1주", "1개월", "3개월"]

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
        "rounded-md border px-2 py-1 text-[12px] transition-colors duration-200 " +
        (on
          ? "border-indigo-200 bg-indigo-50 font-medium text-indigo-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900")
      }
    >
      {children}
    </button>
  )
}

export default function Competitors() {
  const [view, setView] = React.useState<string>("movers")
  const [cat, setCat] = React.useState("전체")
  const [brands, setBrands] = React.useState<string[]>(["LG"])
  const [shops, setShops] = React.useState<string[]>([...SHOPS])
  const [period, setPeriod] = React.useState("1주")

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const active = VIEWS.find((v2) => v2.key === view)

  return (
    <div className="px-4 py-4 sm:px-6">
      <h1 className="text-[20px] font-bold tracking-tight text-gray-900">가격 동향</h1>
      <p className="mt-0.5 text-[12px] text-gray-500">
        Anson&apos;s · Abenson · SM 온라인 매장 일 1회 스크래핑 · 6개 브랜드
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_3fr]">
        {/* ── 좌 1/4 : 메뉴판 ── */}
        <aside className="h-fit rounded-xl border border-gray-200 bg-white shadow-sm">
          <Section title="보기">
            <div className="flex flex-col gap-1">
              {VIEWS.map((v2) => (
                <button
                  key={v2.key}
                  type="button"
                  onClick={() => setView(v2.key)}
                  className={
                    "rounded-lg px-2.5 py-2 text-left transition-colors duration-200 " +
                    (view === v2.key ? "bg-indigo-50" : "hover:bg-gray-50")
                  }
                >
                  <span
                    className={
                      "block text-[13px] " +
                      (view === v2.key ? "font-semibold text-indigo-700" : "font-medium text-gray-800")
                    }
                  >
                    {v2.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-gray-500">{v2.desc}</span>
                </button>
              ))}
            </div>
          </Section>

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
                  {s}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="기간">
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <Chip key={p} on={period === p} onClick={() => setPeriod(p)}>
                  {p}
                </Chip>
              ))}
            </div>
          </Section>

          <div className="border-t border-gray-100 px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                setCat("전체")
                setBrands(["LG"])
                setShops([...SHOPS])
                setPeriod("1주")
              }}
              className="w-full rounded-md border border-gray-200 py-1.5 text-[12px] text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
            >
              필터 초기화
            </button>
          </div>
        </aside>

        {/* ── 우 3/4 : 콘텐츠 (다음 단계에서 데이터 연결) ── */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <header className="flex items-baseline justify-between border-b border-gray-100 pb-2">
            <h2 className="text-[16px] font-bold tracking-tight text-gray-900">{active?.label}</h2>
            <span className="text-[11px] text-gray-500">
              {cat} · {brands.length ? brands.join(" · ") : "브랜드 미선택"} · {shops.length}개 유통 · {period}
            </span>
          </header>

          <div className="flex min-h-[420px] items-center justify-center">
            <p className="text-[12px] text-gray-400">데이터 연결 예정 — 메뉴 구조 확정 후 각 뷰 구현</p>
          </div>
        </section>
      </div>
    </div>
  )
}
