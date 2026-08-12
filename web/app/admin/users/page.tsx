"use client"

import * as React from "react"
import { Eye, UserX, UserCheck } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAdminUsers, useSetUserStatus } from "@/hooks/queries/use-admin"
import { formatDate, getInitials, formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { User } from "@/types"

export default function AdminUsersPage() {
  const { data, isPending } = useAdminUsers()
  const setUserStatus = useSetUserStatus()
  const [pendingUser, setPendingUser] = React.useState<{
    id: string
    name: string
    action: "suspended" | "active"
  } | null>(null)

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "firstName",
      header: "User",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback>
              {getInitials(row.original.firstName, row.original.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "joinedAt",
      header: "Joined",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.joinedAt)}
        </span>
      ),
    },
    {
      id: "activeContributions",
      header: "Active contributions",
      cell: () => <span className="tabular-nums">2</span>,
    },
    {
      id: "savings",
      header: "Savings",
      cell: () => <span className="tabular-nums">{formatNaira(85000)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "font-medium",
            row.original.status === "active"
              ? "border-transparent bg-success/15 text-success"
              : "border-transparent bg-warning/15 text-warning"
          )}
        >
          {row.original.status === "active" ? "Active" : "Suspended"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`View ${row.original.firstName}`}
          >
            <Eye />
          </Button>
          {row.original.status === "active" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Suspend ${row.original.firstName}`}
              onClick={() =>
                setPendingUser({
                  id: row.original.id,
                  name: `${row.original.firstName} ${row.original.lastName}`,
                  action: "suspended",
                })
              }
            >
              <UserX className="text-destructive" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Reactivate ${row.original.firstName}`}
              onClick={() =>
                setPendingUser({
                  id: row.original.id,
                  name: `${row.original.firstName} ${row.original.lastName}`,
                  action: "active",
                })
              }
            >
              <UserCheck className="text-success" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Users"
        description="Manage everyone registered on the platform."
      />

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          <div className="overflow-x-auto">
            <DataTable columns={columns} data={data ?? []} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingUser}
        onOpenChange={(open) => !open && setPendingUser(null)}
        title={
          pendingUser?.action === "suspended"
            ? "Suspend user"
            : "Reactivate user"
        }
        description={
          pendingUser
            ? `Are you sure you want to ${
                pendingUser.action === "suspended" ? "suspend" : "reactivate"
              } ${pendingUser.name}?`
            : ""
        }
        confirmLabel={
          pendingUser?.action === "suspended" ? "Suspend" : "Reactivate"
        }
        destructive={pendingUser?.action === "suspended"}
        loading={setUserStatus.isPending}
        onConfirm={() => {
          if (!pendingUser) return
          setUserStatus.mutate({
            userId: pendingUser.id,
            status: pendingUser.action,
          })
          setPendingUser(null)
        }}
      />
    </div>
  )
}