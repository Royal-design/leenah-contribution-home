import type { AdminStats, DashboardOverview } from "@/types"
import { addDays, iso, TODAY } from "@/lib/mock/dates"
import { contributions } from "@/lib/mock/contributions"
import { savingsAccount, savingsGrowth } from "@/lib/mock/savings"
import { transactions } from "@/lib/mock/transactions"

const active = contributions.find((c) => c.id === "ctb_001")!

export const dashboardOverview: DashboardOverview = {
  totalBalance: 245800,
  totalSavings: 180000,
  activeContributions: 65800,
  nextContribution: {
    amount: 20000,
    dueDate: iso(addDays(TODAY, 5)),
    daysLeft: 5,
  },
  savingsGrowth,
  contributionActivity: [
    { month: "Feb", contributions: 35000 },
    { month: "Mar", contributions: 40000 },
    { month: "Apr", contributions: 40000 },
    { month: "May", contributions: 75000 },
    { month: "Jun", contributions: 90000 },
    { month: "Jul", contributions: 100000 },
    { month: "Aug", contributions: 110000 },
  ],
  contributionDistribution: [
    { name: "Active", value: 358000 },
    { name: "Completed", value: 360000 },
    { name: "Upcoming", value: 1440000 },
  ],
  recentTransactions: transactions.slice(0, 5),
  upcomingContribution: active,
}

export const adminStats: AdminStats = {
  totalUsers: 348,
  activeContributions: 42,
  totalFunds: 5284000,
  pendingWithdrawals: 17,
  monthlyVolume: 1260000,
  userGrowth: [
    { month: "Feb", users: 142 },
    { month: "Mar", users: 176 },
    { month: "Apr", users: 201 },
    { month: "May", users: 233 },
    { month: "Jun", users: 268 },
    { month: "Jul", users: 310 },
    { month: "Aug", users: 348 },
  ],
  contributionVolume: [
    { month: "Feb", volume: 420000 },
    { month: "Mar", volume: 510000 },
    { month: "Apr", volume: 585000 },
    { month: "May", volume: 640000 },
    { month: "Jun", volume: 720000 },
    { month: "Jul", volume: 890000 },
    { month: "Aug", volume: 980000 },
  ],
  contributionStatus: [
    { name: "Active", value: 42 },
    { name: "Upcoming", value: 12 },
    { name: "Completed", value: 28 },
  ],
}

export const savingsSummary = {
  balance: savingsAccount.balance,
  growth: savingsGrowth,
}