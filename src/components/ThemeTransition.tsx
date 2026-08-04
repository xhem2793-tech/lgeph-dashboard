"use client"

import { useEffect } from "react"

/** 다크/라이트 전환 시 전체 색상(배경·테두리·글자·아이콘)을 부드럽게 크로스페이드.
 *  <html>의 `dark` 클래스가 실제로 바뀔 때만 `theme-anim`을 잠깐 부여 →
 *  평소 hover 전환은 그대로 두고, 테마 전환 순간에만 전역 color transition을 켠다.
 *  (is-scrolling 등 다른 클래스 토글에는 반응하지 않음) */
export default function ThemeTransition() {
  useEffect(() => {
    const root = document.documentElement
    let prevDark = root.classList.contains("dark")
    let t: number | undefined
    const mo = new MutationObserver(() => {
      const nowDark = root.classList.contains("dark")
      if (nowDark === prevDark) return
      prevDark = nowDark
      root.classList.add("theme-anim")
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => root.classList.remove("theme-anim"), 420)
    })
    mo.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => { mo.disconnect(); if (t) window.clearTimeout(t) }
  }, [])
  return null
}
