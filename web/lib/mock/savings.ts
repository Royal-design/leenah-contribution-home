import type { SavingsAccount } from "@/types"
import { addDays, addMonths, iso, TODAY } from "@/lib/mock/dates"

export const savingsAccount: SavingsAccount = {
  balance: 128000,
  totalSaved: 240000,
  totalWithdrawn: 112000,
  goals: [
    {
      id: "svg_001",
      name: "Emergency Fund",
      target: 300000,
      current: 120000,
      status: "active",
      createdAt: iso(addMonths(TODAY, -8)),
      targetDate: iso(addMonths(TODAY, 4)),
      color: "oklch(0.62 0.19 255)",
    },
    {
      id: "svg_002",
      name: "New Car",
      target: 2500000,
      current: 785000,
      status: "active",
      createdAt: iso(addMonths(TODAY, -14)),
      targetDate: iso(addMonths(TODAY, 10)),
      color: "oklch(0.55 0.22 262.5)",
    },
    {
      id: "svg_003",
      name: "Children Education",
      target: 1000000,
      current: 1000000,
      status: "completed",
      createdAt: iso(addMonths(TODAY, -20)),
      targetDate: iso(addMonths(TODAY, -2)),
      color: "oklch(0.65 0.15 232)",
    },
    {
      id: "svg_004",
      name: "Home Renovation",
      target: 600000,
      current: 150000,
      status: "active",
      createdAt: iso(addMonths(TODAY, -3)),
      targetDate: iso(addDays(TODAY, 270)),
      color: "oklch(0.48 0.16 276)",
    },
  ],
}

export function getSavingsGoalById(id: string) {
  return savingsAccount.goals.find((goal) => goal.id === id)
}

export const savingsGrowth = [
  { month: "Jan", amount: 45000 },
  { month: "Feb", amount: 62000 },
  { month: "Mar", amount: 85000 },
  { month: "Apr", amount: 110000 },
  { month: "May", amount: 132000 },
  { month: "Jun", amount: 150000 },
  { month: "Jul", amount: 180000 },
  { month: "Aug", amount: 205000 },
]