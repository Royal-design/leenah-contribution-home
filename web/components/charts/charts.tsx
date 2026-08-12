"use client"

import { useId, useMemo } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNaira, formatNairaCompact } from "@/lib/format"

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
}) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="min-w-[10rem] rounded-lg border bg-popover p-3 text-sm shadow-md">
      {label && <p className="mb-1.5 font-medium">{label}</p>}
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium tabular-nums">
              {formatNaira(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SavingsGrowthChart({
  data,
  className,
  height = 260,
}: {
  data: Array<{ month: string; amount: number }>
  className?: string
  height?: number
}) {
  const gradientId = useId()
  const gradientFill = useMemo(() => `url(#${gradientId})`, [gradientId])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Savings Growth</CardTitle>
        <CardDescription>Your savings balance over the last 8 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={formatNairaCompact}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "var(--border)" }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                name="Savings"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill={gradientFill}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function ContributionActivityChart({
  data,
  className,
  height = 260,
}: {
  data: Array<{ month: string; contributions: number }>
  className?: string
  height?: number
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Contribution Activity</CardTitle>
        <CardDescription>Monthly contributions across your plans</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={formatNairaCompact}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              />
              <Bar
                dataKey="contributions"
                name="Contributions"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function DistributionChart({
  data,
  className,
  height = 260,
}: {
  data: Array<{ name: string; value: number }>
  className?: string
  height?: number
}) {
  const colors = [
    "var(--chart-1)",
    "var(--chart-3)",
    "var(--muted-foreground)",
  ]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Contribution Distribution</CardTitle>
        <CardDescription>Where your contribution balance sits</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={3}
                stroke="var(--background)"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={colors[index % colors.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ background: colors[index % colors.length] }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-medium tabular-nums">
                {formatNaira(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}