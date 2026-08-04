"use client"

import { useEffect } from "react"

// 오버뷰(메인 대시보드)는 일단 숨김 — 진입 시 뉴스로 리다이렉트.
// (루트 / → /overview 301이 브라우저에 캐시된 경우에도 여기서 /news로 튕겨 오버뷰가 노출되지 않게 함)
// 원본 오버뷰 구현은 git 이력에 보존됨 — 되살릴 때 이 파일을 이전 버전으로 복구.
export default function Overview() {
  useEffect(() => {
    if (typeof window !== "undefined") window.location.replace("/news/")
  }, [])
  return (
    <div className="flex h-[60vh] items-center justify-center text-[13px] text-gray-400 dark:text-gray-500">
      뉴스로 이동 중…
    </div>
  )
}
