import type { Contribution } from "@/types"
import { addDays, addMonths, iso, TODAY } from "@/lib/mock/dates"

const memberNames = [
  "Ngozi Eze",
  "Tunde Balogun",
  "Folake Adebayo",
  "Emeka Nwosu",
  "Chinedu Okeke",
  "Zainab Mohammed",
  "Obinna Uche",
  "Amina Suleiman",
  "Halima Yusuf",
  "Usman Danjuma",
  "Bisi Olawale",
  "Kelechi Okafor",
]

function buildMembers(
  count: number,
  amountPerRound: number,
  paidRounds: number
) {
  return Array.from({ length: count }, (_, index) => ({
    id: `mbr_${index}`,
    name: memberNames[index % memberNames.length],
    position: index + 1,
    totalContributed: (index + 1 <= paidRounds ? amountPerRound : 0) * 12,
  }))
}

function buildSchedule(rounds: number, amount: number, startDate: Date) {
  return Array.from({ length: rounds }, (_, index) => {
    const period = addMonths(startDate, index)
    const status: "paid" | "pending" | "upcoming" =
      index < rounds - 6
        ? "paid"
        : index === rounds - 6
          ? "pending"
          : "upcoming"
    return {
      period: iso(period),
      label: period.toLocaleDateString("en-NG", { month: "long", year: "numeric" }),
      dueDate: iso(addDays(period, 30)),
      status,
      amount,
    }
  })
}

export const contributions: Contribution[] = [
  {
    id: "ctb_001",
    name: "Monthly Growth Circle",
    description:
      "A 12-member monthly contribution circle. Every month, each member contributes ₦25,000 and receives the full pot in turn.",
    amount: 25000,
    frequency: "monthly",
    memberCount: 12,
    startDate: iso(addMonths(TODAY, -6)),
    endDate: iso(addMonths(TODAY, 6)),
    withdrawalDate: iso(addDays(addMonths(TODAY, 6), 10)),
    totalContributed: 150000,
    totalExpected: 300000,
    progress: 50,
    status: "active",
    nextPaymentDate: iso(addDays(TODAY, 5)),
    lastPaymentDate: iso(addDays(TODAY, -25)),
    members: buildMembers(12, 25000, 6),
    schedule: buildSchedule(12, 25000, addMonths(TODAY, -6)),
    withdrawalRule: {
      type: "fixed_date",
      eligibleDate: iso(addDays(addMonths(TODAY, 6), 10)),
      note: "Full payout after all 12 monthly rounds have been confirmed.",
    },
    currentUserPosition: 4,
    organization: "Lagos Savings Guild",
  },
  {
    id: "ctb_002",
    name: "Workplace Savings Pool",
    description:
      "Bi-weekly rotational savings for a team of 8 colleagues. Rotating payout order each cycle.",
    amount: 50000,
    frequency: "biweekly",
    memberCount: 8,
    startDate: iso(addMonths(TODAY, -2)),
    endDate: iso(addMonths(TODAY, 14)),
    withdrawalDate: iso(addDays(addMonths(TODAY, 14), 14)),
    totalContributed: 200000,
    totalExpected: 1600000,
    progress: 12,
    status: "active",
    nextPaymentDate: iso(addDays(TODAY, 9)),
    lastPaymentDate: iso(addDays(TODAY, -4)),
    members: buildMembers(8, 50000, 4),
    schedule: buildSchedule(16, 50000, addMonths(TODAY, -2)),
    withdrawalRule: {
      type: "on_schedule",
      note: "Members receive the pooled amount on their scheduled rotation.",
    },
    currentUserPosition: 2,
    organization: "AfriBuild Technologies",
  },
  {
    id: "ctb_003",
    name: "Family Ajo Circle",
    description:
      "A classic family contribution (ajo). Weekly contributions supporting household goals throughout the year.",
    amount: 10000,
    frequency: "weekly",
    memberCount: 6,
    startDate: iso(addDays(TODAY, 14)),
    endDate: iso(addDays(TODAY, 14 * 24)),
    withdrawalDate: iso(addDays(TODAY, 14 * 24 + 7)),
    totalContributed: 0,
    totalExpected: 1440000,
    progress: 0,
    status: "upcoming",
    nextPaymentDate: iso(addDays(TODAY, 14)),
    members: buildMembers(6, 10000, 0),
    schedule: buildSchedule(24, 10000, addDays(TODAY, 14)),
    withdrawalRule: {
      type: "on_schedule",
      note: "Each member withdraws the weekly pool in their assigned week.",
    },
    currentUserPosition: 3,
    organization: "Okafor Extended Family",
  },
  {
    id: "ctb_004",
    name: "Community Building Fund",
    description:
      "Monthly contribution towards community development projects in Surulere. Now closed for new members.",
    amount: 20000,
    frequency: "monthly",
    memberCount: 15,
    startDate: iso(addMonths(TODAY, -12)),
    endDate: iso(addMonths(TODAY, -1)),
    withdrawalDate: iso(addMonths(TODAY, -1)),
    totalContributed: 360000,
    totalExpected: 360000,
    progress: 100,
    status: "completed",
    nextPaymentDate: iso(addMonths(TODAY, -1)),
    lastPaymentDate: iso(addMonths(TODAY, -1)),
    members: buildMembers(15, 20000, 18),
    schedule: buildSchedule(18, 20000, addMonths(TODAY, -12)),
    withdrawalRule: {
      type: "fixed_date",
      eligibleDate: iso(addMonths(TODAY, -1)),
      note: "Cycle completed. All members have received their payout.",
    },
    currentUserPosition: 7,
    organization: "Surulere Residents Association",
  },
  {
    id: "ctb_005",
    name: "Youth Venture Savings",
    description:
      "Twelve young entrepreneurs save ₦15,000 monthly to build a joint business capital pool.",
    amount: 15000,
    frequency: "monthly",
    memberCount: 10,
    startDate: iso(addMonths(TODAY, -3)),
    endDate: iso(addMonths(TODAY, 9)),
    withdrawalDate: iso(addDays(addMonths(TODAY, 9), 7)),
    totalContributed: 45000,
    totalExpected: 150000,
    progress: 30,
    status: "active",
    nextPaymentDate: iso(addDays(TODAY, 18)),
    lastPaymentDate: iso(addDays(TODAY, -12)),
    members: buildMembers(10, 15000, 3),
    schedule: buildSchedule(10, 15000, addMonths(TODAY, -3)),
    withdrawalRule: {
      type: "fixed_date",
      eligibleDate: iso(addDays(addMonths(TODAY, 9), 7)),
      note: "Pot releases after the final monthly round.",
    },
    currentUserPosition: 5,
    organization: "Lagos Enterprise Network",
  },
]

export function getContributionById(id: string) {
  return contributions.find((contribution) => contribution.id === id)
}

export const availableContributionsToJoin = [
  {
    id: "ctb_join_001",
    name: "Monthly Growth Circle",
    description:
      "Join a new cohort of the popular Monthly Growth Circle. ₦25,000 monthly, 12 members, 12 rounds.",
    amount: 25000,
    frequency: "monthly" as const,
    memberCount: 12,
    startDate: iso(addMonths(TODAY, 1)),
    endDate: iso(addMonths(TODAY, 13)),
    withdrawalDate: iso(addDays(addMonths(TODAY, 13), 10)),
    rounds: 12,
    organization: "Lagos Savings Guild",
  },
  {
    id: "ctb_join_002",
    name: "Quarterly Wealth Builder",
    description:
      "Larger monthly contributions for serious savers. ₦100,000 monthly, 6 members, rotating payout.",
    amount: 100000,
    frequency: "monthly" as const,
    memberCount: 6,
    startDate: iso(addMonths(TODAY, 1)),
    endDate: iso(addMonths(TODAY, 7)),
    withdrawalDate: iso(addDays(addMonths(TODAY, 7), 12)),
    rounds: 6,
    organization: "Prime Circle Lagos",
  },
  {
    id: "ctb_join_003",
    name: "Family Ajo Circle – New Cycle",
    description:
      "Weekly family contribution. ₦10,000 weekly for convenient micro-saving.",
    amount: 10000,
    frequency: "weekly" as const,
    memberCount: 6,
    startDate: iso(addDays(TODAY, 14)),
    endDate: iso(addDays(TODAY, 14 * 24)),
    withdrawalDate: iso(addDays(TODAY, 14 * 24 + 7)),
    rounds: 24,
    organization: "Okafor Extended Family",
  },
  {
    id: "ctb_join_004",
    name: "SME Capital Circle",
    description:
      "Biweekly pool for small business owners. ₦60,000 biweekly, 8 members.",
    amount: 60000,
    frequency: "biweekly" as const,
    memberCount: 8,
    startDate: iso(addMonths(TODAY, 1)),
    endDate: iso(addMonths(TODAY, 15)),
    withdrawalDate: iso(addDays(addMonths(TODAY, 15), 14)),
    rounds: 8,
    organization: "SME Connect Lagos",
  },
]