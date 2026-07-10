import DailyIndicators from "@/components/DailyIndicators"

export default function Page() {
  return (
    <main className="px-4 pb-6 pt-0 sm:px-6">
      <h1 className="mb-3 text-lg font-bold tracking-tight text-gray-900">경제지표</h1>
      <DailyIndicators />
    </main>
  )
}
