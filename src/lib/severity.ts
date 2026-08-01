/** 심각도(Critical/High/Medium) 배지 클래스 — 뉴스·규제 팝업 공통 단일 소스.
 *  동일 맵이 news/page.tsx·AnalysisColumn.tsx에 중복 정의돼 있던 것을 통합. */
export const SEV: Record<string, string> = {
  Critical: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400",
  High: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Medium: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
}
