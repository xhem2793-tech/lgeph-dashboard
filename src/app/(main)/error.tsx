"use client"

// 라우트 에러 바운더리 — (main) 하위 페이지 렌더 중 예외가 나도 백스크린 대신 복구 UI를 보여준다.
import React from "react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    // 콘솔로 남겨 디버깅/외부 에러추적(Sentry 등)이 잡을 수 있게
    console.error("[route-error]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></svg>
      </div>
      <div>
        <h2 className="text-[16px] font-bold text-gray-900 dark:text-gray-50">이 페이지를 불러오는 중 문제가 발생했습니다</h2>
        <p className="mt-1 text-[12.5px] text-gray-500 dark:text-gray-400">일시적 오류일 수 있습니다. 다시 시도하거나, 계속되면 담당자에게 알려주세요.</p>
        {error?.digest && <p className="mt-2 font-mono text-[11px] text-gray-400 dark:text-gray-500">오류 코드: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => reset()} className="rounded-lg bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white transition-all hover:bg-indigo-700 active:scale-95">다시 시도</button>
        <a href="/overview" className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-[12.5px] font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:border-gray-300 dark:hover:border-gray-700">홈으로</a>
      </div>
    </div>
  )
}
