import { Badge } from "@/components/Badge"
import { LineChart } from "@/components/LineChart"
import { getBadgeType } from "./DashboardChartCard"
import { percentageFormatter, formatters } from "@/lib/utils"

export type SparklineCardProps = {
  title: string
  value: number
  change: number
  sparklineData: { date: string; value: number }[]
  valueDescription?: string
  ctaDescription?: string
  ctaText?: string
  ctaLink?: string
}

export function SparklineCard({
  title,
  value,
  change,
  sparklineData,
  valueDescription = "本月新用户",
  ctaDescription,
  ctaText,
  ctaLink,
}: SparklineCardProps) {
  const chartData = sparklineData.map((item) => ({
    date: item.date,
    formattedDate: item.date,
    value: item.value,
    title,
    evolution: change,
  }))

  return (
    <div className="flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2">
          <dt className="font-bold text-gray-900 sm:text-sm dark:text-gray-50">
            {title}
          </dt>
          <Badge variant={getBadgeType(change)}>
            {percentageFormatter(change)}
          </Badge>
        </div>
        <dd className="mt-2 flex items-baseline gap-2">
          <span className="text-xl text-gray-900 dark:text-gray-50">
            {formatters.unit(value)}
          </span>
          <span className="text-sm text-gray-500">{valueDescription}</span>
        </dd>
        <div className="mt-4">
          <LineChart
            className="h-16"
            data={chartData}
            index="formattedDate"
            colors={["indigo"]}
            startEndOnly={true}
            valueFormatter={(value) => formatters.unit(value as number)}
            showXAxis={false}
            showYAxis={false}
            showLegend={false}
            showTooltip={false}
            categories={["value"]}
            autoMinValue
          />
        </div>
      </div>
      {ctaDescription && ctaText && ctaLink && (
        <div>
          <p className="mt-6 text-xs text-gray-500">
            {ctaDescription}{" "}
            <a
              href={ctaLink}
              className="text-indigo-600 dark:text-indigo-400"
            >
              {ctaText}
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
