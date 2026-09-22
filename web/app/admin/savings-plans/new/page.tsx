"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { ChevronLeft, Save } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/shared/status-badge"
import { CommissionConfigFields, type CommissionConfigValue } from "@/components/admin/commission-config-fields"
import { useAdminCreateSavingsPlan } from "@/hooks/queries/use-savings-plans"
import { DURATION_PRESETS, isPastDate, endDateFromDuration } from "@/lib/dates"
import { formatDate, formatNaira } from "@/lib/format"
import type { Frequency, SavingsPlanStatus } from "@/types"

const frequencies: Array<{ value: Frequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
]

const statuses: Array<{ value: SavingsPlanStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
]

const formSchema = z
  .object({
    name: z.string().trim().min(3, "Plan name must be at least 3 characters."),
    description: z.string().trim().min(10, "Add a short description."),
    organization: z.string().trim().optional(),
    amount: z.coerce
      .number({ message: "Enter a valid amount." })
      .int()
      .positive("Amount must be greater than zero."),
    targetAmount: z
      .string()
      .refine(
        (value) =>
          value === "" || (!Number.isNaN(Number(value)) && Number(value) > 0),
        { message: "Target amount must be greater than zero." }
      )
      .optional(),
    frequency: z.enum(["weekly", "biweekly", "monthly", "custom"], {
      message: "Select a frequency.",
    }),
    startDate: z.string().min(1, "Choose a start date."),
    durationPreset: z.string().min(1, "Choose a duration."),
    customDuration: z.coerce
      .number({ message: "Enter a valid number." })
      .int()
      .min(1, "At least 1 month.")
      .max(240, "Maximum 240 months.")
      .optional(),
    status: z.enum(["draft", "upcoming", "active", "paused"], { message: "Select a status." }),
    isOpen: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.durationPreset === "custom" && (!data.customDuration || data.customDuration < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDuration"],
        message: "Enter a duration in months.",
      })
    }
    if (isPastDate(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date cannot be in the past.",
      })
    }
  })

type FormValues = z.infer<typeof formSchema>

function resolveDurationMonths(values: Pick<FormValues, "durationPreset" | "customDuration">) {
  if (values.durationPreset === "custom") {
    return Number(values.customDuration) || 0
  }
  return Number(values.durationPreset) || 0
}

export default function CreateSavingsPlanPage() {
  const router = useRouter()
  const createPlan = useAdminCreateSavingsPlan()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "Emergency Savings",
      description: "A disciplined monthly savings plan to build your safety net.",
      organization: "LCH",
      amount: 10000,
      targetAmount: "60000",
      frequency: "monthly",
      startDate: "",
      durationPreset: "6",
      customDuration: 6,
      status: "draft",
      isOpen: true,
    },
  })

  const watched = form.watch()
  const durationMonths = resolveDurationMonths(watched)
  const previewEndDate = watched.startDate
    ? endDateFromDuration(watched.startDate, durationMonths)
    : ""
  const [commission, setCommission] = React.useState<CommissionConfigValue>({
    enabled: false,
    type: "percentage",
    rate: 0,
    fixed: 0,
  })

  function onSubmit(values: FormValues) {
    createPlan.mutate(
      {
        name: values.name,
        description: values.description,
        organization: values.organization || undefined,
        amount: values.amount,
        targetAmount: values.targetAmount
          ? Number(values.targetAmount)
          : undefined,
        frequency: values.frequency,
        startDate: values.startDate,
        durationMonths: resolveDurationMonths(values),
        status: values.status,
        isOpen: values.isOpen,
        commissionEnabled: commission.enabled,
        commissionType: commission.enabled ? commission.type : undefined,
        commissionRate: commission.enabled ? commission.rate : undefined,
        commissionFixed: commission.enabled ? commission.fixed : undefined,
      },
      {
        onSuccess: () => router.push("/admin/savings-plans"),
      }
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/admin/savings-plans" />}
      >
        <ChevronLeft />
        All savings plans
      </Button>

      <PageHeader
        title="Create savings plan"
        description="Configure a savings plan — the end date is calculated automatically from the duration."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Plan details</CardTitle>
              <CardDescription>Basic information about the plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Plan name</FieldLabel>
                  <Controller
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <>
                        <Input
                          type="text"
                          placeholder="Emergency Savings"
                          aria-invalid={!!form.formState.errors.name}
                          {...field}
                        />
                        <FieldError errors={form.formState.errors.name ? [form.formState.errors.name] : []} />
                      </>
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <Controller
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <>
                        <Textarea
                          rows={3}
                          placeholder="Describe the plan and its purpose."
                          aria-invalid={!!form.formState.errors.description}
                          {...field}
                        />
                        <FieldError errors={form.formState.errors.description ? [form.formState.errors.description] : []} />
                      </>
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel>Organization</FieldLabel>
                  <Controller
                    control={form.control}
                    name="organization"
                    render={({ field }) => (
                      <Input type="text" placeholder="Optional organization name" {...field} />
                    )}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings settings</CardTitle>
              <CardDescription>Configuration for amount and frequency.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Period amount</FieldLabel>
                    <Controller
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <>
                          <InputGroup>
                            <InputGroupAddon align="inline-start">
                              <span aria-hidden="true">₦</span>
                            </InputGroupAddon>
                            <InputGroupInput
                              type="number"
                              inputMode="numeric"
                              min={1}
                              aria-invalid={!!form.formState.errors.amount}
                              {...field}
                            />
                          </InputGroup>
                          <FieldError errors={form.formState.errors.amount ? [form.formState.errors.amount] : []} />
                        </>
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Funding target (optional)</FieldLabel>
                    <Controller
                      control={form.control}
                      name="targetAmount"
                      render={({ field }) => (
                        <>
                          <InputGroup>
                            <InputGroupAddon align="inline-start">
                              <span aria-hidden="true">₦</span>
                            </InputGroupAddon>
                            <InputGroupInput
                              type="number"
                              inputMode="numeric"
                              min={1}
                              placeholder="Optional"
                              aria-invalid={!!form.formState.errors.targetAmount}
                              {...field}
                            />
                          </InputGroup>
                          <FieldDescription>
                            Informational overall target, not enforced.
                          </FieldDescription>
                          <FieldError errors={form.formState.errors.targetAmount ? [form.formState.errors.targetAmount] : []} />
                        </>
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Frequency</FieldLabel>
                    <Controller
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger aria-invalid={!!form.formState.errors.frequency}>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              {frequencies.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldError errors={form.formState.errors.frequency ? [form.formState.errors.frequency] : []} />
                        </>
                      )}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>
                Pick a start date and a duration — the end date is calculated for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Start date</FieldLabel>
                    <Controller
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <>
                          <Input
                            type="date"
                            aria-invalid={!!form.formState.errors.startDate}
                            {...field}
                          />
                          <FieldError errors={form.formState.errors.startDate ? [form.formState.errors.startDate] : []} />
                        </>
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Duration</FieldLabel>
                    <Controller
                      control={form.control}
                      name="durationPreset"
                      render={({ field }) => (
                        <>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger aria-invalid={!!form.formState.errors.durationPreset}>
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                              {DURATION_PRESETS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError errors={form.formState.errors.durationPreset ? [form.formState.errors.durationPreset] : []} />
                        </>
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Controller
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger aria-invalid={!!form.formState.errors.status}>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statuses.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldError errors={form.formState.errors.status ? [form.formState.errors.status] : []} />
                        </>
                      )}
                    />
                  </Field>
                </div>

                {watched.durationPreset === "custom" && (
                  <Field>
                    <FieldLabel>Custom duration (months)</FieldLabel>
                    <Controller
                      control={form.control}
                      name="customDuration"
                      render={({ field }) => (
                        <>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            placeholder="e.g. 9"
                            aria-invalid={!!form.formState.errors.customDuration}
                            {...field}
                          />
                          <FieldDescription>Whole calendar months (1–240).</FieldDescription>
                          <FieldError errors={form.formState.errors.customDuration ? [form.formState.errors.customDuration] : []} />
                        </>
                      )}
                    />
                  </Field>
                )}

                <div className="flex items-end gap-2 pb-1">
                  <Controller
                    control={form.control}
                    name="isOpen"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="is-open"
                        />
                        <Label htmlFor="is-open">Open for new members</Label>
                      </div>
                    )}
                  />
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <CommissionConfigFields value={commission} onChange={setCommission} />

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || createPlan.isPending}
          >
            <Save />
            {form.formState.isSubmitting || createPlan.isPending ? "Saving…" : "Save plan"}
          </Button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <PreviewSummary
            name={watched.name}
            status={watched.status}
            amount={Number(watched.amount) || 0}
            frequency={watched.frequency}
            targetAmount={Number(watched.targetAmount) || 0}
            startDate={watched.startDate}
            endDate={previewEndDate}
            durationMonths={durationMonths}
          />
        </aside>
      </div>
    </div>
  )
}

function PreviewSummary({
  name,
  status,
  amount,
  frequency,
  targetAmount,
  startDate,
  endDate,
  durationMonths,
}: {
  name: string
  status: SavingsPlanStatus
  amount: number
  frequency: string
  targetAmount: number
  startDate: string
  endDate: string
  durationMonths: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">{name || "Untitled plan"}</p>
          <StatusBadge status={status} />
        </div>
        <div>
          <p className="text-muted-foreground">You&apos;ll save</p>
          <p className="font-medium tabular-nums">
            {formatNaira(amount)} / {frequency || "monthly"}
          </p>
        </div>
        {targetAmount > 0 && (
          <div>
            <p className="text-muted-foreground">Funding target</p>
            <p className="font-medium tabular-nums">{formatNaira(targetAmount)}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Duration</p>
          <p className="font-medium">
            {durationMonths > 0 ? formatDurationMonthLabel(durationMonths) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Starts</p>
          <p className="font-medium">{startDate ? formatDate(startDate) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Ends</p>
          <p className="font-medium">
            {endDate ? formatDate(endDate) : "—"}
            {endDate && <span className="text-xs text-muted-foreground"> (auto-calculated)</span>}
          </p>
        </div>
        <Separator className="my-1" />
        <p className="text-xs text-muted-foreground">
          The end date is derived from the start date and duration on the server.
        </p>
      </CardContent>
    </Card>
  )
}

function formatDurationMonthLabel(months: number) {
  return months === 1 ? "1 month" : `${months} months`
}