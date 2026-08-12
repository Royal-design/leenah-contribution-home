"use client"

import * as React from "react"
import { Eye, UserX, UserCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAdminUsers, useSetUserStatus } from "@/hooks/queries/use-admin"
import { formatDate, getInitials, formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function AdminUsersPage() {
  const { data, isPending } = useAdminUsers()
  const setUserStatus = useSetUserStatus()
  const [pendingUser, setPendingUser] = React.useState<{
    id: string
    name: string
    action: "suspended" | "active"
  } | null>(null)

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
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Active contributions</TableHead>
                <TableHead>Savings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {getInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.joinedAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">2</TableCell>
                  <TableCell className="tabular-nums">
                    {formatNaira(85000)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        user.status === "active"
                          ? "border-transparent bg-success/15 text-success"
                          : "border-transparent bg-warning/15 text-warning"
                      )}
                    >
                      {user.status === "active" ? "Active" : "Suspended"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`View ${user.firstName}`}>
                        <Eye />
                      </Button>
                      {user.status === "active" ? (
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
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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