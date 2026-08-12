import type { AppNotification } from "@/types"
import { addDays, iso, TODAY } from "@/lib/mock/dates"

export const notifications: AppNotification[] = [
  {
    id: "ntf_001",
    type: "contribution",
    title: "Contribution due in 3 days",
    message:
      "Your ₦25,000 contribution to Monthly Growth Circle is due on the 17th.",
    createdAt: iso(addDays(TODAY, -2)),
    read: false,
  },
  {
    id: "ntf_002",
    type: "savings",
    title: "Savings balance milestone",
    message:
      "Your total savings have reached ₦180,000. Keep it going, Chiamaka!",
    createdAt: iso(addDays(TODAY, -4)),
    read: false,
  },
  {
    id: "ntf_003",
    type: "withdrawal",
    title: "Withdrawal request completed",
    message:
      "Your savings withdrawal of ₦50,000 was sent to GTBank ••6789 successfully.",
    createdAt: iso(addDays(TODAY, -10)),
    read: true,
  },
  {
    id: "ntf_004",
    type: "contribution",
    title: "Payment confirmed",
    message:
      "Your ₦50,000 biweekly contribution to Workplace Savings Pool was received.",
    createdAt: iso(addDays(TODAY, -4)),
    read: true,
  },
  {
    id: "ntf_005",
    type: "system",
    title: "New withdrawal window",
    message:
      "Your Monthly Growth Circle payout becomes available on September 30, 2026.",
    createdAt: iso(addDays(TODAY, -1)),
    read: false,
  },
  {
    id: "ntf_006",
    type: "savings",
    title: "Goal archived",
    message: "Your Children Education goal reached 100% and was completed.",
    createdAt: iso(addDays(TODAY, -60)),
    read: true,
  },
]