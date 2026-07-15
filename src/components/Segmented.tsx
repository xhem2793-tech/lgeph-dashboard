"use client"

import React from "react"

/** 공용 세그먼트 토글 (슬라이딩 알약, A안).
 *  모든 2~3구간 배타적 토글은 이걸 쓴다 — 캘린더 지남/예정, 뉴스 최신순/영향도순 등.
 *  하이라이트가 cubic-bezier(.22,1,.36,1)로 스르륵 이동하고 글자색이 부드럽게 전환된다.
 */
export function Segmented({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { k: string; label: React.ReactNode }[]
  value: string
  onChange: (k: string) => void
  size?: "sm" | "md"
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [style, setStyle] = React.useState<React.CSSProperties>({ opacity: 0 })
  const idx = options.findIndex((o) => o.k === value)
  React.useLayoutEffect(() => {
    const el = refs.current[idx]
    if (el) setStyle({ left: 0, width: el.offsetWidth, transform: `translateX(${el.offsetLeft}px)`, opacity: 1 })
  }, [idx, options])
  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1 text-[11.5px]"
  return (
    <div className="relative flex shrink-0 rounded-full border border-gray-200 bg-gray-50 p-0.5">
      <span
        className="absolute bottom-0.5 top-0.5 rounded-full bg-indigo-600 shadow-sm transition-all duration-[340ms] ease-[cubic-bezier(.22,1,.36,1)]"
        style={style}
      />
      {options.map((o, i) => (
        <button
          key={o.k}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          onClick={() => onChange(o.k)}
          className={
            "relative z-10 rounded-full font-medium transition-colors duration-300 active:scale-95 " +
            pad +
            " " +
            (value === o.k ? "text-white" : "text-gray-600 hover:text-indigo-600")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
