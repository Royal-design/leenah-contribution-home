"use client"

import * as React from "react"
import {
  Wallet,
  Building2,
  Plus,
  ArrowUpFromLine,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  CreditCard,
  CopyCheck,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageSkeleton } from "@/components/shared/skeletons"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { WithdrawDialog } from "@/components/forms/withdraw-dialog"
import { useSavings } from "@/hooks/queries/use-savings"
import {
  useDVA,
  useCreateDVA,
  useRequeryDVA,
  useBankAccounts,
  useDeleteBankAccount,
} from "@/hooks/queries/use-wallet"
import { apiVerifyCardFunding } from "@/lib/api/wallet"
import { formatNaira } from "@/lib/format"
import { toast } from "sonner"
import type { BankAccount, DVA } from "@/types"

function DVACard({ dva, onCreate, onRequery, creating, requering }: {
  dva: DVA | null
  onCreate: () => void
  onRequery: () => void
  creating: boolean
  requering: boolean
}) {
  const [copied, setCopied] = React.useState<"account" | "name" | null>(null)

  function copyText(text: string, field: "account" | "name") {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!dva) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Building2 className="size-10 text-muted-foreground" />
          <p className="text-center text-sm text-muted-foreground">
            No virtual account yet. Create one to fund your wallet via bank transfer.
          </p>
          <Button onClick={onCreate} disabled={creating}>
            {creating && <Loader2 className="size-4 animate-spin" />}
            Create Virtual Account
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (dva.status === "pending") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium">Account is being set up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This usually takes a few minutes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onRequery} disabled={requering}>
            <RefreshCw className={`size-3.5 ${requering ? "animate-spin" : ""}`} />
            Check status
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Wallet funding account</CardTitle>
          <Badge variant="outline" className="text-xs capitalize">
            {dva.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Bank</p>
          <p className="text-sm font-semibold">{dva.bankName ?? "Paystack-Titan"}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Account name</p>
              <p className="truncate text-sm font-semibold">{dva.accountName ?? "—"}</p>
            </div>
            {dva.accountName && (
              <button
                type="button"
                onClick={() => copyText(dva.accountName!, "name")}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
              >
                {copied === "name" ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
              </button>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Account number</p>
              <p className="truncate text-sm font-semibold tabular-nums">{dva.accountNumber ?? "—"}</p>
            </div>
            {dva.accountNumber && (
              <button
                type="button"
                onClick={() => copyText(dva.accountNumber!, "account")}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
              >
                {copied === "account" ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Transfer money from your bank to this account. Your wallet is credited after confirmation.
        </p>
      </CardContent>
    </Card>
  )
}

function BankAccountsCard({ accounts, onDelete, deleting }: {
  accounts: BankAccount[]
  onDelete: (id: string) => void
  deleting: boolean
}) {
  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Building2 className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No saved bank accounts.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Saved bank accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{account.bankName}</p>
                {account.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {account.accountName ?? "—"} · {account.accountNumberMasked}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive"
              onClick={() => onDelete(account.id)}
              disabled={deleting}
            >
              Remove
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function WalletPage() {
  const savings = useSavings()
  const { data: dva, isLoading: dvaLoading } = useDVA()
  const { data: bankAccounts, isLoading: bankLoading } = useBankAccounts()
  const createDVA = useCreateDVA()
  const requeryDVA = useRequeryDVA()
  const deleteBank = useDeleteBankAccount()
  const [fundOpen, setFundOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get("reference") || params.get("trxref")
    if (reference) {
      window.history.replaceState({}, "", window.location.pathname)
      apiVerifyCardFunding(reference)
        .then(({ success }) => {
          if (success) {
            toast.success("Payment confirmed. Wallet credited.")
            savings.refetch()
          } else {
            toast.info("Payment is being processed. Your wallet will be credited shortly.")
          }
        })
        .catch(() => {
          toast.info("Payment is being processed. Your wallet will be credited shortly.")
        })
    }
  }, [])

  if (savings.isPending) {
    return <PageSkeleton />
  }

  const available = savings.data?.balance ?? 0
  const reserved = savings.data?.reserved ?? 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Wallet"
        description="Fund your wallet and manage bank accounts."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>
            <ArrowUpFromLine />
            Withdraw
          </Button>
          <Button size="sm" onClick={() => setFundOpen(true)}>
            <Plus />
            Add money
          </Button>
        </div>
      </PageHeader>

      <section aria-label="Balance summary" className="grid gap-4 sm:grid-cols-3">
        <DashboardStatCard
          title="Available balance"
          value={formatNaira(available)}
          description="Ready to spend"
          icon={Wallet}
          tone="success"
        />
        <DashboardStatCard
          title="Reserved"
          value={formatNaira(reserved)}
          description="Locked for withdrawals"
          icon={CreditCard}
          tone="warning"
        />
        <DashboardStatCard
          title="Total"
          value={formatNaira(available + reserved)}
          description="Total in wallet"
          icon={Wallet}
          tone="info"
        />
      </section>

      <section aria-label="Virtual account" className="max-w-lg">
        {dvaLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <DVACard
            dva={dva ?? null}
            onCreate={() => createDVA.mutate()}
            onRequery={() => requeryDVA.mutate()}
            creating={createDVA.isPending}
            requering={requeryDVA.isPending}
          />
        )}
      </section>

      <section aria-label="Bank accounts" className="max-w-lg">
        {bankLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <BankAccountsCard
            accounts={bankAccounts ?? []}
            onDelete={(id) => deleteBank.mutate(id)}
            deleting={deleteBank.isPending}
          />
        )}
      </section>

      <FundingDialog open={fundOpen} onOpenChange={setFundOpen} />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balance={available}
      />
    </div>
  )
}
