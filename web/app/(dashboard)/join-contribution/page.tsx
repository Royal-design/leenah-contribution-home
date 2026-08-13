"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { CalendarDays, ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatNaira } from "@/lib/format"
import { useOpenContributions, useCreateContribution } from "@/hooks/queries/use-contributions"
import { cn } from "@/lib/utils"

const formSchema = z
  .object({
    planId: z.string().min(1, "Select a contribution plan."),
    amount: z.coerce
      .number({ message: "Enter a valid amount." })
      .int("Amount must be a whole number.")
      .positive("Amount must be greater than zero."),
    frequency: z.enum(["weekly", "biweekly", "monthly", "custom"], { message: "Select a frequency." }),
    startDate: z.string().min(1, "Choose a start date."),
    memberCount: z.coerce
      .number({ message: "Enter a valid number." })
      .int("Member count must be a whole number.")
      .min(2, "At least 2 members are required.")
      .max(50, "Maximum 50 members."),
    rounds: z.coerce
      .number({ message: "Enter a valid number." })
      .int()
      .min(1, "At least 1 round is required."),
    withdrawalDate: z.string().min(1, "Choose a withdrawal date."),
    confirm: z.boolean().refine((value) => value === true, {
      message: "You must agree to continue.",
    }),
  })
  .refine((data) => new Date(data.withdrawalDate) >= new Date(data.startDate), {
    message: "Withdrawal date must be on or after the start date.",
    path: ["withdrawalDate"],
  })

type FormValues = z.infer<typeof formSchema>

export default function JoinContributionPage() {
  const router = useRouter()
  const createContribution = useCreateContribution()
  const openContributions = useOpenContributions({ page: 1, pageSize: 50 })

  const plans = openContributions.data?.items ?? []
  const planMap = new Map(plans.map((plan) => [plan.id, plan]))

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      planId: "",
      amount: 25000,
      frequency: "monthly",
      startDate: "",
      memberCount: 12,
      rounds: 12,
      withdrawalDate: "",
      confirm: false,
    },
  })

  const selectedPlan = planMap.get(form.watch("planId"))

  function onPlanChange(planId: string) {
    const plan = planMap.get(planId)
    form.setValue("planId", planId)
    if (plan) {
      form.setValue("amount", plan.amount)
      form.setValue("frequency", plan.frequency)
      form.setValue("memberCount", plan.memberCount)
      form.setValue("rounds", plan.rounds)
    }
  }

  function onSubmit(values: FormValues) {
    createContribution.mutate(
      {
        name: selectedPlan?.name ?? "My Contribution",
        description: selectedPlan?.description,
        amount: values.amount,
        frequency: values.frequency,
        startDate: values.startDate,
        memberCount: values.memberCount,
        rounds: values.rounds,
        withdrawalDate: values.withdrawalDate,
      },
      {
        onSuccess: () => router.push("/contributions"),
      }
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.back()}>
        <ChevronLeft />
        Back
      </Button>

      <PageHeader
        title="Join a contribution"
        description="Pick a plan, review the rules, and confirm your spot."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Select a plan</CardTitle>
              <CardDescription>Choose an existing circle to join.</CardDescription>
            </CardHeader>
            <CardContent>
              {openContributions.isPending ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-2">
                  {plans.length === 0 && (
                    <p className="py-4 text-sm text-muted-foreground">
                      No open contribution circles right now — you can still create
                      your own below.
                    </p>
                  )}
                  {plans.map((plan) => {
                    const active = form.watch("planId") === plan.id
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => onPlanChange(plan.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "hover:border-border hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{plan.name}</span>
                          <Badge variant="outline">{plan.frequency}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatNaira(plan.amount)} / {plan.frequency} · {plan.memberCount} members ·{" "}
                          {plan.rounds} rounds
                        </span>
                        <span className="mt-1 text-sm text-muted-foreground">
                          Starts {formatDate(plan.startDate)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              <FieldError errors={form.formState.errors.planId ? [form.formState.errors.planId] : []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan details</CardTitle>
              <CardDescription>Configure your contribution terms.</CardDescription>
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
                              id="join-amount"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              {...field}
                              aria-invalid={!!form.formState.errors.amount}
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
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Biweekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError errors={form.formState.errors.frequency ? [form.formState.errors.frequency] : []} />
                        </>
                      )}
                    />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Number of members</FieldLabel>
                    <Controller
                      control={form.control}
                      name="memberCount"
                      render={({ field }) => (
                        <>
                          <Input
                            id="join-members"
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
                    <FieldLabel>Contribution rounds</FieldLabel>
                    <Controller
                      control={form.control}
                      name="rounds"
                      render={({ field }) => (
                        <>
                          <Input
                            id="join-rounds"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            aria-invalid={!!form.formState.errors.rounds}
                            {...field}
                          />
                          <FieldError errors={form.formState.errors.rounds ? [form.formState.errors.rounds] : []} />
                        </>
                      )}
                    />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Start date</FieldLabel>
                    <Controller
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <>
                          <Input
                            id="join-start"
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
                    <FieldLabel>Withdrawal date</FieldLabel>
                    <Controller
                      control={form.control}
                      name="withdrawalDate"
                      render={({ field }) => (
                        <>
                          <Input
                            id="join-withdrawal"
                            type="date"
                            aria-invalid={!!form.formState.errors.withdrawalDate}
                            {...field}
                          />
                          <FieldError errors={form.formState.errors.withdrawalDate ? [form.formState.errors.withdrawalDate] : []} />
                          <FieldDescription>
                            The date you become eligible to withdraw your share.
                          </FieldDescription>
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
              <CardTitle>Rules &amp; confirmation</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground [&>li]:flex [&>li]:gap-2">
                <li>
                  <span aria-hidden="true" className="text-primary">•</span>
                  Missed contributions must be completed before your payout is released.
                </li>
                <li>
                  <span aria-hidden="true" className="text-primary">•</span>
                  Withdrawal is only available on or after the withdrawal date.
                </li>
                <li>
                  <span aria-hidden="true" className="text-primary">•</span>
                  Payouts are sent to your registered bank account.
                </li>
              </ul>

              <div className="mt-4 flex items-start gap-2">
                <Controller
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="mt-0.5 size-4 rounded border-input"
                      />
                      <span>
                        I agree to the contribution rules and understand when I am
                        eligible to withdraw.
                      </span>
                    </label>
                  )}
                />
              </div>
              <FieldError errors={form.formState.errors.confirm ? [form.formState.errors.confirm] : []} />
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || createContribution.isPending}
          >
            {form.formState.isSubmitting || createContribution.isPending
              ? "Creating…"
              : "Confirm and create"}
          </Button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ContributionSummary
            name={selectedPlan?.name}
            amount={form.watch("amount")}
            frequency={form.watch("frequency")}
            startDate={form.watch("startDate")}
            withdrawalDate={form.watch("withdrawalDate")}
            memberCount={form.watch("memberCount")}
            rounds={form.watch("rounds")}
          />
        </aside>
      </div>
    </div>
  )
}

function ContributionSummary({
  name,
  amount,
  frequency,
  startDate,
  withdrawalDate,
  memberCount,
  rounds,
}: {
  name?: string
  amount: number
  frequency: string
  startDate: string
  withdrawalDate: string
  memberCount: number
  rounds: number
}) {
  const value =
    typeof amount === "number" && isFinite(amount) && typeof rounds === "number"
      ? amount * rounds
      : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          Contribution summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Plan</p>
          <p className="font-medium">{name ?? "Select a plan"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Contribution</p>
          <p className="font-medium tabular-nums">
            {formatNaira(amount || 0)} / {frequency}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Total you&apos;ll pay</p>
          <p className="font-medium tabular-nums">{formatNaira(value)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Starts</p>
          <p className="font-medium">{startDate ? formatDate(startDate) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Withdrawal from</p>
          <p className="font-medium">
            {withdrawalDate ? formatDate(withdrawalDate) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Members</p>
          <p className="font-medium">{memberCount}</p>
        </div>
        <Separator className="my-1" />
        <p className="text-xs text-muted-foreground">
          {name ?? "Your contribution"} · {rounds} rounds
        </p>
      </CardContent>
    </Card>
  )
}