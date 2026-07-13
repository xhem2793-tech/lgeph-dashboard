"use client"

import React from "react"

/** 경쟁사 가격 — 좌 1/4 메뉴판 + 우 3/4 콘텐츠.
 *
 *  메뉴는 2026-07-10에 정리한 "가격 데이터로 만들 수 있는 분석 13종" 로드맵을 그대로 옮긴 것.
 *  4개 묶음으로 나눈 이유: 매일 볼 것 / 포지션 / 채널·프로모 / 신호 — 쓰는 리듬이 다르다.
 *  status: live=데이터 연결됨, next=다음 구현, plan=인프라(스펙버킷·롤업) 선행 필요
 */

type Status = "live" | "next" | "plan"

const GROUPS: { group: string; items: { key: string; no: number; label: string; desc: string; status: Status }[] }[] = [
  {
    group: "매일 보는 것",
    items: [
      { key: "movers", no: 1, label: "일일 가격 변동", desc: "인상·인하 상위 · 전일비(₱·%)", status: "live" },
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
const SHOPS = ["Anson's", "Abenson", "SM"]
const PERIODS = ["1주", "1개월", "3개월"]

const BADGE: Record<Status, { t: string; c: string }> = {
  live: { t: "LIVE", c: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  next: { t: "NEXT", c: "border-indigo-200 bg-indigo-50 text-indigo-600" },
  plan: { t: "PLAN", c: "border-gray-200 bg-gray-50 text-gray-500" },
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
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900")
      }
    >
      {children}
    </button>
  )
}

export default function Competitors() {
  const [view, setView] = React.useState("movers")
  const [cat, setCat] = React.useState("전체")
  const [brands, setBrands] = React.useState<string[]>(["LG"])
  const [shops, setShops] = React.useState<string[]>([...SHOPS])
  const [period, setPeriod] = React.useState("1주")

  const toggle = (arr: string[], x: string, set: (v: string[]) => void) =>
    set(arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x])

  const active = ALL.find((v) => v.key === view)

  return (
    <div className="px-4 py-4 sm:px-6">
      <style>{"@keyframes viewIn{from{opacity:0;transform:translateY(8px) scale(.995)}to{opacity:1;transform:none}}"}</style>

      <h1 className="text-[20px] font-bold tracking-tight text-gray-900">가격 동향</h1>
      <p className="mt-0.5 text-[12px] text-gray-500">
        Anson&apos;s · Abenson · SM 온라인 매장 일 1회 스크래핑 · LG · Samsung · Panasonic · TCL · Midea · Hisense
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(240px,1fr)_3fr]">
        {/* ── 좌 1/4 : 메뉴판 ── */}
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
                      "group rounded-lg px-2.5 py-1.5 text-left transition-all duration-200 " +
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
              className="w-full rounded-md border border-gray-200 py-1.5 text-[12px] text-gray-600 transition-all duration-200 hover:border-gray-300 hover:text-gray-900 active:scale-[.98]"
            >
              필터 초기화
            </button>
          </div>
        </aside>

        {/* ── 우 3/4 : 콘텐츠 (뷰 전환 애니메이션) ── */}
        <section
          key={view}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          style={{ animation: "viewIn .32s cubic-bezier(.22,1,.36,1) both" }}
        >
          <header className="flex items-baseline justify-between border-b border-gray-100 pb-2">
            <h2 className="flex items-baseline gap-2 text-[16px] font-bold tracking-tight text-gray-900">
              {active?.label}
              <span className={"rounded border px-1 py-px text-[9px] font-semibold " + BADGE[active?.status ?? "plan"].c}>
                {BADGE[active?.status ?? "plan"].t}
              </span>
            </h2>
            <span className="text-[11px] text-gray-500">
              {cat} · {brands.length ? brands.join(" · ") : "브랜드 미선택"} · {shops.length}개 유통 · {period}
            </span>
          </header>

          <div className="flex min-h-[440px] flex-col items-center justify-center gap-1">
            <p className="text-[13px] font-medium text-gray-600">{active?.desc}</p>
            <p className="text-[12px] text-gray-400">데이터 연결 예정 — 뷰 확정 후 구현</p>
          </div>
        </section>
      </div>
    </div>
  )
}
