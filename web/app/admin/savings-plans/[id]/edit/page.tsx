"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { ChevronLeft, Save } from "lucide-react"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import { CommissionConfigFields, type CommissionConfigValue } from "@/components/admin/commission-config-fields"
import {
  useAdminSavingsPlan,
  useAdminUpdateSavingsPlan,
} from "@/hooks/queries/use-savings-plans"
import { DURATION_PRESETS, isPastDate, endDateFromDuration } from "@/lib/dates"
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
  { value: "completed", label: "Completed" },
]

const formSchema = z
  .object({
    name: z.string().trim().min(3, "Plan name must be at least 3 characters."),
    description: z.string().trim().optional(),
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
    status: z.enum(["draft", "upcoming", "active", "paused", "completed"], {
      message: "Select a status.",
    }),
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
  })

type FormValues = z.infer<typeof formSchema>

const PRESET_VALUES = DURATION_PRESETS.map((preset) => preset.value)

function presetFor(months: number | undefined): string {
  if (!months) return "12"
  const match = PRESET_VALUES.find((value) => Number(value) === months)
  return match ?? "custom"
}

function toDateInput(iso: string | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

function resolveDurationMonths(values: Pick<FormValues, "durationPreset" | "customDuration">) {
  if (values.durationPreset === "custom") {
    return Number(values.customDuration) || 0
  }
  return Number(values.durationPreset) || 0
}

export default function EditSavingsPlanPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: plan, isPending } = useAdminSavingsPlan(id)
  const updatePlan = useAdminUpdateSavingsPlan()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      organization: "",
      amount: 0,
      targetAmount: "",
      frequency: "monthly",
      startDate: "",
      durationPreset: "12",
      customDuration: 12,
      status: "upcoming",
      isOpen: true,
    },
  })

  const watched = form.watch()
  const durationMonths = resolveDurationMonths(watched)
  const previewEndDate = watched.startDate && durationMonths > 0
    ? endDateFromDuration(watched.startDate, durationMonths)
    : ""
  const [commission, setCommission] = React.useState<CommissionConfigValue>({
    enabled: false,
    type: "percentage",
    rate: 0,
    fixed: 0,
  })

  React.useEffect(() => {
    if (!plan) return
    form.reset({
      name: plan.name,
      description: plan.description,
      organization: plan.organization ?? "",
      amount: plan.amount,
      targetAmount: plan.targetAmount ? String(plan.targetAmount) : "",
      frequency: plan.frequency,
      startDate: toDateInput(plan.startDate),
      durationPreset: presetFor(plan.durationMonths),
      customDuration: plan.durationMonths ?? 12,
      status: plan.status,
      isOpen: plan.isOpen,
    })
    setCommission({
      enabled: plan.commissionEnabled ?? false,
      type: plan.commissionType ?? "percentage",
      rate: plan.commissionRate ?? 0,
      fixed: plan.commissionFixed ?? 0,
    })
  }, [plan, form])

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <p className="text-sm font-medium">Savings plan not found.</p>
        <Button variant="outline" size="sm" render={<Link href="/admin/savings-plans" />}>
          Back to savings plans
        </Button>
      </div>
    )
  }

  const originalStartDate = toDateInput(plan.startDate)

  function onSubmit(values: FormValues) {
    if (values.startDate && isPastDate(values.startDate) && values.startDate !== originalStartDate) {
      toast.error("Start date cannot be in the past.")
      return
    }
    updatePlan.mutate(
      {
        id,
        payload: {
          name: values.name,
          description: values.description || undefined,
          organization: values.organization || undefined,
          amount: values.amount,
          targetAmount: values.targetAmount ? Number(values.targetAmount) : undefined,
          frequency: values.frequency,
          startDate: values.startDate,
          durationMonths: resolveDurationMonths(values) || undefined,
          status: values.status,
          isOpen: values.isOpen,
          commissionEnabled: commission.enabled,
          commissionType: commission.enabled ? commission.type : undefined,
          commissionRate: commission.enabled ? commission.rate : undefined,
          commissionFixed: commission.enabled ? commission.fixed : undefined,
        },
      },
      { onSuccess: () => router.push("/admin/savings-plans") }
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
        Back to savings plans
      </Button>

      <PageHeader
        title={`Edit ${plan.name}`}
        description="Update the details of this savings plan."
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-2xl flex-col gap-6">
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
                <FieldLabel>Organization</FieldLabel>
                <Controller
                  control={form.control}
                  name="organization"
                  render={({ field }) => (
                    <Input type="text" placeholder="Optional organization name" {...field} />
                  )}
                />
              </Field>

              <Field>
                <FieldLabel>Description</FieldLabel>
                <Controller
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <Textarea rows={3} placeholder="Describe the plan and its purpose." {...field} />
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
                            {...field}
                          />
                        </InputGroup>
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
              The end date is calculated automatically from the start date and duration.
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

              {previewEndDate && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  Ends: <span className="font-medium text-foreground">{previewEndDate}</span>{" "}
                  (calculated from start date + duration)
                </p>
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

        <div className="flex gap-2">
          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || updatePlan.isPending}
          >
            <Save />
            {form.formState.isSubmitting || updatePlan.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            render={<Link href="/admin/savings-plans" />}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}