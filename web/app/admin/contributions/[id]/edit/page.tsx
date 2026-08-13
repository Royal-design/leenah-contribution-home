"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { ChevronLeft, Save } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminContribution, useAdminUpdateContribution } from "@/hooks/queries/use-admin"
import type { ContributionStatus, Frequency } from "@/types"

const frequencies: Array<{ value: Frequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
]

const statuses: Array<{ value: ContributionStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
]

const formSchema = z.object({
  name: z.string().trim().min(3, "Plan name must be at least 3 characters."),
  description: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .int()
    .positive("Amount must be greater than zero."),
  frequency: z.enum(["weekly", "biweekly", "monthly", "custom"], { message: "Select a frequency." }),
  memberCount: z.coerce
    .number({ message: "Enter a valid number." })
    .int()
    .min(1, "At least 1 member.")
    .max(500, "Maximum 500 members."),
  rounds: z.coerce
    .number({ message: "Enter a valid number." })
    .int()
    .min(1, "At least 1 round.")
    .max(120, "Maximum 120 rounds."),
  startDate: z.string().min(1, "Choose a start date."),
  endDate: z.string().optional(),
  withdrawalDate: z.string().optional(),
  status: z.enum(["draft", "upcoming", "active", "paused", "completed"], { message: "Select a status." }),
  isOpen: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

function toDateInput(iso: string | Date): string {
  if (!iso) return ""
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

export default function EditContributionPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: contribution, isPending } = useAdminContribution(id)
  const updateContribution = useAdminUpdateContribution()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      organization: "",
      amount: 0,
      frequency: "monthly",
      memberCount: 1,
      rounds: 12,
      startDate: "",
      endDate: "",
      withdrawalDate: "",
      status: "upcoming",
      isOpen: true,
    },
  })

  React.useEffect(() => {
    if (!contribution) return
    form.reset({
      name: contribution.name,
      description: contribution.description,
      organization: contribution.organization ?? "",
      amount: contribution.amount,
      frequency: contribution.frequency,
      memberCount: contribution.memberCount,
      rounds: contribution.rounds,
      startDate: toDateInput(contribution.startDate),
      endDate: contribution.endDate ? toDateInput(contribution.endDate) : "",
      withdrawalDate: contribution.withdrawalDate
        ? toDateInput(contribution.withdrawalDate)
        : "",
      status: contribution.status,
      isOpen: contribution.isOpen,
    })
  }, [contribution, form])

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!contribution) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <p className="text-sm font-medium">Contribution not found.</p>
        <Button variant="outline" size="sm" render={<Link href="/admin/contributions" />}>
          Back to contributions
        </Button>
      </div>
    )
  }

  function onSubmit(values: FormValues) {
    updateContribution.mutate(
      {
        id,
        payload: {
          name: values.name,
          description: values.description || undefined,
          organization: values.organization || undefined,
          amount: values.amount,
          frequency: values.frequency,
          memberCount: values.memberCount,
          rounds: values.rounds,
          startDate: values.startDate,
          endDate: values.endDate || undefined,
          withdrawalDate: values.withdrawalDate || undefined,
          status: values.status,
          isOpen: values.isOpen,
        },
      },
      { onSuccess: () => router.push("/admin/contributions") }
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/admin/contributions" />}
      >
        <ChevronLeft />
        Back to contributions
      </Button>

      <PageHeader
        title={`Edit ${contribution.name}`}
        description="Update the details of this contribution plan."
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
                          min={1}
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
                  <FieldLabel>End date</FieldLabel>
                  <Controller
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <Input
                        type="date"
                        aria-invalid={!!form.formState.errors.endDate}
                        {...field}
                      />
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel>Withdrawal date</FieldLabel>
                  <Controller
                    control={form.control}
                    name="withdrawalDate"
                    render={({ field }) => (
                      <Input
                        type="date"
                        aria-invalid={!!form.formState.errors.withdrawalDate}
                        {...field}
                      />
                    )}
                  />
                </Field>
              </div>

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

        <div className="flex gap-2">
          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || updateContribution.isPending}
          >
            <Save />
            {form.formState.isSubmitting || updateContribution.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            render={<Link href="/admin/contributions" />}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
