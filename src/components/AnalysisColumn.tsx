"use client"

import React from "react"
import { analysisPosts } from "@/lib/supabase"

/** 이번 주 분석 — 뉴스 4번째 열.
 *
 *  ■ 왜 이 열이 있나
 *   뉴스는 마르는 날이 있다(CE·B2B는 구조적으로 얇다). 그런 날에도 우리가 쓴 글은 있다.
 *   그리고 기사 요약만으로는 "그래서 뭘 하란 말인가"에 답이 안 된다 — 해석은 우리 몫.
 *
 *  ■ 두 종류
 *   own      = 우리가 쓴 칼럼. 본문까지 펼쳐 읽음.
 *   external = 외부 좋은 글. **전재하지 않는다** — 제목·우리 말 요약·"왜 중요한가"·원문 링크만.
 *              저작권과 출처 무결성(철학 1원칙)을 지키는 유일한 방법.
 *
 *  ■ 대표 이미지
 *   외부 글은 원문 og:image를 쓴다(출처 명시).
 *   자체 칼럼은 남의 사진을 빌려오지 않는다 — 대신 우리 데이터로 만든 비주얼 카드를 쓴다.
 *   "사진처럼 보이는 남의 이미지"를 우리 글에 붙이는 순간 정직함이 깨진다.
 */
type Post = Awaited<ReturnType<typeof analysisPosts>>[number]

const fmt = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`

/** 자체 칼럼 대표 비주얼 — 사진이 아니라 데이터 (저작권·정직성 둘 다 해결) */
function OwnVisual({ tags }: { tags: string[] }) {
  return (
    <div className="mb-2 flex aspect-[16/9] w-full flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
        AX 자체 분석
      </span>
      <div>
        <div className="flex items-end gap-1.5">
          <span className="text-[20px] font-extrabold leading-none text-white">632</span>
          <span className="pb-0.5 text-[11px] text-indigo-200">→</span>
          <span className="text-[20px] font-extrabold leading-none text-white">852</span>
          <span className="pb-0.5 text-[11px] font-semibold text-indigo-200">MW</span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-indigo-100">
          DC 설비 용량 2025→2030 · 냉방시장 연 13.0%↑
        </p>
      </div>
      <div className="flex gap-1">
        {tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-white/15 px-1.5 py-px text-[10px] text-white">
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AnalysisColumn() {
  const [rows, setRows] = React.useState<Post[] | null>(null)
  const [err, setErr] = React.useState(false)
  const [open, setOpen] = React.useState<number | null>(null)

  React.useEffect(() => {
    analysisPosts(4).then(setRows).catch(() => setErr(true))
  }, [])

  return (
    <div className="lg:px-3">
      <a href="/news?cat=분석" className="group mb-2 flex items-baseline gap-1">
        <span className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
          이번 주 분석
        </span>
        <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">
          ›
        </span>
        <span className="ml-1 text-[10px] text-gray-400">자체 칼럼 · 외부 큐레이션</span>
      </a>

      {err ? (
        <p className="py-6 text-[12px] text-gray-400">분석 글을 불러오지 못함 — 확인 필요</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {(rows ?? Array.from({ length: 3 })).map((p, i) =>
            !p ? (
              <div key={i} className="py-2.5">
                {i === 0 ? <div className="mb-2 aspect-[16/9] w-full rounded-lg bg-gray-100" /> : null}
                <div className="h-[30px] rounded bg-gray-50" />
              </div>
            ) : (
              <div key={p.id} className="py-2.5">
                {i === 0 ? (
                  p.kind === "own" ? (
                    <OwnVisual tags={p.tags} />
                  ) : p.image ? (
                    <div className="mb-2 aspect-[16/9] w-full overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={p.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(ev) => {
                          const el = ev.currentTarget.parentElement
                          if (el) el.style.display = "none"
                        }}
                      />
                    </div>
                  ) : null
                ) : null}

                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={
                      "rounded px-1.5 py-px text-[10px] font-bold " +
                      (p.kind === "own"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-gray-100 text-gray-600")
                    }
                  >
                    {p.kind === "own" ? "자체" : "외부"}
                  </span>
                  <span className="text-[10px] text-gray-400">{fmt(p.publishedAt)}</span>
                </div>

                {p.kind === "own" ? (
                  <button
                    type="button"
                    onClick={() => setOpen(open === p.id ? null : p.id)}
                    className="group w-full text-left"
                  >
                    <p className="line-clamp-2 text-[14px] font-semibold leading-tight text-gray-800 transition-colors duration-200 group-hover:text-indigo-600 2xl:text-[16px]">
                      {p.title}
                    </p>
                  </button>
                ) : (
                  <a
                    href={p.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <p className="line-clamp-2 text-[14px] font-semibold leading-tight text-gray-800 transition-colors duration-200 group-hover:text-indigo-600 2xl:text-[16px]">
                      {p.title}
                    </p>
                  </a>
                )}

                {p.dek ? (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-gray-500">{p.dek}</p>
                ) : null}

                <p className="mt-1 text-[10px] text-gray-400 2xl:text-[11px]">
                  {p.kind === "own" ? p.author ?? "경영기획" : p.source}
                  {p.kind === "external" ? " · 원문 보기" : " · 펼쳐 읽기"}
                </p>

                {/* 자체 칼럼 본문 — 인라인 확장 */}
                {open === p.id ? (
                  <div
                    className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5"
                    style={{ animation: "fadeUp .5s ease both" }}
                  >
                    {p.summary ? (
                      <p className="text-[12px] leading-relaxed text-gray-700">{p.summary}</p>
                    ) : null}
                    <p className="mt-2 border-t border-indigo-200/60 pt-2 text-[12px] leading-relaxed text-gray-700">
                      <b className="font-semibold text-gray-900">왜 중요한가 · </b>
                      {p.whyMatters}
                    </p>
                    {p.body ? (
                      <p className="mt-2 whitespace-pre-wrap border-t border-indigo-200/60 pt-2 text-[12px] leading-relaxed text-gray-600">
                        {p.body}
                      </p>
                    ) : null}
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-[11px] text-indigo-600 hover:underline"
                      >
                        근거 원문 · {p.source}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      )}

      <p className="mt-2 border-t border-gray-100 pt-2 text-[10px] leading-snug text-gray-400">
        외부 글은 원문을 옮기지 않음 — 요약·해석·링크만 (출처와 저작권 보존)
      </p>
    </div>
  )
}
