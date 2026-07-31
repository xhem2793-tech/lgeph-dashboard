"use client"

// 재사용 에러 바운더리 — 특정 뷰/위젯이 렌더 중 예외를 던져도 그 영역만 폴백으로 격리한다.
//   (한 뷰가 죽어도 탭·필터·다른 뷰는 살아있게)
import React from "react"

type Props = { children: React.ReactNode; label?: string; onReset?: () => void }
type State = { hasError: boolean }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[view-error]" + (this.props.label ? " " + this.props.label : ""), error, info)
  }

  reset = () => {
    this.setState({ hasError: false })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-rose-100 dark:border-rose-500/25 bg-rose-50/40 dark:bg-rose-500/5 px-6 text-center">
          <span className="text-[15px] font-semibold text-rose-700 dark:text-rose-300">{this.props.label ? this.props.label + " 표시 중 오류" : "이 영역을 표시할 수 없습니다"}</span>
          <span className="text-[14px] text-gray-500 dark:text-gray-400">다른 탭·필터는 정상 동작합니다.</span>
          <button type="button" onClick={this.reset} className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-gray-900 px-3 py-1.5 text-[14px] font-semibold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10">다시 시도</button>
        </div>
      )
    }
    return this.props.children
  }
}
