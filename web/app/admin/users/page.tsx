"use client"

import * as React from "react"
import { Eye, Trash2, UserX, UserCheck, UserPlus, Upload, Search } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
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
import { formatDate, getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Role, User } from "@/types"

const PAGE_SIZE = 10

export default function AdminUsersPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isPending } = useAdminUsers({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
  })
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

  const items = data?.items ?? []

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

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm pl-8"
          aria-label="Search users"
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No users matched your search.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <DataTable
              columns={columns}
              data={items}
              mobileCard={({ original }) => (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {getInitials(original.firstName, original.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {original.firstName} {original.lastName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {original.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-medium capitalize",
                        original.status === "active" &&
                          "border-transparent bg-success/15 text-success",
                        original.status === "suspended" &&
                          "border-transparent bg-warning/15 text-warning",
                        original.status === "invited" &&
                          "border-transparent bg-info/15 text-info dark:bg-info/25"
                      )}
                    >
                      {original.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground capitalize">
                        {original.role}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {formatDate(original.joinedAt)}
                      </span>
                    </div>
                    {original.id !== currentUserId && (
                      <div className="flex items-center gap-1">
                        {original.status !== "invited" && (
                          original.status === "active" ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Suspend ${original.firstName}`}
                              onClick={() =>
                                setPendingUser({
                                  id: original.id,
                                  name: `${original.firstName} ${original.lastName}`,
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
                              aria-label={`Reactivate ${original.firstName}`}
                              onClick={() =>
                                setPendingUser({
                                  id: original.id,
                                  name: `${original.firstName} ${original.lastName}`,
                                  action: "active",
                                })
                              }
                            >
                              <UserCheck className="text-success" />
                            </Button>
                          )
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${original.firstName}`}
                          onClick={() => setPendingDelete(original)}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            />
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
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