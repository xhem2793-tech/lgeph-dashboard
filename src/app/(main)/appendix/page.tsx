import AllIndicatorsView from "@/components/AllIndicatorsView"

/** 데이터 출처·검증은 「전체 지표 리스트」로 통합 — 최신값·출처 링크·신뢰도를 한 화면에서. */
export default function Page() {
  return (
    <main className="w-full px-6 pb-10 pt-4 sm:px-8 lg:px-10">
      <AllIndicatorsView />
    </main>
  )
}
