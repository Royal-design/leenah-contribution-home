"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ChevronLeft, Target, Plus, Pencil, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { SavingsGoalProgress } from "@/components/contributions/contribution-progress"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { EditGoalDialog } from "@/components/forms/edit-goal-dialog"
import {
  useSavings,
  useDeleteSavingsGoal,
} from "@/hooks/queries/use-savings"
import { formatDate, formatMonthYear, formatNaira } from "@/lib/format"

export default function SavingsDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const savings = useSavings()
  const deleteGoal = useDeleteSavingsGoal()
  const [fundOpen, setFundOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  if (savings.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-xl lg:col-span-2" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    )
  }

  const goal = savings.data?.goals.find((item) => item.id === id)

  if (!goal) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <p className="text-sm font-medium">Savings goal not found.</p>
        <Button variant="outline" size="sm" render={<Link href="/savings" />}>
          Back to savings
        </Button>
      </div>
    )
  }

  const remaining = Math.max(0, goal.target - goal.current)
  const percent =
    goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/savings" />}>
        <ChevronLeft />
        All savings
      </Button>

      <PageHeader
        title={goal.name}
        description={
          goal.status === "completed"
            ? "This goal has been completed."
            : "Keep saving to reach your target."
        }
      >
        <div className="flex items-center gap-2">
          {goal.status !== "completed" && (
            <Button size="sm" onClick={() => setFundOpen(true)}>
              <Plus />
              Add to {goal.name}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>How close you are to this goal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatNaira(goal.current)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  of {formatNaira(goal.target)} target
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-primary">
                {percent}%
              </p>
            </div>
            <SavingsGoalProgress current={goal.current} target={goal.target} />
            {remaining > 0 && (
              <p className="text-sm text-muted-foreground">
                {formatNaira(remaining)} remaining to reach your target.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-primary" aria-hidden="true" />
              Goal details
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{goal.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{formatMonthYear(goal.createdAt)}</p>
            </div>
            {goal.targetDate && (
              <div>
                <p className="text-muted-foreground">Target date</p>
                <p className="font-medium">{formatDate(goal.targetDate)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FundingDialog
        open={fundOpen}
        onOpenChange={setFundOpen}
      />

      <EditGoalDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        goal={goal}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete savings goal?"
        description={`Delete "${goal.name}"? Your saved balance is not affected.`}
        confirmLabel="Delete"
        destructive
        loading={deleteGoal.isPending}
        onConfirm={() => {
          deleteGoal.mutate(goal.id, {
            onSuccess: () => router.push("/savings"),
          })
        }}
      />
    </div>
  )
}