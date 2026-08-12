"use client"

import * as React from "react"
import { Eye, Trash2, UserX, UserCheck, UserPlus, Upload } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InviteUserDialog } from "@/components/forms/invite-user-dialog"
import { BulkUploadDialog } from "@/components/forms/bulk-upload-dialog"
import {
  useAdminUsers,
  useDeleteUser,
  useSetUserRole,
  useSetUserStatus,
} from "@/hooks/queries/use-admin"
import { useAuthStore } from "@/stores/auth-store"
import { formatDate, getInitials, formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Role, User } from "@/types"

export default function AdminUsersPage() {
  const { data, isPending } = useAdminUsers()
  const setUserStatus = useSetUserStatus()
  const setUserRole = useSetUserRole()
  const deleteUser = useDeleteUser()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [pendingUser, setPendingUser] = React.useState<{
    id: string
    name: string
    action: "suspended" | "active"
  } | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<User | null>(null)

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
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {row.original.firstName} {row.original.lastName}
            </span>
            {row.original.id === currentUserId && (
              <span className="block text-xs text-muted-foreground">You</span>
            )}
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
      id: "role",
      header: "Role",
      cell: ({ row }) => (
        <Select
          value={row.original.role}
          onValueChange={(value) =>
            setUserRole.mutate({
              userId: row.original.id,
              role: value as Role,
            })
          }
        >
          <SelectTrigger size="sm" aria-label={`Change role for ${row.original.firstName}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
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
      header: "Contributions",
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
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              status === "active" &&
                "border-transparent bg-success/15 text-success",
              status === "suspended" &&
                "border-transparent bg-warning/15 text-warning",
              status === "invited" &&
                "border-transparent bg-info/15 text-info dark:bg-info/25"
            )}
          >
            {status === "active"
              ? "Active"
              : status === "suspended"
                ? "Suspended"
                : "Invited"}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => {
        const user = row.original
        const allowManage = user.id !== currentUserId
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${user.firstName}`}
            >
              <Eye />
            </Button>
            {user.status !== "invited" && allowManage && (
              user.status === "active" ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Suspend ${user.firstName}`}
                  onClick={() =>
                    setPendingUser({
                      id: user.id,
                      name: `${user.firstName} ${user.lastName}`,
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
                  aria-label={`Reactivate ${user.firstName}`}
                  onClick={() =>
                    setPendingUser({
                      id: user.id,
                      name: `${user.firstName} ${user.lastName}`,
                      action: "active",
                    })
                  }
                >
                  <UserCheck className="text-success" />
                </Button>
              )
            )}
            {allowManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${user.firstName}`}
                onClick={() => setPendingDelete(user)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Users"
        description="Manage everyone registered on the platform."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Upload />
            Bulk upload
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus />
            Invite user
          </Button>
        </div>
      </PageHeader>

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

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} />

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

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete user?"
        description={
          pendingDelete
            ? `Permanently delete ${pendingDelete.firstName} ${pendingDelete.lastName}'s account? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete user"
        destructive
        loading={deleteUser.isPending}
        onConfirm={() => {
          if (!pendingDelete) return
          deleteUser.mutate(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}