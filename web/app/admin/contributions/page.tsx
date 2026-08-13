"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Pencil, Eye, Trash2 } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { DataTable } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAdminContributions, useAdminDeleteContribution } from "@/hooks/queries/use-admin"
import { formatDate, formatNaira } from "@/lib/format"
import type { Contribution } from "@/types"

const PAGE_SIZE = 10

export default function AdminContributionsPage() {
  const router = useRouter()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [pendingDelete, setPendingDelete] = React.useState<Contribution | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isPending } = useAdminContributions({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
  })
  const deleteContribution = useAdminDeleteContribution()

  const items = data?.items ?? []

  const columns: ColumnDef<Contribution>[] = [
    {
      accessorKey: "name",
      header: "Plan",
      cell: ({ row }) => (
        <Link
          href={`/admin/contributions/${row.original.id}`}
          className="font-medium hover:text-primary hover:underline underline-offset-4"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatNaira(row.original.amount)} / {row.original.frequency}
        </span>
      ),
    },
    {
      accessorKey: "progress",
      header: "Progress",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.progress}%</span>
      ),
    },
    {
      accessorKey: "memberCount",
      header: "Members",
      cell: ({ row }) => <span>{row.original.members.length}</span>,
    },
    {
      accessorKey: "startDate",
      header: "Starts",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.startDate)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "withdrawalDate",
      header: "Withdrawal",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.withdrawalDate
            ? formatDate(row.original.withdrawalDate)
            : "—"}
        </span>
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
            aria-label={`View ${row.original.name}`}
            render={<Link href={`/admin/contributions/${row.original.id}`} />}
          >
            <Eye />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.original.name}`}
            render={<Link href={`/admin/contributions/${row.original.id}/edit`} />}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${row.original.name}`}
            onClick={() => setPendingDelete(row.original)}
          >
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Contributions"
        description="Manage and configure contribution plans."
      >
        <Button size="sm" render={<Link href="/admin/contributions/create" />}>
          <Plus />
          New plan
        </Button>
      </PageHeader>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by name or organization…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm pl-8"
          aria-label="Search contributions"
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
          No contributions matched your search.
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
                    <Link
                      href={`/admin/contributions/${original.id}`}
                      className="min-w-0 font-medium hover:text-primary hover:underline underline-offset-4"
                    >
                      {original.name}
                    </Link>
                    <StatusBadge status={original.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="tabular-nums">
                        {formatNaira(original.amount)} / {original.frequency}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Members</p>
                      <p className="tabular-nums">{original.memberCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Progress</p>
                      <p className="tabular-nums">{original.progress}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Starts</p>
                      <p className="text-muted-foreground">
                        {formatDate(original.startDate)}
                      </p>
                    </div>
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

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete contribution?"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteContribution.isPending}
        onConfirm={() => {
          if (!pendingDelete) return
          deleteContribution.mutate(pendingDelete.id, {
            onSuccess: () => {
              setPendingDelete(null)
              router.push("/admin/contributions")
            },
          })
        }}
      />
    </div>
  )
}