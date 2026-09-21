"use client"

import * as React from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/shared/status-badge"
import { useAdminCreateContribution } from "@/hooks/queries/use-admin"
import { DURATION_PRESETS, isPastDate, endDateFromDuration } from "@/lib/dates"
import { formatDate, formatNaira } from "@/lib/format"
import type { ContributionStatus, Frequency } from "@/types"

const frequencies: Array<{ value: Frequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
]

const statuses: Array<{ value: ContributionStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
]

const formSchema = z
  .object({
    name: z.string().trim().min(3, "Plan name must be at least 3 characters."),
    description: z.string().trim().min(10, "Add a short description."),
    amount: z.coerce
      .number({ message: "Enter a valid amount." })
      .int()
      .positive("Amount must be greater than zero."),
    frequency: z.enum(["weekly", "biweekly", "monthly", "custom"], { message: "Select a frequency." }),
    startDate: z.string().min(1, "Choose a start date."),
    durationPreset: z.string().min(1, "Choose a duration."),
    customDuration: z.coerce
      .number({ message: "Enter a valid number." })
      .int()
      .min(1, "At least 1 month.")
      .max(240, "Maximum 240 months.")
      .optional(),
    memberCount: z.coerce
      .number({ message: "Enter a valid number." })
      .int()
      .min(2, "At least 2 members.")
      .max(100, "Maximum 100 members."),
    rounds: z.coerce
      .number({ message: "Enter a valid number." })
      .int()
      .min(1, "At least 1 round.")
      .max(120, "Maximum 120 rounds."),
    withdrawalDate: z.string().optional(),
    status: z.enum(["draft", "active", "paused", "completed"], { message: "Select a status." }),
    withdrawalRule: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.durationPreset === "custom" && (!data.customDuration || data.customDuration < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDuration"],
        message: "Enter a duration in months.",
      })
    }
    if (data.withdrawalDate && new Date(data.withdrawalDate) < new Date(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["withdrawalDate"],
        message: "Withdrawal date must be on or after the start date.",
      })
    }
    if (isPastDate(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date cannot be in the past.",
      })
    }
    if (data.memberCount > data.rounds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["memberCount"],
        message: `A plan supports one withdrawal position per round. Use ${data.rounds} or fewer participants.`,
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

export default function CreateContributionPage() {
  const router = useRouter()
  const createContribution = useAdminCreateContribution()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "Monthly Growth Circle",
      description:
        "A 12-member monthly contribution circle for steady group saving.",
      amount: 25000,
      frequency: "monthly",
      startDate: "",
      durationPreset: "12",
      customDuration: 12,
      memberCount: 12,
      rounds: 12,
      withdrawalDate: "",
      status: "draft",
      withdrawalRule: "Full payout after all rounds are confirmed.",
    },
  })

  const watched = form.watch()
  const durationMonths = resolveDurationMonths(watched)
  const previewEndDate = watched.startDate && durationMonths > 0
    ? endDateFromDuration(watched.startDate, durationMonths)
    : ""

  function onSubmit(values: FormValues) {
    createContribution.mutate(
      {
        name: values.name,
        description: values.description,
        amount: values.amount,
        frequency: values.frequency,
        memberCount: values.memberCount,
        rounds: values.rounds,
        startDate: values.startDate,
        durationMonths: resolveDurationMonths(values),
        withdrawalDate: values.withdrawalDate || undefined,
      },
      {
        onSuccess: () => router.push("/admin/contributions"),
      }
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => router.push("/admin/contributions")}
      >
        <ChevronLeft />
        All contributions
      </Button>

      <PageHeader
        title="Create contribution plan"
        description="Configure a new contribution plan — the end date is calculated automatically."
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
                          placeholder="Monthly Growth Circle"
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
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contribution settings</CardTitle>
              <CardDescription>Configuration for amount and frequency.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Contribution amount</FieldLabel>
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

                <div className="grid gap-5 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Number of members</FieldLabel>
                    <Controller
                      control={form.control}
                      name="memberCount"
                      render={({ field }) => (
                        <>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={2}
                            aria-invalid={!!form.formState.errors.memberCount}
                            {...field}
                          />
                          <FieldError errors={form.formState.errors.memberCount ? [form.formState.errors.memberCount] : []} />
                        </>
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Rounds</FieldLabel>
                    <Controller
                      control={form.control}
                      name="rounds"
                      render={({ field }) => (
                        <>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            aria-invalid={!!form.formState.errors.rounds}
                            {...field}
                          />
                          <FieldDescription>
                            Contribution rounds. Auto-synced to the duration for monthly plans.
                          </FieldDescription>
                          <FieldError errors={form.formState.errors.rounds ? [form.formState.errors.rounds] : []} />
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

                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  Rotation:{" "}
                  <span className="font-medium text-foreground">
                    {Math.min(Number(watched.memberCount) || 0, Number(watched.rounds) || 0)}
                  </span>{" "}
                  withdrawal position(s) available — one per contribution round. Members are
                  assigned positions in the order they join.
                </p>
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
                    <FieldLabel>Withdrawal date (optional)</FieldLabel>
                    <Controller
                      control={form.control}
                      name="withdrawalDate"
                      render={({ field }) => (
                        <>
                          <Input
                            type="date"
                            aria-invalid={!!form.formState.errors.withdrawalDate}
                            {...field}
                          />
                          <FieldError errors={form.formState.errors.withdrawalDate ? [form.formState.errors.withdrawalDate] : []} />
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

                <Field>
                  <FieldLabel>Withdrawal rules</FieldLabel>
                  <Controller
                    control={form.control}
                    name="withdrawalRule"
                    render={({ field }) => (
                      <>
                        <Textarea
                          rows={2}
                          placeholder="When and how members can withdraw."
                          {...field}
                        />
                        <FieldDescription>
                          This rule is shown to members before they join.
                        </FieldDescription>
                      </>
                    )}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || createContribution.isPending}
          >
            <Save />
            {form.formState.isSubmitting || createContribution.isPending
              ? "Saving…"
              : "Save plan"}
          </Button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <PreviewSummary
            values={watched}
            durationMonths={durationMonths}
            endDate={previewEndDate}
          />
        </aside>
      </div>
    </div>
  )
}

function PreviewSummary({
  values,
  durationMonths,
  endDate,
}: {
  values: FormValues
  durationMonths: number
  endDate: string
}) {
  const amount = Number(values.amount) || 0
  const members = Number(values.memberCount) || 0
  const rounds = Number(values.rounds) || 0
  const totalExpected = amount * rounds

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">{values.name || "Untitled plan"}</p>
          <StatusBadge status={values.status} />
        </div>
        <div>
          <p className="text-muted-foreground">Contribution</p>
          <p className="font-medium tabular-nums">
            {formatNaira(amount)} / {values.frequency || "monthly"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Total pool</p>
          <p className="font-medium tabular-nums">
            {formatNaira(totalExpected)} / {rounds} {rounds === 1 ? "round" : "rounds"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Duration</p>
          <p className="font-medium">
            {durationMonths > 0
              ? durationMonths === 1
                ? "1 month"
                : `${durationMonths} months`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Starts</p>
          <p className="font-medium">{values.startDate ? formatDate(values.startDate) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Ends</p>
          <p className="font-medium">
            {endDate ? formatDate(endDate) : "—"}
            {endDate && <span className="text-xs text-muted-foreground"> (auto-calculated)</span>}
          </p>
        </div>
        {values.withdrawalDate && (
          <div>
            <p className="text-muted-foreground">Withdrawal from</p>
            <p className="font-medium">{formatDate(values.withdrawalDate)}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Members</p>
          <p className="font-medium">{members}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Withdrawal positions</p>
          <p className="font-medium">
            {Math.min(members, rounds) || 0} (one per round)
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