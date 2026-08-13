"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Search, Pencil, Trash2, UserPlus, X } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  useAdminAddContributionMember,
  useAdminContribution,
  useAdminDeleteContribution,
  useAdminRemoveContributionMember,
  useAdminUsers,
} from "@/hooks/queries/use-admin"
import { formatDate, formatNaira, getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ContributionMember, User } from "@/types"

function AddMemberDialog({
  open,
  onOpenChange,
  contributionId,
  memberIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contributionId: string
  memberIds: string[]
}) {
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const addMember = useAdminAddContributionMember()

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
            Add an existing user to this contribution.
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
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={already ? "ghost" : "secondary"}
                    size="sm"
                    disabled={already}
                    onClick={() =>
                      addMember.mutate(
                        { contributionId, userId: user.id },
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

export default function AdminContributionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: contribution, isPending } = useAdminContribution(id)
  const deleteContribution = useAdminDeleteContribution()
  const removeMember = useAdminRemoveContributionMember()

  const [addOpen, setAddOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState(false)
  const [pendingRemove, setPendingRemove] = React.useState<ContributionMember | null>(null)

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
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

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/contributions" />}>
        <ChevronLeft />
        All contributions
      </Button>

      <PageHeader
        title={contribution.name}
        description={contribution.description}
      >
        <StatusBadge status={contribution.status} />
        <Button size="sm" variant="outline" render={<Link href={`/admin/contributions/${id}/edit`} />}>
          <Pencil />
          Edit
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus />
          Add member
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setPendingDelete(true)}
        >
          <Trash2 />
          Delete
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNaira(contribution.amount)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {contribution.frequency}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{contribution.progress}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{contribution.members.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Withdrawal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{formatDate(contribution.withdrawalDate)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Member payment status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              {contribution.schedule.map((entry) => (
                <div
                  key={entry.period}
                  className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-0"
                >
                  <span className="font-medium">{entry.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{formatNaira(entry.amount)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        entry.status === "paid"
                          ? "bg-success/15 text-success"
                          : entry.status === "pending"
                            ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>People in this circle.</CardDescription>
          </CardHeader>
          <CardContent>
            {contribution.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">Position {member.position}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums text-muted-foreground">
                    {formatNaira(member.totalContributed)}
                  </span>
                  {member.userId !== contribution.createdBy && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setPendingRemove(member)}
                    >
                      <X className="text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contributionId={id}
        memberIds={contribution.members
          .map((member) => member.userId)
          .filter((userId): userId is string => !!userId)}
      />

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Delete contribution?"
        description={`Delete "${contribution.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteContribution.isPending}
        onConfirm={() => {
          deleteContribution.mutate(id, {
            onSuccess: () => router.push("/admin/contributions"),
          })
        }}
      />

      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove member?"
        description={
          pendingRemove
            ? `Remove ${pendingRemove.name} from "${contribution.name}"?`
            : ""
        }
        confirmLabel="Remove"
        destructive
        loading={removeMember.isPending}
        onConfirm={() => {
          if (!pendingRemove?.userId) return
          removeMember.mutate(
            { contributionId: id, userId: pendingRemove.userId },
            { onSuccess: () => setPendingRemove(null) }
          )
        }}
      />
    </div>
  )
}
