"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import { useContributions } from "@/hooks/queries/use-contributions"
import { formatDate, formatNaira } from "@/lib/format"
import type { Contribution } from "@/types"

export default function AdminContributionsPage() {
  const { data, isPending } = useContributions()

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
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Withdrawal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((contribution: Contribution) => (
                <TableRow key={contribution.id}>
                  <TableCell>
                    <Link
                      href={`/admin/contributions/${contribution.id}`}
                      className="font-medium hover:text-primary hover:underline underline-offset-4"
                    >
                      {contribution.name}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatNaira(contribution.amount)} / {contribution.frequency}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {contribution.progress}%
                  </TableCell>
                  <TableCell>{contribution.memberCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(contribution.startDate)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contribution.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDate(contribution.withdrawalDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}