"use client"

import React from "react"
import { analysisPosts } from "@/lib/supabase"
import { useLang } from "@/lib/i18n"

/** 이번 주 분석 — 뉴스 4번째 열.
 *
 *  ■ 왜 이 열이 있나
 *   뉴스는 마르는 날이 있다(CE·B2B는 구조적으로 얇다). 그런 날에도 우리가 쓴 글은 있다.
 *   그리고 기사 요약만으로는 "그래서 뭘 하란 말인가"에 답이 안 된다. 해석은 우리 몫.
 *
 *  ■ 두 종류
 *   own      = 우리가 쓴 칼럼. 클릭하면 뉴스와 동일한 팝업으로 본문까지 읽음.
 *   external = 외부 좋은 글. **전재하지 않는다**. 제목·우리 말 요약·"왜 중요한가"·원문 링크만.
 *              저작권과 출처 무결성(철학 1원칙)을 지키는 유일한 방법.
 *
 *  ■ 대표 이미지
 *   외부 글은 원문 og:image를 쓴다(출처 명시).
 *   자체 칼럼은 남의 사진을 빌려오지 않는다. 대신 우리 데이터로 만든 비주얼 카드를 쓴다.
 *   "사진처럼 보이는 남의 이미지"를 우리 글에 붙이는 순간 정직함이 깨진다.
 *
 *  ■ 타입 스케일 (BRANDING_GUIDE §6.5) — 10/11/12/14/16/20/24 밖으로 나가지 않는다.
 */
type Post = Awaited<ReturnType<typeof analysisPosts>>[number]

const fmt = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`

/** 자체 칼럼 대표 비주얼 — 사진이 아니라 데이터 (저작권·정직성 둘 다 해결) */
function OwnVisual({ tags, compact }: { tags: string[]; compact?: boolean }) {
  return (
    <div
      className={
        "flex w-full flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 p-3 " +
        (compact ? "h-[150px]" : "h-full min-h-[180px]")
      }
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
        AX 자체 분석
      </span>
      <div>
        <div className="flex items-end gap-1.5">
          <span className="text-[24px] font-extrabold leading-none text-white">632</span>
          <span className="pb-1 text-[12px] text-indigo-200">→</span>
          <span className="text-[24px] font-extrabold leading-none text-white">852</span>
          <span className="pb-1 text-[11px] font-semibold text-indigo-200">MW</span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-indigo-100">
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

/** 팝업 — 뉴스 모달과 동일한 어법(배경 클릭·ESC로 닫힘, 이미지 좌 / 본문 우) */
function Modal({ p, onClose }: { p: Post; onClose: () => void }) {
  const { t, pick } = useLang()
  const [closing, setClosing] = React.useState(false)
  const close = React.useCallback(() => {
    setClosing(true)
    window.setTimeout(onClose, 240)
  }, [onClose])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [close])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      style={{ animation: `${closing ? "backOut" : "backIn"} .24s ease both` }}
      onClick={close}
    >
      <div
        className="max-h-[86vh] w-full max-w-[880px] overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        style={{ animation: `${closing ? "modalOut" : "modalIn"} .24s cubic-bezier(.22,1,.36,1) both` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={
                "rounded px-1.5 py-px text-[10px] font-bold " +
                (p.kind === "own" ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600")
              }
            >
              {p.kind === "own" ? "자체 칼럼" : "외부 큐레이션"}
            </span>
            <span className="text-[11px] text-gray-400">
              {fmt(p.publishedAt)} · {p.kind === "own" ? p.author ?? "경영기획" : p.source}
            </span>
            {p.confidence ? (
              <span className="rounded bg-gray-50 px-1.5 py-px text-[10px] text-gray-500">
                {p.confidence}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="shrink-0 rounded p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <h2 className="text-[24px] font-bold leading-tight text-gray-900">{pick(p.title, p.titleEn)}</h2>
        {p.dek ? <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">{pick(p.dek, p.dekEn)}</p> : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
          <div>
            {p.kind === "own" ? (
              <OwnVisual tags={p.tags} />
            ) : p.image ? (
              <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100">
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div>
            {p.summary ? (
              <p className="text-[14px] leading-relaxed text-gray-700">{pick(p.summary, p.summaryEn)}</p>
            ) : null}

            <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
              <p className="text-[14px] leading-relaxed text-gray-700">
                <b className="font-semibold text-gray-900">{t("why_matters")} · </b>
                {pick(p.whyMatters, p.whyMattersEn)}
              </p>
            </div>

            {p.url ? (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[12px] text-indigo-600 transition-colors duration-200 hover:underline"
              >
                {p.kind === "own" ? "근거 원문" : "원문 전체 보기"} · {p.source} ↗
              </a>
            ) : null}
          </div>
        </div>

        {p.body ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-700">{pick(p.body, p.bodyEn)}</p>
          </div>
        ) : null}

        {p.kind === "external" ? (
          <p className="mt-4 border-t border-gray-100 pt-3 text-[11px] leading-snug text-gray-400">
            외부 글은 원문을 옮기지 않음. 요약·해석·링크만 제공 (출처와 저작권 보존)
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function AnalysisColumn() {
  const { t, pick } = useLang()
  const [rows, setRows] = React.useState<Post[] | null>(null)
  const [err, setErr] = React.useState(false)
  const [open, setOpen] = React.useState<Post | null>(null)

  React.useEffect(() => {
    analysisPosts(4).then(setRows).catch(() => setErr(true))
  }, [])

  return (
    <div className="lg:px-3">
      <a href="/news?cat=분석" className="group mb-2 flex items-baseline gap-1">
        <span className="text-[16px] font-bold tracking-tight text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
          {t("analysis_title")}
        </span>
        <span className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-600">
          ›
        </span>
        <span className="ml-1 text-[11px] text-gray-400">{t("analysis_sub")}</span>
      </a>

      {err ? (
        <p className="py-6 text-[12px] text-gray-400">분석 글을 불러오지 못함 · 확인 필요</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {(rows ?? Array.from({ length: 3 })).map((p, i) =>
            !p ? (
              <div key={i} className="py-3">
                {i === 0 ? <div className="mb-2 aspect-[16/9] w-full rounded-lg bg-gray-100" /> : null}
                <div className="h-[30px] rounded bg-gray-50" />
              </div>
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpen(p)}
                className="group py-3 text-left transition-all duration-300 ease-out hover:-translate-y-0.5"
              >
                {i === 0 ? (
                  p.kind === "own" ? (
                    <div className="mb-2">
                      <OwnVisual tags={p.tags} compact />
                    </div>
                  ) : p.image ? (
                    <div className="mb-2 h-[150px] w-full overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={p.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(ev) => {
                          const el = ev.currentTarget.parentElement
                          if (el) el.style.display = "none"
                        }}
                      />
                    </div>
                  ) : null
                ) : null}

                <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-gray-800 transition-colors duration-200 group-hover:text-indigo-600">
                  {pick(p.title, p.titleEn)}
                </p>

                {/* 다른 기사 열과 같은 한 줄 메타 — 배지·매체·날짜를 제목 아래로 통일(레이아웃 고정) */}
                <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 text-gray-400">
                  <span
                    className={
                      "shrink-0 rounded px-1 py-px text-[10px] font-bold leading-4 " +
                      (p.kind === "own" ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600")
                    }
                  >
                    {p.kind === "own" ? t("analysis_own") : t("analysis_ext")}
                  </span>
                  <span className="min-w-0 truncate">{p.kind === "own" ? p.author ?? "경영기획" : p.source}</span>
                  <span className="shrink-0">·</span>
                  <span className="shrink-0">{fmt(p.publishedAt)}</span>
                </p>
              </button>
            ),
          )}
        </div>
      )}

      <p className="mt-2 border-t border-gray-100 pt-2 text-[10px] leading-snug text-gray-400">
        {t("analysis_note")}
      </p>

      {open ? <Modal p={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}
