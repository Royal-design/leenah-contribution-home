"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { CommissionBreakdown } from "@/components/shared/commission-breakdown"
import { Skeleton } from "@/components/ui/skeleton"
import { useCommissionSettings, useUpdateCommissionSettings } from "@/hooks/queries/use-admin"
import { formatNaira } from "@/lib/format"

const keyLabels: Record<string, string> = {
  wallet_withdrawal: "Wallet withdrawal",
  savings_withdrawal: "Savings withdrawal",
  contribution_withdrawal: "Contribution withdrawal",
  contribution_payout: "Contribution payout",
  emergency_withdrawal: "Emergency withdrawal",
  admin_payout: "Admin-initiated payout",
}

const typeOptions = [
  { value: "no_commission", label: "No commission" },
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage_fixed", label: "Percentage + fixed" },
]

type Entry = { enabled: boolean; type: string; rate: number; fixed: number }

function CommissionSettingsForm({
  data,
}: {
  data: { defaults: Record<string, Entry>; keys: string[] }
}) {
  const update = useUpdateCommissionSettings()
  const [draft, setDraft] = React.useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      data.keys.map((key) => [
        key,
        {
          enabled: data.defaults[key]?.enabled ?? false,
          type: data.defaults[key]?.type ?? "no_commission",
          rate: data.defaults[key]?.rate ?? 0,
          fixed: data.defaults[key]?.fixed ?? 0,
        },
      ])
    )
  )

  function breakdown(): { commission: number; fee: number; net: number } {
    const firstEnabled = Object.values(draft).find((entry) => entry.enabled)
    if (!firstEnabled) return { commission: 0, fee: 0, net: 100_000 }
    const gross = 100_000
    if (firstEnabled.type === "percentage") {
      const commission = Math.floor((gross * firstEnabled.rate) / 100)
      return { commission, fee: 0, net: gross - commission }
    }
    if (firstEnabled.type === "fixed") {
      return { commission: firstEnabled.fixed, fee: 0, net: gross - firstEnabled.fixed }
    }
    if (firstEnabled.type === "percentage_fixed") {
      const commission = Math.floor((gross * firstEnabled.rate) / 100)
      return {
        commission: commission + firstEnabled.fixed,
        fee: firstEnabled.fixed,
        net: gross - commission - firstEnabled.fixed,
      }
    }
    return { commission: 0, fee: 0, net: gross }
  }

  const summary = breakdown()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission settings</CardTitle>
        <CardDescription>
          Platform-wide commission defaults. Individual plans can override these.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col divide-y">
          {data.keys.map((key) => {
            const entry = draft[key]
            if (!entry) return null
            return (
              <div
                key={key}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{keyLabels[key] ?? key}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.enabled
                      ? entry.type === "percentage"
                        ? `${entry.rate}%`
                        : entry.type === "fixed"
                          ? `${formatNaira(entry.fixed)} fixed`
                          : entry.type === "percentage_fixed"
                            ? `${entry.rate}% + ${formatNaira(entry.fixed)}`
                            : "Disabled"
                      : "Disabled"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={entry.type}
                    onValueChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        [key]: {
                          ...prev[key],
                          type: value ?? "no_commission",
                          enabled: (value ?? "no_commission") !== "no_commission",
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="w-full sm:w-44" aria-label={`${key} commission type`}>
                      <SelectValue>
                        {(value) =>
                          typeOptions.find((o) => o.value === value)?.label ?? "No commission"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(entry.type === "percentage" || entry.type === "percentage_fixed") && (
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        value={entry.rate}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], rate: Number(event.target.value) || 0 },
                          }))
                        }
                        className="w-24 pr-8"
                        aria-label={`${key} percentage`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  )}
                  {(entry.type === "fixed" || entry.type === "percentage_fixed") && (
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={entry.fixed}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], fixed: Number(event.target.value) || 0 },
                          }))
                        }
                        className="w-28 pr-8"
                        aria-label={`${key} fixed amount`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                        ₦
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        <div>
          <p className="mb-2 text-sm font-medium">Example transaction</p>
          <CommissionBreakdown
            gross={100_000}
            commission={summary.commission}
            fee={summary.fee}
            net={summary.net}
          />
        </div>

        <Button size="lg" disabled={update.isPending} onClick={() => update.mutate(draft)}>
          {update.isPending && <Loader2 className="size-4 animate-spin" />}
          Save commission settings
        </Button>
      </CardContent>
    </Card>
  )
}

export function CommissionSettingsCard() {
  const { data, isPending } = useCommissionSettings()

  if (isPending || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Commission settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  return <CommissionSettingsForm data={data} />
}