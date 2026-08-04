"use client"

import { useEffect } from "react"

/** 좌측 리스트 등 `.scroll-soft` 컨테이너에 스크롤 중에만 `is-scrolling`을 부여 →
 *  CSS transition으로 스크롤바 thumb가 부드럽게 나타났다가, 멈추면 서서히 사라진다.
 *  scroll 이벤트는 버블링하지 않으므로 캡처 단계에서 위임 처리한다. */
export default function ScrollbarAutoHide() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>()
    const mark = (el: Element) => {
      el.classList.add("is-scrolling")
      const prev = timers.get(el)
      if (prev) window.clearTimeout(prev)
      // 스크롤이 멈춘 뒤 잠깐 유지했다가 페이드아웃(CSS transition이 실제 사라짐을 담당)
      timers.set(el, window.setTimeout(() => el.classList.remove("is-scrolling"), 700))
    }
    const onScroll = (e: Event) => {
      const t = e.target
      // 메인 창(window) 스크롤 — 전 페이지 공통. target은 document → <html>에 표시
      if (t === document || t === document.documentElement || t === document.body) { mark(document.documentElement); return }
      const el = t as Element | null
      if (!el || el.nodeType !== 1 || typeof el.classList === "undefined") return
      // 내부 스크롤 컨테이너 — .scroll-soft 지정 요소만 개별 표시
      if (el.classList.contains("scroll-soft")) mark(el)
    }
    document.addEventListener("scroll", onScroll, true) // capture — scroll은 버블 안 함
    return () => document.removeEventListener("scroll", onScroll, true)
  }, [])
  return null
}
