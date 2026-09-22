"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { Search, Loader2, Check, Wallet, Landmark, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { CommissionBreakdown } from "@/components/shared/commission-breakdown"
import { useAdminInitiatePayout, useAdminUsers } from "@/hooks/queries/use-admin"
import { useWithdrawalPreview } from "@/hooks/queries/use-wallet"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero."),
  reason: z.string().min(3, "A reason is required for admin-initiated withdrawals."),
})

type FormValues = z.infer<typeof formSchema>

export function WithdrawForUserDialog({
  open,
  onOpenChange,
  defaultUserId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultUserId?: string
}) {
  const payout = useAdminInitiatePayout()
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [selectedUser, setSelectedUser] = React.useState<{ id: string; label: string } | null>(null)
  const [channel, setChannel] = React.useState<"wallet" | "bank">("wallet")

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: users, isPending: usersLoading } = useAdminUsers({
    search: debouncedSearch || undefined,
    pageSize: 8,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { amount: undefined, reason: "" },
  })

  const amount = form.watch("amount")
  const reason = form.watch("reason")

  const previewInput = React.useMemo(
    () => (Number(amount) > 0 ? { amount: Math.floor(Number(amount)), withdrawalType: "savings" as const, source: "admin" as const, channel } : null),
    [amount, channel]
  )
  const preview = useWithdrawalPreview(previewInput)

  React.useEffect(() => {
    if (open) {
      form.reset({ amount: undefined, reason: "" })
      setChannel("wallet")
      if (defaultUserId) {
        setSelectedUser({ id: defaultUserId, label: "Selected user" })
      } else {
        setSelectedUser(null)
        setSearch("")
      }
    }
  }, [open, defaultUserId, form])

  function onSubmit(values: FormValues) {
    if (!selectedUser) return
    payout.mutate(
      {
        userId: selectedUser.id,
        amount: Math.floor(Number(values.amount)),
        channel,
        reason: values.reason,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const netAmount = preview.data?.net

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw / Pay user</DialogTitle>
          <DialogDescription>
            Admin-initiated withdrawal. This is processed immediately and audited against your admin account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            Admin-initiated withdrawal — executed on your behalf as an admin action.
          </div>

          {!selectedUser && (
            <Field>
              <FieldLabel>User</FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search users by name or email…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (users?.items ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">No users found.</p>
                ) : (
                  (users?.items ?? []).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() =>
                        setSelectedUser({
                          id: user.id,
                          label: `${user.firstName} ${user.lastName} · ${user.email}`,
                        })
                      }
                      className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                    >
                      <span className="truncate">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </button>
                  ))
                )}
              </div>
            </Field>
          )}

          {selectedUser && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
              <span className="min-w-0 truncate">{selectedUser.label}</span>
              <button
                type="button"
                className="ml-2 shrink-0 text-xs text-primary"
                onClick={() => setSelectedUser(null)}
              >
                Change
              </button>
            </div>
          )}

          <FieldGroup>
            <Field>
              <FieldLabel>Amount</FieldLabel>
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
                        {...field}
                        aria-invalid={!!form.formState.errors.amount}
                      />
                    </InputGroup>
                    <FieldError
                      errors={form.formState.errors.amount ? [form.formState.errors.amount] : []}
                    />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Destination</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                    channel === "wallet" && "border-primary bg-primary/5"
                  )}
                >
                  <input
                    type="radio"
                    name="admin-channel"
                    checked={channel === "wallet"}
                    onChange={() => setChannel("wallet")}
                    className="sr-only"
                  />
                  <Wallet className="size-4 shrink-0 text-info" />
                  <span className="text-sm font-medium">Wallet</span>
                  {channel === "wallet" && <Check className="ml-auto size-4 text-primary" />}
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                    channel === "bank" && "border-primary bg-primary/5"
                  )}
                >
                  <input
                    type="radio"
                    name="admin-channel"
                    checked={channel === "bank"}
                    onChange={() => setChannel("bank")}
                    className="sr-only"
                  />
                  <Landmark className="size-4 shrink-0 text-success" />
                  <span className="text-sm font-medium">Bank</span>
                  {channel === "bank" && <Check className="ml-auto size-4 text-primary" />}
                </label>
              </div>
            </Field>

            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Controller
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <>
                    <Textarea
                      rows={2}
                      placeholder="Why is this payout being made?"
                      {...field}
                      aria-invalid={!!form.formState.errors.reason}
                    />
                    <FieldError
                      errors={form.formState.errors.reason ? [form.formState.errors.reason] : []}
                    />
                  </>
                )}
              />
            </Field>

            {Number(amount) > 0 && (
              <CommissionBreakdown
                gross={Number(amount)}
                commission={preview.data?.commission}
                fee={preview.data?.fee}
                net={netAmount}
                netLabel="Net to user"
              />
            )}
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={payout.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={payout.isPending || !selectedUser}>
              {payout.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Processing…
                </>
              ) : (
                "Process payout"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}