"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { useContributions } from "@/hooks/queries/use-contributions"
import { formatDate, formatNaira } from "@/lib/format"
import type { Contribution } from "@/types"

export default function AdminContributionsPage() {
  const { data, isPending } = useContributions()

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
      cell: ({ row }) => <span>{row.original.memberCount}</span>,
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
          {formatDate(row.original.withdrawalDate)}
        </span>
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
    </div>
  )
}