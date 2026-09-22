"use client"

import * as React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { CommissionBreakdown } from "@/components/shared/commission-breakdown"

export interface CommissionConfigValue {
  enabled: boolean
  type: string
  rate: number
  fixed: number
}

type Mode = "default" | "percentage" | "fixed" | "percentage_fixed"

export function CommissionConfigFields({
  value,
  onChange,
}: {
  value: CommissionConfigValue
  onChange: (value: CommissionConfigValue) => void
}) {
  const mode: Mode = !value.enabled ? "default" : (value.type as Mode) || "percentage"

  function setMode(next: Mode) {
    if (next === "default") {
      onChange({ enabled: false, type: "percentage", rate: 0, fixed: 0 })
      return
    }
    onChange({ enabled: true, type: next, rate: value.rate ?? 0, fixed: value.fixed ?? 0 })
  }

  const previewGross = 100_000
  let commission = 0
  let fee = 0
  if (mode === "percentage") {
    commission = Math.floor((previewGross * (value.rate ?? 0)) / 100)
  } else if (mode === "fixed") {
    commission = value.fixed ?? 0
  } else if (mode === "percentage_fixed") {
    commission = Math.floor((previewGross * (value.rate ?? 0)) / 100) + (value.fixed ?? 0)
    fee = value.fixed ?? 0
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission</CardTitle>
        <CardDescription>
          Per-plan commission override. Leave on default to inherit the platform setting.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Commission mode">
              <SelectValue>
                {(v) => {
                  const labels: Record<Mode, string> = {
                    default: "Use platform default",
                    percentage: "Percentage",
                    fixed: "Fixed amount",
                    percentage_fixed: "Percentage + fixed",
                  }
                  return labels[(v as Mode) ?? "default"]
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Use platform default</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="fixed">Fixed amount</SelectItem>
              <SelectItem value="percentage_fixed">Percentage + fixed</SelectItem>
            </SelectContent>
          </Select>

          {mode === "default" && (
            <p className="text-sm text-muted-foreground">
              This plan will use the platform&apos;s configured commission for its
              transaction type.
            </p>
          )}

          {(mode === "percentage" || mode === "percentage_fixed") && (
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={value.rate ?? 0}
                onChange={(event) =>
                  onChange({ ...value, rate: Number(event.target.value) || 0 })
                }
                className="w-28 pr-8"
                aria-label="Commission percentage"
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
          )}

          {(mode === "fixed" || mode === "percentage_fixed") && (
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={value.fixed ?? 0}
                onChange={(event) =>
                  onChange({ ...value, fixed: Number(event.target.value) || 0 })
                }
                className="w-28 pr-8"
                aria-label="Fixed commission amount"
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                ₦
              </span>
            </div>
          )}
        </div>

        {mode !== "default" && (
          <>
            <Separator />
            <Field>
              <FieldLabel>Preview (₦100,000 gross)</FieldLabel>
              <CommissionBreakdown
                gross={previewGross}
                commission={commission}
                fee={fee}
                net={previewGross - commission}
              />
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  )
}