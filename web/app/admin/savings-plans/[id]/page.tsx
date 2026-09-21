"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Pencil, Search, Trash2, UserPlus, X } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useAdminSavingsPlan,
  useAdminDeleteSavingsPlan,
  useAdminSavingsPlanEnrollments,
  useAdminAddSavingsPlanMember,
  useAdminRemoveSavingsPlanMember,
} from "@/hooks/queries/use-savings-plans"
import { useAdminUsers } from "@/hooks/queries/use-admin"
import { formatDate, formatNaira, getInitials } from "@/lib/format"
import { formatDurationMonths } from "@/lib/dates"
import type { SavingsPlanEnrollmentDetail, User } from "@/types"

function AddMemberDialog({
  open,
  onOpenChange,
  planId,
  memberIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  memberIds: string[]
}) {
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const addMember = useAdminAddSavingsPlanMember()

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: users, isPending } = useAdminUsers({
    page: 1,
    pageSize: 15,
    search: debouncedSearch || undefined,
  })

  const memberSet = React.useMemo(() => new Set(memberIds), [memberIds])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Enroll an existing user in this savings plan.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search users by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
            aria-label="Search users"
          />
        </div>

        <div className="flex max-h-64 flex-col overflow-y-auto">
          {isPending ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (users?.items ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No users found.
            </p>
          ) : (
            (users?.items ?? []).map((user: User) => {
              const already = memberSet.has(user.id)
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>
                        {getInitials(`${user.firstName} ${user.lastName}`)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    variant={already ? "ghost" : "secondary"}
                    size="sm"
                    disabled={already}
                    onClick={() =>
                      addMember.mutate(
                        { planId, userId: user.id },
                        { onSuccess: () => onOpenChange(false) }
                      )
                    }
                  >
                    {already ? "Added" : "Add"}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSavingsPlanDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: plan, isPending } = useAdminSavingsPlan(id)
  const enrollments = useAdminSavingsPlanEnrollments(id)
  const deletePlan = useAdminDeleteSavingsPlan()
  const removeMember = useAdminRemoveSavingsPlanMember()

  const [addOpen, setAddOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState(false)
  const [pendingRemove, setPendingRemove] = React.useState<SavingsPlanEnrollmentDetail | null>(null)

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
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

  const memberList = enrollments.data ?? []

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/savings-plans" />}>
        <ChevronLeft />
        All savings plans
      </Button>

      <PageHeader title={plan.name} description={plan.description}>
        <StatusBadge status={plan.status} />
        <Button size="sm" variant="outline" render={<Link href={`/admin/savings-plans/${id}/edit`} />}>
          <Pencil />
          Edit
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus />
          Add member
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setPendingDelete(true)}>
          <Trash2 />
          Delete
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Per period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNaira(plan.amount)}{" "}
              <span className="text-sm font-normal text-muted-foreground">/ {plan.frequency}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatDurationMonths(plan.durationMonths)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{plan.progress}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNaira(plan.totalSaved)} of {formatNaira(plan.totalExpected)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Window</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            <p className="text-sm font-medium">{formatDate(plan.startDate)}</p>
            <p className="text-xs text-muted-foreground">
              → {plan.endDate ? formatDate(plan.endDate) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan.enrollCount} members enrolled
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Users enrolled in this savings plan.</CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : memberList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No members have joined this plan yet. Use &quot;Add member&quot; to enroll a user.
            </p>
          ) : (
            <div className="flex flex-col">
              {memberList.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.userName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.userEmail ?? "No email"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="tabular-nums text-muted-foreground">
                      {formatNaira(member.totalSaved)}
                    </span>
                    {member.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${member.userName}`}
                        disabled={member.totalSaved > 0}
                        title={
                          member.totalSaved > 0
                            ? "Has payments — cannot be removed"
                            : undefined
                        }
                        onClick={() => setPendingRemove(member)}
                      >
                        <X className="text-destructive" />
                      </Button>
                    ) : (
                      <StatusBadge status={member.status} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        planId={id}
        memberIds={memberList.map((member) => member.userId)}
      />

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Delete savings plan?"
        description={`Delete "${plan.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deletePlan.isPending}
        onConfirm={() => {
          deletePlan.mutate(id, {
            onSuccess: () => router.push("/admin/savings-plans"),
          })
        }}
      />

      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove member?"
        description={
          pendingRemove
            ? `Remove ${pendingRemove.userName} from "${plan.name}"? Their payment history is preserved.`
            : ""
        }
        confirmLabel="Remove"
        destructive
        loading={removeMember.isPending}
        onConfirm={() => {
          if (!pendingRemove) return
          removeMember.mutate(
            { planId: id, userId: pendingRemove.userId },
            { onSuccess: () => setPendingRemove(null) }
          )
        }}
      />
    </div>
  )
}